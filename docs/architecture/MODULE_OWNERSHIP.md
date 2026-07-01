# Module Ownership

## Purpose

Every future module change must declare ownership before implementation. This prevents new cross-domain behavior from being added to controllers, middleware, routes, or `User`.

## Required Ownership Declaration

Every new feature or refactoring task must declare:

- Owner Domain.
- Aggregate Root.
- Source of Truth.
- RBAC integration point.
- Organization scope requirement.
- Workflow requirement.
- Audit requirement.
- Application Service name.
- Rollback strategy.

## Ownership Rules

- Identity changes belong to Identity unless they change authority or organization.
- Authority changes belong to Authority/Governance even when initiated from Directory/Profile screens.
- Organization changes belong to Organization even when displayed in User, KPI, Calendar, or HR screens.
- KPI changes belong to KPI unless they modify roles, grants, or canonical organization assignments.
- Calendar scheduling changes belong to Calendar; Zoom and WhatsApp remain infrastructure gateways.
- Certificate lifecycle changes belong to Certificates and must be audited.
- Questionnaire and Testing must remain separate contexts unless a future approved migration explicitly merges behavior.
- External systems must enter through Infrastructure gateways and anti-corruption mapping.

## Compatibility Rule

Existing controllers, routes, APIs, frontend screens, and database fields may remain as compatibility adapters during migration. Compatibility adapters are not source-of-truth owners.
