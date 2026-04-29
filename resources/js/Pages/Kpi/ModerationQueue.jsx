import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Eye, Filter, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';

const statusLabels = {
    draft: 'Черновик',
    submitted: 'Отправлено',
    returned: 'Возвращено',
    reviewed: 'Проверено',
    pending_dean: 'На рассмотрении у декана',
    pending_structural: 'На рассмотрении у стр. подр.',
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
    const raw = entry.manual_points ?? entry.calculated_points ?? 0;
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
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
    mode = 'review',
}) {
    const { auth, flash, errors } = usePage().props;
    const items = entries?.data ?? [];
    const links = entries?.links ?? [];
    const total = entries?.total ?? items.length;
    const roleSlug = auth?.roleSlug;
    const canModerate = permissions?.canModerate ?? false;

    const filterForm = useForm({
        academic_year_id: filters.academic_year_id ? String(filters.academic_year_id) : '',
        period_id: filters.period_id ? String(filters.period_id) : '',
        status: filters.status ?? '',
        department_id: filters.department_id ? String(filters.department_id) : '',
        faculty_id: filters.faculty_id ? String(filters.faculty_id) : '',
        user_id: filters.user_id ? String(filters.user_id) : '',
    });

    const applyFilters = (event) => {
        event.preventDefault();

        router.get(route(queueRoute), {
            academic_year_id: filterForm.data.academic_year_id || undefined,
            period_id: filterForm.data.period_id || undefined,
            status: filterForm.data.status || undefined,
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
            status: '',
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

    const currentStatus = filterForm.data.status || filters.status || '';

    // Dept head queue (review): submitted → pending_dean or returned
    const showApproveForwardAction = (entry) => canModerate
        && mode === 'review'
        && entry.status === 'submitted';

    // Dean queue (approval): pending_dean → pending_structural or returned
    const showDeanForwardAction = (entry) => canModerate
        && mode === 'approval'
        && ['pending_dean', 'reviewed'].includes(entry.status);

    // Return to teacher: dept head from submitted, dean from pending_dean
    const showReturnAction = (entry) => canModerate
        && ((mode === 'review' && entry.status === 'submitted')
            || (mode === 'approval' && ['pending_dean', 'reviewed'].includes(entry.status)));

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
        && ['submitted', 'reviewed', 'pending_dean', 'pending_structural'].includes(entry.status);

    return (
        <AuthenticatedLayout
            headerRight={
                <div className="flex items-center gap-2">
                    <Button
                        asChild
                        size="sm"
                        variant={mode === 'review' ? 'default' : 'outline'}
                    >
                        <Link href={route('kpi.review-queue')}>Проверка</Link>
                    </Button>
                    <Button
                        asChild
                        size="sm"
                        variant={mode === 'approval' ? 'default' : 'outline'}
                    >
                        <Link href={route('kpi.approval-queue')}>На рассмотрении у декана</Link>
                    </Button>
                    <Button
                        asChild
                        size="sm"
                        variant={mode === 'structural' ? 'default' : 'outline'}
                    >
                        <Link href={route('kpi.structural-queue')}>Стр. подразделения</Link>
                    </Button>
                </div>
            }
        >
            <Head title={pageTitle} />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <Card className="border-0 bg-gradient-to-r from-amber-50 via-white to-sky-50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            {mode === 'approval' ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                            {title}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <p>{description}</p>
                            <p>
                                Роль: <span className="font-medium text-foreground">{entityLabels[roleSlug] ?? roleSlug ?? 'Сотрудник'}</span>.
                                Доступные действия зависят от статуса записи и организационной привязки пользователя.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                            <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Записей</p>
                                <p className="mt-2 text-lg font-semibold">{total}</p>
                            </div>
                            <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Статус фильтра</p>
                                <div className="mt-2">
                                    <Badge variant={statusVariants[currentStatus] ?? 'outline'}>
                                        {currentStatus ? (statusLabels[currentStatus] ?? currentStatus) : 'Все статусы'}
                                    </Badge>
                                </div>
                            </div>
                            <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Права</p>
                                <p className="mt-2 text-sm font-medium text-foreground">
                                    {canModerate ? 'Доступны действия модерации' : 'Только просмотр'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

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
                                    <label className="text-sm font-medium">Статус</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={filterForm.data.status}
                                        onChange={(event) => filterForm.setData('status', event.target.value)}
                                    >
                                        <option value="">Все статусы</option>
                                        {statusOptions.map((status) => (
                                            <option key={status} value={status}>{statusLabels[status] ?? status}</option>
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

                                                            {/* Dept head / Dean: вернуть ППС */}
                                                            {showReturnAction(entry) && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => submitAction('kpi.entries.return', entry.id, 'Комментарий к возврату')}
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                    Вернуть ППС
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