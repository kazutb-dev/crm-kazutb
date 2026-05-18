import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Eye, Filter, ShieldAlert, ShieldCheck } from 'lucide-react';
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
    const { auth, flash, errors } = usePage().props;
    const items = entries?.data ?? [];
    const links = entries?.links ?? [];
    const total = entries?.total ?? items.length;
    const roleSlug = auth?.roleSlug;
    const canModerate = permissions?.canModerate ?? false;
    const isAdminViewer = roleSlug === 'admin' || roleSlug === 'superadmin';

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

    const submitAction = (routeName, entryId, promptLabel = null) => {
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
        }, {
            preserveScroll: true,
        });
    };

    // Dept head queue (review): submitted → pending_dean
    const showApproveForwardAction = (entry) => canModerate
        && mode === 'review'
        && entry.status === 'submitted';

    // Dean queue (approval): pending_dean/reviewed → pending_structural
    const showDeanForwardAction = (entry) => canModerate
        && mode === 'approval'
        && ['pending_dean', 'reviewed'].includes(entry.status);

    // Structural queue: final approve pending_structural → approved
    const showStructuralApproveAction = (entry) => canModerate
        && mode === 'structural'
        && entry.status === 'pending_structural';

    // Structural queue: final reject (teacher cannot edit after this)
    const showStructuralRejectAction = (entry) => canModerate
        && mode === 'structural'
        && entry.status === 'pending_structural';

    // Admin fallback: show approve in any mode for non-standard statuses
    const showAdminApproveAction = (entry) => canModerate
        && mode === 'approval'
        && roleSlug === 'admin'
        && !['pending_dean', 'reviewed'].includes(entry.status)
        && ['submitted', 'pending_structural'].includes(entry.status);

    const showAdminRejectAction = (entry) => canModerate
        && roleSlug === 'admin'
        && mode !== 'structural'
        && ['submitted', 'reviewed', 'pending_dean', 'pending_structural'].includes(entry.status);

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

                {(flash?.success || flash?.error || errors?.kpi_entry) && (
                    <Card className="border-l-4 border-l-amber-500">
                        <CardContent className="pt-6 text-sm">
                            {flash?.success && <p className="text-emerald-700">{flash.success}</p>}
                            {flash?.error && <p className="text-destructive">{flash.error}</p>}
                            {errors?.kpi_entry && <p className="text-destructive">{errors.kpi_entry}</p>}
                        </CardContent>
                    </Card>
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
                        {items.length === 0 ? (
                            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                                <ShieldAlert className="h-8 w-8 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Записи не найдены</p>
                                    <p className="text-sm text-muted-foreground">Измените фильтры или дождитесь новых KPI-записей в очереди.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1100px] text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-muted-foreground">
                                                <th className="py-3 pe-3 font-medium">Сотрудник</th>
                                                <th className="py-3 pe-3 font-medium">Показатель</th>
                                                <th className="py-3 pe-3 font-medium">Период</th>
                                                <th className="py-3 pe-3 font-medium">Структура</th>
                                                {isAdminViewer && <th className="py-3 pe-3 font-medium">Привязка / подтверждение</th>}
                                                <th className="py-3 pe-3 font-medium">Баллы</th>
                                                <th className="py-3 pe-3 font-medium">Статус</th>
                                                <th className="py-3 pe-3 font-medium">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((entry) => (
                                                <tr key={entry.id} className="border-b align-top last:border-0">
                                                    <td className="py-4 pe-3">
                                                        <div className="font-medium">{entry.user?.name ?? '—'}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">{entry.user?.email ?? 'Без email'}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">{entityLabels[entry.entity_type] ?? entry.entity_type}</div>
                                                    </td>
                                                    <td className="py-4 pe-3">
                                                        <div className="font-medium">{entry.indicator?.name ?? '—'}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">{entry.indicator?.code ?? '—'}</div>
                                                    </td>
                                                    <td className="py-4 pe-3">
                                                        <div className="font-medium">{entry.period?.name ?? '—'}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            {stageLabels[entry.period?.stage] ?? entry.period?.stage ?? '—'} • {formatDate(entry.period?.start_date)} - {formatDate(entry.period?.end_date)}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 pe-3">
                                                        <div>{entry.faculty?.name ?? '—'}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">{entry.department?.name ?? '—'}</div>
                                                    </td>
                                                    {isAdminViewer && (
                                                        <td className="py-4 pe-3">
                                                            {(() => {
                                                                const unitNames = resolveStructuralUnits(entry);

                                                                return (
                                                                    <>
                                                                        <div className="text-xs text-muted-foreground">Раздел KPI</div>
                                                                        <div className="font-medium">{sectionLabels[entry.indicator?.section] ?? entry.indicator?.section ?? '—'}</div>
                                                                        <div className="mt-1 text-xs text-muted-foreground">Привязан к подразделению</div>
                                                                        <div>{unitNames.length > 0 ? unitNames.join(', ') : 'Не назначено'}</div>
                                                                        <div className="mt-1 text-xs text-muted-foreground">Кто подтверждает</div>
                                                                        <div className="font-medium">{resolveResponsibleReviewer(entry, mode)}</div>
                                                                    </>
                                                                );
                                                            })()}
                                                        </td>
                                                    )}
                                                    <td className="py-4 pe-3 font-medium">{resolvePoints(entry)}</td>
                                                    <td className="py-4 pe-3">
                                                        <Badge variant={statusVariants[entry.status] ?? 'outline'}>
                                                            {statusLabels[entry.status] ?? entry.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-4 pe-3">
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button asChild size="sm" variant="outline">
                                                                <Link href={route('kpi.entries.show', entry.id)}>
                                                                    <Eye className="h-4 w-4" />
                                                                    Открыть
                                                                </Link>
                                                            </Button>

                                                            {/* Dept head: одобрить → декану */}
                                                            {showApproveForwardAction(entry) && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => submitAction('kpi.entries.approve', entry.id)}
                                                                >
                                                                    <ShieldCheck className="h-4 w-4" />
                                                                    Одобрить → Декану
                                                                </Button>
                                                            )}

                                                            {/* Dean: одобрить → стр. подразделениям */}
                                                            {showDeanForwardAction(entry) && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => submitAction('kpi.entries.approve', entry.id)}
                                                                >
                                                                    <ShieldCheck className="h-4 w-4" />
                                                                    Одобрить → Стр. подр.
                                                                </Button>
                                                            )}

                                                            {/* Structural: финальное утверждение */}
                                                            {showStructuralApproveAction(entry) && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => submitAction('kpi.entries.approve', entry.id)}
                                                                >
                                                                    <ShieldCheck className="h-4 w-4" />
                                                                    Утвердить (начислить балл)
                                                                </Button>
                                                            )}

                                                            {/* Structural: финальный отказ (ППС не редактирует) */}
                                                            {showStructuralRejectAction(entry) && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={() => submitAction('kpi.entries.reject', entry.id, 'Причина отклонения')}
                                                                >
                                                                    <ShieldAlert className="h-4 w-4" />
                                                                    Отклонить (финально)
                                                                </Button>
                                                            )}

                                                            {/* Admin override buttons */}
                                                            {showAdminApproveAction(entry) && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => submitAction('kpi.entries.approve', entry.id)}
                                                                >
                                                                    <ShieldCheck className="h-4 w-4" />
                                                                    Утвердить
                                                                </Button>
                                                            )}
                                                            {showAdminRejectAction(entry) && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={() => submitAction('kpi.entries.reject', entry.id, 'Причина отклонения')}
                                                                >
                                                                    <ShieldAlert className="h-4 w-4" />
                                                                    Отклонить
                                                                </Button>
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