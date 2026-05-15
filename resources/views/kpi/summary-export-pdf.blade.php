<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111827; }
        h1 { font-size: 18px; margin: 0 0 6px; }
        h2 { font-size: 13px; margin: 16px 0 8px; }
        .meta { margin: 0 0 10px; color: #374151; }
        table { width: 100%; border-collapse: collapse; margin: 0 0 12px; }
        th, td { border: 1px solid #d1d5db; padding: 5px 6px; vertical-align: top; }
        th { background: #f3f4f6; text-align: left; }
        .muted { color: #6b7280; }
        .num { text-align: right; }
    </style>
</head>
<body>
@php
    $scope = data_get($summary, 'scope', 'teacher');
    $statusText = fn($status) => $statusLabels[$status] ?? $status;
    $sectionText = fn($section) => $sectionLabels[$section] ?? $section;
@endphp

<h1>KPI - Сводка</h1>
<p class="meta">Сформировано: {{ $generatedAt }}</p>
<p class="meta">Учебный год: {{ data_get($academicYear, 'name', 'не указан') }}</p>
<p class="meta">Период: {{ data_get($period, 'name', 'не указан') }}</p>
<p class="meta">Область: {{ $scope }}</p>

@if ($scope === 'teacher')
    <h2>Профиль</h2>
    <table>
        <tr>
            <th>ФИО</th>
            <th>Должность</th>
            <th>Подразделение</th>
            <th class="num">Рейтинг R</th>
        </tr>
        <tr>
            <td>{{ data_get($summary, 'user.name', '-') }}</td>
            <td>{{ data_get($summary, 'user.title', '-') }}</td>
            <td>{{ data_get($summary, 'user.division', '-') }}</td>
            <td class="num">{{ data_get($summary, 'result.rank_score', 0) }}</td>
        </tr>
    </table>

    <h2>Итоги</h2>
    <table>
        <tr>
            <th class="num">Всего записей</th>
            <th class="num">Утверждено</th>
            <th class="num">На проверке</th>
            <th class="num">Баллы</th>
        </tr>
        <tr>
            <td class="num">{{ data_get($summary, 'totals.total', 0) }}</td>
            <td class="num">{{ data_get($summary, 'totals.approved', 0) }}</td>
            <td class="num">{{ data_get($summary, 'totals.submitted', 0) + data_get($summary, 'totals.pending', 0) }}</td>
            <td class="num">{{ data_get($summary, 'totals.total_points', 0) }}</td>
        </tr>
    </table>

    @foreach ((array) data_get($summary, 'entries', []) as $section => $items)
        <h2>{{ $sectionText($section) }}</h2>
        <table>
            <tr>
                <th>Код</th>
                <th>Показатель</th>
                <th class="num">План</th>
                <th class="num">Факт</th>
                <th class="num">Баллы</th>
                <th>Статус</th>
            </tr>
            @foreach ((array) $items as $row)
                <tr>
                    <td>{{ data_get($row, 'code', '') }}</td>
                    <td>{{ data_get($row, 'name', '') }}</td>
                    <td class="num">{{ data_get($row, 'plan_value', '') }}</td>
                    <td class="num">{{ data_get($row, 'fact_value', '') }}</td>
                    <td class="num">{{ data_get($row, 'points', 0) }}</td>
                    <td>{{ $statusText(data_get($row, 'status', '')) }}</td>
                </tr>
            @endforeach
        </table>
    @endforeach
@endif

@if (in_array($scope, ['hod', 'department_head'], true))
    <h2>Кафедра</h2>
    <table>
        <tr>
            <th>Зав. кафедрой</th>
            <th>Кафедра</th>
            <th class="num">Рейтинг R</th>
        </tr>
        <tr>
            <td>{{ data_get($summary, 'user.name', '-') }}</td>
            <td>{{ data_get($summary, 'department.name', '-') }}</td>
            <td class="num">{{ data_get($summary, 'own_result.rank_score', 0) }}</td>
        </tr>
    </table>

    <h2>Рейтинг ППС кафедры</h2>
    <table>
        <tr>
            <th>ФИО</th>
            <th>Должность</th>
            <th class="num">Баллы</th>
            <th>Статус</th>
        </tr>
        @foreach ((array) data_get($summary, 'teachers', []) as $row)
            <tr>
                <td>{{ data_get($row, 'name', '-') }}</td>
                <td>{{ data_get($row, 'title', '-') }}</td>
                <td class="num">{{ data_get($row, 'total_points', 0) }}</td>
                <td>{{ $statusText(data_get($row, 'status', '')) }}</td>
            </tr>
        @endforeach
    </table>
@endif

@if ($scope === 'dean')
    <h2>Факультет</h2>
    <table>
        <tr>
            <th>Декан</th>
            <th>Факультет</th>
            <th class="num">Рейтинг R</th>
        </tr>
        <tr>
            <td>{{ data_get($summary, 'user.name', '-') }}</td>
            <td>{{ data_get($summary, 'faculty.name', '-') }}</td>
            <td class="num">{{ data_get($summary, 'own_result.rank_score', 0) }}</td>
        </tr>
    </table>

    <h2>Рейтинг кафедр</h2>
    <table>
        <tr>
            <th>Кафедра</th>
            <th class="num">Баллы</th>
            <th class="num">Утверждено</th>
            <th class="num">Записей</th>
        </tr>
        @foreach ((array) data_get($summary, 'departments', []) as $row)
            <tr>
                <td>{{ data_get($row, 'name', '-') }}</td>
                <td class="num">{{ data_get($row, 'total_points', 0) }}</td>
                <td class="num">{{ data_get($row, 'approved_entries', 0) }}</td>
                <td class="num">{{ data_get($row, 'total_entries', 0) }}</td>
            </tr>
        @endforeach
    </table>
@endif

@if (in_array($scope, ['admin', 'superadmin'], true))
    <h2>Общая статистика</h2>
    <table>
        <tr>
            <th class="num">Активных периодов</th>
            <th class="num">Всего записей</th>
            <th class="num">Утверждено</th>
            <th class="num">На проверке</th>
        </tr>
        <tr>
            <td class="num">{{ data_get($summary, 'status_counts.active_periods_count', 0) }}</td>
            <td class="num">{{ data_get($summary, 'status_counts.total_entries', 0) }}</td>
            <td class="num">{{ data_get($summary, 'status_counts.approved_entries', 0) }}</td>
            <td class="num">{{ data_get($summary, 'status_counts.pending_entries', 0) }}</td>
        </tr>
    </table>

    <h2>Топ ППС</h2>
    <table>
        <tr>
            <th>ФИО</th>
            <th>Факультет</th>
            <th class="num">Баллы</th>
            <th class="num">R</th>
        </tr>
        @foreach ((array) data_get($summary, 'top_teachers', []) as $row)
            <tr>
                <td>{{ data_get($row, 'name', '-') }}</td>
                <td>{{ data_get($row, 'faculty_name', '-') }}</td>
                <td class="num">{{ data_get($row, 'total_points', 0) }}</td>
                <td class="num">{{ data_get($row, 'rank_score', 0) }}</td>
            </tr>
        @endforeach
    </table>
@endif

@if (in_array($scope, ['department', 'structural'], true))
    <h2>Сводка по факультетам</h2>
    <table>
        <tr>
            <th>Факультет</th>
            <th class="num">ППС</th>
            <th class="num">Записей</th>
            <th class="num">Утв.</th>
            <th class="num">Ожидает</th>
        </tr>
        @foreach ((array) data_get($summary, 'faculties', []) as $row)
            <tr>
                <td>{{ data_get($row, 'name', '-') }}</td>
                <td class="num">{{ data_get($row, 'user_count', 0) }}</td>
                <td class="num">{{ data_get($row, 'total_entries', 0) }}</td>
                <td class="num">{{ data_get($row, 'approved', 0) }}</td>
                <td class="num">{{ data_get($row, 'pending', 0) }}</td>
            </tr>
        @endforeach
    </table>

    <h2>Ожидают финального утверждения</h2>
    <table>
        <tr>
            <th>ФИО</th>
            <th>Показатель</th>
            <th class="num">Факт</th>
            <th class="num">Баллы</th>
        </tr>
        @foreach ((array) data_get($summary, 'pending_teachers', []) as $row)
            <tr>
                <td>{{ data_get($row, 'name', '-') }}</td>
                <td>{{ data_get($row, 'indicator', '-') }}</td>
                <td class="num">{{ data_get($row, 'fact_value', '-') }}</td>
                <td class="num">{{ data_get($row, 'points', 0) }}</td>
            </tr>
        @endforeach
    </table>
@endif

</body>
</html>
