# Enterprise Domain Architecture Review

Project audited: `/var/www/laravel-react-dev`  
Audit date: 2026-06-30  
Scope: Laravel/Inertia CRM application, including `app/`, `routes/`, `config/`, `database/`, `resources/`, providers, middleware, policies, observers, listeners, console commands, services, models, migrations, and relevant React UI.

This is a Domain-Driven Design and enterprise domain architecture audit. It is not a code review, security audit, or RBAC audit.

## 1. Executive Summary

The CRM is currently a fast-growing Laravel monolith organized primarily by technical layer and feature routes, not by stable bounded contexts. There are meaningful domain seeds, especially in KPI, Governance, Organization, Academic Scope, Questionnaire submission, and integration scaffolding, but the project does not yet provide strong DDD boundaries for a large multi-year university ecosystem.

The main architectural risk is not the presence of a monolith. A modular monolith is a reasonable target. The risk is that important business domains share the same central models, controllers, route file, and service layer without explicit ownership rules. The most important coupling points are:

- [User.php](/var/www/laravel-react-dev/app/Models/User.php:47), which combines identity, profile, AD attributes, role, organization assignment, KPI access, certificate relations, delegations, activity, employee profile, student profile, and academic scope assignments.
- [routes/web.php](/var/www/laravel-react-dev/routes/web.php:573), where the Calendar domain implements scheduling, recurrence, conflict detection, secretary delegation, audit, notification, and Zoom behavior in route closures.
- [DirectoryUserController.php](/var/www/laravel-react-dev/app/Http/Controllers/DirectoryUserController.php:35), which coordinates User, Role, KPI grants, governance requests, Active Directory, manual user creation, and directory views.
- [PercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/PercoController.php:28), where external PERCO integration, HR reporting, shift calculations, holiday handling, and visibility settings are concentrated in one controller.
- [AdminDictionaryController.php](/var/www/laravel-react-dev/app/Http/Controllers/Api/Questionnaire/AdminDictionaryController.php:30), where Questionnaire administration, AD lookup, department/user data, dictionary CRUD, response analytics, and raw aggregation logic are implemented together.

Positive architecture signals:

- KPI has an emerging application/domain service layer: [KpiEntryService.php](/var/www/laravel-react-dev/app/Services/KpiEntryService.php:28), [KpiPeriodService.php](/var/www/laravel-react-dev/app/Services/KpiPeriodService.php:15), [KpiCalculationService.php](/var/www/laravel-react-dev/app/Services/KpiCalculationService.php:49), and [KpiAccessEvaluatorService.php](/var/www/laravel-react-dev/app/Services/KpiAccessEvaluatorService.php:25).
- Governance and academic scope have explicit transitional concepts: [GovernanceAccessRequest.php](/var/www/laravel-react-dev/app/Models/GovernanceAccessRequest.php:10), [GovernanceAccessRequestService.php](/var/www/laravel-react-dev/app/Services/GovernanceAccessRequestService.php:23), [AcademicScopeResolverService.php](/var/www/laravel-react-dev/app/Services/AcademicScopeResolverService.php:13), [config/academic.php](/var/www/laravel-react-dev/config/academic.php:4), and the governance/academic migrations from 2026-06-03.
- Organization has a future-oriented generic structure model: [OrgUnit.php](/var/www/laravel-react-dev/app/Models/OrgUnit.php:14), [2026_06_03_210000_create_org_units_table.php](/var/www/laravel-react-dev/database/migrations/2026_06_03_210000_create_org_units_table.php:13), and [2026_06_03_220000_create_org_unit_mappings_table.php](/var/www/laravel-react-dev/database/migrations/2026_06_03_220000_create_org_unit_mappings_table.php:13).
- Questionnaire student submission is one of the cleaner service boundaries: [QuestionnaireSurveyService.php](/var/www/laravel-react-dev/app/Services/Questionnaire/QuestionnaireSurveyService.php:23).
- Platonus is explicitly scaffolded as future integration rather than silently treated as authoritative: [PlatonusSyncService.php](/var/www/laravel-react-dev/app/Services/PlatonusSyncService.php:11), [2026_06_08_100000_create_platonus_sync_tables.php](/var/www/laravel-react-dev/database/migrations/2026_06_08_100000_create_platonus_sync_tables.php:7).

Primary DDD conclusion: the system is suitable for continued development only if it is treated as a modular monolith refactoring program now. Continuing to add features directly into shared controllers, `routes/web.php`, and the `User` model will increase coupling faster than the university ecosystem can govern it.

## 2. Audit Method

The requested directories were inventoried with repository-wide search and file enumeration. The scan covered:

- 80 controllers under `app/Http/Controllers`.
- 94 models under `app/Models`.
- 33 services under `app/Services`.
- 140 migration files under `database/migrations`.
- Routes in [routes/web.php](/var/www/laravel-react-dev/routes/web.php:1) and [routes/api.php](/var/www/laravel-react-dev/routes/api.php:1).
- Middleware aliases in [bootstrap/app.php](/var/www/laravel-react-dev/bootstrap/app.php:38).
- Policies, observers, listeners, providers, console commands, and React pages/components.

The report cites files that contain domain behavior. Passive files and UI pages were included in inventory and domain mapping where they define a visible domain surface.

## 3. Domain Map

| Domain | Purpose | Main data and behavior found | Evidence |
|---|---|---|---|
| Identity and Authentication | Login, AD authentication, local fallback, session lifecycle, login tracking | AD bind/search, local user fallback, default role assignment, dashboard refresh after login | [LoginRequest.php](/var/www/laravel-react-dev/app/Http/Requests/Auth/LoginRequest.php:65), [AuthenticatedSessionController.php](/var/www/laravel-react-dev/app/Http/Controllers/Auth/AuthenticatedSessionController.php:38), [ActiveDirectoryAuthenticator.php](/var/www/laravel-react-dev/app/Services/ActiveDirectoryAuthenticator.php:260) |
| User Profile and Directory | User records, editable profile, directory administration, manual users, role displays | User fields, profile payload, directory mutations, manual creation, AD search | [User.php](/var/www/laravel-react-dev/app/Models/User.php:47), [ProfileController.php](/var/www/laravel-react-dev/app/Http/Controllers/ProfileController.php:34), [DirectoryUserController.php](/var/www/laravel-react-dev/app/Http/Controllers/DirectoryUserController.php:200) |
| Authorization and Governance | Roles, grants, scoped authority, access requests, approval of authority changes | Role model, legacy role string, governance access requests, scoped grants, delegations, authority ledger | [Role.php](/var/www/laravel-react-dev/app/Models/Role.php:1), [GovernanceAccessRequest.php](/var/www/laravel-react-dev/app/Models/GovernanceAccessRequest.php:10), [ScopedGrant.php](/var/www/laravel-react-dev/app/Models/ScopedGrant.php:1), [Delegation.php](/var/www/laravel-react-dev/app/Models/Delegation.php:1), [GovernanceAccessRequestService.php](/var/www/laravel-react-dev/app/Services/GovernanceAccessRequestService.php:235) |
| Organization and Academic Structure | Faculties, departments, divisions, positions, org units, mappings, academic assignments | Legacy faculty/department/division tables plus generic `org_units`, mappings, positions, academic scope assignments | [Faculty.php](/var/www/laravel-react-dev/app/Models/Faculty.php:1), [Department.php](/var/www/laravel-react-dev/app/Models/Department.php:1), [Division.php](/var/www/laravel-react-dev/app/Models/Division.php:1), [OrgUnit.php](/var/www/laravel-react-dev/app/Models/OrgUnit.php:14), [OrgScopeResolverService.php](/var/www/laravel-react-dev/app/Services/OrgScopeResolverService.php:29) |
| Employee and HR / PERCO | Employee-related attendance and time tracking reports from PERCO | External PERCO DB reads, late/early/overtime/absence calculations, visibility settings | [PercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/PercoController.php:28), [HrPercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/Api/HrPercoController.php:13), [EmployeeProfile.php](/var/www/laravel-react-dev/app/Models/EmployeeProfile.php:1) |
| Student and Academic Context | Student profiles, student binding, educational programs, groups, Platonus readiness | Student profile, legacy student/questionnaire binding, academic scope resolver, Platonus scaffold | [StudentProfile.php](/var/www/laravel-react-dev/app/Models/StudentProfile.php:1), [Student.php](/var/www/laravel-react-dev/app/Models/Student.php:1), [AcademicScopeResolverService.php](/var/www/laravel-react-dev/app/Services/AcademicScopeResolverService.php:47), [Questionnaire/Student.php](/var/www/laravel-react-dev/app/Models/Questionnaire/Student.php:1) |
| KPI | KPI periods, indicators, entries, calculation, review queues, structural confirmation, analytics | KPI entries, periods, indicators, grants, structural units, result calculation, file handling | [KpiEntry.php](/var/www/laravel-react-dev/app/Models/KpiEntry.php:17), [KpiPeriod.php](/var/www/laravel-react-dev/app/Models/KpiPeriod.php:20), [KpiEntryService.php](/var/www/laravel-react-dev/app/Services/KpiEntryService.php:28), [KpiSummaryController.php](/var/www/laravel-react-dev/app/Http/Controllers/KpiSummaryController.php:1) |
| Calendar and Scheduling | Employee calendars, availability, meetings, secretary delegation, holidays, Zoom, WhatsApp | Calendar event lifecycle and conflict rules in route closures, calendar models, Zoom and WhatsApp services | [routes/web.php](/var/www/laravel-react-dev/routes/web.php:573), [CalendarEvent.php](/var/www/laravel-react-dev/app/Models/CalendarEvent.php:1), [CalendarAuditLogger.php](/var/www/laravel-react-dev/app/Services/CalendarAuditLogger.php:12), [ZoomMeetingService.php](/var/www/laravel-react-dev/app/Services/ZoomMeetingService.php:14), [GreenApiWhatsAppNotifier.php](/var/www/laravel-react-dev/app/Services/GreenApiWhatsAppNotifier.php:13) |
| Certificates | Certificate templates, versions, numbering, generation, issue, revoke, verify | Template/version CRUD, certificate generation, public verification, number sequencing | [CertificateRegistryController.php](/var/www/laravel-react-dev/app/Http/Controllers/CertificateRegistryController.php:143), [CertificateTemplateController.php](/var/www/laravel-react-dev/app/Http/Controllers/CertificateTemplateController.php:57), [2026_04_13_180000_create_certificate_module_tables.php](/var/www/laravel-react-dev/database/migrations/2026_04_13_180000_create_certificate_module_tables.php:11) |
| Survey and Questionnaire | Legacy surveys and newer isolated questionnaire module | Two survey concepts: legacy `Survey*` and new `Questionnaire/*` group/discipline/survey/response/answer model | [SurveyStudentController.php](/var/www/laravel-react-dev/app/Http/Controllers/SurveyStudentController.php:1), [AdminSurveyController.php](/var/www/laravel-react-dev/app/Http/Controllers/AdminSurveyController.php:1), [QuestionnaireSurveyService.php](/var/www/laravel-react-dev/app/Services/Questionnaire/QuestionnaireSurveyService.php:23), [AdminDictionaryController.php](/var/www/laravel-react-dev/app/Http/Controllers/Api/Questionnaire/AdminDictionaryController.php:30) |
| Testing and Assessment | Teacher test builder, subject bindings, test questions, test analytics | Testing bindings, tests, questions, results, teacher/admin access | [routes/web.php](/var/www/laravel-react-dev/routes/web.php:122), [TestingModuleController.php](/var/www/laravel-react-dev/app/Http/Controllers/Testing/TestingModuleController.php:17), [TestingTestController.php](/var/www/laravel-react-dev/app/Http/Controllers/Testing/TestingTestController.php:41), [2026_06_30_100100_create_testing_tests_table.php](/var/www/laravel-react-dev/database/migrations/2026_06_30_100100_create_testing_tests_table.php:11) |
| Library | Local library loans/reservations plus external catalog search | Library dashboard/reservations and external catalog route closure | [routes/web.php](/var/www/laravel-react-dev/routes/web.php:471), [Api/LibraryReservationController.php](/var/www/laravel-react-dev/app/Http/Controllers/Api/LibraryReservationController.php:1), [LibraryReservationAdminController.php](/var/www/laravel-react-dev/app/Http/Controllers/LibraryReservationAdminController.php:1), [LibraryLoan.php](/var/www/laravel-react-dev/app/Models/LibraryLoan.php:1) |
| Tickets and Department Requests | User tickets and department request workflow | Public ticket creation, admin ticket views, department requests | [routes/web.php](/var/www/laravel-react-dev/routes/web.php:77), [TicketController.php](/var/www/laravel-react-dev/app/Http/Controllers/TicketController.php:1), [DepartmentRequestController.php](/var/www/laravel-react-dev/app/Http/Controllers/DepartmentRequestController.php:1) |
| Diploma and Topic Review | Diploma records and AI/topic similarity review | Diploma import, topic similarity, AI topic review services | [DiplomaController.php](/var/www/laravel-react-dev/app/Http/Controllers/DiplomaController.php:1), [DiplomaImportService.php](/var/www/laravel-react-dev/app/Services/DiplomaImportService.php:1), [TopicSimilarityService.php](/var/www/laravel-react-dev/app/Services/TopicSimilarityService.php:1), [AiTopicReviewService.php](/var/www/laravel-react-dev/app/Services/AiTopicReviewService.php:1) |
| Announcements, Navigation, Phonebook, Catalog | Campus communications, navigation routes, public directory/catalog UI | Announcements, navigation route administration, phonebook directory | [AnnouncementController.php](/var/www/laravel-react-dev/app/Http/Controllers/AnnouncementController.php:1), [NavigationRouteController.php](/var/www/laravel-react-dev/app/Http/Controllers/NavigationRouteController.php:1), [PhonebookDirectoryController.php](/var/www/laravel-react-dev/app/Http/Controllers/PhonebookDirectoryController.php:1), [resources/js/Pages/Catalog.jsx](/var/www/laravel-react-dev/resources/js/Pages/Catalog.jsx:1) |
| AI Assistant and Knowledge | AI chat/search over navigation and KPI knowledge | API chat controller, KPI knowledge service, navigation route search | [AiChatController.php](/var/www/laravel-react-dev/app/Http/Controllers/Api/AiChatController.php:16), [KpiKnowledgeService.php](/var/www/laravel-react-dev/app/Services/KpiKnowledgeService.php:1), [NavigationRoute.php](/var/www/laravel-react-dev/app/Models/NavigationRoute.php:1) |
| Audit and Monitoring | Cross-cutting activity/audit logs, monitoring pages | Login audit, created-model observer, business activity logger, admin monitoring | [AuditLogService.php](/var/www/laravel-react-dev/app/Services/AuditLogService.php:23), [AuditableModelObserver.php](/var/www/laravel-react-dev/app/Observers/AuditableModelObserver.php:14), [BusinessActivityLogger.php](/var/www/laravel-react-dev/app/Services/BusinessActivityLogger.php:45), [AdminMonitoringController.php](/var/www/laravel-react-dev/app/Http/Controllers/AdminMonitoringController.php:1) |
| Integrations | AD, Platonus, PERCO, external library catalog, Zoom, WhatsApp, AI APIs | Some dedicated services exist, but several integrations are embedded in controllers/routes | [ActiveDirectoryAuthenticator.php](/var/www/laravel-react-dev/app/Services/ActiveDirectoryAuthenticator.php:18), [PlatonusSyncService.php](/var/www/laravel-react-dev/app/Services/PlatonusSyncService.php:11), [PercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/PercoController.php:28), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:471), [ZoomMeetingService.php](/var/www/laravel-react-dev/app/Services/ZoomMeetingService.php:14) |

## 4. Bounded Context Analysis

| Context | Data it currently owns | Business rules it currently owns | Boundary findings | Risk |
|---|---|---|---|---|
| Identity and Authentication | Local `users`, AD identifiers, login tracking fields | AD bind, local fallback, login side effects | `AuthenticatedSessionController::store` assigns a default teacher role and refreshes dashboard cache after login, so authentication triggers authorization/profile/dashboard behavior. [AuthenticatedSessionController.php](/var/www/laravel-react-dev/app/Http/Controllers/Auth/AuthenticatedSessionController.php:38) | High |
| User Profile and Directory | `users`, avatar, profile fields, AD-derived fields, faculty/department ids, role fields | Profile editing, directory admin views, manual user creation, role mutation | This context manipulates governance, KPI grants, Active Directory, and organization fields directly. [DirectoryUserController.php](/var/www/laravel-react-dev/app/Http/Controllers/DirectoryUserController.php:715), [ProfileController.php](/var/www/laravel-react-dev/app/Http/Controllers/ProfileController.php:54) | Critical |
| Governance and Authority | `governance_access_requests`, `scoped_grants`, `delegations` | Submit, review, approve, reject, apply effective changes | Governance has a real service boundary, but `applyEffectiveChange` directly mutates `User`, KPI structural units, and academic assignments. [GovernanceAccessRequestService.php](/var/www/laravel-react-dev/app/Services/GovernanceAccessRequestService.php:389) | High |
| Organization | `faculties`, `departments`, `divisions`, `positions`, `org_units`, `org_unit_mappings` | Org unit hierarchy, mapping legacy org structures to target org units | Organization is split between legacy tables, generic org units, KPI structural units, and User fields. `OrgScopeResolverService` must reconcile these sources at runtime. [OrgScopeResolverService.php](/var/www/laravel-react-dev/app/Services/OrgScopeResolverService.php:29) | High |
| Academic Context | `employee_profiles`, `student_profiles`, `academic_scope_assignments`, Platonus scaffold | Academic source contract, dual employee/student resolution | It is explicitly transitional and mostly read/resolve oriented, which is positive. It still depends on `User` and legacy student tables. [AcademicScopeResolverService.php](/var/www/laravel-react-dev/app/Services/AcademicScopeResolverService.php:47) | Medium |
| KPI | `kpi_periods`, `kpi_indicators`, `kpi_entries`, KPI files/results/grants/structural data | Period lifecycle, entry workflow, queue routing, calculation, structural confirmation | KPI has strong service seeds, but it depends heavily on `User` role/org fields and legacy grants. `User::updated` calls KPI hydration, creating reverse coupling. [User.php](/var/www/laravel-react-dev/app/Models/User.php:157), [KpiEntryService.php](/var/www/laravel-react-dev/app/Services/KpiEntryService.php:460) | High |
| Calendar | Calendar events, slots, secretary access, holidays, notifications | Availability, conflict detection, recurrence, event state transitions, Zoom/WhatsApp side effects | Calendar business rules are implemented in `routes/web.php` closures, not a bounded context service. [routes/web.php](/var/www/laravel-react-dev/routes/web.php:587), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:1016) | Critical |
| Certificates | Templates, versions, certificates, sequences, generation batches/items | Generate, issue, revoke, verify, template publication | Certificate rules are in controllers. `CertificateAuditLog` table/model exist, but certificate controllers do not use it in the reviewed code. [CertificateRegistryController.php](/var/www/laravel-react-dev/app/Http/Controllers/CertificateRegistryController.php:143), [CertificateTemplateController.php](/var/www/laravel-react-dev/app/Http/Controllers/CertificateTemplateController.php:189) | Medium |
| Questionnaire | Questionnaire groups, disciplines, students, teacher disciplines, surveys, questions, responses, answers | Student survey eligibility and submission; admin dictionary management | Student submission is service-backed. Admin dictionary operations are controller-owned and directly manipulate many aggregate-like objects. [QuestionnaireSurveyService.php](/var/www/laravel-react-dev/app/Services/Questionnaire/QuestionnaireSurveyService.php:203), [AdminDictionaryController.php](/var/www/laravel-react-dev/app/Http/Controllers/Api/Questionnaire/AdminDictionaryController.php:30) | High |
| Legacy Survey | Legacy surveys/questions/answers | Legacy survey policies/controllers | Coexists with Questionnaire and duplicates survey vocabulary. [SurveyPolicy.php](/var/www/laravel-react-dev/app/Policies/SurveyPolicy.php:10), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:1757) | High |
| Testing | `testing_bindings`, `testing_tests`, `testing_questions`, `testing_results` | Teacher subject binding, test creation, question validation, analytics | New context is reasonably isolated by namespace, but business validation and analytics live in controllers/traits. [TestingTestController.php](/var/www/laravel-react-dev/app/Http/Controllers/Testing/TestingTestController.php:156), [AuthorizesTestingAccess.php](/var/www/laravel-react-dev/app/Http/Controllers/Testing/Concerns/AuthorizesTestingAccess.php:12) | Medium |
| HR / PERCO | Local settings plus external PERCO database data | Attendance reporting, shift bucketing, lateness/absence/overtime calculations | PERCO integration and HR domain rules are mixed in controller methods and direct DB queries. [PercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/PercoController.php:906), [PercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/PercoController.php:1910) | High |
| Library | Local loans/reservations and external catalog results | Catalog availability adjustment and reservation handling | External catalog lookup is a route closure that combines HTTP integration and local loan adjustment. [routes/web.php](/var/www/laravel-react-dev/routes/web.php:471) | Medium |
| Audit | `audit_logs`, activity logs, monitoring snapshots | Login audit and created-model audit | Domain events are not implemented. Audit is triggered by Laravel login listener, observer, and explicit logger calls. [AppServiceProvider.php](/var/www/laravel-react-dev/app/Providers/AppServiceProvider.php:72), [AuditableModelObserver.php](/var/www/laravel-react-dev/app/Observers/AuditableModelObserver.php:14) | Medium |
| Integrations | AD, Platonus, PERCO, Zoom, WhatsApp, AI, library catalog | External communications and mapping | AD/Platonus/Zoom/WhatsApp services exist. PERCO and library catalog integration leak into controllers/routes. Anti-corruption layers are partial. | High |

## 5. Dependency Graph

High-level runtime dependency graph observed from controllers, services, models, middleware, and routes:

```text
Presentation
  routes/web.php, routes/api.php, React pages, middleware
    |
    v
User/Profile/Directory
  User model, ProfileController, DirectoryUserController
    |        |          |           |
    |        |          |           v
    |        |          |        Active Directory integration
    |        |          v
    |        |       GovernanceAccessRequestService
    |        |          |
    |        |          v
    |        |       User + AcademicScopeAssignment + KPI structural data
    |        v
    |     Organization legacy tables + OrgScopeResolver
    v
KPI services and policies
  KpiEntryService -> KpiCalculationService -> KpiResult
  KpiAccessEvaluatorService -> OrgScopeResolver + ScopedAuthorityLedger + AcademicScopeResolver

Calendar route closures
  CalendarEvent/Slot/Grant/Secretary/Holiday models
    |
    +-> CalendarAuditLogger
    +-> ZoomMeetingService
    +-> GreenApiWhatsAppNotifier
    +-> User / AD title patterns

Questionnaire
  QuestionnaireSurveyService -> Questionnaire models + User/student binding
  AdminDictionaryController -> Questionnaire models + Department + User + AD + raw DB analytics

HR / PERCO
  PercoController -> external PERCO DB + AppSetting + local holidays + HR calculations

Certificates
  Certificate controllers -> certificate templates/versions/sequences/certificates + User

Audit
  Login listener + AuditableModelObserver + BusinessActivityLogger
```

Important hidden or implicit dependencies:

- `User` model depends on KPI via `KpiEntryStructureHydrationService` inside an Eloquent `updated` callback. [User.php](/var/www/laravel-react-dev/app/Models/User.php:157)
- Middleware depends on Calendar, KPI grants, user role resolution, and governance authority. [EnsurePanelRoleAccess.php](/var/www/laravel-react-dev/app/Http/Middleware/EnsurePanelRoleAccess.php:23)
- Inertia shared props duplicate Calendar and KPI data lookups. [HandleInertiaRequests.php](/var/www/laravel-react-dev/app/Http/Middleware/HandleInertiaRequests.php:48)
- React navigation duplicates role/grant/module visibility decisions. [app-sidebar.jsx](/var/www/laravel-react-dev/resources/js/components/app-sidebar.jsx:122)
- The Library external catalog integration is embedded in `routes/web.php`. [routes/web.php](/var/www/laravel-react-dev/routes/web.php:471)
- Platonus sync is intentionally scaffold-only; live integration is not implemented. [PlatonusSyncService.php](/var/www/laravel-react-dev/app/Services/PlatonusSyncService.php:11)

## 6. Cyclic Dependency Audit

| Cycle | Evidence | Why it exists | DDD impact | Priority |
|---|---|---|---|---|
| User -> KPI -> User | `User::updated` calls `KpiEntryStructureHydrationService`; KPI services and policies read `User` role/faculty/department/grants. [User.php](/var/www/laravel-react-dev/app/Models/User.php:157), [KpiEntryService.php](/var/www/laravel-react-dev/app/Services/KpiEntryService.php:800), [KpiEntryPolicy.php](/var/www/laravel-react-dev/app/Policies/KpiEntryPolicy.php:503) | KPI structure is recalculated when profile/org fields change. | Identity/profile changes have KPI side effects; aggregate boundary is unclear. | P0/P1 |
| User/Profile/Directory -> Governance -> User/KPI | Profile and Directory submit governance requests; Governance service mutates user/org/KPI assignments. [ProfileController.php](/var/www/laravel-react-dev/app/Http/Controllers/ProfileController.php:469), [DirectoryUserController.php](/var/www/laravel-react-dev/app/Http/Controllers/DirectoryUserController.php:974), [GovernanceAccessRequestService.php](/var/www/laravel-react-dev/app/Services/GovernanceAccessRequestService.php:389) | Governance is used as a transition layer for profile and authority changes. | Governance becomes both workflow context and data mutation gateway for several domains. | P1 |
| Organization -> User -> KPI -> Organization | `OrgScopeResolverService` resolves from User faculty/department/divisions/KPI structural units; KPI stores faculty/department on entries; governance maps org data into KPI. [OrgScopeResolverService.php](/var/www/laravel-react-dev/app/Services/OrgScopeResolverService.php:29), [KpiEntryService.php](/var/www/laravel-react-dev/app/Services/KpiEntryService.php:245), [GovernanceAccessRequestService.php](/var/www/laravel-react-dev/app/Services/GovernanceAccessRequestService.php:634) | Legacy org fields and KPI-specific structure coexist. | Scope calculation is runtime reconciliation, not a single aggregate boundary. | P1 |
| Calendar -> User/AD titles -> Calendar access | Calendar access uses `User` and AD title patterns in middleware and Inertia props; calendar routes manage grants/exclusions. [EnsurePanelRoleAccess.php](/var/www/laravel-react-dev/app/Http/Middleware/EnsurePanelRoleAccess.php:276), [HandleInertiaRequests.php](/var/www/laravel-react-dev/app/Http/Middleware/HandleInertiaRequests.php:116), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:942) | Calendar domain lacks its own access/application service. | Business access rules are duplicated and implicit. | P1 |
| Questionnaire -> User/Profile -> Questionnaire | Questionnaire student binding uses local User/student data; Profile resolves questionnaire student binding. [QuestionnaireSurveyService.php](/var/www/laravel-react-dev/app/Services/Questionnaire/QuestionnaireSurveyService.php:323), [ProfileController.php](/var/www/laravel-react-dev/app/Http/Controllers/ProfileController.php:507) | Student identity is not owned by one student context yet. | Student profile and survey student concepts can diverge. | P2 |
| Certificate -> User -> Certificate | Certificates reference users; User has issued certificate relation. [CertificateRegistryController.php](/var/www/laravel-react-dev/app/Http/Controllers/CertificateRegistryController.php:143), [User.php](/var/www/laravel-react-dev/app/Models/User.php:220) | Issued certificates are user-visible. | Low risk if issuance is moved behind a service. | P3 |

## 7. Domain Ownership Matrix

| Entity | Current owner in code | Who reads/modifies today | Ownership violations or uncertainty |
|---|---|---|---|
| User | Shared identity/profile/directory aggregate | Auth, Profile, Directory, Governance, KPI, Calendar, Certificates, Questionnaire, Testing, Audit | Over-owned. `User` is the primary god model. [User.php](/var/www/laravel-react-dev/app/Models/User.php:47) |
| EmployeeProfile | Academic/employee context | AcademicScopeResolver reads it; migration owns table | Thin profile child of User; employee domain aggregate not established. [EmployeeProfile.php](/var/www/laravel-react-dev/app/Models/EmployeeProfile.php:1) |
| StudentProfile | Academic/student context | AcademicScopeResolver reads it; migrations own table | Coexists with legacy `Student` and `Questionnaire\Student`; authoritative ownership unclear. [StudentProfile.php](/var/www/laravel-react-dev/app/Models/StudentProfile.php:1) |
| Faculty, Department, Division | Legacy organization | Controllers, User, KPI, Governance, OrgScopeResolver | Legacy org data is directly referenced across domains. [OrgScopeResolverService.php](/var/www/laravel-react-dev/app/Services/OrgScopeResolverService.php:77) |
| OrgUnit | Target organization catalog | OrgStructureController, OrgUnitMapping, OrgScopeResolver | Good candidate for Organization aggregate root, but not yet the single owner. [OrgUnit.php](/var/www/laravel-react-dev/app/Models/OrgUnit.php:14) |
| Position | Organization/HR/Governance | Profile, Directory, Governance, Position controllers | Position changes are mixed with governance and user profile. [GovernanceAccessRequestService.php](/var/www/laravel-react-dev/app/Services/GovernanceAccessRequestService.php:91) |
| Role | Authorization/Governance | User model, Directory, migrations, middleware, policies | Legacy `users.role` and `role_id` coexist. [2026_03_05_202000_add_role_to_users_table.php](/var/www/laravel-react-dev/database/migrations/2026_03_05_202000_add_role_to_users_table.php:14), [2026_03_10_131000_add_role_id_to_users_table.php](/var/www/laravel-react-dev/database/migrations/2026_03_10_131000_add_role_id_to_users_table.php:15) |
| ScopedGrant, Delegation | Governance/authority | Models and migrations exist; services use authority ledger | Authority concepts exist but legacy KPI grant is still active. [2026_06_03_240000_create_scoped_grants_table.php](/var/www/laravel-react-dev/database/migrations/2026_06_03_240000_create_scoped_grants_table.php:11), [2026_06_03_241000_create_delegations_table.php](/var/www/laravel-react-dev/database/migrations/2026_06_03_241000_create_delegations_table.php:11) |
| KpiPeriod | KPI | KpiPeriodService, controllers, policies | Stronger ownership than most domains. [KpiPeriodService.php](/var/www/laravel-react-dev/app/Services/KpiPeriodService.php:15) |
| KpiEntry | KPI | KpiEntryService, KpiEntryController, policies, observers | KPI owns it, but User/org changes hydrate entry structure. [KpiEntry.php](/var/www/laravel-react-dev/app/Models/KpiEntry.php:89), [User.php](/var/www/laravel-react-dev/app/Models/User.php:157) |
| CalendarEvent | Calendar | Route closures, Calendar controllers, Inertia props, services | Calendar aggregate rules are not owned by a service/model. [routes/web.php](/var/www/laravel-react-dev/routes/web.php:1016) |
| Certificate | Certificates | CertificateRegistryController, User relation | Certificate issuance rules are controller-owned. [CertificateRegistryController.php](/var/www/laravel-react-dev/app/Http/Controllers/CertificateRegistryController.php:143) |
| Survey | Legacy Survey | Survey controllers/policies | Coexists with Questionnaire; legacy ownership should be isolated. [SurveyPolicy.php](/var/www/laravel-react-dev/app/Policies/SurveyPolicy.php:10) |
| Questionnaire Survey/Response | Questionnaire | QuestionnaireSurveyService and AdminDictionaryController | Student response aggregate partly protected by service; admin CRUD bypasses service. [QuestionnaireSurveyService.php](/var/www/laravel-react-dev/app/Services/Questionnaire/QuestionnaireSurveyService.php:203) |
| TestingTest | Testing | Testing controllers | Aggregate logic and validation are controller-owned. [TestingTestController.php](/var/www/laravel-react-dev/app/Http/Controllers/Testing/TestingTestController.php:41) |
| Ticket | Tickets | Ticket controllers, audit observer | Simple aggregate; deeper workflow ownership not evident. [AppServiceProvider.php](/var/www/laravel-react-dev/app/Providers/AppServiceProvider.php:83) |
| AuditLog | Audit | AuditLogService, observer, admin view | Domain events are not implemented; audit is technical cross-cutting. [AuditLogService.php](/var/www/laravel-react-dev/app/Services/AuditLogService.php:23) |

## 8. Aggregate Analysis

### User Aggregate

- Current root: `User`.
- Current children/relations: divisions, KPI structural units, KPI grants, scoped grants, delegations, activity snapshot, issued certificates, employee profile, student profile, academic assignments, position, role, faculty, department, division. Evidence: [User.php](/var/www/laravel-react-dev/app/Models/User.php:170).
- Invariants found: role synchronization in `saving`, role resolution, KPI hydration on org field changes. Evidence: [User.php](/var/www/laravel-react-dev/app/Models/User.php:122), [User.php](/var/www/laravel-react-dev/app/Models/User.php:250).
- Violations: the aggregate is too broad. It has identity, org assignment, authorization, KPI, certificates, student/employee profile, and delegation relationships.

### Governance Access Request Aggregate

- Current root: `GovernanceAccessRequest`.
- Children: requested/current values, approver, subject, requester, metadata.
- Invariants: pending duplicate prevention, authority route resolution, approve/reject state changes, effective application. Evidence: [GovernanceAccessRequestService.php](/var/www/laravel-react-dev/app/Services/GovernanceAccessRequestService.php:335), [GovernanceAccessRequestService.php](/var/www/laravel-react-dev/app/Services/GovernanceAccessRequestService.php:235).
- Violation: applying an approved request mutates multiple external aggregates directly, especially User and KPI structural assignments. [GovernanceAccessRequestService.php](/var/www/laravel-react-dev/app/Services/GovernanceAccessRequestService.php:389).

### Organization Aggregate

- Current roots: legacy `Faculty`, `Department`, `Division`, and target `OrgUnit`.
- Children: OrgUnit mappings, hierarchy, leader relations, legacy model mappings.
- Invariants found: Org unit type catalog and parent/child relations. [OrgUnit.php](/var/www/laravel-react-dev/app/Models/OrgUnit.php:14).
- Violations: Organization is not the sole owner of faculty/department/division assignments; User, KPI, and Governance manipulate related fields.

### KPI Period Aggregate

- Current root: `KpiPeriod`.
- Children: KPI entries and indicators are related operationally; period itself tracks scope activation.
- Invariants: date conflict, active period uniqueness, scope activation, close/deactivate rules. Evidence: [KpiPeriodService.php](/var/www/laravel-react-dev/app/Services/KpiPeriodService.php:15), [KpiPeriod.php](/var/www/laravel-react-dev/app/Models/KpiPeriod.php:111).
- Assessment: this is one of the better aggregate candidates.

### KPI Entry Aggregate

- Current root: `KpiEntry`.
- Children: files, status logs, structural confirmations.
- Invariants: editable/submittable/approvable/locked states in model; workflow transitions in service and policy. Evidence: [KpiEntry.php](/var/www/laravel-react-dev/app/Models/KpiEntry.php:163), [KpiEntryService.php](/var/www/laravel-react-dev/app/Services/KpiEntryService.php:218).
- Violations: file storage cleanup, policy authorization, queue workflow, org scope, and calculation are interleaved in one service. [KpiEntryService.php](/var/www/laravel-react-dev/app/Services/KpiEntryService.php:749), [KpiEntryService.php](/var/www/laravel-react-dev/app/Services/KpiEntryService.php:773).

### Calendar Event Aggregate

- Current root: `CalendarEvent`.
- Children: attendee/organizer, slots, secretary access, notification logs, audit logs, Zoom meeting data.
- Invariants: not on model/service; implemented inside route closures.
- Violations: conflict detection, recurrence, access, event state transitions, notification, audit, and Zoom integration live in [routes/web.php](/var/www/laravel-react-dev/routes/web.php:587), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:1379).

### Certificate Aggregate

- Current roots: `CertificateTemplate`, `CertificateTemplateVersion`, `Certificate`, `CertificateNumberSequence`.
- Invariants: sequence allocation, version publication, status transitions.
- Violations: generation, publication, issue, revoke, and sequence allocation are controller-owned. [CertificateRegistryController.php](/var/www/laravel-react-dev/app/Http/Controllers/CertificateRegistryController.php:143), [CertificateTemplateController.php](/var/www/laravel-react-dev/app/Http/Controllers/CertificateTemplateController.php:189).

### Questionnaire Aggregate

- Current roots: `Questionnaire\Survey` and `Questionnaire\Response`.
- Children: questions, options, answers, group/discipline/teacher mappings.
- Invariants: survey window, group discipline, target group, duplicate response, question answer validation. Evidence: [QuestionnaireSurveyService.php](/var/www/laravel-react-dev/app/Services/Questionnaire/QuestionnaireSurveyService.php:203), [QuestionnaireSurveyService.php](/var/www/laravel-react-dev/app/Services/Questionnaire/QuestionnaireSurveyService.php:356).
- Violations: admin dictionary CRUD and analytics are controller-owned. [AdminDictionaryController.php](/var/www/laravel-react-dev/app/Http/Controllers/Api/Questionnaire/AdminDictionaryController.php:232).

### Testing Aggregate

- Current roots: `TestingBinding`, `TestingTest`.
- Children: testing questions and results.
- Invariants: teacher owns binding, test question count, question answer validity, passing score limits.
- Violations: invariants are in controller validation and private helpers, not in a testing application service or aggregate methods. [TestingTestController.php](/var/www/laravel-react-dev/app/Http/Controllers/Testing/TestingTestController.php:156), [TestingTestController.php](/var/www/laravel-react-dev/app/Http/Controllers/Testing/TestingTestController.php:233).

## 9. Service Layer Audit

| Service | Classification | Finding |
|---|---|---|
| [KpiEntryService.php](/var/www/laravel-react-dev/app/Services/KpiEntryService.php:28) | Application service with domain rules | Central KPI workflow service. It contains real business transitions, but also storage cleanup, org scope, approval routing, and calculation orchestration. |
| [KpiPeriodService.php](/var/www/laravel-react-dev/app/Services/KpiPeriodService.php:15) | Application/domain service | Strong candidate for KPI period boundary; contains lifecycle and conflict rules. |
| [KpiCalculationService.php](/var/www/laravel-react-dev/app/Services/KpiCalculationService.php:49) | Domain calculation service | Owns KPI scoring and thresholds, but reads User position/department directly. |
| [KpiAccessEvaluatorService.php](/var/www/laravel-react-dev/app/Services/KpiAccessEvaluatorService.php:25) | Application access evaluator | Transitional service reconciling roles, org, authority, academic context, and legacy grants. Useful, but indicates unresolved context boundaries. |
| [GovernanceAccessRequestService.php](/var/www/laravel-react-dev/app/Services/GovernanceAccessRequestService.php:23) | Application workflow service | Clear submit/approve/reject lifecycle, but directly mutates User, KPI, and academic assignments. |
| [AcademicScopeResolverService.php](/var/www/laravel-react-dev/app/Services/AcademicScopeResolverService.php:47) | Domain/application resolver | Good contract layer; current function is resolving and normalizing context, not owning source data. |
| [OrgScopeResolverService.php](/var/www/laravel-react-dev/app/Services/OrgScopeResolverService.php:29) | Domain resolver | Reconciles legacy and target org sources; useful transitional adapter, not a final aggregate boundary. |
| [ActiveDirectoryAuthenticator.php](/var/www/laravel-react-dev/app/Services/ActiveDirectoryAuthenticator.php:18) | Infrastructure integration plus identity application behavior | AD operations are isolated here, but local User upsert is also performed here. |
| [PlatonusSyncService.php](/var/www/laravel-react-dev/app/Services/PlatonusSyncService.php:11) | Infrastructure scaffold | Live Platonus sync is not implemented. Explicit scaffold status is good. |
| [CalendarAuditLogger.php](/var/www/laravel-react-dev/app/Services/CalendarAuditLogger.php:12) | Infrastructure/audit service | Request-coupled audit helper. It is not a Calendar domain service. |
| [ZoomMeetingService.php](/var/www/laravel-react-dev/app/Services/ZoomMeetingService.php:14) | Infrastructure gateway | Integration service is isolated, but route closures call it as part of Calendar workflow. |
| [GreenApiWhatsAppNotifier.php](/var/www/laravel-react-dev/app/Services/GreenApiWhatsAppNotifier.php:13) | Infrastructure gateway | Integration is isolated, but delivery decisions are made by Calendar route closures. |
| [QuestionnaireSurveyService.php](/var/www/laravel-react-dev/app/Services/Questionnaire/QuestionnaireSurveyService.php:23) | Application/domain service | Good service boundary for student survey availability and submission. |
| [SurveyService.php](/var/www/laravel-react-dev/app/Services/SurveyService.php:1) | Legacy survey service | Coexists with Questionnaire. Target ownership is unclear without a legacy isolation plan. |
| [DiplomaImportService.php](/var/www/laravel-react-dev/app/Services/DiplomaImportService.php:1) | Application/infrastructure service | Import-oriented service. Diploma aggregate rules were not found in a dedicated domain service. |
| [TopicSimilarityService.php](/var/www/laravel-react-dev/app/Services/TopicSimilarityService.php:1) | Domain/infrastructure hybrid | Topic matching logic is a domain-adjacent service. |
| [AuditLogService.php](/var/www/laravel-react-dev/app/Services/AuditLogService.php:23) | Cross-cutting infrastructure/application service | Supports login and created events only for a fixed model list. Domain events are not implemented. |
| [BusinessActivityLogger.php](/var/www/laravel-react-dev/app/Services/BusinessActivityLogger.php:45) | Cross-cutting infrastructure service | Spatie activity logging wrapper; request-coupled. |

Not implemented:

- Dedicated `CalendarSchedulingService`.
- Dedicated `CertificateIssuanceService`.
- Dedicated `QuestionnaireAdminService`.
- Dedicated `TestingAssessmentService`.
- Dedicated `HrPercoGateway` or HR attendance domain service.
- Dedicated `LibraryCatalogGateway`.
- Domain event dispatcher/listener model for business events under `app/Events`.
- Background jobs under `app/Jobs`.
- Laravel notifications under `app/Notifications`.

## 10. Model Audit

The Eloquent model layer is mostly anemic, with a few domain-rich exceptions.

Domain-rich or partially rich models:

- [KpiEntry.php](/var/www/laravel-react-dev/app/Models/KpiEntry.php:163) contains status constants and state predicates such as `canBeEdited`, `canBeSubmitted`, `canBeApproved`, and `isLocked`.
- [KpiPeriod.php](/var/www/laravel-react-dev/app/Models/KpiPeriod.php:111) contains date and scope helpers.
- [GovernanceAccessRequest.php](/var/www/laravel-react-dev/app/Models/GovernanceAccessRequest.php:10) contains request type/status/route constants and field classification constants.
- [OrgUnit.php](/var/www/laravel-react-dev/app/Models/OrgUnit.php:14) contains org unit taxonomy constants and labels.
- [User.php](/var/www/laravel-react-dev/app/Models/User.php:122) contains role normalization and resolution behavior, but this is also part of its god-model problem.

Mostly passive/anemic models:

- Calendar models such as [CalendarEvent.php](/var/www/laravel-react-dev/app/Models/CalendarEvent.php:1) and related slot/access/holiday/log models store state while route closures implement behavior.
- Certificate models store templates, versions, certificates, and sequences while controllers implement issuance behavior.
- Questionnaire models store survey/dictionary/response data while `QuestionnaireSurveyService` and `AdminDictionaryController` implement behavior.
- Testing models store bindings/tests/questions/results while controllers implement validation and analytics.
- Library, ticket, announcement, navigation, and phonebook models appear mostly CRUD/read-model oriented.

God model finding:

- `User` is the main god model. It imports and relates to many domain concepts and triggers KPI side effects on update. Evidence: imports and fillable fields at [User.php](/var/www/laravel-react-dev/app/Models/User.php:16), relations at [User.php](/var/www/laravel-react-dev/app/Models/User.php:170), update hook at [User.php](/var/www/laravel-react-dev/app/Models/User.php:157).

## 11. Controller Audit

Thin-controller pattern is not consistently followed. Several controllers are application services in disguise.

| Controller or route area | Finding |
|---|---|
| [routes/web.php Calendar group](/var/www/laravel-react-dev/routes/web.php:573) | The largest DDD violation. Scheduling rules, recurrence, slot generation, conflict checks, grants, secretary access, event state transitions, Zoom, WhatsApp, and audit are implemented in route closures. |
| [KpiEntryController.php](/var/www/laravel-react-dev/app/Http/Controllers/KpiEntryController.php:1) and [KpiSummaryController.php](/var/www/laravel-react-dev/app/Http/Controllers/KpiSummaryController.php:1) | KPI controllers are large and coordinate query, workflow, presentation payloads, and exports. KPI services exist but do not absorb all application behavior. |
| [DirectoryUserController.php](/var/www/laravel-react-dev/app/Http/Controllers/DirectoryUserController.php:35) | Cross-domain orchestrator for directory, role access, KPI grants, governance requests, AD search, manual user creation, and role mapping. |
| [ProfileController.php](/var/www/laravel-react-dev/app/Http/Controllers/ProfileController.php:54) | Mixes profile edit, field governance, WhatsApp verification, student binding, certificates, KPI grants, elevated authority, and activity. |
| [GovernanceAccessRequestController.php](/var/www/laravel-react-dev/app/Http/Controllers/GovernanceAccessRequestController.php:33) | Uses a service for state transitions, but also builds complex read models and cross-domain display values. |
| [PercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/PercoController.php:28) | External PERCO integration, HR calculations, reporting, settings, and visibility are controller-owned. |
| [AdminDictionaryController.php](/var/www/laravel-react-dev/app/Http/Controllers/Api/Questionnaire/AdminDictionaryController.php:30) | Very broad questionnaire administration controller with direct model CRUD, AD search, and raw response aggregation. |
| [CertificateRegistryController.php](/var/www/laravel-react-dev/app/Http/Controllers/CertificateRegistryController.php:143) | Certificate generation, issue, revoke, verification, CSV export, and sequence allocation live in the controller. |
| [TestingTestController.php](/var/www/laravel-react-dev/app/Http/Controllers/Testing/TestingTestController.php:41) | Test creation/update and question synchronization are controller-owned. |
| [OrgStructureController.php](/var/www/laravel-react-dev/app/Http/Controllers/OrgStructureController.php:317) | Org unit write operations are controller-owned. |

## 12. Integration Boundaries

| Integration | Boundary status | Evidence |
|---|---|---|
| Active Directory | Partially isolated in service; local User synchronization happens inside integration service | [ActiveDirectoryAuthenticator.php](/var/www/laravel-react-dev/app/Services/ActiveDirectoryAuthenticator.php:391) |
| Platonus | Explicit scaffold, no live sync implemented | [PlatonusSyncService.php](/var/www/laravel-react-dev/app/Services/PlatonusSyncService.php:11), [2026_06_08_100000_create_platonus_sync_tables.php](/var/www/laravel-react-dev/database/migrations/2026_06_08_100000_create_platonus_sync_tables.php:7) |
| PERCO | Not isolated; external DB queries and HR calculations are in controllers | [PercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/PercoController.php:28), [HrPercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/Api/HrPercoController.php:13) |
| Library catalog | Not isolated; external HTTP request and local availability adjustment in route closure | [routes/web.php](/var/www/laravel-react-dev/routes/web.php:471) |
| Zoom | Isolated gateway exists, but Calendar workflow calls it directly from routes | [ZoomMeetingService.php](/var/www/laravel-react-dev/app/Services/ZoomMeetingService.php:14), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:1485) |
| WhatsApp / Green API | Isolated gateway exists, but delivery decisions are route-owned | [GreenApiWhatsAppNotifier.php](/var/www/laravel-react-dev/app/Services/GreenApiWhatsAppNotifier.php:25), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:1421) |
| AI | API/controller and services exist; domain boundary between AI, navigation, and KPI knowledge is not explicit | [AiChatController.php](/var/www/laravel-react-dev/app/Http/Controllers/Api/AiChatController.php:16), [KpiKnowledgeService.php](/var/www/laravel-react-dev/app/Services/KpiKnowledgeService.php:1) |

## 13. Domain Events and Asynchronous Boundaries

Implemented:

- Laravel `Login` event is listened to by [LogSuccessfulLogin.php](/var/www/laravel-react-dev/app/Listeners/LogSuccessfulLogin.php:14).
- `AuditableModelObserver` listens to `created` events for selected models and writes audit logs. [AuditableModelObserver.php](/var/www/laravel-react-dev/app/Observers/AuditableModelObserver.php:14), [AppServiceProvider.php](/var/www/laravel-react-dev/app/Providers/AppServiceProvider.php:74).

Not implemented:

- `app/Events` directory: not present in the scanned application.
- `app/Jobs` directory: not present in the scanned application.
- `app/Notifications` directory: not present in the scanned application.
- Domain events such as `GovernanceRequestApproved`, `KpiEntrySubmitted`, `KpiEntryApproved`, `CalendarEventConfirmed`, `CertificateIssued`, `QuestionnaireSubmitted`, or `TestingResultCompleted`.

Architecture finding: domains communicate primarily by direct controller/service/model calls, not events. This is workable for a small monolith but creates tight runtime dependencies as the platform grows.

## 14. Layering Review

Expected direction:

```text
Presentation
  -> Application
    -> Domain
      -> Infrastructure
```

Observed violations:

- Presentation layer contains domain behavior: Calendar route closures in [routes/web.php](/var/www/laravel-react-dev/routes/web.php:573).
- Controllers call external infrastructure directly: PERCO in [PercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/PercoController.php:28) and external library catalog in [routes/web.php](/var/www/laravel-react-dev/routes/web.php:471).
- Models call services: `User::updated` resolves `KpiEntryStructureHydrationService`. [User.php](/var/www/laravel-react-dev/app/Models/User.php:157).
- Middleware contains domain/application access rules and reads domain models: [EnsurePanelRoleAccess.php](/var/www/laravel-react-dev/app/Http/Middleware/EnsurePanelRoleAccess.php:276), [EnsurePanelRoleAccess.php](/var/www/laravel-react-dev/app/Http/Middleware/EnsurePanelRoleAccess.php:352).
- Inertia middleware computes domain counts and access: [HandleInertiaRequests.php](/var/www/laravel-react-dev/app/Http/Middleware/HandleInertiaRequests.php:55), [HandleInertiaRequests.php](/var/www/laravel-react-dev/app/Http/Middleware/HandleInertiaRequests.php:70).
- React navigation mirrors domain access decisions: [app-sidebar.jsx](/var/www/laravel-react-dev/resources/js/components/app-sidebar.jsx:122).
- Policies contain business workflow logic beyond access checks, especially KPI entry workflow. [KpiEntryPolicy.php](/var/www/laravel-react-dev/app/Policies/KpiEntryPolicy.php:186).

Layering assessment: the current layering is Laravel conventional, not DDD strict. The immediate target should be a modular monolith with application services per bounded context, not a full microservice split.

## 15. Configuration and API Surface Review

Configuration files are not only infrastructure in this application. Some configuration carries domain policy and should be treated as part of bounded-context ownership.

| Area | Finding | Evidence |
|---|---|---|
| Academic source contract | `config/academic.php` clearly states AD identity source, future Platonus upstream source, CRM governance permission source, an explicit upstream trust boundary, scope dimensions, assignment types, and mobile payload expectations. This is a positive architecture artifact for the Academic Context and Governance contexts. | [config/academic.php](/var/www/laravel-react-dev/config/academic.php:4) |
| KPI domain policy | `config/kpi.php` contains KPI scoring thresholds, position keyword groups, hard-check eligibility, and governance migration mode. This means KPI business policy is partly configuration-owned and should remain under KPI bounded-context governance. | [config/kpi.php](/var/www/laravel-react-dev/config/kpi.php:4), [config/kpi.php](/var/www/laravel-react-dev/config/kpi.php:79), [config/kpi.php](/var/www/laravel-react-dev/config/kpi.php:88) |
| External services | `config/services.php`, `config/ad.php`, and database configuration support external integrations, but boundary enforcement is inconsistent because PERCO and Library catalog calls are made from controllers/routes. | [ActiveDirectoryAuthenticator.php](/var/www/laravel-react-dev/app/Services/ActiveDirectoryAuthenticator.php:18), [PercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/PercoController.php:28), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:471) |
| Web route surface | `routes/web.php` is the dominant application surface and contains many domains in one file, including testing, profile, organization, KPI, HR, Calendar, Certificates, Survey, Questionnaire, and Governance. | [routes/web.php](/var/www/laravel-react-dev/routes/web.php:122), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:251), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:573), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:1806) |
| API route surface | `routes/api.php` exposes authentication, announcements, navigation, tickets, library reservations, AI chat, access summary, HR/PERCO, and Questionnaire APIs. The API surface is not yet backed by consistent context application services. | [routes/api.php](/var/www/laravel-react-dev/routes/api.php:19), [routes/api.php](/var/www/laravel-react-dev/routes/api.php:35), [routes/api.php](/var/www/laravel-react-dev/routes/api.php:62) |

Architecture finding: `config/academic.php` is aligned with target domain architecture. `config/kpi.php` should be treated as KPI domain policy rather than generic app configuration. The route files should become adapters over application services, especially for mobile/API readiness.

## 16. Scalability Assessment

For 100,000 users and multiple campuses/colleges/modules, the primary bottlenecks are architectural, not only database-level:

- Central `User` model as shared aggregate makes every new domain tempted to add fields, relations, and callbacks. [User.php](/var/www/laravel-react-dev/app/Models/User.php:47).
- Calendar route closures will become hard to test, version, queue, and reuse for mobile/API channels. [routes/web.php](/var/www/laravel-react-dev/routes/web.php:573).
- PERCO/HR reporting logic in controllers makes external schema changes dangerous. [PercoController.php](/var/www/laravel-react-dev/app/Http/Controllers/PercoController.php:28).
- Survey/Questionnaire duplication will complicate analytics, mobile API, data retention, and student ownership. [routes/web.php](/var/www/laravel-react-dev/routes/web.php:1757), [routes/web.php](/var/www/laravel-react-dev/routes/web.php:1806).
- Organization is split across legacy tables, target `org_units`, User fields, KPI structures, and mappings. [OrgScopeResolverService.php](/var/www/laravel-react-dev/app/Services/OrgScopeResolverService.php:29).
- Lack of domain events means synchronous chains will grow as workflows, notifications, audit, integrations, and mobile push are added.
- Mobile API readiness is limited because much application behavior is embedded in Inertia controllers/routes rather than reusable application services.
- Future AD and Platonus integration readiness is partial: services/scaffolds exist, but source-of-truth boundaries are not yet enforced by aggregate ownership.

## 17. Technical Debt Assessment

| Severity | Debt | Impact | Recommended refactoring direction | Difficulty |
|---|---|---|---|---|
| Critical | Calendar domain implemented in route closures | Hard to test, reuse, queue, expose via API, or safely change | Extract `CalendarSchedulingService`, `CalendarAvailabilityService`, and `CalendarNotificationOrchestrator`; keep routes as adapters | Medium |
| Critical | `User` god model and cross-domain callback into KPI | Hidden side effects, aggregate confusion, hard future IAM/org changes | Move KPI hydration behind explicit application event/service; introduce profile/identity read models | High |
| High | Directory/Profile controllers mutate many domains | Directory becomes uncontrolled integration surface | Introduce `UserDirectoryService`, `ProfileGovernanceService`, and context-specific command handlers | Medium |
| High | Governance service directly applies external domain mutations | Governance owns too much effective state application | Keep service but delegate final mutations to target context services | Medium |
| High | PERCO integration and HR rules in controller | External schema and HR policy are coupled to presentation | Create `PercoGateway`, `AttendanceReportService`, `ShiftPolicyService` | Medium |
| High | Survey and Questionnaire duplicate survey concepts | Conflicting ownership and future analytics complexity | Isolate legacy Survey context; route new work through Questionnaire context | Medium |
| High | Organization split across legacy and target models | Scope calculation remains runtime reconciliation | Make Organization context own canonical org-unit read model; keep legacy mappings as adapters | High |
| Medium | Certificate issuance in controllers | Certificate lifecycle hard to reuse and audit | Add `CertificateIssuanceService` and `CertificateTemplatePublishingService` | Low/Medium |
| Medium | Testing controller owns validation/analytics | New module will grow into controller-heavy design | Add `TestingAssessmentService` and `TestingAnalyticsService` | Low/Medium |
| Medium | Missing domain events/jobs | Direct synchronous coupling as workflows grow | Add events after service boundaries exist | Medium |
| Medium | Audit is observer/logger based, not domain-event based | Auditing coverage depends on explicit logger calls and observer registration | Introduce event-sourced audit listeners for key domain transitions | Medium |
| Low | React sidebar mirrors server access logic | UI drift from server-side domain capabilities | Expose context capability read models from backend | Low |

## 18. Future Target Architecture

Recommended future bounded contexts:

- Identity: authentication, AD identifiers, login, local credentials.
- Directory/Profile: user directory, self profile, profile verification, directory search.
- Organization: org units, hierarchy, positions, faculties, departments, divisions, mappings.
- Academic Context: student/employee academic identity, Platonus anti-corruption layer, academic assignments.
- Authority/Governance: roles, grants, delegations, authority requests, approval workflow, authority ledger.
- KPI: periods, indicators, entries, calculations, KPI workflow, KPI exports.
- Calendar: availability, events, scheduling workflow, delegation, conferencing, notification orchestration.
- Certificates: templates, versions, certificate issuance, registry, verification.
- Questionnaire: surveys, survey dictionaries, responses, analytics.
- Testing: subject binding, tests, questions, attempts/results, analytics.
- HR Attendance: PERCO integration, attendance reports, time policies.
- Library: reservations, loans, catalog anti-corruption layer.
- Communications: announcements, navigation, phonebook, notifications.
- Audit and Monitoring: domain event audit, activity logs, operational monitoring.
- Integrations: AD, Platonus, PERCO, Zoom, WhatsApp, external catalog, AI gateways.

Shared kernel candidates:

- `UserId`, `OrgUnitId`, `AcademicYearId`, `DepartmentId`, `FacultyId`.
- Date/time period value objects.
- File attachment metadata.
- Audit metadata.
- External identity identifiers.

Anti-corruption layer candidates:

- Active Directory user directory adapter.
- Platonus student/employee academic adapter.
- PERCO attendance adapter.
- Library catalog adapter.
- Zoom conferencing adapter.
- WhatsApp notification adapter.
- AI provider adapter.

Application service candidates:

- `CalendarSchedulingService`.
- `CalendarAvailabilityService`.
- `CalendarDelegationService`.
- `CertificateIssuanceService`.
- `QuestionnaireAdminService`.
- `TestingAssessmentService`.
- `HrAttendanceReportService`.
- `UserDirectoryService`.
- `ProfileGovernanceService`.
- `OrganizationAssignmentService`.
- `GovernanceAuthorityApplicationService`.

This is an evolutionary architecture target. No destructive migration is recommended.

## 19. Evolutionary Refactoring Roadmap

### P0 - Immediate architecture containment

- Freeze new large feature logic in `routes/web.php`; add controllers/services for new behavior.
- Do not add new cross-domain relations or callbacks to `User`.
- Require new domains to have an application service before controller growth.
- Document current domain ownership decisions in a lightweight architecture decision record.

### P1 - Service boundary extraction

- Extract Calendar route behavior into Calendar application services without changing tables.
- Move User -> KPI hydration from Eloquent callback into explicit application service/event flow.
- Extract PERCO gateway and HR reporting services from `PercoController`.
- Extract certificate issuance/template publishing services from certificate controllers.
- Extract testing assessment and analytics services before the module grows further.

### P2 - Bounded context stabilization

- Define canonical ownership for User, EmployeeProfile, StudentProfile, Faculty, Department, Division, OrgUnit, Role, Grant, Delegation, KPI Entry, CalendarEvent, Certificate, QuestionnaireResponse, TestingResult.
- Keep legacy tables but access them through context services or repositories.
- Isolate legacy Survey from new Questionnaire and prevent new cross-dependencies.

### P3 - Domain events and audit

- Introduce domain/application events for approved governance requests, KPI transitions, calendar event changes, certificate issue/revoke, questionnaire submission, testing result completion.
- Add listeners for audit, notification, integration sync, and cache refresh.
- Keep synchronous behavior initially; queue only after events are stable.

### P4 - Integration anti-corruption layers

- Wrap AD, Platonus, PERCO, Library catalog, Zoom, WhatsApp, and AI behind explicit gateways.
- Prevent controllers/routes from directly calling external APIs or external DB schemas.
- Add mapping objects for external identifiers and source-system metadata.

### P5 - Enterprise modular monolith target

- Move toward context namespaces or modules while preserving Laravel deployability.
- Expose mobile/API use cases through application services, not Inertia controller logic.
- Keep microservices as a future option only after module boundaries are stable and measurable.

## 20. Final Assessment

The application has enough domain vocabulary and transitional enterprise scaffolding to become a durable university CRM, but it is not currently organized as a DDD-oriented enterprise platform. The system is better described as a Laravel monolith with feature controllers, shared Eloquent models, and several emerging domain services.

The next architectural milestone should be a modular monolith with explicit bounded contexts and application services, not a database rewrite or microservice split. The highest-value first step is to stop new domain behavior from entering shared routes/controllers and to extract the Calendar, User/KPI coupling, PERCO, Certificate, Testing, and Directory/Governance orchestration paths into context-owned services.
