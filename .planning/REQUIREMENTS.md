# Requirements: CRM KazUTB

**Defined:** 2026-05-26
**Core Value:** Ship operationally safe releases of a working CRM without risking production integrity.

## v1 Requirements

### Migration Stability

- [ ] **MIGR-01**: Release process blocks migration execution when production git tree is dirty.
- [ ] **MIGR-02**: Migration preflight validates pending migrations and rollback feasibility before production release.
- [ ] **MIGR-03**: Release pipeline supports explicit migration control (`--no-migrate`) with audit visibility.
- [ ] **MIGR-04**: Failed release with migration impact has a documented and executable rollback path (code + DB recovery steps).

### Release Security

- [ ] **RSEC-01**: Deployment operations are initiated from `/var/www/laravel-react-dev` via `scripts/deploy/deploy.sh`.
- [ ] **RSEC-02**: High-risk operations (release, prod->dev refresh, rollback) require explicit typed confirmation.
- [ ] **RSEC-03**: Release lock guarantees only one deployment operation executes at a time.
- [ ] **RSEC-04**: Safety/readiness checks include production cleanliness, backup presence, runtime drift, and health baseline.
- [ ] **RSEC-05**: Every deployment operation writes immutable operation history with operator, time, status, and risk level.

### Operational Verification

- [ ] **OPS-01**: Release readiness is consistently visible to operators before action selection.
- [ ] **OPS-02**: Post-release verification includes health checks and incident-tool commands for drift detection.
- [ ] **OPS-03**: Deployment guardrails are documented for repeatable operator use.

## v2 Requirements

### Advanced Delivery Automation

- **AUTO-01**: Add CI/CD-integrated deployment orchestration with protected approvals.
- **AUTO-02**: Add automated migration canary checks and progressive rollout controls.
- **AUTO-03**: Add continuous compliance reporting for release-security policies.

## Out of Scope

| Feature | Reason |
|---------|--------|
| GSD initialization in production checkout (`/var/www/laravel-react`) | Explicitly forbidden operating model |
| New business modules unrelated to migration/release safety | Not part of current stabilization objective |
| Full architecture rewrite | High risk and not required for targeted hardening |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MIGR-01 | Phase 1 | Pending |
| MIGR-02 | Phase 1 | Pending |
| MIGR-03 | Phase 2 | Pending |
| MIGR-04 | Phase 2 | Pending |
| RSEC-01 | Phase 1 | Pending |
| RSEC-02 | Phase 2 | Pending |
| RSEC-03 | Phase 2 | Pending |
| RSEC-04 | Phase 3 | Pending |
| RSEC-05 | Phase 3 | Pending |
| OPS-01 | Phase 3 | Pending |
| OPS-02 | Phase 4 | Pending |
| OPS-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-26*
*Last updated: 2026-05-26 after /gsd-new-project initialization*
