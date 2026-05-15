# Smart Calendar — Production Backlog & Battle Plan

---

## Production Backlog

### Severity Legend
- 🔴 **P0 — Launch Blocker** — system is incorrect or dangerous without this
- 🟠 **P1 — High** — major feature gap or significant production risk
- 🟡 **P2 — Medium** — required for full feature parity, no immediate danger
- 🟢 **P3 — Low** — polish / nice-to-have

---

### Backend Backlog

| ID | Severity | Title | File(s) to change | Estimated hours |
|---|---|---|---|---|
| BE-01 | 🔴 P0 | Fix timezone: `UTC` → `Asia/Almaty` | `config/app.php` | 0.5h |
| BE-02 | 🔴 P0 | Fix event creation status: meetings to others → `pending`, self-events → `confirmed` | `routes/web.php` (calendar.events.store closure) | 1h |
| BE-03 | 🔴 P0 | Add `PATCH calendar/events/{id}/confirm` route with status transition + WhatsApp notification | `routes/web.php` or new CalendarEventService | 2h |
| BE-04 | 🔴 P0 | Add `PATCH calendar/events/{id}/decline` route with status transition + WhatsApp notification | same | 1h |
| BE-05 | 🔴 P0 | Add `PATCH calendar/events/{id}/cancel` route: set `cancelled_by/at/reason`, status=cancelled, send WhatsApp, call ZoomMeetingService::cancelMeeting() if zoom_meeting_id set | same | 3h |
| BE-06 | 🔴 P0 | Wire `CalendarNotificationLog` writes in `GreenApiWhatsAppNotifier` on every send/fail | `app/Services/GreenApiWhatsAppNotifier.php`, `app/Models/CalendarNotificationLog.php` | 2h |
| BE-07 | 🔴 P0 | Populate `CalendarAuditLog` on every event/slot create/update/delete | all calendar route closures / controllers | 3h |
| BE-08 | 🔴 P0 | Remove hardcoded `yelnurzeinolla1@gmail.com` from CalendarMyController | `app/Http/Controllers/CalendarMyController.php` | 0.5h |
| BE-09 | 🔴 P0 | Add rate limiting (`throttle:60,1`) to calendar mutation routes; stricter limit on Zoom/WhatsApp-triggered routes | `routes/web.php`, `bootstrap/app.php` | 1h |
| BE-10 | 🟠 P1 | Extract calendar closures from routes/web.php into CalendarEventService, CalendarSlotService, CalendarConflictDetector | `app/Services/`, `routes/web.php` | 8h |
| BE-11 | 🟠 P1 | Fix slot creation: expose `slot_duration_minutes`, `buffer_minutes`, `access_type` in store route and validation | `routes/web.php` (calendar.slots.store closure) | 1.5h |
| BE-12 | 🟠 P1 | Fix event store: accept and save `format` and `room` fields | `routes/web.php` (calendar.events.store closure) | 1h |
| BE-13 | 🟠 P1 | Fix event update: accept and save `format` and `room` fields | `routes/web.php` (calendar.events.update closure) | 0.5h |
| BE-14 | 🟠 P1 | Fix suggest-slot window: 08:00–19:00 → 08:30–17:30 | `routes/web.php` (calendar.events.suggest-slot closure) | 0.5h |
| BE-15 | 🟠 P1 | Implement `ZoomMeetingService::cancelMeeting()` | `app/Services/ZoomMeetingService.php` | 2h |
| BE-16 | 🟠 P1 | Implement `ZoomMeetingService::updateMeeting()` | `app/Services/ZoomMeetingService.php` | 1.5h |
| BE-17 | 🟠 P1 | Implement reminder jobs: Console Command `SendCalendarReminders` dispatched from scheduler (60/30/15 min before start) | `app/Console/Commands/SendCalendarReminders.php`, `routes/console.php` | 4h |
| BE-18 | 🟠 P1 | Configure Zimbra SMTP in `.env` + `config/mail.php`; implement email notification on event transitions | `.env`, `config/mail.php`, notification classes | 3h |
| BE-19 | 🟠 P1 | Add DB indexes: `calendar_events(organizer_id, starts_at)`, `(attendee_id, starts_at)`, `(status, starts_at)` | new migration | 0.5h |
| BE-20 | 🟠 P1 | Add `PATCH calendar/events/{id}/reschedule` route: update times, reset to pending, send WhatsApp | `routes/web.php` | 2h |
| BE-21 | 🟠 P1 | Add `PATCH calendar/events/{id}/complete` route: set status=completed | `routes/web.php` | 0.5h |
| BE-22 | 🟡 P2 | Add `rank_level` column to `users` table and enforce rank hierarchy in EnsureCalendarLeadershipAccess | new migration, `app/Http/Middleware/EnsureCalendarLeadershipAccess.php` | 3h |
| BE-23 | 🟡 P2 | Auto-compute `calendar_status` from events (job or observer) instead of manual-only | `app/Observers/` or job | 3h |
| BE-24 | 🟡 P2 | Expand `CalendarEmployeeProfileController` to include phone, email, room from AD sync | `app/Http/Controllers/CalendarEmployeeProfileController.php` | 1h |
| BE-25 | 🟡 P2 | Admin global conference view in `CalendarConferencesController::index()` | `app/Http/Controllers/CalendarConferencesController.php` | 1h |
| BE-26 | 🟡 P2 | Analytics: workload ranking query (meetings per employee, sorted desc) | `app/Http/Controllers/CalendarAnalyticsController.php` | 2h |
| BE-27 | 🟡 P2 | Analytics: export endpoint (CSV) | new route + controller method | 2h |
| BE-28 | 🟡 P2 | Fix `CalendarMyController` to use `CalendarEmployeesController::LEADERSHIP_PATTERNS` constant instead of duplicated array | `app/Http/Controllers/CalendarMyController.php` | 0.5h |
| BE-29 | 🟢 P3 | Zoom webhook handler to sync Zoom meeting status back to CalendarEvent | new route + controller | 3h |
| BE-30 | 🟢 P3 | Secretary role bypass: allow secretaries through middleware without matching title pattern | `app/Http/Middleware/EnsureCalendarLeadershipAccess.php` | 1h |

---

### Frontend Backlog

| ID | Severity | Title | File(s) to change | Estimated hours |
|---|---|---|---|---|
| FE-01 | 🔴 P0 | Add `format` toggle (offline/online) to CreateEventModal | `resources/js/Pages/Calendar/Index.jsx` | 1.5h |
| FE-02 | 🔴 P0 | Add `room` field to CreateEventModal | `resources/js/Pages/Calendar/Index.jsx` | 0.5h |
| FE-03 | 🔴 P0 | Add `room` field to EventModal edit form | `resources/js/Pages/Calendar/Index.jsx` | 0.5h |
| FE-04 | 🔴 P0 | Add Confirm / Decline action buttons in EventModal for attendees (shown when `!event.is_own && event.status==='pending'`) | `resources/js/Pages/Calendar/Index.jsx` | 2h |
| FE-05 | 🔴 P0 | Replace hard-delete with Cancel flow in EventModal: prompt for reason, POST to cancel route | `resources/js/Pages/Calendar/Index.jsx` | 2h |
| FE-06 | 🔴 P0 | Add phone to employee search filter | `resources/js/Pages/Calendar/Employees.jsx` | 0.5h |
| FE-07 | 🟠 P1 | Add format toggle to EventModal edit form | `resources/js/Pages/Calendar/Index.jsx` | 0.5h |
| FE-08 | 🟠 P1 | Add Reschedule modal/form in EventModal | `resources/js/Pages/Calendar/Index.jsx` | 3h |
| FE-09 | 🟠 P1 | Expose slot duration, buffer, access_type in Settings slot creation form | `resources/js/Pages/Calendar/Settings.jsx` | 2h |
| FE-10 | 🟠 P1 | Add "Book meeting" button on each employee card in Employees.jsx (opens MeetingModal directly) | `resources/js/Pages/Calendar/Employees.jsx` | 2h |
| FE-11 | 🟠 P1 | Employee profile: display phone, email, room when available | `resources/js/Pages/Calendar/EmployeeProfile.jsx` | 1h |
| FE-12 | 🟠 P1 | Employee profile: "Past meetings" tab (meetings with this employee in past) | `resources/js/Pages/Calendar/EmployeeProfile.jsx`, `CalendarEmployeeProfileController.php` | 3h |
| FE-13 | 🟠 P1 | Conferences: add cancel button that calls cancel route (BE-05) | `resources/js/Pages/Calendar/Conferences.jsx` | 1h |
| FE-14 | 🟡 P2 | Analytics: add workload ranking table | `resources/js/Pages/Calendar/Analytics.jsx` | 2h |
| FE-15 | 🟡 P2 | Analytics: CSV export button | `resources/js/Pages/Calendar/Analytics.jsx` | 1h |
| FE-16 | 🟡 P2 | Analytics: replace progress bars with Recharts bar chart (already in package.json) | `resources/js/Pages/Calendar/Analytics.jsx` | 3h |
| FE-17 | 🟡 P2 | Employee profile: WhatsApp message CTA (link to wa.me with phone number) | `resources/js/Pages/Calendar/EmployeeProfile.jsx` | 1h |
| FE-18 | 🟡 P2 | Notification delivery status in notifications feed | `resources/js/Pages/Calendar/Index.jsx` | 2h |
| FE-19 | 🟢 P3 | Employee photo display (from AD or uploaded) | `EmployeeProfile.jsx`, `Employees.jsx` | 2h |
| FE-20 | 🟢 P3 | Keyboard navigation in calendar grid (arrow keys between days) | `Index.jsx` | 2h |

---

### Infrastructure / DevOps Backlog

| ID | Severity | Title | Estimated hours |
|---|---|---|---|
| INF-01 | 🔴 P0 | Set `APP_TIMEZONE=Asia/Almaty` in production `.env` (companion to BE-01) | 0.25h |
| INF-02 | 🔴 P0 | Configure Laravel queue worker (`php artisan queue:work`) as a supervised process (systemd/supervisor) | 1h |
| INF-03 | 🔴 P0 | Configure Laravel scheduler (`php artisan schedule:run` every minute via cron) | 0.5h |
| INF-04 | 🟠 P1 | Configure Zimbra SMTP credentials in production `.env` | 0.5h |
| INF-05 | 🟠 P1 | Set up secret rotation policy for `TOPIC_AI_API_KEY`, `AD_BIND_PASSWORD`, Zoom credentials | 2h |
| INF-06 | 🟠 P1 | Add `APP_ENV=production`, `APP_DEBUG=false`, `LOG_LEVEL=error` to production `.env` | 0.25h |
| INF-07 | 🟡 P2 | Add database query logging / Telescope in staging for N+1 detection | 1h |
| INF-08 | 🟡 P2 | Set up Redis for queue driver (replace `database` queue driver) | 1h |

---

### Testing Backlog

| ID | Severity | Title | Estimated hours |
|---|---|---|---|
| TEST-01 | 🟠 P1 | Feature tests for event creation status flow (pending/confirmed/conflict) | `tests/Feature/Calendar/` | 3h |
| TEST-02 | 🟠 P1 | Feature tests for confirm/decline/cancel routes | same | 2h |
| TEST-03 | 🟠 P1 | Unit tests for CalendarConflictDetector (timezone-aware overlap detection) | `tests/Unit/Calendar/` | 3h |
| TEST-04 | 🟠 P1 | Unit tests for slot recurrence expansion | same | 2h |
| TEST-05 | 🟡 P2 | Feature tests for availability endpoint | same | 2h |
| TEST-06 | 🟡 P2 | Feature tests for analytics (period filtering, admin vs personal) | same | 2h |
| TEST-07 | 🟡 P2 | WhatsApp notifier tests (mock GreenApiWhatsAppNotifier) | same | 1h |

---

## Battle Plan

### Phase 1 — Immediate Blockers (Days 1–3, ~29h)

> Goal: The system is correct, safe, and trustworthy. Users will not receive wrong times or auto-confirmed meetings.

**Day 1 (8h):**
- [ ] BE-01: Fix `config/app.php` timezone → `Asia/Almaty` + INF-01
- [ ] BE-08: Remove hardcoded test email from CalendarMyController
- [ ] BE-09: Add rate limiting to calendar routes
- [ ] BE-02: Fix event creation status (pending vs confirmed logic)
- [ ] FE-01 + FE-02 + FE-03: Add format toggle and room field to create/edit forms

**Day 2 (8h):**
- [ ] BE-03: `PATCH /confirm` route + WhatsApp notification
- [ ] BE-04: `PATCH /decline` route + WhatsApp notification  
- [ ] BE-05: `PATCH /cancel` route with cancellation fields + Zoom cancel
- [ ] FE-04: Confirm/Decline buttons in EventModal
- [ ] FE-05: Replace hard-delete with cancel flow in EventModal

**Day 3 (8h):**
- [ ] BE-06: Wire `CalendarNotificationLog` writes in GreenApiWhatsAppNotifier
- [ ] BE-07: Wire `CalendarAuditLog` writes on all event mutations
- [ ] INF-02 + INF-03: Queue worker + scheduler cron setup
- [ ] FE-06: Add phone to employee search

---

### Phase 2 — Backend Fixes (Days 4–7, ~28h)

> Goal: Core feature completeness. All slots configurable. Reminders work. Email works.

- [ ] BE-10: Extract route closures into Service classes (largest refactor)
- [ ] BE-11: Expose slot configuration fields in store route
- [ ] BE-12 + BE-13: Accept format/room in event store/update
- [ ] BE-14: Fix suggest-slot time window to 08:30–17:30
- [ ] BE-15 + BE-16: ZoomMeetingService cancel + update
- [ ] BE-17: `SendCalendarReminders` console command (60/30/15 min)
- [ ] BE-18: Zimbra SMTP setup + email notifications
- [ ] BE-19: Add missing DB indexes
- [ ] BE-20 + BE-21: Reschedule + complete routes

---

### Phase 3 — Frontend Fixes (Days 8–10, ~20h)

> Goal: UI fully covers the implemented backend. No missing buttons for implemented features.

- [ ] FE-07: Format toggle in edit form
- [ ] FE-08: Reschedule modal
- [ ] FE-09: Settings slot duration/buffer/access_type fields
- [ ] FE-10: "Book meeting" button on employee cards
- [ ] FE-11 + FE-12: Employee profile contact info + history tab
- [ ] FE-13: Conference cancel button
- [ ] BE-28: Fix CalendarMyController constant duplication

---

### Phase 4 — Integrations + Testing (Days 11–13, ~20h)

> Goal: Tested, observable, with no-show metrics and admin oversight.

- [ ] TEST-01 through TEST-04: Core calendar feature tests
- [ ] BE-22: Rank level + hierarchy enforcement
- [ ] BE-23: Auto-compute calendar_status
- [ ] BE-24 + BE-25: Profile data + admin conferences
- [ ] INF-05: Secret rotation policy
- [ ] INF-07: Telescope for N+1 detection in staging

---

### Phase 5 — Analytics + Polish (Days 14–16, ~18h)

> Goal: Analytics are actionable. Charts are visual. Export works.

- [ ] BE-26: Workload ranking query
- [ ] BE-27: CSV export endpoint
- [ ] FE-14 + FE-15 + FE-16: Analytics UI improvements
- [ ] FE-17: WhatsApp CTA on profile
- [ ] TEST-05 through TEST-07: Remaining tests
- [ ] FE-18: Notification delivery status in feed

---

## Summary Timeline

| Phase | Days | Hours | Deliverable |
|---|---|---|---|
| 1 — Immediate Blockers | 1–3 | ~29h | System is safe to use; correct status flow, audit trail, notifications |
| 2 — Backend Fixes | 4–7 | ~28h | All slots configurable, reminders work, Zoom cancel/update, email works |
| 3 — Frontend Fixes | 8–10 | ~20h | UI fully covers all backend features |
| 4 — Integrations + Testing | 11–13 | ~20h | Test coverage, rank hierarchy, auto-status |
| 5 — Analytics + Polish | 14–16 | ~18h | Analytics complete, export, charts |
| **Total** | **~16 working days** | **~115h** | **Full production feature parity** |

Minimum viable launch: **Phase 1 only (~29h)** — system becomes correct and observable but lacks some features (reminders, reschedule, configurable slots).
