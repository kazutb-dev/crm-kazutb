import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DarkPanel, FilterBar, FormField, PageHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, Link, router } from '@inertiajs/react';
import { AlertCircle, BarChart3, Bot, Copy, Download, FileDown, LogOut, Sparkles, TrendingDown, Users } from 'lucide-react';
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
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#E8EEEC"
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
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize="17" fontWeight="700" fill="#102945" style={{ fontFamily: 'var(--font-display, Literata, serif)' }}>
                    {percent}%
                </text>
            </svg>
        </div>
    );
}

function DonutCard({ title, segments, total, donut = true, onSegmentClick = null, interactive = false }) {
    return (
        <Card className={`h-full ${interactive ? 'transition-colors hover:border-teal-300' : ''}`}>
            <CardHeader>
                <CardTitle className="truncate">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {donut ? (
                    <div className="flex items-center gap-4">
                        <Donut segments={segments} total={total} />
                        <div className="flex-1 space-y-1 text-xs">
                            {segments.map((segment) => (
                                <div
                                    key={segment.name}
                                    className={`flex items-center justify-between gap-2 border-b border-slate-100 py-1 last:border-b-0 ${onSegmentClick ? 'cursor-pointer rounded-[6px] px-1 hover:bg-slate-50' : ''}`}
                                    onClick={() => onSegmentClick && onSegmentClick(segment)}
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                                        <span className="truncate font-medium text-slate-600">{segment.name}</span>
                                    </div>
                                    <strong className="tabular-nums text-[#102945]">{segment.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5 text-xs">
                        {segments.map((segment) => (
                            <div key={segment.name} className="flex items-center justify-between gap-2">
                                <span className="font-medium text-slate-600">{segment.name}</span>
                                <strong className="tabular-nums text-[#102945]">{segment.value}</strong>
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
        { name: 'Все пользователи', value: employeesTotal, color: '#3fb57a' },
        { name: fromDate || days !== '1' ? 'Ранний выход за период' : 'Ранний выход', value: earlyPeriodPeople, color: '#e2b53e' },
        { name: fromDate || days !== '1' ? 'Опоздали за период' : 'Опоздали сегодня', value: latePeriodPeople, color: '#d64540' },
    ];

    const todaySegments = [
        { name: fromDate || days !== '1' ? 'Опоздали за период' : 'Опоздали', value: latePeriodPeople, color: '#d64540' },
        { name: fromDate || days !== '1' ? 'Без опозданий' : 'Вовремя', value: Math.max(employeesActive - latePeriodPeople, 0), color: '#3fb57a' },
    ];

    const earlySegments = [
        { name: fromDate || days !== '1' ? 'Ушли раньше за период' : 'Ушли раньше', value: earlyPeriodPeople, color: '#e2b53e' },
        { name: fromDate || days !== '1' ? 'Без раннего ухода' : 'Остались', value: Math.max(employeesActive - earlyPeriodPeople, 0), color: '#3fb57a' },
    ];

    const top3 = topDivisions.slice(0, 3).map((row, idx) => ({
        name: row.division,
        value: Number(row.late_people ?? 0),
        color: ['#d9853f', '#09bab2', '#2c5a86'][idx],
    }));
    const topRest = topDivisions.slice(3).reduce((acc, row) => acc + Number(row.late_people ?? 0), 0);
    if (topRest > 0) {
        top3.push({ name: 'Остальные', value: topRest, color: '#9AA8A4' });
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

    const RANK_STYLES = [
        'bg-amber-400 text-[#102945]',
        'bg-slate-200 text-[#102945]',
        'bg-orange-200 text-orange-900',
    ];

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="HR · Учёт рабочего времени"
                    title="HR Dashboard"
                    description="Аналитика по опозданиям и персоналу"
                    meta={<StatusBadge tone="info">{periodTitle}</StatusBadge>}
                    actions={(
                        <Button type="button" variant="outline" onClick={handleExport}>
                            <Download className="h-4 w-4" />
                            Экспорт в Excel
                        </Button>
                    )}
                />
            )}
        >
            <Head title="HR / Dashboard" />

            <div className="admin-page-wrap space-y-6">
                <FilterBar>
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                        <FormField label="Подразделение">
                            <select
                                value={division}
                                onChange={handleDivisionChange}
                                className={qdFieldClass}
                            >
                                <option value="">Все подразделения</option>
                                {divisions.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Период">
                            <select
                                value={days}
                                onChange={handleDaysChange}
                                className={qdFieldClass}
                            >
                                <option value="1">Сегодня</option>
                                <option value="-1">Вчера</option>
                                <option value="7">За 7 дней</option>
                                <option value="14">За 14 дней</option>
                                <option value="30">За 30 дней</option>
                                <option value="0">За все время</option>
                            </select>
                        </FormField>

                        <FormField label="С даты" hint="Если указана, заменяет период">
                            <input
                                type="date"
                                value={fromDate}
                                onChange={handleFromDateChange}
                                className={qdFieldClass}
                            />
                        </FormField>
                    </div>
                </FilterBar>

                <StatGrid>
                    <StatTile label="Всего сотрудников" value={employeesTotal} tone="navy" icon={Users} />
                    <StatTile label="Активных" value={employeesActive} tone="teal" icon={Users} />
                    <button type="button" onClick={openLatePeriod} className="block rounded-[14px] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40" title="Открыть список опоздавших за выбранный период">
                        <StatTile label="Опоздали" value={latePeriodPeople} tone="danger" icon={TrendingDown} hint={periodTitle} />
                    </button>
                    <button type="button" onClick={openEarlyPeriod} className="block rounded-[14px] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40" title="Открыть список ушедших раньше за выбранный период">
                        <StatTile label="Ушли раньше" value={earlyPeriodPeople} tone="gold" icon={LogOut} hint={periodTitle} />
                    </button>
                </StatGrid>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Link href={route('hr.perco.timetracking')} className="block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40">
                        <DonutCard
                            title="Состояние сотрудников"
                            segments={summarySegments}
                            total={employeesTotal}
                            donut={true}
                            interactive
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
                        className="cursor-pointer rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
                        title="Открыть список опоздавших за выбранный период"
                    >
                        <DonutCard
                            title={periodTitle}
                            segments={todaySegments}
                            total={Math.max(employeesActive, 1)}
                            donut={true}
                            interactive
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
                        className="cursor-pointer rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
                        title="Открыть список ушедших раньше за выбранный период"
                    >
                        <DonutCard
                            title={`Ушли раньше • ${periodTitle.toLowerCase()}`}
                            segments={earlySegments}
                            total={Math.max(employeesActive, 1)}
                            donut={true}
                            interactive
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

                <DarkPanel
                    kicker="ИИ помощник HR"
                    title="Готовые отчёты и выводы в один клик"
                    actions={(
                        <>
                            <Button type="button" onClick={() => generateAiReport('summary')}>
                                <Sparkles className="h-4 w-4" />
                                Сводный отчет
                            </Button>
                            <Button type="button" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => generateAiReport('risks')}>
                                <AlertCircle className="h-4 w-4" />
                                Риски
                            </Button>
                            <Button type="button" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => generateAiReport('recommendations')}>
                                <BarChart3 className="h-4 w-4" />
                                Рекомендации
                            </Button>
                        </>
                    )}
                >
                    Формирование готовых отчетов и выводов в один клик. Нажмите одну из кнопок — помощник сформирует отчет автоматически по выбранному периоду и подразделению.
                </DarkPanel>

                {aiReportText && (
                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <CardTitle className="flex items-center gap-2">
                                    <Bot className="shrink-0" />
                                    Отчёт ИИ помощника
                                </CardTitle>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" size="sm" variant="outline" onClick={copyAiReport}>
                                        <Copy className="h-4 w-4" />
                                        Копировать
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" onClick={downloadAiReport}>
                                        <FileDown className="h-4 w-4" />
                                        Скачать TXT
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <textarea
                                value={aiReportText}
                                onChange={(e) => setAiReportText(e.target.value)}
                                className={`${qdFieldClass} h-auto min-h-[240px] whitespace-pre-wrap py-3 leading-relaxed`}
                            />
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="shrink-0" />
                                Все подразделения по опозданиям
                            </CardTitle>
                            <span className="text-xs font-medium text-slate-500">Количество опоздавших пользователей</span>
                        </div>
                    </CardHeader>
                    <CardContent className={topDivisions.length === 0 ? '' : 'p-0 sm:p-0'}>
                        {topDivisions.length === 0 ? (
                            <p className="py-12 text-center text-sm text-slate-500">Нет данных за выбранный период.</p>
                        ) : (
                            <div className="divide-y divide-slate-200">
                                {topDivisions.map((row, idx) => (
                                    <div
                                        key={`${row.division}-${idx}`}
                                        onClick={() => row.division_id && handleDivisionClick(row.division_id, row.division)}
                                        className="group flex cursor-pointer items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50 sm:px-6"
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-4">
                                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${RANK_STYLES[idx] ?? 'bg-slate-100 text-slate-600'}`}>
                                                {idx + 1}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-slate-900 group-hover:text-teal-700">{row.division}</p>
                                                <p className="text-xs tabular-nums text-slate-500">{row.late_events} событий • {row.late_people} сотр.</p>
                                            </div>
                                        </div>
                                        <p className="font-display text-xl font-bold tabular-nums text-[#102945]">{row.late_events}</p>
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
