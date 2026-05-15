# KazUTB Campus AI — Full Technical Report

Audit date: 2026-05-04  
Repository path: `/var/www/laravel-react`  
Repository branch observed: `main`  
Application family observed: Laravel 12 + React 18 + Inertia 2 university CRM / digital services portal.  
Important note: this report is based on the code, configuration, migrations, routes, frontend pages, tests, and build metadata present in this workspace. Runtime-only infrastructure outside the repository, production server configuration, live database contents, and external service consoles were not available unless represented by code or configuration files.

## 1. Project Overview

### 1.1 Purpose

The project is a university digital services platform for KazUTB. In the codebase it is named `CRM KazUTB` in `.env.example`, while the user-facing portal text calls it `KazUTB Platform`. The requested report name uses `KazUTB Campus AI`; the repository itself does not contain that exact application name as a package/project identifier.

The application combines several operational modules:

| Area | Implemented status | Main evidence |
|---|---|---|
| Public service showcase | Implemented | React welcome page, service catalog, localization strings |
| Authentication/profile | Implemented | Laravel Breeze controllers/pages, profile routes, AD optional login service |
| KPI management | Implemented and active | KPI models, controllers, policies, migrations, Inertia pages |
| Calendar / meetings | Implemented | Calendar models, controllers, web routes, Zoom/WhatsApp services |
| Certificates | Implemented | Certificate templates, versions, registry, QR verification, generation routes |
| Diplomas/topic checks | Implemented | Diploma CRUD/import, topic similarity, AI topic review service |
| Tickets / service desk | Implemented | Public ticket submission, admin status management, API endpoints |
| Library loans/reservations/catalog | Implemented | Library loan/reservation models/controllers, external catalog endpoint |
| Navigation routes | Implemented | Public navigation page, admin CRUD, API CRUD |
| HR / Perco attendance | Implemented | Perco controller/API and external Perco DB connection |
| Announcements | Implemented | Model, controller, public/admin APIs, image upload |
| Schedule | PARTIALLY IMPLEMENTED / NOT FOUND as academic timetable | Only welcome/catalog labels and HR time-tracking pages were found; no academic class timetable domain tables were found |
| Booking | PARTIALLY IMPLEMENTED / NOT FOUND as classroom/resource booking | Calendar slots/events and library reservations exist; no classroom/resource booking module was found |
| AI assistant chat | PARTIALLY IMPLEMENTED | Frontend chat component returns static development text; backend AI exists for diploma topic review, not chat |

### 1.2 Intended users

| User group | Likely workflows |
|---|---|
| Students | Login, profile, public service discovery, tickets, certificate viewing/verification, library reservations, diploma-related data if assigned |
| Teachers / PPS | KPI form/entries, diploma supervision/topic checks, calendar meetings, announcements, profile |
| Department heads / HOD | KPI review queue for department, department-scoped approval, user/directory visibility |
| Deans | KPI dean approval queue, faculty-scoped review, calendar access where allowed |
| Structural divisions | Final KPI verification, KPI structural queue, operational back-office workflows |
| Admin | Full management of master data, KPI periods/indicators/access, users, certificates, tickets, navigation, audit logs |
| Superadmin | Read-oriented access appears in KPI policies, but the base roles migration does not seed `superadmin`; code support exists, seeded role NOT FOUND |
| Public/unauthenticated visitors | Welcome page, catalog, navigation, public ticket submission, public library reservation, certificate verification |

### 1.3 Main business capabilities

1. Manage university structure: faculties, departments, divisions, positions, academic years, educational programs.
2. Authenticate users locally or optionally through Active Directory / LDAP.
3. Process KPI periods, indicators, entries, attachments, status logs, analytics, and permission grants.
4. Manage diplomas and check diploma topic similarity, optionally via OpenAI-compatible AI review.
5. Manage calendar availability, meeting requests, secretary delegation, employee grants/exclusions, holidays, and notifications.
6. Generate, issue, revoke, verify, and audit certificates.
7. Accept and administer service tickets.
8. Provide library catalog access, issue books, and process book reservations.
9. Publish announcements with optional images.
10. Expose selected data and operations through Sanctum-protected JSON APIs.

### 1.4 High-level architecture

```text
Browser
	|
	| Web pages: Laravel routes + Inertia props + React pages
	| API calls: JSON routes under /api, Sanctum tokens/stateful SPA auth
	v
Laravel 12 application
	|-- Controllers: module-specific web and API controllers
	|-- Middleware: auth, panel role access, calendar leadership access, Inertia sharing, trusted proxies
	|-- Policies: KPI entry/period authorization
	|-- Services: KPI calculation/analytics/files, AD auth, AI topic review, diploma import, audit logging, Zoom, WhatsApp
	|-- Models: Eloquent domain models
	v
Database layer
	|-- Primary app DB: MySQL expected by .env.example, SQLite fallback in config
	|-- Perco DB: separate MySQL connection for HR/time-tracking
	|-- Database-backed queues/cache/sessions supported
	v
External services
	|-- Active Directory / LDAP
	|-- OpenAI-compatible chat completions for topic review
	|-- Perco attendance database
	|-- Library catalog HTTP API
	|-- Green API WhatsApp
	|-- Zoom OAuth/API
	|-- Mail providers / AWS / Slack config stubs
```

## 2. Tech Stack & Architecture

### 2.1 Runtime versions observed

| Runtime | Version observed | Required/configured |
|---|---:|---|
| PHP | 8.3.6 | `composer.json` requires `^8.2` |
| Laravel framework | 12.53.0 installed | `^12.0` |
| Node.js | 18.19.1 | Vite 7 warns that Node 20.19+ or 22.12+ is expected |
| npm | 9.2.0 | package-lock controls installed versions |
| React | 18.3.1 installed | `^18.2.0` |
| Inertia Laravel | v2.0.21 installed | `^2.0` |
| @inertiajs/react | 2.3.17 installed | `^2.0.0` |
| Vite | 7.3.1 installed | `^7.0.7` |
| Tailwind CSS | 3.4.19 installed | `^3.2.1` |

### 2.2 Backend stack

| Package | Constraint | Purpose |
|---|---:|---|
| `php` | `^8.2` | PHP runtime |
| `laravel/framework` | `^12.0` | MVC framework, routing, Eloquent, validation, queues, mail, config, console |
| `inertiajs/inertia-laravel` | `^2.0` | Server-side Inertia adapter for React SPA-like pages |
| `laravel/sanctum` | `^4.0` | API token/stateful SPA authentication |
| `tightenco/ziggy` | `^2.0` | Exposes Laravel named routes to JavaScript |
| `doctrine/dbal` | `^4.4` | Schema introspection/column changes, required by some migrations |
| `laravel/tinker` | `^2.10.1` | REPL/debug tooling |
| `laravel/breeze` | `^2.3` dev | Auth scaffolding |
| `laravel/pail` | `^1.2.2` dev | Log tailing during development |
| `laravel/pint` | `^1.24` dev | PHP formatting |
| `laravel/sail` | `^1.41` dev | Docker development helper; no Sail compose file was found in repo root |
| `phpunit/phpunit` | `^11.5.3` dev | Tests |
| `fakerphp/faker`, `mockery/mockery`, `nunomaduro/collision` | dev | Factories, mocks, console error output |

### 2.3 Frontend stack

| Package | Constraint | Purpose |
|---|---:|---|
| `react`, `react-dom` | `^18.2.0` | UI rendering |
| `@inertiajs/react` | `^2.0.0` | Inertia React adapter, form/router helpers |
| `vite` | `^7.0.7` | Frontend bundler/dev server |
| `laravel-vite-plugin` | `^2.0.0` | Laravel/Vite integration |
| `@vitejs/plugin-react` | `^4.2.0` | React transform for Vite |
| `tailwindcss` | `^3.2.1` | Utility CSS |
| `@tailwindcss/forms` | `^0.5.3` | Form styling plugin |
| `@tailwindcss/vite` | `^4.0.0` | Tailwind/Vite integration package present alongside Tailwind v3 |
| `postcss`, `autoprefixer` | `^8.4.31`, `^10.4.12` | CSS processing |
| `axios` | `^1.11.0` | HTTP client bootstrap |
| `concurrently` | `^9.0.1` | Development multi-process runner |
| `@headlessui/react` | `^2.0.0` | Accessible unstyled UI primitives |
| Radix packages | dialog/progress/separator/slot/tooltip | shadcn-style UI primitives |
| `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate` | current constraints | UI class composition and animation helpers |
| `lucide-react` | `^0.577.0` | Icons |
| `i18next`, `react-i18next`, `i18next-browser-languagedetector` | current constraints | RU/KK/EN frontend localization |
| `qrcode.react` | `^4.2.0` | QR rendering for certificate/document flows |
| `sonner` | `^2.0.7` | Toast notifications |

### 2.4 Application architecture patterns

| Pattern | Usage |
|---|---|
| Laravel controllers | Most modules use controller actions for web and API endpoints |
| Closure routes | Calendar settings/events/slots and catalog/navigation landing logic include large closures in `routes/web.php` |
| Eloquent models | Domain persistence, relationships, casts, status constants |
| Service layer | KPI calculations, analytics, files; diploma import; topic similarity/AI review; AD auth; audit logs; Zoom; WhatsApp |
| Policies | KPI entries and periods have explicit policy classes |
| Middleware | Panel role gating, calendar leadership access, Inertia shared props, trusted proxy handling |
| Inertia pages | React pages under `resources/js/Pages` receive server props from Laravel |
| shadcn/Radix local UI | Lowercase `resources/js/components/ui` contains local reusable UI components |
| Laravel migrations | 67 migrations define app schema and iterative enum/index updates |
| Database queues/cache/session | Default app config supports DB-backed cache, sessions, queues |

### 2.5 Request flow

```text
Web request
	-> bootstrap/app.php route registration
	-> web middleware stack: TrustProxies, session, CSRF, HandleInertiaRequests, AddLinkHeaders
	-> auth middleware for private routes
	-> EnsurePanelRoleAccess and/or EnsureCalendarLeadershipAccess
	-> Controller or route closure
	-> Eloquent/service layer
	-> Inertia::render(page, props) or redirect/json
	-> React page loaded through Vite-built assets and Ziggy route helper

API request
	-> api middleware stack: TrustProxies, Sanctum stateful API handling
	-> optional auth:sanctum
	-> API controller
	-> JSON response
```

### 2.6 Versioning

| Version source | Value |
|---|---|
| UI footer translation | `1.0.2` |
| Composer project version | NOT FOUND |
| package.json version | NOT FOUND |
| API versioning path | NOT FOUND; all JSON API endpoints are under `/api`, not `/api/v1` |

## 3. Database Schema (Full)

### 3.1 Database engine and connections

| Connection | Driver | Purpose | Config evidence |
|---|---|---|---|
| default app DB | `.env.example` sets MySQL; config fallback is SQLite | Main application tables | `DB_CONNECTION=mysql` in `.env.example`; `config/database.php` supports mysql/mariadb/pgsql/sqlsrv/sqlite |
| `perco` | MySQL | External HR/time-tracking source | `config/database.php` defines `perco` host/database/user/password envs; default host observed in config is `10.0.1.31` |

### 3.2 Current schema by table

| Table | Primary purpose | Main columns | Keys / relationships / indexes |
|---|---|---|---|
| `users` | Auth/profile/directory/calendar/KPI actors | `id`, `name`, `email`, `phone`, `calendar_status`, `password`, `ad_guid`, `ad_login`, `role`, `role_id`, AD profile fields, timestamps | unique `email`, unique `ad_guid`, index `ad_login`; `role_id -> roles`; used by most modules |
| `password_reset_tokens` | Password reset | `email`, `token`, `created_at` | primary `email` |
| `sessions` | Laravel sessions | `id`, `user_id`, `ip_address`, `user_agent`, `payload`, `last_activity` | primary `id`, index `user_id`, index `last_activity` |
| `cache` | Database cache | `key`, `value`, `expiration` | primary `key`, index `expiration` |
| `cache_locks` | Cache lock store | `key`, `owner`, `expiration` | primary `key`, index `expiration` |
| `jobs` | Queue jobs | `id`, `queue`, `payload`, attempts/timestamps | index `queue` |
| `job_batches` | Queue batches | `id`, `name`, counts, job ids, options, timestamps | primary `id` |
| `failed_jobs` | Queue failures | `id`, `uuid`, `connection`, `queue`, `payload`, `exception`, `failed_at` | unique `uuid` |
| `departments` | Academic departments | `id`, `name`, `code`, `description`, timestamps | unique `name`, unique nullable `code`; `faculty_id` added then removed by later migrations |
| `faculties` | Faculties | `id`, `name`, `code`, `description`, timestamps | unique `name`, unique nullable `code` |
| `divisions` | Structural divisions | `id`, `name`, `code`, `description`, timestamps | originally faculty-scoped, later `faculty_id` removed; unique constraints evolved |
| `positions` | Positions under divisions | `id`, `division_id`, `name`, `code`, `description`, timestamps | migrated from department-scoped to `division_id`; unique division/name and division/code |
| `academic_years` | Academic years | `id`, `name`, `start_year`, `end_year`, `is_active`, timestamps | unique `name`, unique `start_year,end_year` |
| `educational_programs` | Degree programs | `id`, `name`, `code`, `degree`, `department_id`, `academic_year_id`, timestamps | `department_id -> departments`, `academic_year_id -> academic_years`, unique name/department/year, unique code |
| `roles` | Role reference table | `id`, `name`, `slug`, timestamps | unique `name`, unique `slug`; seeded `admin`, `student`, `teacher`, `hod` |
| `app_settings` | Key/value settings | `id`, `key`, `value`, timestamps | unique `key`, JSON `value` |
| `diplomas` | Diploma topics/documents | year/semester/faculty/department/program/student/supervisor/title/abstract/keywords/status/file/reference fields | FKs to faculties/departments/programs/users; indexes year/semester, status/reference, normalized title |
| `topic_checks` | Topic similarity check runs | `id`, `diploma_id`, `checked_by`, `checked_at`, `input_title`, `normalized_title`, max score fields | `diploma_id -> diplomas`, `checked_by -> users`, index diploma/date |
| `topic_check_items` | Individual similarity matches | `id`, `topic_check_id`, `matched_diploma_id`, `original_title_ru`, `score`, `match_type`, `risk_level` | FKs to checks/diplomas; index check/score |
| `tickets` | Service desk tickets | `id`, `type`, `building`, `room`, `contact`, `description`, `status`, `submitted_by`, `accepted_by`, `accepted_at`, timestamps | FKs to users, index status/date, index accepted/date |
| `kpi_periods` | KPI period definitions | academic year, name, stage, dates, status, description, created/updated by | FK academic year/users; indexes academic year, stage, status; unique academic year/name |
| `kpi_indicators` | KPI indicator catalog | entity type, section, code, name, description, unit, base points, calculation type, flags, sort order, checker division, scoring rules | FK checker division; indexes entity/section/calculation/active/sort; unique removed and replaced by non-unique composite index |
| `kpi_entries` | KPI submissions | period/year/entity/user/faculty/department/indicator, plan/fact/points/comment/status timestamps, external source URL | FKs to KPI period, academic year, users, faculties, departments, indicators; many indexes; unique per period/user/indicator context |
| `kpi_entry_files` | KPI attachments | `kpi_entry_id`, path/name/disk/type/size, uploaded_by, timestamps | FK KPI entry, FK user; indexes entry, uploader, disk, date |
| `kpi_status_logs` | KPI status audit trail | entry, from/to status, action, comment, acted_by, timestamps | FK entry/user; indexes entry, actor, action, status |
| `kpi_results` | Aggregated KPI scores | period/year/result/entity, user/faculty/department, section scores, k1-k6, formula, rank, metadata, calculated_at | FKs; indexes period/type, year/type, dept/type, faculty/type, user/type, entity/rank; unique result context |
| `kpi_access_grants` | Fine-grained KPI access | user, permission, granted_by, is_active, timestamps | FKs users; unique user/permission; index user/active |
| `audit_logs` | Generic audit events | actor fields, event type, subject type/id/label, description, IP, user agent, metadata, timestamps | FK user; indexes event/date, subject, user/date |
| `holidays` | Generic holiday table | `date`, `name` | primary `date`; separate from calendar holidays |
| `announcements` | News/announcements | title, content, active/important flags, event date, image path, created_by, timestamps | FK creator; indexes active/event date and important |
| `navigation_routes` | Campus navigation cards/routes | badge, title, meta, kind, building, floor, room, steps JSON, map image, active, sort order, timestamps | indexes active, sort order |
| `personal_access_tokens` | Sanctum tokens | tokenable morph, name, token, abilities, last/expires, timestamps | unique token; tokenable morph index, expires index |
| `library_loans` | Library book issue records | book identifiers/title/author/isbn, user, issued_by, issued/due dates, notes, timestamps | FKs users; indexes book_id, legacy_doc_id, isbn |
| `library_reservations` | Library reservation requests | book identifiers/title/author/isbn, user or student fields, source IP, status, review note/date/by, timestamps | FKs users; indexes book_id, isbn, student id/email, source IP, status |
| `certificate_templates` | Certificate template master | name, code, active flag, created_by, updated_by, timestamps | unique code; FKs users; index active/name |
| `certificate_template_versions` | Versioned certificate layouts | template, version, background, canvas dimensions, DPI, layout/text/QR JSON, publish fields, created_by | FK template/user; unique template/version; index template/published |
| `certificate_number_sequences` | Certificate numbering | prefix, year, last_number, timestamps | unique prefix/year |
| `certificates` | Generated certificates | template/version, number, recipient, topic, optional JSON, QR payload, status, file paths, checksum, generated/issued/revoked fields, user refs | FKs templates/versions/users; unique number; indexes status/issued, recipient, created |
| `certificate_generation_batches` | Bulk generation batch | template version, source type/file, total/success/failed counts, status, created_by, timestamps | FK version/user; index status/date |
| `certificate_generation_batch_items` | Batch item results | batch, row number, payload JSON, result certificate, status, error | FKs batch/certificate; index batch/status |
| `certificate_audit_logs` | Certificate audit events | actor, action, entity type/id, meta JSON, created_at | FK actor; indexes entity and action/date |
| `calendar_audit_log` | Calendar audit events | user, acting_for, action, subject type/id, changes, IP, timestamps | FKs users; production indexes subject and user/date |
| `calendar_availability_slots` | Calendar available time slots | user, created_by, date, time range, access type, rank threshold, recurrence, active, note, timestamps | FKs users; recurrence JSON |
| `calendar_events` | Meeting/calendar events | title, description, organizer, attendee nullable, starts/ends, status, format, room, Zoom fields, priority override, cancellation data, type, color, timestamps | FKs users; production indexes organizer/start, attendee/start, status/start |
| `calendar_holidays` | Calendar-specific holidays | date, localized names, active flag, timestamps | active date set; separate from `holidays` |
| `calendar_notifications_log` | Calendar notification attempts | event, user, channel, type, status, sent_at, payload, error, timestamps | FKs event/user; production indexes event/user/type and status/sent |
| `calendar_secretary_access` | Secretary delegation | manager, secretary, active, timestamps | FKs users |
| `calendar_employee_exclusions` | Exclude users from calendar employee list | user, timestamps | FK user, unique user |
| `calendar_employee_grants` | Include/grant calendar employee access | user, timestamps | FK user, unique user |

### 3.3 Migration inventory, every migration found

| # | Migration | Schema effect |
|---:|---|---|
| 1 | `0001_01_01_000000_create_users_table.php` | Creates `users`, `password_reset_tokens`, `sessions` |
| 2 | `0001_01_01_000001_create_cache_table.php` | Creates `cache`, `cache_locks` |
| 3 | `0001_01_01_000002_create_jobs_table.php` | Creates `jobs`, `job_batches`, `failed_jobs` |
| 4 | `2026_03_05_131800_add_ad_columns_to_users_table.php` | Adds `users.ad_guid`, `users.ad_login` |
| 5 | `2026_03_05_170000_add_status_to_users_table.php` | Adds then later superseded `users.status` |
| 6 | `2026_03_05_180000_create_departments_table.php` | Creates `departments` |
| 7 | `2026_03_05_183000_create_academic_years_table.php` | Creates `academic_years` |
| 8 | `2026_03_05_190000_create_educational_programs_table.php` | Creates `educational_programs` |
| 9 | `2026_03_05_200000_create_faculties_table.php` | Creates `faculties` |
| 10 | `2026_03_05_200100_add_faculty_id_to_departments_table.php` | Adds `departments.faculty_id`, removed later |
| 11 | `2026_03_05_201000_create_divisions_table.php` | Creates `divisions` initially faculty-scoped |
| 12 | `2026_03_05_202000_add_role_to_users_table.php` | Adds legacy `users.role` string |
| 13 | `2026_03_05_202100_create_app_settings_table.php` | Creates `app_settings` |
| 14 | `2026_03_05_202200_create_diplomas_table.php` | Creates `diplomas` |
| 15 | `2026_03_05_202300_create_topic_checks_table.php` | Creates `topic_checks` |
| 16 | `2026_03_05_202400_create_topic_check_items_table.php` | Creates `topic_check_items` |
| 17 | `2026_03_10_120000_create_tickets_table.php` | Creates `tickets` |
| 18 | `2026_03_10_130000_create_roles_table.php` | Creates/seeds `roles` with admin/student/teacher/hod |
| 19 | `2026_03_10_131000_add_role_id_to_users_table.php` | Adds `users.role_id`, migrates legacy roles/status |
| 20 | `2026_03_10_132000_drop_status_from_users_table.php` | Drops legacy `users.status` |
| 21 | `2026_03_13_120000_create_kpi_periods_table.php` | Creates `kpi_periods` |
| 22 | `2026_03_13_121000_create_kpi_indicators_table.php` | Creates `kpi_indicators` |
| 23 | `2026_03_13_122000_create_kpi_entries_table.php` | Creates `kpi_entries` |
| 24 | `2026_03_13_123000_create_kpi_entry_files_table.php` | Creates `kpi_entry_files` |
| 25 | `2026_03_13_124000_create_kpi_status_logs_table.php` | Creates `kpi_status_logs` |
| 26 | `2026_03_13_125000_create_kpi_results_table.php` | Creates `kpi_results` |
| 27 | `2026_03_13_130000_create_audit_logs_table.php` | Creates `audit_logs` |
| 28 | `2026_03_17_105044_create_holidays_table.php` | Creates generic `holidays` |
| 29 | `2026_03_18_233347_add_structural_division_to_kpi_enums.php` | Extends KPI enum domain with `structural_division` |
| 30 | `2026_03_18_235742_add_pending_statuses_to_kpi_entries.php` | Adds KPI pending statuses |
| 31 | `2026_03_20_000000_create_announcements_table.php` | Creates `announcements` |
| 32 | `2026_03_20_000001_add_is_important_to_announcements_table.php` | Adds important flag/index |
| 33 | `2026_03_20_000002_replace_published_at_with_event_date_and_image_in_announcements_table.php` | Replaces publish date with event date and image path |
| 34 | `2026_03_23_150000_create_navigation_routes_table.php` | Creates `navigation_routes` |
| 35 | `2026_03_24_045928_create_personal_access_tokens_table.php` | Creates Sanctum `personal_access_tokens` |
| 36 | `2026_03_24_060500_add_ad_profile_columns_to_users_table.php` | Adds AD profile fields to `users` |
| 37 | `2026_03_24_071000_add_ad_department_columns_to_users_table.php` | Adds AD department metadata |
| 38 | `2026_03_24_073000_add_accepted_by_to_tickets_table.php` | Adds ticket acceptance fields |
| 39 | `2026_03_27_120000_create_library_loans_table.php` | Creates `library_loans` |
| 40 | `2026_03_29_120000_add_external_source_url_to_kpi_entries_table.php` | Adds KPI external evidence/source URL |
| 41 | `2026_04_01_100000_create_library_reservations_table.php` | Creates `library_reservations` |
| 42 | `2026_04_03_120000_update_kpi_indicator_unique_index.php` | Changes KPI indicator uniqueness to entity/section/code |
| 43 | `2026_04_03_121000_drop_kpi_indicator_code_unique_index.php` | Drops unique indicator code constraint, keeps index |
| 44 | `2026_04_13_180000_create_certificate_module_tables.php` | Creates all certificate template/registry/batch/audit tables |
| 45 | `2026_04_20_120000_add_ad_division_and_employee_type_to_users_table.php` | Adds AD division and employee type |
| 46 | `2026_04_20_130000_add_ad_title_to_users_table.php` | Adds AD title |
| 47 | `2026_04_23_120000_remove_faculty_id_from_departments_table.php` | Removes department faculty FK |
| 48 | `2026_04_23_120100_remove_faculty_id_from_divisions_table.php` | Removes division faculty FK |
| 49 | `2026_04_23_140000_create_positions_table.php` | Creates positions initially department-scoped |
| 50 | `2026_04_24_090000_switch_positions_to_divisions.php` | Migrates positions from departments to divisions |
| 51 | `2026_04_27_075027_create_calendar_audit_log_table.php` | Creates `calendar_audit_log` |
| 52 | `2026_04_27_075027_create_calendar_availability_slots_table.php` | Creates `calendar_availability_slots` |
| 53 | `2026_04_27_075027_create_calendar_events_table.php` | Creates `calendar_events` |
| 54 | `2026_04_27_075027_create_calendar_holidays_table.php` | Creates `calendar_holidays` |
| 55 | `2026_04_27_075027_create_calendar_notifications_log_table.php` | Creates `calendar_notifications_log` |
| 56 | `2026_04_27_075027_create_calendar_secretary_access_table.php` | Creates `calendar_secretary_access` |
| 57 | `2026_04_27_075743_add_calendar_status_to_users_table.php` | Adds user calendar status |
| 58 | `2026_04_27_080059_add_type_to_calendar_events_table.php` | Adds calendar event type and nullable attendee |
| 59 | `2026_04_27_180000_add_color_to_calendar_events_table.php` | Adds event color |
| 60 | `2026_04_28_000001_create_calendar_employee_exclusions_table.php` | Creates calendar employee exclusions |
| 61 | `2026_04_28_000002_create_calendar_employee_grants_table.php` | Creates calendar employee grants |
| 62 | `2026_04_28_065732_add_phone_to_users_table.php` | Adds user phone |
| 63 | `2026_04_28_120000_add_declined_status_to_calendar_events_and_notifications.php` | Adds declined status/type to calendar enums |
| 64 | `2026_04_28_121000_add_calendar_production_indexes.php` | Adds production indexes for calendar events/notifications/audit |
| 65 | `2026_04_29_000001_add_checker_division_id_to_kpi_indicators_table.php` | Adds KPI checker division FK |
| 66 | `2026_04_30_000002_add_scoring_rules_to_kpi_indicators_table.php` | Adds KPI scoring rules text |
| 67 | `2026_05_04_120435_create_kpi_access_grants_table.php` | Creates `kpi_access_grants` |

### 3.4 Relationships summary

| Relationship area | Relationship notes |
|---|---|
| Users and roles | `users.role_id` belongs to `roles`; legacy `users.role` remains as fallback; `User::resolvedRoleSlug()` prefers relation slug |
| Academic structure | educational programs belong to departments and academic years; positions belong to divisions after migration |
| KPI | entries belong to periods, academic years, users, faculties, departments, indicators; files/logs belong to entries; results aggregate period/year/entity contexts |
| Certificates | template versions belong to templates; certificates belong to template and template version; generation batch items may link to generated certificate |
| Calendar | events link organizer/attendee/cancelled_by users; notifications link events/users; secretary access links manager/secretary users |
| Diplomas | diplomas link faculty/department/program/student/supervisor; topic check items link checks and matched diplomas |
| Library | loans/reservations link users; reservations can also store unauthenticated student identity fields |
| Tickets | public tickets can optionally link submitted_by and accepted_by users |

## 4. Backend Modules

### 4.1 Controller inventory

| Module | Controllers |
|---|---|
| Auth/profile | Breeze auth controllers, `ProfileController` |
| Dashboard | `DashboardController` |
| Academic master data | `AcademicYearController`, `FacultyController`, `DepartmentController`, `DivisionController`, `EducationalProgramController`, `PositionController` |
| Directory/users | `DirectoryUserController`, API `UserController` |
| Announcements | web/API `AnnouncementController` |
| Tickets | web/API `TicketController` |
| KPI | `KpiPeriodController`, `KpiEntryController`, `KpiIndicatorController`, `KpiAccessController`, `KpiAnalyticsController`, legacy `KpiController` |
| Diplomas/topic checking | `DiplomaController` |
| Certificates | `CertificateTemplateController`, `CertificateRegistryController` |
| Calendar | `CalendarMyController`, `CalendarAnalyticsController`, `CalendarConferencesController`, `CalendarEmployeesController`, `CalendarEmployeeProfileController`, `CalendarSettingsController`, plus closure actions |
| Library | `LibraryLoanController`, `LibraryReservationAdminController`, API `LibraryReservationController` |
| Navigation | web/API `NavigationRouteController` |
| HR/Perco | `PercoController`, API `HrPercoController` |
| Audit | `AuditLogController` |

### 4.2 Service inventory

| Service | Purpose |
|---|---|
| `ActiveDirectoryAuthenticator` | Optional LDAP bind/search/login support |
| `AuditLogService` | Generic audit log creation |
| `CalendarAuditLogger` | Calendar-specific audit events |
| `ZoomMeetingService` | Zoom OAuth/API integration for online meetings |
| `GreenApiWhatsAppNotifier` | WhatsApp notification sending through Green API |
| `KpiCalculationService` | KPI score/result calculations |
| `KpiAnalyticsService` | KPI analytics/export data preparation |
| `KpiEntryService` | KPI entry creation/update/status workflow support |
| `KpiPeriodService` | KPI period lifecycle support |
| `KpiEntryFileService` | KPI attachment upload/storage |
| `DiplomaImportService` | CSV import for diploma history |
| `TopicSimilarityService` | Local similarity matching for diploma topics |
| `AiTopicReviewService` | Optional OpenAI-compatible AI review for diploma topic similarity |

### 4.3 Middleware

| Middleware | Purpose |
|---|---|
| `Authenticate` | Laravel authentication wrapper |
| `EnsurePanelRoleAccess` | Role/path gate for private panel routes |
| `EnsureCalendarLeadershipAccess` | Calendar-specific access gate |
| `HandleInertiaRequests` | Shares auth, flash, KPI grants, calendar props with frontend |
| `TrustProxies` | Proxy-aware request handling |
| Sanctum stateful API middleware | SPA/API auth support |

### 4.4 Observers/listeners

| Type | Purpose |
|---|---|
| `LogSuccessfulLogin` listener | Login audit/side effects |
| App service provider observer registrations | Auditing observers are registered for many domain models |
| Calendar audit logger | Records calendar actions with actor/acting-for context |
| Certificate audit log model/table | Records certificate actions |

### 4.5 Console commands

| Command | Purpose |
|---|---|
| `diplomas:import-csv {path}` | Imports diploma history from CSV through `DiplomaImportService` |
| `inspire` | Default Laravel sample command in `routes/console.php` |

### 4.6 Scheduler

NOT FOUND / NOT IMPLEMENTED. No scheduled tasks were found in `routes/console.php`; no scheduler-specific code was identified.

## 5. Frontend Modules

### 5.1 Frontend entry points and build

| File/config | Purpose |
|---|---|
| `resources/js/app.jsx` | Inertia app bootstrap, page resolution, root rendering |
| `resources/js/bootstrap.js` | Axios/bootstrap setup |
| `resources/js/i18n.js` | i18next RU/KK/EN translation resources and language detection |
| `resources/css/app.css` | Tailwind/global styles |
| `vite.config.js` | Laravel Vite + React build configuration |
| `tailwind.config.js` | Tailwind content/theme config |

### 5.2 React pages inventory

| Area | Pages |
|---|---|
| Public/home | `Welcome`, `Catalog`, `Nav/Index` |
| Auth/profile | Login, Register, Forgot/Reset Password, Confirm Password, Verify Email, Profile edit/partials |
| Dashboard | `Dashboard` |
| Academic master data | AcademicYears, Faculties, Departments, Divisions, EducationalPrograms, Positions |
| Directory/users | `Users/Index` |
| Announcements | `Announcements/Index` |
| Tickets | `Tickets/Index`, `Tickets/AdminIndex` |
| KPI | Index, Indicators, Access, Analytics, TeacherDashboard, TeacherForm, EntryShow, ReviewQueue, ApprovalQueue, StructuralQueue, ModerationQueue |
| Diplomas | `Diplomas/Index` |
| Calendar | Index, Shared, Settings, Employees, EmployeeProfile, Analytics, Conferences |
| Certificates | `Certificates/Index`, `Certificates/Show`, `Templates/Index` |
| HR/Perco | Dashboard, Perco, Timetracking, Absence, Late, Early, Overtime, DayEvents, DivisionLatePeople, LateEmployee, Settings |
| Library | Dashboard, IssueBook, ReservationsAdmin |
| Navigation admin | `Nav/AdminRoutes` |
| Audit | `Admin/AuditLogs` |

### 5.3 Component inventory

| Component group | Components |
|---|---|
| Breeze/common | ApplicationLogo, Checkbox, DangerButton, Dropdown, InputError, InputLabel, Modal, NavLink, PrimaryButton, ResponsiveNavLink, SecondaryButton, SiteHeader, TextInput |
| Chat | `ChatBot` |
| shadcn-style UI | `badge`, `button`, `card`, `dialog`, `input`, `label`, `progress`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `textarea`, `tooltip` |

### 5.4 Localization

| Language | Status |
|---|---|
| Russian (`ru`) | Implemented as fallback |
| Kazakh (`kk`) | Implemented; several strings appear machine-translated or typo-prone |
| English (`en`) | Implemented |

Localization is currently concentrated in `resources/js/i18n.js`. It covers welcome/catalog/chat/footer strings, not the entire back-office module surface.

### 5.5 State management

The project does not use Redux, Zustand, MobX, or a custom global store. State is mostly local React state plus Inertia props/forms/router state. This is adequate for the current module structure but creates repeated local patterns across large pages.

## 6. KPI Module (Detailed)

### 6.1 Purpose

The KPI module manages academic performance indicator periods, indicator catalogs, individual/department/faculty entries, attachments, multi-stage review, analytics, exports, and fine-grained access grants.

### 6.2 Data model

| Model | Table | Purpose |
|---|---|---|
| `KpiPeriod` | `kpi_periods` | Period/stage definition |
| `KpiIndicator` | `kpi_indicators` | Indicator catalog |
| `KpiEntry` | `kpi_entries` | Submitted KPI plan/fact data |
| `KpiEntryFile` | `kpi_entry_files` | Evidence files |
| `KpiStatusLog` | `kpi_status_logs` | Status transition history |
| `KpiResult` | `kpi_results` | Aggregated analytics/ranking scores |
| `KpiAccessGrant` | `kpi_access_grants` | Per-user access grants |

### 6.3 KPI entity types

| Entity type | Meaning |
|---|---|
| `teacher` | Teacher/PPS KPI |
| `department_head` | Department head KPI |
| `dean` | Dean KPI |
| `structural_division` | Structural division KPI; added by enum migration |

### 6.4 KPI sections and calculation

| Field | Values / behavior |
|---|---|
| Indicator section | `teaching`, `science`, `social`, `qualification`, `survey` |
| Calculation type | `manual`, `auto`, `formula` |
| Score fields | plan value, fact value, calculated points, manual points |
| Evidence | optional file upload; indicators can require file evidence |
| Extra evidence | `external_source_url` URL up to 2048 chars |
| Scoring rules | `scoring_rules` text on indicators |

### 6.5 KPI statuses

| Status | Meaning |
|---|---|
| `draft` | Editable draft |
| `submitted` | Submitted by owner |
| `returned` | Returned for correction |
| `reviewed` | Reviewed/intermediate status |
| `pending_dean` | Waiting for dean approval |
| `pending_structural` | Waiting for structural division approval |
| `approved` | Final approved |
| `rejected` | Final rejected |
| `locked` | Locked from further edits |

### 6.6 KPI routes

| Method | URI | Name | Purpose |
|---|---|---|---|
| GET | `/kpi` | `kpi.index` | Period list/dashboard |
| POST | `/kpi` | `kpi.store` | Create period |
| GET | `/kpi/{period}` | `kpi.show` | Show period |
| PATCH | `/kpi/{period}` | `kpi.update` | Update period |
| POST | `/kpi/{period}/activate` | `kpi.activate` | Activate period |
| POST | `/kpi/{period}/close` | `kpi.close` | Close period |
| GET | `/kpi/my-form` | `kpi.my-form` | Teacher/user KPI form |
| POST | `/kpi/my-entries` | `kpi.my-entries.store` | Create own entry |
| PATCH | `/kpi/my-entries/{entry}` | `kpi.my-entries.update` | Update own entry |
| DELETE | `/kpi/my-entries/{entry}` | `kpi.my-entries.destroy` | Delete own entry |
| POST | `/kpi/my-entries/{entry}/submit` | `kpi.my-entries.submit` | Submit own entry |
| GET | `/kpi/entries/{entry}` | `kpi.entries.show` | Entry detail |
| POST | `/kpi/entries/{entry}/files` | `kpi.entries.files.store` | Upload evidence file |
| POST | `/kpi/entries/{entry}/review` | `kpi.entries.review` | Review entry |
| POST | `/kpi/entries/{entry}/approve` | `kpi.entries.approve` | Approve entry |
| POST | `/kpi/entries/{entry}/return` | `kpi.entries.return` | Return entry |
| POST | `/kpi/entries/{entry}/reject` | `kpi.entries.reject` | Reject entry |
| GET | `/kpi/review-queue` | `kpi.review-queue` | Department/HOD review queue |
| GET | `/kpi/approval-queue` | `kpi.approval-queue` | Dean/admin approval queue |
| GET | `/kpi/structural-queue` | `kpi.structural-queue` | Structural division queue |
| GET | `/kpi/indicators` | `kpi.indicators.index` | Indicator catalog |
| POST | `/kpi/indicators` | `kpi.indicators.store` | Create indicator |
| PATCH | `/kpi/indicators/{indicator}` | `kpi.indicators.update` | Update indicator |
| POST | `/kpi/indicators/{indicator}/update` | `kpi.indicators.update.post` | POST update fallback used by frontend |
| DELETE | `/kpi/indicators/{indicator}` | `kpi.indicators.destroy` | Delete indicator |
| GET | `/kpi/access` | `kpi.access.index` | KPI grants admin |
| POST | `/kpi/access` | `kpi.access.store` | Create grant |
| PATCH | `/kpi/access/{grant}` | `kpi.access.update` | Update grant |
| DELETE | `/kpi/access/{grant}` | `kpi.access.destroy` | Revoke grant |
| GET | `/kpi/analytics` | `kpi.analytics.index` | Analytics |
| POST | `/kpi/analytics/export/excel` | `kpi.analytics.export-excel` | Export Excel-like report |
| POST | `/kpi/analytics/export/pdf` | `kpi.analytics.export-pdf` | Export PDF-like report |

### 6.7 KPI permissions and policies

| Role/grant | Can view | Can create/update own entries | Can approve/reject | Notes |
|---|---|---|---|---|
| `admin` | yes | yes | yes | Broad KPI management |
| `superadmin` | yes | no | no | Read-only in KPI policies; role seed NOT FOUND |
| `teacher` | own entries | own entries in open period | no | Can access own KPI workflows |
| `hod` / `department_head` | department entries | no | approves submitted to dean stage | Department-scoped by `department_id` |
| `dean` | faculty entries | no | approves pending dean/reviewed to structural stage | Faculty-scoped by `faculty_id` |
| `department` | own structural entries and structural queue | own entries in open period | final approve/reject pending structural | Structural division role name is `department` in code |
| KPI access grants | selected areas | depends on policy/controller | depends on grant | Permissions: review_queue, approval_queue, structural_queue, indicators, analytics, periods |

### 6.8 KPI upload security

KPI file upload validation accepts `file` with max `10240` KB. MIME/type restrictions were NOT FOUND for KPI evidence uploads. This is a security and storage hygiene concern if public/private disk exposure is not tightly controlled.

### 6.9 Recent behavior note

The KPI indicator edit frontend posts to `kpi.indicators.update.post` and reloads `indicators` after success while preserving scroll. The controller redirects back, preserving pagination/filter query state.

## 7. Tickets / Service Desk Module (Detailed)

### 7.1 Purpose

The ticket module accepts facility/support-style requests with type, building, room, contact, description, status, submitter, and acceptance metadata.

### 7.2 Data model

| Table | Columns of interest |
|---|---|
| `tickets` | `type`, `building`, `room`, `contact`, `description`, `status`, `submitted_by`, `accepted_by`, `accepted_at`, timestamps |

### 7.3 Routes

| Surface | Method/URI | Access | Purpose |
|---|---|---|---|
| Web public | GET `/tickets` | public | Ticket submission/list page |
| Web public | POST `/tickets` | public | Create ticket |
| Web admin | GET `/admin/tickets` | authenticated + panel role | Admin list |
| Web admin | PATCH/POST `/admin/tickets/{ticket}/status` | authenticated + panel role | Update status |
| API public | POST `/api/tickets` | public | Create ticket |
| API admin | GET `/api/admin/tickets` | Sanctum | List tickets |
| API admin | GET `/api/admin/tickets/{ticket}` | Sanctum | Show ticket |
| API admin | PATCH `/api/admin/tickets/{ticket}` | Sanctum | Update ticket |
| API protected | POST `/api/tickets/{ticket}/accept` | Sanctum | Accept ticket |

### 7.4 Status workflow

Exact status enum is not database-enforced; the default is `new`. Status validation/rules are implemented in controllers rather than a database enum.

### 7.5 Risks and gaps

| Item | Assessment |
|---|---|
| Public submission | Implemented; spam/rate limiting for `/tickets` was NOT FOUND in route table |
| Attachment support | NOT FOUND |
| Comment thread/history | NOT FOUND |
| SLA/escalation | NOT FOUND |
| Admin acceptance | Implemented through `accepted_by`/`accepted_at` and accept endpoint |

## 8. Справки (Document Requests) Module (Detailed)

### 8.1 Finding

The welcome page contains a `docs` / `Справки` service tile. A dedicated document request workflow for students requesting справки was NOT FOUND as a separate module.

### 8.2 Related implemented document/certificate functionality

| Module | Implemented capability |
|---|---|
| Certificates | Templates, versioned layouts, generation, issue/revoke, registry, verification by certificate number, PDF/PNG path fields, QR payload/checksum |
| Diploma documents | Diploma topic records, CSV import, topic checks, status workflow |
| Public certificate verification | GET `/certificate/verify/{certificateNumber}` |

### 8.3 Certificate routes

| Method | URI | Name | Purpose |
|---|---|---|---|
| GET | `/certificates` | `certificates.index` | Certificate module page |
| GET | `/certificates/{certificate}` | `certificates.show` | Certificate detail |
| GET | `/certificate/verify/{certificateNumber}` | `certificates.verify` | Public verification |
| GET | `/admin/certificates/registry` | `certificates.registry.index` | Registry |
| GET | `/admin/certificates/registry/export` | `certificates.registry.export` | CSV export |
| POST | `/admin/certificates/generate` | `certificates.generate` | Generate certificate(s) |
| POST | `/admin/certificates/{certificate}/issue` | `certificates.issue` | Issue certificate |
| POST | `/admin/certificates/{certificate}/revoke` | `certificates.revoke` | Revoke certificate |
| GET | `/templates` | `templates.index` | Template admin page |
| POST | `/admin/certificate-templates` | `certificate-templates.store` | Create template |
| PATCH | `/admin/certificate-templates/{template}` | `certificate-templates.update` | Update template |
| POST | `/admin/certificate-templates/{template}/toggle-active` | `certificate-templates.toggle-active` | Enable/disable template |
| POST | `/admin/certificate-templates/{template}/versions` | `certificate-templates.versions.store` | Create version |
| POST | `/admin/certificate-template-versions/{version}/publish` | `certificate-template-versions.publish` | Publish version |

### 8.4 Document request gaps

| Expected справки workflow item | Status |
|---|---|
| Student request form for справка | NOT FOUND |
| Request approval queue | NOT FOUND |
| Request statuses and history | NOT FOUND |
| Delivery/download by requester | NOT FOUND as request flow; certificate show/verify exists |
| Document type catalog for справки | NOT FOUND; certificate templates are present |

## 9. Бронирование (Booking) Module (Detailed)

### 9.1 Finding

The welcome page contains a booking tile. A general classroom/meeting-room/resource booking module was NOT FOUND as a separate domain. Two adjacent features exist: calendar meeting slots/events and library book reservations.

### 9.2 Implemented adjacent booking-like features

| Feature | Data model | Routes |
|---|---|---|
| Calendar availability / meeting requests | `calendar_availability_slots`, `calendar_events` | `/calendar/slots`, `/calendar/events`, `/calendar/events/{event}/confirm|decline|cancel|reschedule` |
| Library reservations | `library_reservations` | `/api/library/reservations`, `/admin/library/reservations`, approve/reject routes |

### 9.3 Missing generalized booking pieces

| Expected booking item | Status |
|---|---|
| Resource inventory for rooms/equipment | NOT FOUND |
| Booking calendar by resource | NOT FOUND |
| Conflict constraints by physical room/resource | NOT FOUND outside calendar attendee availability |
| Approval workflow for room/resource booking | NOT FOUND |
| Recurring classroom/resource booking | NOT FOUND |

## 10. Расписание (Schedule) Module (Detailed)

### 10.1 Finding

The welcome page includes `schedule` and study-related labels, and HR pages include Perco time-tracking. A student/teacher academic timetable module with lessons, groups, subjects, classrooms, and timetable imports was NOT FOUND.

### 10.2 Existing schedule-adjacent areas

| Area | Implemented |
|---|---|
| Calendar | Personal/leadership meeting schedule, availability, shared calendar |
| HR/Perco | Employee attendance/time-tracking reports |
| Academic master data | Faculties/departments/programs/academic years but no class schedule tables |

### 10.3 Missing timetable entities

| Expected entity | Status |
|---|---|
| Courses/subjects | NOT FOUND |
| Student groups | NOT FOUND |
| Lessons/classes | NOT FOUND |
| Classroom timetable | NOT FOUND |
| Schedule import/export | NOT FOUND |
| Teacher/student timetable views | NOT FOUND |

## 11. AI Assistant ("AI Помощник")

### 11.1 Frontend chat assistant

The visible AI assistant in the public UI is implemented as `ChatBot`. Localization strings show an initial greeting and a static response: the assistant says it is processing the request and that the feature is under development. No backend chat endpoint, conversation table, message persistence, RAG pipeline, or tool invocation was found for this chat assistant.

Status: PARTIALLY IMPLEMENTED / BACKEND NOT IMPLEMENTED.

### 11.2 Implemented AI-related backend

| Service | Purpose |
|---|---|
| `TopicSimilarityService` | Local deterministic topic similarity checks for diploma titles |
| `AiTopicReviewService` | Optional OpenAI-compatible review of diploma topics |
| `services.topic_ai` config | `enabled`, `endpoint`, `model`, `api_key`, `timeout` |

### 11.3 AI configuration

| Env var | Default/example | Purpose |
|---|---|---|
| `TOPIC_AI_ENABLED` | `false` | Enables AI topic review |
| `TOPIC_AI_ENDPOINT` | `https://api.openai.com/v1/chat/completions` | OpenAI-compatible endpoint |
| `TOPIC_AI_MODEL` | `gpt-4o-mini` | Model name |
| `TOPIC_AI_API_KEY` | empty | API credential |
| `TOPIC_AI_TIMEOUT` | `15` | Request timeout seconds |

### 11.4 AI gaps

| Expected assistant capability | Status |
|---|---|
| Backend chat endpoint | NOT FOUND |
| Conversation/message tables | NOT FOUND |
| Knowledge base ingestion/search | NOT FOUND |
| Auth-aware service actions | NOT FOUND |
| Safety/moderation logging | NOT FOUND |

## 12. Navigation Module

### 12.1 Purpose

The navigation module stores route cards for campus locations: cabinet/staff/department-like navigation entries with badges, titles, metadata, building, floor, room, steps JSON, map image path, active flag, and sort order.

### 12.2 Data model

| Table | Columns |
|---|---|
| `navigation_routes` | `badge`, `title`, `meta`, `kind`, `building`, `floor`, `room`, `steps`, `map_image_path`, `is_active`, `sort_order` |

### 12.3 Routes

| Surface | Method/URI | Access | Purpose |
|---|---|---|---|
| Public web | GET `/nav` | public | Navigation page |
| Admin web | GET `/admin/nav-routes` | authenticated panel | Admin list page |
| Admin web | POST `/admin/nav-routes` | authenticated panel | Create route |
| Admin web | PATCH `/admin/nav-routes/{navigationRoute}` | authenticated panel | Update route |
| Admin web | DELETE `/admin/nav-routes/{navigationRoute}` | authenticated panel | Delete route |
| Public API | GET `/api/nav/routes` | public | List active routes |
| Public API | GET `/api/nav/routes/{navigationRoute}` | public | Show route |
| Admin API | POST `/api/admin/nav/routes` | Sanctum | Create route |
| Admin API | PATCH `/api/admin/nav/routes/{navigationRoute}` | Sanctum | Update route |
| Admin API | DELETE `/api/admin/nav/routes/{navigationRoute}` | Sanctum | Delete route |

### 12.4 Missing/gaps

| Feature | Status |
|---|---|
| Geospatial map coordinates | NOT FOUND |
| Indoor pathfinding algorithm | NOT FOUND |
| Route graph model | NOT FOUND |
| Map image upload route | `map_image_path` exists; dedicated upload workflow not confirmed |

## 13. User & Profile Management

### 13.1 Authentication modes

| Mode | Status |
|---|---|
| Local email/password | Implemented via Laravel Breeze |
| Email verification | Implemented routes/controllers |
| Password reset/update/confirmation | Implemented routes/controllers |
| Active Directory / LDAP | Optional via `AD_ENABLED` and `ActiveDirectoryAuthenticator` |
| Sanctum API auth | Implemented for protected API endpoints |

### 13.2 User profile fields

| Field group | Fields |
|---|---|
| Core auth | name, email, password, email_verified_at |
| Contact | phone |
| Roles | legacy role string, role_id relation |
| Calendar | calendar_status |
| AD identity | ad_guid, ad_login |
| AD profile | first_name, last_name, initials, display_name, ad_description, room, ad_department, ad_department_number, ad_division, ad_employee_type, ad_title |

### 13.3 Role model

Seeded roles:

| Slug | Name |
|---|---|
| `admin` | Admin |
| `student` | Student |
| `teacher` | Teacher |
| `hod` | HOD |

Additional role slugs used by application logic:

| Slug | Usage status |
|---|---|
| `department_head` | Used as HOD equivalent in KPI/panel access |
| `dean` | Used in KPI review/approval |
| `department` | Used for structural division users |
| `superadmin` | Used as read-only KPI role and panel-wide admin role, but seed NOT FOUND |

### 13.4 Access control

| Layer | Behavior |
|---|---|
| Route middleware | Most private pages use `auth` and `EnsurePanelRoleAccess` |
| Calendar middleware | Calendar pages also use `EnsureCalendarLeadershipAccess` |
| Policies | KPI entries and periods have policy-level authorization |
| Inertia shared props | Auth user, role/grants, flash messages, calendar props shared globally |
| API | Protected endpoints use `auth:sanctum` |

### 13.5 User directory

Directory routes exist for `/users`, `/students`, manual user creation, and position updates. Admin user search closure exists under `/admin/users/search`.

## 14. Admin Panel

### 14.1 Admin capabilities by route/module

| Capability | Routes/pages |
|---|---|
| Audit logs | `/admin/audit-logs` |
| Certificates registry/templates | `/admin/certificates/*`, `/templates`, `/admin/certificate-templates/*` |
| Library reservation moderation | `/admin/library/reservations` |
| Navigation routes CRUD | `/admin/nav-routes` |
| Tickets moderation | `/admin/tickets` |
| User search | `/admin/users/search` |
| KPI periods/indicators/access/analytics | `/kpi*` routes gated by panel middleware/policies |
| Master data | faculties, departments, divisions, positions, academic years, educational programs |
| Announcements | `/announcements` CRUD |
| HR/Perco | `/hr/*` |

### 14.2 Admin frontend pages

| Page | Purpose |
|---|---|
| `Admin/AuditLogs.jsx` | Audit log viewer |
| `Tickets/AdminIndex.jsx` | Ticket admin |
| `Library/ReservationsAdmin.jsx` | Library reservation moderation |
| `Nav/AdminRoutes.jsx` | Navigation route admin |
| `Templates/Index.jsx` | Certificate template management |
| KPI admin pages | periods, indicators, access grants, analytics, queues |

### 14.3 Admin API

Admin JSON APIs exist for auth login, users, tickets, navigation routes, and library reservations. They use Sanctum except `/api/admin/login`.

## 15. Notifications & Communications

### 15.1 Channels found

| Channel | Status |
|---|---|
| Laravel mail | Configured; default `.env.example` uses `log` mailer |
| Password reset/email verification | Implemented through Laravel auth |
| WhatsApp / Green API | Service and config present for calendar notifications |
| Calendar notification log | Table stores channel/type/status/payload/error |
| Zoom meeting integration | Service/config present for online calendar events |
| Slack | Config stub present in `config/services.php`, usage NOT FOUND |
| Browser push/WebSockets | NOT FOUND |

### 15.2 Calendar notification types

`calendar_notifications_log` supports notification types: `new_request`, `confirmed`, `cancelled`, `reminder_60`, `reminder_30`, `reminder_15`, `rescheduled`, with later migration adding declined support.

### 15.3 Announcement communications

Announcements include title/content, active/important flags, event date, image path, and public/API exposure.

## 16. Security

### 16.1 Authentication and sessions

| Area | Status |
|---|---|
| Web auth | Session-based Laravel guard |
| API auth | Sanctum protected endpoints |
| CSRF | Web middleware stack includes standard Laravel CSRF for web forms |
| Password hashing | Laravel default hashing through Breeze/User model |
| Email verification | Implemented for dashboard access via `verified` middleware |
| AD TLS | `AD_REQUIRE_CERT` default true; LDAP over 636 default |

### 16.2 Authorization

| Layer | Notes |
|---|---|
| Panel route gate | `EnsurePanelRoleAccess` is central path/role gate |
| KPI policies | Stronger domain-specific authorization for KPI entries/periods |
| Calendar gate | Dedicated calendar leadership access middleware |
| Sanctum | API token auth for protected APIs |
| Public routes | `/tickets`, `/nav`, `/catalog`, certificate verification, public announcement APIs, public library reservation API are intentionally public based on routes |

### 16.3 Input validation and uploads

| Upload area | Validation found |
|---|---|
| Announcements | image, max 5120 KB, stored on public disk |
| Certificate template backgrounds | image, max 10240 KB, stored under `certificates/templates` on public disk |
| Diploma import | required file, mimes csv/txt |
| KPI files | required/nullable file, max 10240 KB; MIME allowlist NOT FOUND |

### 16.4 Auditability

| Audit table/service | Scope |
|---|---|
| `audit_logs` / `AuditLogService` | Generic model/user actions |
| `calendar_audit_log` / `CalendarAuditLogger` | Calendar actions with acting-for support |
| `certificate_audit_logs` | Certificate actions |
| `kpi_status_logs` | KPI status transition audit |

### 16.5 Security concerns and recommendations

| Severity | Finding | Recommendation |
|---|---|---|
| High | KPI evidence uploads accept any file type up to 10 MB | Add MIME/extension allowlist, private disk where possible, download authorization, antivirus scanning for production |
| Medium | Public ticket and library reservation endpoints have no route-level throttle in the route table | Add throttling, CAPTCHA or abuse controls if exposed publicly |
| Medium | `superadmin`, `dean`, `department_head`, `department` roles are used in code but not all seeded in base roles migration | Add idempotent role seeder/migration or document external role provisioning |
| Medium | `.env.example` omits several env vars used by services (`LIBRARY_CATALOG_*`, `GREEN_API_*`, `ZOOM_*`, Postmark/Resend/Slack) | Update environment documentation |
| Medium | Calendar write logic includes large route closures | Move complex logic to controllers/services for auditability/testability |
| Low | Public config defaults include internal IPs in config defaults | Prefer env-only examples/documentation for production network details |
| Low | Node 18 is below Vite 7 recommended engine | Upgrade Node to 20.19+ or 22.12+ in deployment/build environment |

## 17. Configuration & Environment

### 17.1 `.env.example` variables

| Variable | Purpose |
|---|---|
| `APP_NAME` | Application display name, example `CRM KazUTB` |
| `APP_ENV` | Laravel environment |
| `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Primary database connection |
| `CACHE_PREFIX` | Optional cache key prefix, commented |
| `MEMCACHED_HOST` | Memcached host if used |
| `REDIS_CLIENT`, `REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_PORT` | Redis config if Redis is used |
| `MAIL_MAILER`, `MAIL_SCHEME`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Mail configuration |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_BUCKET`, `AWS_USE_PATH_STYLE_ENDPOINT` | S3/AWS filesystem/mail support |
| `VITE_APP_NAME` | Frontend-exposed app name |
| `AD_ENABLED`, `AD_HOST`, `AD_PORT`, `AD_USE_SSL`, `AD_TIMEOUT`, `AD_BIND_DN`, `AD_BIND_PASSWORD`, `AD_BASE_DN`, `AD_LOGIN_FIELD`, `AD_USER_FILTER`, `AD_REQUIRE_CERT` | Active Directory / LDAP configuration |
| `TOPIC_AI_ENABLED`, `TOPIC_AI_ENDPOINT`, `TOPIC_AI_MODEL`, `TOPIC_AI_API_KEY`, `TOPIC_AI_TIMEOUT` | AI topic review configuration |

### 17.2 Additional env vars referenced in config but missing from `.env.example`

| Variable group | Missing examples |
|---|---|
| Library catalog | `LIBRARY_CATALOG_ENDPOINT`, `LIBRARY_CATALOG_TIMEOUT` |
| Green API | `GREEN_API_ENABLED`, `GREEN_API_BASE_URL`, `GREEN_API_INSTANCE_ID`, `GREEN_API_API_TOKEN_INSTANCE` |
| Zoom | `ZOOM_ENABLED`, `ZOOM_OAUTH_BASE_URL`, `ZOOM_BASE_URL`, `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_USER_ID` |
| Mail providers | `POSTMARK_API_KEY`, `RESEND_API_KEY` |
| Slack | `SLACK_BOT_USER_OAUTH_TOKEN`, `SLACK_BOT_USER_DEFAULT_CHANNEL` |
| Queue/cache/session optional values | `QUEUE_CONNECTION`, `DB_QUEUE_*`, Redis/SQS vars, session vars depending deployment |
| Perco | Perco connection envs from `config/database.php` should be documented in `.env.example` |

### 17.3 Defaults by Laravel config

| Config | Default observed |
|---|---|
| Queue | `database` |
| Cache | database-backed default in current Laravel config style |
| Filesystem | `local`; public disk configured for `/storage` symlink |
| Mail | `.env.example` uses `log` |
| Session | Laravel config file present; web app uses session auth |
| API stateful auth | Sanctum stateful API middleware enabled |



## 18. API Documentation

### 18.1 Route totals

| Metric | Count |
|---|---:|
| Registered Laravel routes | 204 |
| Primary API namespace | `/api` |
| Web routing style | Named Laravel routes + Inertia pages |
| API auth style | Sanctum for protected endpoints |

### 18.2 Public and protected JSON API routes

| Method | URI | Controller action | Auth | Purpose |
|---|---|---|---|---|
| POST | `/api/login` | `Api\AuthController@login` | public | User API login |
| POST | `/api/admin/login` | `Api\AdminAuthController@login` | public | Admin API login |
| POST | `/api/logout` | `Api\AuthController@logout` | Sanctum | Logout/revoke session/token |
| GET | `/api/me` | `Api\AuthController@me` | Sanctum | Current API user |
| GET | `/api/announcements` | `Api\AnnouncementController@index` | public | List announcements |
| GET | `/api/announcements/{announcement}` | `Api\AnnouncementController@show` | public | Announcement detail |
| POST | `/api/announcements` | `Api\AnnouncementController@store` | Sanctum | Create announcement |
| PATCH | `/api/announcements/{announcement}` | `Api\AnnouncementController@update` | Sanctum | Update announcement |
| DELETE | `/api/announcements/{announcement}` | `Api\AnnouncementController@destroy` | Sanctum | Delete announcement |
| GET | `/api/departments` | `Api\DepartmentController@index` | Sanctum | Department list |
| GET | `/api/hr/perco` | `Api\HrPercoController@index` | Sanctum | Perco HR data |
| GET | `/api/nav/routes` | `Api\NavigationRouteController@index` | public | Public navigation list |
| GET | `/api/nav/routes/{navigationRoute}` | `Api\NavigationRouteController@show` | public | Public navigation detail |
| POST | `/api/admin/nav/routes` | `Api\NavigationRouteController@store` | Sanctum | Create navigation route |
| PATCH | `/api/admin/nav/routes/{navigationRoute}` | `Api\NavigationRouteController@update` | Sanctum | Update navigation route |
| DELETE | `/api/admin/nav/routes/{navigationRoute}` | `Api\NavigationRouteController@destroy` | Sanctum | Delete navigation route |
| POST | `/api/tickets` | `Api\TicketController@store` | public | Submit ticket |
| POST | `/api/tickets/{ticket}/accept` | `Api\TicketController@accept` | Sanctum | Accept ticket |
| GET | `/api/admin/tickets` | `Api\TicketController@index` | Sanctum | Admin ticket list |
| GET | `/api/admin/tickets/{ticket}` | `Api\TicketController@show` | Sanctum | Admin ticket detail |
| PATCH | `/api/admin/tickets/{ticket}` | `Api\TicketController@update` | Sanctum | Admin ticket update |
| GET | `/api/admin/users` | `Api\UserController@index` | Sanctum | Admin users list |
| POST | `/api/library/reservations` | `Api\LibraryReservationController@store` | public | Create library reservation |
| GET | `/api/admin/library/reservations` | `Api\LibraryReservationController@index` | Sanctum | Admin reservations list |
| GET | `/api/admin/library/reservations/{reservation}` | `Api\LibraryReservationController@show` | Sanctum | Reservation detail |
| POST | `/api/admin/library/reservations/{reservation}/approve` | `Api\LibraryReservationController@approve` | Sanctum | Approve reservation |
| POST | `/api/admin/library/reservations/{reservation}/reject` | `Api\LibraryReservationController@reject` | Sanctum | Reject reservation |

### 18.3 Main web route groups

| Group | Representative endpoints | Middleware |
|---|---|---|
| Public | `/`, `/catalog`, `/nav`, `/tickets`, `/certificate/verify/{certificateNumber}`, `/api/* public routes`, `/up` | web or api |
| Auth | `/login`, `/register`, password reset, email verification, `/logout` | Breeze auth/guest/verified/throttle middleware |
| Dashboard/profile | `/dashboard`, `/profile` | auth, verified/profile gate |
| Master data | `/academic-years`, `/faculties`, `/departments`, `/divisions`, `/positions`, `/educational-programs` | auth + panel role access |
| KPI | `/kpi`, `/kpi/my-form`, queues, entries, indicators, access, analytics | auth + panel role access + policies |
| Calendar | `/calendar`, `/calendar/shared`, settings, employees, events, slots, grants, exclusions, holidays, conferences, analytics | auth + panel role access + calendar access; write routes throttled |
| Certificates | `/certificates`, `/templates`, `/admin/certificate-*` | auth + panel role access except public verification |
| Library | `/library/dashboard`, `/library/catalog`, `/library/issue-book`, `/admin/library/reservations` | auth + panel role access; reservation API public/protected split |
| HR | `/hr/dashboard`, `/hr/perco*`, `/hr/division-late-people` | auth + panel role access |
| Tickets admin | `/admin/tickets`, `/admin/tickets/{ticket}/status` | auth + panel role access |
| Navigation admin | `/admin/nav-routes` CRUD | auth + panel role access |
| Announcements | `/announcements` CRUD | auth + panel role access |
| Audit | `/admin/audit-logs` | auth + panel role access |

### 18.4 Response conventions

| Surface | Convention |
|---|---|
| Web success/failure | Redirects with session flash props shared to Inertia |
| Validation errors | Laravel validation redirects or JSON errors depending request expectations |
| API unauthorized | `bootstrap/app.php` renders JSON `{"message":"Unauthorized"}` with 401 for API/JSON requests |
| API data shape | Controller-specific; no global API resource standard was found across all endpoints |
| API versioning | NOT FOUND |

## 19. Codebase Statistics

### 19.1 File and line counts

| Metric | Count |
|---|---:|
| PHP files in app/database/routes/tests/config/bootstrap | 233 |
| React JSX files | 111 |
| JS files under resources/js | 4 |
| CSS files under resources/css | 3 |
| Controllers | 50 |
| Models | 40 |
| Migrations | 67 |
| React pages | 64 |
| React components including shadcn-style UI | 29 |
| PHP tests | 12 |
| Approximate LOC in app/database/routes/resources/config/bootstrap/tests | 51,665 |
| Registered routes | 204 |

### 19.2 Backend model inventory

| Domain | Models |
|---|---|
| Core/admin | User, Role, AuditLog, AppSetting |
| Academic structure | AcademicYear, Faculty, Department, Division, Position, EducationalProgram |
| Announcements/tickets | Announcement, Ticket |
| Diplomas/topics | Diploma, TopicCheck, TopicCheckItem |
| KPI | KpiPeriod, KpiIndicator, KpiEntry, KpiEntryFile, KpiStatusLog, KpiResult, KpiAccessGrant |
| Calendar | CalendarEvent, CalendarAvailabilitySlot, CalendarHoliday, CalendarSecretaryAccess, CalendarNotificationLog, CalendarAuditLog, CalendarEmployeeExclusion, CalendarEmployeeGrant |
| Certificates | CertificateTemplate, CertificateTemplateVersion, CertificateNumberSequence, Certificate, CertificateGenerationBatch, CertificateGenerationBatchItem, CertificateAuditLog |
| Library | LibraryLoan, LibraryReservation |
| Navigation | NavigationRoute |



## 20. Known Issues / TODO / FIXME

### 20.1 TODO/FIXME scan

No meaningful TODO/FIXME/HACK markers were found in the code scan. One `XXX`-like hit was a false positive placeholder pattern in phone-related UI, not an actionable code TODO.

### 20.2 Known issues and architecture risks

| Severity | Issue | Detail |
|---|---|---|
| High | Node version mismatch with Vite 7 | `npm run build` succeeds but warns current Node 18.19.1 is below Vite's required/recommended Node 20.19+ or 22.12+ |
| High | KPI file MIME restrictions missing | Any file type can be uploaded as KPI evidence up to 10 MB |
| Medium | Several role slugs used but not seeded | `superadmin`, `dean`, `department_head`, `department` appear in code but are not in the roles seed migration |
| Medium | `.env.example` incomplete for integrations | Library catalog, Green API, Zoom, Perco, Slack/Postmark/Resend examples are missing despite config usage |
| Medium | Calendar route closures are large | Business logic in `routes/web.php` reduces testability and maintainability |
| Medium | Public endpoints need abuse controls review | Public tickets and library reservations are useful but need rate limiting/spam controls in production |
| Medium | Schedule, booking, справки are not full modules | UI advertises these categories, but dedicated implementations are missing/partial |
| Low | Project metadata still skeleton-like | Composer name/description remain `laravel/laravel` skeleton defaults |
| Low | Localization quality inconsistent | Some Kazakh/Russian strings contain typos or mixed languages |
| Low | No CI workflow found | `.github/workflows` was not identified in the workspace summary; automated checks should be added |

## 21. Tests

### 21.1 Existing coverage

| Area | Coverage status |
|---|---|
| Auth/profile | Covered by Breeze-style feature tests |
| Calendar | One calendar workflow feature test exists |
| Topic similarity | Unit test exists |
| KPI | Dedicated KPI feature/unit tests NOT FOUND |
| Tickets | Dedicated tests NOT FOUND |
| Certificates | Dedicated tests NOT FOUND |
| Library | Dedicated tests NOT FOUND |
| Navigation | Dedicated tests NOT FOUND |
| HR/Perco | Dedicated tests NOT FOUND |
| API auth/permissions | Broad dedicated API tests NOT FOUND |

### 21.2 Test command

```bash
composer test
```

The script clears config and runs `php artisan test`.

### 21.3 Recommended test additions

| Priority | Tests to add |
|---|---|
| High | KPI entry lifecycle: draft -> submitted -> pending_dean -> pending_structural -> approved/rejected |
| High | KPI indicator CRUD, pagination preservation, POST update fallback |
| High | Role access matrix for `EnsurePanelRoleAccess` and KPI policies |
| High | Public endpoint abuse/validation tests for tickets and library reservations |
| Medium | Certificate generation/issue/revoke/verify tests |
| Medium | Calendar event conflict, secretary access, slot recurrence, notification logging |
| Medium | Navigation API public/admin CRUD |
| Medium | AD disabled/enabled login behavior with mocked LDAP |
| Low | Localization smoke tests for public pages |

## 22. Deployment & Infrastructure

### 22.1 Build/deploy assumptions from repo

| Area | Observed status |
|---|---|
| PHP dependency install | Composer-based |
| Frontend dependency install | npm-based |
| Frontend production assets | `npm run build` writes to `public/build` |
| Public entry point | `public/index.php` |
| Health check | `/up` route configured by Laravel bootstrap |
| Storage symlink | `public/storage` exists in workspace; public disk maps to `storage/app/public` |
| Queue worker | `composer dev` runs `php artisan queue:listen`; production supervisor config NOT FOUND |
| Web server config | Nginx/Apache config NOT FOUND in repo |
| Docker | `laravel/sail` dependency present; Dockerfile/docker-compose NOT FOUND in root summary |
| CI/CD | Workflow files NOT FOUND |

For existing production deployments, do not overwrite `.env` and run migrations/builds through the team's release process.

### 22.3 Required services for production

| Service | Required when |
|---|---|
| Primary database | Always |
| Queue backend/worker | Needed for async work if queued jobs are introduced/used |
| Public filesystem/storage | Needed for images, certificate backgrounds/output, KPI files |
| Mail transport | Needed for password reset/email verification/notifications beyond log mode |
| Active Directory | Needed if AD login is enabled |
| Perco DB | Needed for HR attendance/time tracking |
| Library catalog API | Needed for library catalog/reservation workflows depending on catalog data |
| Green API | Needed for WhatsApp calendar notifications |
| Zoom API | Needed for online meeting generation |
| OpenAI-compatible endpoint | Needed for AI topic review if enabled |

## Appendix A. Route Inventory Summary

The canonical full route table is reproducible with:

```bash
php artisan route:list
php artisan route:list --json
```

The audit run observed 204 registered routes. The complete API route table is included in section 18.2. The complete web route surface is covered by module route tables in sections 6, 8, 12, 14, and 18.3. Notable route protections:

| Route family | Protection |
|---|---|
| `/kpi*` | `web`, `auth`, `EnsurePanelRoleAccess`, plus KPI policies where invoked |
| `/calendar*` | `web`, `auth`, `EnsurePanelRoleAccess`, `EnsureCalendarLeadershipAccess`; write routes throttled |
| `/admin/*` | generally `web`, `auth`, `EnsurePanelRoleAccess` |
| `/api/admin/*` | `api`, `auth:sanctum` except `/api/admin/login` |
| `/api/me`, `/api/logout` | `api`, `auth:sanctum` |
| Public service routes | `/`, `/catalog`, `/nav`, `/tickets`, `/certificate/verify/{certificateNumber}`, selected `/api/*` routes |

## Appendix B. Module Implementation Matrix

| Module | DB | Backend | Frontend | API | Tests | Overall status |
|---|---|---|---|---|---|---|
| Auth/profile | yes | yes | yes | partial | yes | Implemented |
| Academic master data | yes | yes | yes | departments only | no dedicated | Implemented |
| Users/directory | yes | yes | yes | admin users | no dedicated | Implemented |
| Announcements | yes | yes | yes | yes | no dedicated | Implemented |
| Tickets | yes | yes | yes | yes | no dedicated | Implemented |
| KPI | yes | yes | yes | no separate JSON API | no dedicated | Implemented, needs tests |
| Diplomas/topic checks | yes | yes | yes | no separate JSON API | topic unit only | Implemented |
| Certificates | yes | yes | yes | public verify web | no dedicated | Implemented |
| Calendar | yes | yes | yes | no separate JSON API | one workflow | Implemented |
| Library | yes | yes | yes | reservations API | no dedicated | Implemented |
| Navigation | yes | yes | yes | yes | no dedicated | Implemented |
| HR/Perco | external + app | yes | yes | yes | no dedicated | Implemented |
| AI chat assistant | no | no | static component | no | no | PARTIALLY IMPLEMENTED |
| Schedule/timetable | no | no | labels only | no | no | NOT IMPLEMENTED |
| Generic booking | partial calendar/library | partial adjacent | labels/adjacent pages | partial | no | PARTIALLY IMPLEMENTED |
| Справки requests | certificate adjacent | certificate adjacent | labels/cert pages | no request API | no | PARTIALLY IMPLEMENTED / request workflow NOT FOUND |
