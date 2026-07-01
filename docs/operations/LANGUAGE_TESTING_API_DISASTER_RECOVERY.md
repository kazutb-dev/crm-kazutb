# Language Testing API Disaster Recovery Plan

## Failure Modes

### CRM application unavailable

- Signal: `/api/v1/health` unavailable or 5xx
- Action:
  1. Fail traffic to standby application nodes if available
  2. Restart PHP-FPM / web tier
  3. Validate health endpoint and authenticated list endpoint

### Database unavailable

- Signal: health endpoint reports `database=down`, connection errors, deadlocks, migration lock
- Action:
  1. Stop release activity
  2. Restore database connectivity
  3. Verify latest successful writes in `language_testing_sessions` and `language_testing_results`
  4. Resume traffic only after `submit` smoke test passes

### Queue unavailable

- Signal: health endpoint degraded, failed jobs growing, queue workers offline
- Action:
  1. Restart workers
  2. Inspect failed jobs table
  3. Confirm no admission-critical writes depend on async processing before reopening traffic

### Storage unavailable

- Signal: health endpoint reports `storage=down`
- Action:
  1. Restore filesystem or mounted volume
  2. Re-run health endpoint
  3. Validate exports if statistics export is in scope

## Data Loss Policy

- `submit` is transaction-protected and row-locked
- Duplicate retries with identical payload are idempotent
- Conflicting retries are rejected with `409`
- A result must never exist without its submitted session state

## Recovery Verification

1. `GET /api/v1/health`
2. Authenticated `GET /api/v1/tests`
3. Controlled `start -> submit` smoke flow in non-production or approved probe dataset
4. Review logs for 5xx, deadlocks, and 429 anomalies
