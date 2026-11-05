# La tablée — Dîner spaghetti

A small, fully working spaghetti-dinner organizer built with **React, TypeScript, and Vite**. It is
also a ready-to-run demo repository for agent-assisted delivery with the **GitHub Copilot app**: a
backlog of realistic issues, agentic workflows that prepare issues and review pull requests, and a
one-command reset. The interface is in Canadian French and amounts are in Canadian dollars. No API
key, account, or backend server is needed to run the app.

## Start a demo

```powershell
npm ci
npm run demo:reset -- --dry-run   # preview: changes nothing
npm run demo:reset                # restore the backlog and clean up the last demo
```

Then follow **[DEMO.md](DEMO.md)**: prerequisites, the demo step by step with what to point out in
each, troubleshooting, and how to reset between runs.

## How the pieces fit

| Piece | What it does | Where |
| --- | --- | --- |
| Demo backlog | 12 realistic issues: 6 accessibility bugs, 5 features, 1 vague question | `demo/backlog/` |
| Reset | Restores the backlog and removes leftovers from the previous demo | `demo/reset.mjs`, `npm run demo:reset` |
| Issue enrichment | Agentic workflow that appends an implementation brief and labels to new issues | `.github/workflows/issue-enrichment.md` |
| Code review | Agentic workflow that reviews every pull request | `.github/workflows/code-review.md` |
| Copilot instructions | Conventions that agent sessions and the issue-enrichment workflow read | `.github/copilot-instructions.md` |
| App configuration | Setup, Run, and Verify scripts for each GitHub Copilot app session | `.github/github-app.yml` |
| Pull request template | The structure agent-opened pull requests follow | `.github/pull_request_template.md` |
| CI | Lint, tests, build, backlog validation, and a check that compiled workflows are current | `.github/workflows/ci.yml` |

## Run the app

Use Node.js **22.12+ or 24+**.

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite, normally <http://localhost:5173>. VS Code also includes a
**La tablée: dev** task, and the GitHub Copilot app starts the same server from its **Run** script.

To try the production build locally:

```powershell
npm run build
npm run preview
```

Serve the app with Vite or the preview server. Opening the source HTML file directly will not run
the TypeScript application. Use localhost or HTTPS so browser-generated reservation IDs are
available.

## What works

- **Overview:** reserved seats, collected and pending payments, planned spending,
  volunteer coverage, dietary counts, and a clearly labeled projected net fundraiser.
- **Reservations:** add contacts and adult/child tickets, capture vegetarian and
  gluten-free requirements, search with or without accents, filter by payment,
  mark payments received, and cancel a reservation after confirmation.
- **Volunteers:** assign people to four shifts (the chosen shift stays selected for the
  next person) and remove them after confirmation. Full shifts and duplicate assignments
  are rejected.
- **Shopping and budget:** add expenses with quantities and total estimated costs,
  mark purchases completed, and distinguish projected profit from cash on hand.
- **Event settings:** edit the date, location, capacity, prices, spending limit, and
  fundraising goal. Existing reservations keep their original sale prices.
- **Persistence:** changes survive reloads in the same browser and origin.
  **Réinitialiser** restores the sample data after confirmation.

The responsive layout includes labeled form controls, keyboard focus indicators,
a skip link, live status/error messages, and confirmation before deleting
reservations or resetting data.

## Architecture

The app is client-only: there is no server and no network request.

```text
src/components/, src/useOrganizer.ts   screens and the hook that loads and updates state
  -> src/api.ts                        route-style request layer, about 180 ms of simulated latency
    -> src/mocks/store.ts              business rules, validation, persistence
      -> window.localStorage           key la-tablee.organizer.v1

src/domain.ts                          Zod schemas, types, and calculations shared by all of the above
```

[`src/api.ts`](src/api.ts) maps a method and path to a store operation. The
[store](src/mocks/store.ts) validates input and persisted data against the
[shared Zod schemas](src/domain.ts), then saves the result. Rejected requests surface as errors with
a French message: invalid input, missing records, capacity and assignment conflicts, and storage
failures are all shown to the user. Corrupt data is never silently discarded; an explicit reset
recovers it.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/organizer` | Read the full organizer state |
| PUT | `/event` | Update event settings |
| POST | `/reservations` | Create a reservation |
| PATCH / DELETE | `/reservations/:id` | Change payment / cancel |
| POST | `/volunteers` | Assign a volunteer |
| DELETE | `/volunteers/:id` | Remove an assignment |
| POST | `/expenses` | Add a shopping/budget item |
| PATCH / DELETE | `/expenses/:id` | Mark purchased / delete |
| POST | `/reset` | Restore sample data |

Mutating routes return the complete updated state. Money is stored as integer cents, not
floating-point dollar amounts. The request layer is isolated in `src/api.ts`, so a real backend
could replace the local store while keeping the same contract and validation.

### Sample data

All names and `example.test` email addresses are fictional.

| Metric | Initial value |
| --- | ---: |
| Reserved seats / capacity | 99 / 180 |
| Reserved ticket revenue | $1,598.00 |
| Payments received | $984.00 |
| Payments pending | $614.00 |
| Planned expenses | $620.00 |
| Projected net proceeds | $978.00 |
| Volunteer assignments / required | 8 / 16 |

## A quick tour of the app

1. Open the overview to see the event, budget, and remaining tasks.
2. In **Réservations**, add a fictional contact with two adult tickets and one child
   ticket. The total is $46 at the sample prices; seat and revenue totals update.
3. Mark that reservation paid, then search `emile` to find **Émile Côté**.
4. In **Bénévoles**, add someone to the kitchen shift and watch its coverage update.
5. In **Courses & budget**, add an expense and mark it purchased. Compare projected
   net proceeds with cash on hand.
6. Change a ticket price in **Paramètres**. Existing bookings do not change.
7. Reload to demonstrate persistence. Use **Réinitialiser** to start again.

## Tests and checks

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run verify   # all four, in order
```

Tests use Vitest and Testing Library in jsdom. `src/test/setup.ts` resets the store before every
test, so they run against the same request layer and store as the browser. They exercise domain
calculations, input validation, capacity boundaries, price snapshots, persistence and storage
errors, the request contract, and user-facing workflows. The [CI workflow](.github/workflows/ci.yml)
runs lint, tests, a production build, and backlog validation on pushes to `main`, pull requests,
and weekdays at 06:00 UTC. A second job rejects stale compiled workflows.

## Agentic workflows

Two [GitHub Agentic Workflows](https://github.github.com/gh-aw/) run on GitHub Actions with the
Copilot engine and the **GPT-5.6 Sol** model. Each is written in Markdown and compiled to a
`.lock.yml` file. Each runs with read-only GitHub access and a network allowlist, and publishes only
through declared safe outputs. The engine's automatic loading of repository instructions is
disabled, so each prompt names the context it uses: the issue-enrichment prompt reads
[`.github/copilot-instructions.md`](.github/copilot-instructions.md), and the review prompt carries
its own copy of the contracts. AI output supplements human review and the deterministic app checks;
it is not a correctness or security guarantee.

### Set up once

1. Add an Actions repository secret named `COPILOT_GITHUB_TOKEN` containing a fine-grained PAT owned
   by an account with an active Copilot license and access to `gpt-5.6-sol`. Grant only the account
   permission **Copilot Requests: Read**; it does not need repository write access. Create and store
   the token in GitHub's settings, never in source or pull request comments.
2. Allow Actions to submit pull request review comments (repository and organization policies).
3. Merge the workflow files into the default branch. Issue events only run workflows from there.

Runs consume the token owner's Copilot allowance and have a 30-minute (review) or 15-minute
(enrichment) agent timeout. Missing credentials or unavailable models fail explicitly and appear in
Actions rather than opening unsolicited tracking issues.

### Issue enrichment

When someone with admin, maintain, or write access opens an issue, the workflow adds a 👀 reaction,
reads the issue and the relevant code, and updates the issue body with a **🧭 Implementation brief**:
type, size, and readiness; where the change lands; a proposed approach; acceptance criteria; a test
plan; risks and contracts to preserve; a suggested stack for large work; open questions; and related
issues. It also adds up to three labels from an allow-list. Anything it cannot verify is marked as an
assumption or an open question.

Run it again on any issue; it replaces the brief instead of adding a second one:

```powershell
gh workflow run issue-enrichment.lock.yml -f issue_number=<number>
```

The agent can change only the triggering issue (one body update and the labels). It treats issue
text and repository files as untrusted evidence, and it cannot create comments, branches, or pull
requests.

### Agentic pull request review

The reviewer runs on every trusted same-repository pull request opening, reopening, new commit,
edit, and ready-for-review transition. Drafts and every layer of a pull request stack are included.
Fork pull requests and actors without repository admin, maintain, or write access are excluded; bots
are not separately allowlisted. Direct pushes do not trigger AI review.

It reads the complete current diff and related code, makes four passes over contracts, correctness,
security/reliability, and evidence, and checks relevant tests or matching CI results when useful.
It posts up to ten high-confidence inline findings and one advisory `COMMENT` review. Existing
findings are not reposted. New updates cancel older runs, and the reviewer checks the head SHA again
before publishing. Incomplete coverage and unavailable checks must be disclosed rather than
presented as a clean review. It cannot approve, request changes, edit branches, or merge. Automatic
model fallback and token steering are disabled so the configured model is not silently replaced.

### Maintenance

Edit the `.md` source, never the generated `.lock.yml`. Compile with `gh-aw` **v0.88.7**, the version
the CI installer pins:

```powershell
gh extension install github/gh-aw --pin v0.88.7   # once; run `gh extension remove aw` first if another version is installed
gh aw compile --strict --no-check-update          # compiles every workflow in .github/workflows
```

Commit the source, the lock file, and the `.github/aw/actions-lock.json` action-pin cache together.
Any edit to a workflow's `.md` file, including prose below the front matter, needs a recompile,
because the lock file records hashes of both. The CI `Agentic workflow source` job rejects missing or
stale generated files. When upgrading `gh-aw`, update the CI installer version and its immutable
action SHA, recompile, and review the generated changes together.

## Deliberate limitations

- This is a **local demo**, not a production multi-user system. Data is per browser
  and origin; different ports have separate datasets. There is no authentication,
  shared database, cross-tab concurrency guarantee, real payment processing, or email delivery.
- A volunteer can take multiple shifts; overlapping schedules are not automatically
  prevented. Names are the demo identity, not verified accounts.
- Quantities and costs are entered manually. Adding guests does not automatically
  recalculate a shopping list.
- Dietary counts may overlap. They are planning notes, not assurances about
  allergen handling; confirm requirements and precautions with guests.
