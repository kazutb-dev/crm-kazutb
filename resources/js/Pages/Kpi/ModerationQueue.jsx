import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Eye, Filter, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatStructuralUnitLabel } from '@/utils/kpi-structure-label';

const statusLabels = {
    draft: 'Черновик',
    submitted: 'Отправлено',
    returned: 'Возвращено',
    reviewed: 'Проверено',
    pending_dean: 'Корректировка данных - Деканат',
    pending_structural: 'Финальное утверждение',
    approved: 'Утверждено',
    rejected: 'Отклонено',
    locked: 'Заблокировано',
};

const statusVariants = {
    draft: 'outline',
    submitted: 'secondary',
    returned: 'outline',
    reviewed: 'secondary',
    pending_dean: 'secondary',
    pending_structural: 'secondary',
    approved: 'default',
    rejected: 'destructive',
    locked: 'destructive',
};

const stageLabels = {
    plan: 'План',
    fact: 'Факт',
    review: 'Рассмотрение',
};

const sectionLabels = {
    teaching: 'УМР',
    science: 'НИР',
    social: 'СВР',
    qualification: 'УПК',
    survey: 'К5',
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

const entityLabels = {
    teacher: 'Преподаватель',
    department_head: 'Заведующий кафедрой',
    dean: 'Декан',
    admin: 'Администратор',
    superadmin: 'Суперадминистратор',
    hod: 'Заведующий кафедрой',
};

function formatDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
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

function resolvePoints(entry) {
    const raw = entry.points_for_display ?? entry.manual_points ?? entry.calculated_points ?? 0;
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

function resolveStructuralUnits(entry) {
    const units = Array.isArray(entry?.indicator?.structural_units)
        ? entry.indicator.structural_units
            .map((unit) => formatStructuralUnitLabel(unit))
            .filter((name) => Boolean(name) && name !== '—')
        : [];

    if (units.length > 0) {
        return units;
    }

    const fallback = formatStructuralUnitLabel(entry?.indicator?.checker_structural_unit);

    return fallback && fallback !== '—' ? [fallback] : [];
}

function formatStructuralUnitName(unit) {
    const code = String(unit?.code ?? '').trim();
    const name = String(unit?.name ?? '').trim();

    if (code && name) {
        return `${code} — ${name}`;
    }

    return name || code || 'Структурное подразделение';
}

function formatStructuralUnitShortName(unit) {
    const code = String(unit?.code ?? unit?.structural_unit_code ?? '').trim();

    if (code) {
        return code;
    }

    const name = String(unit?.name ?? unit?.structural_unit_name ?? '').trim();

    if (name.includes('—')) {
        return name.split('—')[0].trim() || 'СП';
    }

    const bracketMatch = name.match(/\(([^)]+)\)/);
    if (bracketMatch?.[1]) {
        return bracketMatch[1].trim();
    }

    return name || 'СП';
}

function resolveEntryStructuralConfirmations(entry) {
    const expectedUnits = Array.isArray(entry?.indicator?.structural_units) && entry.indicator.structural_units.length > 0
        ? entry.indicator.structural_units
        : (entry?.indicator?.checker_structural_unit ? [entry.indicator.checker_structural_unit] : []);

    const rawConfirmations = Array.isArray(entry?.structural_confirmations)
        ? entry.structural_confirmations
        : (Array.isArray(entry?.structuralConfirmations) ? entry.structuralConfirmations : []);

    const byUnitId = new Map(
        rawConfirmations
            .filter((item) => item?.structural_unit_id != null)
            .map((item) => [Number(item.structural_unit_id), item]),
    );

    const resolved = expectedUnits.map((unit) => {
        const unitId = Number(unit?.id);
        const confirmation = byUnitId.get(unitId);

        return {
            structural_unit_id: unitId,
            name: formatStructuralUnitName(unit),
            shortName: formatStructuralUnitShortName(unit),
            status: confirmation?.status ?? 'pending',
            comment: confirmation?.comment ?? null,
            confirmed_by: confirmation?.confirmer?.display_name
                ?? confirmation?.confirmer?.name
                ?? confirmation?.confirmed_by
                ?? null,
        };
    });

    rawConfirmations.forEach((item) => {
        const unitId = Number(item?.structural_unit_id);
        if (!Number.isFinite(unitId) || resolved.some((row) => Number(row.structural_unit_id) === unitId)) {
            return;
        }

        resolved.push({
            structural_unit_id: unitId,
            name: formatStructuralUnitName(item?.structural_unit ?? {}),
            shortName: formatStructuralUnitShortName(item),
            status: item?.status ?? 'pending',
            comment: item?.comment ?? null,
            confirmed_by: item?.confirmer?.display_name ?? item?.confirmer?.name ?? item?.confirmed_by ?? null,
        });
    });

    return resolved;
}

function resolveResponsibleReviewer(entry, mode) {
    if (entry.status === 'submitted') {
        return 'Заведующий кафедрой';
    }

    if (['pending_dean', 'reviewed'].includes(entry.status)) {
        return 'Декан';
    }

    if (entry.status === 'pending_structural') {
        const units = resolveStructuralUnits(entry);

        return units.length > 0
            ? `Структурное подразделение: ${units.join(', ')}`
            : 'Структурное подразделение';
    }

    if (['approved', 'rejected', 'locked'].includes(entry.status)) {
        return 'Финальное решение принято';
    }

    if (entry.status === 'returned') {
        return 'Автор записи (доработка)';
    }

    if (mode === 'review') {
        return 'Заведующий кафедрой';
    }

    if (mode === 'approval') {
        return 'Декан';
    }

    if (mode === 'structural') {
        return 'Структурное подразделение';
    }

    return '—';
}

function Pagination({ links = [] }) {
    if (links.length <= 3) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            {links.map((link, index) => (
                <Button
                    key={`${link.label}-${index}`}
                    asChild={Boolean(link.url)}
                    size="sm"
                    variant={link.active ? 'default' : 'outline'}
                    disabled={!link.url}
                >
                    {link.url ? (
                        <Link preserveScroll href={link.url}>
                            <span dangerouslySetInnerHTML={{ __html: link.label }} />
                        </Link>
                    ) : (
                        <span dangerouslySetInnerHTML={{ __html: link.label }} />
                    )}
                </Button>
            ))}
        </div>
    );
}

export default function ModerationQueue({
    pageTitle,
    title,
    description,
    queueRoute,
    entries,
    academicYears = [],
    periods = [],
    faculties = [],
    departments = [],
    users = [],
    statusOptions = [],
    filters = {},
    permissions = {},
    reviewScope = null,
    structuralScope = null,
    mode = 'review',
    activeTab = 'scope',
    unlinkedCount = 0,
    showTabs = false,
}) {
    const { auth } = usePage().props;
    const items = entries?.data ?? [];
    const links = entries?.links ?? [];
    const total = entries?.total ?? items.length;
    const roleSlug = auth?.roleSlug;
    const canModerate = permissions?.canModerate ?? false;
    const isAdminViewer = roleSlug === 'admin' || roleSlug === 'superadmin';
    const isStructuralMode = mode === 'structural';
    const showBindingColumn = isAdminViewer || isStructuralMode;
    const hasUnrestrictedStructuralAccess = structuralScope?.type === 'unrestricted';
    const [quickSearch, setQuickSearch] = useState('');

    const filterForm = useForm({
        academic_year_id: filters.academic_year_id ? String(filters.academic_year_id) : '',
        period_id: filters.period_id ? String(filters.period_id) : '',
        sort: filters.sort ?? 'newest',
        department_id: filters.department_id ? String(filters.department_id) : '',
        faculty_id: filters.faculty_id ? String(filters.faculty_id) : '',
        user_id: filters.user_id ? String(filters.user_id) : '',
    });

    const switchTab = (tab) => {
        router.get(route(queueRoute), { tab }, {
            preserveState: false,
            replace: true,
        });
    };

    const applyFilters = (event) => {
        event.preventDefault();

        router.get(route(queueRoute), {
            tab: activeTab,
            academic_year_id: filterForm.data.academic_year_id || undefined,
            period_id: filterForm.data.period_id || undefined,
            sort: filterForm.data.sort || 'newest',
            department_id: filterForm.data.department_id || undefined,
            faculty_id: filterForm.data.faculty_id || undefined,
            user_id: filterForm.data.user_id || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        filterForm.setData({
            academic_year_id: '',
            period_id: '',
            sort: 'newest',
            department_id: '',
            faculty_id: '',
            user_id: '',
        });

        router.get(route(queueRoute), {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitAction = (routeName, entryId, promptLabel = null, extraData = {}) => {
        let comment = '';

        if (promptLabel) {
            const response = window.prompt(promptLabel, '');

            if (response === null) {
                return;
            }

            comment = response;
        }

        router.post(route(routeName, entryId), {
            comment,
            ...extraData,
        }, {
            preserveScroll: true,
        });
    };

    const myStructuralUnitIds = new Set(
        Array.isArray(structuralScope?.actor_division_ids)
            ? structuralScope.actor_division_ids
                .map((divisionId) => Number(divisionId))
                .filter((id) => Number.isFinite(id))
            : (Array.isArray(structuralScope?.divisions)
                ? structuralScope.divisions
                    .map((division) => Number(division.id))
                    .filter((id) => Number.isFinite(id))
                : []),
    );

    const canActForStructuralUnit = (unitId) => {
        if (isAdminViewer) {
            return true;
        }

        if (hasUnrestrictedStructuralAccess && myStructuralUnitIds.size === 0) {
            return false;
        }

        return myStructuralUnitIds.has(Number(unitId));
    };

    // Show approve action based on current mode and entry status
    const showApproveAction = (entry) => canModerate && (
        (mode === 'review' && entry.status === 'submitted')
        || (mode === 'approval' && ['pending_dean', 'reviewed'].includes(entry.status))
        || (mode === 'structural' && entry.status === 'pending_structural')
        || (isAdminViewer && ['submitted', 'reviewed', 'pending_dean', 'pending_structural'].includes(entry.status))
    );

    // Show reject action based on current mode and entry status
    const showRejectAction = (entry) => canModerate && (
        (mode === 'structural' && entry.status === 'pending_structural')
        || (isAdminViewer && ['submitted', 'reviewed', 'pending_dean', 'pending_structural'].includes(entry.status))
    );

    const filteredItems = useMemo(() => {
        const query = normalizeSearchText(quickSearch);

        if (query === '') {
            return items;
        }

        return items.filter((entry) => {
            const structuralUnits = resolveStructuralUnits(entry).join(' ');
            const confirmations = resolveEntryStructuralConfirmations(entry)
                .map((item) => `${item.name} ${item.status} ${item.comment ?? ''} ${item.confirmed_by ?? ''}`)
                .join(' ');

            const actions = [
                'откр',
                showApproveAction(entry) ? 'утвердить approve' : '',
                showRejectAction(entry) ? 'отклонить reject' : '',
            ].join(' ');

            const haystack = normalizeSearchText([
                entry.user?.name,
                entry.user?.email,
                entityLabels[entry.entity_type] ?? entry.entity_type,
                entry.indicator?.name,
                entry.indicator?.code,
                entry.period?.name,
                stageLabels[entry.period?.stage] ?? entry.period?.stage,
                formatDate(entry.period?.start_date),
                formatDate(entry.period?.end_date),
                entry.faculty?.name,
                entry.department?.name,
                sectionLabels[entry.indicator?.section] ?? entry.indicator?.section,
                structuralUnits,
                resolveResponsibleReviewer(entry, mode),
                confirmations,
                resolvePoints(entry),
                statusLabels[entry.status] ?? entry.status,
                actions,
            ].join(' '));

            return haystack.includes(query);
        });
    }, [
        quickSearch,
        items,
        mode,
        canModerate,
        isAdminViewer,
        hasUnrestrictedStructuralAccess,
        myStructuralUnitIds,
    ]);

    return (
        <AuthenticatedLayout>
            <Head title={pageTitle} />

            <div className="space-y-4 p-4 sm:p-5 lg:p-6">
                {showTabs && (
                    <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
                        <button
                            type="button"
                            onClick={() => switchTab('scope')}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === 'scope' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {reviewScope?.type === 'department' ? 'Моя кафедра' : 'Мой факультет'}
                        </button>
                        <button
                            type="button"
                            onClick={() => switchTab('unlinked')}
                            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === 'unlinked' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Без привязки
                            {unlinkedCount > 0 && (
                                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white leading-none">
                                    {unlinkedCount}
                                </span>
                            )}
                        </button>
                    </div>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Filter className="h-4 w-4" />
                            Фильтры очереди
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={applyFilters}>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Учебный год</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={filterForm.data.academic_year_id}
                                        onChange={(event) => filterForm.setData('academic_year_id', event.target.value)}
                                    >
                                        <option value="">Все учебные годы</option>
                                        {academicYears.map((year) => (
                                            <option key={year.id} value={year.id}>{year.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Период</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={filterForm.data.period_id}
                                        onChange={(event) => filterForm.setData('period_id', event.target.value)}
                                    >
                                        <option value="">Все периоды</option>
                                        {periods.map((period) => (
                                            <option key={period.id} value={period.id}>
                                                {period.name} ({stageLabels[period.stage] ?? period.stage})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Факультет</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={filterForm.data.faculty_id}
                                        onChange={(event) => filterForm.setData('faculty_id', event.target.value)}
                                    >
                                        <option value="">Все факультеты</option>
                                        {faculties.map((faculty) => (
                                            <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Кафедра</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={filterForm.data.department_id}
                                        onChange={(event) => filterForm.setData('department_id', event.target.value)}
                                    >
                                        <option value="">Все кафедры</option>
                                        {departments.map((department) => (
                                            <option key={department.id} value={department.id}>{department.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Сотрудник</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={filterForm.data.user_id}
                                        onChange={(event) => filterForm.setData('user_id', event.target.value)}
                                    >
                                        <option value="">Все сотрудники</option>
                                        {users.map((user) => (
                                            <option key={user.id} value={user.id}>{user.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="rounded-xl border bg-muted/20 p-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-sm font-semibold">Фильтр по добавлениям</span>
                                    <span className="text-sm font-medium">Порядок</span>
                                    <select
                                        className="h-9 w-full sm:w-72 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={filterForm.data.sort}
                                        onChange={(event) => filterForm.setData('sort', event.target.value)}
                                    >
                                        <option value="newest">От нового до старого</option>
                                        <option value="oldest">От старого до нового</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="submit">Применить</Button>
                                <Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Список KPI-записей</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4">
                            <Input
                                value={quickSearch}
                                onChange={(event) => setQuickSearch(event.target.value)}
                                placeholder="Быстрый поиск: сотрудник, показатель, период, структура, привязка, баллы, статус, действия"
                            />
                        </div>

                        {filteredItems.length === 0 ? (
                            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                                <ShieldAlert className="h-8 w-8 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Записи не найдены</p>
                                    <p className="text-sm text-muted-foreground">Измените фильтры, очистите быстрый поиск или дождитесь новых KPI-записей в очереди.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="w-full overflow-hidden">
                                    <table className="w-full table-fixed text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-muted-foreground">
                                                <th className="w-[13%] py-3 pe-3 font-medium">Сотрудник</th>
                                                <th className="w-[15%] py-3 pe-3 font-medium">Показатель</th>
                                                <th className="w-[10%] py-3 pe-3 font-medium">Период</th>
                                                <th className="w-[10%] py-3 pe-3 font-medium">Структура</th>
                                                {showBindingColumn && <th className="w-[22%] py-3 pe-3 font-medium">Привязка / подтверждение</th>}
                                                <th className="w-[6%] py-3 pe-3 font-medium">Баллы</th>
                                                <th className="w-[8%] py-3 pe-3 font-medium">Статус</th>
                                                <th className="w-[8%] py-3 pe-3 font-medium">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.map((entry) => (
                                                <tr key={entry.id} className="border-b align-top last:border-0">
                                                    <td className="py-4 pe-3 break-words">
                                                        <div className="font-medium leading-6">{entry.user?.name ?? '—'}</div>
                                                        <div className="mt-1 break-all text-xs text-muted-foreground">{entry.user?.email ?? 'Без email'}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">{entityLabels[entry.entity_type] ?? entry.entity_type}</div>
                                                    </td>
                                                    <td className="py-4 pe-3 break-words">
                                                        <div className="font-medium leading-6">{entry.indicator?.name ?? '—'}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">{entry.indicator?.code ?? '—'}</div>
                                                    </td>
                                                    <td className="py-4 pe-3 break-words">
                                                        <div className="font-medium">{entry.period?.name ?? '—'}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            {stageLabels[entry.period?.stage] ?? entry.period?.stage ?? '—'} • {formatDate(entry.period?.start_date)} - {formatDate(entry.period?.end_date)}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 pe-3 break-words">
                                                        <div>{entry.faculty?.name ?? '—'}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">{entry.department?.name ?? '—'}</div>
                                                    </td>
                                                    {showBindingColumn && (
                                                        <td className="py-4 pe-3 break-words">
                                                            {(() => {
                                                                const unitNames = resolveStructuralUnits(entry);
                                                                const confirmations = resolveEntryStructuralConfirmations(entry);

                                                                return (
                                                                    <>
                                                                        <div className="text-xs text-muted-foreground">Раздел KPI</div>
                                                                        <div className="font-medium">{sectionLabels[entry.indicator?.section] ?? entry.indicator?.section ?? '—'}</div>
                                                                        <div className="mt-1 text-xs text-muted-foreground">Привязан к подразделению</div>
                                                                        <div className="break-words">{unitNames.length > 0 ? unitNames.join(', ') : 'Не назначено'}</div>
                                                                        <div className="mt-1 text-xs text-muted-foreground">Кто подтверждает</div>
                                                                        <div className="font-medium break-words">{resolveResponsibleReviewer(entry, mode)}</div>
                                                                        {mode === 'structural' && confirmations.length > 0 && (
                                                                            <div className="mt-2 space-y-1.5">
                                                                                {confirmations.map((item) => (
                                                                                    <div key={`${entry.id}-${item.structural_unit_id}`} className="rounded-md border bg-muted/20 p-1.5">
                                                                                        <div className="flex items-center justify-between gap-2">
                                                                                            <span className="truncate text-xs text-foreground/80" title={item.name}>{item.name}</span>
                                                                                            <Badge variant={spStatusVariants[item.status] ?? 'outline'} className="text-[0.65rem]">
                                                                                                {spStatusLabels[item.status] ?? item.status}
                                                                                            </Badge>
                                                                                        </div>
                                                                                        {(item.comment || item.confirmed_by) && (
                                                                                            <p className="mt-1 text-[0.7rem] text-muted-foreground">
                                                                                                {item.comment ? `Комментарий: ${item.comment}` : 'Без комментария'}
                                                                                                {item.confirmed_by ? ` · ${item.confirmed_by}` : ''}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </td>
                                                    )}
                                                    <td className="py-4 pe-3 font-medium whitespace-nowrap">{resolvePoints(entry)}</td>
                                                    <td className="py-4 pe-3">
                                                        <Badge variant={statusVariants[entry.status] ?? 'outline'}>
                                                            {statusLabels[entry.status] ?? entry.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-4 pe-3 align-top">
                                                        <div className="grid w-full min-w-0 max-w-full gap-1.5 overflow-hidden">
                                                            <Button asChild size="sm" variant="outline" className="h-auto min-h-8 w-full min-w-0 max-w-full justify-start overflow-hidden whitespace-normal break-words px-1.5 py-1 text-[10px] leading-tight">
                                                                <Link href={route('kpi.entries.show', entry.id)}>
                                                                    <Eye className="h-3.5 w-3.5 shrink-0" />
                                                                    <span className="min-w-0 text-left">Откр.</span>
                                                                </Link>
                                                            </Button>

                                                            {/* Approve action */}
                                                            {showApproveAction(entry) && (
                                                                (() => {
                                                                    // For structural mode with multiple SPs, show per-SP buttons
                                                                    if (mode === 'structural') {
                                                                        const confirmations = resolveEntryStructuralConfirmations(entry);

                                                                        if (confirmations.length === 0) {
                                                                            return (
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="h-auto min-h-8 w-full min-w-0 max-w-full justify-start overflow-hidden whitespace-normal break-words px-1.5 py-1 text-[10px] leading-tight"
                                                                                    onClick={() => submitAction('kpi.entries.approve', entry.id)}
                                                                                >
                                                                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                                                                    <span className="min-w-0 text-left">Утвердить</span>
                                                                                </Button>
                                                                            );
                                                                        }

                                                                        return confirmations.map((item) => {
                                                                            const canAct = canActForStructuralUnit(item.structural_unit_id);
                                                                            const isPending = item.status === 'pending';

                                                                            return (
                                                                                <Button
                                                                                    key={`approve-${entry.id}-${item.structural_unit_id}`}
                                                                                    size="sm"
                                                                                    className="h-auto min-h-8 w-full min-w-0 max-w-full justify-start overflow-hidden whitespace-normal break-words px-1.5 py-1 text-[10px] leading-tight"
                                                                                    variant={isPending ? 'default' : (item.status === 'approved' ? 'secondary' : 'destructive')}
                                                                                    disabled={!isPending || !canAct}
                                                                                    onClick={() => submitAction(
                                                                                        'kpi.entries.structural-confirm',
                                                                                        entry.id,
                                                                                        null,
                                                                                        { structural_unit_id: item.structural_unit_id },
                                                                                    )}
                                                                                    title={canAct
                                                                                        ? `Подтвердить как ${item.name}`
                                                                                        : `Статус другого СП: ${item.name}`}
                                                                                >
                                                                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                                                                    <span className="min-w-0 text-left">{item.shortName}</span>
                                                                                </Button>
                                                                            );
                                                                        });
                                                                    }

                                                                    // For non-structural modes, simple approve button
                                                                    return (
                                                                        <Button
                                                                            size="sm"
                                                                            className="h-auto min-h-8 w-full min-w-0 max-w-full justify-start overflow-hidden whitespace-normal break-words px-1.5 py-1 text-[10px] leading-tight"
                                                                            onClick={() => submitAction('kpi.entries.approve', entry.id)}
                                                                        >
                                                                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                                                            <span className="min-w-0 text-left">Утвердить</span>
                                                                        </Button>
                                                                    );
                                                                })()
                                                            )}

                                                            {/* Reject action */}
                                                            {showRejectAction(entry) && (
                                                                (() => {
                                                                    if (mode === 'structural') {
                                                                        const confirmations = resolveEntryStructuralConfirmations(entry);
                                                                        const rejectTarget = confirmations.find((item) => item.status === 'pending' && canActForStructuralUnit(item.structural_unit_id));

                                                                        return (
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-auto min-h-8 w-full min-w-0 max-w-full justify-start overflow-hidden whitespace-normal break-words px-1.5 py-1 text-[10px] leading-tight"
                                                                                variant="destructive"
                                                                                disabled={!isAdminViewer && !rejectTarget}
                                                                                onClick={() => submitAction(
                                                                                    isAdminViewer ? 'kpi.entries.reject' : 'kpi.entries.structural-reject',
                                                                                    entry.id,
                                                                                    'Причина отклонения',
                                                                                    isAdminViewer
                                                                                        ? {}
                                                                                        : { structural_unit_id: rejectTarget?.structural_unit_id },
                                                                                )}
                                                                            >
                                                                                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                                                                <span className="min-w-0 text-left">Отклонить</span>
                                                                            </Button>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <Button
                                                                            size="sm"
                                                                            className="h-auto min-h-8 w-full min-w-0 max-w-full justify-start overflow-hidden whitespace-normal break-words px-1.5 py-1 text-[10px] leading-tight"
                                                                            variant="destructive"
                                                                            onClick={() => submitAction('kpi.entries.reject', entry.id, 'Причина отклонения')}
                                                                        >
                                                                            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                                                            <span className="min-w-0 text-left">Отклонить</span>
                                                                        </Button>
                                                                    );
                                                                })()
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <Pagination links={links} />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}