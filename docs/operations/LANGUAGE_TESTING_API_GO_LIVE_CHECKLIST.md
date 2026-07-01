# Language Testing API Go-Live Checklist

## Go / No-Go Gates

- OpenAPI v1 is updated and published
- Contract tests are green in CI
- Integration feature tests are green in CI
- Health endpoint returns `status=ok`
- Authenticated `GET /api/v1/tests` smoke test is green
- Duplicate submit scenario verified
- Expired session scenario verified
- Rate limiting thresholds reviewed with admissions traffic expectations
- Integration credentials rotated and documented
- Database backup verified
- Queue workers healthy
- Pulse dashboards available
- On-call contacts confirmed for admissions window

## Manual Smoke Commands

```bash
curl https://crm.kaztbu.edu.kz/api/v1/health
```

```bash
curl -H 'Accept: application/json' -H 'X-API-KEY: <integration-key>' https://crm.kaztbu.edu.kz/api/v1/tests
```

## No-Go Conditions

- Any contract test failure
- Any unexplained 5xx response in smoke tests
- Missing integration credentials
- Health endpoint degraded
- Duplicate submit creates more than one result
