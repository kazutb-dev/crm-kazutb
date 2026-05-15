import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';

const statusColors = {
    approved: '#10b981',
    submitted: '#3b82f6',
    draft: '#94a3b8',
    returned: '#f59e0b',
    rejected: '#ef4444',
    pending_dean: '#8b5cf6',
    pending_structural: '#06b6d4',
    locked: '#374151',
};

const statusLabels = {
    approved: 'Одобрено',
    submitted: 'На рассмотрении',
    draft: 'Черновик',
    returned: 'Возвращено',
    rejected: 'Отклонено',
    pending_dean: 'У декана',
    pending_structural: 'У структурного',
    locked: 'Заблокировано',
};

const entityLabels = {
    teacher: 'Преподаватель',
    department_head: 'Завед. кафедрой',
    dean: 'Декан',
    structural_division: 'Структурные',
};

const roleLabels = {
    admin: 'Администратор',
    superadmin: 'Суперадмин',
    dean: 'Декан',
    hod: 'Завед. кафедрой',
    department_head: 'Завед. кафедрой',
    teacher: 'Преподаватель',
    department: 'Структурное',
    student: 'Студент',
};

function formatDate(value) {
    if (!value) {
        return 'Нет данных';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatTime(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

export default function Dashboard({
    stats = {},
    usersByRole = [],
    usersByFaculty = [],
    kpiByStatus = [],
    kpiByMonth = [],
    usersByDept = [],
    loginActivity = [],
    kpiByEntityType = [],
    topUsers = [],
    syncStats = { synced: 0, not_synced: 0 },
    kpiByFaculty = [],
    kpiByDepartment = [],
    userGrowth = [],
    kpiPeriods = [],
    studentsByFaculty = [],
    warnings = { hod_no_dept: 0, dean_no_faculty: 0, structural_no_div: 0 },
    metrics_generated_at = null,
    metrics_source = 'database',
}) {
    const currentDate = new Date().toLocaleDateString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const statCards = [
        {
            label: 'Всего сотрудников',
            value: stats.total_users ?? stats.total_staff_ad ?? 399,
            icon: '👥',
            color: 'from-[#1e3a5f] to-[#2d5a9e]',
            sub: `${stats.total_teachers ?? 0} препод. + ${stats.total_hod ?? 0} завкаф + ${stats.total_dean ?? 0} деканов`,
        },
        {
            label: 'Студентов',
            value: stats.total_students || '979',
            icon: '🎓',
            color: 'from-[#0ea5e9] to-[#0284c7]',
            sub: 'Бакалавры + Магистры',
        },
        {
            label: 'KPI записей',
            value: stats.kpi_total ?? 0,
            icon: '📋',
            color: 'from-[#8b5cf6] to-[#7c3aed]',
            sub: `${stats.kpi_pending ?? 0} на рассмотрении`,
        },
        {
            label: 'Одобрено KPI',
            value: stats.kpi_approved ?? 0,
            icon: '✅',
            color: 'from-[#10b981] to-[#059669]',
            sub: `из ${stats.kpi_total ?? 0} записей`,
        },
        {
            label: 'Факультеты',
            value: stats.faculties ?? 0,
            icon: '🏛️',
            color: 'from-[#f59e0b] to-[#d97706]',
            sub: `${stats.departments ?? 0} кафедр`,
        },
        {
            label: 'Деканы / ЗавКаф',
            value: (stats.total_dean ?? 0) + (stats.total_hod ?? 0),
            icon: '🎯',
            color: 'from-[#ef4444] to-[#dc2626]',
            sub: `${stats.total_dean ?? 0} деканов, ${stats.total_hod ?? 0} завкаф`,
        },
    ];

    const filledLoginActivity =
        loginActivity.length > 0
            ? loginActivity
            : Array.from({ length: 30 }).map((_, index) => {
                const date = new Date();
                date.setDate(date.getDate() - (29 - index));

                return {
                    date: date.toISOString().slice(0, 10),
                    logins: 0,
                };
            });

    const allLoginZero = filledLoginActivity.every((d) => Number(d.logins ?? 0) === 0);
    const allKpiByMonthZero = kpiByMonth.every((m) => Number(m.count ?? 0) === 0);
    const maxLoginValue = Math.max(
        ...filledLoginActivity.map((d) => Number(d.logins) || 0),
        5,
    );
    const sourceLabel = metrics_source === 'cached-from-users' ? 'cached' : metrics_source;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                            Панель управления
                        </h2>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{currentDate}</span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                {sourceLabel}
                            </span>
                        </div>
                        <div className="text-xs text-gray-400">
                            Обновлено: {formatTime(metrics_generated_at)}
                        </div>
                    </div>
                </div>
            }
        >
            <Head title="Панель управления" />

            <div className="min-h-full bg-gray-50">
                <div className="admin-page-wrap">
                    <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                        {statCards.map((card) => (
                            <div
                                key={card.label}
                                className={`relative cursor-default overflow-hidden rounded-2xl bg-gradient-to-br ${card.color} p-6 text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-white/70">{card.label}</p>
                                        <p className="mt-1 text-4xl font-bold tracking-tight">{card.value}</p>
                                        <p className="mt-2 text-xs text-white/60">{card.sub}</p>
                                    </div>
                                    <span className="text-4xl opacity-80">{card.icon}</span>
                                </div>
                                <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10 blur-xl" />
                            </div>
                        ))}
                    </section>

                    <section className="rounded-2xl border border-gray-100 bg-white px-5 py-3 shadow-sm">
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                                Сотрудников: {stats.total_users ?? 0}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                                Студентов: {stats.total_students ?? 0}
                            </span>
                            <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
                                Деканов: {stats.total_dean ?? 0}
                            </span>
                            <span className="rounded-full bg-cyan-50 px-3 py-1 font-medium text-cyan-700">
                                Завкаф: {stats.total_hod ?? 0}
                            </span>
                            <span className="ml-auto text-xs text-gray-400">
                                Источник данных: <span className="font-semibold text-gray-600">{sourceLabel}</span>
                            </span>
                        </div>
                    </section>

                    {(warnings.hod_no_dept > 0 || warnings.dean_no_faculty > 0 || warnings.structural_no_div > 0) && (
                        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                            <div className="mb-3 flex items-center gap-2">
                                <span className="text-xl">⚠️</span>
                                <h3 className="text-base font-semibold text-amber-800">
                                    Требует внимания администратора
                                </h3>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {warnings.hod_no_dept > 0 && (
                                    <a href="/users?tab=hod" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 transition-colors hover:bg-amber-50">
                                        <span className="text-2xl font-bold text-amber-600">{warnings.hod_no_dept}</span>
                                        <span className="text-sm text-amber-700">Завкаф без кафедры</span>
                                    </a>
                                )}
                                {warnings.dean_no_faculty > 0 && (
                                    <a href="/users?tab=dean" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 transition-colors hover:bg-amber-50">
                                        <span className="text-2xl font-bold text-amber-600">{warnings.dean_no_faculty}</span>
                                        <span className="text-sm text-amber-700">Деканов без факультета</span>
                                    </a>
                                )}
                                {warnings.structural_no_div > 0 && (
                                    <a href="/users?tab=structural" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 transition-colors hover:bg-amber-50">
                                        <span className="text-2xl font-bold text-amber-600">{warnings.structural_no_div}</span>
                                        <span className="text-sm text-amber-700">Структурных без подразделения</span>
                                    </a>
                                )}
                            </div>
                        </section>
                    )}

                    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900">KPI по месяцам</h3>
                        <p className="mb-4 text-sm text-gray-400">Последние 12 месяцев</p>
                        <BarChart
                            dataset={kpiByMonth.map((m) => ({
                                month: m.month,
                                count: m.count,
                            }))}
                            xAxis={[{ scaleType: 'band', dataKey: 'month', label: 'Месяц' }]}
                            series={[
                                {
                                    dataKey: 'count',
                                    label: 'KPI записей',
                                    color: '#1e3a5f',
                                },
                            ]}
                            height={300}
                            borderRadius={6}
                        />
                        {allKpiByMonthZero && (
                            <p className="mt-2 text-xs text-gray-400">KPI записи появятся после начала первого периода</p>
                        )}
                    </section>

                    {kpiPeriods.length > 0 && (
                        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="mb-1 text-lg font-semibold text-gray-900">KPI Периоды</h3>
                            <p className="mb-4 text-sm text-gray-400">Последние 5 периодов сбора</p>
                            <div className="space-y-3">
                                {kpiPeriods.map((period, i) => (
                                    <div key={i} className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50 p-4 transition-colors hover:bg-gray-100">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                {period.is_active && (
                                                    <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                                        🟢 Активный
                                                    </span>
                                                )}
                                                <span className="text-sm font-medium text-gray-900">{period.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <span>{period.start} — {period.end}</span>
                                                <span className="font-semibold text-gray-700">{period.total} записей</span>
                                            </div>
                                        </div>
                                        {period.total > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                                                    <div
                                                        className="h-full rounded-full bg-emerald-500 transition-all"
                                                        style={{ width: `${period.rate}%` }}
                                                    />
                                                </div>
                                                <span className="w-12 text-right text-xs font-semibold text-emerald-600">
                                                    {period.rate}%
                                                </span>
                                                <span className="text-xs text-gray-400">одобрено</span>
                                            </div>
                                        )}
                                        <div className="flex gap-4 text-xs">
                                            <span className="text-emerald-600">✅ {period.approved} одобрено</span>
                                            <span className="text-blue-600">⏳ {period.pending} на рассмотрении</span>
                                            <span className="text-gray-400">📝 {period.total - period.approved - period.pending} в черновике</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900">KPI по статусам</h3>
                            <p className="mb-4 text-sm text-gray-400">Распределение текущих статусов</p>
                            {kpiByStatus.length > 0 ? (
                                <PieChart
                                    series={[
                                        {
                                            data: kpiByStatus.map((s, i) => ({
                                                id: i,
                                                value: s.count,
                                                label: statusLabels[s.status] || s.status,
                                                color: statusColors[s.status] || '#94a3b8',
                                            })),
                                            innerRadius: 50,
                                            outerRadius: 110,
                                            paddingAngle: 3,
                                            cornerRadius: 5,
                                            highlightScope: {
                                                faded: 'global',
                                                highlighted: 'item',
                                            },
                                        },
                                    ]}
                                    height={280}
                                />
                            ) : (
                                <>
                                    <h4 className="mb-5 text-base font-semibold text-gray-800">Готовность к KPI</h4>
                                    <div className="space-y-4">
                                        {[
                                            { label: 'Преподавателей', total: stats.total_teachers ?? 0, color: 'bg-blue-500' },
                                            { label: 'Завед. кафедрой', total: stats.total_hod ?? 0, color: 'bg-amber-500' },
                                            { label: 'Деканов', total: stats.total_dean ?? 0, color: 'bg-purple-500' },
                                            { label: 'Структурных', total: stats.total_structural ?? 0, color: 'bg-teal-500' },
                                        ].map((item, i) => (
                                            <div key={i}>
                                                <div className="mb-1 flex justify-between text-sm">
                                                    <span className="font-medium text-gray-700">{item.label}</span>
                                                    <span className="text-gray-400">{item.total} чел.</span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                                    <div
                                                        className={`h-full rounded-full ${item.color}`}
                                                        style={{ width: item.total > 0 ? '100%' : '0%' }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-6 border-t border-gray-100 pt-4 text-center text-xs text-gray-400">
                                        KPI статистика появится после создания первого периода
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900">Сотрудники по факультетам</h3>
                            <p className="mb-4 text-sm text-gray-400">Распределение по факультетам</p>
                            {usersByFaculty.length > 0 ? (
                                <BarChart
                                    dataset={usersByFaculty.map((f) => ({
                                        faculty: f.faculty,
                                        count: f.count,
                                    }))}
                                    yAxis={[{ scaleType: 'band', dataKey: 'faculty', tickLabelStyle: { fontSize: 10 } }]}
                                    series={[
                                        {
                                            dataKey: 'count',
                                            label: 'Сотрудников',
                                            color: '#0ea5e9',
                                            valueFormatter: (v) => `${v} чел.`,
                                        },
                                    ]}
                                    layout="horizontal"
                                    height={300}
                                    borderRadius={6}
                                />
                            ) : (
                                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                                    <p className="mb-3 text-sm font-medium text-gray-700">Распределение по ролям</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: 'Преподаватели', value: stats.total_teachers ?? 0, color: 'bg-blue-50 text-blue-700', icon: '👨‍🏫' },
                                            { label: 'Деканат', value: stats.total_dean ?? 0, color: 'bg-purple-50 text-purple-700', icon: '🏛️' },
                                            { label: 'Завед. кафедрой', value: stats.total_hod ?? 0, color: 'bg-amber-50 text-amber-700', icon: '📚' },
                                            { label: 'Структурные', value: stats.total_structural ?? 0, color: 'bg-teal-50 text-teal-700', icon: '🏢' },
                                        ].map((item, i) => (
                                            <div key={i} className={`flex items-center gap-3 rounded-xl p-4 ${item.color}`}>
                                                <span className="text-2xl">{item.icon}</span>
                                                <div>
                                                    <p className="text-2xl font-bold">{item.value}</p>
                                                    <p className="text-xs opacity-80">{item.label}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {kpiByFaculty.length > 0 && (
                        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900">KPI по факультетам</h3>
                            <p className="mb-4 text-sm text-gray-400">Одобрено vs На рассмотрении vs Черновик</p>
                            <BarChart
                                dataset={kpiByFaculty.map((f) => ({
                                    faculty: f.faculty.length > 18
                                        ? `${f.faculty.substring(0, 18)}…`
                                        : f.faculty,
                                    approved: f.approved,
                                    pending: f.pending,
                                    draft: f.draft,
                                }))}
                                xAxis={[{ scaleType: 'band', dataKey: 'faculty' }]}
                                series={[
                                    { dataKey: 'approved', label: 'Одобрено', color: '#10b981', stack: 'kpi' },
                                    { dataKey: 'pending', label: 'На рассмотрении', color: '#3b82f6', stack: 'kpi' },
                                    { dataKey: 'draft', label: 'Черновик', color: '#e2e8f0', stack: 'kpi' },
                                ]}
                                height={300}
                                borderRadius={6}
                            />
                        </section>
                    )}

                    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900">Активность входов за 30 дней</h3>
                        <p className="mb-4 text-sm text-gray-400">Динамика авторизаций сотрудников</p>
                        <LineChart
                            dataset={filledLoginActivity.map((d) => ({
                                date: d.date,
                                logins: Number(d.logins),
                            }))}
                            xAxis={[
                                {
                                    scaleType: 'band',
                                    dataKey: 'date',
                                    tickLabelStyle: { fontSize: 10 },
                                    tickNumber: 5,
                                },
                            ]}
                            yAxis={[{ min: 0, max: maxLoginValue, tickNumber: 5 }]}
                            series={[
                                {
                                    dataKey: 'logins',
                                    label: 'Входов',
                                    color: '#10b981',
                                    area: true,
                                    showMark: false,
                                    valueFormatter: (v) => `${v} входов`,
                                },
                            ]}
                            height={250}
                        />
                        {allLoginZero && (
                            <p className="mt-2 text-xs text-gray-400">Входы появятся после первых авторизаций</p>
                        )}
                    </section>

                    {userGrowth.length > 0 && (
                        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900">📈 Рост базы сотрудников</h3>
                            <p className="mb-4 text-sm text-gray-400">Новые записи за последние 12 месяцев</p>
                            <LineChart
                                dataset={userGrowth.map((d) => ({
                                    month: d.month,
                                    count: d.count,
                                }))}
                                xAxis={[{ scaleType: 'band', dataKey: 'month', tickLabelStyle: { fontSize: 10 } }]}
                                yAxis={[{ min: 0 }]}
                                series={[
                                    {
                                        dataKey: 'count',
                                        label: 'Новых сотрудников',
                                        color: '#8b5cf6',
                                        area: true,
                                        showMark: true,
                                    },
                                ]}
                                height={240}
                            />
                        </section>
                    )}

                    <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900">Синхронизация с AD</h3>
                            <p className="mb-2 text-sm text-gray-400">Источник учетных записей</p>
                            <div className="flex items-center justify-center">
                                <PieChart
                                    series={[
                                        {
                                            data: [
                                                {
                                                    id: 0,
                                                    value: syncStats.synced,
                                                    label: `Из AD (${syncStats.synced})`,
                                                    color: '#10b981',
                                                },
                                                {
                                                    id: 1,
                                                    value: syncStats.not_synced,
                                                    label: `Локальные (${syncStats.not_synced})`,
                                                    color: '#94a3b8',
                                                },
                                            ],
                                            innerRadius: 55,
                                            outerRadius: 100,
                                            paddingAngle: 4,
                                            cornerRadius: 6,
                                        },
                                    ]}
                                    width={340}
                                    height={240}
                                />
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-emerald-600">{syncStats.synced}</p>
                                    <p className="text-xs text-gray-400">Из Active Directory</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-400">{syncStats.not_synced}</p>
                                    <p className="text-xs text-gray-400">Локальных аккаунтов</p>
                                </div>
                            </div>
                            <div className="mt-3 rounded-xl bg-gray-50 px-4 py-2 text-xs text-gray-500">
                                Источник данных: <span className="font-semibold text-gray-700">{sourceLabel}</span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            {kpiByEntityType.length > 0 ? (
                                <>
                                    <h3 className="text-lg font-semibold text-gray-900">KPI по типу сотрудника</h3>
                                    <p className="mb-4 text-sm text-gray-400">Типы сущностей KPI</p>
                                    <BarChart
                                        dataset={kpiByEntityType.map((e) => ({
                                            type: entityLabels[e.entity_type] || e.entity_type,
                                            count: e.count,
                                        }))}
                                        xAxis={[{ scaleType: 'band', dataKey: 'type' }]}
                                        series={[
                                            {
                                                dataKey: 'count',
                                                label: 'KPI записей',
                                                color: '#8b5cf6',
                                            },
                                        ]}
                                        height={260}
                                        borderRadius={6}
                                    />
                                </>
                            ) : (
                                <>
                                    <h3 className="text-lg font-semibold text-gray-900">Роли сотрудников</h3>
                                    <p className="mb-4 text-sm text-gray-400">Распределение по должностям</p>
                                    <div className="mt-2 grid grid-cols-2 gap-3">
                                        {[
                                            { label: 'Преподаватели', value: stats.total_teachers ?? 0, color: 'bg-blue-50 text-blue-700', icon: '👨‍🏫' },
                                            { label: 'Деканат', value: stats.total_dean ?? 0, color: 'bg-purple-50 text-purple-700', icon: '🏛️' },
                                            { label: 'Завед. кафедрой', value: stats.total_hod ?? 0, color: 'bg-amber-50 text-amber-700', icon: '📚' },
                                            { label: 'Структурные', value: stats.total_structural ?? 0, color: 'bg-teal-50 text-teal-700', icon: '🏢' },
                                        ].map((item, i) => (
                                            <div key={i} className={`flex items-center gap-3 rounded-xl p-4 ${item.color}`}>
                                                <span className="text-2xl">{item.icon}</span>
                                                <div>
                                                    <p className="text-2xl font-bold">{item.value}</p>
                                                    <p className="text-xs opacity-80">{item.label}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-center text-xs text-gray-400">
                                        KPI данные появятся после начала первого периода
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    {studentsByFaculty.length > 0 && (
                        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-900">Студенты по факультетам</h3>
                                <p className="mb-4 text-sm text-gray-400">Распределение {stats.total_students ?? 979} студентов</p>
                                <PieChart
                                    series={[
                                        {
                                            data: studentsByFaculty.map((f, i) => ({
                                                id: i,
                                                value: f.count,
                                                label: f.faculty.length > 22
                                                    ? `${f.faculty.substring(0, 22)}…`
                                                    : f.faculty,
                                                color: ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'][i % 5],
                                            })),
                                            innerRadius: 45,
                                            outerRadius: 100,
                                            paddingAngle: 3,
                                            cornerRadius: 5,
                                            highlightScope: { faded: 'global', highlighted: 'item' },
                                        },
                                    ]}
                                    height={260}
                                />
                            </div>
                        </section>
                    )}

                    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900">KPI по кафедрам</h3>
                        <p className="mb-4 text-sm text-gray-400">Топ-10 кафедр по числу записей</p>
                        {kpiByDepartment.length > 0 ? (
                            <BarChart
                                dataset={kpiByDepartment.map((d) => ({
                                    dept: d.dept,
                                    total: d.total,
                                    approved: d.approved,
                                }))}
                                yAxis={[{ scaleType: 'band', dataKey: 'dept', tickLabelStyle: { fontSize: 10 } }]}
                                series={[
                                    { dataKey: 'total', label: 'Всего', color: '#e0e7ff', stack: 'dept' },
                                    { dataKey: 'approved', label: 'Одобрено', color: '#6366f1', stack: 'dept' },
                                ]}
                                layout="horizontal"
                                height={340}
                                borderRadius={4}
                            />
                        ) : (
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                                <p className="mb-3 text-sm font-medium text-gray-700">Кафедральная активность</p>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <div className="rounded-xl bg-indigo-50 p-4 text-indigo-700">
                                        <p className="text-xs">Записей KPI</p>
                                        <p className="text-2xl font-bold">{stats.kpi_total ?? 0}</p>
                                    </div>
                                    <div className="rounded-xl bg-emerald-50 p-4 text-emerald-700">
                                        <p className="text-xs">Одобрено</p>
                                        <p className="text-2xl font-bold">{stats.kpi_approved ?? 0}</p>
                                    </div>
                                    <div className="rounded-xl bg-blue-50 p-4 text-blue-700">
                                        <p className="text-xs">На проверке</p>
                                        <p className="text-2xl font-bold">{stats.kpi_pending ?? 0}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-100 p-4 text-slate-700">
                                        <p className="text-xs">Черновики</p>
                                        <p className="text-2xl font-bold">{stats.kpi_draft ?? 0}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-lg font-semibold text-gray-900">🏆 Топ-10 активных пользователей</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="py-2 text-left text-xs font-medium uppercase text-gray-400">#</th>
                                        <th className="py-2 text-left text-xs font-medium uppercase text-gray-400">ФИО</th>
                                        <th className="py-2 text-left text-xs font-medium uppercase text-gray-400">Роль</th>
                                        <th className="py-2 text-left text-xs font-medium uppercase text-gray-400">Входов</th>
                                        <th className="py-2 text-left text-xs font-medium uppercase text-gray-400">Последний вход</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topUsers.length > 0 ? (
                                        topUsers.map((user, i) => (
                                            <tr
                                                key={`${user.name}-${i}`}
                                                className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                                            >
                                                <td className="py-3 text-sm text-gray-400">{i + 1}</td>
                                                <td className="py-3 text-sm font-medium text-gray-900">{user.name}</td>
                                                <td className="py-3">
                                                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                                        {roleLabels[user.role] || user.role}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-sm font-semibold text-gray-900">
                                                    {user.login_count ?? 0}
                                                </td>
                                                <td className="py-3 text-xs text-gray-400">
                                                    {formatDate(user.last_login_at)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                                                Нет данных за этот период
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
