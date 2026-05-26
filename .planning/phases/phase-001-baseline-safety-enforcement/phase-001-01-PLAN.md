---
phase: phase-001-baseline-safety-enforcement
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/deploy/deploy.sh
  - scripts/deploy/lib_deploy_common.sh
  - scripts/deploy/dev_to_prod_release.sh
  - scripts/deploy/check_deploy_safety.sh
  - docs/deployment.md
  - docs/release-policy.md
autonomous: true
requirements:
  - MIGR-01
  - MIGR-02
  - RSEC-01
must_haves:
  truths:
    - "Release attempt exits before any migration step when PROD git tree is dirty (MIGR-01, per D-03)."
    - "Release output shows migration preflight status (pending migrations + rollback-feasibility signal) before executing release (MIGR-02, per D-04)."
    - "Production release is only initiated through scripts/deploy/deploy.sh from /var/www/laravel-react-dev (RSEC-01, per D-01 and D-02)."
  artifacts:
    - path: "scripts/deploy/deploy.sh"
      provides: "Entrypoint guard and command-level enforcement for dev-checkout invocation"
      contains: "DEV_ROOT and invocation guard logic"
    - path: "scripts/deploy/lib_deploy_common.sh"
      provides: "Shared hard-gate helpers for release path checks"
      exports: ["require_clean_git_or_checkpoint", "migration preflight helper", "router invocation helper"]
    - path: "scripts/deploy/dev_to_prod_release.sh"
      provides: "Fail-fast release flow with explicit migration preflight block before migrate"
      contains: "dirty-tree gate before migration command"
    - path: "scripts/deploy/check_deploy_safety.sh"
      provides: "Safety audit output aligned with release preflight expectations"
      contains: "migration readiness and rollback-feasibility reporting"
    - path: "docs/release-policy.md"
      provides: "Operator policy that mandates deploy.sh from dev checkout"
      contains: "non-negotiable entrypoint statement"
  key_links:
    - from: "scripts/deploy/deploy.sh"
      to: "scripts/deploy/dev_to_prod_release.sh"
      via: "dispatch release run_locked_script path"
      pattern: "run_locked_script.*dev_to_prod_release.sh"
    - from: "scripts/deploy/dev_to_prod_release.sh"
      to: "scripts/deploy/lib_deploy_common.sh"
      via: "shared gate/preflight function calls"
      pattern: "source.*lib_deploy_common.sh"
    - from: "docs/release-policy.md"
      to: "scripts/deploy/deploy.sh"
      via: "operator command examples"
      pattern: "deploy.sh release"
---

<objective>
Implement Phase 1 baseline release-safety enforcement so migration execution is blocked by hard preconditions and operators have one non-bypassable release entrypoint.

Purpose: Make migration-safe production release behavior explicit and non-negotiable in script logic and operator policy.
Output: Hardened deploy scripts plus updated release policy docs that satisfy MIGR-01, MIGR-02, and RSEC-01.
</objective>

<execution_context>
@~/.copilot/get-shit-done/workflows/execute-plan.md
@~/.copilot/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/phase-001-baseline-safety-enforcement/phase-001-CONTEXT.md
@scripts/deploy/deploy.sh
@scripts/deploy/dev_to_prod_release.sh
@scripts/deploy/lib_deploy_common.sh
@scripts/deploy/check_deploy_safety.sh
@docs/deployment.md
@docs/release-policy.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Enforce deploy entrypoint discipline from dev checkout</name>
  <files>scripts/deploy/deploy.sh, scripts/deploy/lib_deploy_common.sh, scripts/deploy/dev_to_prod_release.sh</files>
  <behavior>
    - Test 1: Running release through deploy.sh from non-dev checkout exits with a blocking error that names /var/www/laravel-react-dev (RSEC-01, per D-01).
    - Test 2: Running dev_to_prod_release.sh directly without deploy.sh context exits with a blocking error that instructs deploy.sh usage (RSEC-01, per D-02).
  </behavior>
  <action>Add a shared invocation guard in lib_deploy_common.sh and call it from dev_to_prod_release.sh so direct execution is blocked unless routed by deploy.sh; update deploy.sh to assert current working directory is /var/www/laravel-react-dev before dispatching mutating production commands (release and related high-risk paths) per D-01 and D-02. Keep read-only commands (help, lock-status, history) usable for diagnostics, but do not allow a bypass path for production release initiation.</action>
  <verify>
    <automated>bash -n scripts/deploy/deploy.sh scripts/deploy/lib_deploy_common.sh scripts/deploy/dev_to_prod_release.sh</automated>
    <automated>(cd /tmp && /var/www/laravel-react-dev/scripts/deploy/deploy.sh release --dry-run --yes) 2>&1 | grep -q "/var/www/laravel-react-dev"</automated>
    <automated>(cd /var/www/laravel-react-dev && ./scripts/deploy/dev_to_prod_release.sh --dry-run) 2>&1 | grep -q "deploy.sh release"</automated>
  </verify>
  <done>Release initiation is blocked outside dev checkout and blocked for direct-script invocation, with clear remediation text pointing to scripts/deploy/deploy.sh.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add fail-fast migration preflight and rollback-feasibility signal</name>
  <files>scripts/deploy/lib_deploy_common.sh, scripts/deploy/dev_to_prod_release.sh, scripts/deploy/check_deploy_safety.sh</files>
  <behavior>
    - Test 1: If PROD tree is dirty, release exits before any migrate command path is reached (MIGR-01, per D-03).
    - Test 2: Release dry-run prints a dedicated migration preflight block with pending migration status and rollback-feasibility signal before execution (MIGR-02, per D-04).
  </behavior>
  <action>Create a shared migration preflight helper in lib_deploy_common.sh that reports pending migration state and a rollback-feasibility signal for migrations in origin/main..origin/dev, then invoke it from dev_to_prod_release.sh before mutate steps and before any migrate command. Align check_deploy_safety.sh output fields with the same helper so operators see consistent readiness data in safety and release paths. Preserve existing dangerous-migration detection and keep the dirty-PROD hard fail semantics strict per D-03.</action>
  <verify>
    <automated>bash -n scripts/deploy/lib_deploy_common.sh scripts/deploy/dev_to_prod_release.sh scripts/deploy/check_deploy_safety.sh</automated>
    <automated>./scripts/deploy/deploy.sh release --dry-run --yes | grep -E "Migration Preflight|rollback-feasibility|pending migration"</automated>
    <automated>./scripts/deploy/deploy.sh release --dry-run --yes | awk '/Migration Preflight/{p=1} p&&/migrate --force/{print; exit 0} END{exit (p?0:1)}'</automated>
  </verify>
  <done>Release preflight visibly reports migration readiness and exits early on dirty PROD without reaching migration execution.</done>
</task>

<task type="auto">
  <name>Task 3: Update operator policy docs to match hard gates</name>
  <files>docs/deployment.md, docs/release-policy.md</files>
  <action>Revise deployment and release policy docs so production release instructions mandate scripts/deploy/deploy.sh from /var/www/laravel-react-dev only (RSEC-01, per D-02), and document the migration preflight output interpretation (MIGR-02, per D-04) plus dirty-PROD fail-fast behavior (MIGR-01, per D-03). Remove or explicitly mark any direct-script release examples as prohibited for routine operations to avoid operator bypass ambiguity.</action>
  <verify>
    <automated>grep -n "deploy.sh release" docs/deployment.md docs/release-policy.md && grep -n "dirty" docs/release-policy.md</automated>
  </verify>
  <done>Docs provide one authoritative release path and explain preflight/fail-fast gates consistently with script behavior.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Operator shell -> deploy scripts | Untrusted operator input/flags can trigger production mutations |
| DEV checkout -> PROD checkout | Release automation copies code and executes migrate/build on PROD |
| Git origin refs -> preflight logic | Incorrect ref interpretation can misstate migration risk |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-001-01 | Spoofing | Release command invocation path | mitigate | Enforce deploy.sh-only release initiation from DEV_ROOT and reject direct script execution for release path |
| T-001-02 | Tampering | PROD working tree before release | mitigate | Keep hard clean-tree gate before migration/build and fail before side effects |
| T-001-03 | Repudiation | Operator safety decision trail | mitigate | Keep release invocation routed through deploy.sh operation history and explicit preflight output |
| T-001-04 | Information Disclosure | Safety output/logs | accept | Preflight output reports migration state only; no secrets should be printed; retain existing sensitive-file checks |
| T-001-05 | Denial of Service | Over-strict gate blocks safe release | mitigate | Emit actionable error text and keep dry-run path to diagnose gate failures before live release |
| T-001-06 | Elevation of Privilege | Bypass of guarded release path | mitigate | Guard both router (cwd/entrypoint) and release script provenance checks to prevent alternate invocation path |
</threat_model>

<verification>
- `bash -n scripts/deploy/deploy.sh scripts/deploy/lib_deploy_common.sh scripts/deploy/dev_to_prod_release.sh scripts/deploy/check_deploy_safety.sh`
- `./scripts/deploy/deploy.sh safety` shows migration readiness/rollback-feasibility fields
- `./scripts/deploy/deploy.sh release --dry-run --yes` prints migration preflight block before execution path
- Direct call `./scripts/deploy/dev_to_prod_release.sh --dry-run` is rejected unless routed by deploy.sh
</verification>

<success_criteria>
- MIGR-01: Dirty PROD tree blocks release before migration execution path.
- MIGR-02: Operators always see migration preflight + rollback-feasibility signal in release workflow.
- RSEC-01: Release initiation is enforced through deploy.sh from /var/www/laravel-react-dev and reflected in policy docs.
</success_criteria>

<output>
Create `.planning/phases/phase-001-baseline-safety-enforcement/phase-001-01-SUMMARY.md` when done
</output>
