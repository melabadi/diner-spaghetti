---
title: "[WCAG 1.4.11] Increase empty form-control boundary contrast"
labels: ["accessibility","bug"]
---
## Summary
Empty text inputs and textareas have white interiors on white form panels, separated only by a very light border. That border has approximately **1.34:1** contrast, so users with low vision cannot reliably identify the editable control's boundary.

**WCAG 2.2:** [1.4.11 Non-text Contrast, Level AA](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), which requires at least **3:1** for visual information necessary to identify a user-interface component. This issue concerns necessary boundaries of blank form fields, not decorative panel borders or every button's hit area.

## Reproduction
1. Run the app with `npm ci` and `npm run dev`, then open the Vite URL with sample data.
2. Open **Courses & budget** and inspect the blank **Article ou dépense** and **Quantité ou détail** inputs.
3. Compare the field border with both the input's white fill and the surrounding white form panel. The same shared styling is used by reservation and volunteer form fields.

## Confirmed evidence
Audited revision: `15a21bb2343f46c98813f23610c2dffc2ee931af`, Chromium computed-style inspection, October 14, 2026.

- Shared input border: `#dedfd6` / `rgb(222, 223, 214)`.
- Input background: `#ffffff`.
- Surrounding `.panel` background: `#ffffff`.
- Border/background contrast: **1.343:1**, below 3:1.

A blank field's label does not provide a contrasting boundary for its editable area. Improving only the focus ring would leave this defect in the unfocused state.

## Relevant source
- [Shared input, select, and textarea styling](https://github.com/melabadi/diner-spaghetti/blob/15a21bb2343f46c98813f23610c2dffc2ee931af/src/index.css#L32-L46)
- [White panel background](https://github.com/melabadi/diner-spaghetti/blob/15a21bb2343f46c98813f23610c2dffc2ee931af/src/index.css#L11)

## Acceptance criteria
- [ ] Enabled blank form controls have a boundary or equivalent visual treatment that identifies the control with at least 3:1 contrast against adjacent colors.
- [ ] Verify the unfocused/default state in reservations, volunteers, shopping/budget, and event settings, as well as hover and focus states.
- [ ] Keep field labels, text contrast, and the existing keyboard-focus indication intact.
