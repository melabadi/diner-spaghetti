---
title: "[WCAG 2.4.11] Prevent mobile sticky navigation from hiding focused inputs"
labels: ["accessibility","bug"]
---
## Summary
At a narrow viewport, the sticky sidebar becomes a header that can entirely cover a form control receiving keyboard focus. Reverse-tabbing through the reservation form leaves **Nom du contact** focused behind the navigation, so keyboard users cannot see where they are typing.

**WCAG 2.2:** [2.4.11 Focus Not Obscured (Minimum), Level AA](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). A component receiving keyboard focus must not be entirely hidden by author-created content.

## Reproduction
1. Run the app with `npm ci` and `npm run dev`, open the Vite URL, and use the unchanged sample data.
2. Set the CSS viewport to **390 × 844** and open **Réservations**. Leave event settings closed.
3. Scroll to the bottom of the page and focus **Un petit mot (facultatif)**, the reservation note textarea.
4. Press **Shift+Tab seven times**: payment status, gluten-free count, vegetarian count, children, adults, email, then contact name.
5. Observe that **Nom du contact** receives keyboard focus but is completely hidden underneath the sticky navigation.

## Confirmed evidence
Audited revision: `15a21bb2343f46c98813f23610c2dffc2ee931af`, Chromium with a 390 × 844 viewport, October 14, 2026.

After the real Shift+Tab sequence:

| Element | Viewport top | Viewport bottom |
| --- | --- | --- |
| Sticky `.sidebar` | 0 px | 143.3 px |
| Focused contact-name input | 90.6 px | 131.7 px |

`document.activeElement` was the contact-name input and it matched `:focus-visible`. Hit-testing the input's center returned the **Réservations** navigation button inside the sidebar, confirming that the header overlays the focused control. The page did not scroll to reveal the input when focus returned to it.

## Relevant source
[Mobile sticky sidebar and navigation styles](https://github.com/melabadi/diner-spaghetti/blob/15a21bb2343f46c98813f23610c2dffc2ee931af/src/App.css#L242-L253).

## Acceptance criteria
- [ ] At mobile breakpoints, no form control receiving keyboard focus is entirely obscured by the sticky navigation.
- [ ] Verify both Tab and Shift+Tab through the reservation form at 390 px and 320 px widths, including when the page has already been scrolled to its bottom.
- [ ] Account for the responsive header's actual height when revealing focused controls, for example with appropriate scroll padding/margins or revised sticky behavior. Preserve usable navigation and visible focus indicators.
