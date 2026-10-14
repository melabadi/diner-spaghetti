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
- **Persistence:** changes survive reloads in the same browser and origin.
  **Réinitialiser** restores the sample data after confirmation.

The responsive layout includes labeled form controls, keyboard focus indicators,
a skip link, live status/error messages, and confirmation before deleting
reservations or resetting data.

## Mock backend

[Mock Service Worker](https://mswjs.io/) supplies the request handlers.
Its companion `@mswjs/interceptors` package intercepts browser `fetch` calls
**in-page**, before React renders. The mock remains enabled in both development
and production-preview builds. Responses have approximately 180 ms of simulated
latency. Only this app's `/api/` requests are intercepted; other requests pass
through normally.

No service worker or background server is required. In-page interception was
chosen after browser testing found that API requests from backgrounded pages
could bypass the service-worker mock and reach Vite. The mock now lives
with the page instead of relying on a background worker or keepalive timers.

[Handlers](src/mocks/handlers.ts) call a [local store](src/mocks/store.ts),
which validates inputs and persisted data against [shared Zod schemas](src/domain.ts).
The state is stored under `la-tablee.organizer.v1` in `localStorage`.
Invalid requests return HTTP 400, missing records return 404, capacity/assignment
conflicts return 409, and storage failures return 500 with visible error messages.
Corrupt data is not silently discarded; an explicit reset recovers it.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/organizer` | Read the full organizer state |
| PUT | `/api/event` | Update event settings |
| POST | `/api/reservations` | Create a reservation |
| PATCH / DELETE | `/api/reservations/:id` | Change payment / cancel |
| POST | `/api/volunteers` | Assign a volunteer |
| DELETE | `/api/volunteers/:id` | Remove an assignment |
| POST | `/api/expenses` | Add a shopping/budget item |
| PATCH / DELETE | `/api/expenses/:id` | Mark purchased / delete |
| POST | `/api/reset` | Restore sample data |

Mutating routes return the complete updated state. Money is stored as integer
cents, not floating-point dollar amounts. The API client is isolated in
[src/api.ts](src/api.ts), so a future real backend can replace the mock while
preserving the same HTTP contract and validation.

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

## Tests and checks

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Tests use Vitest, Testing Library, and the same MSW handlers as the browser.
They exercise domain calculations, input validation, capacity boundaries, price
snapshots, persistence and storage errors, HTTP contracts, and user-facing workflows.
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

- **204 tests passed** across five files, including the actual in-page fetch
  transport. Passthrough tests use two temporary loopback HTTP servers, so both
  static requests and requests to another origin are verified without external traffic.
- **Lint, TypeScript checks, and the production build passed.** Browser source and
  Node-enabled tests have separate TypeScript configurations.
- **Production-browser workflows passed:** adding two adult tickets and one child
  ticket charged exactly $46; marking that booking paid, adding a volunteer, and
  adding and purchasing a $12.50 expense all survived a full reload.
- **Background-tab check passed:** the production page returned HTTP 200 JSON
  before and after 45 seconds idle while hidden, with payment and purchase state
  intact and no service worker registered.
- **All four sections fit 320 px and 390 px viewports** without whole-page
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
- Jev, MCP configuration, agent hooks, and AI before/after comparisons are
  intentionally **not included**: that work was deferred in favor of this app.
