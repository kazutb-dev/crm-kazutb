# KazUTB CRM Deployment Runbook

## 1. Golden rules

- Все release/backup/runtime sync операции выполняются только через единый CLI: `./scripts/deploy/deploy.sh`.
- Запрещено запускать destructive DB команды в production workflow:
  - `migrate:fresh`, `migrate:refresh`, `migrate:reset`, `migrate:rollback`
  - `db:wipe`, `db:seed`, `migrate --seed`
- Никаких real release / real prod-to-dev без отдельного явного подтверждения оператора.
- Dry-run режим обязан быть non-mutating.
- Никогда не коммитить `.env`, `backups/`, SQL/TAR dumps, `vendor/`, `node_modules/`, `storage/`, `public/build/`, `skills/`.
- Если обнаружен dirty state в PROD/DEV перед критической операцией, сначала разбор и подтверждение.

## 2. Environments

- PROD:
  - path: `/var/www/laravel-react`
  - branch: `main`
  - URL: `https://crm.kaztbu.edu.kz`
  - DB: `laravel_react`
- DEV:
  - path: `/var/www/laravel-react-dev`
  - branch: `dev`
  - URL: `https://dev-crm.kaztbu.edu.kz`
  - DB: `laravel_react_dev`

## 3. Main CLI: deploy.sh

Единая точка входа:

```bash
./scripts/deploy/deploy.sh help
./scripts/deploy/deploy.sh safety
./scripts/deploy/deploy.sh release --dry-run
./scripts/deploy/deploy.sh release
./scripts/deploy/deploy.sh sync-runtime --type navigation --dry-run
./scripts/deploy/deploy.sh sync-runtime --type navigation
./scripts/deploy/deploy.sh backup-prod --dry-run
./scripts/deploy/deploy.sh backup-prod
./scripts/deploy/deploy.sh prod-to-dev --dry-run
./scripts/deploy/deploy.sh prod-to-dev
./scripts/deploy/deploy.sh rollback --tag TAG --dry-run
./scripts/deploy/deploy.sh rollback --tag TAG
./scripts/deploy/deploy.sh ssl-check
```

Поведение CLI:

- unknown command -> non-zero exit + help hint
- `sync-runtime` без `--type` -> non-zero + список поддерживаемых/планируемых типов
- `rollback` без `--tag` -> non-zero + подсказка по тегам

## 4. Daily DEV work

Базовый цикл:

1. Работаем в DEV (`dev` branch).
2. Перед подготовкой релиза:
   - `./scripts/deploy/deploy.sh safety`
   - `./scripts/deploy/deploy.sh release --dry-run`
3. Если нужен runtime sync навигации:
   - `./scripts/deploy/deploy.sh sync-runtime --type navigation --dry-run`

## 5. DEV -> PROD release

Рекомендуемый поток:

1. `./scripts/deploy/deploy.sh safety`
2. `./scripts/deploy/deploy.sh release --dry-run`
3. `./scripts/deploy/deploy.sh release`

Гарантии release flow:

- `release --dry-run` не выполняет backup/tag/merge/build/migrate/push
- реальный release требует clean PROD working tree
- перед merge выполняется pre-deploy checkpoint (backup + tag)
- push `origin main` выполняется только после успешного build/migrate/health
- при ошибке до push локальный `main` откатывается на старый HEAD
- при ошибке после push auto rollback не делается, печатается ручная rollback команда

## 6. Runtime data sync: navigation media/data

Команда:

```bash
./scripts/deploy/deploy.sh sync-runtime --type navigation
```

Логика:

- проверка дубликатов `room,title` в DEV и PROD (`COUNT(*) > 1` -> stop)
- сравнение только `map_image_path` и `map_polyline`
- если diff нет:
  - `No navigation map differences found.`
  - `Nothing to sync.`
  - exit 0
- если diff есть:
  - печать таблицы diff
  - печать количества строк
  - предпросмотр файлов `storage/app/public/nav`, которые будут копироваться
  - подтверждение `YES` для real run
  - backup `navigation_routes` в `backups/nav_fix_*`
  - update только `map_image_path`, `map_polyline`
  - rsync только nav-папки
  - `storage:link || true`, права, `optimize:clear`
  - verify HTTPS 200 для map image paths

## 7. PROD hotfix workflow

Если был ручной hotfix на PROD:

1. Зафиксировать checkpoint/backup.
2. Привести изменения в Git (`main`) без force push.
3. Синхронизировать изменения обратно в `dev` через нормальный merge flow.

## 8. PROD -> DEV sync (rare emergency workflow)

Команда:

```bash
./scripts/deploy/deploy.sh prod-to-dev
```

Важно:

- использовать редко, не как обычный deploy путь
- `--dry-run` строго non-mutating
- real run делает checkpoint branch/tag в DEV до изменений
- DEV `.env` сохраняется и восстанавливается
- перед overwrite делается backup DEV DB/files/.env
- `origin/dev` push только после успешного завершения
- при ошибке локальный auto-recover к checkpoint (если не задан `--no-auto-recover`)

## 9. Backup policy

Политика для `backup-prod`:

- backup создаётся сначала в `.incomplete`:
  - `backups/prod_backup_YYYYMMDD_HHMMSS_full_snapshot.incomplete`
- валидации до finalize:
  - `gzip -t database_*.sql.gz`
  - `tar -tzf project_data_*.tar.gz`
  - наличие `env_*.backup`, `manifest_*.txt`, `SHA256SUMS`
- только после успешной валидации:
  - rename `.incomplete` -> final
  - cleanup old completed snapshots
- retention:
  - keep latest `1` completed full snapshot (default)
- stale `.incomplete`:
  - cleanup для backup старше 24 часов
- runtime backups:
  - keep latest `3` per prefix (`nav_fix_*`, `nginx_ssl_fix_*`)
  - cleanup best-effort
  - Permission denied не валит backup/release
- root-owned runtime backups:
  - печатается warning + manual cleanup recommendation
  - автоматический `sudo rm -rf` не выполняется

## 10. Rollback

Code rollback:

```bash
./scripts/deploy/deploy.sh rollback --tag TAG --dry-run
./scripts/deploy/deploy.sh rollback --tag TAG
```

Примечания:

- rollback в этом workflow касается кода
- DB restore вручную и только после отдельной оценки риска
- автоматический DB rollback не выполняется

## 11. Troubleshooting

### DEV dirty

- Проверить `git status --short`.
- Зафиксировать/отложить локальные изменения до deploy операций.

### Node v18 warning

- Safety может дать WARN для Node `< 20.19`.
- Это warning, не hard fail.

### Backup permission denied

- Обычно связано с root-owned runtime backup dirs (например, `nginx_ssl_fix_*`).
- Новое поведение: warning + continue (best-effort cleanup).

### Navigation image missing

- Запустить `sync-runtime --type navigation --dry-run`.
- Проверить diff map fields и rsync preview.
- После real sync проверить HTTP 200 для map images.

### MissingAppKeyException / .env permissions

- Убедиться, что `APP_KEY` существует в `.env`.
- Проверить owner/group/perms и доступность для `www-data`.

## 12. Standard command cheat sheet

```bash
# Safety baseline
./scripts/deploy/deploy.sh safety

# Release planning
./scripts/deploy/deploy.sh release --dry-run

# Real release (only after explicit approval)
./scripts/deploy/deploy.sh release

# Navigation runtime sync
./scripts/deploy/deploy.sh sync-runtime --type navigation --dry-run
./scripts/deploy/deploy.sh sync-runtime --type navigation

# PROD backup
./scripts/deploy/deploy.sh backup-prod --dry-run
./scripts/deploy/deploy.sh backup-prod

# Emergency DEV refresh from PROD
./scripts/deploy/deploy.sh prod-to-dev --dry-run
./scripts/deploy/deploy.sh prod-to-dev

# Rollback
./scripts/deploy/deploy.sh rollback --tag TAG --dry-run
./scripts/deploy/deploy.sh rollback --tag TAG

# SSL guard check
./scripts/deploy/deploy.sh ssl-check
```
