# KPI Summary Pages & Export Functionality — Exploration Report

## 1. Excel Packages Status

**Current Status:** ❌ **NO Excel packages installed**

### composer.json Analysis
- **No maatwebsite/excel** (Laravel Excel package)
- **No phpoffice/phpspreadsheet** (raw spreadsheet package)
- **No league/csv** (CSV writer)

**Recommendation:** Install `maatwebsite/excel` or use native PHP CSV/streaming for exports.

---

## 2. KPI Summary React Components

### Location: `/var/www/laravel-react/resources/js/Pages/Kpi/`

| Component | Purpose | File |
|-----------|---------|------|
| **Summary.jsx** | Main summary dashboard (shows all roles: teacher, HOD, dean, admin, structural) | [Summary.jsx](resources/js/Pages/Kpi/Summary.jsx) |
| **SummaryTeacherCard.jsx** | Detailed card for individual teacher's KPI performance (drilldown view) | [SummaryTeacherCard.jsx](resources/js/Pages/Kpi/SummaryTeacherCard.jsx) |

### Summary.jsx Structure
- **Main Sections:**
  - Filter bar (academic year, period selection)
  - Role-based rendering (teacher, HOD, dean, admin, structural)
  - Multiple tabs per role

- **Tabs by Role:**
  - **Teacher:** Mine (personal results)
  - **HOD/Department Head:** Mine, Department, Teachers
  - **Dean:** Mine, Departments, Teachers
  - **Admin/Superadmin:** Overview, Teachers, Deans, HODs
  - **Structural:** Faculties, Pending

- **Data Rendered:**
  - Result score cards (rank_score, K1–K6)
  - Entry tables grouped by section (УМР, НИР, СВР, УПК, К5)
  - Ranking tables (teachers, HODs, deans, departments)
  - Status counts (draft, submitted, reviewed, pending, approved, rejected)

### SummaryTeacherCard.jsx Structure
- Individual teacher performance page
- Accessible via `route('kpi.summary.teacher', { userId })` from ranking tables
- Shows teacher's personal KPI entries with status history
- Entry details with status logs and comments

---

## 3. KpiSummaryController.php — Methods & Data Aggregation

### Location: [app/Http/Controllers/KpiSummaryController.php](app/Http/Controllers/KpiSummaryController.php)

### Public Methods
1. **`index(Request $request): Response`**
   - Main summary dashboard controller
   - Resolves user role and academic year/period
   - Calls role-specific summary builder
   - **Returns to:** `Summary.jsx`

2. **`showTeacher(Request $request, int $userId): Response`**
   - Detailed teacher card page
   - Loads all entries with status logs and actors
   - Returns finalized KpiResult if available
   - **Returns to:** `SummaryTeacherCard.jsx`

### Private Summary Builders (Role-Specific)

#### `teacherSummary(User $user, ?KpiPeriod $period): array`
```php
Returns: [
    'scope' => 'teacher',
    'user' => ['id', 'name', 'title', 'division'],
    'result' => KpiResult (formatted: rank_score, k1–k6, approved_entries),
    'entries' => [
        'teaching' => [...entries],
        'science' => [...entries],
        'social' => [...entries],
        'qualification' => [...entries],
        'survey' => [...entries],
    ],
    'totals' => ['total', 'approved', 'submitted', 'pending', 'total_points'],
]
```

#### `hodSummary(User $user, ?KpiPeriod $period): array`
```php
Returns: [
    'scope' => 'hod',
    'user' => [...],
    'department' => ['id', 'name'],
    'own_result' => KpiResult (with npu_threshold computed),
    'own_entries' => [...grouped by section...],
    'own_totals' => [...],
    'dept_result' => KpiResult (department aggregated),
    'teachers' => [array of ranked teachers in department],
]
```

#### `deanSummary(User $user, ?KpiPeriod $period): array`
```php
Returns: [
    'scope' => 'dean',
    'user' => [...],
    'faculty' => ['id', 'name'],
    'own_result' => KpiResult (with npu_threshold computed),
    'own_entries' => [...],
    'own_totals' => [...],
    'faculty_result' => KpiResult (faculty aggregated),
    'departments' => [ranked departments in faculty],
    'teachers' => [ranked teachers in faculty],
]
```

#### `adminSummary(?KpiPeriod $period): array`
```php
Returns: [
    'scope' => 'admin',
    'status_counts' => ['draft' => N, 'submitted' => N, ...],
    'section_stats' => [
        'teaching' => ['total' => N, 'approved' => N, 'total_points' => F],
        'science' => [...],
        ...
    ],
    'faculties' => [
        ['id', 'name', 'user_count', 'total_entries', 'approved', 'rank_score'],
        ...
    ],
    'top_teachers' => [ranked teachers (50 limit)],
    'top_hods' => [ranked HODs],
    'top_deans' => [ranked deans],
    'departments' => [ranked departments],
]
```

#### `structuralSummary(User $user, ?KpiPeriod $period): array`
```php
Returns: [
    'scope' => 'structural',
    'divisions' => [structural units assigned to user],
    'faculties' => [faculty stats for entries in user's divisions],
    'pending_teachers' => [teachers pending structural approval],
]
```

### Helper Methods (Ranking & Aggregation)

| Method | Purpose | Returns |
|--------|---------|---------|
| `departmentTeachersRanking()` | Teachers in a department (ranked) | Array of teacher objects with K1–K6 scores |
| `facultyTeachersRanking()` | Teachers in a faculty (ranked) | Array of teacher objects |
| `allTeachersRanking()` | All teachers admin view (top 50) | Array with rank_score, K scores |
| `allHodsRanking()` | All HODs admin view | Array with department context |
| `allDeansRanking()` | All deans admin view | Array with faculty context |
| `facultyDeptRanking()` | Departments in a faculty (dean view) | Array with teacher_count, entry_count, approved |
| `allDeptRanking()` | All departments admin view | Array ranked by score |
| `groupEntriesBySection()` | Group entries by KPI section | `['teaching' => [...], 'science' => [...], ...]` |
| `calcTotals()` | Aggregate entry stats | `['total', 'approved', 'submitted', 'pending', 'total_points']` |
| `formatResult()` | Format KpiResult object | `['rank_score', 'k1'–'k6', 'approved_entries']` |

---

## 4. Routes — Web.php

### Location: [routes/web.php](routes/web.php)

### KPI Summary Routes
```php
// Main summary dashboard (all roles)
Route::get('kpi/summary', [KpiSummaryController::class, 'index'])
    ->name('kpi.summary');

// Individual teacher detail card
Route::get('kpi/summary/teacher/{userId}', [KpiSummaryController::class, 'showTeacher'])
    ->name('kpi.summary.teacher')
    ->whereNumber('userId');
```

**⚠️ No export routes currently exist.**

---

## 5. Current Data Structures Returned by Summary Endpoints

### Response Structure: `index()` → Summary.jsx

```javascript
{
  roleSlug: string ('admin', 'dean', 'hod', 'teacher', 'department'),
  summary: {
    // Role-specific content (see above builders)
    scope: string,
    [role-specific fields...]
  },
  academicYear: {
    id: int,
    name: string ('2024-2025'),
    start_year: int,
    end_year: int,
  },
  period: {
    id: int,
    name: string ('Осень 2024'),
    stage: string,
    status: string ('active', 'closed'),
  },
  filters: {
    academic_year_id: int,
    period_id: int,
  },
  filterOptions: {
    academicYears: [...],
    periods: [...],
  },
}
```

### Individual Teacher Entry Structure
```javascript
{
  id: int,
  code: string,
  name: string,
  unit: string,
  plan_value: float,
  fact_value: float,
  points: float (manual_points || calculated_points),
  status: string ('submitted', 'reviewed', 'approved', ...),
  comment?: string,
  submitted_at?: datetime,
  reviewed_at?: datetime,
  approved_at?: datetime,
}
```

### Ranking Table Row Structure
```javascript
{
  id: int (user_id),
  name: string,
  title: string (ad_title),
  department_name?: string,
  faculty_name?: string,
  rank_score: float,
  k1: float, k2: float, k3: float, k4: float, k5: float, k6: float,
  approved_entries: int,
  npu_threshold: int,
  source: string ('result' | 'live'),
}
```

---

## 6. Existing Export Functionality (Reference)

### CertificateRegistryController.php
**Location:** [app/Http/Controllers/CertificateRegistryController.php](app/Http/Controllers/CertificateRegistryController.php)

**Export Method:** `exportCsv(Request $request): Response`

**Implementation Pattern:**
```php
public function exportCsv(Request $request): Response
{
    $filename = 'certificates_registry_' . now()->format('Ymd_His') . '.csv';
    
    return response()->streamDownload(function () use ($items): void {
        $handle = fopen('php://output', 'wb');
        
        // UTF-8 BOM for Excel compatibility
        fwrite($handle, "\xEF\xBB\xBF");
        
        // Headers
        fputcsv($handle, ['Column1', 'Column2', ...]);
        
        // Data rows
        foreach ($items as $item) {
            fputcsv($handle, [
                $item->field1,
                $item->field2,
                ...
            ]);
        }
        
        fclose($handle);
    }, $filename, [
        'Content-Type' => 'text/csv; charset=UTF-8',
    ]);
}
```

**Key Features:**
- ✅ UTF-8 BOM (`\xEF\xBB\xBF`) for Excel compatibility
- ✅ Streaming (no memory issues for large exports)
- ✅ Native PHP CSV functions (no external packages required)

---

## 7. Summary Tables & Columns to Export

### Exportable Sections:

#### A. Teacher Summary
```
Columns:
- ФИО (name)
- Должность (title)
- Подразделение (division)
- УМР (К1 score)
- НИР (К2 score)
- СВР (К3 score)
- УПК (К4 score)
- К5 score
- К6 score
- Рейтинг (rank_score)
- НПУ порог (npu_threshold)
- Рейтинг - НПУ (rank_score - npu_threshold)
- Утвержденных записей (approved_entries)
```

#### B. Department/Faculty Summary (HOD/Dean views)
```
Columns:
- Подразделение/Факультет (name)
- Количество ППС (user_count)
- Всего записей (total_entries)
- Утвержденных (approved)
- Статус утверждения (approved %)
```

#### C. Entry-Level Detail
```
Columns:
- ФИО преподавателя (user name)
- Код показателя (code)
- Показатель (name)
- Ед. измерения (unit)
- План (plan_value)
- Факт (fact_value)
- Баллы (points)
- Статус (status)
- Комментарий (comment)
```

#### D. Status Counters (Admin)
```
Columns:
- Статус
- Количество
- Процент от всех
```

---

## 8. Recommended Export Approach

### Option 1: Native PHP CSV (Recommended)
- **Pros:** No external packages, lightweight, works immediately
- **Pattern:** Use `response()->streamDownload()` like CertificateRegistryController
- **Format:** CSV with UTF-8 BOM
- **Implementation Time:** ~2 hours

### Option 2: Laravel Excel (Maatwebsite)
- **Pros:** Advanced formatting, styled Excel, multiple sheets, formulas
- **Cons:** Additional dependency, more complex setup
- **Implementation Time:** ~4 hours

### Suggested Routes to Add:
```php
Route::get('kpi/summary/export', [KpiSummaryController::class, 'exportSummary'])
    ->name('kpi.summary.export');

Route::get('kpi/summary/teacher/{userId}/export', [KpiSummaryController::class, 'exportTeacher'])
    ->name('kpi.summary.teacher.export');
```

---

## 9. Key Files Summary

| File | Type | Purpose |
|------|------|---------|
| [app/Http/Controllers/KpiSummaryController.php](app/Http/Controllers/KpiSummaryController.php) | Controller | Query building, data aggregation, business logic |
| [resources/js/Pages/Kpi/Summary.jsx](resources/js/Pages/Kpi/Summary.jsx) | React | Display summary dashboard with tabs, tables, cards |
| [resources/js/Pages/Kpi/SummaryTeacherCard.jsx](resources/js/Pages/Kpi/SummaryTeacherCard.jsx) | React | Detailed teacher card with entry history |
| [routes/web.php](routes/web.php) | Routes | URL mappings (lines 168, 178) |
| [app/Http/Controllers/CertificateRegistryController.php](app/Http/Controllers/CertificateRegistryController.php) | Reference | Example CSV export implementation |

---

## 10. Next Steps for Export Implementation

1. ✅ **Understand data sources** — Done (KpiSummaryController builders)
2. ✅ **Identify export targets** — Done (tables, rankings, summaries)
3. ⬜ **Choose export method** — PHP CSV recommended
4. ⬜ **Create export controller methods** — `exportSummary()`, `exportTeacher()`
5. ⬜ **Add UI export buttons** — React component updates
6. ⬜ **Test with real data** — Verify column formatting
7. ⬜ **Add routes** — Register new export endpoints

---

Generated: 2026-05-06
