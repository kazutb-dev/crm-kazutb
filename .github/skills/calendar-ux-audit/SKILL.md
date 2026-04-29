---
name: calendar-ux-audit
description: "Use when improving calendar UX flows (day/week/month/agenda), booking journeys, event detail modals, conflict visibility, and time-navigation ergonomics in React + Inertia apps."
---

# Calendar UX Audit

## Goal
Audit and improve calendar usability for dense scheduling interfaces with fast navigation and low error rates.

## Use When
- Calendar interactions feel slow or confusing
- Users miss conflicts, statuses, or event metadata
- Day/week/month/agenda views are inconsistent
- Booking and reschedule flows need simplification

## Workflow
1. Map critical user flows:
- Find person
- Check availability
- Create request
- Confirm/decline
- Reschedule/cancel

2. Review interaction quality:
- Click target sizes and hover/focus states
- Consistent behavior across all calendar views
- Keyboard navigation and escape hatches

3. Check information hierarchy:
- Event title/time/participant/location/link visibility
- Conflict/pending/cancelled semantics
- Dense but readable cards and chips

4. Validate time UX:
- Timezone clarity
- Relative labels (today, now, soon)
- Day boundary and multi-day event handling

5. Produce changes in this format:
- Problem
- User impact
- File-level fix
- Acceptance criteria

## Acceptance Checklist
- Event details open reliably from every view
- Core actions are visible without extra clicks
- Conflict states are not ambiguous
- Booking flow can be completed in under 2 minutes
- No regression in mobile/tablet layouts
