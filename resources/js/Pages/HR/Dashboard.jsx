import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, Link, router } from '@inertiajs/react';
import { AlertCircle, BarChart3, Bot, Copy, Download, FileDown, LogOut, Sparkles, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function formatDateLabel(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Donut({ segments, total, size = 100, stroke = 10 }) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    let offsetAcc = 0;

    const segmentsTotal = segments.reduce((acc, segment) => acc + Math.max(Number(segment.value ?? 0), 0), 0);
    const normalizedTotal = Math.max(total, segmentsTotal, 1);

    const percent = segments.length > 0 ? Math.round((Number(segments[0].value ?? 0) / normalizedTotal) * 100) : 0;

    return (
        <div className="flex flex-col items-center gap-2">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#f3f4f6"
                    strokeWidth={stroke}
                />
                {segments.map((segment, idx) => {
                    const value = Number(segment.value ?? 0);
                    const part = normalizedTotal > 0 ? value / normalizedTotal : 0;
                    const dash = part * circumference;
                    const node = (
                        <circle
                            key={`${segment.name}-${idx}`}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth={stroke}
                            strokeDasharray={`${dash} ${circumference - dash}`}
                            strokeDashoffset={-offsetAcc}
                            transform={`rotate(-90 ${size / 2} ${size / 2})`}
                            strokeLinecap="round"
                        />
                    );
                    offsetAcc += dash;
                    return node;
                })}
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="700" fill="#1f2937">
                    {percent}%
                </text>
            </svg>
        </div>
    );
}

function KpiCard({ icon: Icon, label, value, trend = null, trendValue = null, color = '#3b82f6' }) {
    const isTrendUp = trend === 'up';
    const TrendIcon = isTrendUp ? TrendingUp : TrendingDown;
    
    return (
        <Card className="border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                        <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                    {trend && (
                        <div className="flex items-center gap-1">
                            <TrendIcon className="h-4 w-4" style={{ color: isTrendUp ? '#10b981' : '#ef4444' }} />
                            <span className="text-xs font-semibold" style={{ color: isTrendUp ? '#10b981' : '#ef4444' }}>
                                {trendValue}%
                            </span>
                        </div>
                    )}
                </div>
                <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
            </CardContent>
        </Card>
    );
}

function DonutCard({ title, segments, total, donut = true, onSegmentClick = null }) {
    return (
        <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
                {donut ? (
                    <div className="flex items-center gap-4">
                        <Donut segments={segments} total={total} />
                        <div className="space-y-1.5 text-xs flex-1">
                            {segments.map((segment) => (
                                <div
                                    key={segment.name}
                                    className={`flex items-center gap-2 justify-between ${onSegmentClick ? 'cursor-pointer rounded px-1 py-0.5 hover:bg-slate-100' : ''}`}
                                    onClick={() => onSegmentClick && onSegmentClick(segment)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: segment.color }} />
                                        <span className="text-slate-600 font-medium">{segment.name}</span>
                                    </div>
                                    <strong className="text-slate-900">{segment.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5 text-xs">
                        {segments.map((segment) => (
                            <div key={segment.name} className="flex items-center gap-2 justify-between">
                                <span className="text-slate-600 font-medium">{segment.name}</span>
                                <strong className="text-slate-900">{segment.value}</strong>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function buildAiReportText(type, payload) {
    const {
        employeesTotal,
        employeesActive,
        latePeriodPeople,
        earlyPeriodPeople,
        periodTitle,
        topDivisions,
    } = payload;

    const top3 = topDivisions.slice(0, 3);
    const topText = top3.length > 0
        ? top3
            .map((row, idx) => `${idx + 1}. ${row.division} — ${row.late_events} опозданий, ${row.late_people} сотрудников`)
            .join('\n')
        : 'Нет данных по подразделениям за выбранный период.';

    const lateRate = employeesActive > 0
        ? ((latePeriodPeople / employeesActive) * 100).toFixed(1)
        : '0.0';

    const earlyRate = employeesActive > 0
        ? ((earlyPeriodPeople / employeesActive) * 100).toFixed(1)
        : '0.0';

    if (type === 'risks') {
        return [
            `HR AI: Риски дисциплины (${periodTitle})`,
            '',
            `1. Уровень опозданий: ${latePeriodPeople} сотрудников (${lateRate}% от активных).`,
            `2. Ранние уходы: ${earlyPeriodPeople} сотрудников (${earlyRate}% от активных).`,
            '3. Подразделения с наибольшей концентрацией опозданий:',
            topText,
            '',
            'Риск-оценка: при сохранении динамики возможен рост дисциплинарной нагрузки и снижение операционной доступности в пиковые часы.',
        ].join('\n');
    }

    if (type === 'recommendations') {
        return [
            `HR AI: Рекомендации (${periodTitle})`,
            '',
            '1. Назначить точечные встречи с руководителями топ-3 подразделений по опозданиям.',
            '2. Ввести еженедельный контроль сотрудников с повторными нарушениями.',
            '3. Проверить расписание смен и транспортные окна для проблемных групп.',
            '4. Сравнить долю ранних уходов и опозданий по дням недели для корректировки графиков.',
            '5. На следующий период поставить KPI снижения опозданий минимум на 10%.',
            '',
            'Текущие подразделения приоритета:',
            topText,
        ].join('\n');
    }

    return [
        `HR AI: Сводный отчет (${periodTitle})`,
        '',
        `Всего сотрудников: ${employeesTotal}`,
        `Активных сотрудников: ${employeesActive}`,
        `Опоздали за период: ${latePeriodPeople} (${lateRate}%)`,
        `Ушли раньше за период: ${earlyPeriodPeople} (${earlyRate}%)`,
        '',
        'Топ подразделений по опозданиям:',
        topText,
        '',
        'Вывод: рекомендуется фокус на подразделениях из топа и еженедельный мониторинг динамики.',
    ].join('\n');
}

export default function HrDashboard({ summary = {}, series = [], topDivisions = [], divisions = [], filters = {} }) {
    const [division, setDivision] = useState(filters.division ?? '');
    const [days, setDays] = useState(String(filters.days ?? 1));
    const [fromDate, setFromDate] = useState(filters.from ?? '');
    const [selectedDivision, setSelectedDivision] = useState(null);
    const [aiReportText, setAiReportText] = useState('');
    const [aiReportType, setAiReportType] = useState('summary');

    const applyFilters = (overrides = {}) => {
        const params = { division, days, ...overrides };
        if (fromDate) {
            params.from = fromDate;
            delete params.days;
        }
        router.get(
            route('hr.dashboard'),
            params,
            { preserveState: false, preserveScroll: true },
        );
    };

    const handleDivisionChange = (e) => {
        const value = e.target.value;
        setDivision(value);
        applyFilters({ division: value });
    };

    const handleDaysChange = (e) => {
        const value = e.target.value;
        setDays(value);
        setFromDate('');
        applyFilters({ days: value });
    };

    const handleFromDateChange = (e) => {
        const value = e.target.value;
        setFromDate(value);
        applyFilters({ from: value });
    };

    const handleDivisionClick = (divId, divisionName) => {
        router.get(route('hr.division.late.people'), {
            division_id: divId,
            days,
            from: fromDate,
            division_name: divisionName,
        });
    };

    const getToday = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    const openEarlyPeriod = () => {
        const params = { q: '', division, days };
        if (fromDate) {
            params.from = fromDate;
            delete params.days;
        }

        router.get(route('hr.perco.early'), params);
    };

    const openLatePeriod = () => {
        const params = { q: '', division, days };
        if (fromDate) {
            params.from = fromDate;
            delete params.days;
        }

        router.get(route('hr.perco.late'), params);
    };

    const employeesTotal = Number(summary.employees_total ?? 0);
    const employeesActive = Number(summary.employees_active ?? 0);
    const lateTodayPeople = Number(summary.late_today_people ?? 0);
    const earlyTodayPeople = Number(summary.early_today_people ?? 0);
    const latePeriodPeople = Number(summary.late_period_people ?? lateTodayPeople);
    const earlyPeriodPeople = Number(summary.early_period_people ?? earlyTodayPeople);
    const periodLabel = days === '0'
        ? 'Период: все время'
        : days === '-1'
            ? 'Период: вчера'
        : days === '1'
            ? 'Период: сегодня'
            : `Период ${days}д.`;
    const periodTitle = fromDate
        ? `С ${formatDateLabel(fromDate)}`
        : days === '0'
            ? 'За все время'
            : days === '-1'
                ? 'Вчера'
            : days === '1'
                ? 'Сегодня'
                : `За ${days} дней`;

    const summarySegments = [
        { name: 'Все пользователи', value: employeesTotal, color: '#10b981' },
        { name: fromDate || days !== '1' ? 'Ранний выход за период' : 'Ранний выход', value: earlyPeriodPeople, color: '#f59e0b' },
        { name: fromDate || days !== '1' ? 'Опоздали за период' : 'Опоздали сегодня', value: latePeriodPeople, color: '#ef4444' },
    ];

    const todaySegments = [
        { name: fromDate || days !== '1' ? 'Опоздали за период' : 'Опоздали', value: latePeriodPeople, color: '#ef4444' },
        { name: fromDate || days !== '1' ? 'Без опозданий' : 'Вовремя', value: Math.max(employeesActive - latePeriodPeople, 0), color: '#22c55e' },
    ];

    const earlySegments = [
        { name: fromDate || days !== '1' ? 'Ушли раньше за период' : 'Ушли раньше', value: earlyPeriodPeople, color: '#f59e0b' },
        { name: fromDate || days !== '1' ? 'Без раннего ухода' : 'Остались', value: Math.max(employeesActive - earlyPeriodPeople, 0), color: '#22c55e' },
    ];

    const top3 = topDivisions.slice(0, 3).map((row, idx) => ({
        name: row.division,
        value: Number(row.late_people ?? 0),
        color: ['#f97316', '#06b6d4', '#8b5cf6'][idx],
    }));
    const topRest = topDivisions.slice(3).reduce((acc, row) => acc + Number(row.late_people ?? 0), 0);
    if (topRest > 0) {
        top3.push({ name: 'Остальные', value: topRest, color: '#9ca3af' });
    }
    const topTotal = top3.reduce((acc, row) => acc + row.value, 0);

    const generateAiReport = (type = 'summary') => {
        setAiReportType(type);
        setAiReportText(buildAiReportText(type, {
            employeesTotal,
            employeesActive,
            latePeriodPeople,
            earlyPeriodPeople,
            periodTitle,
            topDivisions,
        }));
    };

    const copyAiReport = async () => {
        if (!aiReportText) return;
        try {
            await navigator.clipboard.writeText(aiReportText);
        } catch {
            // Ignore clipboard failures in unsupported browsers.
        }
    };

    const downloadAiReport = () => {
        if (!aiReportText) return;

        const blob = new Blob([aiReportText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `hr-ai-report-${aiReportType}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExport = () => {
        const summaryRows = [
            { metric: 'Всего сотрудников', value: employeesTotal },
            { metric: 'Активных сотрудников', value: employeesActive },
            { metric: 'Опоздавшие', value: latePeriodPeople },
            { metric: 'Ушли раньше', value: earlyPeriodPeople },
            { metric: 'Период', value: periodTitle },
        ];

        const divisionRows = topDivisions.map((row, idx) => ({
            rank: idx + 1,
            division: row.division,
            late_events: row.late_events,
            late_people: row.late_people,
        }));

        exportToExcelCsv({
            fileName: 'hr_dashboard.csv',
            columns: [
                { header: 'Раздел', getValue: (row) => row.section },
                { header: 'Показатель', getValue: (row) => row.metric },
                { header: 'Значение', getValue: (row) => row.value },
                { header: 'Место', getValue: (row) => row.rank },
                { header: 'Подразделение', getValue: (row) => row.division },
                { header: 'События опозданий', getValue: (row) => row.late_events },
                { header: 'Опоздавших сотрудников', getValue: (row) => row.late_people },
            ],
            rows: [
                ...summaryRows.map((row) => ({ section: 'Сводка', ...row })),
                ...divisionRows.map((row) => ({ section: 'Подразделения', ...row })),
            ],
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="HR / Dashboard" />

            <div className="space-y-4 p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <select
                        value={division}
                        onChange={handleDivisionChange}
                        className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Все подразделения</option>
                        {divisions.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={days}
                        onChange={handleDaysChange}
                        className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="1">Сегодня</option>
                           <option value="-1">Вчера</option>
                        <option value="7">За 7 дней</option>
                        <option value="14">За 14 дней</option>
                        <option value="30">За 30 дней</option>
                        <option value="0">За все время</option>
                    </select>

                    <input
                        type="date"
                        value={fromDate}
                        onChange={handleFromDateChange}
                        className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                        <Download className="mr-1 h-4 w-4" />
                        Экспорт в Excel
                    </Button>
                </div>

                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-slate-900">HR Dashboard</h1>
                    <p className="text-sm text-slate-600 mt-1">Аналитика по опозданиям и персоналу</p>
                </div>

                <Card className="border border-slate-200 bg-white shadow-sm mb-6">
                    <CardHeader className="pb-3 border-b border-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                    <Bot className="h-4 w-4 text-blue-600" />
                                    ИИ помощник HR
                                </CardTitle>
                                <p className="text-sm text-slate-500 mt-1">Формирование готовых отчетов и выводов в один клик.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" size="sm" onClick={() => generateAiReport('summary')}>
                                    <Sparkles className="mr-1 h-4 w-4" />
                                    Сводный отчет
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => generateAiReport('risks')}>
                                    <AlertCircle className="mr-1 h-4 w-4" />
                                    Риски
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => generateAiReport('recommendations')}>
                                    <BarChart3 className="mr-1 h-4 w-4" />
                                    Рекомендации
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {aiReportText ? (
                            <>
                                <textarea
                                    value={aiReportText}
                                    onChange={(e) => setAiReportText(e.target.value)}
                                    className="min-h-[220px] w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap"
                                />
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Button type="button" size="sm" variant="outline" onClick={copyAiReport}>
                                        <Copy className="mr-1 h-4 w-4" />
                                        Копировать
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" onClick={downloadAiReport}>
                                        <FileDown className="mr-1 h-4 w-4" />
                                        Скачать TXT
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                                Нажмите одну из кнопок выше — помощник сформирует отчет автоматически.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                    <Link href={route('hr.perco.timetracking')} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <DonutCard
                            title="Состояние сотрудников" 
                            segments={summarySegments} 
                            total={employeesTotal}
                            donut={true}
                        />
                    </Link>
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={openLatePeriod}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openLatePeriod();
                            }
                        }}
                        className="cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        title="Открыть список опоздавших за выбранный период"
                    >
                        <DonutCard 
                            title={periodTitle} 
                            segments={todaySegments} 
                            total={Math.max(employeesActive, 1)}
                            donut={true}
                            onSegmentClick={(segment) => {
                                if (String(segment.name).includes('Опоздали')) {
                                    openLatePeriod();
                                }
                            }}
                        />
                    </div>
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={openEarlyPeriod}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openEarlyPeriod();
                            }
                        }}
                        className="cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        title="Открыть список ушедших раньше за выбранный период"
                    >
                        <DonutCard
                            title={`Ушли раньше • ${periodTitle.toLowerCase()}`}
                            segments={earlySegments}
                            total={Math.max(employeesActive, 1)}
                            donut={true}
                            onSegmentClick={(segment) => {
                                if (String(segment.name).includes('Ушли раньше')) {
                                    openEarlyPeriod();
                                }
                            }}
                        />
                    </div>
                    <DonutCard 
                        title={`Топ подразделения • ${formatDate(summary.latest_late_date)}`}
                        segments={top3}
                        total={Math.max(topTotal, 1)}
                        donut={true}
                    />
                </div>

                <Card className="border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="pb-3 border-b border-slate-200">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-base font-semibold text-slate-900">Все подразделения по опозданиям</CardTitle>
                            <span className="text-sm font-medium text-slate-500">Количество опоздавших пользователей</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {topDivisions.length === 0 ? (
                            <p className="text-sm text-slate-500 py-4">Нет данных за выбранный период.</p>
                        ) : (
                            <div className="space-y-2 py-3">
                                {topDivisions.map((row, idx) => (
                                    <div 
                                        key={`${row.division}-${idx}`}
                                        onClick={() => row.division_id && handleDivisionClick(row.division_id, row.division)}
                                        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-100 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <div 
                                                className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                                                style={{
                                                    background: idx < 3 
                                                        ? ['#f97316', '#06b6d4', '#8b5cf6'][idx] 
                                                        : '#9ca3af'
                                                }}
                                            >
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-slate-900 truncate group-hover:underline">{row.division}</p>
                                                <p className="text-xs text-slate-500">{row.late_events} событий • {row.late_people} сотр.</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-slate-900">{row.late_events}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
