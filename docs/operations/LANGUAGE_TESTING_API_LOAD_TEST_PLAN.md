# Language Testing API Load Test Plan

## Goal

Validate that the public integration API remains stable during admission peaks with 100, 500, and 1000 concurrent applicants.

## Scope

- `GET /api/v1/health`
- `GET /api/v1/tests`
- Optional staged extension: `GET /api/v1/tests/{id}/start` and `POST /api/v1/tests/{id}/submit` against seeded non-production data

## Tooling

- k6 script: `scripts/load-testing/language-testing-api.k6.js`
- Metrics sources:
  - nginx access/error logs
  - Laravel application logs
  - database CPU / connections / slow query logs
  - queue depth and failed jobs
  - Laravel Pulse dashboards

## Success Targets

- List endpoints average latency under 200 ms
- 95th percentile under 500 ms
- Error rate below 1%
- No 5xx bursts
- No database deadlocks during submit scenario

## Test Stages

1. Warmup at 20 users for 2 minutes
2. 100 concurrent applicants for 2 minutes
3. 500 concurrent applicants for 5 minutes
4. 1000 concurrent applicants for 10 minutes
5. Cooldown and result capture

## Commands

```bash
K6_BASE_URL=https://crm.kaztbu.edu.kz \
K6_API_KEY=<integration-key> \
k6 run scripts/load-testing/language-testing-api.k6.js
```

## Required Preconditions

- Dedicated maintenance window or staging clone
- Production-like database volume
- Stable integration credentials
- Pulse enabled for target environment
- Alerting recipients on standby

## Exit Criteria

- Thresholds in the k6 scenario remain green
- No unexplained 429 or 5xx spikes
- No queue backlog growth for submit workload
- No failed submissions or duplicate results
