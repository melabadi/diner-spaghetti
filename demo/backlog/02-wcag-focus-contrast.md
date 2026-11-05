---
title: "[WCAG 1.4.11] Make keyboard focus indicators meet 3:1 contrast"
labels: ["accessibility","bug"]
---
## Summary
The shared keyboard-focus outline is a 50%-transparent terracotta color. After blending with the page, it has only about 2:1 contrast, making keyboard focus difficult for low-vision users to track across the app.

**WCAG 2.2:** [1.4.11 Non-text Contrast, Level AA](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Author-defined visual focus indicators must contrast at least **3:1** with the adjacent background. This is a contrast failure, not a claim that the app has no focus styling.

## Reproduction
1. Run the app with `npm ci` and `npm run dev` and open the Vite URL.
2. Open **Réservations**, focus the search field, and press Tab to reach the **Tous** filter button.
3. Inspect the focused button's computed outline and evaluate the displayed, alpha-composited color against its adjacent background. Repeat with form inputs or the header actions.

## Confirmed evidence
Audited revision: `15a21bb2343f46c98813f23610c2dffc2ee931af`, Chromium, October 14, 2026. Real Tab navigation confirmed that the focused element matched `:focus-visible`.

The shared rule is `outline: 3px solid #b5533880`, which resolves to `rgba(181, 83, 56, 0.5)`.

| Adjacent background | Composited outline RGB | Contrast |
| --- | --- | --- |
| White, `#ffffff` | approximately `(218, 169, 156)` | 2.072:1 |
| Page background, `#f8f7f3` | approximately `(215, 165, 150)` | 2.021:1 |

The alpha channel must be included in the calculation; checking the opaque `#b55338` color would not test the indicator users actually see.

## Relevant source
[Shared focus-visible selector and outline](https://github.com/melabadi/diner-spaghetti/blob/15a21bb2343f46c98813f23610c2dffc2ee931af/src/index.css#L28-L31).

## Acceptance criteria
- [ ] The visible focus indicator meets at least 3:1 contrast against all adjacent backgrounds where it appears, including white panels, the off-white page/sidebar, and tinted controls.
- [ ] Verify the actual composited color if transparency is retained.
- [ ] Preserve a clearly visible focus indicator for buttons, links, inputs, selects, and textareas during keyboard navigation; do not remove the outline to resolve this issue.
