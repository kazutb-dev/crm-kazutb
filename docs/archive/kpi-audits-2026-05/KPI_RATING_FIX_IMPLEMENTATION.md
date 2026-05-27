# 🔧 ПОШАГОВОЕ ИСПРАВЛЕНИЕ СИСТЕМЫ РЕЙТИНГА КПИ ППС

## Инструкция по внедрению исправлений

---

## 📝 ШАГ 1: Исправить Live Aggregation для Возврата Правильных K1-K5

**Файл:** `/app/Http/Controllers/KpiSummaryController.php`  
**Метод:** `liveTeachersAggregation()` (начиная с строки ~1220)  
**Время:** 30 мин

### Текущий КОД (неправильный):

```php
private function liveTeachersAggregation(
    ?KpiPeriod $period = null,
    ?int $deptId = null,
    ?int $facultyId = null,
    ?int $excludeUserId = null,
    ?string $statusFilter = null,
    int $limit = 50
): array {
    $rows = KpiEntry::query()
        ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
        ->when($deptId, fn ($q) => $q->where('department_id', $deptId))
        ->when($facultyId, fn ($q) => $q->where('faculty_id', $facultyId))
        ->when($excludeUserId, fn ($q) => $q->where('user_id', '!=', $excludeUserId))
        ->when($statusFilter, fn ($q) => $q->where('status', $statusFilter))
        ->when(! $statusFilter, fn ($q) => $q->whereNotIn('status', [KpiEntry::STATUS_DRAFT]))
        ->where('entity_type', KpiEntry::ENTITY_TYPE_TEACHER)
        ->selectRaw('user_id, MAX(department_id) as department_id, MAX(faculty_id) as faculty_id, COUNT(*) as total_entries, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved, COALESCE(SUM(manual_points), 0) + COALESCE(SUM(calculated_points), 0) as total_points', [KpiEntry::STATUS_APPROVED])
        ->groupBy('user_id')
        ->orderByDesc('approved')
        ->limit($limit)
        ->get();

    if ($rows->isEmpty()) {
        return [];
    }

    $userIds = $rows->pluck('user_id')->filter()->values();
    $users = User::query()
        ->whereIn('id', $userIds)
        ->get(['id', 'display_name', 'name', 'position_title', 'ad_title'])
        ->keyBy('id');

    $deptIds = $rows->pluck('department_id')->filter()->unique()->values();
    $deptNames = Department::query()->whereIn('id', $deptIds)->pluck('name', 'id');

    $facultyIds = $rows->pluck('faculty_id')->filter()->unique()->values();
    $facultyNames = Faculty::query()->whereIn('id', $facultyIds)->pluck('name', 'id');

    // ❌ НЕПРАВИЛЬНО: Всегда K1-K5 = 0
    return $rows->map(fn ($r) => [
        'id' => $r->user_id,
        'name' => ($users[$r->user_id]?->display_name ?? $users[$r->user_id]?->name) ?? '—',
        'title' => $this->resolveUserTitle($users[$r->user_id]?->position_title, $users[$r->user_id]?->ad_title),
        'department_name' => $r->department_id ? ($deptNames[$r->department_id] ?? null) : null,
        'faculty_name' => $r->faculty_id ? ($facultyNames[$r->faculty_id] ?? null) : null,
        'npu_threshold' => $this->teacherNpuThreshold($this->resolveUserTitle($users[$r->user_id]?->position_title, $users[$r->user_id]?->ad_title)),
        'rate' => $this->teacherNpuThreshold($this->resolveUserTitle($users[$r->user_id]?->position_title, $users[$r->user_id]?->ad_title)),
        'rank_score' => (float) $r->total_points,  // ❌ Неправильная формула
        'k1' => 0.0,  // ❌ ВСЕГДА 0
        'k2' => 0.0,  // ❌ ВСЕГДА 0
        'k3' => 0.0,  // ❌ ВСЕГДА 0
        'k4' => 0.0,  // ❌ ВСЕГДА 0
        'k5' => 0.0,  // ❌ ВСЕГДА 0
        'k6' => 0.0,  // ❌ ВСЕГДА 0
        'approved_entries' => (int) $r->approved,
        'source' => 'live',
    ])->values()->all();
}
```

### НОВЫЙ КОД (правильный):

```php
private function liveTeachersAggregation(
    ?KpiPeriod $period = null,
    ?int $deptId = null,
    ?int $facultyId = null,
    ?int $excludeUserId = null,
    ?string $statusFilter = null,
    int $limit = 50
): array {
    // Шаг 1: Получить все KPI entries для преподавателей
    $entries = KpiEntry::query()
        ->with('indicator')  // ← ДОБАВИТЬ!
        ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
        ->when($deptId, fn ($q) => $q->where('department_id', $deptId))
        ->when($facultyId, fn ($q) => $q->where('faculty_id', $facultyId))
        ->when($excludeUserId, fn ($q) => $q->where('user_id', '!=', $excludeUserId))
        ->when($statusFilter, fn ($q) => $q->where('status', $statusFilter))
        ->when(! $statusFilter, fn ($q) => $q->whereNotIn('status', [KpiEntry::STATUS_DRAFT]))
        ->where('entity_type', KpiEntry::ENTITY_TYPE_TEACHER)
        ->where('status', KpiEntry::STATUS_APPROVED)  // ← ТОЛЬКО APPROVED
        ->get();

    if ($entries->isEmpty()) {
        return [];
    }

    // Шаг 2: Агрегировать по пользователям и разделам
    $userAggregates = [];
    $userMetadata = [];
    
    foreach ($entries as $entry) {
        $userId = $entry->user_id;
        
        if (!isset($userAggregates[$userId])) {
            $userAggregates[$userId] = [
                'k1' => 0.0,  // teaching (УМР)
                'k2' => 0.0,  // science (НИР)
                'k3' => 0.0,  // social (СВР)
                'k4' => 0.0,  // qualification (УПК)
                'k5' => 0.0,  // survey (Опросы)
                'approved_count' => 0,
                'department_id' => null,
                'faculty_id' => null,
            ];
            $userMetadata[$userId] = [
                'display_name' => null,
                'name' => null,
                'position_title' => null,
                'ad_title' => null,
            ];
        }

        // Агрегировать баллы по разделам
        $section = $entry->indicator?->section;
        $points = (float) ($entry->manual_points ?? $entry->calculated_points ?? 0);
        
        match($section) {
            KpiIndicator::SECTION_TEACHING => $userAggregates[$userId]['k1'] += $points,
            KpiIndicator::SECTION_SCIENCE => $userAggregates[$userId]['k2'] += $points,
            KpiIndicator::SECTION_SOCIAL => $userAggregates[$userId]['k3'] += $points,
            KpiIndicator::SECTION_QUALIFICATION => $userAggregates[$userId]['k4'] += $points,
            KpiIndicator::SECTION_SURVEY => $userAggregates[$userId]['k5'] += $points,
            default => null,
        };

        $userAggregates[$userId]['approved_count']++;
        $userAggregates[$userId]['department_id'] = $entry->department_id;
        $userAggregates[$userId]['faculty_id'] = $entry->faculty_id;
    }

    // Шаг 3: Получить информацию о преподавателях
    $userIds = array_keys($userAggregates);
    $users = User::query()
        ->whereIn('id', $userIds)
        ->get(['id', 'display_name', 'name', 'position_title', 'ad_title'])
        ->keyBy('id');

    $deptIds = array_filter(array_unique(array_column($userAggregates, 'department_id')));
    $deptNames = Department::query()->whereIn('id', $deptIds)->pluck('name', 'id');

    $facultyIds = array_filter(array_unique(array_column($userAggregates, 'faculty_id')));
    $facultyNames = Faculty::query()->whereIn('id', $facultyIds)->pluck('name', 'id');

    // Шаг 4: Построить результат с правильными K1-K5 и формулой
    $result = [];
    foreach ($userAggregates as $userId => $aggregate) {
        $user = $users[$userId];
        $title = $this->resolveUserTitle($user?->position_title, $user?->ad_title);
        $npu = (float) $this->teacherNpuThreshold($title);

        $k1 = $aggregate['k1'];
        $k2 = $aggregate['k2'];
        $k3 = $aggregate['k3'];
        $k4 = $aggregate['k4'];
        $k5 = $aggregate['k5'];
        
        // ✓ ПРАВИЛЬНАЯ ФОРМУЛА: R = (K1+K2+K3+K4+K5) - НПУ
        $rankScore = $this->teacherRankScore($k1, $k2, $k3, $k4, $k5, 0.0, $npu);

        $result[] = [
            'id' => $userId,
            'name' => ($user?->display_name ?? $user?->name) ?? '—',
            'title' => $title,
            'department_name' => $aggregate['department_id'] ? ($deptNames[$aggregate['department_id']] ?? null) : null,
            'faculty_name' => $aggregate['faculty_id'] ? ($facultyNames[$aggregate['faculty_id']] ?? null) : null,
            'npu_threshold' => (int) $npu,
            'rate' => (int) $npu,
            'k1' => round($k1, 2),  // ✓ ПРАВИЛЬНЫЕ K1-K5
            'k2' => round($k2, 2),
            'k3' => round($k3, 2),
            'k4' => round($k4, 2),
            'k5' => round($k5, 2),
            'k6' => 0.0,  // K6 не используется
            'rank_score' => round($rankScore, 2),  // ✓ ПРАВИЛЬНЫЙ РЕЙТИНГ
            'approved_entries' => (int) $aggregate['approved_count'],
            'source' => 'live',
        ];
    }

    // Сортировка и лимит
    usort($result, fn ($a, $b) => $b['approved_entries'] <=> $a['approved_entries']);
    return array_slice($result, 0, $limit);
}
```

---

## 📝 ШАГ 2: Обновить React Таблицу для Показа K1-K5

**Файл:** `/resources/js/Pages/Kpi/Summary.jsx`  
**Компонент:** `ProfessionalRatingTable`  
**Время:** 20 мин

### Что изменить:

1. **Добавить колонки для K1-K5:**
   ```jsx
   <TableHead>
     <TableRow>
       <TableHeaderCell>ФИО</TableHeaderCell>
       <TableHeaderCell>Должность</TableHeaderCell>
       <TableHeaderCell>К1 (УМР)</TableHeaderCell>
       <TableHeaderCell>К2 (НИР)</TableHeaderCell>
       <TableHeaderCell>К3 (СВР)</TableHeaderCell>
       <TableHeaderCell>К4 (УПК)</TableHeaderCell>
       <TableHeaderCell>К5 (Опрос)</TableHeaderCell>
       <TableHeaderCell>НПУ</TableHeaderCell>
       <TableHeaderCell>Рейтинг (R)</TableHeaderCell>
     </TableRow>
   </TableHead>
   ```

2. **Обновить строки таблицы:**
   ```jsx
   {results.map(item => (
     <TableRow key={item.id}>
       <TableCell>{item.name}</TableCell>
       <TableCell>{item.title}</TableCell>
       <TableCell align="right">{fmt(item.k1)}</TableCell>
       <TableCell align="right">{fmt(item.k2)}</TableCell>
       <TableCell align="right">{fmt(item.k3)}</TableCell>
       <TableCell align="right">{fmt(item.k4)}</TableCell>
       <TableCell align="right">{fmt(item.k5)}</TableCell>
       <TableCell align="right">{fmt(item.npu_threshold)}</TableCell>
       <TableCell align="right" className={item.rank_score < 0 ? 'text-red-500' : ''}>
         {fmt(item.rank_score)}
       </TableCell>
     </TableRow>
   ))}
   ```

---

## 📝 ШАГ 3: Добавить Видимость Формулы Расчета

**Файл:** `/resources/js/Pages/Kpi/SummaryTeacherCard.jsx`  
**Компонент:** `ResultScoreCard`  
**Время:** 15 мин

### Добавить компонент:

```jsx
function FormulaBreakdown({ result, npu_threshold }) {
  const k1 = fmt(result.k1);
  const k2 = fmt(result.k2);
  const k3 = fmt(result.k3);
  const k4 = fmt(result.k4);
  const k5 = fmt(result.k5);
  const sum = (result.k1 + result.k2 + result.k3 + result.k4 + result.k5).toFixed(2);
  const rank = fmt(result.rank_score);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Расчет Рейтинга</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 font-mono text-sm">
          <div>Формула: R = (K1 + K2 + K3 + K4 + K5) - НПУ</div>
          <div className="border-t pt-2">
            Подстановка:
          </div>
          <div>
            R = ({k1} + {k2} + {k3} + {k4} + {k5}) - {npu_threshold}
          </div>
          <div>
            R = {sum} - {npu_threshold}
          </div>
          <div className={`text-lg font-bold ${rank_score < 0 ? 'text-red-600' : 'text-green-600'}`}>
            R = {rank}
          </div>
          {rank < 0 && (
            <div className="text-xs text-red-600">
              ⚠️ Не достигнут минимум выполнения НПУ
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Добавить в ResultScoreCard:
export function ResultScoreCard({ result }) {
  return (
    <div className="space-y-4">
      {/* Существующие чипы */}
      <div className="flex gap-2 flex-wrap">
        <Badge>К1: {fmt(result.k1)}</Badge>
        <Badge>К2: {fmt(result.k2)}</Badge>
        <Badge>К3: {fmt(result.k3)}</Badge>
        <Badge>К4: {fmt(result.k4)}</Badge>
        <Badge>К5: {fmt(result.k5)}</Badge>
      </div>

      {/* НОВОЕ: Формула расчета */}
      <FormulaBreakdown 
        result={result} 
        npu_threshold={result.npu_threshold || result.rate}
      />

      {/* Существующий рейтинг */}
      <div className="text-center">
        <div className="text-3xl font-bold">{fmt(result.rank_score)}</div>
        <div className="text-xs text-gray-500">Профессиональный Рейтинг</div>
      </div>
    </div>
  );
}
```

---

## 📝 ШАГ 4: Проверить Заполнение Должностей

**Файл:** `/database/migrations/` (or через artisan command)  
**Задача:** Убедиться что у всех преподавателей заполнена должность  
**Время:** 30 мин

### SQL запрос для проверки:

```sql
-- Найти преподавателей БЕЗ должности
SELECT id, name, position_title, ad_title, email
FROM users
WHERE (position_title IS NULL OR position_title = '')
  AND (ad_title IS NULL OR ad_title = '')
  AND entity_type = 'teacher'
LIMIT 20;
```

### Результат:
```
id | name | position_title | ad_title | email
123 | Казбекова М.К. | NULL | NULL | kazbek@uni.kz
```

### Решение:
```sql
-- Вариант 1: Установить значение по умолчанию
UPDATE users
SET position_title = 'Ассистент'
WHERE id = 123 AND position_title IS NULL;

-- Вариант 2: Заполнить из AD (если есть данные)
UPDATE users u
SET position_title = (
  SELECT position FROM ad_users 
  WHERE email = u.email LIMIT 1
)
WHERE u.position_title IS NULL;
```

---

## 📝 ШАГ 5: Тестирование

**Время:** 45 мин

### Чек-лист:

- [ ] **Логин и навигация:**
  - [ ] Вход в систему как админ
  - [ ] Открыть KPI Summary
  - [ ] Выбрать период с активными данными

- [ ] **Live Aggregation:**
  - [ ] Таблица показывает K1-K5 (не все нули)
  - [ ] Рейтинг вычисляется по формуле R = (K1+K2+K3+K4+K5) - НПУ
  - [ ] Отрицательные рейтинги отмечены красным

- [ ] **Карточка преподавателя:**
  - [ ] Видна формула расчета
  - [ ] Вместо статичного текста показаны реальные числа
  - [ ] Расчет соответствует таблице

- [ ] **Должности:**
  - [ ] У Казбековой М.К. установлена должность
  - [ ] НПУ > 0
  - [ ] Рейтинг вычисляется правильно

- [ ] **Граничные случаи:**
  - [ ] Преподаватель без утвержденных записей → K1-K5 = 0 ✓
  - [ ] Преподаватель с одной записью K2 → K1=0, K2=200, K3-K5=0 ✓
  - [ ] Рейтинг ниже НПУ → красный ❌ ✓

### SQL для проверки:

```sql
-- Проверить что данные агрегируются правильно
SELECT 
  u.id, u.name, u.position_title,
  COUNT(*) as total_entries,
  SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved,
  SUM(manual_points + calculated_points) as total_points
FROM kpi_entries ke
JOIN users u ON ke.user_id = u.id
WHERE ke.kpi_period_id = 1
  AND ke.entity_type = 'teacher'
GROUP BY u.id
ORDER BY approved DESC
LIMIT 10;
```

---

## 📝 ШАГ 6: Деплой и Мониторинг

**Время:** 20 мин

### Перед деплоем:

1. **Создать backup БД:**
   ```bash
   mysqldump laravel_react > backup_before_fix_$(date +%s).sql
   ```

2. **Запустить миграции (если нужны):**
   ```bash
   php artisan migrate
   ```

3. **Очистить кэш:**
   ```bash
   php artisan cache:clear
   ```

4. **Перестроить JS:**
   ```bash
   npm run build
   ```

### После деплоя:

- [ ] Таблица обновилась
- [ ] Никаких ошибок в `laravel.log`
- [ ] Никаких JS ошибок в консоли браузера
- [ ] Все рейтинги считаются корректно
- [ ] Фронтенд отображает формулы

---

## 🚨 ОТКАТ (если что-то сломается)

```bash
# Вернуть БД
mysql laravel_react < backup_before_fix_*.sql

# Вернуть код (если не коммитили)
git checkout HEAD~1 app/Http/Controllers/KpiSummaryController.php
git checkout HEAD~1 resources/js/Pages/Kpi/Summary.jsx
git checkout HEAD~1 resources/js/Pages/Kpi/SummaryTeacherCard.jsx

# Пересобрать
npm run build
php artisan cache:clear
```

---

## 📊 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

### После исправления:

| Преподаватель | До исправления | После исправления |
|---|---|---|
| Казбекова М.К. | K1-K5=0, R=0 | K1=0, K2=0, K3=0, K4=0, K5=0, НПУ=400(?), R=-400(?) |
| Каржауова Э.К. | K1-K5=0, R=0 | K1=0, K2=0, K3=0, K4=0, K5=0, НПУ=600, R=-600 |
| С неутвержд. записью | K1-K5=0, R=0 | K1=0, K2=0, K3=0, K4=0, K5=0, НПУ=600, R=-600 |
| С одной записью K2=200 | K1-K5=0, R=200 ❌ | K1=0, K2=200, K3-K5=0, НПУ=600, R=-400 ❌ |

⚠️ **Важно:** После исправления все рейтинги будут ≤ 0 (не достигнут НПУ), это нормально!

---

## 📞 КОНТРОЛЬНЫЕ ВОПРОСЫ

1. **Q: Почему все рейтинги отрицательные?**
   - A: Потому что нет одобренных KPI записей. Система должна показывать это честно.

2. **Q: Как заполнить данные КПИ?**
   - A: Преподаватели должны создать KPI entries в личном кабинете, затем одобрить их HOD/Dean.

3. **Q: Почему K6 в формуле, если не используется?**
   - A: K6 = НПУ, система вычитает НПУ вместо K6. По регламенту K6 не используется.

4. **Q: Где взять план/факт значения?**
   - A: План устанавливается в KpiIndicator.base_points, факт вводит преподаватель.

---

**Статус:** ✅ Готово к внедрению  
**Утверждено:** GitHub Copilot Audit Team  
**Дата:** 2026-05-19

