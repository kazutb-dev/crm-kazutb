---
name: calendar-a11y-check
description: "Use when validating accessibility of calendar UI: focus order, keyboard operations, contrast, ARIA labels, and reduced-motion behavior for dialogs, grids, and interactive event cards."
---

# Calendar Accessibility Check

## Goal
Ensure calendar interactions remain accessible under keyboard-only and assistive technology usage.

## Checklist
1. Keyboard support:
- All event cards and day cells reachable with Tab
- Dialog open/close works with Enter/Escape
- Focus returns to triggering element after modal close

2. Semantics:
- Icon-only buttons have `aria-label`
- Interactive divs replaced by buttons/links when applicable
- Time and status text announced meaningfully

3. Visual accessibility:
- Contrast for status chips and muted text meets WCAG AA
- Focus ring is visible on all actionable controls

4. Motion preferences:
- Respect `prefers-reduced-motion` for non-essential transitions

5. Error handling:
- Validation messages are attached to relevant fields
- Critical alerts readable and persistent enough for users

## Output Format
- Severity: Critical / High / Medium / Low
- File reference
- Exact fix suggestion
- Verification step
