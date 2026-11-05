---
title: "[WCAG 4.1.3] Announce reservation search no-results feedback"
labels: ["accessibility","bug"]
---
## Summary
When a reservation search has no matches, the app displays **Aucune réservation ici** and **Essayez un autre nom ou un autre filtre.**, but does not expose this feedback as a status message. Focus remains in the search input, so assistive technology has no live-status notification of the search outcome.

**WCAG 2.2:** [4.1.3 Status Messages, Level AA](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html). Feedback giving the results of an action without a change of context must be programmatically identifiable so assistive technology can present it without moving focus.

## Reproduction
1. Run the app with `npm ci` and `npm run dev`, open the Vite URL with sample data, and select **Réservations**.
2. Focus **Rechercher une réservation** and enter `zzzz-no-matching-reservation`.
3. Observe that the table is replaced by the no-results feedback while focus stays in the searchbox.
4. Inspect the feedback's role, live-region properties, and ancestors in the accessibility tree/DOM.

## Confirmed evidence
Audited revision: `15a21bb2343f46c98813f23610c2dffc2ee931af`, Chromium DOM and accessibility-tree inspection, October 14, 2026.

- The new content is an ordinary `.empty-state` div containing an `h3` and a paragraph.
- Neither the feedback nor any ancestor has `role="status"` or an `aria-live` property.
- There are no live regions in this initial-data search state; the separate mutation success/error messages do not announce search changes.
- `document.activeElement` remains the search input.

The text is available for manual browsing, but its appearance is not programmatically exposed as an announcable status update. This finding is based on DOM/accessibility-tree evidence, not a claim of testing a particular screen reader.

## Relevant source
- [Search input and conditional results](https://github.com/melabadi/diner-spaghetti/blob/15a21bb2343f46c98813f23610c2dffc2ee931af/src/components/Reservations.tsx#L42-L49)
- [No-results message](https://github.com/melabadi/diner-spaghetti/blob/15a21bb2343f46c98813f23610c2dffc2ee931af/src/components/Reservations.tsx#L77)
- [Shared EmptyState markup](https://github.com/melabadi/diner-spaghetti/blob/15a21bb2343f46c98813f23610c2dffc2ee931af/src/components/ui.tsx#L47-L55)

## Acceptance criteria
- [ ] A dynamically produced no-results message is exposed through a suitable polite status/live-region mechanism, without moving focus away from the search or filter control.
- [ ] Verify that the message is announced when a search or payment filter produces an empty result set.
- [ ] Keep announcements concise and scoped to search feedback; do not mark the entire reservation table as live or announce every row on each keystroke.
- [ ] Add a regression check for the status semantics and verify announcement behavior with a screen reader.
