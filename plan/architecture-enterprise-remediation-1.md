---
goal: Enterprise Architecture Remediation Plan for CRM Modular Monolith Evolution
version: 1.0
date_created: 2026-06-30
last_updated: 2026-06-30
owner: Enterprise Architecture Board / CRM Architecture Team
status: Planned
tags: [architecture, ddd, rbac, modular-monolith, governance, remediation]
---

# Enterprise Architecture Remediation Plan

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan converts the completed domain architecture and RBAC audits into an implementation roadmap for evolving the Laravel CRM into an enterprise modular monolith. It does not redesign the approved architecture decisions: AD remains authoritative only for authentication, identity proof, and identity attributes; CRM remains authoritative for RBAC, roles, scoped grants, delegations, workflow, organization, effective authority, and audit; Platonus remains the future academic source.

## 1. Requirements & Constraints

- **REQ-001**: Evolve the current Laravel monolith incrementally; no Big Bang rewrite is permitted.
- **REQ-002**: Preserve the fixed Source of Truth decision: AD is identity-only; CRM owns authority and organization.
- **REQ-003**: Treat RBAC redesign as a prerequisite for authority, scope, governance, and effective permission cleanup.
- **REQ-004**: Convert controller, route, middleware, and model business logic into application/domain services by bounded context.
- **REQ-005**: Keep legacy tables operational during migration; use compatibility adapters until reads and writes are moved.
- **REQ-006**: Every remediation item must map to an audit finding from `enterprise-domain-architecture-ddd-audit-2026-06-30.md` or `enterprise-rbac-audit-2026-06-30.md`.
- **CON-001**: Do not rewrite RBAC, Source of Truth, or organization decisions; implement the already selected architecture.
- **CON-002**: Do not introduce microservices before bounded contexts, contracts, tests, and ownership are stable inside the monolith.
- **CON-003**: Do not add new business behavior to `routes/web.php`, route closures, middleware, or React navigation visibility checks.
- **GOV-001**: Authority-changing writes must pass through governed, audited application services except explicit break-glass paths.
- **GOV-002**: Controllers orchestrate only; Application Services own use cases; Domain Services own business rules; Infrastructure Services own external systems only.

## 2. Phase 1: Architectural Issue Classification

| ID | Audit finding | Classification | Decision | Rationale | Dependency | Priority | Wave | Benefit | Migration risk |
|---|---|---|---|---|---|---|---|---|---|
| CLS-001 | Calendar business rules live in `routes/web.php` closures | A | Fix now | Safe service extraction can preserve tables/routes while moving scheduling, conflict, recurrence, notification, and Zoom orchestration into services. | None | P1 | Wave 2 | Testable Calendar boundary | Medium |
| CLS-002 | PERCO external DB reads and HR calculations live in `PercoController` | A | Fix now | Gateway and reporting services reduce integration coupling without schema change. | None | P1 | Wave 2 | Safer external integration | Medium |
| CLS-003 | Certificate issuance/revoke/generation logic is controller-owned | A | Fix now | Certificate lifecycle services can be introduced without RBAC redesign; audit writes are urgent. | Certificate audit policy | P1 | Wave 2 | Auditable certificate lifecycle | Low/Medium |
| CLS-004 | Testing validation and analytics live in controllers | A | Fix now | Newer module can be contained before it grows; no dependency on RBAC redesign except access checks. | None | P2 | Wave 2 | Cleaner Testing context | Low/Medium |
| CLS-005 | Questionnaire student submission has service boundary but admin CRUD/analytics are controller-owned | A | Fix now | Preserve existing student service and extract admin application service. | None | P2 | Wave 2 | Stable Questionnaire context | Medium |
| CLS-006 | Library external catalog route closure mixes HTTP integration and local availability adjustment | A | Fix now | Introduce `LibraryCatalogGateway` and application service; no authority redesign required. | None | P2 | Wave 5 | Anti-corruption boundary | Low |
| CLS-007 | Zoom and WhatsApp gateways exist but Calendar workflow calls them directly from routes | A | Fix now | Keep gateways, move delivery decisions into Calendar application orchestration. | Calendar services | P2 | Wave 5 | Integration cleanup | Medium |
| CLS-008 | Audit observer is create-only and manually registered for selected models | A | Fix now | Extend audit coverage through explicit domain events for security entities; does not require RBAC schema completion. | Service boundaries | P1 | Wave 6 | Complete auditability | Medium |
| CLS-009 | React sidebar mirrors access logic | A | Fix now after capability endpoint | Replace UI duplication with server capability read model. | Effective authority API | P2 | Wave 5 | UI/server consistency | Low |
| CLS-010 | `routes/web.php` is dominant application surface across domains | A | Fix now | Containment rule: no new route-closure business logic; split route files or controllers gradually. | None | P0 | Wave 1 | Stops architectural erosion | Low |
| CLS-011 | `User` model is a god aggregate with role/org/KPI/certificate/profile relations | B | Wait for RBAC and organization foundations | Removing fields/relations too early risks breaking authority, org, KPI, and profile behavior. Freeze additions now; split after effective authority and org assignment services exist. | Source of Truth, RBAC, Organization | P1/P2 | Wave 4 | Identity-only User target | High |
| CLS-012 | `User::updated` hydrates KPI structure | B | Replace after authority/org services exist | The callback is unsafe, but replacement needs explicit org/authority change events. Add containment first; migrate later. | Organization assignment events | P1 | Wave 4 | Removes hidden side effects | High |
| CLS-013 | Role model, `users.role`, `role_id`, and direct role updates coexist | B | Must wait until RBAC is finished | Direct model cleanup depends on normalized permissions, governed role changes, and compatibility cache strategy. | RBAC redesign | P1/P2 | Wave 4 | Clean authority ownership | High |
| CLS-014 | Scoped grants, legacy KPI grants, delegations, and authority ledger coexist | B | Must wait until RBAC is finished | Do not remove legacy grants before effective authority backfill and validation. | RBAC redesign | P1/P2 | Wave 4 | Single effective authority model | High |
| CLS-015 | Organization split across legacy tables, `org_units`, user fields, KPI structures, and mappings | B | Must wait until organization service follows RBAC | Canonical assignments depend on authority and scope semantics. Build resolver contract first, migrate reads later. | RBAC, Organization | P2/P3 | Wave 4 | Canonical org model | High |
| CLS-016 | Governance applies approved changes by mutating User/KPI/academic assignments directly | B | Replace after target context command handlers exist | Governance should orchestrate workflow, not own external mutations; defer final delegation until services exist. | RBAC, Organization, target services | P2 | Wave 4 | Clean workflow boundary | Medium/High |
| CLS-017 | KPI access evaluator reconciles legacy roles/org/grants | B | Keep transitional until RBAC/Organization stabilize | It is useful transitional glue; replacing now would duplicate unfinished authority logic. | RBAC, Organization | P2 | Wave 4 | Safer migration bridge | Medium |
| CLS-018 | AD title/department used for authorization and visibility | C | Disappear after Source of Truth and RBAC enforcement | Backfill intended access into CRM grants and remove AD attribute checks. | Source of Truth, RBAC | P1 | Wave 3 | AD remains identity-only | Medium |
| CLS-019 | Legacy role resolution and direct `users.role` checks | C | Disappear after RBAC compatibility cache retirement | Keep cache during migration; remove raw checks after policy/effective authority adoption. | RBAC | P2 | Wave 4 | Normalized permissions | Medium |
| CLS-020 | Legacy KPI grants remain effective | C | Disappear after scoped grants/effective authority migration | Mirror or migrate legacy grants, then retire as effective source. | RBAC | P2 | Wave 4 | Single grant mechanism | High |
| CLS-021 | Organization duplication in legacy fields and target `org_units` | C | Disappear after canonical organization assignment rollout | Legacy fields remain adapters/read caches until org assignment service is authoritative. | Organization | P3 | Wave 4 | Single org source | High |
| CLS-022 | Hardcoded certificate access emails | C | Disappear after CRM grants cover certificate permissions | Move intended operators into certificate grants; remove controller/frontend allowlists. | RBAC | P1/P2 | Wave 3 | Governed certificate access | Low |
| CLS-023 | Governance elevated mode defaults to legacy fallback | C | Disappear after strict authority backfill | Enable strict mode only after effective authority is complete and verified. | RBAC backfill | P2 | Wave 6 | Deny-by-default governance | Medium |
| CLS-024 | `config/academic.php` defines source boundaries and mobile payload expectations | D | Do not touch | Audit identifies this as aligned with target architecture; keep as contract artifact. | None | P3 | Wave 7 | Preserves source-of-truth clarity | Low |
| CLS-025 | Platonus sync is scaffold-only and explicitly non-authoritative | D | Do not touch now | This is acceptable because live academic authority is not being imported prematurely. | Future Platonus stage | P3 | Wave 8 | Avoids premature integration coupling | Low |
| CLS-026 | KPI period service contains lifecycle and conflict rules | D | Do not touch except incremental cleanup | Audit identifies it as a strong aggregate/service candidate. | None | P3 | Wave 6 | Preserve mature boundary | Low |
| CLS-027 | Questionnaire student submission service | D | Do not touch except surrounding extraction | Existing service boundary is good; extract admin service separately. | None | P3 | Wave 6 | Avoids unnecessary churn | Low |
| CLS-028 | AD authenticator isolates AD bind/search | D | Do not replace | Keep as infrastructure boundary; only remove authority decisions and direct overreach from identity flow. | Source of Truth | P2 | Wave 5 | Stable identity integration | Medium |

## 3. Phase 2: Dependency Order

### 3.1 Primary Dependency Chain

```text
Architecture containment
  ↓
Source of Truth enforcement
  ↓
RBAC / Effective Authority redesign
  ↓
Organization canonical assignment model
  ↓
Approval Workflow expansion
  ↓
Application Service extraction by context
  ↓
Aggregate cleanup and compatibility retirement
  ↓
Integration anti-corruption layers
  ↓
Domain events and audit stabilization
  ↓
API/mobile capability model
  ↓
Optimization and future modularization
```

### 3.2 Complete Dependency Graph

| Node | Depends on | Enables | Blocking reason |
|---|---|---|---|
| DEP-001 Architecture containment | None | All future work | Prevents new debt while migration proceeds. |
| DEP-002 Source of Truth enforcement | DEP-001 | RBAC, AD cleanup, Platonus readiness | AD authorization checks must stop before CRM can be sole authority. |
| DEP-003 RBAC permission catalog and role-permission mapping | DEP-002 | Effective authority, policies, capability API | Role cleanup cannot proceed without normalized permissions. |
| DEP-004 Effective authority evaluator | DEP-003 | scoped grants, delegations, mobile/API access | Controllers/middleware need one authority contract. |
| DEP-005 Governed authority write flow | DEP-003, DEP-004 | role/grant/delegation migration | Direct writes must be replaced by approved/effective changes. |
| DEP-006 Organization assignment service | DEP-004 | org scope, KPI scope, department workflows | Organization scope depends on effective authority semantics. |
| DEP-007 Approval workflow expansion | DEP-005, DEP-006 | governed role/grant/org/certificate changes | Workflow must call target context services, not mutate models directly. |
| DEP-008 Calendar services | DEP-001, DEP-004 for access | Calendar API/mobile readiness | Calendar logic can be extracted before full org migration, but final access depends on RBAC. |
| DEP-009 KPI cleanup | DEP-004, DEP-006 | remove User callback, unlinked-entry quarantine | KPI scope depends on authority and organization. |
| DEP-010 Certificate services | DEP-001, DEP-004 for permissions | certificate audit, lifecycle APIs | Lifecycle extraction is safe; final access uses RBAC. |
| DEP-011 Questionnaire/Testing services | DEP-001 | API readiness and analytics stability | Mostly independent from RBAC except policy checks. |
| DEP-012 Integration gateways | DEP-001 and context services | anti-corruption layers | Gateways must be called by application services, not controllers. |
| DEP-013 Domain events | stable application services | audit/listeners/jobs | Events before service boundaries would encode current coupling. |
| DEP-014 Capability read model | DEP-004, DEP-006 | React/sidebar/API consistency | Frontend should consume server authority, not duplicate logic. |
| DEP-015 Platonus integration | DEP-006, DEP-013 | future academic source | Academic source activation requires org/scope/audit boundaries first. |
| DEP-016 Module namespace restructuring | DEP-008 through DEP-013 | future microservice readiness | Physical modularization must follow stable logical boundaries. |

## 4. Phase 3: Refactoring Waves

| Wave | Purpose | Expected outcome | Risk | Dependencies | Estimated complexity |
|---|---|---|---|---|---|
| Wave 1: Quick wins and containment | Stop architectural erosion and close immediate unsafe surfaces from the audits. | No new business logic in routes/middleware; API authorization gaps contained; default credentials/local fallback/self-registration risks addressed; calendar holiday mutation locked. | Low/Medium regression in auth/API behavior. | None. | Medium |
| Wave 2: Application Services | Extract use-case services from large controllers/routes without changing persistence. | `CalendarSchedulingService`, `CalendarAvailabilityService`, `CertificateIssuanceService`, `QuestionnaireAdminService`, `TestingAssessmentService`, `HrAttendanceReportService`, `UserDirectoryService`, `ProfileGovernanceService` exist and controllers become adapters. | Medium due to moving behavior. | Wave 1. | High |
| Wave 3: Source of Truth and RBAC alignment | Remove AD/title/hardcoded authority sources by routing access through CRM effective authority. | AD attributes display-only; certificate allowlists migrated; direct authority paths contained behind governance/break-glass. | High if grants are not backfilled correctly. | Wave 1, RBAC schema/evaluator. | High |
| Wave 4: Aggregate cleanup | Split god-model responsibilities and retire hidden cross-domain mutations. | `User` becomes identity/profile reference; role/org/grant/delegation/KPI side effects move to context services/events; legacy grants/org fields become compatibility caches. | High database and workflow regression risk. | Waves 2-3, Organization assignment service. | Very High |
| Wave 5: Integration cleanup | Put external systems behind anti-corruption gateways and context-owned orchestration. | PERCO, library catalog, Zoom, WhatsApp, AI, AD, Platonus gateways are used only by application services. | Medium external integration risk. | Wave 2. | Medium |
| Wave 6: DDD stabilization | Add events, audit listeners, policies, repositories/contracts, and capability read models. | Business transitions emit events; audit coverage is complete for security-relevant changes; policies delegate to authority services. | Medium event ordering/audit duplication risk. | Waves 2-5. | High |
| Wave 7: Future modularization | Move from logical contexts to physical module namespaces only after behavior is stable. | Context-owned routes/controllers/services/models/contracts are grouped; mobile/API endpoints reuse application services. | Medium due to namespace churn. | Wave 6. | High |
| Wave 8: Future enterprise integrations | Activate Platonus staging/effective import and prepare microservice split criteria. | Platonus remains academic source through staging/conflict workflow; CRM remains authority; microservice readiness is measured, not assumed. | High data governance risk. | Wave 7. | Very High |

## 5. Phase 4: Controller Refactoring Plan

| Controller / route area | Extract first service | Extract second service | Extract third service | Keep inside controller | Move later | Priority | Wave |
|---|---|---|---|---|---|---|---|
| `routes/web.php` Calendar group | `CalendarSchedulingService` for create/update/cancel/confirm/reschedule and recurrence | `CalendarAvailabilityService` for slots, holidays, conflict detection | `CalendarNotificationOrchestrator` for Zoom/WhatsApp/audit dispatch decisions | Request validation, response rendering, route-model binding | `CalendarDelegationService` after RBAC delegation model stabilizes | P1 | Wave 2 |
| `KpiEntryController` | `KpiEntryWorkflowApplicationService` for submit/review/approve/return/reject | `KpiEntryQueryService` for queues and dashboards | `KpiEntryExportService` for exports/files | Inertia view composition only | Move org-scope decisions after Organization service | P2 | Wave 4 |
| `KpiSummaryController` | `KpiSummaryQueryService` | `KpiAnalyticsService` | `KpiExportService` | Presentation payload assembly | Capability-backed filters after RBAC | P2 | Wave 4 |
| `DirectoryUserController` | `UserDirectoryService` for directory CRUD/manual user lifecycle | `AuthorityChangeRequestApplicationService` for role/grant requests | `DirectoryAdLookupService` wrapping AD search/display | Index/detail page assembly | Remove direct role/KPI/org writes after RBAC/Org migration | P1 | Waves 2-4 |
| `ProfileController` | `ProfileGovernanceService` for pending/effective profile changes | `ProfileVerificationService` for WhatsApp/phone verification | `ProfileReadModelService` for certificates/KPI/activity/student binding display | Basic edit view rendering | Move student binding to Academic/Student context after Platonus readiness | P1 | Waves 2-4 |
| `GovernanceAccessRequestController` | `GovernanceRequestReadModelService` for dashboards/display values | `GovernanceReviewApplicationService` for approve/reject orchestration | `GovernanceAuditQueryService` | Thin request handling | Delegate mutation execution to target context command handlers | P2 | Waves 2-4 |
| `PercoController` | `PercoGateway` for external DB access | `AttendanceReportService` for late/early/overtime/absence reporting | `ShiftPolicyService` for schedule/holiday policy | Report filter parsing and response formatting | Cache/materialized read models after usage data | P1 | Waves 2/5 |
| `HrPercoController` | Reuse `AttendanceReportService` | Reuse `PercoGateway` | `HrAttendanceApiPresenter` if API diverges | API request/response only | Mobile-specific DTOs later | P2 | Wave 5 |
| `AdminDictionaryController` | `QuestionnaireAdminService` for dictionary CRUD | `QuestionnaireAnalyticsService` for response aggregation | `QuestionnaireDirectoryLookupService` for AD/user/department lookup | HTTP validation/serialization | Legacy Survey isolation/migration later | P2 | Wave 2 |
| `CertificateRegistryController` | `CertificateIssuanceService` for generate/issue/revoke | `CertificateVerificationService` for public verification | `CertificateExportService` for CSV/export | Request validation and views | RBAC-backed operator grants after RBAC | P1 | Waves 2-3 |
| `CertificateTemplateController` | `CertificateTemplatePublishingService` | `CertificateTemplateVersionService` | `CertificateAuditApplicationService` | View rendering | Hardcoded email removal after grants | P1 | Waves 2-3 |
| `TestingTestController` | `TestingAssessmentService` for create/update/question sync | `TestingAuthorizationService` or policy adapter | `TestingAnalyticsService` | Request validation and response | Attempt/result event model later | P2 | Wave 2 |
| `OrgStructureController` | `OrganizationStructureService` for org unit writes | `OrganizationMappingService` for legacy mapping | `OrganizationAssignmentService` after RBAC scope finalization | Tree view rendering | Legacy table retirement later | P2/P3 | Waves 3-4 |
| API `AnnouncementController` | `AnnouncementApplicationService` | `AnnouncementPolicy` backed by effective authority | `AnnouncementAuditService` | Serialization only | Communications context modularization later | P0 | Waves 1/6 |
| API `TicketController` | `TicketWorkflowService` for accept/status transitions | `TicketScopeService` backed by effective department | `TicketAuditService` | Serialization only | Department workflow integration after Organization | P0/P1 | Waves 1/4 |
| Library catalog route closure | `LibraryCatalogGateway` | `LibraryAvailabilityService` | `LibraryReservationApplicationService` | Response formatting | External catalog cache later | P2 | Wave 5 |

## 6. Phase 5: Service Refactoring Plan

### 6.1 Application Services

| Service | Current / target | Why | Priority | Wave |
|---|---|---|---|---|
| `KpiEntryService` | Keep as application service, split storage/calculation/scope collaborators | Owns KPI use cases but currently absorbs too many concerns. | P2 | Wave 4 |
| `KpiPeriodService` | Keep application/domain service | Strong lifecycle boundary; only incremental cleanup. | P3 | Wave 6 |
| `GovernanceAccessRequestService` | Keep workflow service, delegate effective mutations | Workflow is valid; cross-aggregate mutation must move to target context services. | P2 | Wave 4 |
| `QuestionnaireSurveyService` | Keep application/domain service | Good student submission boundary. | P3 | Wave 6 |
| `CalendarSchedulingService` | Create | Calendar route closures need a use-case owner. | P1 | Wave 2 |
| `CalendarAvailabilityService` | Create | Availability/conflict/holiday logic must be testable and reusable. | P1 | Wave 2 |
| `CertificateIssuanceService` | Create | Issuance/revoke/generate are lifecycle use cases, not controller logic. | P1 | Wave 2 |
| `QuestionnaireAdminService` | Create | Admin dictionary CRUD and analytics need context ownership. | P2 | Wave 2 |
| `TestingAssessmentService` | Create | Test/question invariants should not remain in controller helpers. | P2 | Wave 2 |
| `HrAttendanceReportService` | Create | PERCO reporting is a domain use case. | P1 | Wave 2 |
| `UserDirectoryService` | Create | Directory CRUD/manual users must be separated from role/org/grant writes. | P1 | Wave 2 |
| `ProfileGovernanceService` | Create | Profile pending/effective transitions need one application boundary. | P1 | Wave 2 |
| `OrganizationAssignmentService` | Create after RBAC | Canonical organization assignment depends on effective scope semantics. | P2/P3 | Wave 4 |

### 6.2 Domain Services

| Service | Classification | Why | Priority | Wave |
|---|---|---|---|---|
| `KpiCalculationService` | Domain service | Scoring/thresholds are KPI domain rules; remove direct User reads later. | P2 | Wave 4 |
| `OrgScopeResolverService` | Transitional domain resolver | Keep until canonical org assignment service replaces reconciliation. | P2 | Wave 4 |
| `AcademicScopeResolverService` | Domain/application resolver | Keep as academic context contract until Platonus integration. | P3 | Wave 8 |
| `ShiftPolicyService` | Domain service | Attendance shift/holiday/overtime policy is HR business logic. | P1 | Wave 2 |
| `CalendarConflictPolicyService` | Domain service | Conflict rules belong to Calendar domain and support web/API reuse. | P1 | Wave 2 |
| `CertificateNumberingPolicyService` | Domain service | Sequence allocation and uniqueness are certificate lifecycle rules. | P1 | Wave 2 |
| `TestingQuestionValidationService` | Domain service | Question count, answer validity, passing score limits are Testing invariants. | P2 | Wave 2 |

### 6.3 Infrastructure Services

| Service | Classification | Action | Priority | Wave |
|---|---|---|---|---|
| `ActiveDirectoryAuthenticator` | Infrastructure plus identity application behavior | Keep AD operations; move local authority/profile decisions out over time. | P2 | Wave 5 |
| `PlatonusSyncService` | Infrastructure scaffold | Keep scaffold; activate only in future integration stage. | P3 | Wave 8 |
| `ZoomMeetingService` | Infrastructure gateway | Keep; call from Calendar orchestrator only. | P2 | Wave 5 |
| `GreenApiWhatsAppNotifier` | Infrastructure gateway | Keep; move delivery decisions to Calendar/Profile application services. | P2 | Wave 5 |
| `PercoGateway` | Infrastructure gateway | Create; all external PERCO DB reads go through it. | P1 | Wave 5 |
| `LibraryCatalogGateway` | Infrastructure gateway | Create; remove external HTTP logic from route closure. | P2 | Wave 5 |
| `AiProviderGateway` | Infrastructure gateway | Create/clarify if AI route remains; separate provider calls from navigation/KPI domain context. | P3 | Wave 5 |

### 6.4 Cross-Cutting / Shared Services

| Service | Classification | Action | Priority | Wave |
|---|---|---|---|---|
| `AuditLogService` | Cross-cutting audit | Replace observer-only model with domain-event listeners for critical transitions. | P1 | Wave 6 |
| `BusinessActivityLogger` | Cross-cutting infrastructure | Keep as write adapter; call from audit listeners, not random controllers. | P1 | Wave 6 |
| `EffectiveAuthorityService` | Shared authority service | Make the single server-side authority decision contract after RBAC. | P1/P2 | Wave 3 |
| `CapabilityReadModelService` | Shared read model | Create to feed React/sidebar/mobile/API capabilities. | P2 | Wave 6 |
| Shared IDs/value objects | Shared kernel | Allow only stable identifiers and audit metadata; no business workflows. | P3 | Wave 7 |

## 7. Phase 6: Aggregate Refactoring

| Aggregate | Decision | Future target | Migration strategy | Dependency | Priority | Wave | Risk |
|---|---|---|---|---|---|---|---|
| User | Split, but delay destructive changes | Identity-only aggregate with authentication identifiers, login state, minimal profile pointer | Freeze new relations/fillables now; move role/org/grant/KPI/certificate relations behind services/read models; retire compatibility fields after RBAC/Org rollout. | RBAC, Organization | P1/P2 | Wave 4 | High |
| EmployeeProfile | Keep, then move under Academic/Employee context | Employee academic/work profile owned outside User | Keep relation; move writes through profile/academic services; later source future academic fields from Platonus staging where applicable. | Organization, Platonus future | P2/P3 | Waves 4/8 | Medium |
| StudentProfile | Keep, then reconcile with legacy Student and Questionnaire Student | Student academic profile with Platonus anti-corruption source | Introduce student identity mapping; do not merge until Platonus staging and Questionnaire binding rules are clear. | Platonus, Questionnaire | P3 | Wave 8 | High |
| Organization | Split legacy from target; make `OrgUnit` target root | Organization owns hierarchy, positions, mappings, assignments | Keep `Faculty`, `Department`, `Division` as legacy adapters; migrate reads to assignment service; later write through Organization only. | RBAC | P2/P3 | Wave 4 | High |
| Governance | Keep workflow aggregate; narrow responsibilities | Governance owns requests, approvals, separation-of-duty, reasons, pending/effective workflow | Keep request lifecycle; replace direct mutations with target context command handlers. | RBAC, target services | P2 | Wave 4 | Medium/High |
| Authority | Replace legacy role/grant sources with effective authority | Authority owns roles, permissions, scoped grants, delegations, effective evaluator, ledger | Build permission catalog and compatibility cache; migrate direct writes to governed requests; enable strict mode after validation. | Source of Truth | P1/P2 | Wave 3/4 | High |
| KPI | Keep; split services internally | KPI owns periods, indicators, entries, calculations, workflow, exports | Preserve tables; split workflow/query/export/calculation/scope; remove `User` callback through explicit org/authority events. | Organization, Authority | P2 | Wave 4 | High |
| Calendar | Keep; extract behavior urgently | Calendar owns availability, events, scheduling, secretary delegation, conference/notification orchestration | Move route closure behavior to services; preserve routes; later add events and API endpoints. | Wave 1 containment | P1 | Wave 2 | Medium |
| Certificates | Keep; extract lifecycle services | Certificates own templates, versions, numbering, generation, issue, revoke, verify | Move lifecycle to services; add certificate audit writes; replace email allowlists with grants later. | Audit, RBAC | P1 | Wave 2/3 | Low/Medium |
| Questionnaire | Keep new Questionnaire; isolate legacy Survey | Questionnaire owns dictionaries, surveys, responses, analytics | Keep student submission service; extract admin service; freeze legacy Survey except maintenance; migrate analytics deliberately if needed. | None | P2 | Wave 2/6 | Medium |
| Testing | Keep; mature early | Testing owns bindings, tests, questions, attempts/results, analytics | Extract assessment service and analytics service before module expands; add events after stable. | None | P2 | Wave 2/6 | Low/Medium |

## 8. Phase 7: Bounded Context Stabilization

| Context | Current maturity | Target maturity | Missing services | Missing repositories/contracts | Missing policies | Missing events | Missing application layer |
|---|---|---|---|---|---|---|---|
| Identity/Auth | Medium | High | Break-glass credential service, identity sync boundary | Identity provider contract | Local fallback policy | `UserLoggedIn`, `BreakGlassUsed` | Separate auth side effects from dashboard/role updates |
| Directory/Profile | Low/Medium | High | `UserDirectoryService`, `ProfileGovernanceService`, `ProfileVerificationService` | User/profile read repositories | Directory mutation policies | `ProfileChangeRequested`, `ProfileChangeApproved` | Yes |
| Authority/Governance | Medium transitional | Very High | Effective authority evaluator, governed role/grant service, delegation workflow service | Authority repository, permission catalog contract | Role/grant/delegation policies | `AuthorityGranted`, `DelegationCreated`, `GovernanceRequestApproved` | Partial |
| Organization | Low/Medium | Very High | `OrganizationAssignmentService`, `OrganizationStructureService`, mapping service | Org hierarchy/assignment repository contracts | Org mutation policies | `OrgAssignmentChanged`, `OrgUnitChanged` | Partial |
| Academic Context | Medium | High | Academic identity mapper, Platonus staging resolver | Academic source contract | Academic assignment policies | `AcademicIdentityLinked`, `PlatonusRecordStaged` | Partial |
| KPI | Medium/High | High | Query/export/scope split, explicit workflow command service | KPI repositories/read models | Scope policies via effective authority | `KpiEntrySubmitted`, `KpiEntryApproved`, `KpiEntryReturned` | Partial |
| Calendar | Low | High | Scheduling, availability, delegation, notification orchestrator | Calendar repository/gateway contracts | Calendar admin/delegation policies | `CalendarEventConfirmed`, `CalendarEventCancelled` | Missing |
| Certificates | Low/Medium | High | Issuance, template publishing, verification, export services | Certificate registry/template repository contracts | Certificate operator policies | `CertificateIssued`, `CertificateRevoked` | Missing |
| Questionnaire | Medium | High | Admin service, analytics service | Questionnaire repository contracts | Admin dictionary policies | `QuestionnaireSubmitted`, `SurveyPublished` | Partial |
| Testing | Low/Medium | High | Assessment, analytics, result service | Testing repository contracts | Teacher/admin testing policies | `TestingResultCompleted`, `TestPublished` | Missing |
| HR Attendance/PERCO | Low | Medium/High | PERCO gateway, attendance report, shift policy | PERCO adapter contract | HR report visibility policies | `AttendanceReportGenerated` | Missing |
| Library | Low/Medium | Medium/High | Catalog gateway, availability service | External catalog contract | Reservation/admin policies | `ReservationCreated`, `LoanUpdated` | Partial |
| Communications | Low/Medium | Medium/High | Announcement service, navigation capability service | Communications repository contracts | Announcement/navigation policies | `AnnouncementPublished` | Partial |
| Audit/Monitoring | Medium technical | High enterprise | Domain audit listener layer | Audit sink contract | Audit access policies | Listens to all major events | Partial |
| Integrations | Medium uneven | High | PERCO/library/AI gateways; Platonus staging services later | External gateway contracts | Integration access/config policies | Integration sync events | Partial |

## 9. Phase 8: Technical Debt Prioritization

| Priority | Debt | Why | Required action | Wave |
|---|---|---|---|---|
| P0 | Missing API authorization for announcement mutations | Critical security finding: authenticated API users can mutate university-wide announcements. | Add admin/scoped permission check and negative tests. | Wave 1 |
| P0 | Predictable default password and broad local fallback | Critical account takeover path. | Stop default password, reset affected accounts, restrict fallback to explicit break-glass/service users. | Wave 1 |
| P0 | Self-registration creates effective teacher users | External users can become authenticated teacher-default users. | Disable registration or route to pending/no-privilege state. | Wave 1 |
| P0 | API ticket accept missing handler/admin authorization | High operational workflow escalation. | Add handler/admin and department-scope checks. | Wave 1 |
| P0 | New business logic entering route closures/controllers | Main architectural erosion vector. | Enforce containment rule immediately. | Wave 1 |
| P1 | Calendar logic in `routes/web.php` | Critical DDD violation and API/mobile blocker. | Extract Calendar services. | Wave 2 |
| P1 | Direct role/grant writes bypass governance | High authority escalation risk. | Route changes through governed requests; break-glass only with reason/audit. | Wave 3 |
| P1 | AD title/department authorization | Violates final Source of Truth decision. | Backfill CRM grants/scopes and remove AD checks. | Wave 3 |
| P1 | Certificate lifecycle lacks audit | Externally verifiable records need traceability. | Add lifecycle services and audit writes. | Wave 2 |
| P1 | `User` god model and KPI callback | Hidden side effects and boundary confusion. | Freeze now; replace callback after org/authority events. | Wave 4 |
| P1 | Audit coverage incomplete for security entities | Governance requires immutable traceability. | Add domain audit events/listeners. | Wave 6 |
| P2 | Organization split across legacy and target models | Blocks scoped authority and enterprise reporting. | Build assignment service and migrate reads. | Wave 4 |
| P2 | PERCO controller owns integration and HR rules | External schema changes risk presentation regressions. | Extract gateway/report/policy services. | Wave 2/5 |
| P2 | Questionnaire/Survey duplication | Future analytics and student ownership risk. | Isolate legacy Survey; route new work through Questionnaire. | Wave 6 |
| P2 | Testing controller owns invariants | New domain will become controller-heavy. | Extract assessment service. | Wave 2 |
| P2 | Frontend duplicates access logic | UI drift from server authority. | Add capability read model. | Wave 6 |
| P3 | Domain events/jobs missing | Needed for audit/notifications/integrations but should follow services. | Add after service boundaries stabilize. | Wave 6 |
| P3 | Platonus scaffold not live | Correctly delayed until org/source boundaries are ready. | Keep scaffold; activate through staging/conflict workflow later. | Wave 8 |
| P3 | Physical modularization absent | Not urgent before logical context stability. | Namespace modules after services/contracts are stable. | Wave 7 |

## 10. Phase 9: Risk Analysis

| Refactoring | Regression risk | Database impact | Migration impact | API impact | RBAC impact | Organization impact | Workflow impact | Deployment impact | Rollback strategy |
|---|---|---|---|---|---|---|---|---|---|
| API authorization containment | Low/Medium | None | None | Some clients may receive 403 | Positive, uses stricter checks | Department ticket checks may need scopes | Ticket/announcement operations restricted | Low | Feature flag or temporary admin-only fallback |
| Credential/fallback containment | Medium | Password reset flags/columns may be needed | Existing default-created users require reset | Login/API auth behavior changes | Reduces unauthorized authority | None | Break-glass workflow required | Medium | Allowlist emergency accounts temporarily with audit |
| Calendar service extraction | Medium | None initially | No data migration | Enables future API reuse | Access checks later switch to authority | Holiday/org calendars later depend on org | Scheduling workflow preserved | Medium | Keep old closures behind tests until parity confirmed |
| Certificate lifecycle extraction | Low/Medium | Audit writes use existing audit table; maybe indexes | None initially | Public verification must remain stable | Operator access later moves to grants | None | Issue/revoke workflow becomes explicit | Low | Keep controller path delegating to service; revert delegation if needed |
| PERCO gateway/report extraction | Medium | None | None | HR API output must remain stable | HR visibility later uses authority | Department scope later uses org | Reporting unchanged | Medium | Keep query parity tests and old query snapshots |
| Questionnaire admin extraction | Medium | None | None | API payloads must remain stable | Admin access later uses authority | Department/user lookup later uses org | Survey admin workflow preserved | Low/Medium | Controller can delegate conditionally to old implementation during rollout |
| Testing service extraction | Low/Medium | None | None | API/web responses stable | Policy checks later | Academic subject scope later | Test lifecycle preserved | Low | Revert service delegation |
| RBAC permission catalog | High | New permissions/role-permission/effective tables | Backfill roles and grants | Capability endpoints change | Core impact | Scope permissions depend on org | Approval workflow expands | High | Compatibility cache; dual-read validation; no destructive removal until strict mode |
| Legacy grant migration | High | Scoped grant/effective ledger backfill | Migrate or mirror KPI grants | Access behavior may change | Core impact | Scoped grants need org dimensions | Governance required | High | Dual-run evaluator comparing old/new decisions |
| Organization assignment service | High | Assignment tables/backfills/indexes | Legacy org data mapped to canonical assignments | Department-scoped APIs may change | Scope evaluation impact | Core impact | Org change workflow required | High | Read-only shadow mode before switching reads |
| Governance mutation delegation | Medium/High | None or command log additions | Existing requests must map to handlers | Admin UX stable | Positive | Positive | Core approval flow impact | Medium | Keep direct mutation method as internal fallback until handlers proven |
| User aggregate cleanup | High | Potential column deprecation later | Multi-stage compatibility | API/user payload changes | Core role relation impact | Core org relation impact | Profile governance impact | High | Do not drop columns; remove reads first, writes second, columns last |
| Domain events/audit | Medium | Event/audit tables or listener writes | Backfill not required initially | None | Audits authority changes | Audits org changes | Audits workflow transitions | Medium | Listeners can be disabled; events remain synchronous initially |
| Capability read model | Medium | Cache/read model optional | None | Frontend consumes new payload | Core impact | Scope payload impact | None | Medium | Keep legacy sidebar checks until server payload parity confirmed |
| Platonus staging integration | High | Staging/conflict/effective import tables | Academic data reconciliation | Academic APIs may change | No authority impact by rule | Academic/org mapping impact | Conflict workflow added | High | Staging-only rollout; no direct effective writes until approved |
| Physical modularization | Medium | None | Namespace/autoload migration | Routes/controllers paths change | None if logical contracts stable | None if contracts stable | None | Medium | Move modules incrementally; preserve route names and service aliases |

## 11. Phase 10: Mandatory Architecture Principles

- **PRN-001**: No business logic inside routes. Routes bind HTTP to controllers only.
- **PRN-002**: No business logic inside middleware. Middleware may call an application/authority service and return allow/deny only.
- **PRN-003**: Controllers orchestrate only. Controllers validate requests, call application services, and return responses.
- **PRN-004**: Application Services own use cases and transactions.
- **PRN-005**: Domain Services own business rules that do not naturally belong to one aggregate root.
- **PRN-006**: Infrastructure Services never own business decisions. They adapt AD, Platonus, PERCO, Zoom, WhatsApp, AI, and library catalog APIs.
- **PRN-007**: `User` must remain Identity only. Role, permission, organization, KPI, certificate, delegation, and workflow behavior must not be added to `User`.
- **PRN-008**: AD must never grant role, permission, organization scope, workflow access, or visibility. AD attributes are display/input signals only.
- **PRN-009**: CRM is authoritative for RBAC, scoped grants, delegations, workflow, organization, effective authority, and audit.
- **PRN-010**: Platonus may become the academic source only through staging, conflict resolution, and explicit effective-state application.
- **PRN-011**: Organization owns organization hierarchy, assignments, positions, legacy mappings, and scope resolution.
- **PRN-012**: Authority owns roles, permissions, grants, delegations, effective permission evaluation, and break-glass audit.
- **PRN-013**: Governance owns approval workflow, not target aggregate mutation logic.
- **PRN-014**: KPI owns KPI periods, indicators, entries, calculations, workflow, scope views, and exports.
- **PRN-015**: Calendar owns availability, events, delegation, conflict detection, scheduling, notifications, and conferencing orchestration.
- **PRN-016**: Certificates own template lifecycle, versioning, numbering, generation, issue, revoke, verification, and certificate audit.
- **PRN-017**: Questionnaire owns survey dictionaries, survey workflow, response eligibility, submissions, and analytics.
- **PRN-018**: Testing owns test binding, test/question lifecycle, attempts/results, scoring, and analytics.
- **PRN-019**: HR Attendance owns PERCO reporting rules; PERCO is an external source behind a gateway.
- **PRN-020**: Every new module must declare Owner Domain, Aggregate Root, Source of Truth, RBAC integration, Organization Scope, Events, Audit, and Application Service before implementation.
- **PRN-021**: Legacy compatibility fields may exist during migration but must be marked as compatibility caches/adapters, not authoritative sources.
- **PRN-022**: Every authority-changing action requires reason, actor, target, old value, new value, request id, effective timestamp, and audit record.
- **PRN-023**: Deny-by-default applies to missing scope, null organization, unlinked KPI entries, unknown roles, expired delegations, and unmapped external identities.
- **PRN-024**: Frontend visibility must consume server capability/read models; React must not independently implement authority rules.
- **PRN-025**: Domain events are introduced only after application service boundaries exist; events are synchronous first and queued only after behavior is stable.

## 12. Phase 11: Architecture Decision Records To Create

- **ADR-001**: Identity Architecture
- **ADR-002**: Source of Truth Boundaries
- **ADR-003**: RBAC Permission and Effective Authority Model
- **ADR-004**: Scoped Grants and Delegation Model
- **ADR-005**: Organization Model and Assignment Semantics
- **ADR-006**: Governance Approval Workflow
- **ADR-007**: DDD Bounded Context Boundaries
- **ADR-008**: User Aggregate Decomposition Strategy
- **ADR-009**: KPI Context Architecture
- **ADR-010**: Calendar Architecture
- **ADR-011**: Certificate Lifecycle Architecture
- **ADR-012**: Questionnaire Context Architecture
- **ADR-013**: Testing Context Architecture
- **ADR-014**: HR Attendance and PERCO Integration Strategy
- **ADR-015**: Platonus Integration and Academic Source Strategy
- **ADR-016**: Integration Anti-Corruption Layer Strategy
- **ADR-017**: Domain Event and Audit Architecture
- **ADR-018**: API and Mobile Capability Model
- **ADR-019**: Modular Monolith Packaging Strategy
- **ADR-020**: Break-Glass and Superadmin Governance

## 13. Phase 12: Enterprise Roadmap

| Stage | Objective | Scope | Entry criteria | Exit criteria | Primary waves | Key risks |
|---|---|---|---|---|---|---|
| Stage 1: Architecture Stabilization | Stop new architectural debt and close immediate security gaps. | Route/controller containment, API auth fixes, credential/fallback restrictions, self-registration, calendar holiday permissions. | Current audits accepted. | P0 controls deployed; new-code rules adopted; no new route-closure business logic. | Wave 1 | Login/API regressions. |
| Stage 2: Authority Stabilization | Make CRM effective authority the only access decision path. | Permission catalog, role-permission mapping, governed role/grant changes, scoped grants, delegation foundation, certificate grants. | Stage 1 complete. | AD/title/hardcoded access removed or shadowed; direct writes contained; authority decisions dual-validated. | Waves 3-4 | Incorrect grant backfill. |
| Stage 3: Organization Stabilization | Establish canonical organization assignments and scope resolution. | Org assignment service, legacy mappings, primary/multiple assignments, department/faculty/division read migration. | Effective authority evaluator exists. | Authorization no longer reads `ad_department`, `ad_title`, or raw user org fields directly. | Wave 4 | Scope mismatch, KPI queue impact. |
| Stage 4: Application Service Extraction | Move large controller/route behavior into use-case services. | Calendar, Directory/Profile, Governance read models, PERCO, Certificates, Questionnaire admin, Testing, Library. | Stage 1 complete; authority/org dependencies handled where required. | Controllers are thin adapters for targeted domains; services have tests. | Wave 2/5 | Behavior parity regressions. |
| Stage 5: DDD Cleanup | Clean aggregate boundaries and retire hidden coupling. | User decomposition, KPI callback replacement, governance mutation delegation, legacy Survey isolation. | Application services stable; RBAC/org services available. | User is no longer cross-domain behavior hub; target contexts own mutations. | Wave 4/6 | High migration complexity. |
| Stage 6: Enterprise Readiness | Add audit, events, policies, contracts, capability models. | Domain events, audit listeners, capability read model, repositories/contracts, separation-of-duty, strict authority mode. | Stages 2-5 substantially complete. | Security-relevant transitions audited; frontend uses server capabilities; strict mode enabled after validation. | Wave 6 | Event/audit duplication. |
| Stage 7: Mobile/API Readiness | Expose stable application services through API without duplicating Inertia logic. | API DTOs, capability endpoints, Calendar/KPI/Certificate/Questionnaire/Testing APIs. | Application services and authority capability model stable. | Mobile/API consumers use same use-case services as web. | Wave 7 | API compatibility and payload design. |
| Stage 8: Future Platonus Integration | Introduce Platonus as future academic source without authority leakage. | Staging import, conflict resolution, academic identity mapping, effective academic assignment workflow. | Organization, academic context, audit, and events stable. | Platonus records staged and reconciled; no direct RBAC/org authority writes. | Wave 8 | Data conflict and ownership disputes. |
| Stage 9: Future Microservice Readiness | Prepare split only if operational need is proven. | Module namespaces, contracts, event boundaries, ownership metrics, deployment dependency review. | Modular monolith stable and measurable. | Candidate services have isolated data ownership, contracts, events, and rollback strategy. | Wave 8+ | Premature distribution complexity. |

## 14. Execution Controls

| Control | Rule | Verification |
|---|---|---|
| Architecture review gate | Any new domain feature must identify owner context, aggregate root, application service, authority integration, org scope, events, and audit. | Pull request checklist and architecture board sampling. |
| Controller size gate | New controllers cannot contain business rules or external integration calls. | Code review and static search for direct gateway/DB access in controllers. |
| Route closure gate | New route closures may only return static/simple responses; no domain writes. | Route file diff review. |
| User model gate | No new cross-domain relations, callbacks, role/org behavior, or fillable security fields in `User`. | Code owner review for `app/Models/User.php`. |
| Authority gate | No new direct role/grant/org writes outside approved application services. | Static search and mutation path review. |
| Audit gate | Every security-relevant command must emit audit metadata. | Automated tests for audit records. |
| Migration gate | Legacy columns/tables cannot be dropped until reads, writes, backfill, dual-run validation, and rollback are complete. | Migration checklist. |

## 15. Implementation Backlog Summary

| Backlog ID | Task | Priority | Wave | Dependency | Completion criteria |
|---|---|---|---|---|---|
| TASK-001 | Enforce no-new-business-logic rule for routes/controllers/middleware. | P0 | Wave 1 | None | Architecture rule documented and applied in PR reviews. |
| TASK-002 | Fix API announcement authorization. | P0 | Wave 1 | Authority policy baseline | Unauthorized authenticated users receive 403 for mutation endpoints. |
| TASK-003 | Fix API ticket accept authorization. | P0 | Wave 1 | Ticket handler/admin scope | Unauthorized users cannot accept tickets. |
| TASK-004 | Remove predictable default password behavior and restrict fallback login. | P0 | Wave 1 | Break-glass policy | New accounts do not receive known passwords; fallback requires explicit flag. |
| TASK-005 | Disable or neutralize self-registration teacher access. | P0 | Wave 1 | Identity policy | New self-registered users have no effective teacher privileges. |
| TASK-006 | Extract Calendar services from route closures. | P1 | Wave 2 | TASK-001 | Routes delegate scheduling/availability/notification behavior to services. |
| TASK-007 | Extract PERCO gateway and HR attendance services. | P1 | Wave 2/5 | TASK-001 | Controllers no longer query external PERCO DB directly. |
| TASK-008 | Extract Certificate lifecycle services and audit writes. | P1 | Wave 2 | TASK-001 | Issue/revoke/generate/template changes create certificate audit records. |
| TASK-009 | Extract Directory/Profile application services. | P1 | Wave 2 | TASK-001 | Directory/Profile controllers stop directly coordinating authority/KPI/org writes. |
| TASK-010 | Build RBAC permission/effective authority foundation. | P1/P2 | Wave 3 | Source of Truth enforcement | Policies/middleware can query one effective authority service. |
| TASK-011 | Backfill AD-title/calendar and hardcoded certificate access into CRM grants. | P1/P2 | Wave 3 | TASK-010 | AD/title/email checks are removed or disabled. |
| TASK-012 | Build Organization assignment service and migrate reads. | P2/P3 | Wave 4 | TASK-010 | Authorization and KPI scope use organization service output. |
| TASK-013 | Replace `User::updated` KPI hydration with explicit service/event flow. | P2 | Wave 4 | TASK-012 | User updates no longer directly invoke KPI service from model callback. |
| TASK-014 | Delegate Governance effective mutations to target context handlers. | P2 | Wave 4 | TASK-010, TASK-012 | Governance workflow calls target services instead of directly mutating external aggregates. |
| TASK-015 | Add domain events and audit listeners for major transitions. | P2/P3 | Wave 6 | Services stable | Authority, org, KPI, calendar, certificate, questionnaire, testing transitions are audited. |
| TASK-016 | Add server capability read model and remove React access duplication. | P2 | Wave 6 | Effective authority and org scope | Sidebar/API clients consume server capabilities. |
| TASK-017 | Isolate legacy Survey and stabilize Questionnaire context. | P2 | Wave 6 | Questionnaire services | New questionnaire work does not depend on legacy Survey. |
| TASK-018 | Prepare Platonus staging integration. | P3 | Wave 8 | Academic/org/audit stable | Platonus records stage with conflict resolution and no direct authority writes. |
| TASK-019 | Physically modularize stable bounded contexts. | P3 | Wave 7 | Context services/contracts stable | Context namespaces/modules preserve route names and deployment model. |

## 16. Master Recommendation

The correct remediation strategy is disciplined evolutionary refactoring: contain unsafe surfaces immediately, finish Source of Truth and RBAC enforcement before touching authority aggregates, stabilize Organization before scope-dependent cleanup, extract application services before events, and only then consider physical modularization. The CRM can become the university-wide digital ecosystem without a rewrite if every future change respects domain ownership, governed authority, canonical organization scope, and audit-first enterprise controls.
