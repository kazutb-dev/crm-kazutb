# STATE

**Initialized:** 2026-05-26  
**Project Code:** CRM-KAZUTB  
**Current Phase:** 1 — Baseline Safety Enforcement  
**Workflow Stage:** new-project complete

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-26)

**Core value:** Ship operationally safe releases of a working CRM without risking production integrity.  
**Current focus:** Stabilization of migrations and release security.

## Repository Context

- **GSD workspace (authoritative):** `/var/www/laravel-react-dev`
- **Production checkout (deploy/sync only):** `/var/www/laravel-react`
- **Deployment entrypoint:** `scripts/deploy/deploy.sh` (run from dev repo)
- **Critical invariant:** Production git tree must be clean before release.

## Artifacts

- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/codebase/*.md` (existing brownfield map)

## Open Risks Snapshot

1. Migration regressions during release windows.
2. Operator error during high-risk deploy/rollback commands.
3. Drift between dev and prod runtime state affecting release confidence.

## Routing

Next command: `/gsd-plan-phase 1`
