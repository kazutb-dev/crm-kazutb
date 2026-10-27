import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, FilterBar, Notice, PageHeader, StatGrid, StatTile, UnderlineTabs, qdFieldClass } from '@/components/platform';
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
import { Award, BarChart3, BookOpen, CalendarRange, ChevronDown, ChevronRight, CircleX, Clock, FileText, Filter, LoaderCircle, Paperclip, Pencil, Plus, Search, Send, Trash2, TrendingUp, Upload, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

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
    teaching: 'bg-teal-100 text-teal-700',
    science: 'bg-blue-100 text-blue-700',
    social: 'bg-emerald-100 text-emerald-700',
    qualification: 'bg-amber-100 text-amber-700',
    survey: 'bg-orange-100 text-orange-700',
    educational: 'bg-slate-200 text-slate-700',
    staff: 'bg-blue-50 text-blue-800',
    international: 'bg-teal-50 text-teal-800',
    other: 'bg-slate-100 text-slate-600',
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
    submitted: 'info',
    returned: 'warning',
    reviewed: 'secondary',
    pending_dean: 'info',
    pending_structural: 'default',
    approved: 'success',
    rejected: 'destructive',
    locked: 'destructive',
};

const spStatusLabels = {
    pending: 'Ожидает',
    approved: 'Подтверждено',
    rejected: 'Отклонено',
};

const spStatusVariants = {
    pending: 'warning',
    approved: 'success',
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

function normalizeSearchText(value) {
    return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
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

function toPositiveIntegerInput(value) {
    const digitsOnly = String(value ?? '').replace(/\D+/g, '');
    const normalized = digitsOnly.replace(/^0+/, '');
    return normalized;
}

function normalizeIntegerInput(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    const parsed = parseNumber(value, NaN);
    if (!Number.isFinite(parsed)) {
        return '';
    }

    if (parsed <= 0) {
        return '';
    }

    return String(Math.trunc(parsed));
}

function isPositiveIntegerValue(value) {
    if (value === null || value === undefined || value === '') {
        return false;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0;
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

function parseImprovementRates(rawRules) {
    const defaults = {
        upToTen: 0.5,
        overTen: 1,
        worsen: -2,
    };

    const rates = { ...defaults };
    const parts = String(rawRules ?? '')
        .replace(/\s+/g, ' ')
        .split(/\s*[;/]\s*/)
        .map((part) => part.trim())
        .filter(Boolean);

    parts.forEach((part) => {
        const normalized = part.toLowerCase().replace(/−/g, '-').trim();
        if (!normalized) {
            return;
        }

        const pointsMatch = normalized.match(/[-+]?\d+(?:[.,]\d+)?/);
        if (!pointsMatch) {
            return;
        }

        const points = parseNumber(pointsMatch[0], NaN);
        if (!Number.isFinite(points)) {
            return;
        }

        if (normalized.includes('ухудш')) {
            rates.worsen = points;
            return;
        }

        if (normalized.includes('более 10')) {
            rates.overTen = points;
            return;
        }

        if (normalized.includes('до 10')) {
            rates.upToTen = points;
        }
    });

    return rates;
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
        const rates = parseImprovementRates(rawRules);
        const upToTen = rates.upToTen;
        const overTen = rates.overTen;
        const worsen = rates.worsen;

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
            const coauthors = parseNumber(formData.rule_coauthors_count, NaN);
            const sheets = parseNumber(formData.rule_sheet_count, NaN);
            const perSheet = parseNumber(ruleSpec.perSheet, parseNumber(indicator?.base_points, 0));
            if (!Number.isInteger(coauthors) || !Number.isInteger(sheets) || coauthors <= 0 || sheets <= 0) {
                return null;
            }
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
            return null;
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
        details.sheet_count = parseNumber(formData.rule_sheet_count, NaN);
        details.coauthors_count = parseNumber(formData.rule_coauthors_count, NaN);
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

function validateRuleFields(ruleSpec, formData) {
    const errors = {};

    if (ruleSpec.kind === 'coauthors') {
        if (!isPositiveIntegerValue(formData.rule_sheet_count)) {
            errors.rule_sheet_count = 'Количество печатных листов должно быть целым числом больше 0.';
        }

        if (!isPositiveIntegerValue(formData.rule_coauthors_count)) {
            errors.rule_coauthors_count = 'Количество соавторов должно быть целым числом больше 0.';
        }
    }

    if (ruleSpec.kind === 'podium' && !String(formData.rule_place_points ?? '').trim()) {
        errors.rule_place_points = 'Выберите место.';
    }

    if (ruleSpec.kind === 'improvement' && !String(formData.rule_improvement_rate ?? '').trim()) {
        errors.rule_improvement_rate = 'Выберите тип изменения позиции.';
    }

    if (ruleSpec.kind === 'roleSplit' && !String(formData.rule_role_points ?? '').trim()) {
        errors.rule_role_points = 'Выберите роль.';
    }

    if (ruleSpec.kind === 'quartile' && !String(formData.rule_tier_points ?? '').trim()) {
        errors.rule_tier_points = 'Выберите категорию публикации.';
    }

    if (ruleSpec.kind === 'optionRate' && !String(formData.rule_option_points ?? '').trim()) {
        errors.rule_option_points = 'Выберите категорию или условие.';
    }

    return errors;
}

function buildRuleFormulaPreview(indicator, formData, ruleSpec, computedPoints) {
    if (!indicator || ruleSpec.kind === 'none' || computedPoints === null) {
        return null;
    }

    const quantity = parseNumber(formData.value, NaN);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return null;
    }

    if (ruleSpec.kind === 'coauthors') {
        const perSheet = parseNumber(ruleSpec.perSheet, parseNumber(indicator?.base_points, 0));
        const sheetCount = parseNumber(formData.rule_sheet_count, NaN);
        const coauthorsCount = parseNumber(formData.rule_coauthors_count, NaN);

        if (!Number.isFinite(sheetCount) || !Number.isFinite(coauthorsCount) || sheetCount <= 0 || coauthorsCount <= 0) {
            return null;
        }

        return `Баллы = Кол-во × Балл/п.л × П.л. / Соавторы = ${formatScore(quantity)} × ${formatScore(perSheet)} × ${formatScore(sheetCount)} / ${formatScore(coauthorsCount)} = ${formatScore(computedPoints)} б.`;
    }

    const selectedPoints = ruleSpec.kind === 'podium'
        ? parseNumber(formData.rule_place_points, NaN)
        : ruleSpec.kind === 'improvement'
            ? parseNumber(formData.rule_improvement_rate, NaN)
            : ruleSpec.kind === 'roleSplit'
                ? parseNumber(formData.rule_role_points, NaN)
                : ruleSpec.kind === 'quartile'
                    ? parseNumber(formData.rule_tier_points, NaN)
                    : parseNumber(formData.rule_option_points, NaN);

    if (!Number.isFinite(selectedPoints)) {
        return null;
    }

    return `Баллы = Кол-во × Коэффициент = ${formatScore(quantity)} × ${formatScore(selectedPoints)} = ${formatScore(computedPoints)} б.`;
}

const SELECT_CLS = qdFieldClass;
const FIELD_LABEL = 'qd-field-label block';
const FIELD_ERROR = 'text-sm text-red-700';
const SUBBOX = 'rounded-xl border border-slate-200 bg-white p-3';
const SUBBOX_LABEL = 'qd-field-label mb-2 block text-slate-500';

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
    review: 'text-teal-700 bg-teal-50 border-teal-200',
    approve: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    reject: 'text-red-700 bg-red-50 border-red-200',
    lock: 'text-slate-600 bg-slate-100 border-slate-200',
};

// ─── result score card ───────────────────────────────────────────────────────

function ResultScoreCard({ result }) {
    if (!result) return null;
    const rVal = Number(result.rank_score ?? 0);
    const hasAnyScore = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].some((k) => result[k] > 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Award />
                    Итоговый рейтинг
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
                    <div>
                        <p className="qd-field-label text-slate-500">Рейтинг R</p>
                        <p className={['mt-2 font-display text-5xl font-bold leading-none tabular-nums', rVal > 0 ? 'text-teal-700' : 'text-slate-300'].join(' ')}>
                            {formatScore(rVal)}
                        </p>
                    </div>
                    {hasAnyScore && (
                        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-6">
                            {['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((k, i) => (
                                <div key={k} className="min-w-[4.5rem] bg-white px-3 py-2 text-center">
                                    <p className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-slate-500">K{i + 1}</p>
                                    <p className={['mt-1 font-display text-lg font-bold tabular-nums', result[k] > 0 ? 'text-[#102945]' : 'text-slate-300'].join(' ')}>
                                        {formatScore(result[k])}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                    {result.approved_entries !== undefined && (
                        <div className="ml-auto text-right">
                            <p className="qd-field-label text-slate-500">Утв. записей</p>
                            <p className="mt-2 font-display text-3xl font-bold leading-none tabular-nums text-emerald-700">{result.approved_entries}</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function EntryHistory({ history }) {
    if (!history?.length) {
        return <p className="text-xs text-slate-500">История действий отсутствует.</p>;
    }

    return (
        <div className="mt-3 space-y-1.5">
            <p className={SUBBOX_LABEL}>История утверждения</p>
            <div className="relative space-y-2 pl-4 before:absolute before:bottom-1 before:left-1.5 before:top-1 before:w-px before:bg-slate-200">
                {history.map((log, i) => (
                    <div key={log.id ?? i} className="relative flex items-start gap-2.5">
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
                                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium',
                                    ACTION_COLORS[log.action] ?? ACTION_COLORS.lock,
                                ].join(' ')}>
                                    {ACTION_LABELS[log.action] ?? log.action}
                                </span>
                                <span className="text-xs font-medium text-slate-800">{log.actor_name}</span>
                                <span className="text-[0.6875rem] tabular-nums text-slate-500">{fmtDateTime(log.created_at)}</span>
                            </div>
                            {log.comment && (
                                <p className="mt-0.5 text-xs italic text-slate-600">"{log.comment}"</p>
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
            <p className={SUBBOX_LABEL}>Подтверждения СП</p>
            <div className="space-y-2">
                {confirmations.map((item, i) => (
                    <div
                        key={`${item.structural_unit_id ?? i}-${i}`}
                        className={[
                            'rounded-[10px] border bg-white p-2.5',
                            item.status === 'approved'
                                ? 'border-emerald-200'
                                : item.status === 'rejected'
                                    ? 'border-red-200'
                                    : 'border-slate-200',
                        ].join(' ')}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium text-slate-900">{resolveUnitName(item)}</p>
                            <Badge variant={spStatusVariants[item.status] ?? 'outline'} className="text-[0.65rem]">
                                {spStatusLabels[item.status] ?? item.status}
                            </Badge>
                        </div>
                        <p className="mt-1 text-[0.7rem] text-slate-500">
                            {item.status === 'rejected'
                                ? `Отклонил: ${resolveActorName(item)}`
                                : item.status === 'approved'
                                    ? `Подтвердил: ${resolveActorName(item)}`
                                    : 'Ответственный: —'}
                            {' · '}
                            {fmtDateTime(item.confirmed_at)}
                        </p>
                        {item.comment && (
                            <p className="mt-1 text-[0.7rem] italic text-slate-600">"{item.comment}"</p>
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
                className={`cursor-pointer border-b border-slate-200 transition-colors hover:bg-slate-50 ${expanded ? 'bg-slate-50' : ''}`}
                onClick={() => setExpanded((v) => !v)}
            >
                <td>
                    <div className="flex items-center gap-1">
                        {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        )}
                    </div>
                </td>
                <td className="font-mono text-xs text-slate-500">{entry.indicator?.code ?? '—'}</td>
                <td className="font-medium text-slate-900">{entry.indicator?.name ?? '—'}</td>
                <td className="text-right text-sm tabular-nums text-slate-700">{entry.indicator?.base_points ?? '—'}</td>
                <td className="text-right text-sm tabular-nums text-slate-700">{entry.fact_value ?? '—'}</td>
                <td className="text-right font-display text-base font-bold tabular-nums text-[#102945]">{formatScore(entry.points_for_display ?? entry.manual_points ?? entry.calculated_points)}</td>
                <td>
                    <Badge variant={statusVariants[entry.status] ?? 'outline'} className="text-[0.7rem]">
                        {statusLabels[entry.status] ?? entry.status}
                    </Badge>
                    {isFileMissing && <Badge variant="warning" className="mt-1 text-[0.65rem]">Нужен файл</Badge>}
                </td>
                <td className="text-right">
                    <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="outline">
                            <Link href={route('kpi.entries.show', entry.id)} onClick={(e) => e.stopPropagation()}>Открыть</Link>
                        </Button>
                        {isEditable && (
                            (entry.status === 'draft' || entry.status === 'returned' || entry.status === 'rejected') ? (
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEditEntry(entry); }}>
                                    <Pencil className="h-3 w-3" />
                                    {entry.status === 'draft' ? 'Редактировать' : 'Исправить'}
                                </Button>
                            ) : (
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); submitEntry(entry.id); }} disabled={isFileMissing} title="Отправить на проверку" aria-label="Отправить на проверку">
                                    <Send className="h-3 w-3" />
                                </Button>
                            )
                        )}
                        {entry.status !== 'approved' && (
                            <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={(e) => { e.stopPropagation(); deleteEntry(entry); }} title="Удалить запись" aria-label="Удалить запись">
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr className="border-b border-slate-200 bg-slate-50">
                    <td colSpan={8} className="py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
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
                                    <p className={SUBBOX_LABEL}>Источник</p>
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
                                                className="block break-all text-xs font-medium text-teal-700 underline-offset-2 hover:text-[#102945] hover:underline"
                                            >
                                                {link}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            <div>
                                <p className={SUBBOX_LABEL}>Файлы</p>
                                {(entry.files?.length ?? 0) > 0 ? (
                                    <div className="space-y-1">
                                        {entry.files.map((file) => (
                                            <a
                                                key={file.id}
                                                href={file.file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-2 text-xs font-medium text-teal-700 underline-offset-2 hover:text-[#102945] hover:underline"
                                            >
                                                <Paperclip className="h-3 w-3 shrink-0" />
                                                <span className="truncate">{file.file_name}</span>
                                                <span className="font-normal text-slate-500">({formatFileSize(file.file_size)})</span>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <p className={`text-xs ${entry.indicator?.requires_file ? 'font-medium text-amber-700' : 'text-slate-500'}`}>{entry.indicator?.requires_file ? 'Файл обязателен' : 'Не прикреплены'}</p>
                                )}
                                {isEditable && (
                                    <label className="mt-2 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border border-slate-300 bg-white px-3 text-xs font-bold uppercase tracking-[0.08em] text-[#102945] transition-colors hover:border-teal-600 hover:text-teal-700" onClick={(e) => e.stopPropagation()}>
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
                const iconCls = SECTION_ICON_COLOR[section] ?? 'bg-slate-100 text-slate-600';

                return (
                    <div key={section}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <span className={`inline-flex h-7 min-w-9 items-center justify-center rounded-[8px] px-2 text-xs font-bold tracking-[0.06em] ${iconCls}`}>
                                    {SECTION_SHORT[section] ?? section}
                                </span>
                                <span className="font-display text-base font-bold text-[#102945]">
                                    {SECTION_LABELS[section] ?? section}
                                </span>
                            </div>
                            <span className="text-xs font-semibold text-slate-500">
                                Итого: <span className="font-display text-base font-bold tabular-nums text-[#102945]">{formatScore(sectionTotal)}</span> б.
                            </span>
                        </div>
                        <div className="admin-table-wrap">
                            <table className="admin-data-table min-w-[800px]">
                                <thead>
                                    <tr>
                                        <th className="w-6"></th>
                                        <th className="w-16">Код</th>
                                        <th>Показатель</th>
                                        <th className="w-24 text-right">Базовый балл</th>
                                        <th className="w-20 text-right">Факт</th>
                                        <th className="w-20 text-right">Баллы</th>
                                        <th className="w-28">Статус</th>
                                        <th className="w-40 text-right">Действия</th>
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

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [createOpen, setCreateOpen] = useState(false);
    const [uploadingEntryId, setUploadingEntryId] = useState(null);
    const [createFilesList, setCreateFilesList] = useState([]);
    const [editingEntryId, setEditingEntryId] = useState(null);
    const [editingEntryFiles, setEditingEntryFiles] = useState([]);
    const [activeMainTab, setActiveMainTab] = useState('entries');
    const [entrySearch, setEntrySearch] = useState('');
    const createFileInputRef = useRef(null);
    const createDialogContentRef = useRef(null);
    const activeSeason = activeSeasons[0] ?? null;

    const filterForm = useForm({
        stage: filters.stage ?? 'plan',
        status: filters.status ?? '',
        module: filters.module ?? '',
        group_code: filters.group_code ?? '',
    });

    const initialAcademicYearId = filters.academic_year_id ?? activeSeason?.academic_year_id ?? '';

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

    const ruleFormulaPreview = useMemo(() => {
        return buildRuleFormulaPreview(selectedIndicator, createForm.data, selectedRuleSpec, calculatedManualPoints);
    }, [selectedIndicator, createForm.data, selectedRuleSpec, calculatedManualPoints]);

    const scrollToFirstCreateError = (errorKeys = null) => {
        const keys = (errorKeys ?? Object.keys(createForm.errors)).filter(Boolean);
        if (keys.length === 0) {
            return;
        }

        requestAnimationFrame(() => {
            const container = createDialogContentRef.current;
            if (!container) {
                return;
            }

            const fieldPriority = [
                'academic_year_id',
                'module',
                'group_code',
                'indicator_id',
                'value',
                'rule_place_points',
                'rule_improvement_rate',
                'rule_sheet_count',
                'rule_coauthors_count',
                'rule_role_points',
                'rule_tier_points',
                'rule_option_points',
                'comment',
                'external_source_url',
                'external_source_urls',
                'evidence',
                'files',
            ];

            const firstField = fieldPriority.find((field) => keys.includes(field) || keys.some((key) => key.startsWith(`${field}.`)));
            const target = firstField
                ? container.querySelector(`[data-error-field="${firstField}"]`)
                : null;

            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    };

    useEffect(() => {
        if (createOpen && Object.keys(createForm.errors).length > 0) {
            scrollToFirstCreateError();
        }
    }, [createOpen, createForm.errors]);

    useEffect(() => {
        if (editingEntryId) {
            return;
        }

        if (!activeSeason?.academic_year_id) {
            return;
        }

        const activeSeasonId = String(activeSeason.academic_year_id);
        if (createForm.data.academic_year_id !== activeSeasonId) {
            createForm.setData('academic_year_id', activeSeasonId);
        }
    }, [activeSeason?.academic_year_id, editingEntryId]);

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

        createForm.clearErrors(
            'academic_year_id',
            'module',
            'group_code',
            'indicator_id',
            'value',
            'comment',
            'external_source_url',
            'external_source_urls',
            'files',
            'evidence',
            'rule_place_points',
            'rule_improvement_rate',
            'rule_sheet_count',
            'rule_coauthors_count',
            'rule_role_points',
            'rule_tier_points',
            'rule_option_points',
        );

        if (isTotalFileSizeExceeded) {
            createForm.setError('files', 'Общий размер файлов не должен превышать 100 МБ.');
            scrollToFirstCreateError(['files']);
            return;
        }

        const computedData = {
            ...createForm.data,
            value: createForm.data.value,
        };

        if (!computedData.academic_year_id) {
            createForm.setError('academic_year_id', 'Сезон обязателен.');
            scrollToFirstCreateError(['academic_year_id']);
            return;
        }

        if (!String(computedData.module ?? '').trim()) {
            createForm.setError('module', 'Модуль обязателен.');
            scrollToFirstCreateError(['module']);
            return;
        }

        if (!String(computedData.group_code ?? '').trim()) {
            createForm.setError('group_code', 'Код блока обязателен.');
            scrollToFirstCreateError(['group_code']);
            return;
        }

        if (!String(computedData.indicator_id ?? '').trim()) {
            createForm.setError('indicator_id', 'Код показателя обязателен.');
            scrollToFirstCreateError(['indicator_id']);
            return;
        }

        if (!String(computedData.value ?? '').trim()) {
            createForm.setError('value', 'Значение обязательно.');
            scrollToFirstCreateError(['value']);
            return;
        }

        if (!String(computedData.comment ?? '').trim()) {
            createForm.setError('comment', 'Комментарий обязателен.');
            scrollToFirstCreateError(['comment']);
            return;
        }

        const ruleFieldErrors = validateRuleFields(selectedRuleSpec, computedData);
        if (Object.keys(ruleFieldErrors).length > 0) {
            Object.entries(ruleFieldErrors).forEach(([field, message]) => {
                createForm.setError(field, message);
            });
            scrollToFirstCreateError(Object.keys(ruleFieldErrors));
            return;
        }

        const numericValue = parseNumber(computedData.value, NaN);
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
            createForm.setError('value', 'Значение KPI должно быть целым числом больше 0.');
            scrollToFirstCreateError(['value']);
            return;
        }

        if (Number.isFinite(numericValue) && !Number.isInteger(numericValue)) {
            createForm.setError('value', 'Значение KPI должно быть целым числом больше 0.');
            scrollToFirstCreateError(['value']);
            return;
        }

        const externalLinks = (computedData.external_source_urls ?? [])
            .map((url) => String(url ?? '').trim())
            .filter(Boolean)
            .slice(0, MAX_EXTERNAL_LINKS);

        const hasEvidenceLink = externalLinks.length > 0;
        const hasEvidenceFile = createFilesList.length > 0 || editingEntryFiles.length > 0;
        if (!hasEvidenceLink && !hasEvidenceFile) {
            createForm.setError('evidence', 'Укажите хотя бы одну ссылку на внешний источник или прикрепите файл подтверждения.');
            scrollToFirstCreateError(['evidence']);
            return;
        }

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
        createForm.setData('value', toPositiveIntegerInput(event.target.value));
    };

    const handleCreateValueKeyDown = (event) => {
        if (['.', ',', 'e', 'E', '+', '-'].includes(event.key)) {
            event.preventDefault();
        }
    };

    const openEditEntry = (entry) => {
        const entryAcademicYearId = entry.academic_year_id
            ?? entry.academicYear?.id
            ?? entry.academic_year?.id
            ?? null;

        const existingExternalLinks = Array.isArray(entry.calculation_details?.external_source_urls)
            ? entry.calculation_details.external_source_urls
                .map((url) => String(url ?? '').trim())
                .filter(Boolean)
            : [];

        const details = entry.calculation_details ?? {};
        const ruleKind = String(details.rule_kind ?? '');
        const selectionPoints = details.selection_points !== undefined && details.selection_points !== null
            ? normalizeIntegerInput(details.selection_points)
            : '';
        const matchedIndicator = indicators.find((indicator) => String(indicator.id) === String(entry.indicator_id ?? entry.indicator?.id ?? '')) ?? null;

        createForm.setData((prev) => ({
            ...prev,
            academic_year_id: entryAcademicYearId ? String(entryAcademicYearId) : prev.academic_year_id,
            stage: 'fact',
            module: entry.indicator?.section ?? prev.module,
            group_code: matchedIndicator?.group_code ?? '',
            indicator_id: String(entry.indicator_id ?? entry.indicator?.id ?? ''),
            value: normalizeIntegerInput(entry.fact_value),
            rule_place_points: ruleKind === 'podium' ? selectionPoints : '',
            rule_improvement_rate: ruleKind === 'improvement' ? selectionPoints : '',
            rule_coauthors_count: ruleKind === 'coauthors' && details.coauthors_count !== undefined && details.coauthors_count !== null
                ? normalizeIntegerInput(details.coauthors_count)
                : '',
            rule_sheet_count: ruleKind === 'coauthors' && details.sheet_count !== undefined && details.sheet_count !== null
                ? normalizeIntegerInput(details.sheet_count)
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

        setConfirmState({
            open: true,
            description: 'Удалить файл из записи?',
            onConfirm: () => router.delete(route('kpi.entries.files.destroy', { entry: editingEntryId, file: fileId }), {
                preserveScroll: true,
                onSuccess: () => {
                    setEditingEntryFiles((current) => current.filter((file) => file.id !== fileId));
                },
            }),
        });
    };

    const submitEntry = (entryId) => {
        router.post(route('kpi.my-entries.submit', entryId), {}, {
            preserveScroll: true,
        });
    };

    const deleteEntry = (entry) => {
        setConfirmState({
            open: true,
            description: `Удалить запись ${entry.indicator?.code ?? ''}?`,
            onConfirm: () => router.delete(route('kpi.my-entries.destroy', entry.id), {
                preserveScroll: true,
            }),
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

    const openCreateEntry = () => {
        createForm.reset();
        if (activeSeason?.academic_year_id) {
            createForm.setData('academic_year_id', String(activeSeason.academic_year_id));
        }
        createForm.clearErrors();
        setCreateFilesList([]);
        setEditingEntryId(null);
        setEditingEntryFiles([]);
    };

    const isFileMissing = (entry) => {
        if (!entry.indicator?.requires_file) {
            return false;
        }

        return (entry.files?.length ?? 0) === 0;
    };

    const filteredItems = useMemo(() => {
        const query = normalizeSearchText(entrySearch);

        if (query === '') {
            return items;
        }

        return items.filter((entry) => {
            const confirmations = (entry.structural_confirmation_matrix ?? entry.structural_confirmations ?? [])
                .map((item) => `${item.name ?? ''} ${item.status ?? ''} ${item.comment ?? ''} ${item.confirmed_by ?? ''}`)
                .join(' ');

            const filesText = (entry.files ?? []).map((file) => file.file_name ?? '').join(' ');

            const haystack = normalizeSearchText([
                entry.indicator?.code,
                entry.indicator?.name,
                SECTION_LABELS[entry.indicator?.section] ?? entry.indicator?.section,
                entry.fact_value,
                entry.points_for_display ?? entry.manual_points ?? entry.calculated_points,
                statusLabels[entry.status] ?? entry.status,
                entry.comment,
                entry.external_source_url,
                filesText,
                confirmations,
                'открыть редактировать исправить отправить удалить',
            ].join(' '));

            return haystack.includes(query);
        });
    }, [entrySearch, items]);

    const heroMeta = [currentUser.title, currentUser.faculty_name, currentUser.department_name].filter(Boolean);
    if (!currentUser.faculty_name && !currentUser.department_name && currentUser.division) {
        heroMeta.push(currentUser.division);
    }

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Мои показатели"
                    title={currentUser.name ?? 'KPI — Мои показатели'}
                    description={heroMeta.length > 0 ? heroMeta.join(' · ') : null}
                    meta={(activeSeason?.label || academicYear) ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="gap-1.5">
                                <CalendarRange className="h-3.5 w-3.5 text-teal-700" />
                                {activeSeason?.label ?? academicYear?.name}
                            </Badge>
                            {(period?.status === 'active' || activeSeason) && (
                                <Badge variant="success">Активный</Badge>
                            )}
                        </div>
                    ) : (
                        <Badge variant="warning" className="gap-1.5">
                            <CalendarRange className="h-3.5 w-3.5" />
                            Сезон не выбран
                        </Badge>
                    )}
                />
            )}
            headerRight={
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" onClick={openCreateEntry}>
                            <Plus className="h-4 w-4" />
                            Создать запись
                        </Button>
                    </DialogTrigger>
                    <DialogContent ref={createDialogContentRef} className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>{editingEntryId ? 'Исправление KPI-записи' : 'Новая KPI-запись'}</DialogTitle>
                            <DialogDescription>
                                {editingEntryId
                                    ? 'Исправьте данные по замечаниям и отправьте запись повторно на проверку.'
                                    : 'Выберите активный сезон, модуль и показатель, затем сохраните как черновик или сразу отправьте на проверку.'}
                            </DialogDescription>
                        </DialogHeader>

                        <form className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2" data-error-field="evidence">
                                <div className="space-y-2 sm:col-span-2" data-error-field="academic_year_id">
                                    <label className={FIELD_LABEL}>Сезон</label>
                                    <div className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-[#102945]">
                                        <CalendarRange className="h-4 w-4 shrink-0 text-teal-700" />
                                        {activeSeason?.label ?? academicYear?.name ?? 'Нет активного сезона'}
                                    </div>
                                    <input type="hidden" value={createForm.data.academic_year_id} readOnly />
                                    {!hasActiveSeason && !editingEntryId && (
                                        <Notice tone="warning">
                                            Нет активных KPI-сезонов. Обратитесь к администратору.
                                        </Notice>
                                    )}
                                    {createForm.errors.academic_year_id && (
                                        <p className={FIELD_ERROR}>{createForm.errors.academic_year_id}</p>
                                    )}
                                </div>

                                <div className="space-y-2" data-error-field="module">
                                    <label className={FIELD_LABEL}>Модуль</label>
                                    <select
                                        className={SELECT_CLS}
                                        value={createForm.data.module}
                                        onChange={(event) => {
                                            createForm.setData('module', event.target.value);
                                            createForm.clearErrors('module', 'group_code', 'indicator_id');
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
                                    {createForm.errors.module && <p className={FIELD_ERROR}>{createForm.errors.module}</p>}
                                </div>

                                <div className="space-y-2" data-error-field="group_code">
                                    <label className={FIELD_LABEL}>Код блока</label>
                                    <select
                                        className={SELECT_CLS}
                                        value={createForm.data.group_code}
                                        onChange={(event) => {
                                            createForm.setData('group_code', event.target.value);
                                            createForm.clearErrors('group_code', 'indicator_id');
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
                                    {createForm.errors.group_code && <p className={FIELD_ERROR}>{createForm.errors.group_code}</p>}
                                </div>

                                <div className="space-y-2" data-error-field="indicator_id">
                                    <label className={FIELD_LABEL}>Код показателя</label>
                                    <select
                                        className={SELECT_CLS}
                                        value={createForm.data.indicator_id}
                                        onChange={(event) => {
                                            createForm.setData('indicator_id', event.target.value);
                                            createForm.clearErrors('indicator_id', 'value', 'rule_place_points', 'rule_improvement_rate', 'rule_sheet_count', 'rule_coauthors_count', 'rule_role_points', 'rule_tier_points', 'rule_option_points');
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
                                    {createForm.errors.indicator_id && <p className={FIELD_ERROR}>{createForm.errors.indicator_id}</p>}
                                </div>
                                {selectedIndicator && (
                                    <div className="space-y-2 sm:col-span-2">
                                        <label className={FIELD_LABEL}>Описание показателя</label>
                                        <div className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700">
                                            {selectedIndicator.description || 'Описание не указано'}
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2" data-error-field="value">
                                    <label className={FIELD_LABEL}>Значение</label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            step="1"
                                            min="1"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={createForm.data.value}
                                            onChange={handleCreateValueChange}
                                            onKeyDown={handleCreateValueKeyDown}
                                        />
                                        <span className="flex h-10 shrink-0 items-center rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                                            {selectedIndicator?.unit || 'без ед.'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Единица измерения: <span className="font-medium text-slate-900">{selectedIndicator?.unit || 'не указана'}</span>
                                    </p>
                                    <p className="text-xs text-slate-500">Значение KPI должно быть целым числом больше 0.</p>
                                    {createForm.errors.value && <p className={FIELD_ERROR}>{createForm.errors.value}</p>}
                                </div>

                                {selectedRuleSpec.kind === 'podium' && (
                                    <div className="space-y-2" data-error-field="rule_place_points">
                                        <label className={FIELD_LABEL}>Место</label>
                                        <select
                                            className={SELECT_CLS}
                                            value={createForm.data.rule_place_points}
                                            onChange={(event) => createForm.setData('rule_place_points', event.target.value)}
                                        >
                                            <option value="">Выберите место</option>
                                            {(selectedRuleSpec.options ?? []).map((item) => (
                                                <option key={item.value + item.label} value={item.value}>{item.label}</option>
                                            ))}
                                        </select>
                                        {createForm.errors.rule_place_points && <p className={FIELD_ERROR}>{createForm.errors.rule_place_points}</p>}
                                    </div>
                                )}

                                {selectedRuleSpec.kind === 'improvement' && (
                                    <div className="space-y-2" data-error-field="rule_improvement_rate">
                                        <label className={FIELD_LABEL}>Тип изменения позиции</label>
                                        <select
                                            className={SELECT_CLS}
                                            value={createForm.data.rule_improvement_rate}
                                            onChange={(event) => createForm.setData('rule_improvement_rate', event.target.value)}
                                        >
                                            <option value="">Выберите вариант</option>
                                            {(selectedRuleSpec.options ?? []).map((item) => (
                                                <option key={item.value + item.label} value={item.value}>{item.label}</option>
                                            ))}
                                        </select>
                                        {createForm.errors.rule_improvement_rate && <p className={FIELD_ERROR}>{createForm.errors.rule_improvement_rate}</p>}
                                    </div>
                                )}

                                {selectedRuleSpec.kind === 'coauthors' && (
                                    <>
                                        <div className="space-y-2" data-error-field="rule_sheet_count">
                                            <label className={FIELD_LABEL}>Количество печатных листов</label>
                                            <Input
                                                type="number"
                                                step="1"
                                                min="1"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={createForm.data.rule_sheet_count}
                                                onChange={(event) => createForm.setData('rule_sheet_count', toPositiveIntegerInput(event.target.value))}
                                                onKeyDown={handleCreateValueKeyDown}
                                            />
                                            {createForm.errors.rule_sheet_count && <p className={FIELD_ERROR}>{createForm.errors.rule_sheet_count}</p>}
                                        </div>
                                        <div className="space-y-2" data-error-field="rule_coauthors_count">
                                            <label className={FIELD_LABEL}>Количество соавторов</label>
                                            <Input
                                                type="number"
                                                step="1"
                                                min="1"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={createForm.data.rule_coauthors_count}
                                                onChange={(event) => createForm.setData('rule_coauthors_count', toPositiveIntegerInput(event.target.value))}
                                                onKeyDown={handleCreateValueKeyDown}
                                            />
                                            {createForm.errors.rule_coauthors_count && <p className={FIELD_ERROR}>{createForm.errors.rule_coauthors_count}</p>}
                                        </div>
                                    </>
                                )}

                                {selectedRuleSpec.kind === 'roleSplit' && (
                                    <div className="space-y-2" data-error-field="rule_role_points">
                                        <label className={FIELD_LABEL}>Ваша роль</label>
                                        <select
                                            className={SELECT_CLS}
                                            value={createForm.data.rule_role_points}
                                            onChange={(event) => createForm.setData('rule_role_points', event.target.value)}
                                        >
                                            <option value="">Выберите роль</option>
                                            {(selectedRuleSpec.options ?? []).map((item) => (
                                                <option key={item.value + item.label} value={item.value}>{item.label}</option>
                                            ))}
                                        </select>
                                        {createForm.errors.rule_role_points && <p className={FIELD_ERROR}>{createForm.errors.rule_role_points}</p>}
                                    </div>
                                )}

                                {selectedRuleSpec.kind === 'quartile' && (
                                    <div className="space-y-2" data-error-field="rule_tier_points">
                                        <label className={FIELD_LABEL}>Категория публикации</label>
                                        <select
                                            className={SELECT_CLS}
                                            value={createForm.data.rule_tier_points}
                                            onChange={(event) => createForm.setData('rule_tier_points', event.target.value)}
                                        >
                                            <option value="">Выберите категорию</option>
                                            {(selectedRuleSpec.options ?? []).map((item) => (
                                                <option key={item.value + item.label} value={item.value}>{item.label}</option>
                                            ))}
                                        </select>
                                        {createForm.errors.rule_tier_points && <p className={FIELD_ERROR}>{createForm.errors.rule_tier_points}</p>}
                                    </div>
                                )}

                                {selectedRuleSpec.kind === 'optionRate' && (
                                    <div className="space-y-2 sm:col-span-2" data-error-field="rule_option_points">
                                        <label className={FIELD_LABEL}>Категория/условие</label>
                                        <select
                                            className={SELECT_CLS}
                                            value={createForm.data.rule_option_points}
                                            onChange={(event) => createForm.setData('rule_option_points', event.target.value)}
                                        >
                                            <option value="">Выберите вариант</option>
                                            {(selectedRuleSpec.options ?? []).map((item) => (
                                                <option key={item.value + item.label} value={item.value}>{item.label}</option>
                                            ))}
                                        </select>
                                        {createForm.errors.rule_option_points && <p className={FIELD_ERROR}>{createForm.errors.rule_option_points}</p>}
                                    </div>
                                )}
                            </div>

                            {selectedIndicator?.scoring_rules && (
                                <Notice tone="info" title="Правила баллов">
                                    <span className="whitespace-pre-line text-xs">{selectedIndicator.scoring_rules}</span>
                                </Notice>
                            )}

                            {calculatedManualPoints !== null && (
                                <Notice tone="success" title={`Расчет по правилу: ${formatScore(calculatedManualPoints)} б.`}>
                                    {ruleFormulaPreview ? <span className="text-xs">{ruleFormulaPreview}</span> : null}
                                </Notice>
                            )}

                            <div className="space-y-2" data-error-field="comment">
                                <label className={FIELD_LABEL}>Комментарий</label>
                                <textarea
                                    className={`${qdFieldClass} h-auto min-h-24 py-2`}
                                    value={createForm.data.comment}
                                    onChange={(event) => createForm.setData('comment', event.target.value)}
                                    placeholder="Комментарий к записи"
                                />
                                {createForm.errors.comment && <p className={FIELD_ERROR}>{createForm.errors.comment}</p>}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2" data-error-field="external_source_url">
                                    <label className={FIELD_LABEL}>Ссылка на внешний источник</label>
                                    {editingEntryId && (createForm.data.external_source_urls ?? []).some((url) => String(url ?? '').trim() !== '') && (
                                        <div className={SUBBOX}>
                                            <p className={SUBBOX_LABEL}>Текущие ссылки</p>
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
                                                                className="block flex-1 break-all text-xs font-medium text-teal-700 underline-offset-2 hover:text-[#102945] hover:underline"
                                                            >
                                                                {link}
                                                            </a>
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7 text-red-700"
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
                                                            className="h-10 w-10 shrink-0"
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
                                                            className="h-10 w-10 shrink-0"
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
                                    <p className="text-xs text-slate-500">
                                        Можно добавить до {MAX_EXTERNAL_LINKS} ссылок. Пустые строки не отправляются.
                                    </p>
                                    {createForm.errors.external_source_url && (
                                        <p className={FIELD_ERROR}>{createForm.errors.external_source_url}</p>
                                    )}
                                    {createForm.errors.external_source_urls && (
                                        <p className={FIELD_ERROR}>{createForm.errors.external_source_urls}</p>
                                    )}
                                    {createForm.errors['external_source_urls.0'] && (
                                        <p className={FIELD_ERROR}>{createForm.errors['external_source_urls.0']}</p>
                                    )}
                                    {createForm.errors.evidence && (
                                        <p className={FIELD_ERROR}>{createForm.errors.evidence}</p>
                                    )}
                                </div>

                                <div className="space-y-2" data-error-field="files">
                                    <label className={FIELD_LABEL}>Файл подтверждения</label>
                                    {editingEntryId && editingEntryFiles.length > 0 && (
                                        <div className={SUBBOX}>
                                            <p className={SUBBOX_LABEL}>Уже прикреплены</p>
                                            <div className="space-y-1">
                                                {editingEntryFiles.map((file) => (
                                                    <div key={`editing-file-${file.id}`} className="flex items-center gap-2">
                                                        <a
                                                            href={file.file_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-teal-700 underline-offset-2 hover:text-[#102945] hover:underline"
                                                        >
                                                            <Paperclip className="h-3 w-3 shrink-0" />
                                                            <span className="truncate">{file.file_name}</span>
                                                            <span className="font-normal text-slate-500">({formatFileSize(file.file_size)})</span>
                                                        </a>
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-red-700"
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
                                            className="w-full justify-between border-dashed"
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
                                            <div className={SUBBOX}>
                                                <p className={SUBBOX_LABEL}>
                                                    Выбранные файлы ({createFilesList.length})
                                                </p>
                                                <div className="space-y-1">
                                                    {createFilesList.map((file, index) => (
                                                        <div key={`new-file-${index}`} className="flex items-center gap-2 text-xs">
                                                            <Paperclip className="h-3 w-3 shrink-0 text-slate-400" />
                                                            <span className="min-w-0 flex-1 truncate text-slate-800">{file.name}</span>
                                                            <span className="shrink-0 tabular-nums text-slate-500">({formatFileSize(file.size)})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2 border-t border-slate-200 pt-2 text-xs">
                                                    <div className="flex justify-between text-slate-500">
                                                        <span>Всего:</span>
                                                        <span className={isTotalFileSizeExceeded ? 'font-semibold tabular-nums text-red-700' : 'tabular-nums'}>
                                                            {formatFileSize(totalUploadedFileSize)} / {formatFileSize(totalMaxFileSize)}
                                                        </span>
                                                    </div>
                                                    {isTotalFileSizeExceeded && (
                                                        <p className="mt-1 font-medium text-red-700">Превышен общий лимит размера файлов</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {createFilesList.length === 0 && (
                                            <p className="text-xs text-slate-500">
                                                Файлы не выбраны (до 100 МБ суммарно)
                                            </p>
                                        )}
                                    </div>
                                    {(createForm.errors.files || createForm.errors['files.0']) && (
                                        <p className={FIELD_ERROR}>{createForm.errors.files || createForm.errors['files.0']}</p>
                                    )}
                                    {createForm.errors.evidence && (
                                        <p className={FIELD_ERROR}>{createForm.errors.evidence}</p>
                                    )}
                                </div>
                            </div>

                            <p className="text-xs text-slate-500">
                                Файл можно прикрепить сразу при создании записи.
                                {selectedIndicator?.requires_file ? ' Для выбранного показателя файл обязателен.' : ''}
                            </p>

                            <DialogFooter className="gap-2 border-t border-slate-200 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={(event) => submitCreate(event, 'draft')}
                                    disabled={createForm.processing || (!editingEntryId && !hasActiveSeason) || !createForm.data.academic_year_id || isTotalFileSizeExceeded}
                                >
                                    Сохранить как черновик
                                </Button>
                                <Button
                                    type="button"
                                    onClick={(event) => submitCreate(event, 'submit')}
                                    disabled={createForm.processing || (!editingEntryId && !hasActiveSeason) || !createForm.data.academic_year_id || isTotalFileSizeExceeded}
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

            <div className="admin-page-wrap space-y-6">

                {/* ── Faculty/Department binding reminder ──────────────── */}
                {(!currentUser?.faculty_name || !currentUser?.department_name) && (
                    <Notice tone="info" title="Требуется привязка к структурным подразделениям">
                        <p>
                            Пожалуйста, выберите <strong>факультет</strong> и <strong>кафедру</strong> в своем профиле. Это необходимо для корректного отображения структуры и обработки ваших KPI-показателей.
                        </p>
                        <Button asChild size="sm" variant="outline" className="mt-3">
                            <Link href={route('profile.edit')}>Перейти в профиль</Link>
                        </Button>
                    </Notice>
                )}

                {/* ── Stat tiles ─────────────────────────────────────── */}
                <StatGrid>
                    <StatTile icon={BarChart3} label="Всего записей" value={summary.total_entries ?? 0} tone="navy" />
                    <StatTile icon={TrendingUp} label="Утверждено" value={summary.approved_entries ?? 0} tone="success" />
                    <StatTile icon={CircleX} label="Отклоненные" value={summary.rejected_entries ?? 0} tone="danger" />
                    <StatTile icon={Clock} label="На проверке" value={summary.pending_entries ?? 0} tone="warning" />
                    <StatTile icon={Award} label="Баллов" value={formatScore(summary.total_points)} tone="gold" />
                </StatGrid>

                {/* ── Result score card ──────────────────────────────── */}
                {result ? (
                    <ResultScoreCard result={result} />
                ) : (
                    <Notice tone="brand" title="Итоговый рейтинг ещё не сформирован">
                        Период не закрыт или расчёт не завершён.
                    </Notice>
                )}

                <UnderlineTabs
                    items={[
                        { key: 'entries', label: 'Показатели', icon: FileText, count: items.length },
                        { key: 'reference', label: 'Справочник индикаторов', icon: BookOpen, count: indicatorReferenceItems.length, disabled: indicatorReferenceItems.length === 0 },
                    ]}
                    value={activeMainTab}
                    onChange={(key) => {
                        if (key === 'reference' && indicatorReferenceItems.length === 0) {
                            return;
                        }
                        setActiveMainTab(key);
                    }}
                />

                {activeMainTab === 'reference' && indicatorReferenceItems.length > 0 && (
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen />
                                Справочник KPI-индикаторов
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>Дополнительный раздел · Индикаторы для роли: <span className="font-semibold text-[#102945]">{userLevelLabel}</span></span>
                                <Badge variant="outline">{indicatorReferenceItems.length} индикаторов</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-left">
                                            <th>Секция</th>
                                            <th>Структурное подразделение (проверяющее)</th>
                                            <th>Код</th>
                                            <th>Название</th>
                                            <th className="text-right">Баллы</th>
                                            <th>Правила баллов</th>
                                            <th>Описание</th>
                                            <th>Статус</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {indicatorReferenceItems.map((indicator) => (
                                            <tr key={indicator.id} className="border-b border-slate-200 align-top last:border-0">
                                                <td className="text-slate-700">{indicator.module_label ?? SECTION_LABELS[indicator.section] ?? indicator.section}</td>
                                                <td className="text-slate-700">
                                                    {Array.isArray(indicator.structural_units) && indicator.structural_units.length > 0
                                                        ? indicator.structural_units
                                                            .map((unit) => unit?.name)
                                                            .filter(Boolean)
                                                            .join(', ')
                                                        : (indicator.checker_structural_unit?.name ?? 'Не указано')}
                                                </td>
                                                <td className="font-mono text-xs text-slate-600">{indicator.code}</td>
                                                <td>
                                                    <div className="font-medium text-slate-900">{indicator.name}</div>
                                                    <div className="text-xs text-slate-500">{indicator.unit || 'без единиц'}</div>
                                                </td>
                                                <td className="text-right font-semibold tabular-nums text-[#102945]">{indicator.base_points}</td>
                                                <td className="max-w-[260px] whitespace-pre-line text-slate-600">{indicator.scoring_rules || '—'}</td>
                                                <td className="text-slate-700">{indicator.description || '—'}</td>
                                                <td>
                                                    {indicator.is_active ? <Badge variant="success">Активен</Badge> : <Badge variant="outline">Неактивен</Badge>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ── Entries by section ─────────────────────────────── */}
                {activeMainTab === 'entries' && (
                    <>
                        <FilterBar>
                            <form className="space-y-4" onSubmit={applyFilters}>
                                <div className="flex items-center gap-2 text-sm font-semibold text-[#102945]">
                                    <Filter className="h-4 w-4 text-teal-700" />
                                    Фильтры записей
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <label className="block space-y-2">
                                        <span className={FIELD_LABEL}>Этап</span>
                                        <select
                                            className={SELECT_CLS}
                                            value={filterForm.data.stage}
                                            onChange={(e) => filterForm.setData('stage', e.target.value)}
                                        >
                                            <option value="plan">План</option>
                                            <option value="fact">Факт</option>
                                            <option value="review">Рассмотрение</option>
                                        </select>
                                    </label>
                                    <label className="block space-y-2">
                                        <span className={FIELD_LABEL}>Модуль</span>
                                        <select
                                            className={SELECT_CLS}
                                            value={filterForm.data.module}
                                            onChange={(e) => filterForm.setData('module', e.target.value)}
                                        >
                                            <option value="">Все</option>
                                            {modules.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                    </label>
                                    <label className="block space-y-2">
                                        <span className={FIELD_LABEL}>Статус</span>
                                        <select
                                            className={SELECT_CLS}
                                            value={filterForm.data.status}
                                            onChange={(e) => filterForm.setData('status', e.target.value)}
                                        >
                                            <option value="">Все</option>
                                            {statusOptions.map((st) => <option key={st} value={st}>{statusLabels[st] ?? st}</option>)}
                                        </select>
                                    </label>
                                    <label className="block space-y-2">
                                        <span className={FIELD_LABEL}>Быстрый поиск</span>
                                        <span className="relative block">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                            <Input
                                                className="pl-9"
                                                value={entrySearch}
                                                onChange={(event) => setEntrySearch(event.target.value)}
                                                placeholder="Показатель, код, статус, баллы, комментарий, действия"
                                            />
                                        </span>
                                    </label>
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                                    <Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button>
                                    <Button type="submit">Применить</Button>
                                </div>
                            </form>
                        </FilterBar>

                        {filteredItems.length === 0 ? (
                            <EmptyState
                                title="Записи не найдены"
                                description="Измените фильтры или очистите быстрый поиск. Новую KPI-запись можно создать кнопкой «Создать запись» в шапке страницы."
                                action={entrySearch !== '' ? (
                                    <Button type="button" variant="outline" size="sm" onClick={() => setEntrySearch('')}>Очистить поиск</Button>
                                ) : null}
                            />
                        ) : (
                            <Card>
                                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText />
                                        Мои записи KPI по разделам
                                    </CardTitle>
                                    <span className="text-xs text-slate-500">
                                        Нажмите на строку для истории утверждения
                                    </span>
                                </CardHeader>
                                <CardContent>
                                    <EntriesBySection items={filteredItems} isEditableEntry={isEditableEntry} isFileMissing={isFileMissing} uploadFile={uploadFile} uploadingEntryId={uploadingEntryId} submitEntry={submitEntry} deleteEntry={deleteEntry} openEditEntry={openEditEntry} />

                                    {links.length > 3 && (
                                        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
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
                    </>
                )}
            </div>
            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
                description={confirmState.description}
                onConfirm={() => {
                    confirmState.onConfirm?.();
                    setConfirmState({ open: false, description: '', onConfirm: null });
                }}
            />
        </AuthenticatedLayout>
    );
}
