import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { BarChart3, BookOpen, CalendarRange, ChevronDown, ChevronRight, Clock, FileText, LoaderCircle, Paperclip, Pencil, Plus, Send, Trash2, TrendingUp, Upload, User } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

const SECTION_SHORT = {
    teaching: 'УМР',
    science: 'НИР',
    social: 'СВР',
    qualification: 'УПК',
    survey: 'К5',
    educational: 'ОП',
    staff: 'ПР',
    international: 'МД',
    other: '—',
};

const SECTION_LABELS = {
    teaching: 'УМР — Учебно-методическая работа',
    science: 'НИР — Научно-исследовательская работа',
    social: 'СВР — Социально-воспитательная работа',
    qualification: 'УПК — Учебно-педагогическая квалификация',
    survey: 'К5 — Опросы / студенческие оценки',
    educational: 'ОП — Образовательные программы',
    staff: 'ПР — Персонал',
    international: 'МД — Международная деятельность',
    other: 'Прочее',
};

const SECTION_ICON_COLOR = {
    teaching: 'bg-blue-50 text-blue-700',
    science: 'bg-violet-50 text-violet-700',
    social: 'bg-emerald-50 text-emerald-700',
    qualification: 'bg-amber-50 text-amber-700',
    survey: 'bg-cyan-50 text-cyan-700',
    educational: 'bg-pink-50 text-pink-700',
    staff: 'bg-indigo-50 text-indigo-700',
    international: 'bg-teal-50 text-teal-700',
    other: 'bg-muted text-muted-foreground',
};

const statusLabels = {
    draft: 'Черновик',
    submitted: 'На рассмотрении у завкафедры',
    returned: 'Возвращено',
    reviewed: 'Проверено',
    pending_dean: 'На рассмотрении декана',
    pending_structural: 'На рассмотрении структурного подразделения',
    approved: 'Утверждено',
    rejected: 'Отклонено',
    locked: 'Заблокировано',
};

const statusVariants = {
    draft: 'outline',
    submitted: 'secondary',
    returned: 'secondary',
    reviewed: 'secondary',
    pending_dean: 'secondary',
    pending_structural: 'secondary',
    approved: 'default',
    rejected: 'destructive',
    locked: 'destructive',
};

const spStatusLabels = {
    pending: 'Ожидает',
    approved: 'Подтверждено',
    rejected: 'Отклонено',
};

const spStatusVariants = {
    pending: 'outline',
    approved: 'default',
    rejected: 'destructive',
};

const stageLabels = {
    plan: 'План',
    fact: 'Факт',
    review: 'Рассмотрение',
};

const calculationTypeLabels = {
    manual: 'Ручной',
    auto: 'Авто',
    formula: 'Формула',
};

const MAX_EXTERNAL_LINKS = 10;

function formatDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
}

function formatScore(value) {
    const parsed = Number(value ?? 0);

    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
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

function fmtDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }).format(d);
}

function parseNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    const normalized = String(value).replace('−', '-').replace(',', '.');
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : fallback;
}

function toNonNegativeIntegerInput(value) {
    return String(value ?? '').replace(/\D+/g, '');
}

function extractNumberNear(text, needle, fallback = null) {
    const source = String(text ?? '').toLowerCase().replace(/−/g, '-');
    const index = source.indexOf(needle);

    if (index === -1) {
        return fallback;
    }

    const window = source.slice(Math.max(0, index - 24), Math.min(source.length, index + 48));
    const match = window.match(/[-+]?\d+(?:[.,]\d+)?/);

    if (!match) {
        return fallback;
    }

    return parseNumber(match[0], fallback ?? 0);
}

function parseOptionRules(rawRules) {
    const text = String(rawRules ?? '').replace(/\s+/g, ' ').trim();
    if (!text) {
        return [];
    }

    const parts = text
        .split(/\s*[\/;]\s*/)
        .map((part) => part.trim())
        .filter(Boolean);

    const options = [];

    parts.forEach((part) => {
        const normalized = part.replace(/−/g, '-');
        const colonMatch = normalized.match(/^(.+?)\s*:\s*([-+]?\d+(?:[.,]\d+)?)\s*б/i);

        if (colonMatch) {
            const label = colonMatch[1].trim();
            const points = parseNumber(colonMatch[2], NaN);
            if (Number.isFinite(points)) {
                options.push({ value: String(points), label: `${label} (${points} б.)` });
            }
            return;
        }

        const rangeMatch = normalized.match(/^([-+]?\d+(?:[.,]\d+)?)\s*балл(?:а|ов)?\s+за\s+(.+)$/i);
        if (rangeMatch) {
            const points = parseNumber(rangeMatch[1], NaN);
            const label = rangeMatch[2].trim();
            if (Number.isFinite(points)) {
                options.push({ value: String(points), label: `${label} (${points} б.)` });
            }
        }
    });

    return options;
}

function detectRuleSpec(indicator) {
    const rawRules = String(indicator?.scoring_rules ?? '').trim();
    const lowerRules = rawRules.toLowerCase();

    if (!rawRules) {
        return { kind: 'none', label: '', rawRules };
    }

    if (lowerRules.includes('1 место') && lowerRules.includes('2 место') && lowerRules.includes('3 место')) {
        const first = extractNumberNear(lowerRules, '1 место', 70);
        const second = extractNumberNear(lowerRules, '2 место', 50);
        const third = extractNumberNear(lowerRules, '3 место', 30);

        return {
            kind: 'podium',
            label: 'Баллы зависят от места',
            rawRules,
            options: [
                { value: String(first), label: `1 место (${first} б.)` },
                { value: String(second), label: `2 место (${second} б.)` },
                { value: String(third), label: `3 место (${third} б.)` },
            ],
        };
    }

    if (lowerRules.includes('улучш') && lowerRules.includes('ухудш')) {
        const upToTen = extractNumberNear(lowerRules, 'до 10', 0.5);
        const overTen = extractNumberNear(lowerRules, 'более 10', 1);
        const worsen = extractNumberNear(lowerRules, 'ухудш', -2);

        return {
            kind: 'improvement',
            label: 'Баллы зависят от улучшения/ухудшения',
            rawRules,
            options: [
                { value: String(upToTen), label: `Улучшение до 10 (${upToTen} б.)` },
                { value: String(overTen), label: `Улучшение более 10 (${overTen} б.)` },
                { value: String(worsen), label: `Ухудшение (${worsen} б.)` },
            ],
        };
    }

    if (lowerRules.includes('соавтор') && lowerRules.includes('п.л')) {
        const perSheet = extractNumberNear(lowerRules, 'балл', parseNumber(indicator?.base_points, 20));

        return {
            kind: 'coauthors',
            label: 'Баллы зависят от п.л. и числа соавторов',
            rawRules,
            perSheet,
        };
    }

    const genericOptions = parseOptionRules(rawRules);
    if (genericOptions.length >= 2) {
        return {
            kind: 'optionRate',
            label: 'Баллы зависят от выбранной категории',
            rawRules,
            options: genericOptions,
        };
    }

    if (lowerRules.includes('руководитель') && lowerRules.includes('исполнитель')) {
        const leader = extractNumberNear(lowerRules, 'руководитель', 100);
        const executor = extractNumberNear(lowerRules, 'исполнитель', 50);

        return {
            kind: 'roleSplit',
            label: 'Баллы зависят от роли',
            rawRules,
            options: [
                { value: String(leader), label: `Руководитель (${leader} б.)` },
                { value: String(executor), label: `Исполнитель (${executor} б.)` },
            ],
        };
    }

    if ((lowerRules.includes('q1') || lowerRules.includes('q2')) && (lowerRules.includes('wos') || lowerRules.includes('scopus'))) {
        const highTier = extractNumberNear(lowerRules, 'q1', 5);
        const baseTier = extractNumberNear(lowerRules, 'остальные', 3);

        return {
            kind: 'quartile',
            label: 'Баллы зависят от категории публикации',
            rawRules,
            options: [
                { value: String(highTier), label: `Q1/Q2 или CiteScore>=50 (${highTier} б.)` },
                { value: String(baseTier), label: `Остальные WoS/Scopus (${baseTier} б.)` },
            ],
        };
    }

    return {
        kind: 'none',
        label: '',
        rawRules,
    };
}

function resolveManualPoints(indicator, formData, ruleSpec) {
    const quantity = parseNumber(formData.value, 0);

    if (quantity <= 0) {
        return null;
    }

    switch (ruleSpec.kind) {
        case 'podium': {
            const pointsForPlace = parseNumber(formData.rule_place_points, NaN);
            if (!Number.isFinite(pointsForPlace)) {
                return null;
            }
            return quantity * pointsForPlace;
        }
        case 'improvement': {
            const rate = parseNumber(formData.rule_improvement_rate, NaN);
            if (!Number.isFinite(rate)) {
                return null;
            }
            return quantity * rate;
        }
        case 'coauthors': {
            const coauthors = Math.max(1, parseNumber(formData.rule_coauthors_count, 1));
            const sheets = parseNumber(formData.rule_sheet_count, 0);
            const perSheet = parseNumber(ruleSpec.perSheet, parseNumber(indicator?.base_points, 0));
            return quantity * perSheet * sheets / coauthors;
        }
        case 'roleSplit': {
            const rolePoints = parseNumber(formData.rule_role_points, NaN);
            if (!Number.isFinite(rolePoints)) {
                return null;
            }
            return quantity * rolePoints;
        }
        case 'quartile': {
            const tierPoints = parseNumber(formData.rule_tier_points, NaN);
            if (!Number.isFinite(tierPoints)) {
                return null;
            }
            return quantity * tierPoints;
        }
        case 'optionRate': {
            const optionPoints = parseNumber(formData.rule_option_points, NaN);
            if (!Number.isFinite(optionPoints)) {
                return null;
            }
            return quantity * optionPoints;
        }
        default:
            return quantity * parseNumber(indicator?.base_points, 0);
    }
}

function buildCalculationDetails(indicator, formData, ruleSpec, computedPoints) {
    if (!indicator || ruleSpec.kind === 'none' || computedPoints === null) {
        return null;
    }

    const quantity = parseNumber(formData.value, 0);
    const details = {
        rule_kind: ruleSpec.kind,
        rule_text: String(indicator.scoring_rules ?? ''),
        quantity,
        computed_points: Number(computedPoints.toFixed(2)),
    };

    const resolveOptionLabel = (options, value) => {
        const found = (options ?? []).find((item) => String(item.value) === String(value));
        return found?.label ?? null;
    };

    if (ruleSpec.kind === 'podium') {
        details.selection_points = parseNumber(formData.rule_place_points, 0);
        details.selection_label = resolveOptionLabel(ruleSpec.options, formData.rule_place_points);
    }

    if (ruleSpec.kind === 'improvement') {
        details.selection_points = parseNumber(formData.rule_improvement_rate, 0);
        details.selection_label = resolveOptionLabel(ruleSpec.options, formData.rule_improvement_rate);
    }

    if (ruleSpec.kind === 'coauthors') {
        details.per_sheet_points = parseNumber(ruleSpec.perSheet, parseNumber(indicator?.base_points, 0));
        details.sheet_count = parseNumber(formData.rule_sheet_count, 0);
        details.coauthors_count = Math.max(1, parseNumber(formData.rule_coauthors_count, 1));
    }

    if (ruleSpec.kind === 'roleSplit') {
        details.selection_points = parseNumber(formData.rule_role_points, 0);
        details.selection_label = resolveOptionLabel(ruleSpec.options, formData.rule_role_points);
    }

    if (ruleSpec.kind === 'quartile') {
        details.selection_points = parseNumber(formData.rule_tier_points, 0);
        details.selection_label = resolveOptionLabel(ruleSpec.options, formData.rule_tier_points);
    }

    if (ruleSpec.kind === 'optionRate') {
        details.selection_points = parseNumber(formData.rule_option_points, 0);
        details.selection_label = resolveOptionLabel(ruleSpec.options, formData.rule_option_points);
    }

    return details;
}

const SELECT_CLS =
    'h-9 rounded-md border border-input bg-background/70 px-3 text-sm shadow-sm transition-colors hover:border-ring focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20';

const ACTION_LABELS = {
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

// ─── result score card ───────────────────────────────────────────────────────

function ResultScoreCard({ result }) {
    if (!result) return null;
    const rVal = Number(result.rank_score ?? 0);
    const hasAnyScore = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].some((k) => result[k] > 0);

    return (
        <div className="rounded-xl border border-border/80 bg-white/90 backdrop-blur shadow-[0_6px_18px_rgba(15,36,63,0.07)] overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-[#139AA4] via-[#1a6bb5] to-[#132844]" />
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
                <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Итоговый рейтинг R</p>
                    <p className={['text-4xl font-bold tabular-nums leading-none', rVal > 0 ? 'text-[#139AA4]' : 'text-muted-foreground/50'].join(' ')}>
                        {formatScore(rVal)}
                    </p>
                </div>
                {hasAnyScore && (
                    <div className="flex gap-4">
                        {['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((k, i) => (
                            <div key={k} className="text-center min-w-[2.5rem]">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-0.5">K{i + 1}</p>
                                <p className={['text-sm font-bold tabular-nums', result[k] > 0 ? 'text-foreground' : 'text-muted-foreground/40'].join(' ')}>
                                    {formatScore(result[k])}
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

// ─── stat card ───────────────────────────────────────────────────────────────

const ACCENT_TOP = {
    green: 'before:bg-emerald-500', blue: 'before:bg-blue-500',
    amber: 'before:bg-amber-500', red: 'before:bg-red-500', teal: 'before:bg-teal-500',
    default: 'before:bg-border/60',
};
const ACCENT_VALUE = {
    green: 'text-emerald-600', blue: 'text-blue-600',
    amber: 'text-amber-600', red: 'text-red-600', teal: 'text-teal-600',
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

function EntryStructuralConfirmations({ confirmations = [] }) {
    if (!Array.isArray(confirmations) || confirmations.length === 0) {
        return null;
    }

    const resolveUnitName = (item) => {
        const directName = String(item?.name ?? '').trim();
        if (directName !== '') {
            return directName;
        }

        const rawUnit = item?.structural_unit ?? item?.structuralUnit ?? null;
        const code = String(rawUnit?.code ?? '').trim();
        const name = String(rawUnit?.name ?? '').trim();

        if (code && name) {
            return `${code} — ${name}`;
        }

        return name || code || 'Структурное подразделение';
    };

    const resolveActorName = (item) => {
        const directActor = item?.confirmed_by;
        if (typeof directActor === 'string' && directActor.trim() !== '') {
            return directActor.trim();
        }

        const confirmer = item?.confirmer ?? null;
        const confirmerName = String(confirmer?.display_name ?? confirmer?.name ?? '').trim();
        if (confirmerName !== '') {
            return confirmerName;
        }

        return '—';
    };

    return (
        <div className="mt-3 space-y-1.5">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Подтверждения СП</p>
            <div className="space-y-2">
                {confirmations.map((item, i) => (
                    <div
                        key={`${item.structural_unit_id ?? i}-${i}`}
                        className={[
                            'rounded-md border p-2',
                            item.status === 'approved'
                                ? 'border-emerald-200 bg-emerald-50/40'
                                : item.status === 'rejected'
                                    ? 'border-red-200 bg-red-50/40'
                                    : 'border-border bg-muted/20',
                        ].join(' ')}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium text-foreground/90">{resolveUnitName(item)}</p>
                            <Badge variant={spStatusVariants[item.status] ?? 'outline'} className="text-[0.65rem]">
                                {spStatusLabels[item.status] ?? item.status}
                            </Badge>
                        </div>
                        <p className="mt-1 text-[0.7rem] text-muted-foreground">
                            {item.status === 'rejected'
                                ? `Отклонил: ${resolveActorName(item)}`
                                : item.status === 'approved'
                                    ? `Подтвердил: ${resolveActorName(item)}`
                                    : 'Ответственный: —'}
                            {' · '}
                            {fmtDateTime(item.confirmed_at)}
                        </p>
                        {item.comment && (
                            <p className="mt-1 text-[0.7rem] italic text-muted-foreground">"{item.comment}"</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function EntryRow({ entry, isEditable, isFileMissing, uploadFile, uploadingEntryId, submitEntry, deleteEntry, openEditEntry }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <>
            <tr
                className="border-b hover:bg-muted/50 cursor-pointer"
                onClick={() => setExpanded((v) => !v)}
            >
                <td className="ps-3 py-3">
                    <div className="flex items-center gap-1">
                        {expanded ? (
                            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        ) : (
                            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        )}
                    </div>
                </td>
                <td className="py-3 text-xs font-mono text-muted-foreground">{entry.indicator?.code ?? '—'}</td>
                <td className="py-3 font-medium">{entry.indicator?.name ?? '—'}</td>
                <td className="py-3 text-right tabular-nums text-sm">{entry.indicator?.base_points ?? '—'}</td>
                <td className="py-3 text-right tabular-nums text-sm">{entry.fact_value ?? '—'}</td>
                <td className="py-3 text-right tabular-nums font-semibold text-sm">{formatScore(entry.points_for_display ?? entry.manual_points ?? entry.calculated_points)}</td>
                <td className="py-3">
                    <Badge variant={statusVariants[entry.status] ?? 'outline'} className="text-[0.7rem]">
                        {statusLabels[entry.status] ?? entry.status}
                    </Badge>
                    {isFileMissing && <p className="mt-1 text-[0.65rem] text-amber-700 font-semibold">Нужен файл</p>}
                </td>
                <td className="pe-3 py-3 text-right">
                    <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="outline">
                            <Link href={route('kpi.entries.show', entry.id)}>Открыть</Link>
                        </Button>
                        {isEditable && (
                            (entry.status === 'draft' || entry.status === 'returned' || entry.status === 'rejected') ? (
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEditEntry(entry); }}>
                                    <Pencil className="h-3 w-3" />
                                    {entry.status === 'draft' ? 'Редактировать' : 'Исправить'}
                                </Button>
                            ) : (
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); submitEntry(entry.id); }} disabled={isFileMissing}>
                                    <Send className="h-3 w-3" />
                                </Button>
                            )
                        )}
                        {entry.status !== 'approved' && (
                            <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); deleteEntry(entry); }}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr className="bg-muted/20 border-b">
                    <td colSpan={8} className="ps-3 py-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <EntryHistory history={entry.history} />
                                <EntryStructuralConfirmations
                                    confirmations={
                                        entry.structural_confirmation_matrix
                                        ?? entry.structural_confirmations
                                        ?? []
                                    }
                                />
                            </div>
                            {(Array.isArray(entry.calculation_details?.external_source_urls)
                                && entry.calculation_details.external_source_urls.filter((url) => String(url ?? '').trim() !== '').length > 0) || entry.external_source_url ? (
                                <div>
                                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Источник</p>
                                    <div className="space-y-1">
                                        {(Array.isArray(entry.calculation_details?.external_source_urls)
                                            ? entry.calculation_details.external_source_urls
                                                .map((url) => String(url ?? '').trim())
                                                .filter(Boolean)
                                            : (entry.external_source_url ? [entry.external_source_url] : [])
                                        ).map((link, index) => (
                                            <a
                                                key={`${entry.id}-external-link-${index}`}
                                                href={link}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block text-xs text-sky-700 underline-offset-2 hover:underline break-all"
                                            >
                                                {link}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            <div>
                                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Файлы</p>
                                {(entry.files?.length ?? 0) > 0 ? (
                                    <div className="space-y-1">
                                        {entry.files.map((file) => (
                                            <a
                                                key={file.id}
                                                href={file.file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-2 text-xs text-sky-700 underline-offset-2 hover:underline"
                                            >
                                                <Paperclip className="h-3 w-3 shrink-0" />
                                                <span className="truncate">{file.file_name}</span>
                                                <span className="text-muted-foreground">({formatFileSize(file.file_size)})</span>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">{entry.indicator?.requires_file ? 'Файл обязателен' : 'Не прикреплены'}</p>
                                )}
                                {isEditable && (
                                    <label className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-sky-700">
                                        {uploadingEntryId === entry.id ? (
                                            <LoaderCircle className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Upload className="h-3 w-3" />
                                        )}
                                        <span>Загрузить</span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            disabled={uploadingEntryId === entry.id}
                                            onChange={(event) => {
                                                const file = event.target.files?.[0] ?? null;
                                                uploadFile(entry, file);
                                                event.target.value = '';
                                            }}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

function EntriesBySection({ items, isEditableEntry, isFileMissing, uploadFile, uploadingEntryId, submitEntry, deleteEntry, openEditEntry }) {
    const grouped = useMemo(() => {
        const result = {};
        items.forEach((entry) => {
            const section = entry.indicator?.section ?? 'other';
            if (!result[section]) {
                result[section] = [];
            }
            result[section].push(entry);
        });
        return result;
    }, [items]);

    const allSections = Object.entries(grouped);
    if (allSections.length === 0) return null;

    return (
        <div className="space-y-6">
            {allSections.map(([section, entries]) => {
                const sectionTotal = entries.reduce((s, e) => s + Number(e.points_for_display ?? e.manual_points ?? e.calculated_points ?? 0), 0);
                const iconCls = SECTION_ICON_COLOR[section] ?? 'bg-muted text-muted-foreground';

                return (
                    <div key={section}>
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${iconCls}`}>
                                    {SECTION_SHORT[section] ?? section}
                                </span>
                                <span className="text-sm font-medium text-foreground/80">
                                    {SECTION_LABELS[section] ?? section}
                                </span>
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground">
                                Итого: <span className="text-foreground">{formatScore(sectionTotal)}</span> б.
                            </span>
                        </div>
                        <div className="admin-table-wrap">
                            <table className="admin-data-table min-w-[800px]">
                                <thead>
                                    <tr>
                                        <th className="ps-3 w-6"></th>
                                        <th className="w-16">Код</th>
                                        <th>Показатель</th>
                                        <th className="w-24 text-right">Базовый балл</th>
                                        <th className="w-20 text-right">Факт</th>
                                        <th className="w-20 text-right">Баллы</th>
                                        <th className="w-28">Статус</th>
                                        <th className="w-32 text-right pe-3">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <EntryRow
                                            key={entry.id}
                                            entry={entry}
                                            isEditable={isEditableEntry(entry)}
                                            isFileMissing={isFileMissing(entry)}
                                            uploadFile={uploadFile}
                                            uploadingEntryId={uploadingEntryId}
                                            submitEntry={submitEntry}
                                            deleteEntry={deleteEntry}
                                            openEditEntry={openEditEntry}
                                        />
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

export default function TeacherDashboard({
    currentUser = {},
    period = null,
    academicYear = null,
    result = null,
    summary = {},
    entries,
    indicators = [],
    indicator_reference: indicatorReference = [],
    modules = [],
    groupCodesByModule = {},
    filters = {},
    filterOptions = {},
    activeSeasons = [],
    statusOptions = [],
    permissions = {},
}) {
    const items = entries?.data ?? [];
    const links = entries?.links ?? [];

    const userLevelLabels = {
        teacher: 'ППС',
        department_head: 'Заведующий кафедрой',
        dean: 'Декан',
    };
    const userLevelLabel = userLevelLabels[permissions.userLevel] ?? 'Преподаватель';

    const [createOpen, setCreateOpen] = useState(false);
    const [uploadingEntryId, setUploadingEntryId] = useState(null);
    const [createFilesList, setCreateFilesList] = useState([]);
    const [editingEntryId, setEditingEntryId] = useState(null);
    const [editingEntryFiles, setEditingEntryFiles] = useState([]);
    const [activeMainTab, setActiveMainTab] = useState('entries');
    const createFileInputRef = useRef(null);

    const filterForm = useForm({
        stage: filters.stage ?? 'plan',
        status: filters.status ?? '',
        module: filters.module ?? '',
        group_code: filters.group_code ?? '',
    });

    const initialAcademicYearId = filters.academic_year_id ?? activeSeasons[0]?.academic_year_id ?? '';

    const createForm = useForm({
        academic_year_id: initialAcademicYearId ? String(initialAcademicYearId) : '',
        stage: 'fact',
        module: modules[0]?.value ?? '',
        group_code: '',
        indicator_id: '',
        value: '',
        rule_place_points: '',
        rule_improvement_rate: '',
        rule_coauthors_count: '',
        rule_sheet_count: '',
        rule_role_points: '',
        rule_tier_points: '',
        rule_option_points: '',
        comment: '',
        external_source_url: '',
        external_source_urls: [''],
        files: [],
        action: 'draft',
    });

    const moduleOptions = modules;
    const currentCreateModule = createForm.data.module;
    const createGroupOptions = useMemo(
        () => groupCodesByModule[currentCreateModule] ?? [],
        [groupCodesByModule, currentCreateModule],
    );

    const indicatorOptions = useMemo(() => {
        return indicators.filter((indicator) => {
            const matchesModule = createForm.data.module === '' || indicator.section === createForm.data.module;
            const matchesGroup = createForm.data.group_code === '' || indicator.group_code === createForm.data.group_code;

            return matchesModule && matchesGroup;
        });
    }, [indicators, createForm.data.module, createForm.data.group_code]);

    const indicatorReferenceItems = useMemo(() => {
        return indicatorReference.filter((indicator) => {
            if (!permissions.userLevel) {
                return true;
            }

            return indicator.entity_type === permissions.userLevel;
        });
    }, [indicatorReference, permissions.userLevel]);

    const selectedIndicator = useMemo(
        () => indicatorOptions.find((indicator) => String(indicator.id) === String(createForm.data.indicator_id)) ?? null,
        [indicatorOptions, createForm.data.indicator_id],
    );

    const selectedRuleSpec = useMemo(
        () => detectRuleSpec(selectedIndicator),
        [selectedIndicator],
    );

    const calculatedManualPoints = useMemo(() => {
        const value = resolveManualPoints(selectedIndicator, createForm.data, selectedRuleSpec);
        return value === null ? null : Number(value.toFixed(2));
    }, [selectedIndicator, createForm.data, selectedRuleSpec]);

    const hasActiveSeason = activeSeasons.length > 0;

    const applyFilters = (event) => {
        event.preventDefault();

        router.get(route('kpi.my-form'), {
            stage: filterForm.data.stage || undefined,
            status: filterForm.data.status || undefined,
            module: filterForm.data.module || undefined,
            group_code: filterForm.data.group_code || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        filterForm.setData({
            stage: 'plan',
            status: '',
            module: '',
            group_code: '',
        });

        router.get(route('kpi.my-form'), { stage: 'plan' }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitCreate = (event, action) => {
        event.preventDefault();

        if (isTotalFileSizeExceeded) {
            createForm.setError('files', 'Общий размер файлов не должен превышать 100 МБ.');
            return;
        }

        const hasDynamicRule = selectedRuleSpec.kind !== 'none';
        const effectiveValue = createForm.data.value === '' && hasDynamicRule
            ? '1'
            : createForm.data.value;

        const computedData = {
            ...createForm.data,
            value: effectiveValue,
        };

        const numericValue = parseNumber(computedData.value, NaN);
        if (Number.isFinite(numericValue) && numericValue < 0) {
            createForm.setError('value', 'Значение не может быть отрицательным.');
            return;
        }

        if (Number.isFinite(numericValue) && !Number.isInteger(numericValue)) {
            createForm.setError('value', 'Значение KPI должно быть целым числом.');
            return;
        }

        const externalLinks = (computedData.external_source_urls ?? [])
            .map((url) => String(url ?? '').trim())
            .filter(Boolean)
            .slice(0, MAX_EXTERNAL_LINKS);

        const manualPoints = resolveManualPoints(selectedIndicator, computedData, selectedRuleSpec);
        const calculationDetails = buildCalculationDetails(selectedIndicator, computedData, selectedRuleSpec, manualPoints);
        const calculationDetailsWithLinks = calculationDetails
            ? {
                ...calculationDetails,
                external_source_urls: externalLinks,
            }
            : (externalLinks.length > 0 ? { external_source_urls: externalLinks } : null);

        createForm.transform(() => ({
            ...computedData,
            stage: computedData.stage || 'fact',
            action,
            _method: editingEntryId ? 'patch' : undefined,
            external_source_urls: externalLinks,
            external_source_url: externalLinks[0] ?? '',
            manual_points: manualPoints === null ? null : Number(manualPoints.toFixed(2)),
            calculation_details: calculationDetailsWithLinks,
        }));

        const requestMethod = 'post';
        const requestUrl = editingEntryId
            ? route('kpi.my-entries.update', editingEntryId)
            : route('kpi.my-entries.store');

        createForm[requestMethod](requestUrl, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                if (editingEntryId && action === 'submit') {
                    router.post(route('kpi.my-entries.submit', editingEntryId), {}, {
                        preserveScroll: true,
                    });
                    setCreateOpen(false);
                    createForm.reset();
                    setCreateFilesList([]);
                    setEditingEntryId(null);
                    setEditingEntryFiles([]);
                    return;
                }

                if (action === 'draft') {
                    createForm.reset(
                        'indicator_id',
                        'value',
                        'rule_place_points',
                        'rule_improvement_rate',
                        'rule_coauthors_count',
                        'rule_sheet_count',
                        'rule_role_points',
                        'rule_tier_points',
                        'rule_option_points',
                        'comment',
                        'external_source_url',
                        'external_source_urls',
                        'files',
                    );
                    createForm.setData('external_source_urls', ['']);
                    setCreateFilesList([]);

                    if (editingEntryId) {
                        setCreateOpen(false);
                        setEditingEntryId(null);
                        setEditingEntryFiles([]);
                    }
                }

                if (action === 'submit') {
                    setCreateOpen(false);
                    createForm.reset();
                    setCreateFilesList([]);
                    setEditingEntryId(null);
                    setEditingEntryFiles([]);
                }
            },
            onFinish: () => {
                createForm.transform((data) => data);
            },
        });
    };

    const handleCreateValueChange = (event) => {
        createForm.setData('value', toNonNegativeIntegerInput(event.target.value));
    };

    const handleCreateValueKeyDown = (event) => {
        if (['.', ',', 'e', 'E', '+', '-'].includes(event.key)) {
            event.preventDefault();
        }
    };

    const openEditEntry = (entry) => {
        const existingExternalLinks = Array.isArray(entry.calculation_details?.external_source_urls)
            ? entry.calculation_details.external_source_urls
                .map((url) => String(url ?? '').trim())
                .filter(Boolean)
            : [];

        const details = entry.calculation_details ?? {};
        const ruleKind = String(details.rule_kind ?? '');
        const selectionPoints = details.selection_points !== undefined && details.selection_points !== null
            ? String(details.selection_points)
            : '';

        createForm.setData((prev) => ({
            ...prev,
            stage: 'fact',
            module: entry.indicator?.section ?? prev.module,
            group_code: '',
            indicator_id: String(entry.indicator_id ?? entry.indicator?.id ?? ''),
            value: entry.fact_value ?? '',
            rule_place_points: ruleKind === 'podium' ? selectionPoints : '',
            rule_improvement_rate: ruleKind === 'improvement' ? selectionPoints : '',
            rule_coauthors_count: ruleKind === 'coauthors' && details.coauthors_count !== undefined && details.coauthors_count !== null
                ? String(details.coauthors_count)
                : '',
            rule_sheet_count: ruleKind === 'coauthors' && details.sheet_count !== undefined && details.sheet_count !== null
                ? String(details.sheet_count)
                : '',
            rule_role_points: ruleKind === 'roleSplit' ? selectionPoints : '',
            rule_tier_points: ruleKind === 'quartile' ? selectionPoints : '',
            rule_option_points: ruleKind === 'optionRate' ? selectionPoints : '',
            comment: entry.comment ?? '',
            external_source_url: entry.external_source_url ?? '',
            external_source_urls: existingExternalLinks.length > 0
                ? existingExternalLinks
                : (entry.external_source_url ? [entry.external_source_url] : ['']),
            files: [],
        }));
        setCreateFilesList([]);
        setEditingEntryId(entry.id);
        setEditingEntryFiles(entry.files ?? []);
        setCreateOpen(true);
    };

    const removeEditingFile = (fileId) => {
        if (!editingEntryId || !fileId) {
            return;
        }

        if (!window.confirm('Удалить файл из записи?')) {
            return;
        }

        router.delete(route('kpi.entries.files.destroy', { entry: editingEntryId, file: fileId }), {
            preserveScroll: true,
            onSuccess: () => {
                setEditingEntryFiles((current) => current.filter((file) => file.id !== fileId));
            },
        });
    };

    const submitEntry = (entryId) => {
        router.post(route('kpi.my-entries.submit', entryId), {}, {
            preserveScroll: true,
        });
    };

    const deleteEntry = (entry) => {
        if (!window.confirm(`Удалить запись ${entry.indicator?.code ?? ''}?`)) {
            return;
        }

        router.delete(route('kpi.my-entries.destroy', entry.id), {
            preserveScroll: true,
        });
    };

    const uploadFile = (entry, file) => {
        if (!file) {
            return;
        }

        setUploadingEntryId(entry.id);

        router.post(route('kpi.entries.files.store', entry.id), {
            file,
        }, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => {
                setUploadingEntryId(null);
            },
        });
    };

    const totalUploadedFileSize = useMemo(() => {
        return createFilesList.reduce((sum, file) => sum + (file.size ?? 0), 0);
    }, [createFilesList]);

    const totalMaxFileSize = 100 * 1024 * 1024; // 100 МБ total
    const isTotalFileSizeExceeded = totalUploadedFileSize > totalMaxFileSize;

    const isEditableEntry = (entry) => entry.status === 'draft' || entry.status === 'returned' || entry.status === 'rejected';

    const isFileMissing = (entry) => {
        if (!entry.indicator?.requires_file) {
            return false;
        }

        return (entry.files?.length ?? 0) === 0;
    };

    const handleSeasonChange = (value) => {
        const params = { ...filters };
        params.academic_year_id = value || undefined;
        params.period_id = undefined;
        router.get(route('kpi.my-form'), params, { preserveState: false });
    };

    return (
        <AuthenticatedLayout
            headerRight={
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" onClick={() => {
                            setEditingEntryId(null);
                            setEditingEntryFiles([]);
                        }}>
                            <Plus className="h-4 w-4" />
                            Создать запись
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>{editingEntryId ? 'Исправление KPI-записи' : 'Новая KPI-запись'}</DialogTitle>
                            <DialogDescription>
                                {editingEntryId
                                    ? 'Исправьте данные по замечаниям и отправьте запись повторно на проверку.'
                                    : 'Выберите активный сезон, модуль и показатель, затем сохраните как черновик или сразу отправьте на проверку.'}
                            </DialogDescription>
                        </DialogHeader>

                        <form className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2 sm:col-span-2">
                                    <label className="text-sm font-medium">Сезон (учебный год)</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                        value={createForm.data.academic_year_id}
                                        onChange={(event) => createForm.setData('academic_year_id', event.target.value)}
                                    >
                                        <option value="">Выберите активный сезон</option>
                                        {activeSeasons.map((item) => (
                                            <option key={item.academic_year_id} value={item.academic_year_id}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                    {!hasActiveSeason && (
                                        <p className="text-xs text-amber-600">
                                            Нет активных KPI-сезонов. Обратитесь к администратору.
                                        </p>
                                    )}
                                    {createForm.errors.academic_year_id && (
                                        <p className="text-sm text-destructive">{createForm.errors.academic_year_id}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Модуль</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                        value={createForm.data.module}
                                        onChange={(event) => {
                                            createForm.setData('module', event.target.value);
                                            createForm.setData('group_code', '');
                                            createForm.setData('indicator_id', '');
                                            createForm.setData('rule_place_points', '');
                                            createForm.setData('rule_improvement_rate', '');
                                            createForm.setData('rule_coauthors_count', '');
                                            createForm.setData('rule_sheet_count', '');
                                            createForm.setData('rule_role_points', '');
                                            createForm.setData('rule_tier_points', '');
                                            createForm.setData('rule_option_points', '');
                                        }}
                                    >
                                        <option value="">Выберите модуль</option>
                                        {moduleOptions.map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Код блока</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                        value={createForm.data.group_code}
                                        onChange={(event) => {
                                            createForm.setData('group_code', event.target.value);
                                            createForm.setData('indicator_id', '');
                                            createForm.setData('rule_place_points', '');
                                            createForm.setData('rule_improvement_rate', '');
                                            createForm.setData('rule_coauthors_count', '');
                                            createForm.setData('rule_sheet_count', '');
                                            createForm.setData('rule_role_points', '');
                                            createForm.setData('rule_tier_points', '');
                                            createForm.setData('rule_option_points', '');
                                        }}
                                    >
                                        <option value="">Выберите код блока</option>
                                        {createGroupOptions.map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Код показателя</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                        value={createForm.data.indicator_id}
                                        onChange={(event) => {
                                            createForm.setData('indicator_id', event.target.value);
                                            createForm.setData('rule_place_points', '');
                                            createForm.setData('rule_improvement_rate', '');
                                            createForm.setData('rule_coauthors_count', '');
                                            createForm.setData('rule_sheet_count', '');
                                            createForm.setData('rule_role_points', '');
                                            createForm.setData('rule_tier_points', '');
                                            createForm.setData('rule_option_points', '');
                                        }}
                                    >
                                        <option value="">Выберите код</option>
                                        {indicatorOptions.map((indicator) => (
                                            <option key={indicator.id} value={indicator.id}>
                                                {indicator.code} — {indicator.name}
                                            </option>
                                        ))}
                                    </select>
                                    {createForm.errors.indicator_id && <p className="text-sm text-destructive">{createForm.errors.indicator_id}</p>}
                                </div>
                            {selectedIndicator && (
                                <div className="space-y-2 sm:col-span-2">
                                    <label className="text-sm font-medium">Описание показателя</label>
                                    <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm whitespace-pre-line text-foreground/90">
                                        {selectedIndicator.description || 'Описание не указано'}
                                    </div>
                                </div>
                            )}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Значение</label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            step="1"
                                            min="0"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={createForm.data.value}
                                            onChange={handleCreateValueChange}
                                            onKeyDown={handleCreateValueKeyDown}
                                        />
                                        <span className="shrink-0 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                            {selectedIndicator?.unit || 'без ед.'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Единица измерения: <span className="font-medium text-foreground">{selectedIndicator?.unit || 'не указана'}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">Значение KPI должно быть целым неотрицательным числом.</p>
                                    {createForm.errors.value && <p className="text-sm text-destructive">{createForm.errors.value}</p>}
                                </div>

                                {selectedRuleSpec.kind === 'podium' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Место</label>
                                        <select
                                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                            value={createForm.data.rule_place_points}
                                            onChange={(event) => createForm.setData('rule_place_points', event.target.value)}
                                        >
                                            <option value="">Выберите место</option>
                                            {(selectedRuleSpec.options ?? []).map((item) => (
                                                <option key={item.value + item.label} value={item.value}>{item.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {selectedRuleSpec.kind === 'improvement' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Тип изменения позиции</label>
                                        <select
                                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                            value={createForm.data.rule_improvement_rate}
                                            onChange={(event) => createForm.setData('rule_improvement_rate', event.target.value)}
                                        >
                                            <option value="">Выберите вариант</option>
                                            {(selectedRuleSpec.options ?? []).map((item) => (
                                                <option key={item.value + item.label} value={item.value}>{item.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {selectedRuleSpec.kind === 'coauthors' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Количество печатных листов</label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={createForm.data.rule_sheet_count}
                                                onChange={(event) => createForm.setData('rule_sheet_count', event.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Количество соавторов</label>
                                            <Input
                                                type="number"
                                                step="1"
                                                min="1"
                                                value={createForm.data.rule_coauthors_count}
                                                onChange={(event) => createForm.setData('rule_coauthors_count', event.target.value)}
                                            />
                                        </div>
                                    </>
                                )}

                                {selectedRuleSpec.kind === 'roleSplit' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Ваша роль</label>
                                        <select
                                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                            value={createForm.data.rule_role_points}
                                            onChange={(event) => createForm.setData('rule_role_points', event.target.value)}
                                        >
                                            <option value="">Выберите роль</option>
                                            {(selectedRuleSpec.options ?? []).map((item) => (
                                                <option key={item.value + item.label} value={item.value}>{item.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {selectedRuleSpec.kind === 'quartile' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Категория публикации</label>
                                        <select
                                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                            value={createForm.data.rule_tier_points}
                                            onChange={(event) => createForm.setData('rule_tier_points', event.target.value)}
                                        >
                                            <option value="">Выберите категорию</option>
                                            {(selectedRuleSpec.options ?? []).map((item) => (
                                                <option key={item.value + item.label} value={item.value}>{item.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {selectedRuleSpec.kind === 'optionRate' && (
                                    <div className="space-y-2 sm:col-span-2">
                                        <label className="text-sm font-medium">Категория/условие</label>
                                        <select
                                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                            value={createForm.data.rule_option_points}
                                            onChange={(event) => createForm.setData('rule_option_points', event.target.value)}
                                        >
                                            <option value="">Выберите вариант</option>
                                            {(selectedRuleSpec.options ?? []).map((item) => (
                                                <option key={item.value + item.label} value={item.value}>{item.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {selectedIndicator?.scoring_rules && (
                                <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                                    <p className="mb-1 font-medium text-foreground">Правила баллов</p>
                                    <p>{selectedIndicator.scoring_rules}</p>
                                </div>
                            )}

                            {calculatedManualPoints !== null && (
                                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                                    Расчет по правилу: <span className="font-semibold">{formatScore(calculatedManualPoints)} б.</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Комментарий</label>
                                <textarea
                                    className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                                    value={createForm.data.comment}
                                    onChange={(event) => createForm.setData('comment', event.target.value)}
                                    placeholder="Комментарий к записи"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Ссылка на внешний источник</label>
                                    {editingEntryId && (createForm.data.external_source_urls ?? []).some((url) => String(url ?? '').trim() !== '') && (
                                        <div className="rounded-md border border-border/70 bg-muted/20 p-2.5">
                                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Текущие ссылки</p>
                                            <div className="space-y-1">
                                                {(createForm.data.external_source_urls ?? [])
                                                    .map((url) => String(url ?? '').trim())
                                                    .filter(Boolean)
                                                    .map((link, index) => (
                                                        <div key={`editing-external-link-${index}`} className="flex items-center gap-2">
                                                            <a
                                                                href={link}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="block flex-1 break-all text-xs text-sky-700 underline-offset-2 hover:underline"
                                                            >
                                                                {link}
                                                            </a>
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="outline"
                                                                className="h-7 w-7"
                                                                onClick={() => {
                                                                    const next = (createForm.data.external_source_urls ?? [])
                                                                        .filter((_, idx) => idx !== index);
                                                                    createForm.setData('external_source_urls', next.length > 0 ? next : ['']);
                                                                }}
                                                                aria-label="Удалить ссылку"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        {(createForm.data.external_source_urls ?? ['']).map((url, index) => {
                                            const canAdd = index === (createForm.data.external_source_urls.length - 1)
                                                && createForm.data.external_source_urls.length < MAX_EXTERNAL_LINKS;
                                            const canRemove = createForm.data.external_source_urls.length > 1;

                                            return (
                                                <div key={`external-link-${index}`} className="flex items-center gap-2">
                                                    <Input
                                                        type="url"
                                                        value={url}
                                                        onChange={(event) => {
                                                            const next = [...(createForm.data.external_source_urls ?? [''])];
                                                            next[index] = event.target.value;
                                                            createForm.setData('external_source_urls', next);
                                                        }}
                                                        placeholder="https://example.com/source"
                                                    />

                                                    {canAdd ? (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-9 w-9 shrink-0"
                                                            onClick={() => createForm.setData('external_source_urls', [
                                                                ...(createForm.data.external_source_urls ?? ['']),
                                                                '',
                                                            ])}
                                                            aria-label="Добавить ссылку"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-9 w-9 shrink-0"
                                                            onClick={() => {
                                                                if (!canRemove) {
                                                                    return;
                                                                }

                                                                const next = (createForm.data.external_source_urls ?? ['']).filter((_, idx) => idx !== index);
                                                                createForm.setData('external_source_urls', next.length > 0 ? next : ['']);
                                                            }}
                                                            disabled={!canRemove}
                                                            aria-label="Удалить ссылку"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Можно добавить до {MAX_EXTERNAL_LINKS} ссылок. Пустые строки не отправляются.
                                    </p>
                                    {createForm.errors.external_source_url && (
                                        <p className="text-sm text-destructive">{createForm.errors.external_source_url}</p>
                                    )}
                                    {createForm.errors.external_source_urls && (
                                        <p className="text-sm text-destructive">{createForm.errors.external_source_urls}</p>
                                    )}
                                    {createForm.errors['external_source_urls.0'] && (
                                        <p className="text-sm text-destructive">{createForm.errors['external_source_urls.0']}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Файл подтверждения</label>
                                    {editingEntryId && editingEntryFiles.length > 0 && (
                                        <div className="rounded-md border border-border/70 bg-muted/20 p-2.5">
                                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Уже прикреплены</p>
                                            <div className="space-y-1">
                                                {editingEntryFiles.map((file) => (
                                                    <div key={`editing-file-${file.id}`} className="flex items-center gap-2">
                                                        <a
                                                            href={file.file_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="flex min-w-0 flex-1 items-center gap-2 text-xs text-sky-700 underline-offset-2 hover:underline"
                                                        >
                                                            <Paperclip className="h-3 w-3 shrink-0" />
                                                            <span className="truncate">{file.file_name}</span>
                                                            <span className="text-muted-foreground">({formatFileSize(file.file_size)})</span>
                                                        </a>
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="outline"
                                                            className="h-7 w-7"
                                                            onClick={() => removeEditingFile(file.id)}
                                                            aria-label="Удалить файл"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 w-full justify-between"
                                            onClick={() => createFileInputRef.current?.click()}
                                        >
                                            <span>Добавить файл</span>
                                            <Paperclip className="h-4 w-4" />
                                        </Button>
                                        <input
                                            ref={createFileInputRef}
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={(event) => {
                                                const selectedFiles = Array.from(event.target.files ?? []);
                                                createForm.setData('files', selectedFiles);
                                                createForm.clearErrors('files');
                                                setCreateFilesList(selectedFiles.map((file) => ({
                                                    name: file.name,
                                                    size: file.size,
                                                })));
                                            }}
                                        />

                                        {/* Display selected files list */}
                                        {createFilesList.length > 0 && (
                                            <div className="rounded-md border border-border/70 bg-muted/20 p-2.5">
                                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Выбранные файлы ({createFilesList.length})
                                                </p>
                                                <div className="space-y-1">
                                                    {createFilesList.map((file, index) => (
                                                        <div key={`new-file-${index}`} className="flex items-center gap-2 text-xs">
                                                            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                            <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                                            <span className="shrink-0 text-muted-foreground">({formatFileSize(file.size)})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2 border-t border-border/50 pt-2 text-xs">
                                                    <div className="flex justify-between text-muted-foreground">
                                                        <span>Всего:</span>
                                                        <span className={isTotalFileSizeExceeded ? 'text-red-600 font-semibold' : ''}>
                                                            {formatFileSize(totalUploadedFileSize)} / {formatFileSize(totalMaxFileSize)}
                                                        </span>
                                                    </div>
                                                    {isTotalFileSizeExceeded && (
                                                        <p className="mt-1 text-red-600 font-medium">Превышен общий лимит размера файлов</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {createFilesList.length === 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                Файлы не выбраны (до 100 МБ суммарно)
                                            </p>
                                        )}
                                    </div>
                                    {(createForm.errors.files || createForm.errors['files.0']) && (
                                        <p className="text-sm text-destructive">{createForm.errors.files || createForm.errors['files.0']}</p>
                                    )}
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Файл можно прикрепить сразу при создании записи.
                                {selectedIndicator?.requires_file ? ' Для выбранного показателя файл обязателен.' : ''}
                            </p>

                            <DialogFooter className="gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={(event) => submitCreate(event, 'draft')}
                                    disabled={createForm.processing || !hasActiveSeason || !createForm.data.academic_year_id || isTotalFileSizeExceeded}
                                >
                                    Сохранить как черновик
                                </Button>
                                <Button
                                    type="button"
                                    onClick={(event) => submitCreate(event, 'submit')}
                                    disabled={createForm.processing || !hasActiveSeason || !createForm.data.academic_year_id || isTotalFileSizeExceeded}
                                >
                                    <Send className="h-4 w-4" />
                                    Отправить на проверку
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            }
        >
            <Head title="KPI — Мои показатели" />

            <div className="admin-page-wrap">

                {/* ── Header ─────────────────────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/80 bg-white/90 px-5 py-4 shadow-[0_6px_18px_rgba(15,36,63,0.07)] backdrop-blur">
                    <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#139AA4] to-[#1a6bb5] shadow-sm">
                            <User className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold leading-tight text-[#132844]">
                                {currentUser.name ?? 'KPI — Мои показатели'}
                            </h1>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                {currentUser.title && <span>{currentUser.title}</span>}
                                {currentUser.faculty_name && (
                                    <span className="flex items-center gap-1">
                                        <span className="text-muted-foreground/40">·</span>
                                        {currentUser.faculty_name}
                                    </span>
                                )}
                                {currentUser.department_name && (
                                    <span className="flex items-center gap-1">
                                        <span className="text-muted-foreground/40">·</span>
                                        {currentUser.department_name}
                                    </span>
                                )}
                                {!currentUser.faculty_name && !currentUser.department_name && currentUser.division && (
                                    <span className="text-muted-foreground/70">{currentUser.division}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        {/* Season (academic year) selector */}
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                className={SELECT_CLS + ' pe-8'}
                                value={filters.academic_year_id ?? ''}
                                onChange={(e) => handleSeasonChange(e.target.value)}
                            >
                                <option value="">— Учебный год —</option>
                                {(filterOptions.academicYears ?? []).map((y) => (
                                    <option key={y.id} value={y.id}>{y.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            {academicYear ? (
                                <>
                                    <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                        <strong className="text-foreground">{academicYear.name}</strong>
                                    </span>
                                    {period?.status === 'active' && (
                                        <Badge variant="default" className="h-5 text-[0.65rem] px-2">Активный</Badge>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs text-amber-600 flex items-center gap-1">
                                    <CalendarRange className="h-3.5 w-3.5" />
                                    Сезон не выбран
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Faculty/Department binding reminder ──────────────── */}
                {(!currentUser?.faculty_name || !currentUser?.department_name) && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm text-blue-800">
                        <div className="mt-0.5 h-5 w-5 shrink-0 text-blue-600">ℹ️</div>
                        <div>
                            <strong>Требуется привязка к структурным подразделениям:</strong>
                            <p className="mt-1">Пожалуйста, выберите <strong>факультет</strong> и <strong>кафедру</strong> в своем профиле. Это необходимо для корректного отображения структуры и обработки ваших KPI-показателей.</p>
                            <p className="mt-2">
                                <Link href={route('profile.edit')} className="font-semibold underline decoration-blue-400 underline-offset-2 hover:text-blue-900">
                                    Перейти в профиль →
                                </Link>
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Result score card ──────────────────────────────── */}
                {result ? (
                    <ResultScoreCard result={result} />
                ) : (
                    <div className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/30 px-3.5 py-2.5 text-sm text-muted-foreground">
                        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
                        Итоговый рейтинг ещё не сформирован — период не закрыт или расчёт не завершён.
                    </div>
                )}

                {/* ── Stat cards ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <StatCard icon={BarChart3} label="Всего записей" value={summary.total_entries ?? 0} />
                    <StatCard icon={TrendingUp} label="Утверждено" value={summary.approved_entries ?? 0} accent="green" />
                    <StatCard label="Отклоненные" value={summary.rejected_entries ?? 0} accent="red" />
                    <StatCard icon={Clock} label="На проверке" value={summary.pending_entries ?? 0} accent="amber" />
                    <StatCard label="Баллов" value={formatScore(summary.total_points)} accent="teal" />
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant={activeMainTab === 'entries' ? 'default' : 'outline'}
                        onClick={() => setActiveMainTab('entries')}
                    >
                        Показатели
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={activeMainTab === 'reference' ? 'default' : 'outline'}
                        onClick={() => setActiveMainTab('reference')}
                        disabled={indicatorReferenceItems.length === 0}
                    >
                        Справочник индикаторов
                    </Button>
                </div>

                {activeMainTab === 'reference' && indicatorReferenceItems.length > 0 && (
                    <Card className="admin-surface">
                        <CardHeader className="pb-3 pt-4">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#132844]">
                                <BookOpen className="h-4 w-4 text-[#139AA4]" />
                                Справочник KPI-индикаторов
                                <span className="ml-auto font-normal text-xs text-muted-foreground">
                                    Дополнительный раздел ({userLevelLabel})
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3 sm:p-4">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-[#132844]">Индикаторы для роли: {userLevelLabel}</h3>
                                    <Badge variant="outline">{indicatorReferenceItems.length} индикаторов</Badge>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[980px] text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-muted-foreground">
                                                <th className="py-2.5 pe-3 font-medium">Секция</th>
                                                <th className="py-2.5 pe-3 font-medium">Структурное подразделение (проверяющее)</th>
                                                <th className="py-2.5 pe-3 font-medium">Код</th>
                                                <th className="py-2.5 pe-3 font-medium">Название</th>
                                                <th className="py-2.5 pe-3 font-medium">Баллы</th>
                                                <th className="py-2.5 pe-3 font-medium">Правила баллов</th>
                                                <th className="py-2.5 pe-3 font-medium">Описание</th>
                                                <th className="py-2.5 pe-3 font-medium">Статус</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {indicatorReferenceItems.map((indicator) => (
                                                <tr key={indicator.id} className="border-b align-top last:border-0">
                                                    <td className="py-2.5 pe-3">{indicator.module_label ?? SECTION_LABELS[indicator.section] ?? indicator.section}</td>
                                                    <td className="py-2.5 pe-3">
                                                        {Array.isArray(indicator.structural_units) && indicator.structural_units.length > 0
                                                            ? indicator.structural_units
                                                                .map((unit) => unit?.name)
                                                                .filter(Boolean)
                                                                .join(', ')
                                                            : (indicator.checker_structural_unit?.name ?? 'Не указано')}
                                                    </td>
                                                    <td className="py-2.5 pe-3 font-mono">{indicator.code}</td>
                                                    <td className="py-2.5 pe-3">
                                                        <div className="font-medium">{indicator.name}</div>
                                                        <div className="text-xs text-muted-foreground">{indicator.unit || 'без единиц'}</div>
                                                    </td>
                                                    <td className="py-2.5 pe-3">{indicator.base_points}</td>
                                                    <td className="py-2.5 pe-3 whitespace-pre-line text-muted-foreground max-w-[260px]">{indicator.scoring_rules || '—'}</td>
                                                    <td className="py-2.5 pe-3">{indicator.description || '—'}</td>
                                                    <td className="py-2.5 pe-3">
                                                        {indicator.is_active ? <Badge>Активен</Badge> : <Badge variant="outline">Неактивен</Badge>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ── Entries by section ─────────────────────────────── */}
                {activeMainTab === 'entries' && (
                    <Card className="admin-surface">
                        <CardHeader className="pb-3 pt-4">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#132844]">
                                <FileText className="h-4 w-4 text-[#139AA4]" />
                                Мои записи KPI по разделам
                                <span className="ml-auto font-normal text-xs text-muted-foreground">
                                    Нажмите на строку для истории утверждения
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Entry filter bar */}
                            <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={applyFilters}>
                                <div>
                                    <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Этап</p>
                                    <select
                                        className={SELECT_CLS}
                                        value={filterForm.data.stage}
                                        onChange={(e) => filterForm.setData('stage', e.target.value)}
                                    >
                                        <option value="plan">План</option>
                                        <option value="fact">Факт</option>
                                        <option value="review">Рассмотрение</option>
                                    </select>
                                </div>
                                <div>
                                    <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Модуль</p>
                                    <select
                                        className={SELECT_CLS}
                                        value={filterForm.data.module}
                                        onChange={(e) => filterForm.setData('module', e.target.value)}
                                    >
                                        <option value="">Все</option>
                                        {modules.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Статус</p>
                                    <select
                                        className={SELECT_CLS}
                                        value={filterForm.data.status}
                                        onChange={(e) => filterForm.setData('status', e.target.value)}
                                    >
                                        <option value="">Все</option>
                                        {statusOptions.map((s) => <option key={s} value={s}>{statusLabels[s] ?? s}</option>)}
                                    </select>
                                </div>
                                <Button type="submit" size="sm">Применить</Button>
                                <Button type="button" size="sm" variant="outline" onClick={resetFilters}>Сбросить</Button>
                            </form>

                            {items.length === 0 ? (
                                <div className="admin-empty-state">
                                    <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                                    Записей пока нет. Создайте первую KPI-запись.
                                </div>
                            ) : (
                                <EntriesBySection items={items} isEditableEntry={isEditableEntry} isFileMissing={isFileMissing} uploadFile={uploadFile} uploadingEntryId={uploadingEntryId} submitEntry={submitEntry} deleteEntry={deleteEntry} openEditEntry={openEditEntry} />
                            )}

                            {links.length > 3 && (
                                <div className="mt-6 flex flex-wrap gap-2">
                                    {links.map((link, index) => (
                                        <Button
                                            key={`${link.label}-${index}`}
                                            variant={link.active ? 'default' : 'outline'}
                                            size="sm"
                                            disabled={!link.url}
                                            asChild={Boolean(link.url)}
                                        >
                                            {link.url ? (
                                                <Link href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} />
                                            ) : (
                                                <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                            )}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
