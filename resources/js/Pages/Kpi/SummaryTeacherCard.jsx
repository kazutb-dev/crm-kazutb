import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
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

const SP_STATUS_LABELS = {
    pending: 'На рассмотрении СП',
    approved: 'Утверждено СП',
    rejected: 'Отклонено СП',
};

const SP_STATUS_VARIANTS = {
    pending: 'outline',
    approved: 'default',
    rejected: 'destructive',
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
    review: 'text-violet-700 bg-violet-50 border-violet-200',
    approve: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    reject: 'text-red-700 bg-red-50 border-red-200',
    lock: 'text-muted-foreground bg-muted/40 border-border',
};

const SELECT_CLS =
    'h-9 rounded-md border border-input bg-background/70 px-3 text-sm shadow-sm transition-colors hover:border-ring focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20';

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

function FilterBar({ teacherId, filters, filterOptions }) {
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
        <div className="flex flex-wrap items-center gap-2">
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
            <select
                className={SELECT_CLS + ' pe-8'}
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
        </div>
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
        <Card className="border-border/80 bg-muted/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">Расчет Рейтинга</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2 font-mono text-sm text-foreground/90">
                    <div>Формула: R = (K1 + K2 + K3 + K4 + K5) - НПУ</div>
                    <div className="border-t border-border/70 pt-2 text-muted-foreground">Подстановка:</div>
                    <div>R = ({fmt(k1Num)} + {fmt(k2Num)} + {fmt(k3Num)} + {fmt(k4Num)} + {fmt(k5Num)}) - {fmt(npuNum)}</div>
                    <div>R = {fmt(sumNum)} - {fmt(npuNum)}</div>
                    <div className={[
                        'text-lg font-bold',
                        rankNum < 0 ? 'text-red-600' : 'text-emerald-600',
                    ].join(' ')}>
                        R = {fmt(rankNum)}
                    </div>
                    {rankNum < 0 && (
                        <div className="text-xs text-red-600">Не достигнут минимум выполнения НПУ</div>
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
        <div className="space-y-4">
            <div className="rounded-xl border border-border/80 bg-white/90 backdrop-blur shadow-[0_6px_18px_rgba(15,36,63,0.07)] overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-[#139AA4] via-[#1a6bb5] to-[#132844]" />
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
                    <div>
                        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Итоговый рейтинг R</p>
                        <p className={['text-4xl font-bold tabular-nums leading-none', rVal > 0 ? 'text-[#139AA4]' : 'text-muted-foreground/50'].join(' ')}>
                            {fmt(rVal)}
                        </p>
                    </div>
                    {hasAnyScore && (
                        <div className="flex gap-4">
                            {coefKeys.map((k, i) => (
                                <div key={k} className="text-center min-w-[2.5rem]">
                                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-0.5">{coefLabels[i]}</p>
                                    <p className={['text-sm font-bold tabular-nums', result[k] > 0 ? 'text-foreground' : 'text-muted-foreground/40'].join(' ')}>
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

            <FormulaBreakdown result={result} npuThreshold={npuThreshold} />
        </div>
    );
}

// ─── stat card ───────────────────────────────────────────────────────────────

const ACCENT_TOP = {
    green: 'before:bg-emerald-500', blue: 'before:bg-blue-500',
    amber: 'before:bg-amber-500', teal: 'before:bg-teal-500',
    default: 'before:bg-border/60',
};
const ACCENT_VALUE = {
    green: 'text-emerald-600', blue: 'text-blue-600',
    amber: 'text-amber-600', teal: 'text-teal-600',
    default: 'text-foreground',
};

function StatCard({ icon: Icon, label, value, accent = 'default' }) {
    const isEmpty = value === 0 || value === '0.00';
    return (
        <div className={[
            'relative overflow-hidden rounded-xl border border-border/80 bg-white/90 px-4 py-3.5 backdrop-blur',
            'before:absolute before:inset-x-0 before:top-0 before:h-0.5',
            ACCENT_TOP[accent] ?? ACCENT_TOP.default,
            'shadow-[0_6px_18px_rgba(15,36,63,0.07)]',
        ].join(' ')}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80 mb-1">{label}</p>
                    <p className={['text-2xl font-bold tabular-nums leading-none', isEmpty ? 'text-muted-foreground/60' : (ACCENT_VALUE[accent] ?? 'text-foreground')].join(' ')}>
                        {value}
                    </p>
                </div>
                {Icon && <div className="shrink-0 rounded-lg bg-muted/50 p-1.5"><Icon className="h-4 w-4 text-muted-foreground/60" /></div>}
            </div>
        </div>
    );
}

// ─── entry history ───────────────────────────────────────────────────────────

function EntryHistory({ history }) {
    if (!history?.length) {
        return <p className="text-xs text-muted-foreground italic">История действий отсутствует.</p>;
    }

    return (
        <div className="mt-3 space-y-1.5">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground mb-1">История утверждения</p>
            <div className="relative pl-4 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-border/60 space-y-2">
                {history.map((log, i) => (
                    <div key={log.id ?? i} className="relative flex items-start gap-2.5">
                        {/* dot */}
                        <span className={[
                            'absolute -left-[1.05rem] top-1 h-2 w-2 rounded-full border-2 border-white ring-1',
                            log.action === 'approve' ? 'bg-emerald-500 ring-emerald-300' :
                                log.action === 'reject' ? 'bg-red-500 ring-red-300' :
                                    log.action === 'return' ? 'bg-orange-500 ring-orange-300' :
                                        'bg-muted-foreground/40 ring-border',
                        ].join(' ')} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className={[
                                    'inline-flex items-center rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold',
                                    ACTION_COLORS[log.action] ?? ACTION_COLORS.lock,
                                ].join(' ')}>
                                    {ACTION_LABELS[log.action] ?? log.action}
                                </span>
                                <span className="text-xs font-medium text-foreground/80">{log.actor_name}</span>
                                <span className="text-[0.65rem] text-muted-foreground">{fmtDateTime(log.created_at)}</span>
                            </div>
                            {log.comment && (
                                <p className="mt-0.5 text-xs text-muted-foreground italic">"{log.comment}"</p>
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
        return <p className="text-xs text-muted-foreground italic">Прикрепленные файлы отсутствуют.</p>;
    }

    return (
        <div className="mt-3 space-y-1.5">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Прикрепленные файлы</p>
            <ul className="space-y-1.5">
                {files.map((file) => (
                    <li key={file.id} className="text-xs">
                        {file.file_url ? (
                            <a
                                href={file.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-700 hover:underline"
                            >
                                {file.file_name}
                            </a>
                        ) : (
                            <span className="text-muted-foreground">{file.file_name}</span>
                        )}
                        <span className="text-muted-foreground"> ({formatFileSize(file.file_size)})</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function EntryStructuralConfirmations({ confirmations }) {
    if (!confirmations?.length) {
        return <p className="text-xs text-muted-foreground italic">Согласование СП отсутствует.</p>;
    }

    return (
        <div className="mt-3 space-y-1.5">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Решения структурных подразделений</p>
            <ul className="space-y-1.5">
                {confirmations.map((item, idx) => (
                    <li key={`${item.structural_unit_id ?? 'sp'}-${idx}`} className="rounded-md border border-border/70 bg-muted/20 p-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-foreground/85">{formatStructuralUnitName(item)}</span>
                            <Badge variant={SP_STATUS_VARIANTS[item.status] ?? 'outline'} className="text-[0.65rem]">
                                {SP_STATUS_LABELS[item.status] ?? item.status}
                            </Badge>
                        </div>
                        {(item.comment || item.confirmed_by || item.confirmed_at) && (
                            <p className="mt-1 text-[0.7rem] text-muted-foreground">
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
                className={canExpand ? 'cursor-pointer hover:bg-muted/20' : ''}
                onClick={() => canExpand && setOpen((v) => !v)}
            >
                <td className="ps-3 text-xs text-muted-foreground font-mono">{entry.code ?? '—'}</td>
                <td className="font-medium">
                    <span className="flex items-center gap-1">
                        {canExpand && (
                            open
                                ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                                : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        )}
                        {entry.name}
                    </span>
                </td>
                <td className="text-right text-muted-foreground">{entry.unit ?? '—'}</td>
                <td className="text-right tabular-nums">{fmtValue(entry.base_points)}</td>
                <td className="text-right tabular-nums">{fmtValue(entry.fact_display_value ?? entry.fact_value)}</td>
                <td className="text-xs text-muted-foreground max-w-[22rem]">{entry.points_formula ?? '—'}</td>
                <td className="text-right tabular-nums font-semibold">{fmt(entry.points)}</td>
                <td className="text-right pe-3">
                    <Badge variant={STATUS_VARIANTS[entry.status] ?? 'secondary'} className="text-[0.7rem]">
                        {STATUS_LABELS[entry.status] ?? entry.status}
                    </Badge>
                </td>
            </tr>
            {open && canExpand && (
                <tr>
                    <td colSpan={8} className="ps-3 pb-3 pt-1 bg-muted/10">
                        <EntryHistory history={entry.history} />
                        <EntryStructuralConfirmations confirmations={entry.structural_confirmations} />
                        <EntryFiles files={entry.files} />
                        {entry.comment && (
                            <p className="mt-1.5 text-xs text-muted-foreground"><span className="font-medium">Комментарий:</span> {entry.comment}</p>
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
    const iconCls = SECTION_ICON_COLOR[section] ?? 'bg-muted text-muted-foreground';

    return (
        <div>
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
                            <th className="w-24 text-right">Базовый балл</th>
                            <th className="w-20 text-right">Факт</th>
                            <th className="w-[22rem]">Формула баллов</th>
                            <th className="w-20 text-right">Баллы</th>
                            <th className="w-28 text-right pe-3">Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry) => (
                            <EntryRow key={entry.id} entry={entry} />
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-1.5 text-[0.65rem] text-muted-foreground/60 flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                Нажмите на строку для просмотра истории утверждения
            </p>
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

    return (
        <AuthenticatedLayout>
            <Head title={`KPI — ${teacher.name}`} />

            <div className="admin-page-wrap">
                {/* ── Header ──────────────────────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/80 bg-white/90 px-5 py-4 shadow-[0_6px_18px_rgba(15,36,63,0.07)] backdrop-blur">
                    <div className="flex items-center gap-3.5">
                        <button
                            type="button"
                            onClick={goBack}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#139AA4] to-[#1a6bb5] shadow-sm">
                            <User className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold leading-tight text-[#132844]">{teacher.name}</h1>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                {teacher.title && <span className="font-semibold text-[#139AA4]">{teacher.title}</span>}
                                {teacher.faculty_name && (
                                    <span className="flex items-center gap-1">
                                        <span className="text-muted-foreground/40">·</span>
                                        {teacher.faculty_name}
                                    </span>
                                )}
                                {teacher.department_name && (
                                    <span className="flex items-center gap-1">
                                        <span className="text-muted-foreground/40">·</span>
                                        {teacher.department_name}
                                    </span>
                                )}
                                {!teacher.faculty_name && !teacher.department_name && teacher.division && (
                                    <span className="text-muted-foreground/70">{teacher.division}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <FilterBar teacherId={teacher.id} filters={filters} filterOptions={filterOptions} />
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
                                    Период не выбран
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Result + Stats ─────────────────────────────────── */}
                {result ? (
                    <ResultScoreCard result={result} />
                ) : (
                    <div className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/30 px-3.5 py-2.5 text-sm text-muted-foreground">
                        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
                        Итоговый рейтинг ещё не сформирован — период не закрыт. Ниже отображаются текущие данные.
                    </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <StatCard icon={BarChart3} label="Всего записей" value={totals.total ?? 0} />
                    <StatCard icon={TrendingUp} label="Утверждено" value={totals.approved ?? 0} accent="green" />
                    <StatCard icon={Clock} label="На проверке" value={(totals.submitted ?? 0) + (totals.pending ?? 0)} accent="amber" />
                    <StatCard label="Отклонено" value={totals.rejected ?? 0} />
                    <StatCard label="Баллов" value={fmt(totals.total_points)} accent="teal" />
                </div>

                {/* ── Entries by section ────────────────────────────── */}
                <Card className="admin-surface">
                    <CardHeader className="pb-3 pt-4">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#132844]">
                            <FileText className="h-4 w-4 text-[#139AA4]" />
                            Записи KPI по разделам
                            <span className="ml-auto font-normal text-xs text-muted-foreground">
                                Нажмите на строку, чтобы увидеть историю утверждения
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            В колонке "Базовый балл" отображается значение показателя из настроек KPI.
                            Формула в колонке "Формула баллов" показывает, как рассчитаны баллы по каждой записи.
                        </div>
                        {hasEntries ? (
                            <div className="space-y-6">
                                {allSections.map(([section, sectionEntries]) => (
                                    <SectionBlock key={section} section={section} entries={sectionEntries} />
                                ))}
                            </div>
                        ) : (
                            <div className="admin-empty-state">
                                <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                                Нет показателей KPI за выбранный период.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
