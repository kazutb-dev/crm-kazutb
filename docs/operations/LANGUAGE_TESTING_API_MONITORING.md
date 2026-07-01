# Language Testing API Monitoring Plan

## Core Metrics

- Request rate by endpoint
- 2xx / 4xx / 5xx counts
- Average and p95 latency
- Rate-limit responses (`429`)
- Submit success vs conflict (`409`) vs validation (`422`)
- Queue depth and failed jobs
- Database connection errors and deadlocks

## Minimum Pulse Dashboard

- `GET /api/v1/health` availability
- `GET /api/v1/tests` latency and error rate
- `GET /api/v1/tests/{id}/start` latency and error rate
- `POST /api/v1/tests/{id}/submit` latency and error rate
- Queue health widget
- Failed jobs widget

## Alert Thresholds

- Health endpoint not `200` for 2 consecutive minutes
- `5xx` rate above 1% over 5 minutes
- `p95` list latency above 500 ms over 10 minutes
- Submit conflict spike above normal retry baseline
- Failed jobs count increasing for 5 minutes

## Log Review Fields

- `request_id`
- `correlation_id`
- `consumer`
- `api_key_id`
- `method`
- `path`
- `status`
- `duration_ms`

## Privacy Rules

- Never log IIN
- Never log email
- Never log phone
- Never log answers
- Never log API keys or bearer tokens

## Operational Checks Before Admission Peak

1. Confirm health endpoint returns `configuration=configured`
2. Confirm Pulse dashboards refresh in real time
3. Confirm alert routing for 5xx and degraded health
4. Confirm queue workers restart automatically
