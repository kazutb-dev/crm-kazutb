import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, Notice, PageHeader, StatTile, StatusBadge, UnderlineTabs, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import {
    BarChart3,
    BookOpen,
    Building2,
    CalendarRange,
    FileSpreadsheet,
    FileText,
    GraduationCap,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

// ─── constants ───────────────────────────────────────────────────────────────

const SECTION_LABELS = {
    teaching: 'УМР — Учебно-методическая работа',
    science: 'НИР — Научно-исследовательская работа',
    social: 'СВР — Социально-воспитательная работа',
    qualification: 'УПК — Уровень профессиональной квалификации',
    survey: 'К5 — Опросы / студенческие оценки',
    other: 'Прочее',
};

const SECTION_SHORT = {
    teaching: 'УМР',
    science: 'НИР',
    social: 'СВР',
    qualification: 'УПК',
    survey: 'К5',
    other: '—',
};

const SECTION_ICON_COLOR = {
    teaching: 'border-blue-200 bg-blue-50 text-blue-700',
    science: 'border-teal-200 bg-teal-50 text-teal-700',
    social: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    qualification: 'border-amber-200 bg-amber-50 text-amber-800',
    survey: 'border-orange-200 bg-orange-50 text-orange-700',
    other: 'border-slate-200 bg-slate-100 text-slate-600',
};

const STATUS_LABELS = {
    draft: 'Черновик',
    submitted: 'Подано',
    returned: 'Возвращено',
    reviewed: 'Проверено',
    pending_dean: 'У декана',
    pending_structural: 'На утверждении',
    approved: 'Утверждено',
    rejected: 'Отклонено',
    locked: 'Заблокировано',
};

const STATUS_TONES = {
    draft: 'default',
    submitted: 'info',
    returned: 'warning',
    reviewed: 'info',
    pending_dean: 'info',
    pending_structural: 'info',
    approved: 'success',
    rejected: 'danger',
    locked: 'default',
};

const ROLE_TABS = {
    teacher: ['mine'],
    hod: ['mine', 'department', 'teachers'],
    department_head: ['mine', 'department', 'teachers'],
    dean: ['mine', 'departments', 'teachers'],
    department: ['faculties', 'pending'],
    admin: ['overview', 'teachers', 'deans', 'hods'],
    superadmin: ['overview', 'teachers', 'deans', 'hods'],
};

const TAB_LABELS = {
    mine: 'Я',
    department: 'Кафедра',
    departments: 'Кафедры',
    teachers: 'ППС',
    deans: 'Деканы',
    hods: 'Завкафедры',
    faculties: 'Факультеты',
    pending: 'Ожидают',
    overview: 'Сводка',
};

const TAB_ICONS = {
    mine: BarChart3,
    department: Building2,
    departments: Building2,
    teachers: Users,
    deans: GraduationCap,
    hods: Building2,
    faculties: GraduationCap,
    pending: CalendarRange,
    overview: TrendingUp,
};

// Add СП-specific statuses and comments
const SP_STATUS_LABELS = {
    pending: 'На рассмотрении СП',
    approved: 'Утверждено СП',
    rejected: 'Отклонено СП',
};

const SP_STATUS_TONES = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(value, decimals = 2) {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n.toFixed(decimals) : '—';
}

function fmtDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d);
}

function normalizeSearchText(value) {
    return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildKpiAiReportText({ type, role, summary, academicYear, period, adminTab }) {
    const yearLabel = academicYear?.name ?? '—';
    const periodLabel = period?.name ?? '—';

    const section = (title, lines) => [title, ...lines, ''].join('\n');

    const baseHeader = [
        `KPI AI: ${type === 'risks' ? 'Риски' : type === 'recommendations' ? 'Рекомендации' : 'Сводный отчет'}`,
        `Роль: ${role}`,
        `Учебный год: ${yearLabel}`,
        `Период: ${periodLabel}`,
        '',
    ].join('\n');

    if (role === 'teacher') {
        const totals = summary?.totals ?? {};
        const result = summary?.result ?? {};
        const currentScore = Number(result.rank_score ?? 0);
        const submitted = Number(totals.submitted ?? 0) + Number(totals.pending ?? 0);

        if (type === 'risks') {
            return baseHeader + section('Ключевые риски:', [
                `1. Записей на проверке: ${submitted}.`,
                `2. Отклонено записей: ${Number(totals.rejected ?? 0)}.`,
                `3. Текущий рейтинг R: ${fmt(currentScore)}.`,
                'Риск: незавершенные и отклоненные записи снижают итоговый рейтинг после закрытия периода.',
            ]);
        }

        if (type === 'recommendations') {
            return baseHeader + section('Рекомендации:', [
                '1. Закрыть все записи со статусом "на проверке".',
                '2. Перезаполнить отклоненные показатели с подтверждающими данными.',
                '3. Сфокусироваться на разделах с минимальными баллами K1–K5.',
                '4. Подать обновления до закрытия периода для фиксации R.',
            ]);
        }

        return baseHeader + section('Сводка:', [
            `Всего записей: ${Number(totals.total ?? 0)}.`,
            `Утверждено: ${Number(totals.approved ?? 0)}.`,
            `На проверке: ${submitted}.`,
            `Отклонено: ${Number(totals.rejected ?? 0)}.`,
            `Сумма баллов: ${fmt(totals.total_points)}.`,
            `Текущий рейтинг R: ${fmt(currentScore)}.`,
        ]);
    }

    if (role === 'hod' || role === 'department_head') {
        const ownTotals = summary?.own_totals ?? {};
        const deptResult = summary?.dept_result ?? {};
        const teachers = summary?.teachers ?? [];
        const activeTeachers = teachers.filter((t) => Number(t.approved_entries ?? 0) > 0).length;

        if (type === 'risks') {
            return baseHeader + section('Ключевые риски:', [
                `1. ППС кафедры с подтвержденными KPI: ${activeTeachers} из ${teachers.length}.`,
                `2. Записей кафедры в ожидании: ${Number(ownTotals.submitted ?? 0) + Number(ownTotals.pending ?? 0)}.`,
                `3. Рейтинг кафедры R: ${fmt(deptResult.rank_score)}.`,
                'Риск: низкая доля подтвержденных KPI у ППС снижает итоговый рейтинг кафедры.',
            ]);
        }

        if (type === 'recommendations') {
            return baseHeader + section('Рекомендации:', [
                '1. Провести адресный разбор KPI с ППС без утвержденных записей.',
                '2. Приоритизировать проверку разделов с низким вкладом в R.',
                '3. Закрыть pending/returned кейсы до даты закрытия периода.',
                '4. Использовать таблицу ППС для ранжирования и точечных корректировок.',
            ]);
        }

        return baseHeader + section('Сводка:', [
            `Кафедра: ${summary?.department?.name ?? '—'}.`,
            `ППС кафедры: ${teachers.length}.`,
            `ППС со сданным KPI: ${activeTeachers}.`,
            `Записей (мои KPI): ${Number(ownTotals.total ?? 0)}.`,
            `Утверждено (мои KPI): ${Number(ownTotals.approved ?? 0)}.`,
            `Рейтинг кафедры R: ${fmt(deptResult.rank_score)}.`,
        ]);
    }

    if (role === 'dean') {
        const departments = summary?.departments ?? [];
        const teachers = summary?.teachers ?? [];
        const facultyResult = summary?.faculty_result ?? {};
        const ownTotals = summary?.own_totals ?? {};

        if (type === 'risks') {
            return baseHeader + section('Ключевые риски:', [
                `1. Кафедр в зоне факультета: ${departments.length}.`,
                `2. ППС в сводной выборке: ${teachers.length}.`,
                `3. Рейтинг факультета R: ${fmt(facultyResult.rank_score)}.`,
                `4. Записей декана в ожидании: ${Number(ownTotals.submitted ?? 0) + Number(ownTotals.pending ?? 0)}.`,
                'Риск: задержка согласования на уровне кафедр напрямую влияет на рейтинг факультета.',
            ]);
        }

        if (type === 'recommendations') {
            return baseHeader + section('Рекомендации:', [
                '1. Еженедельно контролировать кафедры с минимальным R.',
                '2. Ускорить закрытие возвращенных и pending записей.',
                '3. Проверить баланс вкладов K1–K4 в рамках факультета.',
                '4. Назначить KPI-сессии по кафедрам с низкой долей утверждений.',
            ]);
        }

        return baseHeader + section('Сводка:', [
            `Факультет: ${summary?.faculty?.name ?? '—'}.`,
            `Кафедры факультета: ${departments.length}.`,
            `ППС факультета (в выборке): ${teachers.length}.`,
            `Рейтинг факультета R: ${fmt(facultyResult.rank_score)}.`,
            `Мои утвержденные записи: ${Number(ownTotals.approved ?? 0)} из ${Number(ownTotals.total ?? 0)}.`,
        ]);
    }

    if (role === 'department' || role === 'structural') {
        const faculties = summary?.faculties ?? [];
        const pendingTeachers = summary?.pending_teachers ?? [];
        const totalPending = faculties.reduce((acc, row) => acc + Number(row.pending ?? 0), 0);

        if (type === 'risks') {
            return baseHeader + section('Ключевые риски:', [
                `1. Факультетов в контуре: ${faculties.length}.`,
                `2. Ожидают финального утверждения: ${pendingTeachers.length} сотрудников.`,
                `3. Суммарный pending по факультетам: ${totalPending} записей.`,
                'Риск: накопление pending увеличивает задержки финального закрытия периода.',
            ]);
        }

        if (type === 'recommendations') {
            return baseHeader + section('Рекомендации:', [
                '1. Приоритизировать обработку pending в факультетах с максимальным backlog.',
                '2. Настроить SLA на этапы согласования для сокращения очереди.',
                '3. Выполнить еженедельный контроль динамики утверждений.',
            ]);
        }

        return baseHeader + section('Сводка:', [
            `Факультетов в сводке: ${faculties.length}.`,
            `Ожидают финального утверждения: ${pendingTeachers.length} сотрудников.`,
            `Суммарный pending: ${totalPending} записей.`,
        ]);
    }

    const statusCounts = summary?.status_counts ?? {};
    const faculties = summary?.faculties ?? [];
    const topTeachers = summary?.top_teachers ?? [];
    const topFaculties = [...faculties]
        .sort((a, b) => Number(b.rank_score ?? b.approved ?? 0) - Number(a.rank_score ?? a.approved ?? 0))
        .slice(0, 3)
        .map((f, idx) => `${idx + 1}. ${f.name} — R ${fmt(f.rank_score ?? 0)}, утверждено ${Number(f.approved ?? 0)}`)
        .join('\n') || 'Нет данных по факультетам.';

    if (type === 'risks') {
        return baseHeader + section('Ключевые риски:', [
            `1. Подано: ${Number(statusCounts.submitted ?? 0)}.`,
            `2. На утверждении (декан/структурный): ${Number(statusCounts.pending_dean ?? 0) + Number(statusCounts.pending_structural ?? 0)}.`,
            `3. Возвращено/отклонено: ${Number(statusCounts.returned ?? 0) + Number(statusCounts.rejected ?? 0)}.`,
            `4. Текущая вкладка: ${adminTab}.`,
            'Риск: рост возвращенных и pending-кейсов снижает скорость закрытия KPI-периода.',
        ]);
    }

    if (type === 'recommendations') {
        return baseHeader + section('Рекомендации:', [
            '1. Разобрать причины returned/rejected по факультетам и категориям KPI.',
            '2. Ввести недельный SLA на проверку submitted и pending записей.',
            '3. Сфокусировать поддержку на факультетах с наименьшим R.',
            '4. Контролировать Top-10 ППС и масштабировать практики лидеров.',
        ]);
    }

    return [
        baseHeader,
        section('Сводка:', [
            `Всего факультетов: ${faculties.length}.`,
            `Топ ППС в выборке: ${topTeachers.length}.`,
            `Утверждено записей: ${Number(statusCounts.approved ?? 0)}.`,
            `Подано записей: ${Number(statusCounts.submitted ?? 0)}.`,
            `На утверждении: ${Number(statusCounts.pending_dean ?? 0) + Number(statusCounts.pending_structural ?? 0)}.`,
            `Возвращено/отклонено: ${Number(statusCounts.returned ?? 0) + Number(statusCounts.rejected ?? 0)}.`,
        ]),
        section('Топ факультетов:', [topFaculties]),
    ].join('');
}

function formatStructuralUnitName(item) {
    const code = String(item?.structural_unit_code ?? '').trim();
    const name = String(item?.structural_unit_name ?? '').trim();
    if (code && name) return `${code} — ${name}`;
    if (name) return name;
    if (code) return code;
    return 'Структурное подразделение';
}

function fmtValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    const numeric = Number(value);
    return Number.isFinite(numeric) ? fmt(numeric) : String(value);
}

function pct(approved, total) {
    if (!total) return '0%';
    return Math.round((approved / total) * 100) + '%';
}

function normTitle(value) {
    return String(value ?? '').toLowerCase();
}

function isDeanTitle(value) {
    const t = normTitle(value);
    return t.includes('декан') || t.includes('dean');
}

function isHodTitle(value) {
    const t = normTitle(value);
    return (
        t.includes('заведующ')
        || t.includes('зав. кафед')
        || t.includes('зав кафед')
        || t.includes('head of department')
        || t.includes('department head')
        || t.includes('hod')
    );
}

function getNpuValue(row) {
    // If backend provides a pre-computed НПУ threshold constant, use it
    if (row?.npu_threshold != null) return row.npu_threshold;
    // Fallback: sum of K1–K5 (teacher own-page path without finalized result)
    const k1 = Number(row?.k1 ?? 0); // УМР
    const k2 = Number(row?.k2 ?? 0); // НИР
    const k3 = Number(row?.k3 ?? 0); // СВР
    const k4 = Number(row?.k4 ?? 0); // УПК
    const k5 = Number(row?.k5 ?? 0); // К5 (пока 0)
    const npu = k1 + k2 + k3 + k4 + k5;
    return npu > 0 ? npu : (row?.npu ?? row?.approved_entries ?? 0);
}

function getRateValue(row) {
    return row?.rate ?? row?.workload_rate ?? row?.stavka ?? row?.npu_threshold ?? '—';
}

function buildMinePpsRow(summary) {
    const sections = summary?.entries ?? {};
    const result = summary?.result ?? {};

    const sumSectionPoints = (sectionKey) => (sections[sectionKey] ?? []).reduce(
        (acc, entry) => acc + Number(entry?.points ?? 0),
        0,
    );

    const k1 = Number(result?.k1 ?? sumSectionPoints('teaching'));
    const k2 = Number(result?.k2 ?? sumSectionPoints('science'));
    const k3 = Number(result?.k3 ?? sumSectionPoints('social'));
    const k4 = Number(result?.k4 ?? sumSectionPoints('qualification'));
    const k5 = Number(result?.k5 ?? sumSectionPoints('survey'));
    const npu = Number(result?.rate ?? result?.npu_threshold ?? result?.k6 ?? 0);
    const k6 = Number(result?.k6 ?? 0);
    const rankScore = Number(result?.rank_score ?? (k1 + k2 + k3 + k4 + k5 - npu));

    return {
        id: summary?.user?.id,
        name: summary?.user?.name ?? '—',
        title: summary?.user?.title ?? '—',
        faculty_name: '—',
        department_name: summary?.user?.division ?? '—',
        k1,
        k2,
        k3,
        k4,
        k5,
        k6,
        npu_threshold: npu,
        rate: npu,
        rank_score: rankScore,
    };
}

const SELECT_CLS = qdFieldClass;

// ─── stat card ───────────────────────────────────────────────────────────────

const ACCENT_TONE = {
    green: 'success',
    blue: 'info',
    amber: 'warning',
    teal: 'teal',
    default: 'navy',
};

function StatCard({ icon: Icon, label, value, sub, accent = 'default' }) {
    return (
        <StatTile
            icon={Icon}
            label={label}
            value={value}
            hint={sub}
            tone={ACCENT_TONE[accent] ?? 'navy'}
        />
    );
}

function StatRow({ children, cols = 4 }) {
    const colsClass = {
        3: 'sm:grid-cols-3',
        4: 'sm:grid-cols-2 xl:grid-cols-4',
        5: 'sm:grid-cols-3 xl:grid-cols-5',
        6: 'sm:grid-cols-3 xl:grid-cols-6',
    }[cols] ?? 'sm:grid-cols-2 xl:grid-cols-4';

    return <div className={`grid gap-4 ${colsClass}`}>{children}</div>;
}

// ─── result score card ───────────────────────────────────────────────────────

function ResultScoreCard({ result, label = 'Итоговый рейтинг R' }) {
    if (!result) return null;
    const hasAnyScore = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].some((k) => result[k] > 0);
    const rVal = Number(result.rank_score ?? 0);

    return (
        <div className="relative overflow-hidden rounded-[14px] bg-[#082834] p-6 text-white">
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-wrap items-end gap-x-10 gap-y-6">
                <div>
                    <p className="qd-kicker text-teal-300">{label}</p>
                    <p className={[
                        'mt-3 font-display text-5xl font-bold tabular-nums leading-none',
                        rVal > 0 ? 'text-white' : 'text-white/40',
                    ].join(' ')}>
                        {fmt(rVal)}
                    </p>
                </div>
                {hasAnyScore && (
                    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-white/10 bg-white/10 sm:grid-cols-6">
                        {['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((k, i) => (
                            <div key={k} className="min-w-[3.5rem] bg-[#082834] px-3 py-2 text-center">
                                <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white/55">K{i + 1}</p>
                                <p className={[
                                    'mt-0.5 text-sm font-bold tabular-nums',
                                    result[k] > 0 ? 'text-white' : 'text-white/35',
                                ].join(' ')}>
                                    {fmt(result[k])}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
                {result.approved_entries !== undefined && (
                    <div className="ml-auto text-right">
                        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-white/60">Утв. записей</p>
                        <p className="mt-2 font-display text-2xl font-bold tabular-nums text-amber-300">{result.approved_entries}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── section entries table ───────────────────────────────────────────────────

function SectionEntriesTable({ sections }) {
    const allSections = Object.entries(sections ?? {});
    if (allSections.length === 0) {
        return (
            <EmptyState
                title="Нет показателей KPI за выбранный период"
                description="Записи появятся после заполнения формы KPI."
            />
        );
    }

    return (
        <div className="space-y-5">
            {allSections.map(([section, entries]) => {
                const sectionTotal = entries.reduce((s, e) => s + Number(e.points ?? 0), 0);
                const iconCls = SECTION_ICON_COLOR[section] ?? SECTION_ICON_COLOR.other;
                return (
                    <div key={section} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${iconCls}`}>
                                    {SECTION_SHORT[section] ?? section}
                                </span>
                                <span className="truncate text-sm font-semibold text-[#102945]">
                                    {SECTION_LABELS[section] ?? section}
                                </span>
                            </div>
                            <span className="text-xs font-semibold text-slate-500">
                                Итого: <span className="font-display text-base font-bold tabular-nums text-[#102945]">{fmt(sectionTotal)}</span> б.
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-sm">
                                <thead className="border-b border-slate-200">
                                    <tr>
                                        <th className="w-16 px-3 py-2.5 text-left">Код</th>
                                        <th className="px-3 py-2.5 text-left">Показатель</th>
                                        <th className="w-14 px-3 py-2.5 text-right">Ед.</th>
                                        <th className="w-14 px-3 py-2.5 text-right">План</th>
                                        <th className="w-14 px-3 py-2.5 text-right">Факт</th>
                                        <th className="w-20 px-3 py-2.5 text-right">Баллы</th>
                                        <th className="w-[26rem] px-3 py-2.5 text-left">Согласование СП</th>
                                        <th className="w-28 px-3 py-2.5 text-right">Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr key={entry.id} className="border-b border-slate-200 align-top last:border-0">
                                            <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{entry.code ?? '—'}</td>
                                            <td className="px-3 py-2.5 font-medium text-slate-900">{entry.name}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-500">{entry.unit ?? '—'}</td>
                                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                                                <div>{fmtValue(entry.plan_display_value ?? entry.plan_value)}</div>
                                                {entry.plan_source === 'fact_fallback' && (
                                                    <div className="text-[0.65rem] font-medium text-amber-700">авто из факта</div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{fmtValue(entry.fact_display_value ?? entry.fact_value)}</td>
                                            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#102945]">
                                                <div>{fmt(entry.points)}</div>
                                                {entry.points_formula && (
                                                    <div className="ms-auto mt-0.5 max-w-[18rem] text-[0.65rem] font-normal leading-tight text-slate-500">
                                                        {entry.points_formula}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs">
                                                {(entry.structural_confirmations ?? []).length > 0 ? (
                                                    <div className="space-y-1.5">
                                                        {(entry.structural_confirmations ?? []).map((item) => (
                                                            <div key={`${entry.id}-${item.structural_unit_id}`} className="rounded-[10px] border border-slate-200 bg-white p-2">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="truncate text-[0.7rem] font-medium text-slate-800" title={formatStructuralUnitName(item)}>
                                                                        {formatStructuralUnitName(item)}
                                                                    </span>
                                                                    <StatusBadge tone={SP_STATUS_TONES[item.status] ?? 'default'} className="text-[0.65rem]">
                                                                        {SP_STATUS_LABELS[item.status] ?? item.status}
                                                                    </StatusBadge>
                                                                </div>
                                                                {(item.comment || item.confirmed_by || item.confirmed_at) && (
                                                                    <p className="mt-0.5 text-[0.65rem] text-slate-500">
                                                                        {item.comment ? `Комментарий: ${item.comment}` : 'Без комментария'}
                                                                        {item.confirmed_by ? ` · ${item.confirmed_by}` : ''}
                                                                        {item.confirmed_at ? ` · ${fmtDateTime(item.confirmed_at)}` : ''}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <StatusBadge tone={STATUS_TONES[entry.status] ?? 'default'} className="text-[0.7rem]">
                                                    {STATUS_LABELS[entry.status] ?? entry.status}
                                                </StatusBadge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── totals chips ─────────────────────────────────────────────────────────────

function TotalsChips({ totals }) {
    if (!totals) return null;
    return (
        <div className="mb-5 flex flex-wrap items-center gap-2">
            <StatusBadge tone="default">Всего: <strong className="ml-1 tabular-nums">{totals.total}</strong></StatusBadge>
            {totals.submitted > 0 && (
                <StatusBadge tone="info">Подано: <strong className="ml-1 tabular-nums">{totals.submitted}</strong></StatusBadge>
            )}
            {totals.pending > 0 && (
                <StatusBadge tone="warning">На проверке: <strong className="ml-1 tabular-nums">{totals.pending}</strong></StatusBadge>
            )}
            <StatusBadge tone="success">Утверждено: <strong className="ml-1 tabular-nums">{totals.approved}</strong></StatusBadge>
            <StatusBadge tone="default">Баллов: <strong className="ml-1 tabular-nums">{fmt(totals.total_points)}</strong></StatusBadge>
        </div>
    );
}

// ─── ranking table ───────────────────────────────────────────────────────────

function RankingTable({ teachers, showFaculty = false, showDept = false, showKScores = false, source }) {
    if (!teachers || teachers.length === 0) {
        return (
            <EmptyState
                title="Нет данных о ППС за выбранный период"
                description="Данные появятся после формирования KPI-записей."
            />
        );
    }

    const isLive = source === 'live' || teachers[0]?.source === 'live';

    return (
        <div>
            {isLive && (
                <Notice tone="warning" className="mb-4">
                    Отображаются оперативные данные — период ещё не закрыт. Финальный рейтинг R появится после утверждения.
                </Notice>
            )}
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">
                    {teachers.length} чел. найдено
                </span>
            </div>
            <div className="admin-table-wrap">
                <table className="admin-data-table min-w-[680px]">
                    <thead>
                        <tr>
                            <th className="ps-3 w-9 text-center">№</th>
                            <th>ФИО</th>
                            {showDept && <th>Кафедра</th>}
                            {showFaculty && <th>Факультет</th>}
                            <th>Должность</th>
                            {showKScores ? (
                                <>
                                    <th className="w-12 text-right">K1</th>
                                    <th className="w-12 text-right">K2</th>
                                    <th className="w-12 text-right">K3</th>
                                    <th className="w-12 text-right">K4</th>
                                    <th className="w-12 text-right">K5</th>
                                    <th className="w-12 text-right">НПУ</th>
                                    <th className="w-16 text-right pe-3 text-[#067a75]">R</th>
                                </>
                            ) : (
                                <>
                                    <th className="w-16 text-right">Утв.</th>
                                    <th className="w-20 text-right pe-3 text-[#067a75]">
                                        {isLive ? 'Баллы' : 'R'}
                                    </th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {teachers.map((t, i) => (
                            <tr key={t.id ?? i}>
                                <td className="ps-3 text-center text-xs text-slate-500">{i + 1}</td>
                                <td className="font-medium">{t.name}</td>
                                {showDept && <td className="text-sm text-slate-500">{t.department_name ?? '—'}</td>}
                                {showFaculty && <td className="text-sm text-slate-500">{t.faculty_name ?? '—'}</td>}
                                <td className="text-sm text-slate-500 max-w-[200px] truncate">{t.title ?? '—'}</td>
                                {showKScores ? (
                                    <>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k1)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k2)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k3)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k4)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k5)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k6)}</td>
                                        <td className="pe-3 text-right tabular-nums font-bold text-[#067a75]">{fmt(t.rank_score)}</td>
                                    </>
                                ) : (
                                    <>
                                        <td className="text-right tabular-nums font-medium text-emerald-600">{t.approved_entries}</td>
                                        <td className="pe-3 text-right tabular-nums font-bold text-[#067a75]">{fmt(t.rank_score)}</td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ReportHeading({ text, academicYear, period }) {
    return (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-center">
            <p className="qd-kicker justify-center">Официальный отчёт</p>
            <p className="mt-2 text-[0.75rem] font-bold uppercase leading-relaxed tracking-[0.08em] text-[#102945]">
                {text}
            </p>
            <p className="mt-1 font-display text-base font-bold text-teal-700">
                {academicYear?.name ?? '—'}
            </p>
        </div>
    );
}

function ProfessionalRatingTable({ rows, mode = 'pps', onRowClick, searchQuery = '' }) {
    const allRows = rows ?? [];
    const normalizedQuery = normalizeSearchText(searchQuery);

    const displayRows = useMemo(() => {
        if (normalizedQuery === '') {
            return allRows;
        }

        return allRows.filter((row) => {
            const haystack = mode === 'hod'
                ? normalizeSearchText([
                    row.faculty_name,
                    row.department_name,
                    row.name,
                    row.k1,
                    row.k2,
                    row.k3,
                    row.k4,
                    row.rank_score,
                    row.npu_threshold,
                    getRateValue(row),
                ].join(' '))
                : mode === 'dean'
                    ? normalizeSearchText([
                        row.faculty_name,
                        row.name,
                        row.k1,
                        row.k2,
                        row.k3,
                        row.k4,
                        row.rank_score,
                        row.npu_threshold,
                        getRateValue(row),
                    ].join(' '))
                    : normalizeSearchText([
                        row.name,
                        row.title,
                        row.k1,
                        row.k2,
                        row.k3,
                        row.k4,
                        row.k5,
                        row.rank_score,
                        row.npu_threshold,
                        getRateValue(row),
                    ].join(' '));

            return haystack.includes(normalizedQuery);
        });
    }, [allRows, mode, normalizedQuery]);

    if (!displayRows.length) {
        return (
            <EmptyState
                title="Нет данных"
                description="Нет данных для выбранной формы отчёта."
            />
        );
    }

    if (mode === 'hod') {
        return (
            <div className="admin-table-wrap">
                <table className="admin-data-table min-w-[900px]">
                    <thead>
                        <tr>
                            <th className="ps-3 w-9 text-center">№</th>
                            <th className="w-40">Факультет</th>
                            <th className="w-44">Кафедра</th>
                            <th className="w-44">ФИО зав.каф.</th>
                            <th className="w-16 text-right">НПУ</th>
                            <th className="w-20 text-right text-[#067a75]">Рейтинг</th>
                            <th className="w-14 text-right">УМР</th>
                            <th className="w-14 text-right">НИР</th>
                            <th className="w-14 text-right">СВР</th>
                            <th className="w-14 text-right pe-3">УПК</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((row, i) => (
                            <tr
                                key={row.id ?? i}
                                className={onRowClick && row.id ? 'cursor-pointer hover:bg-teal-50/60' : ''}
                                onClick={() => onRowClick && row.id && onRowClick(row)}
                            >
                                <td className="ps-3 text-center text-xs text-slate-500">{i + 1}</td>
                                <td className="text-sm max-w-[10rem] truncate" title={row.faculty_name ?? ''}>{row.faculty_name ?? '—'}</td>
                                <td className="text-sm max-w-[11rem] truncate" title={row.department_name ?? ''}>{row.department_name ?? '—'}</td>
                                <td className="font-medium max-w-[11rem] truncate" title={row.name ?? ''}>{row.name ?? '—'}</td>
                                <td className="text-right tabular-nums">{fmt(getRateValue(row))}</td>
                                <td className="text-right tabular-nums font-bold text-[#067a75]">{fmt(row.rank_score)}</td>
                                <td className="text-right tabular-nums">{fmt(row.k1)}</td>
                                <td className="text-right tabular-nums">{fmt(row.k2)}</td>
                                <td className="text-right tabular-nums">{fmt(row.k3)}</td>
                                <td className="pe-3 text-right tabular-nums">{fmt(row.k4)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (mode === 'dean') {
        return (
            <div className="admin-table-wrap">
                <table className="admin-data-table min-w-[820px]">
                    <thead>
                        <tr>
                            <th className="ps-3 w-9 text-center">№</th>
                            <th className="w-52">Факультет</th>
                            <th className="w-52">ФИО декана</th>
                            <th className="w-16 text-right">НПУ</th>
                            <th className="w-20 text-right text-[#067a75]">Рейтинг</th>
                            <th className="w-14 text-right">УМР</th>
                            <th className="w-14 text-right">НИР</th>
                            <th className="w-14 text-right">СВР</th>
                            <th className="w-14 text-right pe-3">УПК</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((row, i) => (
                            <tr
                                key={row.id ?? i}
                                className={onRowClick && row.id ? 'cursor-pointer hover:bg-teal-50/60' : ''}
                                onClick={() => onRowClick && row.id && onRowClick(row)}
                            >
                                <td className="ps-3 text-center text-xs text-slate-500">{i + 1}</td>
                                <td className="text-sm max-w-[13rem] truncate" title={row.faculty_name ?? ''}>{row.faculty_name ?? '—'}</td>
                                <td className="font-medium max-w-[13rem] truncate" title={row.name ?? ''}>{row.name ?? '—'}</td>
                                <td className="text-right tabular-nums">{fmt(getRateValue(row))}</td>
                                <td className="text-right tabular-nums font-bold text-[#067a75]">{fmt(row.rank_score)}</td>
                                <td className="text-right tabular-nums">{fmt(row.k1)}</td>
                                <td className="text-right tabular-nums">{fmt(row.k2)}</td>
                                <td className="text-right tabular-nums">{fmt(row.k3)}</td>
                                <td className="pe-3 text-right tabular-nums">{fmt(row.k4)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="admin-table-wrap">
            <table className="admin-data-table min-w-[1200px]">
                <thead>
                    <tr>
                        <th className="ps-3 w-9 text-center">№</th>
                        <th className="w-44">ФИО</th>
                        <th className="w-44">Должность</th>
                        <th className="w-14 text-right">К1 (УМР)</th>
                        <th className="w-14 text-right">К2 (НИР)</th>
                        <th className="w-14 text-right">К3 (СВР)</th>
                        <th className="w-14 text-right">К4 (УПК)</th>
                        <th className="w-14 text-right">К5 (Опрос)</th>
                        <th className="w-14 text-right">НПУ</th>
                        <th className="w-20 text-right text-[#067a75]">Рейтинг (R)</th>
                    </tr>
                </thead>
                <tbody>
                    {displayRows.map((row, i) => (
                        <tr
                            key={row.id ?? i}
                            className={onRowClick && row.id ? 'cursor-pointer hover:bg-teal-50/60' : ''}
                            onClick={() => onRowClick && row.id && onRowClick(row)}
                        >
                            <td className="ps-3 text-center text-xs text-slate-500">{i + 1}</td>
                            <td className="font-medium max-w-[11rem] truncate" title={row.name ?? ''}>{row.name ?? '—'}</td>
                            <td className="text-sm text-slate-500 max-w-[220px] truncate">{row.title ?? '—'}</td>
                            <td className="text-right tabular-nums">{fmt(row.k1)}</td>
                            <td className="text-right tabular-nums">{fmt(row.k2)}</td>
                            <td className="text-right tabular-nums">{fmt(row.k3)}</td>
                            <td className="text-right tabular-nums">{fmt(row.k4)}</td>
                            <td className="text-right tabular-nums">{fmt(row.k5)}</td>
                            <td className="text-right tabular-nums">{fmt(row.npu_threshold ?? getRateValue(row))}</td>
                            <td className={[
                                'pe-3 text-right tabular-nums font-bold',
                                Number(row.rank_score ?? 0) < 0 ? 'text-red-700' : 'text-[#067a75]',
                            ].join(' ')}>
                                {fmt(row.rank_score)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function RankBandGrid({ groups = [] }) {
    if (!groups.length) {
        return null;
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {groups.map((group) => (
                <div key={group.key} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="truncate text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-slate-600">{group.label}</p>
                    <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-[#102945]">{Number(group.count ?? 0)}</p>
                    <p className="text-[11px] text-slate-500">сотрудников</p>
                </div>
            ))}
        </div>
    );
}

function PositionGroupTable({ groups = [] }) {
    if (!groups.length) {
        return null;
    }

    return (
        <div className="admin-table-wrap">
            <table className="admin-data-table min-w-[460px]">
                <thead>
                    <tr>
                        <th className="ps-3">Должностная группа</th>
                        <th className="w-24 text-right pe-3">Кол-во</th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map((group) => (
                        <tr key={group.key}>
                            <td className="ps-3 font-medium">{group.label}</td>
                            <td className="pe-3 text-right tabular-nums font-semibold text-[#067a75]">{Number(group.count ?? 0)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function PpsReportSection({ rows, academicYear, period, subtitle, filters, onExportExcel, rankGroups = [], positionGroups = [] }) {
    const [facultyFilter, setFacultyFilter] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [tableSearch, setTableSearch] = useState('');

    const allRows = rows ?? [];

    const facultyOptions = useMemo(() => {
        const byId = new Map();

        allRows.forEach((row) => {
            const id = row?.faculty_id;
            const name = String(row?.faculty_name ?? '').trim();

            if (id == null || id === '' || !name) {
                return;
            }

            const key = String(id);
            if (!byId.has(key)) {
                byId.set(key, { id: key, name });
            }
        });

        return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [allRows]);

    const departmentOptions = useMemo(() => {
        const source = facultyFilter === ''
            ? allRows
            : allRows.filter((row) => String(row?.faculty_id ?? '') === facultyFilter);

        const byId = new Map();

        source.forEach((row) => {
            const id = row?.department_id;
            const name = String(row?.department_name ?? '').trim();

            if (id == null || id === '' || !name) {
                return;
            }

            const key = String(id);
            if (!byId.has(key)) {
                byId.set(key, { id: key, name });
            }
        });

        return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [allRows, facultyFilter]);

    const filteredRows = useMemo(() => {
        return allRows.filter((row) => {
            const facultyId = String(row?.faculty_id ?? '');
            const departmentId = String(row?.department_id ?? '');

            if (facultyFilter !== '' && facultyId !== facultyFilter) {
                return false;
            }

            if (departmentFilter !== '' && departmentId !== departmentFilter) {
                return false;
            }

            return true;
        });
    }, [allRows, facultyFilter, departmentFilter]);

    const handleExportClick = () => {
        if (!onExportExcel) {
            return;
        }

        onExportExcel({
            faculty_id: facultyFilter !== '' ? Number(facultyFilter) : null,
            department_id: departmentFilter !== '' ? Number(departmentFilter) : null,
        });
    };

    const handleRowClick = (row) => {
        const params = {};
        if (filters?.academic_year_id) params.academic_year_id = filters.academic_year_id;
        router.get(route('kpi.summary.teacher', { userId: row.id }), params);
    };

    return (
        <div className="space-y-6">
            <InfoBar>
                <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
                K1 — УМР, K2 — НИР, K3 — СВР, K4 — УПК, K5 — Анкетирование. НПУ вычитается из суммы как отдельный показатель. Нажмите на строку для просмотра карточки сотрудника.
            </InfoBar>

            <ReportCard
                icon={FileText}
                title="Результаты профессионального рейтинга ППС"
                subtitle={subtitle}
                actions={
                    onExportExcel
                        ? (
                            <ExcelButton onClick={handleExportClick} title="Экспортировать таблицу ППС в Excel" />
                        )
                        : null
                }
            >
                <div className="mb-5">
                    <RatingFormulaBar
                        formula="R = (K1 + K2 + K3 + K4 + K5) - НПУ"
                        note="НПУ определяется по степени (настройки НПУ)"
                    />
                </div>

                {rankGroups.length > 0 && (
                    <div className="mb-5 space-y-2">
                        <p className="qd-field-label text-slate-500">Группировка рейтинга по диапазонам</p>
                        <RankBandGrid groups={rankGroups} />
                    </div>
                )}

                {positionGroups.length > 0 && (
                    <div className="mb-5 space-y-2">
                        <p className="qd-field-label text-slate-500">Списки по должностям</p>
                        <PositionGroupTable groups={positionGroups} />
                    </div>
                )}

                <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr]">
                        <label className="block space-y-2">
                            <span className="qd-field-label block">Факультет</span>
                            <select
                                className={SELECT_CLS}
                                value={facultyFilter}
                                onChange={(e) => {
                                    setFacultyFilter(e.target.value);
                                    setDepartmentFilter('');
                                }}
                            >
                                <option value="">Все факультеты</option>
                                {facultyOptions.map((faculty) => (
                                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="block space-y-2">
                            <span className="qd-field-label block">Кафедра</span>
                            <select
                                className={SELECT_CLS}
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                            >
                                <option value="">Все кафедры</option>
                                {departmentOptions.map((department) => (
                                    <option key={department.id} value={department.id}>{department.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="block space-y-2 md:col-span-2 xl:col-span-1">
                            <span className="qd-field-label block">Быстрый поиск</span>
                            <Input
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                placeholder="Быстрый поиск: сотрудник, показатель, период, структура, баллы, статус"
                            />
                        </label>
                    </div>
                    <div className="mt-4 border-t border-slate-200 pt-3 text-right text-xs font-medium text-slate-500">
                        Показано: <span className="tabular-nums">{filteredRows.length}</span> из <span className="tabular-nums">{allRows.length}</span>
                    </div>
                </div>

                <ReportHeading
                    text="РЕЗУЛЬТАТЫ ПРОФЕССИОНАЛЬНОГО РЕЙТИНГА ППС АО «КАЗУТБ ИМ. К. КУЛАЖАНОВА» ЗА"
                    period={period}
                    academicYear={academicYear}
                />
                <ProfessionalRatingTable rows={filteredRows} mode="pps" onRowClick={handleRowClick} searchQuery={tableSearch} />
            </ReportCard>
        </div>
    );
}

// ─── department table ─────────────────────────────────────────────────────────

function DeptTable({ departments, showFaculty = false }) {
    if (!departments || departments.length === 0) {
        return (
            <EmptyState
                title="Нет данных по кафедрам"
                description="Нет данных по кафедрам за выбранный период."
            />
        );
    }

    return (
        <div className="admin-table-wrap">
            <table className="admin-data-table min-w-[520px]">
                <thead>
                    <tr>
                        <th className="ps-3 w-9 text-center">№</th>
                        <th>Кафедра</th>
                        {showFaculty && <th>Факультет</th>}
                        <th className="w-14 text-right">ППС</th>
                        <th className="w-20 text-right">Записей</th>
                        <th className="w-20 text-right">Утв.</th>
                        <th className="w-20 text-right pe-3 text-[#067a75]">R</th>
                    </tr>
                </thead>
                <tbody>
                    {departments.map((d, i) => (
                        <tr key={d.id ?? i}>
                            <td className="ps-3 text-center text-xs text-slate-500">{i + 1}</td>
                            <td className="font-medium">{d.name}</td>
                            {showFaculty && <td className="text-sm text-slate-500">{d.faculty_name ?? '—'}</td>}
                            <td className="text-right tabular-nums">{d.teacher_count ?? d.user_count ?? '—'}</td>
                            <td className="text-right tabular-nums">{d.total_entries ?? d.approved_entries ?? '—'}</td>
                            <td className="text-right tabular-nums font-semibold text-emerald-600">{d.approved ?? d.approved_entries ?? '—'}</td>
                            <td className="pe-3 text-right tabular-nums font-bold text-[#067a75]">
                                {d.rank_score != null ? fmt(d.rank_score) : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── tab nav ─────────────────────────────────────────────────────────────────

function TabNav({ tabs, active, onChange }) {
    return (
        <UnderlineTabs
            className="mb-6"
            items={tabs.map((tab) => ({ key: tab, label: TAB_LABELS[tab] ?? tab, icon: TAB_ICONS[tab] }))}
            value={active}
            onChange={onChange}
        />
    );
}

// ─── section card ─────────────────────────────────────────────────────────────

function ReportCard({ icon: Icon, title, subtitle, children, actions }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4" />}
                        {title}
                    </span>
                    {(subtitle || actions) && (
                        <span className="flex items-center gap-3">
                            {subtitle && <span className="text-xs font-medium normal-case tracking-normal text-slate-500">{subtitle}</span>}
                            {actions}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

function ExcelButton({ onClick, title }) {
    return (
        <Button type="button" size="sm" variant="outline" onClick={onClick} title={title}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
        </Button>
    );
}

// ─── role-specific notice bar ─────────────────────────────────────────────────

function InfoBar({ children }) {
    return (
        <div className="flex items-start gap-3 rounded-[14px] border border-teal-200 bg-teal-50 px-4 py-3.5 text-sm leading-relaxed text-slate-700 [&>svg]:text-teal-700">
            {children}
        </div>
    );
}

function RatingFormulaBar({ formula, note }) {
    return (
        <InfoBar>
            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
                <span className="font-medium text-slate-700">Формула рейтинга: </span>
                <span className="font-semibold text-[#102945]">{formula}</span>
                {note && <span className="text-slate-500"> · {note}</span>}
            </div>
        </InfoBar>
    );
}

// ─── role views ───────────────────────────────────────────────────────────────

function TeacherView({ summary }) {
    const hasEntries = Object.keys(summary.entries ?? {}).length > 0;
    const mineRatingRow = useMemo(() => buildMinePpsRow(summary), [summary]);

    return (
        <div className="space-y-6">
            {summary.result ? (
                <ResultScoreCard result={summary.result} label="Мой итоговый рейтинг R" />
            ) : (
                <InfoBar>
                    <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
                    Итоговый рейтинг ещё не сформирован — период не закрыт. Формула: R = (K1 + K2 + K3 + K4 + K5) - НПУ. Ниже отображаются текущие данные.
                </InfoBar>
            )}

            <StatRow cols={5}>
                <StatCard icon={BarChart3} label="Всего записей" value={summary.totals?.total ?? 0} />
                <StatCard icon={TrendingUp} label="Утверждено" value={summary.totals?.approved ?? 0} accent="green" />
                <StatCard label="На проверке" value={(summary.totals?.submitted ?? 0) + (summary.totals?.pending ?? 0)} accent="amber" />
                <StatCard label="Отклонено" value={summary.totals?.rejected ?? 0} accent="default" />
                <StatCard label="Баллов" value={fmt(summary.totals?.total_points)} accent="teal" />
            </StatRow>

            <ReportCard
                icon={FileText}
                title="Результаты рейтинга ППС"
                subtitle="Моя строка рейтинга"
            >
                <RatingFormulaBar
                    formula="R = (K1 + K2 + K3 + K4 + K5) - НПУ"
                    note="K1 — УМР, K2 — НИР, K3 — СВР, K4 — УПК"
                />
                <div className="mt-4">
                    <ProfessionalRatingTable rows={[mineRatingRow]} mode="pps" />
                </div>
            </ReportCard>

            <ReportCard icon={BarChart3} title="KPI — Мои показатели">
                {hasEntries ? (
                    <>
                        <TotalsChips totals={summary.totals} />
                        <SectionEntriesTable sections={summary.entries} />
                    </>
                ) : (
                    <EmptyState
                        title="Нет показателей KPI за выбранный период"
                        description="Перейдите в «KPI — Мои показатели» для заполнения формы."
                    />
                )}
            </ReportCard>
        </div>
    );
}

function HodView({ summary, academicYear, period, filters }) {
    const tabs = ROLE_TABS.hod;
    const [tab, setTab] = useState('mine');
    const validTab = tabs.includes(tab) ? tab : 'mine';

    return (
        <div>
            <TabNav tabs={tabs} active={validTab} onChange={setTab} />

            {validTab === 'mine' && (
                <div className="space-y-6">
                    {summary.own_result ? (
                        <ResultScoreCard result={summary.own_result} label="Мой рейтинг R (зав. кафедрой)" />
                    ) : (
                        <InfoBar>
                            <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
                            Итоговый рейтинг ещё не сформирован. Формула: R = (K1 + K2 + K3 + K4) - НПУ. Отображаются текущие данные.
                        </InfoBar>
                    )}
                    <StatRow cols={4}>
                        <StatCard icon={BarChart3} label="Всего записей" value={summary.own_totals?.total ?? 0} />
                        <StatCard icon={TrendingUp} label="Утверждено" value={summary.own_totals?.approved ?? 0} accent="green" />
                        <StatCard label="На проверке" value={(summary.own_totals?.submitted ?? 0) + (summary.own_totals?.pending ?? 0)} accent="amber" />
                        <StatCard label="Баллов" value={fmt(summary.own_totals?.total_points)} accent="teal" />
                    </StatRow>
                    <ReportCard icon={BarChart3} title="KPI — Мои показатели">
                        <TotalsChips totals={summary.own_totals} />
                        <SectionEntriesTable sections={summary.own_entries ?? {}} />
                    </ReportCard>
                </div>
            )}

            {validTab === 'department' && (
                <div className="space-y-6">
                    {summary.dept_result ? (
                        <ResultScoreCard result={summary.dept_result} label={`Рейтинг кафедры: ${summary.department?.name ?? ''}`} />
                    ) : (
                        <InfoBar>
                            <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
                            Итоговый рейтинг кафедры ещё не сформирован. Данные появятся после закрытия периода.
                        </InfoBar>
                    )}
                    <ReportCard
                        icon={Building2}
                        title={summary.department?.name ?? 'Кафедра'}
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <StatCard icon={Users} label="ППС кафедры" value={summary.teachers?.length ?? 0} />
                            <StatCard
                                label="Сдали KPI"
                                value={summary.teachers?.filter((t) => t.approved_entries > 0).length ?? 0}
                                accent="green"
                            />
                        </div>
                    </ReportCard>
                </div>
            )}

            {validTab === 'teachers' && (
                <PpsReportSection
                    rows={summary.teachers}
                    academicYear={academicYear}
                    period={period}
                    subtitle={summary.department?.name}
                    filters={filters}
                />
            )}
        </div>
    );
}

function DeanView({ summary, academicYear, period, filters }) {
    const tabs = ROLE_TABS.dean;
    const [tab, setTab] = useState('mine');
    const validTab = tabs.includes(tab) ? tab : 'mine';

    return (
        <div>
            <TabNav tabs={tabs} active={validTab} onChange={setTab} />

            {validTab === 'mine' && (
                <div className="space-y-6">
                    {summary.own_result ? (
                        <ResultScoreCard result={summary.own_result} label="Мой рейтинг R (декан)" />
                    ) : (
                        <InfoBar>
                            <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
                            Итоговый рейтинг ещё не сформирован. Формула: R = (K1 + K2 + K3 + K4) - НПУ. Отображаются текущие данные.
                        </InfoBar>
                    )}
                    <StatRow cols={4}>
                        <StatCard icon={BarChart3} label="Всего записей" value={summary.own_totals?.total ?? 0} />
                        <StatCard icon={TrendingUp} label="Утверждено" value={summary.own_totals?.approved ?? 0} accent="green" />
                        <StatCard label="На проверке" value={(summary.own_totals?.submitted ?? 0) + (summary.own_totals?.pending ?? 0)} accent="amber" />
                        <StatCard label="Баллов" value={fmt(summary.own_totals?.total_points)} accent="teal" />
                    </StatRow>
                    <ReportCard icon={BarChart3} title="KPI — Мои показатели">
                        <TotalsChips totals={summary.own_totals} />
                        <SectionEntriesTable sections={summary.own_entries ?? {}} />
                    </ReportCard>
                </div>
            )}

            {validTab === 'departments' && (
                <div className="space-y-6">
                    {summary.faculty_result && (
                        <ResultScoreCard result={summary.faculty_result} label={`Рейтинг факультета: ${summary.faculty?.name ?? ''}`} />
                    )}
                    <ReportCard
                        icon={Building2}
                        title="Кафедры факультета"
                        subtitle={summary.faculty?.name}
                    >
                        <DeptTable departments={summary.departments} />
                    </ReportCard>
                </div>
            )}

            {validTab === 'teachers' && (
                <PpsReportSection
                    rows={summary.teachers}
                    academicYear={academicYear}
                    period={period}
                    subtitle={summary.faculty?.name}
                    filters={filters}
                />
            )}
        </div>
    );
}

// ─── donut chart (pure SVG, no dependencies) ─────────────────────────────────

const STATUS_CHART_COLORS = {
    approved: '#3fb57a',
    submitted: '#09bab2',
    reviewed: '#2c5a86',
    pending_dean: '#e2b53e',
    pending_structural: '#067a75',
    returned: '#d9853f',
    rejected: '#d64540',
    locked: '#102945',
};

const STATUS_CHART_LABELS = {
    approved: 'Утверждено',
    submitted: 'Подано',
    reviewed: 'Проверено',
    pending_dean: 'У декана',
    pending_structural: 'На утверждении',
    returned: 'Возвращено',
    rejected: 'Отклонено',
    locked: 'Заблокировано',
};

function DonutChart({ segments, size = 140, thickness = 30 }) {
    const r = size / 2 - thickness / 2;
    const circ = 2 * Math.PI * r;
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (!total) {
        return (
            <div className="flex items-center justify-center" style={{ width: size, height: size }}>
                <span className="text-xs text-slate-400">—</span>
            </div>
        );
    }
    let cumulative = 0;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f1" strokeWidth={thickness} />
            {segments
                .filter((s) => s.value > 0)
                .map((seg, i) => {
                    const dash = (seg.value / total) * circ;
                    const offset = -cumulative;
                    cumulative += dash;
                    return (
                        <circle
                            key={i}
                            cx={size / 2}
                            cy={size / 2}
                            r={r}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={thickness}
                            strokeDasharray={`${dash} ${circ}`}
                            strokeDashoffset={offset}
                        />
                    );
                })}
        </svg>
    );
}

// ─── horizontal bar helper ────────────────────────────────────────────────────

function HBar({ label, value, maxValue, displayValue, barClass = 'bg-teal-600' }) {
    const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
        <div>
            <div className="mb-1 flex items-center justify-between">
                <span className="max-w-[60%] truncate text-xs font-medium text-slate-700">{label}</span>
                <span className="text-xs font-semibold tabular-nums text-teal-700">{displayValue ?? value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                    className={`h-2 rounded-full transition-all duration-500 ${barClass}`}
                    style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%` }}
                />
            </div>
        </div>
    );
}

// ─── section bar colors ───────────────────────────────────────────────────────

const SECTION_BAR_COLORS = {
    teaching: 'bg-blue-600',
    science: 'bg-teal-600',
    social: 'bg-emerald-500',
    qualification: 'bg-amber-400',
    survey: 'bg-orange-500',
    other: 'bg-slate-400',
};

// ─── overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ summary }) {
    const [topFilter, setTopFilter] = useState({ faculty: '', section: '' });

    const statusCounts = summary.status_counts ?? {};
    const nonDraftTotal = Object.entries(statusCounts)
        .filter(([s]) => s !== 'draft')
        .reduce((sum, [, v]) => sum + Number(v), 0);

    const approvedCount = Number(statusCounts.approved ?? 0);
    const pendingCount =
        Number(statusCounts.submitted ?? 0) +
        Number(statusCounts.reviewed ?? 0) +
        Number(statusCounts.pending_dean ?? 0) +
        Number(statusCounts.pending_structural ?? 0);
    const returnedCount = Number(statusCounts.returned ?? 0) + Number(statusCounts.rejected ?? 0);
    const approvalRate = nonDraftTotal > 0 ? Math.round((approvedCount / nonDraftTotal) * 100) : 0;

    // Donut segments
    const donutSegments = Object.entries(STATUS_CHART_COLORS)
        .map(([key, color]) => ({ key, label: STATUS_CHART_LABELS[key] ?? key, color, value: Number(statusCounts[key] ?? 0) }))
        .filter((s) => s.value > 0);

    // Section bars
    const sectionStats = summary.section_stats ?? {};
    const maxSectionTotal = Math.max(...Object.values(sectionStats).map((s) => s.total ?? 0), 1);
    const sectionItems = Object.entries(SECTION_SHORT)
        .map(([key, short]) => ({
            key,
            shortLabel: short,
            label: SECTION_LABELS[key] ?? key,
            value: sectionStats[key]?.total ?? 0,
            approved: sectionStats[key]?.approved ?? 0,
            points: sectionStats[key]?.total_points ?? 0,
            barClass: SECTION_BAR_COLORS[key] ?? 'bg-slate-400',
        }))
        .filter((s) => s.value > 0)
        .sort((a, b) => b.value - a.value);

    // Faculty data
    const faculties = summary.faculties ?? [];
    const maxFacultyApproved = Math.max(...faculties.map((f) => f.approved), 1);

    // Top-10 teachers with filters
    const facultyNames = useMemo(
        () => [...new Set((summary.top_teachers ?? []).map((t) => t.faculty_name).filter(Boolean))].sort(),
        [summary.top_teachers],
    );

    const sectionToK = { teaching: 'k1', science: 'k2', social: 'k3', qualification: 'k4', survey: 'k5' };

    const top10 = useMemo(() => {
        let t = summary.top_teachers ?? [];
        if (topFilter.faculty) t = t.filter((r) => r.faculty_name === topFilter.faculty);
        if (topFilter.section) {
            const kKey = sectionToK[topFilter.section];
            if (kKey) t = [...t].sort((a, b) => Number(b[kKey] ?? 0) - Number(a[kKey] ?? 0));
        } else {
            // Default: sort by rank_score (R) in descending order
            t = [...t].sort((a, b) => Number(b.rank_score ?? 0) - Number(a.rank_score ?? 0));
        }
        return t.slice(0, 10);
    }, [summary.top_teachers, topFilter]);

    return (
        <div className="space-y-6">
            <StatRow cols={6}>
                <StatCard icon={BarChart3} label="Всего записей" value={nonDraftTotal} />
                <StatCard
                    icon={TrendingUp}
                    label="Утверждено"
                    value={approvedCount}
                    accent="green"
                    sub={`${approvalRate}% от общего`}
                />
                <StatCard label="Подано" value={statusCounts.submitted ?? 0} accent="blue" />
                <StatCard label="На проверке" value={pendingCount} accent="amber" />
                <StatCard label="Возвращено" value={returnedCount} />
                <StatCard label="Черновики" value={statusCounts.draft ?? 0} />
            </StatRow>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Распределение по статусам</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-5">
                            <div className="relative shrink-0">
                                <DonutChart segments={donutSegments} size={120} thickness={26} />
                                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="font-display text-xl font-bold leading-none tabular-nums text-[#102945]">{approvalRate}%</span>
                                    <span className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-slate-500">Утв.</span>
                                </div>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                                {donutSegments.map((seg) => (
                                    <div key={seg.key} className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: seg.color }} />
                                        <span className="min-w-0 truncate text-xs text-slate-600">{seg.label}</span>
                                        <span className="ml-auto text-xs font-semibold tabular-nums text-[#102945]">{seg.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Записи по разделам KPI</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sectionItems.length > 0 ? (
                            <div className="space-y-3">
                                {sectionItems.map((s) => (
                                    <div key={s.key}>
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-700">{s.shortLabel}</span>
                                            <div className="flex items-center gap-3 text-xs tabular-nums">
                                                <span className="text-slate-500">{s.value} зап.</span>
                                                <span className="font-semibold text-emerald-700">{s.approved} утв.</span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                            <div
                                                className={`h-2 rounded-full transition-all duration-500 ${s.barClass}`}
                                                style={{ width: `${Math.max((s.value / maxSectionTotal) * 100, s.value > 0 ? 2 : 0)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500">Нет данных</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Факультеты — утверждено / всего</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {faculties.length > 0 ? (
                            <div className="space-y-3">
                                {[...faculties]
                                    .sort((a, b) => b.approved - a.approved)
                                    .map((f) => (
                                        <HBar
                                            key={f.id}
                                            label={f.name}
                                            value={f.approved}
                                            maxValue={maxFacultyApproved}
                                            displayValue={`${f.approved} / ${f.total_entries}`}
                                            barClass="bg-teal-600"
                                        />
                                    ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500">Нет данных</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Рейтинг факультетов
                    </CardTitle>
                </CardHeader>
                <CardContent className={faculties.length > 0 ? 'p-0' : ''}>
                    {faculties.length > 0 ? (
                        <div>
                            {[...faculties]
                                .sort((a, b) => (b.rank_score ?? b.approved) - (a.rank_score ?? a.approved))
                                .map((f, i) => (
                                    <div key={f.id} className="flex items-center gap-4 border-b border-slate-200 px-5 py-3 last:border-0">
                                        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${i === 0 ? 'bg-amber-400 text-[#102945]' : 'bg-slate-100 text-slate-600'}`}>
                                            {i + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                                <span className="truncate text-sm font-medium text-slate-900">{f.name}</span>
                                                <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
                                                    <span className="text-slate-500">{f.user_count} чел.</span>
                                                    <span className="font-semibold text-emerald-700">{f.approved} утв.</span>
                                                    {f.rank_score != null && (
                                                        <span className="w-20 text-right font-bold text-[#067a75]">
                                                            R {fmt(f.rank_score)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                                <div
                                                    className="h-1.5 rounded-full bg-teal-600"
                                                    style={{ width: `${(f.approved / maxFacultyApproved) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500">Нет данных</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Топ-10 ППС
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="block space-y-2">
                            <span className="qd-field-label block">Факультет</span>
                            <select
                                className={SELECT_CLS}
                                value={topFilter.faculty}
                                onChange={(e) => setTopFilter((f) => ({ ...f, faculty: e.target.value }))}
                            >
                                <option value="">Все факультеты</option>
                                {facultyNames.map((fac) => (
                                    <option key={fac} value={fac}>{fac}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block space-y-2">
                            <span className="qd-field-label block">Сортировка</span>
                            <select
                                className={SELECT_CLS}
                                value={topFilter.section}
                                onChange={(e) => setTopFilter((f) => ({ ...f, section: e.target.value }))}
                            >
                                <option value="">По общему рейтингу R</option>
                                {Object.entries(SECTION_SHORT)
                                    .filter(([k]) => k !== 'other')
                                    .map(([k, label]) => (
                                        <option key={k} value={k}>{label} — {SECTION_LABELS[k]}</option>
                                    ))}
                            </select>
                        </label>
                    </div>
                    {top10.length > 0 ? (
                        <div className="admin-table-wrap">
                            <table className="admin-data-table min-w-[700px]">
                                <thead>
                                    <tr>
                                        <th className="ps-3 w-9 text-center">№</th>
                                        <th>ФИО</th>
                                        <th>Факультет</th>
                                        <th>Кафедра</th>
                                        <th className="w-14 text-right">УМР</th>
                                        <th className="w-14 text-right">НИР</th>
                                        <th className="w-14 text-right">СВР</th>
                                        <th className="w-14 text-right">УПК</th>
                                        <th className="w-16 text-right pe-3 text-[#067a75]">R</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {top10.map((t, i) => (
                                        <tr key={t.id ?? i}>
                                            <td className="ps-3 text-center">
                                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${i === 0 ? 'bg-amber-400 text-[#102945]' : 'bg-slate-100 text-slate-600'}`}>
                                                    {i + 1}
                                                </span>
                                            </td>
                                            <td className="font-medium text-slate-900">{t.name}</td>
                                            <td className="max-w-[9rem] truncate text-sm text-slate-500" title={t.faculty_name ?? ''}>
                                                {t.faculty_name ?? '—'}
                                            </td>
                                            <td className="max-w-[9rem] truncate text-sm text-slate-500" title={t.department_name ?? ''}>
                                                {t.department_name ?? '—'}
                                            </td>
                                            <td className="text-right tabular-nums text-sm">{fmt(t.k1)}</td>
                                            <td className="text-right tabular-nums text-sm">{fmt(t.k2)}</td>
                                            <td className="text-right tabular-nums text-sm">{fmt(t.k3)}</td>
                                            <td className="text-right tabular-nums text-sm">{fmt(t.k4)}</td>
                                            <td className="pe-3 text-right tabular-nums font-bold text-[#067a75]">{fmt(t.rank_score)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState
                            title="Нет данных"
                            description="Нет данных для выбранных фильтров."
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}


function AdminView({ summary, academicYear, period, filters, onExportRatingExcel, tab, setTab }) {
    const tabs = ROLE_TABS.admin;
    const [hodSearch, setHodSearch] = useState('');
    const [deanSearch, setDeanSearch] = useState('');

    const statusCounts = summary.status_counts ?? {};
    const nonDraftTotal = Object.entries(statusCounts)
        .filter(([s]) => s !== 'draft')
        .reduce((sum, [, v]) => sum + Number(v), 0);

    return (
        <div>
            <TabNav tabs={tabs} active={tab} onChange={setTab} />

            {tab === 'overview' && (
                <div className="mb-6 space-y-6">
                    <StatRow cols={4}>
                        <StatCard icon={BarChart3} label="Всего (без черновиков)" value={nonDraftTotal} />
                        <StatCard icon={TrendingUp} label="Утверждено" value={statusCounts.approved ?? 0} accent="green" />
                        <StatCard label="Подано" value={statusCounts.submitted ?? 0} accent="blue" />
                        <StatCard label="На утверждении" value={(statusCounts.pending_structural ?? 0) + (statusCounts.pending_dean ?? 0)} accent="amber" />
                    </StatRow>

                    <ReportCard icon={GraduationCap} title="Факультеты — обзор">
                        {!summary.faculties?.length ? (
                            <p className="py-4 text-center text-sm text-slate-500">Нет данных.</p>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-data-table min-w-[480px]">
                                    <thead>
                                        <tr>
                                            <th className="ps-3">Факультет</th>
                                            <th className="w-20 text-right">Участников</th>
                                            <th className="w-20 text-right">Записей</th>
                                            <th className="w-20 text-right">Утв.</th>
                                            <th className="w-14 text-right">%</th>
                                            <th className="w-20 text-right pe-3 text-[#067a75]">R</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(summary.faculties ?? []).map((f) => (
                                            <tr key={f.id}>
                                                <td className="ps-3 font-medium">{f.name}</td>
                                                <td className="text-right tabular-nums">{f.user_count}</td>
                                                <td className="text-right tabular-nums">{f.total_entries}</td>
                                                <td className="text-right tabular-nums font-semibold text-emerald-600">{f.approved}</td>
                                                <td className="text-right text-xs tabular-nums text-slate-500">{pct(f.approved, f.total_entries)}</td>
                                                <td className="pe-3 text-right tabular-nums font-bold text-[#067a75]">
                                                    {f.rank_score != null ? fmt(f.rank_score) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </ReportCard>
                </div>
            )}
            {tab === 'overview' && <OverviewTab summary={summary} />}

            {tab === 'faculties' && (
                <ReportCard icon={GraduationCap} title="Все факультеты">
                    <div className="admin-table-wrap">
                        <table className="admin-data-table min-w-[480px]">
                            <thead>
                                <tr>
                                    <th className="ps-3 w-9 text-center">№</th>
                                    <th>Факультет</th>
                                    <th className="w-20 text-right">ППС</th>
                                    <th className="w-20 text-right">Записей</th>
                                    <th className="w-20 text-right">Утв.</th>
                                    <th className="w-20 text-right pe-3 text-[#067a75]">R</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(summary.faculties ?? []).map((f, i) => (
                                    <tr key={f.id}>
                                        <td className="ps-3 text-center text-xs text-slate-500">{i + 1}</td>
                                        <td className="font-medium">{f.name}</td>
                                        <td className="text-right tabular-nums">{f.user_count}</td>
                                        <td className="text-right tabular-nums">{f.total_entries}</td>
                                        <td className="text-right tabular-nums font-semibold text-emerald-600">{f.approved}</td>
                                        <td className="pe-3 text-right tabular-nums font-bold text-[#067a75]">
                                            {f.rank_score != null ? fmt(f.rank_score) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ReportCard>
            )}

            {tab === 'departments' && (
                <ReportCard icon={Building2} title="Все кафедры">
                    <DeptTable departments={summary.departments} showFaculty />
                </ReportCard>
            )}

            {tab === 'teachers' && (
                <PpsReportSection
                    rows={summary.top_teachers}
                    rankGroups={summary.teacher_rank_groups ?? []}
                    positionGroups={summary.teacher_position_groups ?? []}
                    academicYear={academicYear}
                    period={period}
                    filters={filters}
                    onExportExcel={(exportFilters) => onExportRatingExcel?.('teachers', exportFilters)}
                />
            )}

            {tab === 'hods' && (
                <ReportCard
                    icon={FileText}
                    title="Результаты рейтинга зав. кафедрами"
                    subtitle={(summary.top_hods?.length ?? 0) + ' чел.'}
                    actions={
                        <ExcelButton onClick={() => onExportRatingExcel?.('hods')} title="Экспортировать таблицу зав. кафедрами в Excel" />
                    }
                >
                    <ReportHeading
                        text="РЕЗУЛЬТАТЫ РЕЙТИНГА ЗАВ.КАФЕДРАМИ АО «КАЗУТБ ИМ. К. КУЛАЖАНОВА» ЗА"
                        period={period}
                        academicYear={academicYear}
                    />
                    <div className="mb-4">
                        <RatingFormulaBar
                            formula="R = (K1 + K2 + K3 + K4) - НПУ"
                            note="НПУ определяется по настройкам для зав. кафедрой"
                        />
                    </div>
                    {(summary.hod_rank_groups?.length ?? 0) > 0 && (
                        <div className="mb-4 space-y-2">
                            <p className="qd-field-label text-slate-500">Группировка рейтинга по диапазонам</p>
                            <RankBandGrid groups={summary.hod_rank_groups ?? []} />
                        </div>
                    )}
                    <div className="mb-4 space-y-2">
                        <span className="qd-field-label block">Поиск</span>
                        <Input
                            value={hodSearch}
                            onChange={(e) => setHodSearch(e.target.value)}
                            placeholder="Поиск по таблице зав. кафедрами"
                        />
                    </div>
                    <ProfessionalRatingTable
                        rows={summary.top_hods ?? []}
                        mode="hod"
                        searchQuery={hodSearch}
                        onRowClick={(row) => {
                            const params = {};
                            if (filters?.academic_year_id) params.academic_year_id = filters.academic_year_id;
                            if (filters?.period_id) params.period_id = filters.period_id;
                            router.get(route('kpi.summary.teacher', { userId: row.id }), params);
                        }}
                    />
                </ReportCard>
            )}

            {tab === 'deans' && (
                <ReportCard
                    icon={FileText}
                    title="Результаты рейтинга деканов"
                    subtitle={(summary.top_deans?.length ?? 0) + ' чел.'}
                    actions={
                        <ExcelButton onClick={() => onExportRatingExcel?.('deans')} title="Экспортировать таблицу деканов в Excel" />
                    }
                >
                    <ReportHeading
                        text="РЕЗУЛЬТАТЫ РЕЙТИНГА ДЕКАНОВ АО «КАЗУТБ ИМ. К. КУЛАЖАНОВА» ЗА"
                        period={period}
                        academicYear={academicYear}
                    />
                    <div className="mb-4">
                        <RatingFormulaBar
                            formula="R = (K1 + K2 + K3 + K4) - НПУ"
                            note="НПУ определяется по настройкам для декана"
                        />
                    </div>
                    {(summary.dean_rank_groups?.length ?? 0) > 0 && (
                        <div className="mb-4 space-y-2">
                            <p className="qd-field-label text-slate-500">Группировка рейтинга по диапазонам</p>
                            <RankBandGrid groups={summary.dean_rank_groups ?? []} />
                        </div>
                    )}
                    <div className="mb-4 space-y-2">
                        <span className="qd-field-label block">Поиск</span>
                        <Input
                            value={deanSearch}
                            onChange={(e) => setDeanSearch(e.target.value)}
                            placeholder="Поиск по таблице деканов"
                        />
                    </div>
                    <ProfessionalRatingTable
                        rows={summary.top_deans ?? []}
                        mode="dean"
                        searchQuery={deanSearch}
                        onRowClick={(row) => {
                            const params = {};
                            if (filters?.academic_year_id) params.academic_year_id = filters.academic_year_id;
                            if (filters?.period_id) params.period_id = filters.period_id;
                            router.get(route('kpi.summary.teacher', { userId: row.id }), params);
                        }}
                    />
                </ReportCard>
            )}
        </div>
    );
}

function StructuralView({ summary }) {
    const tabs = ROLE_TABS.department;
    const [tab, setTab] = useState('faculties');

    return (
        <div>
            <TabNav tabs={tabs} active={tab} onChange={setTab} />

            {tab === 'faculties' && (
                <ReportCard icon={BookOpen} title="Сводка по факультетам">
                    <div className="admin-table-wrap">
                        <table className="admin-data-table min-w-[540px]">
                            <thead>
                                <tr>
                                    <th className="ps-3 w-9 text-center">№</th>
                                    <th>Факультет</th>
                                    <th className="w-20 text-right">ППС</th>
                                    <th className="w-20 text-right">Записей</th>
                                    <th className="w-20 text-right">Утв.</th>
                                    <th className="w-24 text-right pe-3">Ожидает</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(summary.faculties ?? []).map((f, i) => (
                                    <tr key={f.id}>
                                        <td className="ps-3 text-center text-xs text-slate-500">{i + 1}</td>
                                        <td className="font-medium">{f.name}</td>
                                        <td className="text-right tabular-nums">{f.user_count}</td>
                                        <td className="text-right tabular-nums">{f.total_entries}</td>
                                        <td className="text-right tabular-nums font-semibold text-emerald-600">{f.approved}</td>
                                        <td className="pe-3 text-right tabular-nums font-semibold text-amber-700">{f.pending}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ReportCard>
            )}

            {tab === 'pending' && (
                <ReportCard icon={Users} title="Ожидают финального утверждения">
                    <RankingTable
                        teachers={summary.pending_teachers}
                        showDept
                        showFaculty
                        source="live"
                    />
                </ReportCard>
            )}
        </div>
    );
}

// ─── page header ──────────────────────────────────────────────────────────────

const SCOPE_DESC = {
    teacher: 'KPI — Мои показатели',
    hod: 'Зав. кафедрой — кафедра и ППС',
    department_head: 'Зав. кафедрой — кафедра и ППС',
    dean: 'Декан — факультет, кафедры и ППС',
    department: 'Структурный отдел — сводка',
    admin: 'Администратор — полный обзор системы',
};

// ─── main ─────────────────────────────────────────────────────────────────────

export default function Summary({
    roleSlug,
    summary = {},
    academicYear,
    period,
    filters = {},
    filterOptions = {},
}) {
    const normalizedRole = ['superadmin', 'structural'].includes(roleSlug) ? 'admin' : (roleSlug ?? 'teacher');
    const [adminTab, setAdminTab] = useState('overview');

    const renderContent = () => {
        if (normalizedRole === 'teacher') return <TeacherView summary={summary} />;
        if (normalizedRole === 'dean') return <DeanView summary={summary} academicYear={academicYear} period={period} filters={filters} />;
        if (normalizedRole === 'hod' || normalizedRole === 'department_head') return <HodView summary={summary} academicYear={academicYear} period={period} filters={filters} />;
        if (normalizedRole === 'department' || normalizedRole === 'structural') return <StructuralView summary={summary} />;
        return (
            <AdminView
                summary={summary}
                academicYear={academicYear}
                period={period}
                filters={filters}
                onExportRatingExcel={handleExportRatingExcel}
                tab={adminTab}
                setTab={setAdminTab}
            />
        );
    };

    const buildExportUrl = (path, extraParams = {}) => {
        const params = new URLSearchParams();
        if (filters?.academic_year_id) params.set('academic_year_id', String(filters.academic_year_id));
        if (filters?.period_id) params.set('period_id', String(filters.period_id));
        Object.entries(extraParams).forEach(([key, value]) => {
            if (value != null && value !== '') params.set(key, String(value));
        });
        const query = params.toString();
        return query ? `${path}?${query}` : path;
    };

    const handleExportRatingExcel = (report, exportFilters = {}) => {
        window.location.href = buildExportUrl('/kpi/summary/export-rating-excel', { report, ...exportFilters });
    };

    const handleExportSummaryExcel = () => {
        window.location.href = buildExportUrl('/kpi/summary/export-excel');
    };

    const handleExportCurrentExcel = () => {
        if (normalizedRole === 'admin') {
            if (adminTab === 'teachers' || adminTab === 'deans' || adminTab === 'hods') {
                handleExportRatingExcel(adminTab);
                return;
            }
        }

        handleExportSummaryExcel();
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI"
                    title="KPI — Сводка"
                    description={SCOPE_DESC[normalizedRole] ?? ''}
                    meta={period ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge tone="default">
                                <CalendarRange className="mr-1 h-3.5 w-3.5" />
                                {academicYear?.name ? `${academicYear.name} · ` : ''}{period.name}
                            </StatusBadge>
                            {period.status === 'active' && <StatusBadge tone="success">Активный</StatusBadge>}
                            {period.status === 'closed' && <StatusBadge tone="info">Закрыт</StatusBadge>}
                        </div>
                    ) : (academicYear?.name ? (
                        <StatusBadge tone="default">
                            <CalendarRange className="mr-1 h-3.5 w-3.5" />
                            {academicYear.name}
                        </StatusBadge>
                    ) : null)}
                />
            )}
        >
            <Head title="KPI — Сводка" />

            <div className="admin-page-wrap space-y-6">
                {renderContent()}
            </div>
        </AuthenticatedLayout>
    );
}
