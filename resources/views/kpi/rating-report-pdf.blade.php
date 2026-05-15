<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <style>
        body {
            font-family: "Times New Roman", Times, serif;
            font-size: 12px;
            color: #111;
        }
        h1 {
            font-size: 20px;
            margin: 0 0 8px;
            text-align: center;
        }
        .meta {
            margin: 0 0 6px;
            text-align: center;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
        }
        th, td {
            border: 1px solid #000;
            padding: 5px 6px;
            vertical-align: top;
        }
        th {
            background: #f2f2f2;
            text-align: center;
            font-weight: bold;
        }
        td.num {
            text-align: right;
            white-space: nowrap;
        }
        td.center {
            text-align: center;
            white-space: nowrap;
        }
        .small {
            font-size: 11px;
        }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <p class="meta">Учебный год: {{ data_get($academicYear, 'name', 'не указан') }} | Период: {{ data_get($period, 'name', 'не указан') }}</p>
    <p class="meta small">Сформировано: {{ $generatedAt }}</p>

    @if ($report === 'teachers')
        <table>
            <thead>
                <tr>
                    <th>№</th>
                    <th>ФИО</th>
                    <th>Факультет</th>
                    <th>Кафедра</th>
                    <th>Должность</th>
                    <th>Ставка</th>
                    <th>УМР</th>
                    <th>НИР</th>
                    <th>СВР</th>
                    <th>УПК</th>
                    <th>К5</th>
                    <th>К6</th>
                    <th>Рейтинг</th>
                </tr>
            </thead>
            <tbody>
                @forelse($rows as $i => $row)
                    <tr>
                        <td class="center">{{ $i + 1 }}</td>
                        <td>{{ data_get($row, 'name', '—') }}</td>
                        <td>{{ data_get($row, 'faculty_name', '—') }}</td>
                        <td>{{ data_get($row, 'department_name', '—') }}</td>
                        <td>{{ data_get($row, 'title', '—') }}</td>
                        <td class="num">{{ data_get($row, 'rate', data_get($row, 'workload_rate', data_get($row, 'stavka', '—'))) }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k1', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k2', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k3', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k4', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k5', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k6', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'rank_score', 0), 2, '.', '') }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="13" class="center">Нет данных</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    @endif

    @if ($report === 'deans')
        <table>
            <thead>
                <tr>
                    <th>№</th>
                    <th>Факультет</th>
                    <th>ФИО декана</th>
                    <th>НПУ</th>
                    <th>Рейтинг</th>
                    <th>УМР</th>
                    <th>НИР</th>
                    <th>СВР</th>
                    <th>УПК</th>
                </tr>
            </thead>
            <tbody>
                @forelse($rows as $i => $row)
                    <tr>
                        <td class="center">{{ $i + 1 }}</td>
                        <td>{{ data_get($row, 'faculty_name', '—') }}</td>
                        <td>{{ data_get($row, 'name', '—') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'npu_threshold', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'rank_score', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k1', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k2', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k3', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k4', 0), 2, '.', '') }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="9" class="center">Нет данных</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    @endif

    @if ($report === 'hods')
        <table>
            <thead>
                <tr>
                    <th>№</th>
                    <th>Факультет</th>
                    <th>Кафедра</th>
                    <th>ФИО зав.каф.</th>
                    <th>НПУ</th>
                    <th>Рейтинг</th>
                    <th>УМР</th>
                    <th>НИР</th>
                    <th>СВР</th>
                    <th>УПК</th>
                </tr>
            </thead>
            <tbody>
                @forelse($rows as $i => $row)
                    <tr>
                        <td class="center">{{ $i + 1 }}</td>
                        <td>{{ data_get($row, 'faculty_name', '—') }}</td>
                        <td>{{ data_get($row, 'department_name', '—') }}</td>
                        <td>{{ data_get($row, 'name', '—') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'npu_threshold', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'rank_score', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k1', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k2', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k3', 0), 2, '.', '') }}</td>
                        <td class="num">{{ number_format((float) data_get($row, 'k4', 0), 2, '.', '') }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="10" class="center">Нет данных</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    @endif
</body>
</html>
