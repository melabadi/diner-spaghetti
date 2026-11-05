# Demo backlog

Each Markdown file here is one issue that `npm run demo:reset` keeps on the repository's issue tracker. The files hold **only human-written text**: the implementation briefs you see on the issues are produced live by the [`issue-enrichment`](../../.github/workflows/issue-enrichment.md) workflow and are never stored in the repo.

## File format

```markdown
---
title: "Let organizers edit an existing reservation"
labels: ["enhancement"]
---
Issue body in Markdown, exactly as it should appear on GitHub.
```

- Front matter is `---`-delimited, one `key: <JSON value>` per line. Supported keys: `title` (required) and `labels` (optional; labels that don't exist yet are created).
- The file name (without `.md`) is the seed's id. Files are processed in name order, so a numeric prefix keeps issue numbers ascending on a fresh repository.
- The script appends a hidden `<!-- demo-seed: <id> -->` marker to the body so it can find the issue again, even if its title changes. Don't remove it from the issue.

## The seeds

| File | Shows | Labels |
| --- | --- | --- |
| `01`–`06` `wcag-*` | Six detailed, evidence-backed accessibility bugs: well-specified work an agent can pick up straight away | `bug`, `accessibility` |
| `07-edit-reservation` | A small feature whose brief should surface a pricing contract in the code | `enhancement` |
| `08-export-guest-list-csv` | A starter task with a few gotchas (Excel and accented names) | `enhancement`, `good first issue` |
| `09-duplicate-email-warning` | A thin request with a product decision hidden inside (warn vs. block) | `enhancement` |
| `10-overlapping-volunteer-shifts` | A request that looks small but needs a data-model change | `enhancement` |
| `11-event-day-operations` | An epic that should be delivered as a stack of pull requests | `enhancement` |
| `12-volunteers-page-feels-confusing` | A deliberately vague report: the brief should ask questions instead of guessing | `question` |

## Adding or changing a seed

1. Add or edit a file here.
2. `node demo/reset.mjs --validate` checks the files offline (CI runs it on every pull request).
3. `npm run demo:reset -- --dry-run` previews what would change on GitHub, and `npm run demo:reset` applies it.

See [`DEMO.md`](../../DEMO.md) for the full reset flow and the demo script.
