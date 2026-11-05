#!/usr/bin/env node
/**
 * demo/reset.mjs - put the GitHub side of this repository back into a clean demo state.
 *
 *   npm run demo:reset -- --dry-run     preview, change nothing
 *   npm run demo:reset                  preview, ask, then apply
 *
 * What a reset does
 *   1. Closes every open pull request, with a comment explaining why.
 *   2. Deletes every remote branch except the default branch, protected branches and `demo/*`.
 *   3. Restores the demo backlog described by demo/backlog/*.md. For each seed it creates the
 *      issue if it is missing; otherwise it reopens it and puts the title, body and labels back,
 *      clears assignees and deletes comments. Each issue carries a hidden
 *      `<!-- demo-seed: <file name> -->` marker, so it is still found if its title was edited.
 *      A seed with no marker is adopted by exact title on the first run.
 *   4. Closes any other open issue as "not planned" (leftovers from previous demos).
 *
 * Opt-in extras
 *   --enrich       Run the real issue-enrichment workflow for every seed that already existed.
 *                  Each run is a genuine Copilot agent run (minutes, premium requests).
 *   --reset-main   Force-reset the default branch to the `demo-baseline` tag. Use it after a demo
 *                  has merged pull requests into main. It lists the commits it will discard and
 *                  needs you to type the repository name, because it rewrites main.
 *
 * Other flags
 *   --repo owner/name   Target another repository (default: the one in the current directory).
 *   --yes, -y           Skip the confirmation prompt.
 *   --validate          Only check the seed files. Offline: no gh, no network. CI runs this.
 *   --help, -h          Show usage.
 *
 * Safe by design
 *   - Always prints the plan first; nothing changes without a confirmation or --yes.
 *   - Never touches closed pull requests, closed non-seed issues, tags, settings, secrets,
 *     workflows or your local clone, and never rewrites history unless you pass --reset-main.
 *   - Idempotent: a second run reports "already in demo state".
 *   - A seed the script has to create is enriched by the live workflow straight away, because
 *     the `issues: opened` trigger fires like it does for any new issue.
 *
 * Requires Node 22+ and the GitHub CLI (`gh auth login`, `repo` scope). No npm dependencies.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const BACKLOG_DIR = join(dirname(fileURLToPath(import.meta.url)), 'backlog')
const BASELINE_TAG = 'demo-baseline'
const ENRICH_WORKFLOW = 'issue-enrichment.lock.yml'
const KEEP_BRANCH_PREFIX = 'demo/'
const SEED_MARKER = /<!--\s*demo-seed:\s*([\w.-]+)\s*-->/
const FRONT_MATTER_KEYS = ['title', 'labels']
const MAX_BODY_LENGTH = 60_000 // GitHub's limit is 65,536 characters.

const { values: flags } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    yes: { type: 'boolean', short: 'y', default: false },
    repo: { type: 'string' },
    enrich: { type: 'boolean', default: false },
    'reset-main': { type: 'boolean', default: false },
    validate: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const USAGE = `Usage: npm run demo:reset -- [options]

  --dry-run          Preview the plan, change nothing
  --yes, -y          Skip the confirmation prompt
  --repo owner/name  Target another repository (default: current directory's)
  --enrich           Then run the issue-enrichment workflow for each existing seed
  --reset-main       Also force-reset the default branch to the "${BASELINE_TAG}" tag
  --validate         Only check demo/backlog/*.md (offline)
  --help, -h         Show this help`

// ---------------------------------------------------------------------------
// Seeds: demo/backlog/*.md
// ---------------------------------------------------------------------------

/** Parses one seed file: `---` front matter of `key: <JSON>` lines, then the issue body. */
function parseSeed(slug, text) {
  const fail = (message) => {
    throw new Error(`demo/backlog/${slug}.md: ${message}`)
  }
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'))
  if (!match) fail('expected front matter between two "---" lines')

  const meta = {}
  for (const line of match[1].split('\n').filter((entry) => entry.trim())) {
    const pair = /^([a-z]+):\s*(.+)$/.exec(line)
    if (!pair) fail(`cannot read front matter line: ${line}`)
    if (!FRONT_MATTER_KEYS.includes(pair[1])) fail(`unknown front matter key "${pair[1]}" (allowed: ${FRONT_MATTER_KEYS.join(', ')})`)
    try {
      meta[pair[1]] = JSON.parse(pair[2])
    } catch {
      fail(`"${pair[1]}" must be a JSON value, for example title: "Fix the thing"`)
    }
  }

  const { title } = meta
  if (typeof title !== 'string' || !title || title !== title.trim() || title.length > 256) fail('"title" must be a trimmed string of 1-256 characters')
  const labels = meta.labels ?? []
  if (!Array.isArray(labels) || labels.some((label) => typeof label !== 'string' || !label.trim())) fail('"labels" must be a JSON array of non-empty strings')

  const body = match[2].trim()
  if (!body) fail('the issue body is empty')
  if (SEED_MARKER.test(body)) fail('the body must not contain a demo-seed marker; the script adds it')
  const issueBody = `${body}\n\n<!-- demo-seed: ${slug} -->`
  if (issueBody.length > MAX_BODY_LENGTH) fail(`the body is too long (${issueBody.length} > ${MAX_BODY_LENGTH} characters)`)
  return { slug, title, labels, body: issueBody }
}

function loadSeeds() {
  const files = readdirSync(BACKLOG_DIR)
    .filter((file) => file.endsWith('.md') && file.toLowerCase() !== 'readme.md')
    .sort()
  if (!files.length) throw new Error(`No seed files found in ${BACKLOG_DIR}`)

  const seeds = files.map((file) => {
    const slug = basename(file, '.md')
    if (!/^[\w.-]+$/.test(slug)) throw new Error(`demo/backlog/${file}: use only letters, digits, "-", "_" and "." in file names`)
    return parseSeed(slug, readFileSync(join(BACKLOG_DIR, file), 'utf8'))
  })

  const titles = new Map()
  for (const seed of seeds) {
    const key = seed.title.toLowerCase()
    if (titles.has(key)) throw new Error(`Seeds "${titles.get(key)}" and "${seed.slug}" have the same title`)
    titles.set(key, seed.slug)
  }
  return seeds
}

// ---------------------------------------------------------------------------
// GitHub access: everything goes through the `gh` CLI, so there is no token handling here.
// ---------------------------------------------------------------------------

function gh(args, input) {
  const result = spawnSync('gh', args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 })
  if (result.error) {
    throw new Error(result.error.code === 'ENOENT'
      ? 'The GitHub CLI (gh) was not found on PATH. Install it from https://cli.github.com, then run `gh auth login`.'
      : result.error.message)
  }
  if (result.status !== 0) throw new Error(`gh ${args.join(' ')}\n${(result.stderr || result.stdout).trim()}`)
  return result.stdout
}

/** Calls the REST API; a payload is sent as the JSON request body. Returns parsed JSON or null. */
function api(method, path, payload) {
  const args = ['api', '-X', method, path]
  if (payload !== undefined) args.push('--input', '-')
  const output = gh(args, payload === undefined ? undefined : JSON.stringify(payload))
  return output.trim() ? JSON.parse(output) : null
}

function paginate(path) {
  const items = []
  for (let page = 1; ; page++) {
    const batch = api('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
    items.push(...batch)
    if (batch.length < 100) return items
  }
}

const isNotFound = (error) => /\b404\b|Not Found/i.test(error.message)
const encodeRef = (name) => name.split('/').map(encodeURIComponent).join('/')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------
// Planning: read the current state and work out what has to change. Nothing is modified here.
// ---------------------------------------------------------------------------

const labelNames = (issue) => issue.labels.map((label) => (typeof label === 'string' ? label : label.name))
const normalizeBody = (body) => (body ?? '').replace(/\r\n/g, '\n').trim()
const sameLabels = (a, b) => a.length === b.length && a.every((name) => b.some((other) => other.toLowerCase() === name.toLowerCase()))

/** Finds the issue for a seed: by hidden marker first, then by exact title (preferring open ones). */
function findIssue(seed, issues, claimed) {
  const free = issues.filter((issue) => !claimed.has(issue.number))
  const marked = free.filter((issue) => SEED_MARKER.exec(issue.body ?? '')?.[1] === seed.slug)
  if (marked.length > 1) throw new Error(`Seed "${seed.slug}" matches several issues (${marked.map((issue) => `#${issue.number}`).join(', ')}). Remove the duplicate marker from all but one.`)
  if (marked.length) return marked[0]
  // Title fallback adopts only issues that predate the script, never one that belongs to another seed.
  return free.filter((issue) => issue.title === seed.title && !SEED_MARKER.test(issue.body ?? '')).sort((a, b) => (a.state === 'open' ? 0 : 1) - (b.state === 'open' ? 0 : 1) || a.number - b.number)[0]
}

function describeDrift(seed, issue) {
  const drift = []
  if (issue.state !== 'open') drift.push('reopen')
  if (issue.title !== seed.title) drift.push('title')
  if (normalizeBody(issue.body) !== normalizeBody(seed.body)) {
    // Issues created before the script existed differ from their seed only by the hidden marker.
    drift.push(normalizeBody(issue.body) === normalizeBody(seed.body.replace(SEED_MARKER, '')) ? 'marker' : 'body')
  }
  if (!sameLabels(labelNames(issue), seed.labels)) drift.push('labels')
  if (issue.assignees.length) drift.push('unassign')
  if (issue.comments) drift.push(`${issue.comments} comment${issue.comments > 1 ? 's' : ''}`)
  return drift
}

function planMainReset(repo, branch) {
  let tag
  try {
    tag = api('GET', `repos/${repo}/git/ref/tags/${BASELINE_TAG}`)
  } catch (error) {
    if (!isNotFound(error)) throw error
    throw new Error(`Tag "${BASELINE_TAG}" does not exist in ${repo}. Create it first:\n  git tag ${BASELINE_TAG} <commit> && git push origin ${BASELINE_TAG}`)
  }
  let target = tag.object
  while (target.type === 'tag') target = api('GET', `repos/${repo}/git/tags/${target.sha}`).object
  if (target.type !== 'commit') throw new Error(`Tag "${BASELINE_TAG}" points to a ${target.type}, not a commit.`)
  const baseline = target.sha
  const head = api('GET', `repos/${repo}/git/ref/heads/${branch}`).object.sha
  let compare = null
  try {
    compare = api('GET', `repos/${repo}/compare/${baseline}...${head}`)
  } catch (error) {
    if (!isNotFound(error)) throw error // unrelated histories: reset anyway, just without a commit list
  }
  return { baseline, head, compare }
}

function buildPlan(repo, defaultBranch, seeds) {
  const pulls = paginate(`repos/${repo}/pulls?state=open`)
  const branches = paginate(`repos/${repo}/branches`)
    .filter((branch) => branch.name !== defaultBranch && !branch.name.startsWith(KEEP_BRANCH_PREFIX) && !branch.protected)
    .map((branch) => branch.name)
  const issues = paginate(`repos/${repo}/issues?state=all`).filter((issue) => !issue.pull_request)
  const knownLabels = new Set(paginate(`repos/${repo}/labels`).map((label) => label.name.toLowerCase()))

  const claimed = new Set()
  const backlog = seeds.map((seed) => {
    const issue = findIssue(seed, issues, claimed)
    if (!issue) return { seed, action: 'create', drift: [] }
    claimed.add(issue.number)
    const drift = describeDrift(seed, issue)
    return { seed, issue, action: drift.length ? 'restore' : 'keep', drift }
  })
  const strays = issues.filter((issue) => issue.state === 'open' && !claimed.has(issue.number))
  const missingLabels = [...new Set(seeds.flatMap((seed) => seed.labels))].filter((name) => !knownLabels.has(name.toLowerCase()))
  const mainReset = flags['reset-main'] ? planMainReset(repo, defaultBranch) : null

  return { pulls, branches, backlog, strays, missingLabels, mainReset }
}

function printPlan(repo, defaultBranch, plan) {
  const out = []
  const section = (title, lines) => out.push('', title, ...(lines.length ? lines.map((line) => `  ${line}`) : ['  (nothing)']))
  const short = (sha) => sha.slice(0, 7)

  out.push(`Repository: ${repo} (default branch: ${defaultBranch})`)
  section(`Pull requests to close (${plan.pulls.length})`, plan.pulls.map((pr) => `${`#${pr.number}`.padEnd(5)}  ${pr.title}  [${pr.head.ref}]`))
  section(`Branches to delete (${plan.branches.length})`, plan.branches)
  section(`Backlog (${plan.backlog.length} seeds)`, plan.backlog.map(({ seed, issue, action, drift }) => {
    const detail = action === 'create' ? 'new issue, enriched live as it opens' : action === 'keep' ? 'already pristine' : drift.join(', ')
    return `${action.padEnd(7)}  ${seed.slug.padEnd(36)}  ${(issue ? `#${issue.number}` : '').padEnd(5)}  ${detail}`
  }))
  section(`Other open issues to close as not planned (${plan.strays.length})`, plan.strays.map((issue) => `${`#${issue.number}`.padEnd(5)}  ${issue.title}`))
  if (plan.missingLabels.length) section('Labels to create', plan.missingLabels)

  if (plan.mainReset) {
    const { baseline, head, compare } = plan.mainReset
    const lines = [`${defaultBranch} ${short(head)} -> ${BASELINE_TAG} ${short(baseline)}`]
    if (head === baseline) lines.push('already at the baseline')
    else if (compare) {
      if (compare.ahead_by) lines.push(`discards ${compare.ahead_by} commit${compare.ahead_by > 1 ? 's' : ''}${compare.ahead_by > 15 ? ' (showing the last 15)' : ''}:`, ...compare.commits.slice(-15).map((commit) => `  ${short(commit.sha)}  ${commit.commit.message.split('\n')[0]}`))
      if (compare.behind_by) lines.push(`moves forward ${compare.behind_by} commit${compare.behind_by > 1 ? 's' : ''}`)
    }
    section(`${defaultBranch} will be force-reset (--reset-main)`, lines)
  }
  if (flags.enrich) section('Issue enrichment (--enrich)', [`dispatch ${ENRICH_WORKFLOW} for ${plan.backlog.filter((item) => item.issue).length} existing seeds`])
  console.log(out.join('\n'))
}

// ---------------------------------------------------------------------------
// Applying the plan. Each step reports on its own so one failure doesn't stop the rest.
// ---------------------------------------------------------------------------

async function confirm(question, expected) {
  if (flags.yes) return true
  if (!process.stdin.isTTY) throw new Error('No terminal to confirm on. Re-run with --yes to apply, or --dry-run to preview.')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await rl.question(question)).trim()
    return expected ? answer === expected : /^y(es)?$/i.test(answer)
  } finally {
    rl.close()
  }
}

async function applyPlan(repo, defaultBranch, plan) {
  const failures = []
  const step = async (label, action) => {
    try {
      await action()
      console.log(`  ok      ${label}`)
      return true
    } catch (error) {
      failures.push(label)
      console.log(`  FAILED  ${label}\n          ${error.message.split('\n').join('\n          ')}`)
      return false
    }
  }
  const results = []
  console.log('\nApplying...')

  for (const name of plan.missingLabels) {
    await step(`create label "${name}"`, () => api('POST', `repos/${repo}/labels`, { name, color: 'ededed' }))
  }
  const keepBranches = new Set()
  for (const pr of plan.pulls) {
    const closed = await step(`close PR #${pr.number}`, () => {
      api('POST', `repos/${repo}/issues/${pr.number}/comments`, { body: 'Closed by `npm run demo:reset` so the next demo starts from a clean slate. Nothing was merged.' })
      api('PATCH', `repos/${repo}/pulls/${pr.number}`, { state: 'closed' })
    })
    if (!closed) keepBranches.add(pr.head.ref)
  }
  for (const name of plan.branches) {
    if (keepBranches.has(name)) {
      console.log(`  skipped delete branch ${name} (its pull request is still open)`)
      continue
    }
    await step(`delete branch ${name}`, () => api('DELETE', `repos/${repo}/git/refs/heads/${encodeRef(name)}`))
  }

  for (const { seed, issue, action } of plan.backlog) {
    if (action === 'create') {
      await step(`create ${seed.slug}`, async () => {
        const created = api('POST', `repos/${repo}/issues`, { title: seed.title, body: seed.body, labels: seed.labels })
        results.push({ seed, number: created.number, url: created.html_url, created: true })
        await sleep(1500) // stay well clear of GitHub's content-creation rate limits
      })
      continue
    }
    const entry = { seed, number: issue.number, url: issue.html_url, created: false }
    results.push(entry)
    if (action === 'keep') continue
    entry.restoreFailed = !await step(`restore #${issue.number} ${seed.slug}`, () => {
      // Labels and assignees are replaced wholesale, which is what "restore" means here.
      const payload = { title: seed.title, body: seed.body, labels: seed.labels, assignees: [] }
      if (issue.state !== 'open') Object.assign(payload, { state: 'open', state_reason: 'reopened' })
      api('PATCH', `repos/${repo}/issues/${issue.number}`, payload)
      if (issue.comments) {
        for (const comment of paginate(`repos/${repo}/issues/${issue.number}/comments`)) api('DELETE', `repos/${repo}/issues/comments/${comment.id}`)
      }
    })
  }
  for (const issue of plan.strays) {
    await step(`close #${issue.number} as not planned`, () => {
      api('POST', `repos/${repo}/issues/${issue.number}/comments`, { body: 'Closed by `npm run demo:reset`: this issue is not part of the demo backlog.' })
      api('PATCH', `repos/${repo}/issues/${issue.number}`, { state: 'closed', state_reason: 'not_planned' })
    })
  }

  if (plan.mainReset && plan.mainReset.head !== plan.mainReset.baseline) {
    await step(`reset ${defaultBranch} to ${BASELINE_TAG}`, () => {
      if (failures.length) throw new Error('Skipped because an earlier step failed. Fix it and run again.')
      const current = api('GET', `repos/${repo}/git/ref/heads/${encodeRef(defaultBranch)}`).object.sha
      if (current !== plan.mainReset.head) throw new Error(`${defaultBranch} moved to ${current.slice(0, 7)} after the plan was shown. Review it and run again.`)
      api('PATCH', `repos/${repo}/git/refs/heads/${encodeRef(defaultBranch)}`, { sha: plan.mainReset.baseline, force: true })
    })
  }
  if (flags.enrich) {
    // Dispatched last so the run uses the workflow as it exists on the (possibly just reset) default branch.
    for (const { seed, number, created } of results.filter((result) => !result.created && !result.restoreFailed)) {
      await step(`enrich #${number} ${seed.slug}`, () => gh(['workflow', 'run', ENRICH_WORKFLOW, '-R', repo, '--ref', defaultBranch, '-f', `issue_number=${number}`]))
    }
  }

  console.log('\nBacklog')
  for (const { seed, number, url } of results) console.log(`  #${String(number).padEnd(4)} ${seed.title}\n        ${url}`)
  return failures
}

// ---------------------------------------------------------------------------

async function main() {
  if (flags.help) return console.log(USAGE)

  const seeds = loadSeeds()
  if (flags.validate) return console.log(`${seeds.length} backlog seeds OK`)

  const info = JSON.parse(gh(['repo', 'view', ...(flags.repo ? [flags.repo] : []), '--json', 'nameWithOwner,defaultBranchRef']))
  const repo = info.nameWithOwner
  const defaultBranch = info.defaultBranchRef.name

  const plan = buildPlan(repo, defaultBranch, seeds)
  printPlan(repo, defaultBranch, plan)

  const resetsMain = plan.mainReset && plan.mainReset.head !== plan.mainReset.baseline
  const hasWork = plan.pulls.length || plan.branches.length || plan.strays.length || plan.missingLabels.length || resetsMain
    || plan.backlog.some((item) => item.action !== 'keep') || flags.enrich
  if (!hasWork) return console.log('\nAlready in demo state. Nothing to do.')
  if (flags['dry-run']) return console.log('\nDry run: nothing was changed.')

  console.log()
  const approved = resetsMain
    ? await confirm(`This rewrites ${defaultBranch}. Type the repository name (${repo}) to continue: `, repo)
    : await confirm(`Apply this plan to ${repo}? [y/N] `)
  if (!approved) return console.log('Cancelled. Nothing was changed.')

  const failures = await applyPlan(repo, defaultBranch, plan)
  if (failures.length) {
    console.error(`\n${failures.length} step${failures.length > 1 ? 's' : ''} failed. Fix the cause and re-run: the reset is idempotent.`)
    process.exitCode = 1
  } else {
    console.log('\nDemo state restored.')
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
