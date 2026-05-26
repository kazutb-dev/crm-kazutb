# CRM KazUTB (Laravel + React)

## What This Is

Internal university CRM for KazUTB built as a Laravel 12 + Inertia React monolith. It supports role-based workflows (KPI, HR/perco analytics, calendar, tickets, announcements, API access) for staff operations. Work planning and GSD execution are performed only in `/var/www/laravel-react-dev`; production checkout `/var/www/laravel-react` is for deploy/sync validation only.

## Core Value

Ship operationally safe releases of a working CRM without risking production integrity.

## Requirements

### Validated

- ✓ Role-based web application is running in Laravel + React/Inertia and is actively used across CRM modules.
- ✓ Deployment platform exists at `scripts/deploy/deploy.sh` with lock management, safety/readiness checks, backups, release/rollback commands, and operation history.
- ✓ Release readiness already tracks DEV/PROD cleanliness, backup presence, runtime drift, and health status.

### Active

- [ ] Stabilize migration behavior so releases remain predictable and reversible.
- [ ] Enforce release-security gates around production cleanliness and deploy-path discipline.
- [ ] Improve release verification and operator guidance for high-risk deployment paths.

### Out of Scope

- Re-initializing GSD in `/var/www/laravel-react` (production checkout) — prohibited; PROD is deploy/sync only.
- Major feature expansion unrelated to migration stability and release security — not aligned with current focus.
- Replacing current Laravel + React architecture — unnecessary for current risk-reduction goal.

## Context

- Codebase map exists in `.planning/codebase/` and indicates a large brownfield Laravel + React system with high-complexity controllers and deployment scripts.
- Deployment entrypoint is `scripts/deploy/deploy.sh` and must be run from the dev repository checkout.
- Critical operating rule: production git tree must stay clean before release.
- Current focus from project owner: migration stabilization and release safety hardening.

## Constraints

- **Workspace**: GSD planning and execution only in `/var/www/laravel-react-dev` — prevent mixed-state planning across checkouts.
- **Production Safety**: `/var/www/laravel-react` must remain clean before release — dirty PROD tree is a release blocker.
- **Entrypoint**: Deployment flow is centralized through `scripts/deploy/deploy.sh` — avoid ad-hoc release commands.
- **Compatibility**: Preserve existing Laravel 12 + React/Inertia runtime and current operational scripts.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat this as a brownfield initialization | Existing CRM + deploy platform already in production use | ✓ Good |
| Keep research optional and proceed directly to requirements/roadmap | Current objective is operational stabilization, not market discovery | ✓ Good |
| Define Phase 1 around migration + release safety baseline | This is the highest-risk area and current business priority | — Pending |

## Evolution

After each phase transition:
1. Move completed active requirements to validated with phase reference.
2. Record any newly discovered operational constraints or migration risks.
3. Re-check that "PROD must stay clean before release" remains enforced by process and tooling.
4. Update active scope if stabilization uncovers prerequisite hardening work.

After each milestone:
1. Re-evaluate whether release safety baseline is measurably better.
2. Audit out-of-scope items to confirm they remain intentionally deferred.
3. Update context with post-release findings and incident learnings.

---
*Last updated: 2026-05-26 after /gsd-new-project initialization*
