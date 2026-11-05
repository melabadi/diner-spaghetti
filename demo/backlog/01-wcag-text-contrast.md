---
title: "[WCAG 1.4.3] Increase text contrast across the organizer"
labels: ["accessibility","bug"]
---
## Summary
Text in the overview, reservations, volunteers, and shopping/budget views falls below the required contrast against its actual background. This affects low-vision users reading table headings, contact details, dietary information, instructions, and summaries.

**WCAG 2.2:** [1.4.3 Contrast (Minimum), Level AA](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

## Reproduction
1. Run the app with `npm ci` and `npm run dev`, then open the Vite URL with the sample data.
2. Visit each of the four organizer sections, including the reservation table and purchased shopping items.
3. Inspect the following foreground/background pairs with a contrast checker. Lighthouse accessibility snapshots also report these as `color-contrast` failures.

## Confirmed evidence
Audited revision: `15a21bb2343f46c98813f23610c2dffc2ee931af`, in Chromium on October 14, 2026.

| Content / selector | Foreground | Background | Contrast |
| --- | --- | --- | --- |
| Footer, `.page-footer` | `#7e8675` | `#f8f7f3` | 3.52:1 |
| Unselected payment filters | `#7d8475` | `#f4f5ee` | 3.52:1 |
| Reservation table headings, `thead th` | `#7c8574` | `#fafbf6` | 3.69:1 |
| Contact email and ticket breakdown, `.cell-secondary` | `#7d8575` | `#ffffff` | 3.82:1 |
| Dietary labels, `.diet-tags > span:not(.muted)` | `#748665` | `#ffffff` | 3.93:1 |
| Statistic details, `.stat-detail` | `#77806f` | `#ffffff` | 4.11:1 |
| Purchased shopping-item names | `#818977` | `#ffffff` | 3.63:1 |
| Volunteer form instructions, `.form-info` | `#7a816f` | `#f7f7f0` | 3.75:1 |
| Muted header text | `#6e756d` | `#f8f7f3` | 4.42:1 |

These are normal-sized text, so the applicable minimum is **4.5:1**, not the 3:1 large-text threshold. Purchased shopping items are still enabled and interactive; the inactive-control exception does not apply to their labels. The table lists representative failures, not every affected node.

## Relevant source
- [Shared and section-specific text colors in App.css](https://github.com/melabadi/diner-spaghetti/blob/15a21bb2343f46c98813f23610c2dffc2ee931af/src/App.css#L20-L200)
- [Shared palette in index.css](https://github.com/melabadi/diner-spaghetti/blob/15a21bb2343f46c98813f23610c2dffc2ee931af/src/index.css#L1-L18)

## Acceptance criteria
- [ ] All affected normal-sized text meets at least 4.5:1 against its rendered background, including tinted panels and selected/unselected or purchased states.
- [ ] Recheck all four sections and the event-settings panel at desktop and narrow viewports; fix the remaining instances of the same contrast defect, not only the representative selectors above.
- [ ] Preserve readable status labels and existing visual distinctions without relying on color alone.
