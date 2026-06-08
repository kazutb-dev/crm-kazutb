# Integrations

## 1) External Systems

| Integration | Purpose | Config source | Evidence |
|-------------|---------|---------------|----------|
| MySQL | Main application database | `.env`, `config/database.php` | `php artisan about`, `.env.example` |
| Active Directory / LDAP | Login and user sync | `AD_*` env vars, `config/ad.php` | `.env.example`, `ActiveDirectoryAuthenticator.php` |
| OpenAI / Topic AI | KPI assistant and topic similarity support | `OPENAI_*`, `TOPIC_AI_*`, `config/services.php` | `KpiKnowledgeService.php`, `AiTopicReviewService.php`, `TopicSimilarityService.php` |
| Green API WhatsApp | Calendar notifications | `GREEN_API_*`, `config/services.php` | `GreenApiWhatsAppNotifier.php`, calendar routes |
| Zoom | Online meeting create/update/cancel | `ZOOM_*`, `config/services.php` | `ZoomMeetingService.php`, calendar routes |
| Library catalog | Remote catalog lookup | `LIBRARY_CATALOG_*`, `config/services.php` | `routes/web.php` library catalog closure |
| Perco | HR/time tracking data source | `PERCO_DB_*` env vars | `.env` key list, `PercoController.php`, `Api/HrPercoController.php` |
| Mail | Local log mailer by default | `MAIL_*`, `config/mail.php` | `.env.example`, `php artisan about` |
| Pulse/Telescope | Runtime/dev monitoring | `config/pulse.php`, `config/telescope.php` | `composer.json`, `php artisan about` |

## 2) Databases and Storage

- Main DB driver: MySQL in this DEV environment.
- Test config also sets `DB_CONNECTION=mysql`; tests are not automatically in-memory.
- Runtime files include storage uploads, public storage symlink, Vite build output and local backups.
- Backups are local according to `docs/PROJECT_CONTEXT.md`; offsite backup is documented as missing.

## 3) Auth and Access Integrations

- Web auth comes from Laravel/Breeze-style auth routes.
- API auth uses Sanctum for protected API routes.
- AD can create/update local users through `ActiveDirectoryAuthenticator`.
- KPI grants, scoped grants, delegations and org units extend base role access.

## 4) Unknowns / User Questions

- `[ASK USER]` Which integrations are enabled in real PROD today: AD, Green API, Zoom, OpenAI, Perco, library catalog?
- `[ASK USER]` Is there offsite backup outside this server now, or is local-only still current?
- `[TODO]` Confirm production `.env` values and nginx/security headers from PROD environment, not from DEV files.

## 5) Evidence

- `.env.example`
- `config/services.php`
- `config/ad.php`
- `routes/api.php`
- `routes/web.php`
- `app/Services/ActiveDirectoryAuthenticator.php`
- `app/Services/GreenApiWhatsAppNotifier.php`
- `app/Services/ZoomMeetingService.php`
- `docs/PROJECT_CONTEXT.md`
