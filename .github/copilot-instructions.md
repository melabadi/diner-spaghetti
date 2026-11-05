# Copilot instructions

La Tablée is a client-only React 19 + TypeScript + Vite organizer for a Canadian-French
spaghetti-dinner fundraiser. There is no backend: data lives in `localStorage`
(`la-tablee.organizer.v1`). Read `README.md` for the product and `DEMO.md` for the demo flow.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install dependencies |
| `npm run dev` | Dev server |
| `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | All four must pass before a pull request is ready |
| `npm run verify` | Runs those four checks in order |

## Where things live

| Path | Role |
| --- | --- |
| `src/domain.ts` | Zod schemas (`.strict()`), inferred types, `summarize`, money and date helpers |
| `src/mocks/store.ts` | `OrganizerStore`: business rules and persistence; throws `ApiError(status, code, message)` |
| `src/mocks/seed.ts` | Sample data for first load and Reset |
| `src/api.ts` | Request layer used by the UI; calls the store directly with simulated latency |
| `src/useOrganizer.ts` | State hook; allows one mutation at a time (an overlapping action is rejected with an error message) and exposes notices and errors |
| `src/components/*.tsx` | UI sections: dashboard, reservations, volunteers, budget, event settings |
| `demo/` | Demo backlog seeds (`demo/backlog/*.md`) and the reset command (`demo/reset.mjs`); not part of the app |

Tests sit next to the code they cover (`foo.ts` → `foo.test.ts`) and use Vitest with
Testing Library. `src/test/setup.ts` resets the store before every test.

## Contracts to preserve

- Money is integer cents (`formatMoney`, `toCents`). Existing reservations keep the price
  they were sold at when event prices change (`totalCents` is a snapshot).
- Capacity, dietary counts, and volunteer assignments are validated. Dietary counts may
  overlap, and one volunteer may work several shifts.
- Shared Zod schemas validate requests and persisted data. Change `domain.ts` first, then
  the store, then the UI. Changing the persisted shape needs a deliberate schema-version
  decision; call it out in the pull request.
- Every mutation returns the complete updated organizer state.
- Corrupt storage and storage failures stay visible (`storage_corrupt`,
  `storage_write_failed`); they are never silently reset.
- UI text, dates, and currency are Canadian French (`fr-CA`, CAD). Code, comments, and
  commit messages are English.
- Accessibility is a feature (WCAG 2.2 AA): keyboard access, labelled controls, visible
  focus, status and errors announced to assistive technology, confirmation for destructive
  actions, and usable on a 320 px-wide screen.
- Deliberately out of scope: a backend, authentication, real payments, multi-user storage.

## Working an issue

1. If the issue body has an **Implementation brief** (written by the `issue-enrichment`
   workflow), treat it as a starting plan. Verify it against the code and keep its
   acceptance criteria and test plan; correct it when the code disagrees.
2. Add or update tests for every behavior change, including the failure paths.
3. Keep pull requests small and focused, follow `.github/pull_request_template.md`, and
   reference the issue with `Closes #N`. Work the brief marks as a stack ships as one pull
   request per layer.
4. Do not add dependencies without a reason in the pull request description.
5. Never edit `.github/workflows/*.lock.yml` by hand. Edit the matching `.md` workflow and
   recompile it as described in `README.md`.
