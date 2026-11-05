---
title: "[WCAG 2.5.3] Include visible payment labels in accessible button names"
labels: ["accessibility","bug"]
---
## Summary
Reservation payment buttons display a payment status, but their `aria-label` replaces that text with the opposite action and omits the visible wording. Voice-input users cannot reliably activate the buttons by saying the labels they see, and sighted screen-reader users encounter inconsistent labels.

**WCAG 2.2:** [2.5.3 Label in Name, Level A](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html). A control's accessible name must contain its visible text label.

## Reproduction
1. Run the app with `npm ci` and `npm run dev`, open the Vite URL with sample data, and select **Réservations**.
2. Compare the visible text and accessible name of a paid reservation's payment button, such as **Camille Roy**.
3. Repeat with a pending reservation, such as **Leïla Benali**.

## Confirmed evidence
Audited revision: `15a21bb2343f46c98813f23610c2dffc2ee931af`, Chromium accessibility-tree inspection and Lighthouse snapshot, October 14, 2026.

| Reservation state | Visible button label | Accessible name |
| --- | --- | --- |
| Paid: Camille Roy | `Payé` | `Marquer la réservation de Camille Roy en attente` |
| Pending: Leïla Benali | `À encaisser` | `Marquer la réservation de Leïla Benali comme payée` |

Neither accessible name contains its button's visible label. Lighthouse reports `label-content-name-mismatch` for **all eight sample reservation payment buttons**.

## Relevant source
[Payment button text and aria-label](https://github.com/melabadi/diner-spaghetti/blob/15a21bb2343f46c98813f23610c2dffc2ee931af/src/components/Reservations.tsx#L61-L66).

## Acceptance criteria
- [ ] The accessible name contains the complete visible label in both the paid and pending states, including after toggling payment status.
- [ ] Preserve the reservation contact and the intended payment action in the accessible context; do not make all repeated row buttons indistinguishable.
- [ ] Add coverage for the relationship between visible text and accessible name in both states, rather than checking only that an `aria-label` exists. Confirm that the Lighthouse name-mismatch failures are resolved.
