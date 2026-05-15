import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router, usePage } from '@inertiajs/react';
import {
    BarChart3,
    BookOpen,
    Building2,
    CalendarRange,
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
    teaching: 'bg-blue-50 text-blue-700',
    science: 'bg-violet-50 text-violet-700',
    social: 'bg-emerald-50 text-emerald-700',
    qualification: 'bg-amber-50 text-amber-700',
    survey: 'bg-cyan-50 text-cyan-700',
    other: 'bg-muted text-muted-foreground',
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

const STATUS_VARIANTS = {
    draft: 'secondary',
    submitted: 'outline',
    returned: 'destructive',
    reviewed: 'secondary',
    pending_dean: 'outline',
    pending_structural: 'outline',
    approved: 'default',
    rejected: 'destructive',
    locked: 'secondary',
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

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(value, decimals = 2) {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n.toFixed(decimals) : '—';
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
    return row?.rate ?? row?.workload_rate ?? row?.stavka ?? '—';
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
    const k6 = Number(result?.k6 ?? 0);
    const rankScore = Number(result?.rank_score ?? (k1 + k2 + k3 + k4 + k5 - k6));

    return {
        id: summary?.user?.id,
        name: summary?.user?.name ?? '—',
        title: summary?.user?.title ?? '—',
        faculty_name: '—',
        department_name: summary?.user?.division ?? '—',
        rate: '—',
        k1,
        k2,
        k3,
        k4,
        k5,
        k6,
        rank_score: rankScore,
    };
}

const SELECT_CLS =
    'h-9 rounded-md border border-input bg-background/70 px-3 text-sm shadow-sm transition-colors hover:border-ring focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20';

// ─── stat card ───────────────────────────────────────────────────────────────

const ACCENT_TOP = {
    green: 'before:bg-emerald-500',
    blue: 'before:bg-blue-500',
    amber: 'before:bg-amber-500',
    teal: 'before:bg-teal-500',
    default: 'before:bg-border/60',
};

const ACCENT_VALUE = {
    green: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    teal: 'text-teal-600',
    default: 'text-foreground',
};

function StatCard({ icon: Icon, label, value, sub, accent = 'default' }) {
    const isEmpty = value === 0 || value === '0.00';
    return (
        <div
            className={[
                'relative overflow-hidden rounded-xl border border-border/80 bg-white/90 px-4 py-3.5 backdrop-blur',
                'before:absolute before:inset-x-0 before:top-0 before:h-0.5',
                ACCENT_TOP[accent] ?? ACCENT_TOP.default,
                'shadow-[0_6px_18px_rgba(15,36,63,0.07)]',
            ].join(' ')}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80 mb-1">{label}</p>
                    <p className={[
                        'text-2xl font-bold tabular-nums leading-none',
                        isEmpty ? 'text-muted-foreground/60' : (ACCENT_VALUE[accent] ?? 'text-foreground'),
                    ].join(' ')}>
                        {value}
                    </p>
                    {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
                </div>
                {Icon && (
                    <div className="shrink-0 rounded-lg bg-muted/50 p-1.5">
                        <Icon className="h-4 w-4 text-muted-foreground/60" />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── result score card ───────────────────────────────────────────────────────

function ResultScoreCard({ result, label = 'Итоговый рейтинг R' }) {
    if (!result) return null;
    const hasAnyScore = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].some((k) => result[k] > 0);
    const rVal = Number(result.rank_score ?? 0);

    return (
        <div className="rounded-xl border border-border/80 bg-white/90 backdrop-blur shadow-[0_6px_18px_rgba(15,36,63,0.07)] overflow-hidden">
            {/* accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-[#139AA4] via-[#1a6bb5] to-[#132844]" />
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
                {/* R score */}
                <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
                    <p className={[
                        'text-4xl font-bold tabular-nums leading-none',
                        rVal > 0 ? 'text-[#139AA4]' : 'text-muted-foreground/50',
                    ].join(' ')}>
                        {fmt(rVal)}
                    </p>
                </div>
                {/* K scores */}
                {hasAnyScore && (
                    <div className="flex gap-4">
                        {['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((k, i) => (
                            <div key={k} className="text-center min-w-[2.5rem]">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-0.5">K{i + 1}</p>
                                <p className={[
                                    'text-sm font-bold tabular-nums',
                                    result[k] > 0 ? 'text-foreground' : 'text-muted-foreground/40',
                                ].join(' ')}>
                                    {fmt(result[k])}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
                {result.approved_entries !== undefined && (
                    <div className="ml-auto text-right">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-0.5">Утв. записей</p>
                        <p className="text-lg font-bold text-emerald-600">{result.approved_entries}</p>
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
            <div className="admin-empty-state">
                <BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                Нет показателей KPI за выбранный период.<br />
                <span className="text-xs">Записи появятся после заполнения формы KPI.</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {allSections.map(([section, entries]) => {
                const sectionTotal = entries.reduce((s, e) => s + Number(e.points ?? 0), 0);
                const iconCls = SECTION_ICON_COLOR[section] ?? 'bg-muted text-muted-foreground';
                return (
                    <div key={section}>
                        <div className="mb-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${iconCls}`}>
                                    {SECTION_SHORT[section] ?? section}
                                </span>
                                <span className="text-sm font-medium text-foreground/80">
                                    {SECTION_LABELS[section] ?? section}
                                </span>
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground">
                                Итого: <span className="text-foreground">{fmt(sectionTotal)}</span> б.
                            </span>
                        </div>
                        <div className="admin-table-wrap">
                            <table className="admin-data-table min-w-[640px]">
                                <thead>
                                    <tr>
                                        <th className="ps-3 w-16">Код</th>
                                        <th>Показатель</th>
                                        <th className="w-14 text-right">Ед.</th>
                                        <th className="w-14 text-right">План</th>
                                        <th className="w-14 text-right">Факт</th>
                                        <th className="w-20 text-right">Баллы</th>
                                        <th className="w-28 text-right pe-3">Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr key={entry.id}>
                                            <td className="ps-3 text-xs text-muted-foreground font-mono">{entry.code ?? '—'}</td>
                                            <td className="font-medium">{entry.name}</td>
                                            <td className="text-right text-muted-foreground">{entry.unit ?? '—'}</td>
                                            <td className="text-right tabular-nums">{entry.plan_value ?? '—'}</td>
                                            <td className="text-right tabular-nums">{entry.fact_value ?? '—'}</td>
                                            <td className="text-right tabular-nums font-semibold">{fmt(entry.points)}</td>
                                            <td className="text-right pe-3">
                                                <Badge variant={STATUS_VARIANTS[entry.status] ?? 'secondary'} className="text-[0.7rem]">
                                                    {STATUS_LABELS[entry.status] ?? entry.status}
                                                </Badge>
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
        <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-2.5 py-0.5 text-xs">
                <span className="text-muted-foreground">Всего:</span>
                <span className="font-semibold text-foreground">{totals.total}</span>
            </span>
            {totals.submitted > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-2.5 py-0.5 text-xs">
                    <span className="text-muted-foreground">Подано:</span>
                    <span className="font-semibold text-foreground">{totals.submitted}</span>
                </span>
            )}
            {totals.pending > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/60 px-2.5 py-0.5 text-xs">
                    <span className="text-amber-700">На проверке: <strong>{totals.pending}</strong></span>
                </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/60 px-2.5 py-0.5 text-xs">
                <span className="text-emerald-700">Утверждено: <strong>{totals.approved}</strong></span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-2.5 py-0.5 text-xs">
                <span className="text-muted-foreground">Баллов:</span>
                <span className="font-semibold text-foreground">{fmt(totals.total_points)}</span>
            </span>
        </div>
    );
}

// ─── ranking table ───────────────────────────────────────────────────────────

function RankingTable({ teachers, showFaculty = false, showDept = false, showKScores = false, source }) {
    if (!teachers || teachers.length === 0) {
        return (
            <div className="admin-empty-state">
                <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                Нет данных о ППС за выбранный период.<br />
                <span className="text-xs">Данные появятся после формирования KPI-записей.</span>
            </div>
        );
    }

    const isLive = source === 'live' || teachers[0]?.source === 'live';

    return (
        <div>
            {isLive && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
                    <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                    Отображаются оперативные данные — период ещё не закрыт. Финальный рейтинг R появится после утверждения.
                </div>
            )}
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
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
                                    <th className="w-12 text-right">K6</th>
                                    <th className="w-16 text-right pe-3 text-[#139AA4]">R</th>
                                </>
                            ) : (
                                <>
                                    <th className="w-16 text-right">Утв.</th>
                                    <th className="w-20 text-right pe-3 text-[#139AA4]">
                                        {isLive ? 'Баллы' : 'R'}
                                    </th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {teachers.map((t, i) => (
                            <tr key={t.id ?? i}>
                                <td className="ps-3 text-center text-xs text-muted-foreground">{i + 1}</td>
                                <td className="font-medium">{t.name}</td>
                                {showDept && <td className="text-sm text-muted-foreground">{t.department_name ?? '—'}</td>}
                                {showFaculty && <td className="text-sm text-muted-foreground">{t.faculty_name ?? '—'}</td>}
                                <td className="text-sm text-muted-foreground max-w-[200px] truncate">{t.title ?? '—'}</td>
                                {showKScores ? (
                                    <>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k1)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k2)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k3)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k4)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k5)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k6)}</td>
                                        <td className="pe-3 text-right tabular-nums font-bold text-[#139AA4]">{fmt(t.rank_score)}</td>
                                    </>
                                ) : (
                                    <>
                                        <td className="text-right tabular-nums font-medium text-emerald-600">{t.approved_entries}</td>
                                        <td className="pe-3 text-right tabular-nums font-bold text-[#139AA4]">{fmt(t.rank_score)}</td>
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
        <div className="mb-4 overflow-hidden rounded-lg border border-[#132844]/20 bg-[#132844]/5">
            <div className="flex items-center gap-2.5 border-b border-[#132844]/10 bg-[#132844]/8 px-4 py-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[#132844]/60" />
                <span className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#132844]/70">
                    Официальный отчёт
                </span>
            </div>
            <div className="px-4 py-3 text-center">
                <p className="text-[0.75rem] font-bold uppercase leading-relaxed tracking-[0.08em] text-[#132844]">
                    {text}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#139AA4]">
                    {academicYear?.name ?? '—'}
                </p>
            </div>
        </div>
    );
}

function ProfessionalRatingTable({ rows, mode = 'pps', onRowClick }) {
    if (!rows?.length) {
        return (
            <div className="admin-empty-state">
                <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                Нет данных для выбранной формы отчёта.
            </div>
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
                            <th className="w-20 text-right text-[#139AA4]">Рейтинг</th>
                            <th className="w-14 text-right">УМР</th>
                            <th className="w-14 text-right">НИР</th>
                            <th className="w-14 text-right">СВР</th>
                            <th className="w-14 text-right pe-3">УПК</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr
                                key={row.id ?? i}
                                className={onRowClick && row.id ? 'cursor-pointer hover:bg-muted/20' : ''}
                                onClick={() => onRowClick && row.id && onRowClick(row)}
                            >
                                <td className="ps-3 text-center text-xs text-muted-foreground">{i + 1}</td>
                                <td className="text-sm max-w-[10rem] truncate" title={row.faculty_name ?? ''}>{row.faculty_name ?? '—'}</td>
                                <td className="text-sm max-w-[11rem] truncate" title={row.department_name ?? ''}>{row.department_name ?? '—'}</td>
                                <td className="font-medium max-w-[11rem] truncate" title={row.name ?? ''}>{row.name ?? '—'}</td>
                                <td className="text-right tabular-nums">{fmt(getNpuValue(row))}</td>
                                <td className="text-right tabular-nums font-bold text-[#139AA4]">{fmt(row.rank_score)}</td>
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
                            <th className="w-20 text-right text-[#139AA4]">Рейтинг</th>
                            <th className="w-14 text-right">УМР</th>
                            <th className="w-14 text-right">НИР</th>
                            <th className="w-14 text-right">СВР</th>
                            <th className="w-14 text-right pe-3">УПК</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr
                                key={row.id ?? i}
                                className={onRowClick && row.id ? 'cursor-pointer hover:bg-muted/20' : ''}
                                onClick={() => onRowClick && row.id && onRowClick(row)}
                            >
                                <td className="ps-3 text-center text-xs text-muted-foreground">{i + 1}</td>
                                <td className="text-sm max-w-[13rem] truncate" title={row.faculty_name ?? ''}>{row.faculty_name ?? '—'}</td>
                                <td className="font-medium max-w-[13rem] truncate" title={row.name ?? ''}>{row.name ?? '—'}</td>
                                <td className="text-right tabular-nums">{fmt(getNpuValue(row))}</td>
                                <td className="text-right tabular-nums font-bold text-[#139AA4]">{fmt(row.rank_score)}</td>
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
                        <th className="w-40">Факультет</th>
                        <th className="w-40">Кафедра</th>
                        <th className="w-44">Должность</th>
                        <th className="w-14 text-right">Ставка</th>
                        <th className="w-14 text-right">УМР</th>
                        <th className="w-14 text-right">НИР</th>
                        <th className="w-14 text-right">СВР</th>
                        <th className="w-14 text-right">УПК</th>
                        <th className="w-14 text-right">К5</th>
                        <th className="w-14 text-right">К6</th>
                        <th className="w-20 text-right text-[#139AA4]">Рейтинг</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr
                            key={row.id ?? i}
                            className={onRowClick && row.id ? 'cursor-pointer hover:bg-muted/20' : ''}
                            onClick={() => onRowClick && row.id && onRowClick(row)}
                        >
                            <td className="ps-3 text-center text-xs text-muted-foreground">{i + 1}</td>
                            <td className="font-medium max-w-[11rem] truncate" title={row.name ?? ''}>{row.name ?? '—'}</td>
                            <td className="text-sm max-w-[10rem] truncate" title={row.faculty_name ?? ''}>{row.faculty_name ?? '—'}</td>
                            <td className="text-sm max-w-[10rem] truncate" title={row.department_name ?? ''}>{row.department_name ?? '—'}</td>
                            <td className="text-sm text-muted-foreground max-w-[220px] truncate">{row.title ?? '—'}</td>
                            <td className="text-right tabular-nums">{getRateValue(row)}</td>
                            <td className="text-right tabular-nums">{fmt(row.k1)}</td>
                            <td className="text-right tabular-nums">{fmt(row.k2)}</td>
                            <td className="text-right tabular-nums">{fmt(row.k3)}</td>
                            <td className="text-right tabular-nums">{fmt(row.k4)}</td>
                            <td className="text-right tabular-nums">{fmt(row.k5)}</td>
                            <td className="text-right tabular-nums">{fmt(row.k6)}</td>
                            <td className="pe-3 text-right tabular-nums font-bold text-[#139AA4]">{fmt(row.rank_score)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function PpsReportSection({ rows, academicYear, period, subtitle, filters, onExportExcel }) {
    const [facultyFilter, setFacultyFilter] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');

    const allRows = rows ?? [];

    const facultyOptions = useMemo(() => {
        return Array.from(new Set(
            allRows
                .map((row) => String(row?.faculty_name ?? '').trim())
                .filter(Boolean),
        )).sort((a, b) => a.localeCompare(b, 'ru'));
    }, [allRows]);

    const departmentOptions = useMemo(() => {
        const source = facultyFilter === ''
            ? allRows
            : allRows.filter((row) => String(row?.faculty_name ?? '').trim() === facultyFilter);

        return Array.from(new Set(
            source
                .map((row) => String(row?.department_name ?? '').trim())
                .filter(Boolean),
        )).sort((a, b) => a.localeCompare(b, 'ru'));
    }, [allRows, facultyFilter]);

    const filteredRows = useMemo(() => {
        return allRows.filter((row) => {
            const facultyName = String(row?.faculty_name ?? '').trim();
            const departmentName = String(row?.department_name ?? '').trim();

            if (facultyFilter !== '' && facultyName !== facultyFilter) {
                return false;
            }

            if (departmentFilter !== '' && departmentName !== departmentFilter) {
                return false;
            }

            return true;
        });
    }, [allRows, facultyFilter, departmentFilter]);

    const handleRowClick = (row) => {
        const params = {};
        if (filters?.academic_year_id) params.academic_year_id = filters.academic_year_id;
        router.get(route('kpi.summary.teacher', { userId: row.id }), params);
    };

    return (
        <div className="space-y-4">
            <InfoBar>
                <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
                K1 — УМР, K2 — НИР, K3 — СВР, K4 — УПК, K5 — Анкетирование, K6 — НПУ. Нажмите на строку для просмотра карточки сотрудника.
            </InfoBar>

            <ReportCard
                icon={FileText}
                title="Результаты профессионального рейтинга ППС"
                subtitle={subtitle}
                actions={
                    onExportExcel
                        ? (
                            <button
                                type="button"
                                onClick={onExportExcel}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white hover:border-border transition-colors"
                                title="Экспортировать таблицу ППС в Excel"
                            >
                                <FileText className="h-3.5 w-3.5" />
                                Excel
                            </button>
                        )
                        : null
                }
            >
                <div className="mb-4">
                    <RatingFormulaBar
                        formula="R = (K1 + K2 + K3 + K4 + K5) - K6"
                        note="K6 соответствует НПУ"
                    />
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <select
                        className={SELECT_CLS + ' pe-8'}
                        value={facultyFilter}
                        onChange={(e) => {
                            setFacultyFilter(e.target.value);
                            setDepartmentFilter('');
                        }}
                    >
                        <option value="">Все факультеты</option>
                        {facultyOptions.map((faculty) => (
                            <option key={faculty} value={faculty}>{faculty}</option>
                        ))}
                    </select>

                    <select
                        className={SELECT_CLS + ' pe-8'}
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                    >
                        <option value="">Все кафедры</option>
                        {departmentOptions.map((department) => (
                            <option key={department} value={department}>{department}</option>
                        ))}
                    </select>

                    <span className="ml-auto text-xs text-muted-foreground">
                        Показано: {filteredRows.length} из {allRows.length}
                    </span>
                </div>

                <ReportHeading
                    text="РЕЗУЛЬТАТЫ ПРОФЕССИОНАЛЬНОГО РЕЙТИНГА ППС АО «КАЗУТБ ИМ. К. КУЛАЖАНОВА» ЗА"
                    period={period}
                    academicYear={academicYear}
                />
                <ProfessionalRatingTable rows={filteredRows} mode="pps" onRowClick={handleRowClick} />
            </ReportCard>
        </div>
    );
}

// ─── department table ─────────────────────────────────────────────────────────

function DeptTable({ departments, showFaculty = false }) {
    if (!departments || departments.length === 0) {
        return (
            <div className="admin-empty-state">
                <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                Нет данных по кафедрам за выбранный период.
            </div>
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
                        <th className="w-20 text-right pe-3 text-[#139AA4]">R</th>
                    </tr>
                </thead>
                <tbody>
                    {departments.map((d, i) => (
                        <tr key={d.id ?? i}>
                            <td className="ps-3 text-center text-xs text-muted-foreground">{i + 1}</td>
                            <td className="font-medium">{d.name}</td>
                            {showFaculty && <td className="text-sm text-muted-foreground">{d.faculty_name ?? '—'}</td>}
                            <td className="text-right tabular-nums">{d.teacher_count ?? d.user_count ?? '—'}</td>
                            <td className="text-right tabular-nums">{d.total_entries ?? d.approved_entries ?? '—'}</td>
                            <td className="text-right tabular-nums font-semibold text-emerald-600">{d.approved ?? d.approved_entries ?? '—'}</td>
                            <td className="pe-3 text-right tabular-nums font-bold text-[#139AA4]">
                                {d.rank_score != null ? fmt(d.rank_score) : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── filter bar ───────────────────────────────────────────────────────────────

function FilterBar({ filters, filterOptions }) {
    const handleChange = (key, value) => {
        const params = {};
        params.academic_year_id = value || undefined;
        router.get(route('kpi.summary'), params, { preserveScroll: true, replace: true });
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
                <select
                    className={SELECT_CLS + ' pe-8'}
                    value={filters.academic_year_id ?? ''}
                    onChange={(e) => handleChange('academic_year_id', e.target.value)}
                >
                    <option value="">— Учебный год —</option>
                    {(filterOptions.academicYears ?? []).map((y) => (
                        <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

// ─── tab nav ─────────────────────────────────────────────────────────────────

function TabNav({ tabs, active, onChange }) {
    return (
        <div className="mb-5 flex items-center gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
            {tabs.map((tab) => {
                const Icon = TAB_ICONS[tab];
                const isActive = active === tab;
                return (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => onChange(tab)}
                        className={[
                            'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all',
                            isActive
                                ? 'bg-white shadow-sm text-[#132844] border border-border/60'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/60',
                        ].join(' ')}
                    >
                        {Icon && <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#139AA4]' : ''}`} />}
                        {TAB_LABELS[tab] ?? tab}
                    </button>
                );
            })}
        </div>
    );
}

// ─── section card ─────────────────────────────────────────────────────────────

function ReportCard({ icon: Icon, title, subtitle, children, accent, actions }) {
    return (
        <Card className="admin-surface">
            <CardHeader className="pb-3 pt-4">
                <CardTitle className="flex items-center justify-between gap-3 text-sm font-semibold text-[#132844]">
                    <span className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4 text-[#139AA4]" />}
                        {title}
                    </span>
                    <span className="flex items-center gap-2">
                        {subtitle && <span className="font-normal text-muted-foreground text-xs">{subtitle}</span>}
                        {actions}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

// ─── role-specific notice bar ─────────────────────────────────────────────────

function InfoBar({ children }) {
    return (
        <div className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/30 px-3.5 py-2.5 text-sm text-muted-foreground">
            {children}
        </div>
    );
}

function RatingFormulaBar({ formula, note }) {
    return (
        <InfoBar>
            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
                <span className="font-medium text-foreground">Формула рейтинга: </span>
                <span className="font-semibold text-[#132844]">{formula}</span>
                {note && <span className="text-muted-foreground"> · {note}</span>}
            </div>
        </InfoBar>
    );
}

// ─── role views ───────────────────────────────────────────────────────────────

function TeacherView({ summary }) {
    const hasEntries = Object.keys(summary.entries ?? {}).length > 0;
    const mineRatingRow = useMemo(() => buildMinePpsRow(summary), [summary]);

    return (
        <div className="space-y-4">
            {summary.result ? (
                <ResultScoreCard result={summary.result} label="Мой итоговый рейтинг R" />
            ) : (
                <InfoBar>
                    <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
                    Итоговый рейтинг ещё не сформирован — период не закрыт. Формула: R = (K1 + K2 + K3 + K4 + K5) - K6. Ниже отображаются текущие данные.
                </InfoBar>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={BarChart3} label="Всего записей" value={summary.totals?.total ?? 0} />
                <StatCard icon={TrendingUp} label="Утверждено" value={summary.totals?.approved ?? 0} accent="green" />
                <StatCard label="На проверке" value={(summary.totals?.submitted ?? 0) + (summary.totals?.pending ?? 0)} accent="amber" />
                <StatCard label="Баллов" value={fmt(summary.totals?.total_points)} accent="teal" />
            </div>

            <ReportCard
                icon={FileText}
                title="Результаты рейтинга ППС"
                subtitle="Моя строка рейтинга"
            >
                <RatingFormulaBar
                    formula="R = (K1 + K2 + K3 + K4 + K5) - K6"
                    note="K1 — УМР, K2 — НИР, K3 — СВР, K4 — УПК"
                />
                <div className="mt-3">
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
                    <div className="admin-empty-state">
                        Нет показателей KPI за выбранный период.<br />
                        <span className="text-xs">Перейдите в «KPI — Мои показатели» для заполнения формы.</span>
                    </div>
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
                <div className="space-y-4">
                    {summary.own_result ? (
                        <ResultScoreCard result={summary.own_result} label="Мой рейтинг R (зав. кафедрой)" />
                    ) : (
                        <InfoBar>
                            <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
                            Итоговый рейтинг ещё не сформирован. Формула: R = (K1 + K2 + K3 + K4) - НПУ. Отображаются текущие данные.
                        </InfoBar>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard icon={BarChart3} label="Всего записей" value={summary.own_totals?.total ?? 0} />
                        <StatCard icon={TrendingUp} label="Утверждено" value={summary.own_totals?.approved ?? 0} accent="green" />
                        <StatCard label="На проверке" value={(summary.own_totals?.submitted ?? 0) + (summary.own_totals?.pending ?? 0)} accent="amber" />
                        <StatCard label="Баллов" value={fmt(summary.own_totals?.total_points)} accent="teal" />
                    </div>
                    <ReportCard icon={BarChart3} title="KPI — Мои показатели">
                        <TotalsChips totals={summary.own_totals} />
                        <SectionEntriesTable sections={summary.own_entries ?? {}} />
                    </ReportCard>
                </div>
            )}

            {validTab === 'department' && (
                <div className="space-y-4">
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                <div className="space-y-4">
                    {summary.own_result ? (
                        <ResultScoreCard result={summary.own_result} label="Мой рейтинг R (декан)" />
                    ) : (
                        <InfoBar>
                            <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
                            Итоговый рейтинг ещё не сформирован. Формула: R = (K1 + K2 + K3 + K4) - НПУ. Отображаются текущие данные.
                        </InfoBar>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard icon={BarChart3} label="Всего записей" value={summary.own_totals?.total ?? 0} />
                        <StatCard icon={TrendingUp} label="Утверждено" value={summary.own_totals?.approved ?? 0} accent="green" />
                        <StatCard label="На проверке" value={(summary.own_totals?.submitted ?? 0) + (summary.own_totals?.pending ?? 0)} accent="amber" />
                        <StatCard label="Баллов" value={fmt(summary.own_totals?.total_points)} accent="teal" />
                    </div>
                    <ReportCard icon={BarChart3} title="KPI — Мои показатели">
                        <TotalsChips totals={summary.own_totals} />
                        <SectionEntriesTable sections={summary.own_entries ?? {}} />
                    </ReportCard>
                </div>
            )}

            {validTab === 'departments' && (
                <div className="space-y-4">
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
    approved: '#10b981',
    submitted: '#3b82f6',
    reviewed: '#8b5cf6',
    pending_dean: '#f59e0b',
    pending_structural: '#f97316',
    returned: '#ef4444',
    rejected: '#dc2626',
    locked: '#6b7280',
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
                <span className="text-xs text-muted-foreground">—</span>
            </div>
        );
    }
    let cumulative = 0;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
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

function HBar({ label, value, maxValue, displayValue, barClass = 'bg-[#139AA4]' }) {
    const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
        <div>
            <div className="mb-0.5 flex items-center justify-between">
                <span className="max-w-[60%] truncate text-xs font-medium text-foreground/80">{label}</span>
                <span className="tabular-nums text-xs font-semibold text-[#139AA4]">{displayValue ?? value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
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
    teaching: 'bg-blue-500',
    science: 'bg-violet-500',
    social: 'bg-emerald-500',
    qualification: 'bg-amber-500',
    survey: 'bg-cyan-500',
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
        const kKey = sectionToK[topFilter.section];
        if (kKey) t = [...t].sort((a, b) => Number(b[kKey] ?? 0) - Number(a[kKey] ?? 0));
        return t.slice(0, 10);
    }, [summary.top_teachers, topFilter]);

    const card = 'rounded-xl border border-border/80 bg-white/90 shadow-[0_6px_18px_rgba(15,36,63,0.07)] p-4';

    return (
        <div className="space-y-4">
            {/* ── Stat row ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status donut */}
                <div className={card}>
                    <p className="mb-3 text-sm font-semibold text-[#132844]">Распределение по статусам</p>
                    <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                            <DonutChart segments={donutSegments} size={120} thickness={26} />
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-xl font-bold leading-none text-foreground">{approvalRate}%</span>
                                <span className="mt-0.5 text-[0.6rem] uppercase tracking-wide text-muted-foreground">Утв.</span>
                            </div>
                        </div>
                        <div className="min-w-0 space-y-1.5">
                            {donutSegments.map((seg) => (
                                <div key={seg.key} className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: seg.color }} />
                                    <span className="min-w-0 truncate text-xs text-muted-foreground">{seg.label}</span>
                                    <span className="ml-auto tabular-nums text-xs font-semibold">{seg.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Section distribution */}
                <div className={card}>
                    <p className="mb-3 text-sm font-semibold text-[#132844]">Записи по разделам KPI</p>
                    {sectionItems.length > 0 ? (
                        <div className="space-y-3">
                            {sectionItems.map((s) => (
                                <div key={s.key}>
                                    <div className="mb-0.5 flex items-center justify-between">
                                        <span className="text-xs font-medium text-foreground/80">{s.shortLabel}</span>
                                        <div className="flex items-center gap-3 text-xs">
                                            <span className="text-muted-foreground">{s.value} зап.</span>
                                            <span className="font-semibold text-emerald-600">{s.approved} утв.</span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-500 ${s.barClass}`}
                                            style={{ width: `${Math.max((s.value / maxSectionTotal) * 100, s.value > 0 ? 2 : 0)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">Нет данных</p>
                    )}
                </div>

                {/* Faculty approved bars */}
                <div className={card}>
                    <p className="mb-3 text-sm font-semibold text-[#132844]">Факультеты — утверждено / всего</p>
                    {faculties.length > 0 ? (
                        <div className="space-y-2.5">
                            {[...faculties]
                                .sort((a, b) => b.approved - a.approved)
                                .map((f) => (
                                    <HBar
                                        key={f.id}
                                        label={f.name}
                                        value={f.approved}
                                        maxValue={maxFacultyApproved}
                                        displayValue={`${f.approved} / ${f.total_entries}`}
                                        barClass="bg-gradient-to-r from-[#139AA4] to-[#1a6bb5]"
                                    />
                                ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">Нет данных</p>
                    )}
                </div>
            </div>

            {/* ── Faculty rating with progress bars ── */}
            <div className={card}>
                <p className="mb-3 text-sm font-semibold text-[#132844]">Рейтинг факультетов</p>
                {faculties.length > 0 ? (
                    <div className="space-y-3">
                        {[...faculties]
                            .sort((a, b) => (b.rank_score ?? b.approved) - (a.rank_score ?? a.approved))
                            .map((f, i) => (
                                <div key={f.id} className="flex items-center gap-3">
                                    <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-0.5 flex items-center justify-between gap-2">
                                            <span className="truncate text-xs font-medium">{f.name}</span>
                                            <div className="flex shrink-0 items-center gap-3 text-xs">
                                                <span className="text-muted-foreground">{f.user_count} чел.</span>
                                                <span className="font-semibold text-emerald-600">{f.approved} утв.</span>
                                                {f.rank_score != null && (
                                                    <span className="w-16 text-right font-bold tabular-nums text-[#139AA4]">
                                                        R {fmt(f.rank_score)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                                            <div
                                                className="h-1.5 rounded-full bg-gradient-to-r from-[#139AA4] to-[#1a6bb5]"
                                                style={{ width: `${(f.approved / maxFacultyApproved) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">Нет данных</p>
                )}
            </div>

            {/* ── Top-10 ПС ── */}
            <div className={card}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#132844]">Топ-10 ППС</p>
                    <div className="ml-auto flex flex-wrap gap-2">
                        <select
                            className={SELECT_CLS + ' pe-8'}
                            value={topFilter.faculty}
                            onChange={(e) => setTopFilter((f) => ({ ...f, faculty: e.target.value }))}
                        >
                            <option value="">Все факультеты</option>
                            {facultyNames.map((fac) => (
                                <option key={fac} value={fac}>{fac}</option>
                            ))}
                        </select>
                        <select
                            className={SELECT_CLS + ' pe-8'}
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
                    </div>
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
                                    <th className="w-16 text-right pe-3 text-[#139AA4]">R</th>
                                </tr>
                            </thead>
                            <tbody>
                                {top10.map((t, i) => (
                                    <tr key={t.id ?? i}>
                                        <td className="ps-3 text-center text-xs text-muted-foreground">{i + 1}</td>
                                        <td className="font-medium">{t.name}</td>
                                        <td className="max-w-[9rem] truncate text-sm text-muted-foreground" title={t.faculty_name ?? ''}>
                                            {t.faculty_name ?? '—'}
                                        </td>
                                        <td className="max-w-[9rem] truncate text-sm text-muted-foreground" title={t.department_name ?? ''}>
                                            {t.department_name ?? '—'}
                                        </td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k1)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k2)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k3)}</td>
                                        <td className="text-right tabular-nums text-sm">{fmt(t.k4)}</td>
                                        <td className="pe-3 text-right tabular-nums font-bold text-[#139AA4]">{fmt(t.rank_score)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="admin-empty-state">
                        <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                        Нет данных для выбранных фильтров.
                    </div>
                )}
            </div>
        </div>
    );
}


function AdminView({ summary, academicYear, period, filters, onExportRatingExcel }) {
    const tabs = ROLE_TABS.admin;
    const [tab, setTab] = useState('overview');

    const statusCounts = summary.status_counts ?? {};
    const nonDraftTotal = Object.entries(statusCounts)
        .filter(([s]) => s !== 'draft')
        .reduce((sum, [, v]) => sum + Number(v), 0);

    return (
        <div>
            <TabNav tabs={tabs} active={tab} onChange={setTab} />

            {tab === 'overview' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        <StatCard icon={BarChart3} label="Всего (без черновиков)" value={nonDraftTotal} />
                        <StatCard icon={TrendingUp} label="Утверждено" value={statusCounts.approved ?? 0} accent="green" />
                        <StatCard label="Подано" value={statusCounts.submitted ?? 0} accent="blue" />
                        <StatCard label="На утверждении" value={(statusCounts.pending_structural ?? 0) + (statusCounts.pending_dean ?? 0)} accent="amber" />
                    </div>

                    <ReportCard icon={GraduationCap} title="Факультеты — обзор">
                        {!summary.faculties?.length ? (
                            <div className="admin-empty-state">Нет данных.</div>
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
                                            <th className="w-20 text-right pe-3 text-[#139AA4]">R</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(summary.faculties ?? []).map((f) => (
                                            <tr key={f.id}>
                                                <td className="ps-3 font-medium">{f.name}</td>
                                                <td className="text-right tabular-nums">{f.user_count}</td>
                                                <td className="text-right tabular-nums">{f.total_entries}</td>
                                                <td className="text-right tabular-nums font-semibold text-emerald-600">{f.approved}</td>
                                                <td className="text-right tabular-nums text-muted-foreground text-xs">{pct(f.approved, f.total_entries)}</td>
                                                <td className="pe-3 text-right tabular-nums font-bold text-[#139AA4]">
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
                                    <th className="w-20 text-right pe-3 text-[#139AA4]">R</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(summary.faculties ?? []).map((f, i) => (
                                    <tr key={f.id}>
                                        <td className="ps-3 text-center text-xs text-muted-foreground">{i + 1}</td>
                                        <td className="font-medium">{f.name}</td>
                                        <td className="text-right tabular-nums">{f.user_count}</td>
                                        <td className="text-right tabular-nums">{f.total_entries}</td>
                                        <td className="text-right tabular-nums font-semibold text-emerald-600">{f.approved}</td>
                                        <td className="pe-3 text-right tabular-nums font-bold text-[#139AA4]">
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
                    academicYear={academicYear}
                    period={period}
                    filters={filters}
                    onExportExcel={() => onExportRatingExcel?.('teachers')}
                />
            )}

            {tab === 'hods' && (
                <ReportCard
                    icon={FileText}
                    title="Результаты рейтинга зав. кафедрами"
                    subtitle={(summary.top_hods?.length ?? 0) + ' чел.'}
                    actions={
                        <button
                            type="button"
                            onClick={() => onExportRatingExcel?.('hods')}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white hover:border-border transition-colors"
                            title="Экспортировать таблицу зав. кафедрами в Excel"
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Excel
                        </button>
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
                    <ProfessionalRatingTable
                        rows={summary.top_hods ?? []}
                        mode="hod"
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
                        <button
                            type="button"
                            onClick={() => onExportRatingExcel?.('deans')}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white hover:border-border transition-colors"
                            title="Экспортировать таблицу деканов в Excel"
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Excel
                        </button>
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
                    <ProfessionalRatingTable
                        rows={summary.top_deans ?? []}
                        mode="dean"
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
                                        <td className="ps-3 text-center text-xs text-muted-foreground">{i + 1}</td>
                                        <td className="font-medium">{f.name}</td>
                                        <td className="text-right tabular-nums">{f.user_count}</td>
                                        <td className="text-right tabular-nums">{f.total_entries}</td>
                                        <td className="text-right tabular-nums font-semibold text-emerald-600">{f.approved}</td>
                                        <td className="pe-3 text-right tabular-nums font-semibold text-amber-600">{f.pending}</td>
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
    const { flash } = usePage().props;
    const normalizedRole = ['superadmin', 'structural'].includes(roleSlug) ? 'admin' : (roleSlug ?? 'teacher');

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

    const handleExportRatingExcel = (report) => {
        window.location.href = buildExportUrl('/kpi/summary/export-rating-excel', { report });
    };

    const handleExportSummaryExcel = () => {
        window.location.href = buildExportUrl('/kpi/summary/export-excel');
    };

    return (
        <AuthenticatedLayout>
            <Head title="KPI — Сводка" />

            <div className="admin-page-wrap">
                {/* ── Report header ──────────────────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/80 bg-white/90 px-5 py-4 shadow-[0_6px_18px_rgba(15,36,63,0.07)] backdrop-blur">
                    {/* left: title block */}
                    <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#139AA4] to-[#1a6bb5] shadow-sm">
                            <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold leading-tight text-[#132844]">KPI — Сводка</h1>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {SCOPE_DESC[normalizedRole] ?? ''}
                            </p>
                        </div>
                    </div>

                    {/* right: filters + period label */}
                    <div className="flex flex-col items-end gap-2">
                        <FilterBar filters={filters} filterOptions={filterOptions} />
                        <button
                            type="button"
                            onClick={handleExportSummaryExcel}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white hover:border-border transition-colors"
                            title="Экспортировать текущую сводку в Excel"
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Excel
                        </button>
                        <div className="flex items-center gap-2">
                            {period ? (
                                <>
                                    <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                        {academicYear?.name && <span className="mr-1">{academicYear.name} ·</span>}
                                        <strong className="text-foreground">{period.name}</strong>
                                    </span>
                                    {period.status === 'active' && (
                                        <Badge variant="default" className="h-5 text-[0.65rem] px-2">Активный</Badge>
                                    )}
                                    {period.status === 'closed' && (
                                        <Badge variant="secondary" className="h-5 text-[0.65rem] px-2">Закрыт</Badge>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs text-amber-600 flex items-center gap-1">
                                    <CalendarRange className="h-3.5 w-3.5" />
                                    Активный период не найден
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {flash?.success && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                        {flash.success}
                    </div>
                )}

                {renderContent()}
            </div>
        </AuthenticatedLayout>
    );
}
