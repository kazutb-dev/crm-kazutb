# Roadmap: CRM KazUTB Stabilization

**Created:** 2026-05-26  
**Project:** CRM KazUTB (Laravel + React)  
**Core Value:** Ship operationally safe releases of a working CRM without risking production integrity.

## Phase 1: Baseline Safety Enforcement

**Goal:** Make release preconditions explicit and non-negotiable for migration-safe production operations.

**Requirements covered:**
- MIGR-01
- MIGR-02
- RSEC-01

**Scope:**
- Enforce clean production tree check as hard gate before release.
- Verify migration preflight readiness and rollback feasibility checks.
- Ensure deployment execution path is anchored to `scripts/deploy/deploy.sh` from dev checkout.

**Success criteria:**
- Release attempt fails fast when PROD git tree is dirty.
- Operators can see migration preflight output before release execution.
- Team runbook references only dev-repo deploy entrypoint.

---

## Phase 2: Migration Control & Critical Operation Guardrails

**Goal:** Reduce release blast radius with controlled migration toggles and explicit high-risk confirmations.

**Requirements covered:**
- MIGR-03
- MIGR-04
- RSEC-02
- RSEC-03

**Scope:**
- Harden migration execution control and auditability (`--no-migrate` handling and visibility).
- Validate rollback flow for migration-affected releases (code + DB recovery procedure).
- Confirm high-risk commands require typed operator confirmation and lock protection.

**Success criteria:**
- Release logs clearly indicate migration mode used.
- Rollback procedure is executable and validated in rehearsal.
- Concurrent deployment attempts are safely prevented.

---

## Phase 3: Release Security Telemetry

**Goal:** Strengthen operational trust by making release safety state and history auditable.

**Requirements covered:**
- RSEC-04
- RSEC-05
- OPS-01

**Scope:**
- Standardize readiness indicators (cleanliness, backup, drift, health baseline).
- Ensure immutable operation history captures actor, operation risk, status, and timestamps.
- Improve operator-facing safety visibility in interactive and CLI paths.

**Success criteria:**
- Readiness output is consistent across release sessions.
- Operation history is complete and queryable for recent runs.
- Safety audit output is sufficient for go/no-go decisions.

---

## Phase 4: Verification & Operational Playbook Finalization

**Goal:** Make release safety repeatable via verification routines and documented guardrails.

**Requirements covered:**
- OPS-02
- OPS-03

**Scope:**
- Define and execute post-release verification sequence using health and incident tools.
- Consolidate migration/release safety playbook for operators.
- Close remaining gaps discovered during phase rehearsals.

**Success criteria:**
- Post-release verification checklist is consistently executed.
- Operators have a single authoritative playbook for release safety.
- No unresolved critical blockers remain for safe release operation.

---

## Milestone Outcome

When Phases 1–4 are complete, CRM KazUTB release operations should be migration-stable, policy-enforced, and auditable, with production cleanliness preserved as a hard release invariant.

## Next Action

Run: `/gsd-plan-phase 1`
