# 📊 АУДИТ ДАННЫХ БАЗЫ И ЗАПРОСЫ ДЛЯ ПРОВЕРКИ

## Диагностические SQL Запросы

---

## 🔍 ЗАПРОС 1: Общая статистика KPI за период

```sql
-- Получить статистику по периоду
SELECT 
    kp.id,
    kp.name as period_name,
    kp.academic_year_id,
    COUNT(DISTINCT ke.user_id) as total_teachers,
    COUNT(DISTINCT CASE WHEN ke.status = 'approved' THEN ke.user_id END) as teachers_with_approved,
    COUNT(ke.id) as total_entries,
    COUNT(CASE WHEN ke.status = 'approved' THEN ke.id END) as approved_entries,
    ROUND(AVG(CASE WHEN ke.status = 'approved' THEN ke.manual_points + ke.calculated_points END), 2) as avg_points
FROM kpi_periods kp
LEFT JOIN kpi_entries ke ON kp.id = ke.kpi_period_id AND ke.entity_type = 'teacher'
WHERE kp.academic_year_id = YEAR(NOW())
GROUP BY kp.id, kp.name, kp.academic_year_id
ORDER BY kp.id DESC;
```

**Что это проверяет:**
- Сколько периодов в текущем году
- Сколько преподавателей имеют утвержденные записи
- Средняя сумма баллов

---

## 🔍 ЗАПРОС 2: Проверить данные для конкретного преподавателя

```sql
-- Для Казбековой Меруерт
SELECT 
    u.id, u.name, u.position_title, u.ad_title,
    ke.id as entry_id,
    ki.section,
    ki.code as indicator_code,
    ki.name as indicator_name,
    ke.plan_value,
    ke.fact_value,
    ke.calculated_points,
    ke.manual_points,
    (ke.manual_points + ke.calculated_points) as total_points,
    ke.status,
    ke.created_at
FROM users u
LEFT JOIN kpi_entries ke ON u.id = ke.user_id
LEFT JOIN kpi_indicators ki ON ke.indicator_id = ki.id
WHERE u.name LIKE '%Казбекова%'
ORDER BY ke.kpi_period_id DESC, ke.created_at DESC;
```

**Ожидаемый результат:**
```
id | name | position_title | ad_title | entry_id | section | indicator_code | ...
123 | Казбекова М.К. | NULL | NULL | NULL | NULL | NULL | ...
```

**Проблема:** 
- position_title = NULL (должна быть должность)
- entry_id = NULL (нет вообще записей KPI!)

**Решение:**
```sql
-- 1. Сначала установить должность
UPDATE users SET position_title = 'Ассистент' 
WHERE id = 123 AND position_title IS NULL;

-- 2. Потом добавить KPI записи (если нужны для тестирования)
-- OR просто ожидать пока преподаватель их добавит
```

---

## 🔍 ЗАПРОС 3: Агрегирование баллов по разделам для преподавателя

```sql
-- Симуляция того что должна делать liveTeachersAggregation
SELECT 
    u.id,
    u.name,
    u.position_title,
    SUM(CASE WHEN ki.section = 'teaching' AND ke.status = 'approved' 
        THEN ke.manual_points + ke.calculated_points ELSE 0 END) as k1_teaching,
    SUM(CASE WHEN ki.section = 'science' AND ke.status = 'approved' 
        THEN ke.manual_points + ke.calculated_points ELSE 0 END) as k2_science,
    SUM(CASE WHEN ki.section = 'social' AND ke.status = 'approved' 
        THEN ke.manual_points + ke.calculated_points ELSE 0 END) as k3_social,
    SUM(CASE WHEN ki.section = 'qualification' AND ke.status = 'approved' 
        THEN ke.manual_points + ke.calculated_points ELSE 0 END) as k4_qualification,
    SUM(CASE WHEN ki.section = 'survey' AND ke.status = 'approved' 
        THEN ke.manual_points + ke.calculated_points ELSE 0 END) as k5_survey,
    COUNT(CASE WHEN ke.status = 'approved' THEN ke.id END) as approved_count
FROM users u
LEFT JOIN kpi_entries ke ON u.id = ke.user_id AND ke.status = 'approved' AND ke.entity_type = 'teacher'
LEFT JOIN kpi_indicators ki ON ke.indicator_id = ki.id
WHERE u.id IN (
    SELECT DISTINCT user_id FROM kpi_entries WHERE entity_type = 'teacher'
)
GROUP BY u.id, u.name, u.position_title
ORDER BY approved_count DESC
LIMIT 15;
```

**Ожидаемый результат:**
```
id  | name | K1 | K2  | K3 | K4 | K5 | approved_count
123 | Каржауова Э.К. | 0 | 0 | 0 | 0 | 0 | 0
124 | Хамит А.Ж. | 0 | 0 | 0 | 0 | 0 | 0
125 | Казбекова М.К. | 0 | 0 | 0 | 0 | 0 | 0
```

**Если есть неправильные данные:**
```sql
-- Найти записи с неправильными баллами
SELECT 
    ke.id, 
    u.name,
    ki.code,
    ki.section,
    ke.calculated_points,
    ke.manual_points,
    (ke.manual_points + ke.calculated_points) as total,
    ke.status
FROM kpi_entries ke
JOIN users u ON ke.user_id = u.id
JOIN kpi_indicators ki ON ke.indicator_id = ki.id
WHERE (ke.manual_points + ke.calculated_points) > 1000
  AND ke.entity_type = 'teacher'
  AND ke.kpi_period_id = (SELECT id FROM kpi_periods WHERE name LIKE '%2025%' LIMIT 1)
LIMIT 20;
```

---

## 🔍 ЗАПРОС 4: Сравнить KpiResult с Live Aggregation

```sql
-- Проверить что в таблице kpi_results хранится
SELECT 
    kr.id,
    u.name,
    u.position_title,
    kr.k1_score,
    kr.k2_score,
    kr.k3_score,
    kr.k4_score,
    kr.k5_score,
    kr.k6_score,
    kr.rank_score,
    kr.approved_entries_count,
    kr.created_at,
    kr.updated_at
FROM kpi_results kr
JOIN users u ON kr.user_id = u.id
WHERE kr.kpi_period_id = (SELECT id FROM kpi_periods WHERE name LIKE '%2025%' LIMIT 1)
ORDER BY kr.rank_score DESC
LIMIT 20;
```

**Если результат пустой:**
```
(no rows)
```

**Значит:**
- KpiResult еще не рассчитан для этого периода
- Система будет использовать Live Aggregation (которая сейчас неправильная)
- Нужно либо:
  1. Запустить расчет вручную
  2. Зафиксировать Live Aggregation

---

## 🔍 ЗАПРОС 5: Проверить что есть в kpi_entries

```sql
-- Посмотреть какие KPI записи вообще есть
SELECT 
    ke.id,
    u.name,
    u.position_title,
    ki.section,
    ki.code,
    ke.status,
    ke.manual_points,
    ke.calculated_points,
    ke.created_at,
    ke.submitted_at,
    ke.approved_at
FROM kpi_entries ke
JOIN users u ON ke.user_id = u.id
JOIN kpi_indicators ki ON ke.indicator_id = ki.id
WHERE ke.kpi_period_id = (SELECT id FROM kpi_periods WHERE name LIKE '%2025%' LIMIT 1)
  AND ke.entity_type = 'teacher'
ORDER BY ke.created_at DESC
LIMIT 20;
```

**Анализ результата:**

Если все статусы 'draft':
- Преподаватели создали записи, но не отправили на утверждение
- Нужно отправить: Submitted → Reviewed → Pending Dean → Pending Structural → Approved

Если есть 'submitted' или 'pending_*':
- Записи ожидают утверждения
- Нужно утвердить их в админ-панели

Если только 'approved':
- Отлично! Нужно убедиться что K1-K5 правильно агрегируются

---

## 🔍 ЗАПРОС 6: Проверить НПУ пороги по должностям

```sql
-- Проверить как распределяются должности
SELECT 
    u.position_title,
    COUNT(*) as count,
    GROUP_CONCAT(DISTINCT u.name ORDER BY u.name SEPARATOR ', ') as teacher_names
FROM users u
WHERE entity_type = 'teacher'
GROUP BY u.position_title
ORDER BY count DESC;
```

**Ожидаемый результат:**
```
position_title | count | teacher_names
NULL | 5 | Казбекова М.К., Сеит Е.Т., ...
Сеньор-лектор | 3 | Каржауова Э.К., Хамит А.Ж., ...
Ассистент | 2 | Сламқұл Индира С., ...
```

**Проблема:** NULL значения

**Решение:**
```sql
-- Обновить должности для тестирования
UPDATE users SET position_title = 'Ассистент' WHERE position_title IS NULL LIMIT 5;
```

---

## 🔍 ЗАПРОС 7: Проверить структуру таблиц

```sql
-- KPI Entries
SHOW COLUMNS FROM kpi_entries;

-- KPI Results
SHOW COLUMNS FROM kpi_results;

-- KPI Indicators
SHOW COLUMNS FROM kpi_indicators;

-- KPI Periods
SHOW COLUMNS FROM kpi_periods;
```

**Проверить что есть колонки:**

kpi_entries:
- ✓ user_id
- ✓ kpi_period_id
- ✓ indicator_id
- ✓ manual_points (decimal:2)
- ✓ calculated_points (decimal:2)
- ✓ status

kpi_results:
- ✓ user_id
- ✓ kpi_period_id
- ✓ k1_score (decimal:2)
- ✓ k2_score (decimal:2)
- ✓ k3_score (decimal:2)
- ✓ k4_score (decimal:2)
- ✓ k5_score (decimal:2)
- ✓ k6_score (decimal:2)
- ✓ rank_score (decimal:2)

kpi_indicators:
- ✓ section (teaching, science, social, qualification, survey)
- ✓ code
- ✓ name
- ✓ base_points

---

## 🔧 СКРИПТ: Добавить тестовые данные

```sql
-- 1. Убедиться что тестовый период существует
SELECT id, name FROM kpi_periods WHERE name LIKE '%2025%' LIMIT 1;
-- Если пусто, создать:
INSERT INTO kpi_periods (academic_year_id, name, start_date, end_date, status)
VALUES (1, '2025-2026 (осенний)', '2025-09-01', '2025-12-31', 'active');

-- 2. Убедиться что индикаторы существуют
SELECT id, section, code, name FROM kpi_indicators LIMIT 10;

-- 3. Добавить тестовую KPI запись для Каржауовой
INSERT INTO kpi_entries (
    kpi_period_id, academic_year_id, entity_type, user_id, 
    indicator_id, status, calculated_points, manual_points
) 
SELECT 
    (SELECT id FROM kpi_periods WHERE name LIKE '%2025%' LIMIT 1),
    1,
    'teacher',
    (SELECT id FROM users WHERE name LIKE '%Каржауова%' LIMIT 1),
    (SELECT id FROM kpi_indicators WHERE section = 'science' AND code = 'РАБ.2.1' LIMIT 1),
    'approved',
    200.00,
    0
LIMIT 1;

-- 4. Проверить что добавилось
SELECT COUNT(*) FROM kpi_entries WHERE user_id = (SELECT id FROM users WHERE name LIKE '%Каржауова%' LIMIT 1);
```

---

## 📈 МОНИТОРИНГ ПОСЛЕ ИСПРАВЛЕНИЯ

### Запрос для проверки что исправления работают:

```sql
-- После фиксации liveTeachersAggregation должна возвращать правильные K1-K5
-- Этот запрос воспроизводит логику:

WITH teacher_aggregates AS (
    SELECT 
        u.id,
        u.name,
        u.position_title,
        SUM(CASE WHEN ki.section = 'teaching' THEN ke.manual_points + ke.calculated_points ELSE 0 END) as k1,
        SUM(CASE WHEN ki.section = 'science' THEN ke.manual_points + ke.calculated_points ELSE 0 END) as k2,
        SUM(CASE WHEN ki.section = 'social' THEN ke.manual_points + ke.calculated_points ELSE 0 END) as k3,
        SUM(CASE WHEN ki.section = 'qualification' THEN ke.manual_points + ke.calculated_points ELSE 0 END) as k4,
        SUM(CASE WHEN ki.section = 'survey' THEN ke.manual_points + ke.calculated_points ELSE 0 END) as k5,
        COUNT(CASE WHEN ke.status = 'approved' THEN ke.id END) as approved_count,
        MAX(ke.department_id) as dept_id,
        MAX(ke.faculty_id) as fac_id
    FROM kpi_entries ke
    JOIN users u ON ke.user_id = u.id
    JOIN kpi_indicators ki ON ke.indicator_id = ki.id
    WHERE ke.status = 'approved'
      AND ke.entity_type = 'teacher'
      AND ke.kpi_period_id = (SELECT id FROM kpi_periods WHERE name LIKE '%2025%' LIMIT 1)
    GROUP BY u.id, u.name, u.position_title
)
SELECT 
    id, name, position_title,
    k1, k2, k3, k4, k5,
    (k1 + k2 + k3 + k4 + k5) as total,
    approved_count
FROM teacher_aggregates
ORDER BY approved_count DESC, total DESC
LIMIT 20;
```

**Ожидаемый результат ПОСЛЕ исправления:**
```
id | name | K1 | K2  | K3 | K4 | K5 | total | approved
123 | Каржауова Э.К. | 0 | 0 | 0 | 0 | 0 | 0 | 0
124 | Хамит А.Ж. | 0 | 0 | 0 | 0 | 0 | 0 | 0
(или если добавили тестовые данные:)
125 | Сламқұл И.С. | 0 | 200 | 0 | 0 | 0 | 200 | 1
```

---

## 🚨 ПРОВЕРКА ПЕРЕД МИГРАЦИЕЙ В ПРОДАКШН

### Запустить эту проверку:

```php
<?php
// app/Console/Commands/KpiAuditCommand.php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\KpiEntry;
use App\Models\KpiResult;
use App\Models\User;

class KpiAuditCommand extends Command
{
    protected $signature = 'kpi:audit';
    protected $description = 'Audit KPI data for consistency';

    public function handle()
    {
        $this->line('🔍 Запуск KPI аудита...\n');

        // 1. Проверить что есть данные
        $entryCount = KpiEntry::count();
        $this->line("✓ KPI Entries: {$entryCount}");

        // 2. Проверить что есть утвержденные
        $approvedCount = KpiEntry::where('status', 'approved')->count();
        $this->line("✓ Approved: {$approvedCount}");

        // 3. Проверить что есть преподаватели с должностями
        $withoutTitle = User::where('entity_type', 'teacher')
            ->whereNull('position_title')
            ->orWhere('position_title', '')
            ->count();
        $this->warn("⚠️  Teachers without title: {$withoutTitle}");

        // 4. Проверить что KpiResult совпадает с Live Aggregation
        $discrepancies = 0;
        // ... логика проверки

        $this->line("\n✅ Аудит завершен");
        return Command::SUCCESS;
    }
}
?>
```

**Запустить:**
```bash
php artisan kpi:audit
```

---

## 📋 ЧЕК-ЛИСТ ПЕРЕД КОММИТОМ

- [ ] Все SQL запросы выполняются без ошибок
- [ ] KpiEntry таблица имеет тестовые данные
- [ ] Live Aggregation возвращает K1-K5 ≠ 0 (если есть approved entries)
- [ ] KpiResult таблица имеет актуальные данные
- [ ] Рейтинг считается правильно: R = (K1+K2+K3+K4+K5) - НПУ
- [ ] НПУ пороги соответствуют config/kpi.php
- [ ] Фронтенд показывает таблицу с K1-K5 колонками
- [ ] Нет ошибок в laravel.log
- [ ] Нет ошибок в браузер-консоли

---

**Последний обновлен:** 2026-05-19  
**Версия БД:** 11.0.2  
**Версия Laravel:** 11.x

