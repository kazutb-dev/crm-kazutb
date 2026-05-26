# Deployment Toolkit (PROD + DEV)

## Platform Console (new)

- Primary operational guide for the redesigned interactive deployment platform:
   ./docs/deployment-platform.md
- Main interactive entrypoint:
   ./scripts/deploy/deploy.sh

## 1. Архитектура окружений

- PROD: /var/www/laravel-react
- DEV: /var/www/laravel-react-dev
- GitHub: https://github.com/kazutb-dev/crm-kazutb.git
- PROD branch: main
- DEV branch: dev
- PROD DB = source of truth для реальных данных пользователей.
- DEV обновляется из PROD для актуальной разработки и проверки.

## 2. Основные правила

- Релиз в PROD только через GitHub flow: dev -> main, затем pull на PROD.
- Инициировать release разрешено только из `/var/www/laravel-react-dev` через `./scripts/deploy/deploy.sh release`.
- Никакого rsync-деплоя между серверами.
- DEV database никогда не копируется поверх PROD database.
- PROD database копируется в DEV только через PROD backup dump и DEV credentials.
- Перед любым deploy в PROD обязательно:
  - backup PROD
  - git checkpoint/tag
- Seeders для PROD только idempotent:
  - updateOrCreate
  - firstOrCreate
  - upsert
- Нельзя делать destructive операции без backup и явного подтверждения.
- Нельзя коммитить .env, backups, sql/tar dumps, vendor, node_modules, skills.
- На PROD не запускать тесты в deploy-скриптах.

### Инварианты после инцидента DEV sync/deploy

- Любой state-changing script обязан проходить через checkpoint + backup + post-check.
- Для release используется push-first модель: origin/main может обновиться до завершения локальных post-check.
- При release-failure после push source-of-truth = origin/main, оператор действует по recovery playbook (freeze -> diagnose -> approved rollback).
- Dry-run режим должен быть строго non-mutating (без reset/push/db restore/tar extract).
- Любая ошибка sync/release должна оставлять понятную recovery-инструкцию (checkpoint branch/tag + backup path).
- Удаления protected-path блокируются по умолчанию (нужен явный override).
- В PROD/DEV запрещены reset/seed/fresh/wipe команды в deploy toolchain.

## 3. Ежедневная работа

### Если правили PROD напрямую

1. Зафиксировать изменения и backup:
   - ./scripts/deploy/pre_deploy_prod_checkpoint.sh
2. Проверить checkpoint tag и backup dir в выводе.

### Если работаем в DEV

1. Вести изменения только в branch dev.
2. Проверять безопасность:
   - ./scripts/deploy/deploy.sh safety
   - _или напрямую:_ ./scripts/deploy/check_deploy_safety.sh
3. Перед deploy в PROD запускать dry-run:
   - ./scripts/deploy/deploy.sh release --dry-run
   - вывод должен содержать блок `Migration Preflight` с полями `pending migration` и `rollback-feasibility`
   - если PROD dirty, release останавливается с `DIRTY PROD BLOCKER` до любых migrate-операций

### Если нужно освежить DEV из PROD

1. Запустить:
   - ./scripts/deploy/deploy.sh prod-to-dev
   - _или напрямую:_ ./scripts/deploy/prod_to_dev_sync.sh
2. Скрипт создаёт backup DEV перед перезаписью и backup PROD перед синком.
3. DEV .env сохраняется и восстанавливается обратно.
4. Код DEV приводится к origin/main и пушится в origin/dev.

## 4. Команды

### deploy.sh — унифицированный точка входа (рекомендован)

Все команды доступны через единый скрипт `./scripts/deploy/deploy.sh <command>`.

```bash
./scripts/deploy/deploy.sh help           # показать справку
./scripts/deploy/deploy.sh safety         # 24+ pre-deploy проверок
./scripts/deploy/deploy.sh release [--dry-run] [--yes] [--no-migrate] [--skip-build]
./scripts/deploy/deploy.sh sync-runtime --type navigation [--dry-run] [--yes]
./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction dev-to-prod [--dry-run] [--yes]
./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction prod-to-dev [--dry-run] [--yes]
./scripts/deploy/deploy.sh prod-to-dev [--dry-run] [--yes] [--skip-db] ...
./scripts/deploy/deploy.sh rollback --tag TAG [--dry-run] [--yes]
./scripts/deploy/deploy.sh backup-prod [--dry-run]
./scripts/deploy/deploy.sh ssl-check
```

Для production release прямые вызовы `dev_to_prod_release.sh` запрещены: используйте только `deploy.sh release`.

### Ensure DEV branch

- ./scripts/deploy/ensure_dev_branch.sh
- dry-run: ./scripts/deploy/ensure_dev_branch.sh --dry-run

### Backup PROD checkpoint

- ./scripts/deploy/pre_deploy_prod_checkpoint.sh
- dry-run: ./scripts/deploy/pre_deploy_prod_checkpoint.sh --dry-run

### Refresh DEV from PROD

- ./scripts/deploy/prod_to_dev_sync.sh
- dry-run: ./scripts/deploy/prod_to_dev_sync.sh --dry-run
- non-interactive checkpoint (если PROD dirty): ./scripts/deploy/prod_to_dev_sync.sh --yes
- без DB restore: ./scripts/deploy/prod_to_dev_sync.sh --skip-db
- без file restore: ./scripts/deploy/prod_to_dev_sync.sh --skip-files
- без build: ./scripts/deploy/prod_to_dev_sync.sh --skip-build
- без migrate: ./scripts/deploy/prod_to_dev_sync.sh --skip-migrate
- не выполнять auto-recover при ошибке: ./scripts/deploy/prod_to_dev_sync.sh --no-auto-recover
- автоматически исправить отсутствующий APP_KEY в DEV: ./scripts/deploy/prod_to_dev_sync.sh --fix-dev-app-key
- legacy wrapper: ./scripts/deploy/refresh_dev_from_prod.sh

### Deploy DEV to PROD (authoritative path)

- запускать только из `/var/www/laravel-react-dev`
- ./scripts/deploy/deploy.sh release
- dry-run: ./scripts/deploy/deploy.sh release --dry-run --yes
- no migrate: ./scripts/deploy/deploy.sh release --no-migrate
- skip build: ./scripts/deploy/deploy.sh release --skip-build
- explicit override for protected-path deletion (only with manual approval): ./scripts/deploy/deploy.sh release --force-protected-delete
- direct `./scripts/deploy/dev_to_prod_release.sh ...` — **prohibited**

### Rollback PROD code to tag

- ./scripts/deploy/rollback_prod_to_tag.sh pre-deploy-YYYYMMDD-HHMMSS --yes
- dry-run: ./scripts/deploy/rollback_prod_to_tag.sh pre-deploy-YYYYMMDD-HHMMSS --dry-run

### Safety check

- ./scripts/deploy/check_deploy_safety.sh

### Navigation Media/Data Sync (targeted)

- ./scripts/deploy/deploy.sh sync-runtime --type navigation
- dry-run: ./scripts/deploy/deploy.sh sync-runtime --type navigation --dry-run
- non-interactive: ./scripts/deploy/deploy.sh sync-runtime --type navigation --yes
- _или напрямую:_ ./scripts/deploy/sync_navigation_media_to_prod.sh

Purpose:

- DEV->PROD release deploys code only.
- It must not copy DEV database into PROD.
- If navigation routes require map media/polylines, sync only navigation_routes.map_image_path, navigation_routes.map_polyline, and storage/app/public/nav/*.

Safety rules for this procedure:

- Always backup PROD navigation_routes before update.
- Never run full PROD<-DEV DB import for this scenario.
- Never run prod_to_dev_sync for fixing PROD navigation media.
- Only targeted update/copy of navigation fields and nav media is allowed.

### Runtime Public Assets Sync (targeted, bidirectional)

- required files are defined in `scripts/deploy/runtime_public_assets_manifest.txt`
- DEV -> PROD:
  - `./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction dev-to-prod --dry-run`
  - `./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction dev-to-prod --yes`
- PROD -> DEV:
  - `./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction prod-to-dev --dry-run`
  - `./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction prod-to-dev --yes`

Safety behavior:

- `check_deploy_safety.sh` now validates that required runtime assets exist in both envs.
- Missing file in PROD/DEV is a FAIL.
- Hash mismatch is a WARN with explicit sync command recommendation.

## 9. Post-Incident Hardening Toolkit

Новые/обновленные скрипты:

- /var/www/laravel-react/scripts/deploy/deploy.sh _(NEW — унифицированный точка входа)_
- /var/www/laravel-react/scripts/deploy/lib_deploy_common.sh _(+check_node_version)_
- /var/www/laravel-react/scripts/deploy/check_deploy_safety.sh _(+Node warn, +backup validity)_
- /var/www/laravel-react/scripts/deploy/prod_to_dev_sync.sh
- /var/www/laravel-react/scripts/deploy/dev_to_prod_release.sh
- /var/www/laravel-react/scripts/deploy/sync_public_assets.sh _(NEW — runtime public assets sync DEV↔PROD)_
- /var/www/laravel-react/scripts/deploy/runtime_public_assets_manifest.txt _(NEW — required runtime assets list)_
- /var/www/laravel-react/scripts/backup_prod.sh _(BACKUP_KEEP_COUNT=1, .incomplete pattern)_

### Backup retention policy (hardened)

- **BACKUP_KEEP_COUNT=1** по умолчанию (было 2). Хранится только 1 завершённый full_snapshot.
- **`.incomplete` паттерн**: backup пишется в `prod_backup_TIMESTAMP_full_snapshot.incomplete`
  и переименовывается в финальный путь только после успешной валидации gzip/tar.
- `.incomplete` каталоги старше 24 часов удаляются при следующем запуске cleanup.
- Runtime backups (`nav_fix_*`, `nginx_ssl_fix_*`) хранятся по **RUNTIME_BACKUP_KEEP_COUNT=3**.
- `cleanup_only_*` каталоги (артефакты CLEANUP_ONLY-режима) удаляются полностью при cleanup.
- `pre_seeder_backup_*`, `db_backup_*`, `laravel_react_*`, loose `*.sql.gz`/`*.tar.gz` — keep 1 each.

Что теперь обязательно проверяется автоматически:

- protected deletions (scripts/deploy/config/docs/package manifests)
- dangerous migration patterns в up()
- APP_KEY + .env readability через www-data association
- storage/bootstrap writeability
- HTTP anti-500 checks для PROD/DEV endpoints
- ssl_guard_check.sh pass
- forbidden deploy commands (seed/reset/fresh/wipe/test) в deploy-скриптах

Минимальный safe validation после изменения toolkit:

- chmod +x scripts/deploy/*.sh
- bash -n scripts/deploy/*.sh
- ./scripts/deploy/check_deploy_safety.sh || true
- ./scripts/deploy/prod_to_dev_sync.sh --dry-run || true
- ./scripts/deploy/dev_to_prod_release.sh --dry-run || true
- ./scripts/deploy/ssl_guard_check.sh || true

## 10. Navigation media/data after DEV->PROD release

Incident lesson:

- Code release and runtime navigation data are separate concerns.
- Missing map_image_path/map_polyline or missing files in storage/app/public/nav can break route preview on PROD even when frontend build is correct.

Safe remediation flow:

1. Compare DEV/PROD navigation_routes for target rooms.
2. Backup PROD navigation_routes.
3. Update only map_image_path + map_polyline in PROD from DEV.
4. Copy only storage/app/public/nav from DEV to PROD.
5. Clear caches and validate HTTPS image URLs return 200.

Do not do:

- Full DEV DB import to PROD.
- Full sync scripts for this case.

## 5. Что делать при ошибке deploy

1. Остановить дальнейшие изменения.
2. Посмотреть deploy report в storage/app/deploy_reports.
3. Выполнить rollback к pre-deploy tag:
   - ./scripts/deploy/rollback_prod_to_tag.sh <tag> --yes
4. Проверить приложение:
   - php artisan about
   - tail -n 200 storage/logs/laravel.log

## 6. Что делать при ошибке данных

1. Не выполнять автоматический db rollback без анализа.
2. Использовать backup из /var/www/laravel-react/backups.
3. Восстановление данных проводить вручную из database_*.sql.gz в безопасном окне.
4. Зафиксировать инцидент и причину в отдельном отчёте.
5. rollback_prod_to_tag.sh откатывает только код, не откатывает базу автоматически.

## 7. Что нельзя делать никогда

- Копировать DEV DB в PROD.
- Запускать migrate:fresh, db:wipe в PROD.
- Делать git clean -fd на PROD.
- Коммитить .env и backup-артефакты в git.
- Пропускать pre-deploy backup/checkpoint перед deploy.

## 8. Антиповтор SSL-инцидента (обязательно)

Проблема, которая уже была: сертификат в файле правильный, но runtime nginx отдаёт старый сертификат из памяти.

### Быстрая ручная проверка

- Проверить сертификат в файле:
   - openssl x509 -in /var/www/laravel-react/ssl/fullchain.pem -noout -subject -issuer -fingerprint -sha256
- Проверить live сертификат:
   - echo | openssl s_client -connect crm.kaztbu.edu.kz:443 -servername crm.kaztbu.edu.kz 2>/dev/null | openssl x509 -noout -subject -issuer -fingerprint -sha256
   - echo | openssl s_client -connect dev-crm.kaztbu.edu.kz:443 -servername dev-crm.kaztbu.edu.kz 2>/dev/null | openssl x509 -noout -subject -issuer -fingerprint -sha256

Если fingerprint не совпадает, выполнить:

- sudo systemctl reload nginx

### Автоматическая защита

Добавлены скрипты:

- /var/www/laravel-react/scripts/deploy/ssl_guard_check.sh
- /var/www/laravel-react/scripts/deploy/ssl_guard_install.sh

Что делает ssl_guard_check.sh:

- проверяет соответствие cert/key
- проверяет срок действия сертификата
- сравнивает fingerprint файла и live endpoint (local/public) для crm/dev
- при флаге --reload-on-mismatch делает systemctl reload nginx и повторно проверяет

Установка периодической проверки (каждые 10 минут):

- sudo /var/www/laravel-react/scripts/deploy/ssl_guard_install.sh

После установки:

- systemctl status ssl-guard.timer
- journalctl -u ssl-guard.service -n 100 --no-pager

### Регламент после замены сертификатов

1. Заменить /var/www/laravel-react/ssl/fullchain.pem и /var/www/laravel-react/ssl/private.key
2. Выполнить:
    - sudo systemctl reload nginx
3. Проверить:
    - curl -I https://crm.kaztbu.edu.kz/
    - curl -I https://dev-crm.kaztbu.edu.kz/
4. Если не совпадает fingerprint/live — запустить ssl_guard_check.sh и исправить до green-состояния.
