import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, PageHeader, StatGrid, StatTile, StatusBadge, UnderlineTabs, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { CalendarOff, ClipboardList, Eye, Filter, Hourglass, Inbox, Link2Off, ListChecks, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
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
    submitted: 'info',
    returned: 'warning',
    reviewed: 'secondary',
    pending_dean: 'info',
    pending_structural: 'default',
    approved: 'success',
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
    pending: 'warning',
    approved: 'success',
    rejected: 'destructive',
};

const ACTION_BTN = 'shrink-0 whitespace-nowrap';

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
        <div className="flex flex-wrap items-center justify-end gap-2">
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
    eyebrow = 'KPI · Очередь проверки',
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
    const isAdminViewer = roleSlug === 'admin'
        || roleSlug === 'superadmin'
        || Boolean(permissions?.canAdminModerate);
    const isStructuralMode = mode === 'structural';

    const isEntryScopeActive = (entry) => {
        if (!entry?.period || entry.period?.status !== 'active') {
            return false;
        }

        if (mode === 'review') {
            return Boolean(entry.period?.is_hod_active);
        }

        if (mode === 'approval') {
            return Boolean(entry.period?.is_dean_active);
        }

        if (mode === 'structural') {
            return Boolean(entry.period?.is_structural_active);
        }

        return true;
    };
    const hasGlobalStructuralModerationAccess = isStructuralMode && isAdminViewer;
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
        (mode === 'review' && entry.status === 'submitted')
        || (mode === 'approval' && ['pending_dean', 'reviewed'].includes(entry.status))
        || (mode === 'structural' && entry.status === 'pending_structural')
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

    const decisionCount = items.filter((entry) => showApproveAction(entry) || showRejectAction(entry)).length;
    const inactiveCount = items.filter((entry) => !isEntryScopeActive(entry)).length;
    const searchActive = normalizeSearchText(quickSearch) !== '';

    const tabItems = [
        { key: 'scope', label: reviewScope?.type === 'department' ? 'Моя кафедра' : 'Мой факультет' },
        { key: 'unlinked', label: 'Без привязки', count: unlinkedCount > 0 ? unlinkedCount : null },
    ];

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow={eyebrow}
                    title={title ?? pageTitle}
                    description={description}
                    meta={(
                        <div className="flex flex-wrap gap-2">
                            <StatusBadge tone="info">В очереди: {total}</StatusBadge>
                            {showTabs && unlinkedCount > 0 && <StatusBadge tone="warning">Без привязки: {unlinkedCount}</StatusBadge>}
                        </div>
                    )}
                />
            )}
        >
            <Head title={pageTitle} />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего в очереди" value={total} tone="navy" icon={ClipboardList} hint="С учётом выбранных фильтров" />
                    <StatTile label="На странице" value={items.length} tone="teal" icon={ListChecks} hint={searchActive ? `Найдено быстрым поиском: ${filteredItems.length}` : 'Записей в текущей выдаче'} />
                    <StatTile label="Ждут решения" value={decisionCount} tone="gold" icon={Hourglass} hint="Доступно утверждение или отклонение" />
                    {showTabs ? (
                        <StatTile label="Без привязки" value={unlinkedCount} tone="warning" icon={Link2Off} hint="Записи вне вашей кафедры / факультета" />
                    ) : (
                        <StatTile label="Сезон закрыт" value={inactiveCount} tone="neutral" icon={CalendarOff} hint="Действия по этим записям недоступны" />
                    )}
                </StatGrid>

                {showTabs && (
                    <UnderlineTabs items={tabItems} value={activeTab} onChange={switchTab} />
                )}

                <FilterBar>
                    <form className="space-y-4" onSubmit={applyFilters}>
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#102945]">
                            <Filter className="h-4 w-4 text-teal-700" />
                            Фильтры очереди
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <label className="block space-y-2">
                                <span className="qd-field-label block">Учебный год</span>
                                <select
                                    className={qdFieldClass}
                                    value={filterForm.data.academic_year_id}
                                    onChange={(event) => filterForm.setData('academic_year_id', event.target.value)}
                                >
                                    <option value="">Все учебные годы</option>
                                    {academicYears.map((year) => (
                                        <option key={year.id} value={year.id}>{year.name}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="block space-y-2">
                                <span className="qd-field-label block">Период</span>
                                <select
                                    className={qdFieldClass}
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
                            </label>

                            <label className="block space-y-2">
                                <span className="qd-field-label block">Факультет</span>
                                <select
                                    className={qdFieldClass}
                                    value={filterForm.data.faculty_id}
                                    onChange={(event) => filterForm.setData('faculty_id', event.target.value)}
                                >
                                    <option value="">Все факультеты</option>
                                    {faculties.map((faculty) => (
                                        <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="block space-y-2">
                                <span className="qd-field-label block">Кафедра</span>
                                <select
                                    className={qdFieldClass}
                                    value={filterForm.data.department_id}
                                    onChange={(event) => filterForm.setData('department_id', event.target.value)}
                                >
                                    <option value="">Все кафедры</option>
                                    {departments.map((department) => (
                                        <option key={department.id} value={department.id}>{department.name}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="block space-y-2">
                                <span className="qd-field-label block">Сотрудник</span>
                                <select
                                    className={qdFieldClass}
                                    value={filterForm.data.user_id}
                                    onChange={(event) => filterForm.setData('user_id', event.target.value)}
                                >
                                    <option value="">Все сотрудники</option>
                                    {users.map((user) => (
                                        <option key={user.id} value={user.id}>{user.name}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="block space-y-2">
                                <span className="qd-field-label block">Порядок добавления</span>
                                <select
                                    className={qdFieldClass}
                                    value={filterForm.data.sort}
                                    onChange={(event) => filterForm.setData('sort', event.target.value)}
                                >
                                    <option value="newest">От нового до старого</option>
                                    <option value="oldest">От старого до нового</option>
                                </select>
                            </label>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                            <Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button>
                            <Button type="submit">Применить</Button>
                        </div>
                    </form>
                </FilterBar>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList />
                            Список KPI-записей
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
                            <div className="relative w-full">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    className="pl-9"
                                    value={quickSearch}
                                    onChange={(event) => setQuickSearch(event.target.value)}
                                    placeholder="Быстрый поиск: сотрудник, показатель, период, структура, привязка, баллы, статус, действия"
                                />
                            </div>
                        </div>

                        {filteredItems.length === 0 ? (
                            <div className="flex flex-col items-center gap-4 px-5 py-12 text-center sm:px-6">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                    <Inbox className="h-6 w-6" />
                                </div>
                                <div className="max-w-md space-y-1.5">
                                    <p className="font-display text-lg font-bold text-[#102945]">Записи не найдены</p>
                                    <p className="text-sm leading-relaxed text-slate-600">Измените фильтры, очистите быстрый поиск или дождитесь новых KPI-записей в очереди.</p>
                                </div>
                                {searchActive && (
                                    <Button type="button" variant="outline" size="sm" onClick={() => setQuickSearch('')}>Очистить поиск</Button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1100px] text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-left">
                                                <th className="min-w-[170px]">Сотрудник</th>
                                                <th className="min-w-[180px]">Показатель</th>
                                                <th className="min-w-[140px]">Период</th>
                                                <th className="min-w-[150px]">Структура</th>
                                                {showBindingColumn && <th className="min-w-[220px]">Привязка / подтверждение</th>}
                                                <th className="text-right">Баллы</th>
                                                <th>Статус</th>
                                                <th className="text-right">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.map((entry) => (
                                                <tr key={entry.id} className="border-b border-slate-200 align-top last:border-0 hover:bg-slate-50/60">
                                                    <td className="break-words">
                                                        <div className="font-medium leading-6 text-slate-900">{entry.user?.name ?? '—'}</div>
                                                        <div className="mt-1 break-all text-xs text-slate-500">{entry.user?.email ?? 'Без email'}</div>
                                                        <div className="mt-1 text-xs text-slate-500">{entityLabels[entry.entity_type] ?? entry.entity_type}</div>
                                                    </td>
                                                    <td className="break-words">
                                                        <div className="font-medium leading-6">{entry.indicator?.name ?? '—'}</div>
                                                        <div className="mt-1 text-xs text-slate-500">{entry.indicator?.code ?? '—'}</div>
                                                    </td>
                                                    <td className="break-words">
                                                        <div className="font-medium">{entry.period?.name ?? '—'}</div>
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            {stageLabels[entry.period?.stage] ?? entry.period?.stage ?? '—'} • {formatDate(entry.period?.start_date)} - {formatDate(entry.period?.end_date)}
                                                        </div>
                                                    </td>
                                                    <td className="break-words">
                                                        <div>{entry.faculty?.name ?? '—'}</div>
                                                        <div className="mt-1 text-xs text-slate-500">{entry.department?.name ?? '—'}</div>
                                                    </td>
                                                    {showBindingColumn && (
                                                        <td className="break-words">
                                                            {(() => {
                                                                const unitNames = resolveStructuralUnits(entry);
                                                                const confirmations = resolveEntryStructuralConfirmations(entry);

                                                                return (
                                                                    <>
                                                                        <div className="qd-field-label text-slate-500">Раздел KPI</div>
                                                                        <div className="font-medium">{sectionLabels[entry.indicator?.section] ?? entry.indicator?.section ?? '—'}</div>
                                                                        <div className="qd-field-label mt-2 text-slate-500">Привязан к подразделению</div>
                                                                        <div className="break-words">{unitNames.length > 0 ? unitNames.join(', ') : 'Не назначено'}</div>
                                                                        <div className="qd-field-label mt-2 text-slate-500">Кто подтверждает</div>
                                                                        <div className="font-medium break-words">{resolveResponsibleReviewer(entry, mode)}</div>
                                                                        {mode === 'structural' && confirmations.length > 0 && (
                                                                            <div className="mt-2 space-y-1.5">
                                                                                {confirmations.map((item) => (
                                                                                    <div key={`${entry.id}-${item.structural_unit_id}`} className="rounded-[10px] border border-slate-200 bg-white p-2">
                                                                                        <div className="flex items-center justify-between gap-2">
                                                                                            <span className="truncate text-xs text-slate-700" title={item.name}>{item.name}</span>
                                                                                            <Badge variant={spStatusVariants[item.status] ?? 'outline'} className="text-[0.65rem]">
                                                                                                {spStatusLabels[item.status] ?? item.status}
                                                                                            </Badge>
                                                                                        </div>
                                                                                        {(item.comment || item.confirmed_by) && (
                                                                                            <p className="mt-1 text-[0.7rem] text-slate-500">
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
                                                    <td className="text-right font-display text-base font-bold tabular-nums whitespace-nowrap text-[#102945]">{resolvePoints(entry)}</td>
                                                    <td>
                                                        <Badge variant={statusVariants[entry.status] ?? 'outline'}>
                                                            {statusLabels[entry.status] ?? entry.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="whitespace-nowrap text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button asChild size="sm" variant="outline" className={ACTION_BTN}>
                                                                <Link href={route('kpi.entries.show', entry.id)}>
                                                                    <Eye className="h-3.5 w-3.5 shrink-0" />
                                                                    <span>Открыть</span>
                                                                </Link>
                                                            </Button>

                                                            {/* Approve action */}
                                                            {showApproveAction(entry) && (
                                                                (() => {
                                                                    // For structural mode with multiple SPs, show per-SP buttons
                                                                    if (mode === 'structural') {
                                                                        if (hasGlobalStructuralModerationAccess) {
                                                                            return (
                                                                                <Button
                                                                                    size="sm"
                                                                                    className={ACTION_BTN}
                                                                                    onClick={() => submitAction('kpi.entries.approve', entry.id)}
                                                                                    disabled={!isEntryScopeActive(entry) && !isAdminViewer}
                                                                                    title={!isEntryScopeActive(entry) && !isAdminViewer ? 'Сезон/область деактивирована — действие недоступно' : undefined}
                                                                                >
                                                                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                                                                    <span>Утвердить</span>
                                                                                </Button>
                                                                            );
                                                                        }

                                                                        const confirmations = resolveEntryStructuralConfirmations(entry);

                                                                        if (confirmations.length === 0) {
                                                                            return (
                                                                                <Button
                                                                                    size="sm"
                                                                                    className={ACTION_BTN}
                                                                                    onClick={() => submitAction('kpi.entries.approve', entry.id)}
                                                                                    disabled={!isEntryScopeActive(entry) && !isAdminViewer}
                                                                                    title={!isEntryScopeActive(entry) && !isAdminViewer ? 'Сезон/область деактивирована — действие недоступно' : undefined}
                                                                                >
                                                                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                                                                    <span>Утвердить</span>
                                                                                </Button>
                                                                            );
                                                                        }

                                                                        return confirmations.map((item) => {
                                                                            const canAct = canActForStructuralUnit(item.structural_unit_id);
                                                                            const isPending = item.status === 'pending';
                                                                            // Пока запись на финальном утверждении (pending_structural),
                                                                            // ответственный СП может заново утвердить её, даже если его
                                                                            // статус «застрял» (rejected/approved) после повторной отправки.
                                                                            const isActionable = entry.status === 'pending_structural' || isPending || isAdminViewer;

                                                                            return (
                                                                                <Button
                                                                                    key={`approve-${entry.id}-${item.structural_unit_id}`}
                                                                                    size="sm"
                                                                                    className={ACTION_BTN}
                                                                                    variant={isPending ? 'default' : (item.status === 'approved' ? 'secondary' : 'destructive')}
                                                                                    disabled={!isActionable || !canAct || (!isEntryScopeActive(entry) && !isAdminViewer)}
                                                                                    onClick={() => submitAction(
                                                                                        'kpi.entries.structural-confirm',
                                                                                        entry.id,
                                                                                        null,
                                                                                        { structural_unit_id: item.structural_unit_id },
                                                                                    )}
                                                                                    title={!isEntryScopeActive(entry) && !isAdminViewer ? 'Сезон/область деактивирована — действие недоступно' : (canAct
                                                                                        ? `Подтвердить как ${item.name}`
                                                                                        : `Статус другого СП: ${item.name}`)}
                                                                                >
                                                                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                                                                    <span>{item.shortName}</span>
                                                                                </Button>
                                                                            );
                                                                        });
                                                                    }

                                                                    // For non-structural modes, simple approve button
                                                                    return (
                                                                        <Button
                                                                            size="sm"
                                                                            className={ACTION_BTN}
                                                                            onClick={() => submitAction('kpi.entries.approve', entry.id)}
                                                                            disabled={!isEntryScopeActive(entry) && !isAdminViewer}
                                                                            title={!isEntryScopeActive(entry) && !isAdminViewer ? 'Сезон/область деактивирована — действие недоступно' : undefined}
                                                                        >
                                                                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                                                            <span>Утвердить</span>
                                                                        </Button>
                                                                    );
                                                                })()
                                                            )}

                                                            {/* Reject action */}
                                                            {showRejectAction(entry) && (
                                                                (() => {
                                                                    if (mode === 'structural') {
                                                                        if (hasGlobalStructuralModerationAccess) {
                                                                            return (
                                                                                <Button
                                                                                    size="sm"
                                                                                    className={ACTION_BTN}
                                                                                    variant="destructive"
                                                                                    onClick={() => submitAction(
                                                                                        'kpi.entries.reject',
                                                                                        entry.id,
                                                                                        isEntryScopeActive(entry) || isAdminViewer ? 'Причина отклонения' : null,
                                                                                    )}
                                                                                    disabled={!isEntryScopeActive(entry) && !isAdminViewer}
                                                                                    title={!isEntryScopeActive(entry) && !isAdminViewer ? 'Сезон/область деактивирована — действие недоступно' : undefined}
                                                                                >
                                                                                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                                                                    <span>Отклонить</span>
                                                                                </Button>
                                                                            );
                                                                        }

                                                                        const confirmations = resolveEntryStructuralConfirmations(entry);
                                                                        // Пока запись на финальном утверждении, ответственный СП может
                                                                        // отклонить свою строку независимо от прошлого статуса (pending/
                                                                        // approved/rejected). Иначе ограничиваемся только ожидающими.
                                                                        const rejectTarget = entry.status === 'pending_structural'
                                                                            ? confirmations.find((item) => canActForStructuralUnit(item.structural_unit_id))
                                                                            : confirmations.find((item) => item.status === 'pending' && canActForStructuralUnit(item.structural_unit_id));

                                                                        return (
                                                                            <Button
                                                                                size="sm"
                                                                                className={ACTION_BTN}
                                                                                variant="destructive"
                                                                                disabled={(!isAdminViewer && !rejectTarget) || (!isEntryScopeActive(entry) && !isAdminViewer)}
                                                                                onClick={() => submitAction(
                                                                                    isAdminViewer ? 'kpi.entries.reject' : 'kpi.entries.structural-reject',
                                                                                    entry.id,
                                                                                    isEntryScopeActive(entry) || isAdminViewer ? 'Причина отклонения' : null,
                                                                                    isAdminViewer
                                                                                        ? {}
                                                                                        : { structural_unit_id: rejectTarget?.structural_unit_id },
                                                                                )}
                                                                                title={!isEntryScopeActive(entry) && !isAdminViewer ? 'Сезон/область деактивирована — действие недоступно' : undefined}
                                                                            >
                                                                                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                                                                <span>Отклонить</span>
                                                                            </Button>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <Button
                                                                            size="sm"
                                                                            className={ACTION_BTN}
                                                                            variant="destructive"
                                                                            onClick={() => submitAction(
                                                                                mode === 'review' || mode === 'approval'
                                                                                    ? 'kpi.entries.return'
                                                                                    : 'kpi.entries.reject',
                                                                                entry.id,
                                                                                isEntryScopeActive(entry) || isAdminViewer ? 'Причина отклонения' : null,
                                                                            )}
                                                                            disabled={!isEntryScopeActive(entry) && !isAdminViewer}
                                                                            title={!isEntryScopeActive(entry) && !isAdminViewer ? 'Сезон/область деактивирована — действие недоступно' : undefined}
                                                                        >
                                                                            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                                                            <span>Отклонить</span>
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

                                {links.length > 3 && (
                                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-5 py-3 sm:px-6">
                                        <Pagination links={links} />
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
