# La tablée — Dîner spaghetti

A small, fully working spaghetti-dinner organizer built with **React, TypeScript,
and Vite**. The interface is in Canadian French, and amounts are in Canadian
dollars. No API key, account, or backend server is required.

## Run it

Use Node.js **22.12+ or 24+**.

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite, normally <http://localhost:5173>.
VS Code also includes a **La tablée: dev** task.

To try the production build locally:

```powershell
npm run build
npm run preview
```

Serve the app with Vite or the preview server. Opening the source HTML file
directly will not run the TypeScript application. Use localhost or HTTPS so
browser-generated reservation IDs are available.

## What works

- **Overview:** reserved seats, collected and pending payments, planned spending,
  volunteer coverage, dietary counts, and a clearly labeled projected net fundraiser.
- **Reservations:** add contacts and adult/child tickets, capture vegetarian and
  gluten-free requirements, search with or without accents, filter by payment,
  mark payments received, and cancel a reservation after confirmation.
- **Volunteers:** assign or remove people from four shifts. Full shifts and duplicate
  assignments are rejected.
- **Shopping and budget:** add expenses with quantities and total estimated costs,
  mark purchases completed, and distinguish projected profit from cash on hand.
- **Event settings:** edit the date, location, capacity, prices, spending limit, and
  fundraising goal. Existing reservations keep their original sale prices.
- **Event day (Jour J):** search and filter arrival status, record partial adult/child
  arrivals, welcome a whole group, correct arrivals after confirmation, and record
  outstanding payments separately.
- **Table planning:** add, rename, resize, and remove empty tables; assign or move
  whole reservations with live capacity checks. Overfilled tables and duplicate
  names are rejected.
- **Printable service reports:** preview a complete door list or a per-table kitchen
  sheet and print only the selected report. Reception filters do not hide guests;
  kitchen totals include unassigned groups and keep planned diets separate from arrivals.
- **Persistence:** changes survive reloads in the same browser and origin.
  **Réinitialiser** restores the sample data after confirmation.

The responsive layout includes labeled form controls, keyboard focus indicators,
a skip link, live status/error messages, and confirmation before deleting
reservations or resetting data.

## Mock backend

The [local API adapter](src/api.ts) calls a [local store](src/mocks/store.ts)
directly in both development and production-preview builds, with approximately
180 ms of simulated latency. It uses HTTP-shaped methods, paths, and JSON bodies
inside the app, but makes no network requests and does not intercept `fetch`.
No MSW dependency, service worker, or background backend server is required.

The store validates inputs and persisted data against
[shared Zod schemas](src/domain.ts).
The state is stored under `la-tablee.organizer.v1` in `localStorage`.
Existing datasets remain readable: absent arrival counts become zero, absent
table assignments become `null`, and an absent table plan becomes an empty list.
The next successful mutation persists those additive fields without resetting
bookings, payments, or price snapshots.
Validation, missing-record, capacity/assignment, and storage errors produce visible
messages. Store errors retain their status and code in the thrown error's cause.
Corrupt data is not silently discarded; an explicit reset recovers it.

| Method | Local request path | Purpose |
| --- | --- | --- |
| GET | `/organizer` | Read the full organizer state |
| PUT | `/event` | Update event settings |
| POST | `/reservations` | Create a reservation |
| PATCH / DELETE | `/reservations/:id` | Change payment / cancel |
| PUT | `/reservations/:id/arrival` | Set absolute adult/child arrival counts |
| PATCH | `/reservations/:id/table` | Assign the whole party or clear its table |
| POST | `/tables` | Create a table |
| PUT / DELETE | `/tables/:id` | Rename/resize a table or remove an empty table |
| POST | `/volunteers` | Assign a volunteer |
| DELETE | `/volunteers/:id` | Remove an assignment |
| POST | `/expenses` | Add a shopping/budget item |
| PATCH / DELETE | `/expenses/:id` | Mark purchased / delete |
| POST | `/reset` | Restore sample data |

Mutating routes return the complete updated state. Money is stored as integer
cents, not floating-point dollar amounts. The API client is isolated in
[src/api.ts](src/api.ts), so a future real backend can replace the mock while
preserving the same method, path, body, and validation contracts.

Arrival bodies contain `arrivedAdults` and `arrivedChildren`; repeating the same
counts never adds guests twice. Arrivals may be partial and never mark a payment
received. Decreasing either count, including when the other increases, requires
confirmation; cancelling leaves the saved counts unchanged.
Seating bodies contain `tableId` (or `null` to unassign). Tables reserve
space for the **entire booking**, not just its arrivals. An occupied table cannot
be deleted or resized below its assigned guests, and total table capacity cannot
exceed the venue capacity. These constraints also validate persisted data.

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
| Arrived guests / reserved guests | 0 / 99 |
| Tables / configured table seats | 4 / 72 |

## A quick demo

1. Open the overview to see the event, budget, and remaining tasks.
2. In **Réservations**, add a fictional contact with two adult tickets and one child
   ticket. The total is $46 at the sample prices; seat and revenue totals update.
3. Mark that reservation paid, then search `emile` to find **Émile Côté**.
4. In **Bénévoles**, add someone to the kitchen shift and watch its coverage update.
5. In **Courses & budget**, add an expense and mark it purchased. Compare projected
   net proceeds with cash on hand.
6. Change a ticket price in **Paramètres**. Existing bookings do not change.
7. Reload to demonstrate persistence. Use **Réinitialiser** to start again.

### Event-day walkthrough

Start with **Réinitialiser** after confirmation to load the four sample tables.
To keep an older dataset instead, add tables manually; no bookings are reset
automatically.

1. Open **Jour J** directly or use **Préparer l’accueil et les tables** on the overview.
2. Assign **Camille Roy** to **Table 1**. All eight reserved seats are held, even
   though nobody has arrived. A second group cannot overfill that table.
3. Open Camille's arrival card and enter two adults and one child. The counter
   becomes **3 / 99**; completing the group makes it **8 / 99**.
4. Search `emile` or filter **Partiels** to demonstrate the reception desk.
5. Welcome **Leïla Benali**. Her payment stays pending until you explicitly use
   **Marquer comme payé**.
6. Rename or enlarge a table, then move a group. An occupied table cannot be
   deleted; move its reservations first.
7. Reload to retain arrivals and seating. Existing datasets start with no arrivals
   and no table plan rather than losing their old reservations.
8. In **Fiches pour l’équipe**, switch between **Fiche d’accueil** and **Fiche cuisine**.
   Search at the reception desk to show that neither report drops hidden contacts.
   **Imprimer la fiche** prints only the chosen sheet, not the surrounding controls.

## Copilot demo: one source PR, then a stack

The event-day expansion is deliberately one substantial source PR, organized into
three ordered feature commits. It can be split during a live demo without making
artificial or unrelated changes:

| Layer | Reviewable scope | Dependency |
| --- | --- | --- |
| 1. Event-day contracts | Schemas, backwards-compatible persistence, table/arrival API, and backend tests | Existing organizer |
| 2. Reception and seating | Jour J page, partial arrivals, separate payments, table forms, dashboard entry, and interface tests | Layer 1 |
| 3. Service reports | Door/kitchen projections, selected-sheet printing, report tests, and demo documentation | Layers 1 and 2 |

Open each replacement PR sequentially, bottom to top, with each higher PR based
on the branch below it. Keep the original source PR until the complete replacement
chain is verified. The existing agentic-review setup is a prerequisite, not a fourth
feature slice; if its PR is still open, use its branch as the bottom feature PR's
base. Once the setup is on `main`, use `main` instead.

The existing **Agentic code review** workflow runs on opening or updating the
source PR and each stack layer. Configure its credential as described below before
the demo; missing credentials are an activation failure, not an app defect.
Keep its review advisory and let real findings drive the demonstration rather
than inserting intentional bugs.

For **Agent merge**, enable review fixes, CI repairs, and conflict resolution in
the feature PR's app session when ready to demonstrate them. Leave automatic merging
off while preparing or splitting the source PR. Agent merge does not provision
the reviewer's credential.

The [existing mobile-navbar focus issue](https://github.com/melabadi/diner-spaghetti/issues/6)
is intentionally not fixed by this expansion. It remains a separate task for
triggering a coding agent without mixing navigation remediation into the feature stack.

## Tests and checks

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Tests use Vitest, Testing Library, and the same local API and store as the browser.
They exercise domain calculations, input validation, capacity boundaries, price
snapshots, persistence and storage errors, local request contracts, arrival corrections,
whole-party seating, complete report projections, and user-facing workflows.
The [CI workflow](.github/workflows/ci.yml) runs tests, lint, and a production build
on pushes to `main` and pull requests.

### Agentic PR review

[GitHub Agentic Workflows](https://github.github.com/gh-aw/) runs a **GPT-5.6 Sol**
Copilot reviewer on every trusted same-repository PR opening, reopening, new
commit, edit, and ready-for-review transition. Drafts and every layer of a PR
stack are included. Fork PRs and actors without repository admin, maintain, or
write access are excluded; bots are not separately allowlisted. Direct pushes
do not trigger AI review.

The reviewer reads the complete current PR diff and related code, makes four
passes over contracts, correctness, security/reliability, and evidence, and
checks relevant tests or matching CI results when useful. It posts up to ten
high-confidence inline findings and one advisory `COMMENT` review. Existing
findings are not reposted. New updates cancel older runs, and the reviewer checks
the head SHA again before publishing. Incomplete coverage and unavailable checks
must be disclosed rather than presented as a clean review.

The agent has read-only GitHub access, restricted shell commands, and a network
allowlist. Separate safe-output jobs publish feedback; it cannot approve, request
changes, edit branches, or merge. Failures remain visible in Actions rather than
opening unsolicited tracking issues. Repository-provided custom instructions are
disabled, and automatic model fallback/token steering are disabled so the
configured model is not silently replaced. AI review supplements human review
and the deterministic app checks; it is not a correctness or security guarantee.

**Activation:** in this personal repository, add an Actions repository secret
named `COPILOT_GITHUB_TOKEN` containing a fine-grained PAT owned by an account
with an active Copilot license and access to `gpt-5.6-sol`. Grant only the account
permission **Copilot Requests: Read**; it does not need repository write access.
Create and store the token in GitHub's settings, never in source or PR comments.
The built-in `GITHUB_TOKEN` handles repository reads and safe-output reviews.
Repository/organization policies must permit Actions to submit PR review comments.
Merge the workflow files into the base branch to activate subsequent PR events.
Runs consume the token owner's Copilot allowance/credits and have a 30-minute
agent execution timeout. Missing credentials or unavailable models fail explicitly.

**Maintenance:** edit [.github/workflows/code-review.md](.github/workflows/code-review.md),
not its generated `.lock.yml`. Use `gh-aw` **v0.88.7**, matching the pinned CI
installer, then regenerate and commit the source, lock file, and
`.github/aw/actions-lock.json` action-pin cache together:

```powershell
gh aw compile code-review --strict --no-check-update
```

The CI `Agentic workflow source` job recompiles and rejects missing or stale
generated files.
When upgrading `gh-aw`, update the CI installer version and immutable action SHA,
recompile the workflow, and review the generated changes together.

### Verification findings

- **294 tests passed** across six files, including the actual in-page fetch
  transport. Passthrough tests use two temporary loopback HTTP servers, so both
  static requests and requests to another origin are verified without external traffic.
- **Lint, TypeScript checks, and the production build passed.** Browser source and
  Node-enabled tests have separate TypeScript configurations.
- **Production-browser workflows passed:** adding two adult tickets and one child
  ticket charged exactly $46; marking that booking paid, adding a volunteer, and
  adding and purchasing a $12.50 expense all survived a full reload.
- **Event-day production-browser checks passed:** two adults and one child arrived
  in Camille's group, its eight seats stayed assigned to Table 1, and both updates
  survived a full reload without changing the original payment or price snapshot.
  The new page fit 320 px and 390 px viewports with scrolling contained inside tables.
- **Report print-media checks passed:** the door sheet kept all eight bookings
  while the reception filter showed only one. Both selected sheets hid navigation,
  forms, and controls and fit an A4-width viewport without horizontal overflow.
  Kitchen totals included unassigned guests and kept planned diets independent of arrivals.
- **Background-tab check passed:** the production page returned HTTP 200 JSON
  before and after 45 seconds idle while hidden, with payment and purchase state
  intact and no service worker registered.
- **The original four sections fit 320 px and 390 px viewports** without whole-page
  horizontal overflow. The reservation table scrolls inside its own container.
  Browser testing caught and fixed an overflow caused by an absolutely positioned
  screen-reader-only table header. Stress checks also passed with 2,000 reserved
  seats, maximum-length labels, and maximum allowed ticket prices.

These are functional app checks, not an AI decision-quality benchmark.

## Deliberate limitations

- This is a **local demo**, not a production multi-user system. Data is per browser
  and origin; different ports have separate datasets. There is no authentication,
  shared database, cross-tab concurrency guarantee, real payment processing, or email delivery.
- A volunteer can take multiple shifts; overlapping schedules are not automatically
  prevented. Names are the mock identity, not verified accounts.
- Quantities and costs are entered manually. Adding guests does not automatically
  recalculate a shopping list.
- Dietary counts may overlap. They are planning notes, not assurances about
  allergen handling; confirm requirements and precautions with guests.
- A reservation is assigned to one table as a whole group. There is no split-party
  seating, automatic placement, seat map, individual ticket scan, or check-in identity
  verification.
- Jev, MCP configuration, agent hooks, and AI before/after comparisons are
  intentionally **not included**: that work was deferred in favor of this app.
