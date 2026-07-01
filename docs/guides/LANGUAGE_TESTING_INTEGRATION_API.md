# Language Testing Integration API Guide

## Purpose

CRM is the source of truth for language testing. External clients, including the AI Student Platform, must use the REST API only.

## Base URLs

- Production: `https://crm.kaztbu.edu.kz`
- Public contract: `docs/modules/language-testing-ai-students-api.yaml`

## Authentication

- Preferred integration mode: send `X-API-KEY: <key>`.
- Optional integration mode: send `Authorization: Bearer <integration-token>` when `LANGUAGE_TESTING_INTEGRATION_BEARER_TOKEN` is configured.
- CRM-only management endpoints use Sanctum bearer authentication.
- Backward compatibility: `LANGUAGE_TESTING_API_KEY` is still accepted when the new integration key is not configured.

## Required Environment Variables

```env
LANGUAGE_TESTING_INTEGRATION_API_KEY=
LANGUAGE_TESTING_INTEGRATION_BEARER_TOKEN=
LANGUAGE_TESTING_API_KEY=
```

Set the new integration variables first. Keep the legacy key only during migration and rotate away from any historical default values.

## Public Endpoints

- `GET /api/v1/health`
- `GET /api/v1/tests`
- `GET /api/v1/tests/{id}`
- `GET /api/v1/tests/{id}/start`
- `POST /api/v1/tests/{id}/submit`

## Response Conventions

- List endpoints return `data` plus `meta`.
- Single-record endpoints return `data`.
- Start and submit responses remain top-level for backward compatibility.
- All JSON responses include `request_id`.
- Error responses return `message` and, when relevant, `errors`.

## Request Tracing

- Response headers: `X-Request-ID`, `X-Correlation-ID`
- Incoming headers accepted: `X-Request-ID`, `X-Correlation-ID`, `X-API-KEY`, `X-API-KEY-ID`

## Rate Limiting

- Integration API traffic is limited by credential fingerprint and client IP.
- Exceeded requests return `429` with the standard JSON error format.

## Health Endpoint

`GET /api/v1/health` is public and returns only:

- API version
- Overall status
- Database status
- Queue configuration status
- Storage status
- Integration configuration status
- Language Testing module status
- Timestamp

## Verified curl Examples

```bash
curl https://crm.kaztbu.edu.kz/api/v1/health
```

```bash
curl -H 'X-API-KEY: <integration-key>' https://crm.kaztbu.edu.kz/api/v1/tests
```

```bash
curl -H 'X-API-KEY: <integration-key>' https://crm.kaztbu.edu.kz/api/v1/tests/1/start
```

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -H 'X-API-KEY: <integration-key>' \
  -d '{"session_id":"<uuid>","first_name":"AI","last_name":"Student","email":"student@example.test","answers":[{"question_id":1,"answer_id":2}]}' \
  https://crm.kaztbu.edu.kz/api/v1/tests/1/submit
```
