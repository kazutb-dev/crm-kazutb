# Deployment Toolkit (PROD + DEV)

## 1. Архитектура окружений

- PROD: /var/www/laravel-react
- DEV: /var/www/laravel-react-dev
- GitHub: https://github.com/kazutb-dev/crm-kazutb.git
- PROD DB = source of truth для реальных данных пользователей.
- DEV обновляется из PROD для актуальной разработки и проверки.

## 2. Основные правила

- DEV database никогда не копируется поверх PROD database.
- Перед любым deploy в PROD обязательно:
  - backup PROD
  - git checkpoint/tag
- Seeders для PROD только idempotent:
  - updateOrCreate
  - firstOrCreate
  - upsert
- Нельзя делать destructive операции без backup и явного подтверждения.
- Нельзя коммитить .env, backups, sql/tar dumps, vendor, node_modules, skills.

## 3. Ежедневная работа

### Если правили PROD напрямую

1. Зафиксировать изменения и backup:
   - ./scripts/deploy/pre_deploy_prod_checkpoint.sh
2. Проверить checkpoint tag и backup dir в выводе.

### Если работаем в DEV

1. Вести изменения через git (main/dev).
2. Проверять безопасность:
   - ./scripts/deploy/check_deploy_safety.sh
3. Перед deploy в PROD запускать dry-run:
   - ./scripts/deploy/deploy_dev_to_prod.sh --dry-run

### Если нужно освежить DEV из PROD

1. Запустить:
   - ./scripts/deploy/refresh_dev_from_prod.sh
2. Скрипт создаёт backup DEV перед перезаписью.
3. DEV .env сохраняется и восстанавливается обратно.

## 4. Команды

### Backup PROD checkpoint

- ./scripts/deploy/pre_deploy_prod_checkpoint.sh
- dry-run: ./scripts/deploy/pre_deploy_prod_checkpoint.sh --dry-run

### Refresh DEV from PROD

- ./scripts/deploy/refresh_dev_from_prod.sh
- dry-run: ./scripts/deploy/refresh_dev_from_prod.sh --dry-run

### Deploy DEV to PROD

- ./scripts/deploy/deploy_dev_to_prod.sh
- dry-run: ./scripts/deploy/deploy_dev_to_prod.sh --dry-run
- no migrate: ./scripts/deploy/deploy_dev_to_prod.sh --no-migrate
- skip build: ./scripts/deploy/deploy_dev_to_prod.sh --skip-build

### Rollback PROD code to tag

- ./scripts/deploy/rollback_prod_to_tag.sh pre-deploy-YYYYMMDD-HHMMSS --yes
- dry-run: ./scripts/deploy/rollback_prod_to_tag.sh pre-deploy-YYYYMMDD-HHMMSS --dry-run

### Safety check

- ./scripts/deploy/check_deploy_safety.sh

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

## 7. Что нельзя делать никогда

- Копировать DEV DB в PROD.
- Запускать migrate:fresh, db:wipe в PROD.
- Делать git clean -fd на PROD.
- Коммитить .env и backup-артефакты в git.
- Пропускать pre-deploy backup/checkpoint перед deploy.
