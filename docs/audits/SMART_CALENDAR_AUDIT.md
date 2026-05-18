# Smart Calendar — Full Production-Grade Audit

> **Audit Date:** 2026-05-xx  
> **Codebase:** Laravel 11 + React/Inertia.js  
> **Stack:** MySQL · Vite 7 · shadcn/ui · Tailwind CSS  
> **Auditor scope:** All 95 business requirements cross-checked against live code  
> **Build status:** `npm run build` — ✅ passes

---

## 0. Executive Summary

| Area | Score | Verdict |
|---|---|---|
| Core data model / migrations | 7 / 10 | Good schema, unused fields |
| Backend architecture | 2 / 10 | **Catastrophic** — all logic in route closures |
| Frontend completeness | 5 / 10 | Partially implemented, missing key workflows |
| Timezone correctness | 0 / 10 | **UTC hardcoded** — all overlap math is wrong |
| Notification system | 1 / 10 | WhatsApp on create only; log never written |
| Audit / compliance | 0 / 10 | Audit log model is empty stub, never written |
| Security | 3 / 10 | Secrets exposed, no CSRF on some flows, no rate-limit |
| Test coverage | 0 / 10 | Zero calendar tests |
| **Overall production readiness** | **2 / 10** | **NOT production-ready** |

**Verdict:** The Smart Calendar module has a solid DB schema and a working UI shell. However, it contains **critical architectural, correctness, and security defects** that make it unsafe to deploy in production. The most dangerous are: (1) UTC timezone bug that corrupts all slot-overlap calculations for Kazakhstan users, (2) all business logic living as anonymous closures inside `routes/web.php`, (3) a notification system that only fires on event creation (no confirm/decline/cancel/reminder notifications), (4) zero audit trail, (5) secrets stored in plain `.env` with no rotation policy.

---

## 1. Architecture Overview

```
routes/web.php  ←  ALL calendar business logic lives here as closures
    ↓
app/Http/Controllers/  ←  6 thin controllers only for GET/render
    CalendarMyController.php
    CalendarEmployeesController.php
    CalendarEmployeeProfileController.php
    CalendarConferencesController.php
    CalendarAnalyticsController.php
    CalendarSettingsController.php  ←  dead? not used in routes

app/Models/  ←  CalendarEvent, CalendarAvailabilitySlot, CalendarHoliday
              CalendarAuditLog (STUB), CalendarNotificationLog (STUB)

app/Services/
    GreenApiWhatsAppNotifier.php  ←  implemented, partial coverage
    ZoomMeetingService.php  ←  createMeeting() only
    ActiveDirectoryAuthenticator.php  ←  fully implemented

app/Http/Middleware/
    EnsureCalendarLeadershipAccess.php  ←  correct gate, missing rank hierarchy
```

**Core architectural problem:** Routes/web.php lines 373–1350+ contain ALL calendar business logic: `$canManageCalendar`, `$slotAppliesToDay`, `$hasSlotOverlap`, `$findSlotOverlaps`, `$expandSlotsForMonth` as PHP closures. This cannot be unit-tested, cannot be reused, makes the code impossible to maintain, and will cause 500 errors if PHP memory limit is hit because the full closure tree is parsed on every request.

---

## 2. Complete Requirement Compliance Matrix (95 requirements)

### 2.1 Access Control

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Only leadership-role users can access the Smart Calendar | ✅ Implemented | `EnsureCalendarLeadershipAccess` middleware checks title patterns + grants table |
| 2 | Access guard by job title patterns (ректор, декан, директор, заведующ) | ✅ Implemented | `LEADERSHIP_PATTERNS` constant in `CalendarEmployeesController` |
| 3 | Secretary can be granted access on behalf of a leader | ✅ Implemented | `calendar_secretary_access` table + `calendar.secretary-access.store/destroy` routes |
| 4 | Admin can grant access to any user via grants table | ✅ Implemented | `calendar_employee_grants` table + routes |
| 5 | Admin can exclude a user from the calendar | ✅ Implemented | `calendar_employee_exclusions` table + routes |
| 6 | Rank hierarchy determines priority override | ❌ Missing | No `rank_level` field on users table. `priority_override` field exists in DB but never set |
| 7 | Secretary cannot override higher-rank schedule | ❌ Missing | Middleware has no rank check; all passing users are treated equally |

### 2.2 Calendar Index / Personal View

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 8 | Month/Week/Day/Agenda view modes | ✅ Implemented | `MonthView`, `WeekView`, `DayView`, `AgendaView` components in `Index.jsx` |
| 9 | Navigate between months/weeks/days | ✅ Implemented | ChevronLeft/Right with state update |
| 10 | Today button | ✅ Implemented | Present in Index.jsx toolbar |
| 11 | Create event modal with title, type, time, description | ✅ Implemented | `CreateEventModal` with all 4 fields |
| 12 | Event type selector (meeting, vacation, business_trip, sick_leave, personal, remote, other) | ✅ Implemented | All 7 types present |
| 13 | Event format selector (offline/online) | ❌ Missing | Form has no format field; backend hardcodes `format='offline'` |
| 14 | Room field on event creation | ❌ Missing | Not in creation form or store route |
| 15 | New meeting request sets status='pending' | ❌ BROKEN | Backend sets `status = $conflictExists ? 'conflict' : 'confirmed'` — never 'pending' |
| 16 | Attendee can confirm/decline meeting | ❌ Missing | No confirm/decline routes exist anywhere |
| 17 | Owner can cancel a meeting | ❌ Missing | `handleDelete()` hard-deletes the event via `calendar.events.destroy`; no cancellation flow |
| 18 | Meeting can be rescheduled | ❌ Missing | No reschedule route or UI |
| 19 | Color-coded event chips with custom label color | ✅ Implemented | `PRESET_COLORS`, `TYPE_COLOR_HEX`, and custom color picker in edit modal |
| 20 | Upcoming meetings panel | ✅ Implemented | `upcomingEvents` from `CalendarMyController` |
| 21 | Meeting notification badge (pending meetings) | ✅ Implemented | `meetingNotifications` feed, bell icon in Index.jsx |
| 22 | Conflict detection on event creation | ⚠️ Partial | Conflict detected but event is auto-saved with status='conflict' instead of blocking + requiring confirmation |
| 23 | Auto-suggest free slot | ✅ Implemented | `calendar.events.suggest-slot` route + button in CreateEventModal |
| 24 | Suggest-slot window 08:30–17:30 | ❌ WRONG | Hardcoded `08:00`–`19:00` in route closure |
| 25 | Attendee availability mini-calendar in create modal | ✅ Implemented | Full availability calendar with busy/absence/free day coloring |
| 26 | Summary stats (week, today, pending, conflict, vacation, trip) | ✅ Implemented | `CalendarMyController` computes all 6 stats |
| 27 | Stats correctness for Kazakhstan timezone | ❌ BROKEN | `config('app.timezone')` = UTC; all `Carbon::now()->timezone(...)` calls use UTC |

### 2.3 Employee Directory

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 28 | Employee list filtered to leadership titles | ✅ Implemented | `CalendarEmployeesController::LEADERSHIP_PATTERNS` |
| 29 | Search by name, title, department | ✅ Implemented | Client-side filter in `Employees.jsx` |
| 30 | Search by phone number | ❌ Missing | Phone not in employee data returned from server; not in client filter |
| 31 | Search by room | ✅ Implemented | `e.room` in filter |
| 32 | Search by email | ✅ Implemented | `e.email` in filter |
| 33 | Availability status badge | ✅ Implemented | Dot indicator with STATUS_COLORS map |
| 34 | Link to employee calendar profile | ✅ Implemented | "Открыть календарь" → `calendar.employees.profile` |
| 35 | Direct booking CTA from directory | ❌ Missing | No booking button on employee cards; user must navigate to profile first |

### 2.4 Employee Profile

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 36 | Employee name, title, department displayed | ✅ Implemented | `CalendarEmployeeProfileController` provides these |
| 37 | Employee photo | ❌ Missing | No photo field in controller response; shows generic User icon |
| 38 | Employee phone number | ❌ Missing | Not in profile data |
| 39 | Employee email | ❌ Missing | Not in profile data |
| 40 | Employee room/office | ❌ Missing | Not in profile data |
| 41 | Employee availability status | ✅ Implemented | `calendar_status` field present |
| 42 | Month calendar of employee events | ✅ Implemented | `MonthCalendar` component with event chips |
| 43 | Day detail panel for selected day | ✅ Implemented | `DayPanel` component |
| 44 | "Propose meeting" button opens booking form | ✅ Implemented | `MeetingModal` with attendee pre-filled |
| 45 | Booking form shows conflict warning if employee is absent | ✅ Implemented | `busyConflict` check against blocking event types |
| 46 | WhatsApp message tab on profile | ❌ Missing | No messaging tab; no direct WhatsApp UI |
| 47 | Meeting history tab on profile | ❌ Missing | No history/past-meetings tab |

### 2.5 Conferences

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 48 | List of online conferences | ✅ Implemented | `CalendarConferencesController::index()` |
| 49 | Create new Zoom conference | ✅ Implemented | `store()` with Zoom API + attendee events created |
| 50 | WhatsApp notification to each attendee on conference creation | ✅ Implemented | Loop over attendees in `store()` |
| 51 | Conference list scope: all-user view for admin | ❌ Missing | Scope is current user's events only (organizer OR attendee, current week) |
| 52 | Cancel Zoom meeting if conference cancelled | ❌ Missing | `ZoomMeetingService::cancelMeeting()` not implemented |
| 53 | Update Zoom meeting if conference rescheduled | ❌ Missing | `ZoomMeetingService::updateMeeting()` not implemented |
| 54 | Zoom join URL visible on event detail | ✅ Implemented | `EventModal` shows "Подключиться к Zoom" link |

### 2.6 Settings

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 55 | Manage availability slots (add/remove) | ✅ Implemented | `calendar.slots.store/destroy` routes |
| 56 | Slot duration configurable | ❌ BROKEN | Hardcoded `slot_duration_minutes=30`; not exposed in form |
| 57 | Buffer between slots configurable | ❌ BROKEN | Hardcoded `buffer_minutes=0`; not exposed in form |
| 58 | Slot access type (open/invitation/rank) | ❌ BROKEN | Hardcoded `access_type='open'`; not exposed in form |
| 59 | Manage secretary access | ✅ Implemented | `calendar.secretary-access.store/destroy` + settings UI |
| 60 | Manage employee grants/exclusions | ✅ Implemented | Routes + settings UI |
| 61 | Add/remove public holidays | ✅ Implemented | `calendar.holidays.store/destroy` routes |
| 62 | Manual calendar status update (available/busy/soon/dnd) | ✅ Implemented | `calendar.status.update` PATCH + status UI |
| 63 | Calendar status computed from actual events | ❌ Missing | Status is manual only; not auto-computed from events |

### 2.7 Analytics

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 64 | Personal meeting stats (total, completed, cancelled, pending) | ✅ Implemented | `CalendarAnalyticsController` personal stats |
| 65 | Vacation/business trip day counts | ✅ Implemented | Both in personal stats |
| 66 | Period selector (week/month/quarter/year) | ✅ Implemented | `PERIODS` selector in `Analytics.jsx`; route respects `period` param |
| 67 | Admin aggregate stats (all employees) | ✅ Implemented | `adminStats` in controller + `isAdmin` flag |
| 68 | Workload ranking (busiest employees) | ❌ Missing | Not in controller or UI |
| 69 | No-show tracking | ❌ Missing | No `no_show` status or comparison of invited vs. completed |
| 70 | Meeting topics analysis | ❌ Missing | No topic grouping/NLP analysis |
| 71 | Export analytics data | ❌ Missing | No CSV/Excel/PDF export |
| 72 | Completion rate bar chart | ⚠️ Partial | Progress bars per stat but no actual chart library |

### 2.8 Notifications

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 73 | WhatsApp notification on new meeting request | ✅ Implemented | Fired in `calendar.events.store` route closure |
| 74 | WhatsApp notification on meeting confirmed | ❌ Missing | No confirm route; no notification |
| 75 | WhatsApp notification on meeting declined | ❌ Missing | No decline route; no notification |
| 76 | WhatsApp notification on meeting cancelled | ❌ Missing | No cancellation route; no notification |
| 77 | WhatsApp notification on meeting rescheduled | ❌ Missing | No reschedule route; no notification |
| 78 | Reminder 60 min before meeting | ❌ Missing | No scheduled command; no queue job |
| 79 | Reminder 30 min before meeting | ❌ Missing | No scheduled command; no queue job |
| 80 | Reminder 15 min before meeting | ❌ Missing | No scheduled command; no queue job |
| 81 | Email notification (Zimbra) | ❌ Missing | `MAIL_MAILER=log`; no Zimbra SMTP config |
| 82 | Notification delivery log | ❌ Missing | `CalendarNotificationLog` model is empty stub; never written to |
| 83 | Push notification (browser) | ❌ Missing | No implementation |

### 2.9 Security / Infrastructure

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 84 | CSRF protection on all state-changing routes | ✅ Implemented | Laravel's built-in CSRF middleware applies to all web routes |
| 85 | SQL injection prevention | ✅ Implemented | All queries use Eloquent ORM; no raw SQL with user input |
| 86 | Rate limiting on booking endpoints | ❌ Missing | No rate-limit middleware on any calendar route |
| 87 | Secrets management (API keys not in VCS) | ⚠️ Risk | `.env` excluded from VCS but OpenAI key (`sk-proj-...`) and AD bind password exposed in plaintext; no key rotation documented |
| 88 | Audit trail for all calendar mutations | ❌ Missing | `CalendarAuditLog` model is empty stub; no writes anywhere |
| 89 | Encrypted storage for Zoom tokens | ❌ Missing | Zoom credentials in `.env` plaintext |
| 90 | N+1 query prevention | ⚠️ Risk | `CalendarMyController` fires individual User lookups inside loops; no eager loading evidence |

### 2.10 AD / User Sync

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 91 | AD authentication via LDAP | ✅ Implemented | `ActiveDirectoryAuthenticator` with paged results, escape, bind |
| 92 | User profile synced from AD (name, department, title, room, phone) | ⚠️ Partial | AD returns `pager` (phone), `physicaldeliveryofficename` (room), `title`, `department`; but sync to `users` table not verified for room/phone |
| 93 | AD user filter configurable | ✅ Implemented | `AD_USER_FILTER` in config/ad.php |
| 94 | LDAP connection uses SSL | ✅ Implemented | `AD_SSL=true`, port 636 |
| 95 | Fallback login when AD unavailable | ✅ Implemented | Hash-based local password fallback in authenticator |

---

## 3. Backend Audit

### 3.1 Routes / Business Logic Placement — CRITICAL

**File:** `routes/web.php` lines 373–1350+

All calendar business logic lives as anonymous PHP closures inside the route definitions. This includes:

- `$canManageCalendar` — authorization closure
- `$slotAppliesToDay` — slot recurrence expansion
- `$hasSlotOverlap` — overlap detection
- `$findSlotOverlaps` — detailed overlap list
- `$expandSlotsForMonth` — month-wide slot expansion

**Problems:**
1. **Untestable** — closures in routes cannot be unit-tested without making full HTTP requests
2. **Unmaintainable** — 1000+ lines of logic mixed with routing declarations
3. **No reuse** — the same overlap logic is copy-pasted for event creation and slot checking
4. **Memory pressure** — the entire closure tree is parsed on every request even for non-calendar routes
5. **No error isolation** — a bug in one closure can cascade across the entire route file

**Required fix:** Extract all calendar logic into Service classes and Controller methods.

### 3.2 Timezone Bug — CRITICAL

**File:** `config/app.php` line ~7  
```php
'timezone' => 'UTC',
```

Kazakhstan operates in Asia/Almaty (UTC+5). No `APP_TIMEZONE` override exists in `.env`.

All `Carbon::now()->timezone(config('app.timezone'))` calls in the route closures resolve to UTC. This means:

- Slot overlap calculations run in UTC time, not Almaty time
- A meeting at 09:00 Almaty (04:00 UTC) will fail to detect conflicts with another 09:00 Almaty meeting
- The suggest-slot algorithm returns UTC-based times
- "Today's" meetings count is computed in UTC — the user sees yesterday's count at midnight Almaty time

**Required fix:** Set `'timezone' => 'Asia/Almaty'` in `config/app.php`.

### 3.3 Event Status Flow — CRITICAL

**Expected flow:** `pending` → (confirmed | declined) → (completed | cancelled)  
**Actual flow:** new event → immediately `confirmed` (or `conflict` if overlap detected)

```php
// routes/web.php ~line 968
'status' => $conflictExists ? 'conflict' : 'confirmed',
```

The `pending` status is never set on creation. The attendee has no way to confirm or decline because:
1. There are no `confirm` or `decline` routes
2. The event is already marked `confirmed` before the attendee sees it
3. There is no notification that a new meeting request is "pending" the attendee's approval (they receive a WhatsApp saying "new request" but the status is already confirmed)

### 3.4 Missing Routes — HIGH

| Route needed | Purpose | Status |
|---|---|---|
| `PATCH calendar/events/{id}/confirm` | Attendee confirms meeting | ❌ Missing |
| `PATCH calendar/events/{id}/decline` | Attendee declines meeting | ❌ Missing |
| `PATCH calendar/events/{id}/cancel` | Owner cancels meeting | ❌ Missing |
| `PATCH calendar/events/{id}/reschedule` | Propose new time | ❌ Missing |
| `PATCH calendar/events/{id}/complete` | Mark meeting as completed | ❌ Missing |

### 3.5 Hardcoded Slot Configuration — HIGH

```php
// routes/web.php ~line 1033–1038
'slot_duration_minutes' => 30,
'buffer_minutes' => 0,
'access_type' => 'open',
```

The DB schema supports configurable `slot_duration_minutes`, `buffer_minutes`, `access_type`, and `min_rank_level`. None of these are exposed in the settings UI or accepted from the form. All slots are silently created as 30-minute, no-buffer, open-access regardless of what the user wants.

### 3.6 Notification System — HIGH

**`GreenApiWhatsAppNotifier`** is correctly implemented but only called in 2 places:
1. New meeting request → notifies attendee
2. Conference creation → notifies each attendee

**Not called on:**
- Meeting confirmation (no route)
- Meeting decline (no route)
- Meeting cancellation (no route)
- Reschedule (no route)
- Any reminders (no scheduled commands exist)

`CalendarNotificationLog` is a complete DB schema (with channel, type, status, sent_at, payload, error columns) but the model class body is empty and **no code ever writes to this table**. No delivery history, no retry logic, no failure tracking.

### 3.7 Audit Log — HIGH

`CalendarAuditLog` model: empty class body. `calendar_audit_log` migration: exists. Zero writes anywhere in the codebase. No audit trail for any calendar mutation.

### 3.8 Zoom Integration — MEDIUM

`ZoomMeetingService::createMeeting()` is functional. However:
- `cancelMeeting()` not implemented — if a conference event is deleted, the Zoom meeting remains active
- `updateMeeting()` not implemented — if a conference is rescheduled, Zoom meeting has wrong time
- No webhook handler for Zoom event status updates

### 3.9 Email Integration — MEDIUM

`MAIL_MAILER=log` — all "sent" emails go to Laravel log file only. No Zimbra SMTP configuration exists in `config/services.php` or `.env`. Requirements mention Zimbra email notifications but this is completely unimplemented.

### 3.10 `CalendarMyController` Hardcoded Employee Filter — LOW

```php
// CalendarMyController.php
$allowedEmails = ['yelnurzeinolla1@gmail.com'];
$patterns = ['ректор','декан','директор','заведующ']; // duplicated from LEADERSHIP_PATTERNS
```

The test email is hardcoded. This is a development artefact that should not be in production.

---

## 4. Frontend Audit

### 4.1 Index.jsx — Event Creation Form

**Missing fields vs. requirements:**
- No `format` toggle (offline/online) — meetings always created as offline
- No `room` field — room is stored in DB but never captured at creation
- No `attendee_id` required validation feedback when type=meeting
- Edit modal (`EventModal`) also missing `format` and `room` fields

**Color picker:** Implemented and functional.  
**Availability calendar in create modal:** Implemented with busy/absence/free day coding. ✅

### 4.2 Index.jsx — Event Detail / Actions

`EventModal` shows event details correctly. However:
- **No confirm/decline buttons** for the attendee
- **No cancel button** (only hard delete, which is destructive and leaves no audit trail)
- **No reschedule button**
- `event.is_own` flag controls edit/delete visibility — correct pattern but no attendee-action section

### 4.3 EmployeeProfile.jsx

**Implemented:**
- Month calendar with event chips ✅
- Day panel with event list ✅
- "Propose meeting" modal (MeetingModal) with conflict warning ✅
- Month navigation ✅

**Missing:**
- Employee photo (shows generic User icon)
- Employee phone / email / room from AD data
- Meeting history tab (past meetings with this employee)
- WhatsApp direct message tab
- Booking confirmation / status tracking after proposing a meeting

### 4.4 Employees.jsx

Phone search not implemented. No direct booking CTA on employee cards.

### 4.5 Analytics.jsx

Period selector implemented. Basic stat cards implemented. Missing:
- Workload ranking table (which employees have most meetings)
- No-show metric
- Visual charts (only progress bars)
- Export button

### 4.6 Conferences.jsx

Functional for creating/listing Zoom conferences. Missing:
- Cancel conference button that also cancels Zoom meeting
- Admin view of all conferences (currently scoped to current user's events only)

### 4.7 Settings.jsx

Slot creation form works but exposes no controls for duration/buffer/access_type. The form collects: time range, recurrence type, recurrence days, note — and silently ignores configurable fields.

---

## 5. Database Audit

### 5.1 Schema Quality

| Table | Quality | Notes |
|---|---|---|
| `calendar_events` | ✅ Good | Has `status` enum with all required values, `format`, `room`, `zoom_*`, `cancelled_by/at/reason`, `priority_override` |
| `calendar_availability_slots` | ✅ Good | Has `slot_duration_minutes`, `buffer_minutes`, `access_type`, `min_rank_level`, recurrence fields |
| `calendar_holidays` | ✅ Good | Simple date+name structure |
| `calendar_secretary_access` | ✅ Good | leader_id + secretary_id pivot |
| `calendar_employee_grants` | ✅ Good | user_id + granted_by pivot |
| `calendar_employee_exclusions` | ✅ Good | user_id + excluded_by pivot |
| `calendar_audit_log` | ✅ Schema OK | Migration exists; **model is empty stub; never written to** |
| `calendar_notifications_log` | ✅ Schema excellent | 7 notification types, 3 channels, status, payload; **model is empty stub; never written to** |

### 5.2 Dead Fields

Fields that exist in DB / `$fillable` but are **never set** anywhere in the codebase:

| Table | Field(s) | Issue |
|---|---|---|
| `calendar_events` | `priority_override`, `cancelled_by`, `cancelled_at`, `cancellation_reason` | Never set; required for cancellation audit trail |
| `calendar_events` | `room` | In DB, never captured at creation |
| `calendar_events` | `format` | In DB, hardcoded to 'offline' |
| `calendar_availability_slots` | `slot_duration_minutes`, `buffer_minutes`, `access_type`, `min_rank_level` | In DB, all hardcoded |

### 5.3 Missing Indexes

No performance indexes verified on:
- `calendar_events (organizer_id, starts_at)` — queried on every calendar page load
- `calendar_events (attendee_id, starts_at)` — queried for availability
- `calendar_events (status, starts_at)` — for stats queries

---

## 6. Integrations Audit

### 6.1 Active Directory / LDAP

| Check | Status |
|---|---|
| SSL/TLS connection (port 636) | ✅ |
| LDAP injection prevention (`ldap_escape`) | ✅ |
| Paged results (500/page) | ✅ |
| Attributes fetched: name, email, title, department, room (physicaldeliveryofficename), phone (pager) | ✅ |
| Phone and room synced to `users` table | ⚠️ Not verified in sync code |
| Bind credentials secured | ⚠️ In `.env` plaintext |

### 6.2 WhatsApp Green API

| Check | Status |
|---|---|
| Enabled/disabled flag respected | ✅ |
| Error logging on failure | ✅ |
| `sendMessageToUser()` + `sendMessageToPhone()` | ✅ |
| WhatsApp phone verification | ✅ |
| Notification log written on send | ❌ Never |
| Coverage: new meeting only | ❌ Partial — 4 of 7 notification types missing |

### 6.3 Zoom

| Check | Status |
|---|---|
| Account credentials OAuth | ✅ |
| `createMeeting()` | ✅ |
| `cancelMeeting()` | ❌ Missing |
| `updateMeeting()` | ❌ Missing |
| Webhook handler | ❌ Missing |

### 6.4 Email (Zimbra)

| Check | Status |
|---|---|
| SMTP config for Zimbra | ❌ Missing |
| `MAIL_MAILER=log` | ❌ Emails go to log file only |

---

## 7. Security Audit

### 7.1 Exposed Secrets — HIGH RISK

```
TOPIC_AI_API_KEY=sk-proj-...    # OpenAI key in plaintext .env
AD_BIND_PASSWORD=...            # LDAP bind password in plaintext
GREEN_API_TOKEN=...             # WhatsApp API token in plaintext
ZOOM_ACCOUNT_ID/CLIENT_ID/SECRET # Zoom credentials in plaintext
```

While `.env` is gitignored, these secrets are not rotated, not encrypted at rest, and could be exposed via log injection, server misconfiguration, or accidental commit.

**Recommendation:** Use Laravel `encrypt()` for stored secrets or an external vault (HashiCorp Vault, AWS Secrets Manager).

### 7.2 Rate Limiting — MEDIUM

No rate-limit middleware on any calendar route. An authenticated user can:
- Spam meeting requests to any employee
- Brute-force the suggest-slot endpoint
- Flood conference creation (each call creates a Zoom meeting and sends WhatsApp messages)

**Recommendation:** Apply `throttle:60,1` to mutating calendar routes; stricter limits on Zoom/WhatsApp-triggered endpoints.

### 7.3 Mass Assignment — LOW (mitigated)

All models use explicit `$fillable`. No `guarded = []` detected. Mass assignment is protected.

### 7.4 Authorization Gaps — MEDIUM

- `calendar.events.update` PATCH: checks `is_own` flag on frontend but authorization must also be server-side. Verify that the route closure confirms `organizer_id == auth()->id()`.
- `calendar.events.destroy` DELETE: same concern — verify server-side ownership check.
- `calendar.employees.availability` GET: any calendar-access user can view any employee's full event list (titles, types) — no filtering of private event types.

### 7.5 XSS Risk — LOW (mitigated)

React/Inertia escapes output by default. No `dangerouslySetInnerHTML` usage detected in calendar pages.

### 7.6 LDAP Injection — MITIGATED

`ldap_escape($search, '', LDAP_ESCAPE_FILTER)` used in `ActiveDirectoryAuthenticator`. ✅

---

## 8. Production Launch Blockers (P0)

These issues **must be fixed before any production deployment**:

| ID | Blocker | Why |
|---|---|---|
| B1 | **UTC timezone** (`config/app.php timezone=UTC`) | All slot/event time calculations are wrong for Kazakhstan users. Produces wrong overlaps, wrong stats, wrong suggest-slot results |
| B2 | **No confirm/decline routes** | Meetings are auto-confirmed without attendee consent, violating core workflow |
| B3 | **Hardcoded `format='offline'`** | Online meetings cannot be created from the main calendar — only from Conferences page |
| B4 | **Notification log never written** | Zero observability into notification delivery; impossible to diagnose failures |
| B5 | **Audit log never written** | Zero compliance trail; impossible to investigate disputes |
| B6 | **No cancellation flow** | Delete destroys the record; attendees get no notification; Zoom meeting stays active |
| B7 | **No rate limiting** | Conference creation endpoint can be abused to rack up Zoom API and WhatsApp API costs |
| B8 | **All logic in route closures** | Makes the code untestable; any uncaught exception in one closure affects all routes |
| B9 | **`MAIL_MAILER=log`** | Email notifications silently dropped; users will not receive email confirmations |
| B10 | **Hardcoded test email** in `CalendarMyController` (`yelnurzeinolla1@gmail.com`) | Development artefact; production data leak risk |

---

## 9. Backend Remaining Work

### P0 — Must fix before launch

1. **Fix timezone:** `config/app.php` → `'timezone' => 'Asia/Almaty'`
2. **Add confirm/decline/cancel/reschedule routes** with proper status transitions
3. **Fix event status on creation** — new meetings to attendees should be `pending`, self-events `confirmed`
4. **Implement cancellation:** set `cancelled_by`, `cancelled_at`, `cancellation_reason`; soft-delete or status='cancelled'; call ZoomMeetingService::cancelMeeting()
5. **Write to CalendarNotificationLog** on every WhatsApp/email send attempt
6. **Write to CalendarAuditLog** on every event/slot create/update/delete
7. **Remove hardcoded `yelnurzeinolla1@gmail.com`** from CalendarMyController
8. **Add rate limiting** to mutating calendar routes

### P1 — High priority

9. **Extract all route closure logic** into Service classes (CalendarEventService, CalendarSlotService, CalendarConflictDetector)
10. **Expose slot configuration fields** (duration, buffer, access_type) in slot creation
11. **Fix format/room fields** in event store/update routes
12. **Implement reminder jobs** (60/30/15 min before meetings) via Laravel scheduled commands + queue
13. **Configure Zimbra SMTP** in `config/mail.php` and `.env`
14. **Implement ZoomMeetingService::cancelMeeting() and updateMeeting()**
15. **Add missing DB indexes** on calendar_events(organizer_id, starts_at) and (attendee_id, starts_at)
16. **Fix suggest-slot window** to 08:30–17:30

### P2 — Medium priority

17. **Implement auto-compute of calendar_status** from actual event data
18. **Add rank_level to users** and enforce rank hierarchy in middleware
19. **Expand employee profile data** (phone, room from AD sync)
20. **Admin conference view** (all conferences, not just user's own)

---

## 10. Frontend Remaining Work

### P0 — Must fix before launch

1. **Add format toggle (offline/online)** to CreateEventModal
2. **Add room field** to CreateEventModal and EventModal edit form
3. **Add confirm/decline buttons** in EventModal for attendees
4. **Add cancel button** in EventModal with cancellation reason field
5. **Add phone to employee search** in Employees.jsx

### P1 — High priority

6. **Reschedule flow** — propose new time in EventModal
7. **Employee profile:** display phone, email, room when available
8. **Employee profile:** meeting history tab (past meetings with this person)
9. **Employee directory:** direct "Book meeting" button on each card
10. **Conferences page:** cancel conference button with Zoom cancellation
11. **Settings:** expose slot duration, buffer, access_type fields

### P2 — Medium priority

12. **Analytics:** workload ranking table
13. **Analytics:** export button (CSV)
14. **Analytics:** chart library for visualisation (Recharts is already in package.json — use it)
15. **Notifications feed:** show delivery status (sent/failed) from notification log

---

## 11. Fastest Path to Production

If a strict minimum viable launch is required:

1. **(1 hour)** Fix timezone in `config/app.php`
2. **(2 hours)** Remove hardcoded test email from CalendarMyController
3. **(2 hours)** Add rate limiting to calendar routes
4. **(4 hours)** Fix event creation status: meetings to another person → `pending`; self-events → `confirmed`
5. **(6 hours)** Add basic confirm/decline routes (2 routes, simple status update + WhatsApp notification)
6. **(3 hours)** Add cancellation route with proper field population + WhatsApp notification
7. **(4 hours)** Wire CalendarNotificationLog writes into GreenApiWhatsAppNotifier
8. **(2 hours)** Wire CalendarAuditLog writes at each event mutation
9. **(3 hours)** Add format toggle and room field to event creation form
10. **(2 hours)** Fix suggest-slot window to 08:30–17:30

**Total minimum:** ~29 engineering hours to reach a safe, launchable state.

---

## 12. Final Verdict

The Smart Calendar module **cannot be safely launched in production** in its current state. The UTC timezone bug alone will corrupt all time-based calculations for every Kazakhstan user from day one. The lack of an event status workflow means attendees cannot consent to or reject meetings. The absence of a notification log makes it impossible to know whether critical WhatsApp messages were delivered. The empty audit log makes the system non-compliant for any institutional use.

The codebase has a **solid foundation**: the DB schema is well-designed, the UI shell is clean, the AD and WhatsApp integrations are implemented correctly, and the conflict detection logic is present (even if architecturally misplaced). With focused effort on the P0 issues listed above (~29 hours), the system can reach a launchable state. Full feature completion (P1 + P2) requires an additional 60–80 hours of engineering work.

---

*End of audit — generated from live codebase inspection*
