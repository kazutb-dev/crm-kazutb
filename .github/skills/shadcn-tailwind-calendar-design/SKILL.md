---
name: shadcn-tailwind-calendar-design
description: "Use when redesigning or polishing calendar pages using shadcn/ui + Tailwind: spacing systems, typography scales, card/chip states, form ergonomics, and responsive behavior."
---

# shadcn + Tailwind Calendar Design

## Goal
Deliver a clean, enterprise-grade calendar UI that stays consistent with existing design tokens and component patterns.

## Principles
- Reuse existing shadcn primitives before introducing custom wrappers
- Preserve semantic status colors for scheduling states
- Keep visual density high but scannable
- Avoid decorative complexity that reduces operational clarity

## Implementation Pattern
1. Standardize primitives:
- Use `Card`, `Badge`, `Button`, `Dialog`, `Input`, `Textarea`, `Select`
- Centralize status maps (confirmed/pending/conflict/cancelled)

2. Normalize spacing/typography:
- Titles: `text-sm font-semibold`
- Supporting text: `text-xs text-muted-foreground`
- Interactive chips: consistent paddings and border-left semantics

3. Improve state styling:
- Hover, focus-visible, disabled, destructive states
- Ensure clear contrast in light and dark themes

4. Improve forms:
- Group by intent (type, time, participant, description)
- Surface validation near fields
- Keep primary action fixed and obvious

5. Responsive checks:
- 375px, 768px, 1024px, 1440px
- Prevent overflow in grid/timeline rows

## Definition of Done
- No inconsistent spacing between sections
- Calendar chips readable at dense volumes
- Modal forms actionable without scrolling fatigue
- Color semantics remain consistent across all views
