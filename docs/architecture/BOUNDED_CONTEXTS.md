# Bounded Contexts

## Purpose

This document records the target bounded contexts for incremental enterprise refactoring. It does not move code or change runtime behavior.

## Target Contexts

| Context | Owns | Must not own |
|---|---|---|
| Identity | Authentication, login state, AD identity attributes, local break-glass identity controls. | Roles, permissions, organization scope, workflow authority. |
| Directory/Profile | User directory views, self-profile use cases, profile verification, profile read models. | Effective roles, grants, organization hierarchy, KPI workflow. |
| Authority/Governance | Roles, permissions, scoped grants, delegations, approval requests, effective authority, break-glass audit. | Identity proof, organization hierarchy, module-specific business workflows. |
| Organization | Org units, hierarchy, positions, assignments, legacy mappings, organization scope. | AD identity attributes, KPI scoring, certificate lifecycle. |
| Academic Context | Employee/student academic profiles, academic assignments, Platonus staging contracts. | CRM authority decisions, direct role grants. |
| KPI | Periods, indicators, entries, KPI workflow, calculations, structural confirmation, exports. | User identity ownership, organization master data. |
| Calendar | Availability, events, scheduling workflow, conflict detection, delegation, conferencing and notification orchestration. | AD-based authority decisions, global organization ownership. |
| Certificates | Templates, versions, numbering, generation, issue, revoke, registry, verification, certificate audit. | Directory role assignment, identity proof. |
| Questionnaire | Survey dictionaries, survey workflow, response eligibility, submissions, analytics. | Legacy Survey ownership beyond compatibility. |
| Testing | Bindings, tests, questions, attempts/results, scoring, analytics. | Academic source ownership, global RBAC design. |
| HR Attendance | PERCO gateway use cases, attendance reporting, shift and holiday policy. | PERCO schema ownership, Directory identity authority. |
| Library | Loans, reservations, catalog anti-corruption layer, local availability adjustments. | External catalog source ownership. |
| Communications | Announcements, navigation, phonebook, communication read models. | RBAC authority rules. |
| Audit/Monitoring | Domain event audit, activity logs, operational monitoring views. | Business decision ownership. |
| Integrations | AD, Platonus, PERCO, Zoom, WhatsApp, library catalog, AI gateways. | Business workflows and effective authority. |

## Stabilization Rule

A bounded context becomes eligible for physical modularization only after its application services, contracts, policies, events, audit behavior, and rollback path are stable.
