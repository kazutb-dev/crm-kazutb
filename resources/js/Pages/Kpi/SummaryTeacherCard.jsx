import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, FilterBar, FormField, Notice, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router } from '@inertiajs/react';
import {
    ArrowLeft,
    BarChart3,
    BookOpen,
    CalendarRange,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    FileText,
    Sigma,
    TrendingUp,
    User,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';

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

const ACTION_LABELS = {
    submit: 'Подано',
    return: 'Возвращено',
    review: 'Проверено',
    approve: 'Утверждено',
    reject: 'Отклонено',
    lock: 'Заблокировано',
};

const ACTION_COLORS = {
    submit: 'text-blue-700 bg-blue-50 border-blue-200',
    return: 'text-orange-700 bg-orange-50 border-orange-200',
    review: 'text-teal-700 bg-teal-50 border-teal-200',
    approve: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    reject: 'text-red-700 bg-red-50 border-red-200',
    lock: 'text-slate-600 bg-slate-100 border-slate-200',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(value, decimals = 2) {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n.toFixed(decimals) : '—';
}

function fmtDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }).format(d);
}

function formatFileSize(value) {
    const parsed = Number(value ?? 0);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return '0 Б';
    }

    if (parsed >= 1024 * 1024) {
        return `${(parsed / (1024 * 1024)).toFixed(2)} МБ`;
    }

    if (parsed >= 1024) {
        return `${(parsed / 1024).toFixed(1)} КБ`;
    }

    return `${parsed} Б`;
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
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        return fmt(numeric);
    }

    return String(value);
}

function fmtPercent(value) {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '—';
    }

    return `${fmt(numeric)}%`;
}

// ─── filter bar ───────────────────────────────────────────────────────────────

function PeriodFilters({ teacherId, filters, filterOptions, academicYear, period }) {
    const handleChange = (key, value) => {
        const params = {};
        if (key === 'academic_year_id') {
            params.academic_year_id = value || undefined;
            params.period_id = undefined;
        } else {
            params.academic_year_id = filters.academic_year_id || undefined;
            params.period_id = value || undefined;
        }
        router.get(route('kpi.summary.teacher', { userId: teacherId }), params, {
            preserveScroll: true, replace: true,
        });
    };

    return (
        <FilterBar>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <FormField label="Учебный год">
                    <select
                        className={qdFieldClass}
                        value={filters.academic_year_id ?? ''}
                        onChange={(e) => handleChange('academic_year_id', e.target.value)}
                    >
                        <option value="">— Учебный год —</option>
                        {(filterOptions.academicYears ?? []).map((y) => (
                            <option key={y.id} value={y.id}>{y.name}</option>
                        ))}
                    </select>
                </FormField>
                <FormField label="Период">
                    <select
                        className={qdFieldClass}
                        value={filters.period_id ?? ''}
                        onChange={(e) => handleChange('period_id', e.target.value)}
                    >
                        <option value="">— Период —</option>
                        {(filterOptions.periods ?? []).map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}{p.status === 'active' ? ' ●' : ''}
                            </option>
                        ))}
                    </select>
                </FormField>
                <div className="flex h-10 items-center gap-2 text-sm">
                    {period ? (
                        <>
                            <CalendarRange className="h-4 w-4 text-teal-700" />
                            <span className="text-slate-600">
                                {academicYear?.name && <span className="mr-1">{academicYear.name} ·</span>}
                                <strong className="text-[#102945]">{period.name}</strong>
                            </span>
                            {period.status === 'active' && <StatusBadge tone="success">Активный</StatusBadge>}
                            {period.status === 'closed' && <StatusBadge tone="default">Закрыт</StatusBadge>}
                        </>
                    ) : (
                        <span className="flex items-center gap-1.5 font-medium text-amber-700">
                            <CalendarRange className="h-4 w-4" />
                            Период не выбран
                        </span>
                    )}
                </div>
            </div>
        </FilterBar>
    );
}

// ─── result score card ───────────────────────────────────────────────────────

function FormulaBreakdown({ result, npuThreshold }) {
    const k1Num = Number(result?.k1 ?? 0);
    const k2Num = Number(result?.k2 ?? 0);
    const k3Num = Number(result?.k3 ?? 0);
    const k4Num = Number(result?.k4 ?? 0);
    const k5Num = Number(result?.k5 ?? 0);
    const npuNum = Number(npuThreshold ?? 0);
    const rankNum = Number(result?.rank_score ?? 0);

    const sumNum = k1Num + k2Num + k3Num + k4Num + k5Num;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sigma className="h-4 w-4" />
                    Расчет Рейтинга
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2 font-mono text-sm tabular-nums text-slate-800">
                    <div className="text-slate-600">Формула: R = (K1 + K2 + K3 + K4 + K5) - НПУ</div>
                    <div className="border-t border-slate-200 pt-2 text-xs uppercase tracking-[0.08em] text-slate-500">Подстановка:</div>
                    <div>R = ({fmt(k1Num)} + {fmt(k2Num)} + {fmt(k3Num)} + {fmt(k4Num)} + {fmt(k5Num)}) - {fmt(npuNum)}</div>
                    <div>R = {fmt(sumNum)} - {fmt(npuNum)}</div>
                    <div className={[
                        'font-display text-xl font-bold',
                        rankNum < 0 ? 'text-red-700' : 'text-emerald-700',
                    ].join(' ')}>
                        R = {fmt(rankNum)}
                    </div>
                    {rankNum < 0 && (
                        <Notice tone="danger" className="font-sans">Не достигнут минимум выполнения НПУ</Notice>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function ResultScoreCard({ result }) {
    if (!result) return null;
    const rVal = Number(result.rank_score ?? 0);
    const npuThreshold = Number(result.npu_threshold ?? result.rate ?? result.k6 ?? 0);
    // Для отображения коэффициентов: K1–K5 и НПУ
    const coefKeys = ['k1', 'k2', 'k3', 'k4', 'k5', 'rate'];
    const coefLabels = ['K1', 'K2', 'K3', 'K4', 'K5', 'НПУ'];
    const hasAnyScore = coefKeys.some((k) => result[k] > 0);

    return (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="relative overflow-hidden rounded-[14px] bg-[#082834] p-6 text-white">
                <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" aria-hidden="true" />
                <div className="relative flex flex-wrap items-end gap-x-10 gap-y-6">
                    <div>
                        <p className="qd-kicker text-teal-300">Итоговый рейтинг R</p>
                        <p className={['mt-3 font-display text-5xl font-bold tabular-nums leading-none', rVal > 0 ? 'text-white' : 'text-white/40'].join(' ')}>
                            {fmt(rVal)}
                        </p>
                    </div>
                    {result.approved_entries !== undefined && (
                        <div>
                            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-white/60">Утв. записей</p>
                            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-amber-300">{result.approved_entries}</p>
                        </div>
                    )}
                </div>
                {hasAnyScore && (
                    <div className="relative mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-white/10 bg-white/10 sm:grid-cols-6">
                        {coefKeys.map((k, i) => (
                            <div key={k} className="bg-[#082834] px-3 py-2.5 text-center">
                                <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white/55">{coefLabels[i]}</p>
                                <p className={['mt-0.5 text-sm font-bold tabular-nums', result[k] > 0 ? 'text-white' : 'text-white/35'].join(' ')}>
                                    {fmt(result[k])}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <FormulaBreakdown result={result} npuThreshold={npuThreshold} />
        </div>
    );
}

// ─── entry history ───────────────────────────────────────────────────────────

function EntryHistory({ history }) {
    if (!history?.length) {
        return <p className="text-xs italic text-slate-500">История действий отсутствует.</p>;
    }

    return (
        <div className="mt-3 space-y-1.5">
            <p className="qd-field-label mb-1 text-slate-500">История утверждения</p>
            <div className="relative space-y-2 pl-4 before:absolute before:bottom-1 before:left-1.5 before:top-1 before:w-px before:bg-slate-200">
                {history.map((log, i) => (
                    <div key={log.id ?? i} className="relative flex items-start gap-2.5">
                        {/* dot */}
                        <span className={[
                            'absolute -left-[1.05rem] top-1 h-2 w-2 rounded-full border-2 border-white ring-1',
                            log.action === 'approve' ? 'bg-emerald-500 ring-emerald-300' :
                                log.action === 'reject' ? 'bg-red-500 ring-red-300' :
                                    log.action === 'return' ? 'bg-orange-500 ring-orange-300' :
                                        'bg-slate-400 ring-slate-200',
                        ].join(' ')} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className={[
                                    'inline-flex items-center rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold',
                                    ACTION_COLORS[log.action] ?? ACTION_COLORS.lock,
                                ].join(' ')}>
                                    {ACTION_LABELS[log.action] ?? log.action}
                                </span>
                                <span className="text-xs font-medium text-slate-800">{log.actor_name}</span>
                                <span className="text-[0.65rem] tabular-nums text-slate-500">{fmtDateTime(log.created_at)}</span>
                            </div>
                            {log.comment && (
                                <p className="mt-0.5 text-xs italic text-slate-500">"{log.comment}"</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function EntryFiles({ files }) {
    if (!files?.length) {
        return <p className="mt-3 text-xs italic text-slate-500">Прикрепленные файлы отсутствуют.</p>;
    }

    return (
        <div className="mt-3 space-y-1.5">
            <p className="qd-field-label mb-1 text-slate-500">Прикрепленные файлы</p>
            <ul className="space-y-1.5">
                {files.map((file) => (
                    <li key={file.id} className="text-xs">
                        {file.file_url ? (
                            <a
                                href={file.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-teal-700 hover:underline"
                            >
                                {file.file_name}
                            </a>
                        ) : (
                            <span className="text-slate-600">{file.file_name}</span>
                        )}
                        <span className="text-slate-500"> ({formatFileSize(file.file_size)})</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function EntryStructuralConfirmations({ confirmations }) {
    if (!confirmations?.length) {
        return <p className="mt-3 text-xs italic text-slate-500">Согласование СП отсутствует.</p>;
    }

    return (
        <div className="mt-3 space-y-1.5">
            <p className="qd-field-label mb-1 text-slate-500">Решения структурных подразделений</p>
            <ul className="space-y-1.5">
                {confirmations.map((item, idx) => (
                    <li key={`${item.structural_unit_id ?? 'sp'}-${idx}`} className="rounded-[10px] border border-slate-200 bg-white p-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-800">{formatStructuralUnitName(item)}</span>
                            <StatusBadge tone={SP_STATUS_TONES[item.status] ?? 'default'} className="text-[0.65rem]">
                                {SP_STATUS_LABELS[item.status] ?? item.status}
                            </StatusBadge>
                        </div>
                        {(item.comment || item.confirmed_by || item.confirmed_at) && (
                            <p className="mt-1 text-[0.7rem] text-slate-500">
                                {item.comment ? `Комментарий: ${item.comment}` : 'Без комментария'}
                                {item.confirmed_by ? ` · ${item.confirmed_by}` : ''}
                                {item.confirmed_at ? ` · ${fmtDateTime(item.confirmed_at)}` : ''}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── entry row with expandable history ───────────────────────────────────────

function EntryRow({ entry }) {
    const [open, setOpen] = useState(false);
    const hasHistory = entry.history?.length > 0;
    const hasFiles = (entry.files?.length ?? 0) > 0;
    const canExpand = hasHistory || hasFiles;

    return (
        <>
            <tr
                className={`border-b border-slate-200 ${canExpand ? 'cursor-pointer hover:bg-slate-50' : ''} ${open ? 'bg-teal-50/40' : ''}`}
                onClick={() => canExpand && setOpen((v) => !v)}
            >
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{entry.code ?? '—'}</td>
                <td className="px-3 py-2.5 font-medium text-slate-900">
                    <span className="flex items-center gap-1">
                        {canExpand && (
                            open
                                ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                                : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        )}
                        {entry.name}
                    </span>
                </td>
                <td className="px-3 py-2.5 text-right text-slate-500">{entry.unit ?? '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{fmtValue(entry.base_points)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{fmtValue(entry.fact_display_value ?? entry.fact_value)}</td>
                <td className="max-w-[22rem] px-3 py-2.5 text-xs text-slate-500">{entry.points_formula ?? '—'}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#102945]">{fmt(entry.points)}</td>
                <td className="px-3 py-2.5 text-right">
                    <StatusBadge tone={STATUS_TONES[entry.status] ?? 'default'} className="text-[0.7rem]">
                        {STATUS_LABELS[entry.status] ?? entry.status}
                    </StatusBadge>
                </td>
            </tr>
            {open && canExpand && (
                <tr className="border-b border-slate-200 bg-slate-50/70">
                    <td colSpan={8} className="px-4 pb-4 pt-1">
                        <EntryHistory history={entry.history} />
                        <EntryStructuralConfirmations confirmations={entry.structural_confirmations} />
                        <EntryFiles files={entry.files} />
                        {entry.comment && (
                            <p className="mt-2 text-xs text-slate-600"><span className="font-semibold text-slate-800">Комментарий:</span> {entry.comment}</p>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

// ─── section block ────────────────────────────────────────────────────────────

function SectionBlock({ section, entries }) {
    const sectionTotal = entries.reduce((s, e) => s + Number(e.points ?? 0), 0);
    const iconCls = SECTION_ICON_COLOR[section] ?? SECTION_ICON_COLOR.other;

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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
                            <th className="w-24 px-3 py-2.5 text-right">Базовый балл</th>
                            <th className="w-20 px-3 py-2.5 text-right">Факт</th>
                            <th className="w-[22rem] px-3 py-2.5 text-left">Формула баллов</th>
                            <th className="w-20 px-3 py-2.5 text-right">Баллы</th>
                            <th className="w-28 px-3 py-2.5 text-right">Статус</th>
                        </tr>
                    </thead>
                    <tbody className="[&>tr:last-child]:border-0">
                        {entries.map((entry) => (
                            <EntryRow key={entry.id} entry={entry} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SummaryTeacherCard({
    teacher,
    result,
    entries = {},
    totals = {},
    academicYear,
    period,
    filters = {},
    filterOptions = {},
}) {
    const allSections = Object.entries(entries);
    const hasEntries = allSections.length > 0;

    const goBack = () => {
        const params = {};
        if (filters.academic_year_id) params.academic_year_id = filters.academic_year_id;
        if (filters.period_id) params.period_id = filters.period_id;
        router.get(route('kpi.summary'), params);
    };

    const teacherMeta = [teacher.title, teacher.faculty_name, teacher.department_name].filter(Boolean);

    return (
        <AuthenticatedLayout
            header={(
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white">
                            <User className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 space-y-2">
                            <p className="qd-kicker">KPI · Карточка преподавателя</p>
                            <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.015em] text-[#102945]">{teacher.name}</h1>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                                {teacher.title && <span className="font-semibold text-teal-700">{teacher.title}</span>}
                                {teacher.faculty_name && (
                                    <span className="flex items-center gap-2">
                                        {teacherMeta.indexOf(teacher.faculty_name) > 0 && <span className="text-slate-300">·</span>}
                                        {teacher.faculty_name}
                                    </span>
                                )}
                                {teacher.department_name && (
                                    <span className="flex items-center gap-2">
                                        {teacherMeta.indexOf(teacher.department_name) > 0 && <span className="text-slate-300">·</span>}
                                        {teacher.department_name}
                                    </span>
                                )}
                                {!teacher.faculty_name && !teacher.department_name && teacher.division && (
                                    <span className="text-slate-500">{teacher.division}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button type="button" variant="outline" onClick={goBack}>
                        <ArrowLeft className="h-4 w-4" />
                        К сводке
                    </Button>
                </div>
            )}
        >
            <Head title={`KPI — ${teacher.name}`} />

            <div className="admin-page-wrap space-y-6">
                <PeriodFilters
                    teacherId={teacher.id}
                    filters={filters}
                    filterOptions={filterOptions}
                    academicYear={academicYear}
                    period={period}
                />

                {result ? (
                    <ResultScoreCard result={result} />
                ) : (
                    <Notice tone="info" title="Итоговый рейтинг ещё не сформирован">
                        Период не закрыт. Ниже отображаются текущие данные.
                    </Notice>
                )}

                <StatGrid className="xl:grid-cols-5">
                    <StatTile icon={BarChart3} label="Всего записей" value={totals.total ?? 0} tone="navy" />
                    <StatTile icon={TrendingUp} label="Утверждено" value={totals.approved ?? 0} tone="success" />
                    <StatTile icon={Clock} label="На проверке" value={(totals.submitted ?? 0) + (totals.pending ?? 0)} tone="warning" />
                    <StatTile icon={XCircle} label="Отклонено" value={totals.rejected ?? 0} tone="danger" />
                    <StatTile icon={CheckCircle2} label="Баллов" value={fmt(totals.total_points)} tone="teal" />
                </StatGrid>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Записи KPI по разделам
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <Notice tone="brand">
                            В колонке "Базовый балл" отображается значение показателя из настроек KPI.
                            Формула в колонке "Формула баллов" показывает, как рассчитаны баллы по каждой записи.
                            Нажмите на строку, чтобы увидеть историю утверждения.
                        </Notice>
                        {hasEntries ? (
                            <div className="space-y-5">
                                {allSections.map(([section, sectionEntries]) => (
                                    <SectionBlock key={section} section={section} entries={sectionEntries} />
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                title="Нет показателей KPI"
                                description="Нет показателей KPI за выбранный период. Выберите другой учебный год или период."
                            />
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
