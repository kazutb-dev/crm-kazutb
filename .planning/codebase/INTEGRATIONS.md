# External Integrations

**Analysis Date:** 2026-05-26

## APIs & External Services

**AI Services:**
- OpenAI Chat Completions - AI assistant responses and topic similarity scoring.
  - SDK/Client: Laravel HTTP client (`Illuminate\Support\Facades\Http`) in `app/Http/Controllers/Api/AiChatController.php` and `app/Services/AiTopicReviewService.php`
  - Auth: `OPENAI_API_KEY`, `TOPIC_AI_API_KEY` in `config/services.php`

**Messaging & Communications:**
- Zoom API - Meeting lifecycle (create/update/cancel) for calendar conferences.
  - SDK/Client: Laravel HTTP client in `app/Services/ZoomMeetingService.php`
  - Auth: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` in `config/services.php`
- Green API (WhatsApp) - WhatsApp notification delivery.
  - SDK/Client: Laravel HTTP client in `app/Services/GreenApiWhatsAppNotifier.php`
  - Auth: `GREEN_API_INSTANCE_ID`, `GREEN_API_API_TOKEN_INSTANCE` in `config/services.php`
- Telegram Bot API - Telegram notifications client exists.
  - SDK/Client: Laravel HTTP client in `app/Services/TelegramNotifier.php`
  - Auth: expected `services.telegram.*` keys are referenced in code, but `telegram` section is not detected in `config/services.php`.

**Directory & Internal Enterprise Systems:**
- Active Directory (LDAP/LDAPS) - User lookup/auth sync.
  - SDK/Client: native LDAP functions in `app/Services/ActiveDirectoryAuthenticator.php`
  - Auth: `AD_BIND_DN`, `AD_BIND_PASSWORD` in `config/ad.php`
- Library Catalog API (internal HTTP endpoint) - Book availability lookup.
  - SDK/Client: Laravel HTTP client in `app/Http/Controllers/LibraryLoanController.php`
  - Auth: none detected in code path; endpoint/timeout via `LIBRARY_CATALOG_ENDPOINT`, `LIBRARY_CATALOG_TIMEOUT` in `config/services.php`
- PERCO HR/attendance database - External HR time-tracking data source via dedicated DB connection.
  - SDK/Client: Laravel DB connection `perco` in `app/Http/Controllers/PercoController.php` and `app/Http/Controllers/Api/HrPercoController.php`
  - Auth: `PERCO_DB_HOST`, `PERCO_DB_DATABASE`, `PERCO_DB_USERNAME`, `PERCO_DB_PASSWORD` in `config/database.php`

## Data Storage

**Databases:**
- Primary application DB: Laravel-configured relational DB (`sqlite`, `mysql`, `mariadb`, `pgsql`, `sqlsrv`) in `config/database.php`
  - Connection: `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
  - Client: Eloquent ORM / Query Builder (`app/Models/*`, controllers)
- Secondary DB: `perco` MySQL connection for HR/perimeter/time data in `config/database.php`
  - Connection: `PERCO_DB_*`
  - Client: Query Builder in `PercoController` and `HrPercoController`

**File Storage:**
- Local filesystem disks (`local`, `public`) enabled by default in `config/filesystems.php`
- Optional S3 disk configured in `config/filesystems.php` (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET`, etc.)

**Caching:**
- Default cache store: `database` (`config/cache.php`)
- Optional stores configured: `redis`, `memcached`, `dynamodb`, `file`, `array` (`config/cache.php`)

## Authentication & Identity

**Auth Provider:**
- Laravel Sanctum + Laravel auth stack.
  - Implementation: stateful SPA and token auth (`config/sanctum.php`, `bootstrap/app.php`, `routes/api.php`)
- Optional enterprise identity: Active Directory LDAP.
  - Implementation: bind/search/authenticate and local user upsert in `app/Services/ActiveDirectoryAuthenticator.php` with settings from `config/ad.php`

## Monitoring & Observability

**Error Tracking:**
- No dedicated external error tracker (e.g., Sentry/Bugsnag) detected.
- Built-in observability packages: Laravel Pulse and Telescope configured in `config/pulse.php` and `config/telescope.php`.

**Logs:**
- Laravel Monolog channels (stack/single/daily/etc.) in `config/logging.php`
- Optional Slack logging channel configured with `LOG_SLACK_WEBHOOK_URL` in `config/logging.php`

## CI/CD & Deployment

**Hosting:**
- Not detected (no Dockerfile/Compose/Procfile/workflow deployment manifests found at project root or `.github/`).

**CI Pipeline:**
- Not detected (`.github/workflows/` not present).

## Environment Configuration

**Required env vars:**
- Core app/runtime: `APP_*` in `config/app.php`
- Database: `DB_*` and `PERCO_DB_*` in `config/database.php`
- Auth: `SANCTUM_STATEFUL_DOMAINS` and related Sanctum vars in `config/sanctum.php`
- AI/External services: `OPENAI_*`, `TOPIC_AI_*`, `ZOOM_*`, `GREEN_API_*`, `LIBRARY_CATALOG_*` in `config/services.php`
- Directory integration: `AD_*` in `config/ad.php`
- Optional infra/services: `AWS_*`, `REDIS_*`, `MAIL_*`, `LOG_*`, `TELESCOPE_*`, `PULSE_*`

**Secrets location:**
- Environment files detected at repo root (`.env`, `.env.testing`, `.env.example`) and env-based config lookups throughout `config/*.php`.

## Webhooks & Callbacks

**Incoming:**
- No business webhooks explicitly defined in `routes/api.php` or `routes/web.php`.

**Outgoing:**
- OpenAI: `https://api.openai.com/v1/chat/completions` from `AiChatController` and default `topic_ai.endpoint` in `config/services.php`
- Zoom OAuth/API: `https://zoom.us` and `https://api.zoom.us` from `app/Services/ZoomMeetingService.php`
- Telegram Bot API: `https://api.telegram.org/.../sendMessage` from `app/Services/TelegramNotifier.php`
- Green API: `https://api.green-api.com/...` from `app/Services/GreenApiWhatsAppNotifier.php`
- Internal catalog API default: `http://10.0.1.8:5173/api/v1/catalog` from `config/services.php` and `LibraryLoanController`

---

*Integration audit: 2026-05-26*
