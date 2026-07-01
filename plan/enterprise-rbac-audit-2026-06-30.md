# Enterprise Architecture, Security & RBAC Audit

Audit date: 2026-06-30  
Scope: DEV `/var/www/laravel-react-dev`, PROD `/var/www/laravel-react`  
Primary evidence base: source code, routes, migrations, config, local Git state, filtered file comparison.

## Executive Summary

The DEV and PROD application source trees are currently much closer than the Git branches imply. After excluding generated/runtime directories (`.git`, `vendor`, `node_modules`, `storage`, `bootstrap/cache`, `public/build`, `public/assets`, `backups`), common application/config/migration/package files are byte-identical except `.env` and three deployment scripts. PROD is on `main` and behind origin by two commits, but its working tree contains uncommitted certificate-operator role changes that make `app/`, `routes/`, and `resources/js/` match DEV at the file-content level.

The system already contains several pieces of a target enterprise model: governance access requests with pending/approved/effective values, scoped grants, delegations, org unit mappings, employee/student profile tables, and Platonus scaffolding. However, effective authorization is still split across legacy roles, `users.role`, `roles`, `kpi_access_grants`, controller checks, route closures, AD-derived fields, hardcoded email allowlists, and frontend visibility logic.

The most urgent issues are:

| Severity | Finding |
|---|---|
| Critical | Authenticated API users can create/update/delete announcements without an admin or permission check. |
| Critical | Directory/manual user creation assigns default password `12345678`, and both web/API login permit local fallback credentials. |
| High | Any authenticated API user can accept any non-closed ticket. |
| High | Role/KPI/structural grant controllers can write directly to effective authorization state, bypassing the newer governance request pending/effective model. |
| High | Calendar access still uses AD title strings as an authorization source. |
| High | Calendar-access users can create/delete global calendar holidays; no admin check exists in those closures. |
| High | Certificate audit table/model exist, but certificate template, generation, issue, and revoke operations do not write certificate audit logs. |
| High | Self-registration remains enabled and users with no explicit role resolve to `teacher`. |

Overall architecture status: transitional, partially governed, not yet enterprise-ready as the central university authorization source of truth. The recommended path is evolutionary containment: fix exposed endpoints and default credentials first, then move all effective authority writes behind governed grant/change requests while preserving existing data.

## Method And Scope

Commands and inspections used:

- Filtered recursive file comparison across DEV and PROD.
- `git rev-parse`, `git status`, `git ls-files`, `git status --ignored`.
- `diff -qr` on `app/`, `routes/`, `resources/js/`, `config/`, `database/migrations`.
- Targeted `rg` searches for authorization, roles, grants, policies, gates, middleware, source-of-truth fields, audit logging, and certificates.
- `nl -ba` line-number review of relevant files.

Excluded from repository drift counts: `.git`, `vendor`, `node_modules`, `storage`, `bootstrap/cache`, `public/build`, `public/assets`, `backups`.

Not audited: live production database data, user counts, actual role assignments, actual secrets, runtime web server config outside the application directories. Where a conclusion would require database contents, it is marked uncertain.

Events/Jobs note: no `app/Events` or `app/Jobs` directory was present. `app/Listeners/LogSuccessfulLogin.php:14-17` logs successful login through `AuditLogService`.

## Phase 1: Repository Comparison

### Git And File Inventory

| Item | DEV | PROD |
|---|---|---|
| Path | `/var/www/laravel-react-dev` | `/var/www/laravel-react` |
| Git branch | `feature/certificates-operator-role` | `main` |
| Git HEAD | `7c38a523e215dec1e6a668761a248ad6fb8948e2` | `5b7c4aff1fc163ebc7f3af95e8cd6ba30718bf8e` |
| Git status | clean before report artifact | dirty, behind `origin/main` by 2 |
| Filtered file count | 777 | 794 |

PROD dirty files:

- `app/Http/Controllers/Auth/AuthenticatedSessionController.php`
- `app/Http/Controllers/CertificateTemplateController.php`
- `app/Http/Middleware/EnsurePanelRoleAccess.php`
- `app/Models/User.php`
- `resources/js/components/app-sidebar.jsx`
- `resources/views/app.blade.php`

These dirty PROD files align with the DEV certificate-operator role work; `diff -qr` found no current content differences in `app/`, `routes/`, or `resources/js`.

### Files Existing Only In DEV

- `.claude/settings.local.json`
- `.phpunit.result.cache`
- `.vscode/extensions.json`

### Files Existing Only In PROD

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONCERNS.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/STACK.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/TESTING.md`
- `.planning/config.json`
- `.planning/phases/phase-001-baseline-safety-enforcement/*`
- `ssl/fullchain.pem`
- `ssl/private.key`

`ssl/private.key` is present in the PROD application working copy with mode `600` and size `1674` bytes. `git ls-files ssl .env` returned no tracked files; `git status --ignored ssl .env` reported `!! ssl/` and `!! .env`, so this is not evidence of a committed secret. `vite.config.js:6-12` explicitly reads `./ssl/fullchain.pem` and `./ssl/private.key` when present, so this appears to be an app-root HTTPS convention. It is still an operational risk because private key material resides under the release tree.

### Modified Common Files

- `.env`
- `scripts/deploy/dev_to_prod_release.sh`
- `scripts/deploy/health_check_suite.sh`
- `scripts/deploy/lib_deploy_common.sh`

### Package, Migration, And Config Drift

Package drift: not detected. `composer.json`, `composer.lock`, `package.json`, and `package-lock.json` SHA-256 hashes match between DEV and PROD. No custom Composer `repositories` or path repositories were detected in `composer.json`.

Migration drift: not detected. `diff -qr database/migrations` returned no differences.

Config drift: `config/` is byte-identical. `.env` key drift is present, values intentionally not printed:

DEV-only keys: `CACHE_PREFIX`, `SESSION_COOKIE`, `VITE_HOME_URL`, `VITE_LIBRARY_URL`.  
PROD-only keys: none detected by key-name comparison.

### Deployment Safeguard Drift

DEV deployment scripts are stricter than PROD:

- DEV `scripts/deploy/dev_to_prod_release.sh` adds smoke checks for `/`, `/login`, `/certificates`, `/certificates/registry`, `/templates` and fails on any 5xx. PROD only checks `/` and only rejects exactly HTTP 500.
- DEV `scripts/deploy/health_check_suite.sh` adds `check_critical_route` and certificate/template route checks. PROD lacks these checks.
- DEV `scripts/deploy/lib_deploy_common.sh` validates `public/build/manifest.json` exists, is fresh within 600 seconds, and contains `resources/js/app.jsx`. PROD only checks existence.

Risk: PROD deployment rollback/health gates are weaker than DEV; certificate/template regressions can pass PROD deployment scripts.

## Phase 2: RBAC And Authorization Inventory

### Routes And Middleware

Primary route groups:

- Public web routes: `/`, `/nav`, `/catalog` in `routes/web.php:48-61`.
- Public ticket submission: `GET /tickets`, `POST /tickets` in `routes/web.php:74-75`.
- Authenticated phonebook group with `auth`, `panel.role.access`, `track.last-seen` in `routes/web.php:64-72`; controller write methods call admin check at `app/Http/Controllers/PhonebookDirectoryController.php:104-127` and `:300-305`.
- Authenticated department request self-service group without `panel.role.access` in `routes/web.php:92-105`.
- Authenticated questionnaire student group in `routes/web.php:107-117`.
- Main panel group using `auth`, `panel.role.access`, `track.last-seen` begins at `routes/web.php:119`.
- Calendar sub-group uses `calendar.access` at `routes/web.php:553`.
- Public certificate verification route exists outside auth at `routes/web.php:1880-1881`.

API route groups:

- Public API: announcements read, nav read, ticket creation, library reservation creation, AI chat in `routes/api.php:24-33`.
- Authenticated Sanctum API group in `routes/api.php:35-122`.
- Announcement write routes are only protected by `auth:sanctum`, not role middleware, in `routes/api.php:41-43`.
- Ticket accept route is only protected by `auth:sanctum` in `routes/api.php:48`.

Middleware:

- `EnsurePanelRoleAccess` blocks sensitive routes unless trusted role/scope/approval data is present at `app/Http/Middleware/EnsurePanelRoleAccess.php:30-32`.
- It grants KPI-route access by KPI grant before role allowlists at `app/Http/Middleware/EnsurePanelRoleAccess.php:34-47`.
- Certificate role is allowed only certificate/template prefixes at `app/Http/Middleware/EnsurePanelRoleAccess.php:58-77`.
- Admin/superadmin bypass panel restrictions at `app/Http/Middleware/EnsurePanelRoleAccess.php:79-82`.
- Student role is limited to profile routes at `app/Http/Middleware/EnsurePanelRoleAccess.php:84-90`.
- Sensitive prefixes are listed in `app/Http/Middleware/EnsurePanelRoleAccess.php:475-498`.
- Trusted sensitive access is calculated in `app/Http/Middleware/EnsurePanelRoleAccess.php:500-562`.
- Calendar access admits admins/superadmins, calendar grants, secretary grants, and AD title matches in `app/Http/Middleware/EnsureCalendarLeadershipAccess.php:29-68`.

### Gates And Policies

Explicit policy registrations:

- `KpiPeriodPolicy` and `KpiEntryPolicy` in `app/Providers/AppServiceProvider.php:57-58`.
- Gates for Pulse, Telescope, and API docs allow admin/superadmin at `app/Providers/AppServiceProvider.php:60-70`.
- `TelescopeServiceProvider` also defines `viewTelescope` for admin/superadmin at `app/Providers/TelescopeServiceProvider.php:59-60`.

Policies:

- `KpiEntryPolicy` controls KPI entry view/create/update/submit/review/approve/reject/return/structural actions. It uses `resolvedRoleSlug()` and KPI grants. Evidence: `app/Policies/KpiEntryPolicy.php:13-90`, `:220-335`.
- `KpiPeriodPolicy` allows admin/superadmin or `PERM_PERIODS`, and treats `kpi_admin` as admin via `KpiAccessGrant::userHasKpiAdmin`, `app/Policies/KpiPeriodPolicy.php:11-71`.
- `SurveyPolicy` uses raw `$user->role` rather than `resolvedRoleSlug()`, `app/Policies/SurveyPolicy.php:10-47`.
- `SurveyQuestionPolicy` uses `resolvedRoleSlug()` and admin/superadmin only, `app/Policies/SurveyQuestionPolicy.php:13-48`.

### Models And Role Resolution

`User::$fillable` includes security-sensitive fields: AD attributes, `role`, `role_id`, `position_id`, `position_confirmed`, `department_id`, `faculty_id`, and `password`, `app/Models/User.php:47-86`.

`User::booted()` normalizes legacy `role` and synchronizes `role_id`, `app/Models/User.php:122-155`.

`User::resolvedRoleSlug()` uses legacy `role` first, maps `department_head` to `hod`, accepts `hod`, `dean`, `teacher`, `student`, `admin`, `superadmin`, `certificates`, maps `department`/`structural` to `structural` only if structural access exists, and defaults to `teacher`. Evidence: `app/Models/User.php:250-275`.

`roles` table is minimal and seeded only with `admin`, `student`, `teacher`, `hod` in migration `database/migrations/2026_03_10_130000_create_roles_table.php:15-47`. `dean`, `structural`, `superadmin`, and `certificates` are not seeded by this migration. Some roles appear in seeders or code, but a complete role catalog migration is not implemented.

### Grant Models

Legacy KPI grant model:

- `KpiAccessGrant` defines `kpi_admin`, `review_queue`, `approval_queue`, `structural_queue`, `indicators`, `analytics`, `periods`, `app/Models/KpiAccessGrant.php:14-31`.
- Table has `user_id`, `permission`, `granted_by`, `granted_at`, `is_active`, `division_id`, but no status lifecycle, expiry, approval, or reason column, `database/migrations/2026_05_04_120435_create_kpi_access_grants_table.php:14-24`, `database/migrations/2026_05_04_172733_add_division_id_to_kpi_access_grants_table.php:14-17`.

Target-style grants:

- `scoped_grants` supports status, capability, module, scope, org unit, time window, reason, metadata, approval/revocation fields, `database/migrations/2026_06_03_240000_create_scoped_grants_table.php:11-35`.
- `delegations` supports grantor/delegate, capability, module, scope, org unit, time window, status, approval, reason, revocation, `database/migrations/2026_06_03_241000_create_delegations_table.php:11-36`.
- `ScopedGrant` and `Delegation` models include pending/active/expired/revoked/superseded statuses, `app/Models/ScopedGrant.php:11-25`, `app/Models/Delegation.php:11-21`.

### Controller Authorization

Selected guarded controllers:

- `KpiEntryController` uses policies via `$this->authorize(...)`, e.g. `app/Http/Controllers/KpiEntryController.php:48`, `:85`, `:124`, `:652`, `:872`, `:993`, `:1036`, `:1247-1337`.
- `KpiPeriodController` uses `authorize('viewAny'/'create')`, `app/Http/Controllers/KpiPeriodController.php:24`, `:101-104`.
- `DepartmentRequestController` uses admin/handler checks for admin views and updates, `app/Http/Controllers/DepartmentRequestController.php:52-115`, `:221-305`.
- `TicketController` web admin status update requires admin/superadmin in `app/Http/Controllers/TicketController.php:99-103`; its admin listing scopes non-admins by AD department in `app/Http/Controllers/TicketController.php:45-71`.
- `PhonebookDirectoryController` write methods call `authorizeManage`, with admin/superadmin check at `app/Http/Controllers/PhonebookDirectoryController.php:300-305`.

Selected risky/ad hoc controllers:

- `Api\AnnouncementController::store/update/destroy` have validation and writes but no role/permission check, `app/Http/Controllers/Api/AnnouncementController.php:49-120`.
- `Api\TicketController::accept` only checks authenticated user, ticket closed state, and accepted-by ownership, `app/Http/Controllers/Api/TicketController.php:122-155`.
- `KpiStructuralUnitController` mutating methods do not authorize inside the controller, `app/Http/Controllers/KpiStructuralUnitController.php:179-285`; access depends on route middleware. `EnsurePanelRoleAccess` grants full `kpi.*` access to `kpi_admin` grant holders at `app/Http/Middleware/EnsurePanelRoleAccess.php:352-356`.

### Frontend Authorization

Frontend logic is visibility only; backend is authoritative where implemented.

- `resources/js/components/app-sidebar.jsx` derives role and grants from Inertia props, `:123-144`.
- Template/certificate UI access uses admin/superadmin, `certificates` role, or hardcoded email `a.khastayeva@kaztbu.edu.kz`, `resources/js/components/app-sidebar.jsx:130-144`.
- KPI menu visibility is role/grant based, `resources/js/components/app-sidebar.jsx:163-230`.

## Phase 3: Source Of Truth Audit

| Attribute | Current Source In Code | Should-Be Source | Risk | Evidence | Recommendation |
|---|---|---|---|---|---|
| Authentication | AD first, local fallback | AD for employees; controlled local only for service/break-glass | High | `LoginRequest.php:65-86`, `Api/AuthController.php:33-48` | Keep AD primary; disable broad local fallback or restrict to approved break-glass/service users. |
| AD identity fields | AD sync and directory lookup | AD | Medium | `ActiveDirectoryAuthenticator.php:57-76`, `:391-456` | Treat AD GUID/login/name/email as identity proof only; avoid using AD title/department for auth. |
| Roles | `users.role`, `users.role_id`, `roles` | CRM governance | High | `User.php:122-155`, `:250-275`, roles migration `:15-47` | Move to governed role/grant catalog; keep legacy columns during migration as derived/cache. |
| Permissions | Mostly `kpi_access_grants`, policies, route checks | CRM governance/scoped grants | High | `KpiAccessGrant.php:14-31`, `ScopedGrant.php:11-25` | Use `scoped_grants`/delegations as effective authority source; wrap legacy grants. |
| Faculty | `users.faculty_id`, legacy `faculties`, org mappings | CRM effective assignment; future Platonus context via controlled integration | Medium | `ProfileController.php:59-87`, `GovernanceAccessRequestService.php:402-405`, org mappings migration | Continue approval-required changes; avoid direct writes outside governance. |
| Department | `users.department_id`, `users.ad_department`, legacy departments | CRM effective assignment | High | `Api/DepartmentController.php:25-35`, `TicketController.php:50-70` | Stop using `ad_department` for authorization/visibility; use effective department assignments. |
| Division/structural unit | `divisions`, `kpi_structural_units`, pivots, KPI grants, org mappings | CRM org model with scoped assignments | Medium | `KpiStructuralUnitController.php:179-285`, `OrgUnitMapping` migration | Consolidate under org units and scoped grants; keep legacy mappings during transition. |
| Position/title | `users.position_id`, `users.position_title`, `users.ad_title` | CRM effective HR assignment; AD title display-only | High | `EnsureCalendarLeadershipAccess.php:43-64`, `ProfileController.php:78-87` | Do not authorize from AD title; route title changes through governance. |
| Managerial status | Role strings, AD title patterns, grants | CRM effective role/grant/scope | High | Calendar middleware `:62-64`; `User::resolvedRoleSlug()` | Replace role/title heuristics with scoped grants/delegations. |
| Scope | `faculty_id`, `department_id`, `kpi_access_grants.division_id`, org resolver, academic assignments | Effective CRM scopes | Medium | `KpiAccessEvaluatorService.php:25-56`, `academic_scope_assignments` migration | Finish strict governance; use `academic_scope_assignments` and org mappings as scopes. |
| Workflow | KPI statuses, governance requests, position requests, department requests | CRM workflow layer | Medium | `GovernanceAccessRequestService.php:235-269`, `DepartmentRequestController.php:273-305` | Centralize approvals and audit state transitions. |
| Visibility | Role checks, AD department, AD title, frontend | Effective CRM scopes | High | `TicketController.php:66-70`, `Api/DepartmentController.php:33-35` | Deny by default; derive visibility from effective scopes. |
| Profile fields | Self-edit + governance requests + admin direct paths | Field-specific ownership | Medium | `GovernanceAccessRequest.php:42-84`, `ProfileController.php:54-180` | Keep current profile freeze; close direct admin writes into governed requests. |
| Student attributes | `student_profiles`, questionnaire tables, future Platonus scaffold | Platonus via controlled integration + CRM effective override/governance | Medium | `student_profiles` migration `:17-34`, `PlatonusSyncService.php:12-23` | Keep read-only Platonus staging; do not authorize directly from raw import. |
| Employee attributes | `employee_profiles`, users, AD fields, future Platonus scaffold | CRM effective employee profile with AD identity proof | Medium | `employee_profiles` migration `:15-27`, AD sync `:391-456` | Separate identity, HR assignment, and authorization fields explicitly. |
| Platonus data | Scaffold only | Future academic source via controlled integration | Low now, High future | `PlatonusSyncService.php:12-23`, `:37-55`, `:73-91` | Define import contract, conflict handling, staging/effective separation before production integration. |

Config aligns with target principle:

- `config/academic.php:4-11` says identity source is AD, upstream academic source is Platonus read-only, permission source is `crm_governance`.
- `config/academic.php:25-26` explicitly forbids direct upstream authority.

Implementation drift remains because AD attributes and legacy grants still affect access in multiple places.

## Phase 4: Profile Security Audit

`ProfileUpdateRequest` accepts: `name`, `email`, `phone`, `position_title`, `position_confirmed`, `position_id`, `office_location`, `telegram`, `bio`, `avatar_url`, `profile_visibility`, `faculty_id`, `department_id`, `request_comment`, `app/Http/Requests/ProfileUpdateRequest.php:20-44`.

`ProfileController::update`:

- Captures requested governed values before stripping them, `app/Http/Controllers/ProfileController.php:59-65`.
- Blocks `name`/`email` self-edit for AD-synced users, `:69-76`.
- Hard-freezes self-edits for `position_confirmed`, `position_id`, `position_title`, `faculty_id`, `department_id`, `profile_visibility`, `request_comment`, `:78-87`.
- Logs attempted dangerous self-edit keys including role/role_id, `:124-138`, `:160-175`.
- Creates governance requests for governed changes, `:154-158`.

Field classification:

| Field | Current editability | Can affect auth/workflow/visibility? | Escalation Risk | Evidence |
|---|---|---|---|---|
| `phone` | Self-editable with WhatsApp verification | Workflow/contact; not authorization | Low | `ProfileController.php:89-121` |
| `office_location` | Self-editable | Visibility/contact only | Low | `ProfileUpdateRequest.php:36`, profile fill `ProfileController.php:140-152` |
| `telegram` | Self-editable | Contact/workflow notifications | Low | `ProfileUpdateRequest.php:37` |
| `bio` | Self-editable | Display only | Low | `ProfileUpdateRequest.php:38` |
| `avatar_url` / avatar upload | Self-editable | Display only | Low/Medium if external URLs are displayed unsafely elsewhere | `ProfileUpdateRequest.php:39` |
| `name`, `email` | Self-editable only if not AD-synced | Identity/display; email can affect login fallback | Medium | `ProfileController.php:69-76`, local fallback login |
| `profile_visibility` | Accepted by request, stripped before save | Visibility | Low current, Medium if future code bypasses controller | `ProfileController.php:78-87` |
| `position_id`, `position_title`, `position_confirmed` | Approval-required | Authorization/workflow/calendar | High if bypassed | `GovernanceAccessRequest.php:71-84`; `ProfileController.php:59-87` |
| `faculty_id`, `department_id` | Approval-required | KPI/workflow/visibility | High if bypassed | `ProfileController.php:59-87`; `GovernanceAccessRequestService.php:402-411` |
| `role`, `role_id` | Admin/direct paths, not profile self-edit | Authorization | Critical if exposed | `User.php:47-86`; `DirectoryUserController.php:98-123`, `:715-769` |
| AD fields | Sync-only in governance constants but mass-assignable on `User` | Should not authorize | High if used for access | `GovernanceAccessRequest.php:57-69`; `User.php:53-58`, `:74-75` |

Conclusion: profile self-edit containment is mostly correctly implemented. The larger risk is bypass through other controllers or future mass-assignment paths because `User::$fillable` is broad.

## Phase 5: Privilege Escalation Audit

### Confirmed Escalation/Authorization Vectors

1. API announcements write access missing role check.
   - Route evidence: `routes/api.php:41-43`.
   - Controller evidence: `app/Http/Controllers/Api/AnnouncementController.php:49-120`.
   - Impact: any authenticated Sanctum user can publish, edit, deactivate, or delete announcements.

2. Default password plus local fallback authentication.
   - Web fallback: `app/Http/Requests/Auth/LoginRequest.php:75-86`.
   - API fallback: `app/Http/Controllers/Api/AuthController.php:36-48`.
   - Default password creation: `DirectoryUserController.php:694-701`, `:817-824`, `:905-907`; console student creation uses `bcrypt('password123')` in `app/Console/Commands/CreateStudentUsers.php:37-41`.
   - Impact: predictable-password local accounts can become login targets independent of AD.

3. API ticket accept missing role check.
   - Route: `routes/api.php:48`.
   - Controller: `app/Http/Controllers/Api/TicketController.php:122-155`.
   - Impact: any authenticated user can mark any non-closed ticket as in progress/accepted.

4. Direct role assignment bypasses governance request model.
   - Admin grant/revoke: `DirectoryUserController.php:98-198`.
   - Role update: `DirectoryUserController.php:715-769`, `:772-871`.
   - Impact: effective role changes happen immediately with logging, not approval-required pending state.

5. Direct KPI grant assignment bypasses governance request model.
   - KPI access grant: `KpiAccessController.php:68-124`.
   - KPI admin bundle: `KpiSettingsController.php:243-330`.
   - Impact: effective permissions are written immediately to `kpi_access_grants`.

6. Direct structural assignment bypasses governance request model.
   - `KpiStructuralUnitController.php:179-285`.
   - Middleware allows all `kpi.*` for `kpi_admin` grants, `EnsurePanelRoleAccess.php:352-356`.
   - Impact: structural authority and KPI routing can be mutated outside governance requests.

7. Calendar holiday global mutation is available to any `calendar.access` user.
   - Calendar group begins `routes/web.php:553`.
   - Holiday create/delete closures lack admin checks, `routes/web.php:1680-1701`.
   - Impact: calendar-access user can alter global holidays.

8. AD title authorizes calendar access.
   - `EnsureCalendarLeadershipAccess.php:43-64`.
   - `EnsurePanelRoleAccess.php:300-307`.
   - `HandleInertiaRequests.php:146-151`.
   - Impact: AD attributes influence authorization despite target rule that AD is not authoritative for roles/scopes.

9. Unlinked KPI entries visible/actionable by HOD/Dean.
   - Policy grants unlinked visibility/actions: `KpiEntryPolicy.php:36-38`, `:49-50`, `:226-247`, `:311-331`.
   - Query includes null faculty/department entries: `KpiEntryController.php:1785-1800`.
   - Impact: records missing organizational linkage can enter leadership queues outside precise scope.

10. Public self-registration defaults to effective `teacher`.
    - Register route: `routes/auth.php:14-18`.
    - User creation without role: `RegisteredUserController.php:31-49`.
    - Default role resolution: `User.php:274-275`.
    - Impact: unaffiliated local users can authenticate and receive teacher role semantics.

11. Certificate operations are not certificate-audited.
    - Audit table exists: `create_certificate_module_tables.php:107-118`.
    - `rg` found `CertificateAuditLog` only in model/migration.
    - Generate/issue/revoke operations: `CertificateRegistryController.php:143-178`, `:251-292`.
    - Impact: certificate issuance/revocation lacks dedicated immutable audit trail.

12. Certificate role/access logic is inconsistent.
    - `CertificateTemplateController` allowlist includes `certificates@kaztbu.edu.kz`, `:236-248`.
    - `CertificateRegistryController` allowlist only includes `a.khastayeva@kaztbu.edu.kz`, `:432-443`.
    - `EnsurePanelRoleAccess` hardcoded certificate email only `a.khastayeva@kaztbu.edu.kz`, `:312-325`.
    - Frontend template access hardcodes only `a.khastayeva@kaztbu.edu.kz`, `resources/js/components/app-sidebar.jsx:143-144`.
    - Impact: inconsistent operator access and support burden; risk of accidental bypass or denial.

13. Sensitive user fields are mass assignable.
    - `User::$fillable` includes role, password, AD fields, org assignment fields, `app/Models/User.php:47-86`.
    - Current profile controller strips dangerous fields, but other/future `fill($request->all())` paths would be high risk.

## Phase 6: Organizational Model Audit

Current organizational structures:

- Legacy academic/org tables: `faculties`, `departments`, `divisions`, `positions`.
- User effective legacy assignment fields: `users.faculty_id`, `users.department_id`, `users.position_id`, `users.position_title`.
- AD descriptive fields: `users.ad_department`, `users.ad_department_number`, `users.ad_division`, `users.ad_title`.
- KPI structural units: `kpi_structural_units` and pivots.
- Enterprise org catalog: `org_units` with hierarchy, code, type, parent, leader, active flag, source, metadata, `database/migrations/2026_06_03_210000_create_org_units_table.php:13-30`.
- Legacy-to-org mapping: `org_unit_mappings`, `database/migrations/2026_06_03_220000_create_org_unit_mappings_table.php:13-31`.
- Employee profile table: `database/migrations/2026_06_03_250000_create_employee_profiles_table.php:15-27`.
- Student profile table: `database/migrations/2026_06_03_251000_create_student_profiles_table.php:17-34`.
- Academic scope assignments: `database/migrations/2026_06_03_252000_create_academic_scope_assignments_table.php:15-39`.

Multiple assignment support:

- KPI structural units support multiple user assignments via relations/pivots.
- `academic_scope_assignments` supports multiple scoped academic assignments.
- Legacy `users.faculty_id` and `users.department_id` remain single-value fields.

Primary assignment:

- Not consistently modeled. Legacy `users.faculty_id`/`department_id` behave like primary assignment; `academic_scope_assignments` can hold multiple assignments but there is no universal primary/effective resolver enforced everywhere.

Scope calculation:

- KPI evaluator uses org scope, scoped authority ledger, academic scope resolver, and participant eligibility, `KpiAccessEvaluatorService.php:25-56`.
- Legacy policies/controllers still directly inspect `users.faculty_id`, `users.department_id`, KPI grants, and AD fields.

Comparison to target:

- Target org architecture is partially present.
- Not fully implemented: one canonical organization service used by every authorization and visibility path.
- Risk: mixed legacy and new models cause inconsistent access decisions.

## Phase 7: Workflow Audit

Implemented workflows:

- Governance access requests with pending/approved/rejected statuses, `GovernanceAccessRequest.php:25-28`.
- Governance request stores current/requested/approved/effective values and metadata, `GovernanceAccessRequestService.php:363-386`.
- Approval applies effective change inside transaction and marks approved/effective timestamps, `GovernanceAccessRequestService.php:235-269`.
- Rejection records rejection reason, `GovernanceAccessRequestService.php:272-297`.
- Review authorization checks admin/superadmin, KPI admin for HR, dean/HOD/structural scope for academic/structural, `GovernanceAccessRequestService.php:300-313`.
- Department request workflow has submitter, handlers, admin/handler status update, `DepartmentRequestController.php:20-49`, `:221-305`.
- KPI workflow uses statuses and policies for submit/review/approve/return/structural confirm/reject.
- Calendar secretary access supports delegated calendar management, route closures around `routes/web.php:954-995`.

Not fully implemented:

- Delegation model exists, but no complete enterprise delegation UI/workflow was confirmed in controller review.
- Scoped grants exist, but legacy direct grant controllers still write effective authority.
- Approval-required security changes are implemented for profile path but not for all admin authority paths.
- Certificate workflow lacks audit workflow.
- Superadmin/break-glass reason enforcement is inconsistent by actor/action.

## Phase 8: Super Admin Audit

Who is Super Admin:

- Any user whose `resolvedRoleSlug()` returns `superadmin`.
- Evidence: `User.php:250-275`.

How detected:

- Legacy `users.role` or `roleRef.slug` can resolve to `superadmin`.
- No dedicated immutable break-glass table found.
- No role seed/migration for `superadmin` found in `create_roles_table`; database contents uncertain.

Bypass behavior:

- Panel middleware allows admin/superadmin all panel routes, `EnsurePanelRoleAccess.php:79-82`.
- Calendar middleware allows admin/superadmin all calendar access, `EnsureCalendarLeadershipAccess.php:29-33`.
- Governance review allows admin/superadmin, `GovernanceAccessRequestService.php:300-304`.
- Elevated authority treats `superadmin` as technical and admin/superadmin as business, `ElevatedAuthorityService.php:35-42`.

Audit/reason behavior:

- Some controllers log `superadmin_override`, e.g. `DirectoryUserController.php:1119-1135`, `KpiAccessController.php:234-250`, `KpiSettingsController.php:399-415`, `PositionChangeRequestController.php:205-221`.
- Reason is required for superadmin in some paths, e.g. `DirectoryUserController.php:1104-1117`, `KpiSettingsController.php:388-397`.
- `config/governance.php:16-40` sets business reasons not required for several dangerous actions and technical reasons required.
- Normal admin dangerous actions often do not require a reason.

Can developers bypass everything:

- No code-level developer bypass constant was found in inspected authorization paths.
- Operationally, anyone with production shell/database access can bypass app controls. This audit did not inspect server IAM or database accounts.

## Phase 9: Database Audit

### Present

- Users with role columns and AD/profile/org fields.
- `roles` table.
- Legacy KPI grants.
- Scoped grants and delegations.
- Governance access requests with approved/effective values.
- Org units and org mappings.
- Employee profiles, student profiles, academic scope assignments.
- Platonus sync staging/log tables.
- Audit logs and activity logs.
- Certificate tables and certificate audit log table.

### Missing Or Incomplete

| Area | Status |
|---|---|
| `permissions` table | Not implemented. No generic permissions catalog found. |
| `role_permissions` table | Not implemented. Roles are not normalized to permissions. |
| Complete role catalog migration | Not implemented; only `admin`, `student`, `teacher`, `hod` are seeded in the base roles migration. |
| Universal effective authority table | Partially implemented through scoped grants/delegations/ledger, but legacy grants remain active. |
| Canonical primary/multiple org assignment model | Partially implemented. Legacy single fields and new assignment tables coexist. |
| Certificate audit writes | Not implemented despite audit table. |
| Full model observer audit for security entities | Not implemented. |

### Audit Tables

`AuditLogService::supports()` logs creates only for selected models: AcademicYear, Department, Diploma, Division, EducationalProgram, Faculty, KpiEntry, KpiIndicator, KpiPeriod, Ticket, `app/Services/AuditLogService.php:69-83`.

`AuditableModelObserver` only implements `created`, not updated/deleted, `app/Observers/AuditableModelObserver.php:14-21`.

Observers registered in `AppServiceProvider.php:74-83` exclude `User`, `Role`, `KpiAccessGrant`, `ScopedGrant`, `Delegation`, `GovernanceAccessRequest`, `OrgUnit`, `Position`, `CertificateTemplate`, and `Certificate`.

`BusinessActivityLogger` exists and captures actor/request context when manually called, `app/Services/BusinessActivityLogger.php:16-58`, but coverage is manual and incomplete.

## Phase 10: Architecture Audit

| Layer | Current Assessment |
|---|---|
| Identity | AD-first authentication exists, but local fallback and self-registration remain broad. AD sync does not fill all AD fields later used by authorization/visibility. |
| Authorization | Fragmented across role strings, role table, KPI grants, policies, route middleware, controller checks, AD attributes, and hardcoded email allowlists. |
| Workflow | Governance request workflow is promising and correctly separates pending/effective state for some profile/admin changes. Legacy direct grants bypass it. |
| Organization | Legacy and enterprise org models coexist. Mapping layer exists but is not universally enforced. |
| Approval | Implemented for governance access requests and position/profile changes. Not universal for role/grant/certificate/org mutations. |
| Audit | Manual and partial. Security-relevant entities and updates/deletes are not comprehensively audited. |
| Integration | AD integration exists. Platonus integration is scaffold-only and explicitly no live sync. |
| Scalability | Transitional duplication will become hard to govern at university-wide scale unless central authority services replace ad hoc checks. |
| Maintainability | Authorization logic is spread across many files and closures, increasing regression risk. |
| Mobile API readiness | Sanctum exists, but API authorization is inconsistent; announcement/ticket endpoints need immediate hardening. |
| Future Platonus readiness | Staging/schema scaffolding exists; production integration not implemented. Need conflict/staging/effective boundary before rollout. |
| Future AD readiness | AD should remain identity-only. Current AD-title/department authorization must be removed. |

## Phase 11: Gap Analysis

| Current Implementation | Target Architecture | Gap | Risk | Priority | Difficulty | Recommended Solution |
|---|---|---|---|---|---|---|
| API announcement writes require only Sanctum auth | Admin/scoped permission required | Missing authorization | Critical | P0 | Low | Add policy/controller `ensureAdmin` or scoped permission; add tests. |
| Default password `12345678` for created users | No predictable credentials | Predictable local login | Critical | P0 | Medium | Generate random unusable passwords; force reset; disable fallback except allowlisted accounts. |
| Local fallback login for all users | AD for identity, controlled break-glass | Auth boundary too broad | High | P0 | Medium | Restrict fallback to non-AD/break-glass users with explicit flag. |
| Ticket accept any authenticated API user | Scoped ticket handler/admin | Missing action authorization | High | P0 | Low | Reuse admin/handler checks; scope by effective department. |
| Direct `users.role` updates | Governance request/effective role assignment | Pending/effective bypass | High | P1 | Medium | Add role-change request flow; keep direct only emergency with reason/audit. |
| Direct KPI grants | Scoped grants with approval/expiry | Legacy grants remain effective | High | P1 | Medium | Wrap `kpi_access_grants` behind governed requests or mirror to scoped grants. |
| AD title grants calendar access | CRM effective authority | AD used as auth source | High | P1 | Medium | Replace title patterns with calendar scoped grants; backfill grants. |
| Hardcoded certificate emails | Role/grant catalog | Non-governed allowlists | Medium | P1 | Low | Move to config/DB grant; remove controller/frontend inconsistencies. |
| Unlinked KPI entries visible to leaders | Deny-by-default scope | Null scope treated as visible | High | P1 | Medium | Quarantine unlinked entries to admin/KPI admin remediation queue. |
| Audit observer create-only selected models | Every security-relevant change audited | Missing audit coverage | High | P1 | Medium | Add domain audit events for User/Role/Grant/Org/Certificate changes. |
| `roles` table without permissions | Role != permission | No permission normalization | Medium | P2 | Medium | Introduce permission catalog and role-permission mapping while retaining legacy columns. |
| Legacy org fields plus org units | Canonical org hierarchy and assignments | Dual source | Medium | P3 | High | Build resolver contract and migrate reads to effective assignments. |
| Delegation model exists, limited use | Temporary effective authority | Workflow incomplete | Medium | P4 | High | Implement delegation approval, expiry, audit, and evaluator integration. |

## Phase 12: Security Findings

### Critical

1. API announcement mutation authorization missing.
   - Why dangerous: any authenticated API user can publish or delete university-wide announcements.
   - Attack scenario: a self-registered or compromised low-privilege user obtains Sanctum token, posts false emergency announcement, deletes official notices.
   - Affected files: `routes/api.php:41-43`, `app/Http/Controllers/Api/AnnouncementController.php:49-120`.
   - Recommendation: require admin/superadmin or explicit `announcements.manage` scoped permission in controller/policy; add negative tests.

2. Predictable default password plus local fallback login.
   - Why dangerous: accounts created through directory/manual flows have known password if not changed; web/API fallback accepts local credentials.
   - Attack scenario: attacker tries known AD login/email plus `12345678` against web/API and obtains session/token.
   - Affected files: `DirectoryUserController.php:694-701`, `:817-824`, `:905-907`; `CreateStudentUsers.php:37-41`; `LoginRequest.php:75-86`; `Api/AuthController.php:36-48`.
   - Recommendation: immediately stop assigning predictable passwords; invalidate/reset affected accounts; restrict local fallback to explicit break-glass/service accounts.

### High

3. API ticket accept missing authorization.
   - Why dangerous: low-privilege users can take ownership of operational tickets.
   - Attack scenario: user accepts/blocks facilities/IT tickets.
   - Affected files: `routes/api.php:48`, `app/Http/Controllers/Api/TicketController.php:122-155`.
   - Recommendation: require admin/handler scope and effective department authorization.

4. Direct role/grant writes bypass pending/effective governance.
   - Why dangerous: privileged users can change authority immediately without approval workflow.
   - Attack scenario: admin grants another account admin/KPI admin/structural authority without second approval.
   - Affected files: `DirectoryUserController.php:98-198`, `:715-871`; `KpiAccessController.php:68-191`; `KpiSettingsController.php:243-330`; `KpiStructuralUnitController.php:179-285`.
   - Recommendation: introduce governed role/grant change requests; reserve direct writes for break-glass with mandatory reason and immutable audit.

5. AD title/department used for authorization and visibility.
   - Why dangerous: AD is explicitly not authoritative for roles/scopes; stale or mis-set AD attributes change access.
   - Attack scenario: user with title containing leadership keyword gets calendar access.
   - Affected files: `EnsureCalendarLeadershipAccess.php:43-64`, `EnsurePanelRoleAccess.php:300-307`, `HandleInertiaRequests.php:146-151`, `TicketController.php:66-70`, `Api/DepartmentController.php:33-35`.
   - Recommendation: replace with CRM effective grants/assignments; keep AD fields display-only.

6. Calendar global holidays can be mutated by any calendar-access user.
   - Why dangerous: broad calendar population can alter shared institutional calendar metadata.
   - Attack scenario: delegated secretary or AD-title calendar user deletes holidays or creates false holidays.
   - Affected files: `routes/web.php:553`, `:1680-1701`.
   - Recommendation: require admin/superadmin or calendar-admin scoped grant for holiday mutations.

7. Unlinked KPI entries enter HOD/Dean visibility/actions.
   - Why dangerous: null scope is treated as visible instead of deny/quarantine.
   - Attack scenario: KPI entry missing faculty/department is reviewed/returned/approved by unrelated leadership.
   - Affected files: `KpiEntryPolicy.php:36-38`, `:49-50`, `:226-247`, `:311-331`; `KpiEntryController.php:1785-1800`.
   - Recommendation: deny non-admin access to unlinked entries; create admin remediation queue.

8. Certificate operations lack certificate audit.
   - Why dangerous: certificate issuance/revocation is security-sensitive and externally verifiable.
   - Attack scenario: operator issues/revokes certificate with no domain audit trail.
   - Affected files: migration `create_certificate_module_tables.php:107-118`; `CertificateRegistryController.php:143-178`, `:251-292`.
   - Recommendation: write `CertificateAuditLog` and activity log for template/version/generate/bulk/issue/revoke/export.

9. Self-registration creates effective teacher users.
   - Why dangerous: unaffiliated user can become authenticated and resolve as `teacher`.
   - Attack scenario: external user registers and accesses authenticated teacher-default routes/API surfaces.
   - Affected files: `routes/auth.php:14-18`; `RegisteredUserController.php:31-49`; `User.php:274-275`.
   - Recommendation: disable registration or route to pending unverified role with no panel/API privileges.

### Medium

10. `User::$fillable` includes security-sensitive fields.
    - Affected file: `app/Models/User.php:47-86`.
    - Recommendation: remove role/password/AD/org security fields from general fillable or enforce DTO/service writes.

11. Certificate access allowlists inconsistent and hardcoded.
    - Affected files: `CertificateTemplateController.php:236-248`, `CertificateRegistryController.php:432-443`, `EnsurePanelRoleAccess.php:312-325`, `resources/js/components/app-sidebar.jsx:143-144`.
    - Recommendation: centralize certificate permission in CRM grant/config table.

12. Audit coverage incomplete.
    - Affected files: `AuditLogService.php:69-83`, `AuditableModelObserver.php:14-21`, `AppServiceProvider.php:74-83`.
    - Recommendation: add explicit audit events for security entities and update/delete operations.

13. Governance elevated mode defaults to legacy fallback.
    - Affected files: `config/governance.php:3-7`, `ElevatedAuthorityService.php:104-127`.
    - Recommendation: move to `strict_categories` after backfilling scoped authority.

14. `SurveyPolicy` uses raw `role` not resolved role.
    - Affected file: `app/Policies/SurveyPolicy.php:10-47`.
    - Recommendation: use `resolvedRoleSlug()` consistently.

15. KPI structural-unit controller relies on route middleware only.
    - Affected files: `KpiStructuralUnitController.php:179-285`, `EnsurePanelRoleAccess.php:352-356`.
    - Recommendation: add controller-level policy/authorization for mutation methods.

16. Public AI chat sends active navigation context to external API if OpenAI key configured.
    - Affected files: `routes/api.php:32-33`, `Api/AiChatController.php:76-84`, `:360-411`.
    - Recommendation: classify route/staff/location data; require auth or limit context if sensitive.

17. Console password update accepts password as a command-line argument.
    - Affected file: `app/Console/Commands/UpdateUserPassword.php:16-41`.
    - Recommendation: use an interactive secret prompt or one-time reset token so plaintext passwords are not exposed in shell history/process lists.

### Low

18. Calendar grant/exclusion management checks only `admin`, not `superadmin`.
    - Evidence: `routes/web.php:923-953`.
    - Recommendation: use `in_array(role, ['admin','superadmin'])`.

19. PROD deployment scripts weaker than DEV.
    - Affected files: `scripts/deploy/dev_to_prod_release.sh`, `scripts/deploy/health_check_suite.sh`, `scripts/deploy/lib_deploy_common.sh`.
    - Recommendation: promote stricter DEV safeguards to PROD.

20. PROD application root contains ignored TLS private key material.
    - Evidence: `ssl/private.key` present, ignored, mode `600`; `vite.config.js:6-12` reads `./ssl/private.key` when present.
    - Recommendation: move TLS material outside application release tree; manage local/dev HTTPS separately from production release paths.

## Phase 13: Implementation Roadmap

### P0: Immediate Containment

1. Add admin/scoped permission check to API announcement store/update/destroy.
2. Add admin/handler check to API ticket accept.
3. Stop assigning `12345678`; rotate/reset existing default-created users.
4. Disable or restrict self-registration.
5. Restrict local fallback login to explicit break-glass/service accounts.
6. Lock calendar holiday mutations to admin/calendar-admin.
7. Move `ssl/private.key` outside the application directory.

### P1: Security Fixes

1. Add certificate audit writes for template/version/generate/bulk/issue/revoke/export.
2. Replace AD-title calendar access with CRM calendar grants; backfill current intended users into grants.
3. Replace `ad_department` ticket/department visibility with effective CRM department scope.
4. Deny/quarantine unlinked KPI entries for non-admin users.
5. Add audit events for User, Role, KPI grants, scoped grants, delegations, governance requests, org units, positions, certificates.
6. Promote DEV deployment smoke/build manifest checks to PROD.

### P2: RBAC Redesign

1. Create normalized permission catalog and role-permission mapping.
2. Treat `users.role`/`role_id` as compatibility cache during migration.
3. Route all role/grant changes through governance requests, except break-glass.
4. Move hardcoded certificate email access into CRM-managed grants.
5. Add policies for non-KPI domains: announcements, tickets, certificates, calendar admin, org structure, users.

### P3: Organization Redesign

1. Define canonical effective organization assignment service.
2. Backfill legacy faculty/department/division/structural assignments into org units and academic scope assignments.
3. Add primary assignment semantics and multiple assignment support consistently.
4. Replace direct reads of `users.faculty_id`, `department_id`, `ad_department`, `ad_title` in authorization with resolver output.

### P4: Approval Workflow

1. Extend governance access requests to role changes, KPI grants, scoped grants, structural assignments, certificate operator grants.
2. Add delegation workflow with approval, expiry, revocation, reason, and audit.
3. Add reviewer separation-of-duty rules for high-risk grants.
4. Add mandatory reason for all dangerous actions, not only superadmin/scoped technical cases.

### P5: Target Architecture

1. Enable strict elevated authority mode after backfill and validation.
2. Retire legacy broad grants or keep them as read-only derived compatibility rows.
3. Complete Platonus read-only staging integration with conflict resolution and no direct authority.
4. Establish enterprise audit dashboards for authority changes, break-glass, delegation, certificate issuance, and workflow approvals.
5. Add regression test suite covering deny-by-default, profile pending-state isolation, scoped grants, delegation expiry, and API authorization.

## Final Architecture Position

The CRM is on the right architectural path but is not yet operating as the sole trusted authorization source. The codebase contains target-building blocks, but the live effective authorization surface still has legacy shortcuts and direct mutations. The highest-value strategy is not destructive redesign; it is disciplined containment followed by progressive migration of every authority-changing action into governed, audited, effective-state services.
