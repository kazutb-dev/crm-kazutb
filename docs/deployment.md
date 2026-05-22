# Deployment Toolkit (PROD + DEV)

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
- Никаких push в удаленный branch до успешного завершения всех post-check.
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
   - ./scripts/deploy/check_deploy_safety.sh
3. Перед deploy в PROD запускать dry-run:
   - ./scripts/deploy/dev_to_prod_release.sh --dry-run

### Если нужно освежить DEV из PROD

1. Запустить:
   - ./scripts/deploy/prod_to_dev_sync.sh
2. Скрипт создаёт backup DEV перед перезаписью и backup PROD перед синком.
3. DEV .env сохраняется и восстанавливается обратно.
4. Код DEV приводится к origin/main и пушится в origin/dev.

## 4. Команды

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

### Deploy DEV to PROD

- ./scripts/deploy/dev_to_prod_release.sh
- dry-run: ./scripts/deploy/dev_to_prod_release.sh --dry-run
- non-interactive yes: ./scripts/deploy/dev_to_prod_release.sh --yes
- no migrate: ./scripts/deploy/dev_to_prod_release.sh --no-migrate
- skip build: ./scripts/deploy/dev_to_prod_release.sh --skip-build
- explicit override for protected-path deletion (only with manual approval): ./scripts/deploy/dev_to_prod_release.sh --force-protected-delete
- legacy wrapper: ./scripts/deploy/deploy_dev_to_prod.sh

### Rollback PROD code to tag

- ./scripts/deploy/rollback_prod_to_tag.sh pre-deploy-YYYYMMDD-HHMMSS --yes
- dry-run: ./scripts/deploy/rollback_prod_to_tag.sh pre-deploy-YYYYMMDD-HHMMSS --dry-run

### Safety check

- ./scripts/deploy/check_deploy_safety.sh

## 9. Post-Incident Hardening Toolkit

Новые/обновленные скрипты:

- /var/www/laravel-react/scripts/deploy/lib_deploy_common.sh
- /var/www/laravel-react/scripts/deploy/check_deploy_safety.sh
- /var/www/laravel-react/scripts/deploy/prod_to_dev_sync.sh
- /var/www/laravel-react/scripts/deploy/dev_to_prod_release.sh

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
