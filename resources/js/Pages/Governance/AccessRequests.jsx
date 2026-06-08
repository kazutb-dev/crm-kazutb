import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, FilterBar, PageHeader, StatusBadge } from '@/components/platform';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Filter,
    Search,
    ShieldAlert,
    ShieldCheck,
    XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';

const STATUS_BADGES = {
    pending: 'border-amber-200 bg-amber-50 text-amber-800',
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rejected: 'border-red-200 bg-red-50 text-red-700',
};

const ROUTE_BADGES = {
    hr: 'border-blue-200 bg-blue-50 text-blue-800',
    academic: 'border-violet-200 bg-violet-50 text-violet-800',
    structural: 'border-cyan-200 bg-cyan-50 text-cyan-800',
};

function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function waitingLabel(createdAt) {
    if (!createdAt) return null;
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours < 1) return { text: 'менее часа', tone: 'text-emerald-700' };
    if (hours < 24) return { text: `${hours} ч`, tone: 'text-slate-600' };
    const days = Math.floor(hours / 24);
    if (days <= 3) return { text: `${days} дн`, tone: 'text-amber-700' };
    return { text: `${days} дн ⚠`, tone: 'text-red-700 font-semibold' };
}

function renderValueSummary(requestValue) {
    if (!requestValue) return '—';

    if (requestValue.position_title !== undefined) {
        return requestValue.position_title || 'Не указано';
    }

    if (requestValue.assignment_type !== undefined) {
        const parts = [
            requestValue.assignment_type_label,
            requestValue.faculty_name,
            requestValue.department_name,
            requestValue.educational_program_name,
            requestValue.group_name,
            requestValue.course_number ? `курс ${requestValue.course_number}` : null,
            requestValue.stream_code ? `поток ${requestValue.stream_code}` : null,
        ].filter(Boolean);

        return parts.length > 0 ? parts.join(' / ') : 'Не указано';
    }

    if (requestValue.faculty_name !== undefined || requestValue.department_name !== undefined) {
        return [requestValue.faculty_name, requestValue.department_name].filter(Boolean).join(' / ') || 'Не указано';
    }

    if (Array.isArray(requestValue.structural_unit_names)) {
        return requestValue.structural_unit_names.length > 0 ? requestValue.structural_unit_names.join(', ') : 'Не указано';
    }

    return '—';
}

export default function AccessRequests({ summary = {}, requests = [], pagination = {}, filters = {}, options = {}, permissions = {} }) {
    const { flash = {} } = usePage().props;
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [reviewDialog, setReviewDialog] = useState(null);
    const canManageFoundation = Boolean(permissions.canManageFoundation);

    const reviewForm = useForm({
        review_comment: '',
        rejection_reason: '',
        reason: '',
    });

    const activeFilterCount = useMemo(() => {
        return [filters.q, filters.status, filters.request_type, filters.authority_route, filters.ownership]
            .filter((value) => String(value ?? '').trim() !== '' && String(value) !== 'pending' && String(value) !== 'review')
            .length + (filters.status === 'pending' ? 1 : 0) + (filters.ownership === 'review' ? 1 : 0);
    }, [filters.authority_route, filters.ownership, filters.q, filters.request_type, filters.status]);

    const updateFilters = (patch, resetPage = true) => {
        const payload = {
            ...filters,
            ...patch,
        };

        if (resetPage) {
            payload.page = 1;
        }

        router.get(route('governance.access-requests'), payload, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const goToPage = (page) => {
        if (!page || page < 1 || page > (pagination.last_page ?? 1)) return;
        updateFilters({ page }, false);
    };

    const openReviewDialog = (action, request) => {
        reviewForm.reset();
        setReviewDialog({ action, request });
    };

    const submitReview = (event) => {
        event.preventDefault();
        if (!reviewDialog?.request) return;

        const routeName = reviewDialog.action === 'approve'
            ? 'governance.access-requests.approve'
            : 'governance.access-requests.reject';

        reviewForm.post(route(routeName, reviewDialog.request.id), {
            preserveScroll: true,
            onSuccess: () => {
                setReviewDialog(null);
                reviewForm.reset();
            },
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Запросы согласования" />

            <div className="admin-page-wrap space-y-5">
                <PageHeader
                    eyebrow="Управление доступом"
                    title="Запросы согласования"
                    description="Очередь согласования профиля и организационной привязки."
                    meta={<StatusBadge tone="warning">Ожидающие значения не дают доступ</StatusBadge>}
                />

                {canManageFoundation ? (
                    <Card className="border-red-200 bg-red-50/40 shadow-sm">
                        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                            <div>
                                <p className="text-sm font-semibold text-red-900">Управление администратора</p>
                                <p className="text-xs text-red-800">Одобрение и отклонение требуют указания причины для опасных действий. Все решения записываются в журнал аудита.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('users.index'))}>Сотрудники</Button>
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('governance.role-access'))}>Ролевой доступ</Button>
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('governance.authority-ledger'))}>Журнал полномочий</Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                {flash.success ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {flash.success}
                    </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className="border shadow-sm">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Всего</p>
                                    <p className="mt-1 text-3xl font-semibold text-slate-900">{(summary.total ?? 0).toLocaleString('ru-RU')}</p>
                                </div>
                                <ClipboardCheck className="h-5 w-5 text-slate-500" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-amber-200 bg-amber-50/35 shadow-sm">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Ожидает</p>
                                    <p className="mt-1 text-3xl font-semibold text-slate-900">{(summary.pending ?? 0).toLocaleString('ru-RU')}</p>
                                </div>
                                <ShieldAlert className="h-5 w-5 text-amber-700" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-emerald-200 bg-emerald-50/35 shadow-sm">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Одобрено</p>
                                    <p className="mt-1 text-3xl font-semibold text-slate-900">{(summary.approved ?? 0).toLocaleString('ru-RU')}</p>
                                </div>
                                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-red-200 bg-red-50/35 shadow-sm">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Отклонено</p>
                                    <p className="mt-1 text-3xl font-semibold text-slate-900">{(summary.rejected ?? 0).toLocaleString('ru-RU')}</p>
                                </div>
                                <XCircle className="h-5 w-5 text-red-700" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <FilterBar>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                            <Filter className="h-4 w-4" />
                            Фильтры
                        </div>
                        <StatusBadge tone="default">Активно: {activeFilterCount}</StatusBadge>
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                            <div className="relative xl:col-span-2">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={filters.q ?? ''}
                                    onChange={(event) => updateFilters({ q: event.target.value })}
                                    className="pl-9"
                                    placeholder="Поиск по пользователю / инициатору"
                                />
                            </div>

                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={filters.status ?? 'pending'}
                                onChange={(event) => updateFilters({ status: event.target.value })}
                            >
                                <option value="pending">Ожидает</option>
                                <option value="approved">Одобрено</option>
                                <option value="rejected">Отклонено</option>
                            </select>

                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={filters.request_type ?? ''}
                                onChange={(event) => updateFilters({ request_type: event.target.value })}
                            >
                                <option value="">Все типы</option>
                                {(options.request_types ?? []).map((item) => (
                                    <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                            </select>

                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={filters.authority_route ?? ''}
                                onChange={(event) => updateFilters({ authority_route: event.target.value })}
                            >
                                <option value="">Все цепочки</option>
                                {(options.authority_routes ?? []).map((item) => (
                                    <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={filters.ownership ?? 'review'}
                                onChange={(event) => updateFilters({ ownership: event.target.value })}
                            >
                                <option value="review">Только на моём review</option>
                                <option value="mine">Мои / по мне</option>
                                <option value="all">Все видимые</option>
                            </select>
                        </div>
                    </div>
                </FilterBar>

                <DataTable>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-4 py-3">
                        <div className="text-base font-semibold text-foreground">
                            Очередь запросов
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                ({pagination.total ?? requests.length} записей)
                            </span>
                        </div>
                        <StatusBadge tone="default">review queue</StatusBadge>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-[1400px]">
                                <thead>
                                    <tr>
                                        <th>Пользователь</th>
                                        <th>Тип / цепочка</th>
                                        <th>Текущее</th>
                                        <th>Запрошено</th>
                                        <th>Инициатор</th>
                                        <th>Статус</th>
                                        <th>Ожидание</th>
                                        <th>Дата</th>
                                        <th className="text-right">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requests.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                                                Подходящих запросов согласования нет.
                                            </td>
                                        </tr>
                                    ) : requests.map((item) => (
                                        <tr key={item.id} className="align-top">
                                            <td>
                                                <div className="font-medium text-slate-900">{item.subject_user?.name || '—'}</div>
                                                <div className="mt-0.5 text-xs text-muted-foreground">{item.subject_user?.email || '—'}</div>
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <Badge variant="outline">{item.request_type_label}</Badge>
                                                    <Badge variant="outline" className={ROUTE_BADGES[item.authority_route] ?? ROUTE_BADGES.hr}>
                                                        {item.authority_route_label}
                                                    </Badge>
                                                </div>
                                                {item.origin && <div className="mt-1 text-xs text-muted-foreground">Источник: {item.origin}</div>}
                                            </td>
                                            <td className="text-sm text-slate-700">{renderValueSummary(item.current_value)}</td>
                                            <td className="text-sm font-medium text-slate-900">{renderValueSummary(item.requested_value)}</td>
                                            <td>
                                                <div className="text-sm text-slate-900">{item.requested_by_user?.name || '—'}</div>
                                                <div className="text-xs text-muted-foreground">{item.requested_by_user?.email || '—'}</div>
                                            </td>
                                            <td>
                                                <Badge variant="outline" className={STATUS_BADGES[item.status] ?? STATUS_BADGES.pending}>
                                                    {item.status_label}
                                                </Badge>
                                            </td>
                                            <td>
                                                {item.status === 'pending' && (() => {
                                                    const w = waitingLabel(item.created_at);
                                                    return w ? <span className={`text-xs ${w.tone}`}>{w.text}</span> : null;
                                                })()}
                                            </td>
                                            <td className="text-sm text-muted-foreground">{formatDate(item.created_at)}</td>
                                            <td className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => setSelectedRequest(item)}>
                                                        Детали
                                                    </Button>
                                                    {item.can_review && item.status === 'pending' ? (
                                                        <>
                                                            <Button size="sm" onClick={() => openReviewDialog('approve', item)}>
                                                                Одобрить
                                                            </Button>
                                                            <Button size="sm" variant="destructive" onClick={() => openReviewDialog('reject', item)}>
                                                                Отклонить
                                                            </Button>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                    </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                                Показано {pagination.from ?? 0}-{pagination.to ?? 0} из {pagination.total ?? 0}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" disabled={(pagination.current_page ?? 1) <= 1} onClick={() => goToPage((pagination.current_page ?? 1) - 1)}>
                                    <ChevronLeft className="mr-1 h-4 w-4" /> Назад
                                </Button>
                                <span className="text-sm text-muted-foreground">Стр. {pagination.current_page ?? 1} / {pagination.last_page ?? 1}</span>
                                <Button size="sm" variant="outline" disabled={(pagination.current_page ?? 1) >= (pagination.last_page ?? 1)} onClick={() => goToPage((pagination.current_page ?? 1) + 1)}>
                                    Вперёд <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                </DataTable>
            </div>

            <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <DialogContent className="max-w-4xl">
                    {selectedRequest ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>{selectedRequest.request_type_label}: {selectedRequest.subject_user?.name}</DialogTitle>
                                <DialogDescription>
                                    Детали запроса согласования. Действуют только подтверждённые значения.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">Текущее значение</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(selectedRequest.current_value, null, 2)}</pre>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">Запрошенное значение</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(selectedRequest.requested_value, null, 2)}</pre>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">Подтверждённое значение</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(selectedRequest.approved_value ?? {}, null, 2)}</pre>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">Применяемое значение</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(selectedRequest.effective_value ?? {}, null, 2)}</pre>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">Цепочка полномочий</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div><span className="text-muted-foreground">Маршрут:</span> {selectedRequest.authority_route_label}</div>
                                        <div><span className="text-muted-foreground">Кандидаты на согласование:</span></div>
                                        <div className="flex flex-wrap gap-1">
                                            {(selectedRequest.authority_scope?.candidate_approvers ?? []).length ? selectedRequest.authority_scope.candidate_approvers.map((approver) => (
                                                <Badge key={approver.id} variant="outline">{approver.name} ({approver.role_label})</Badge>
                                            )) : <span className="text-xs text-muted-foreground">Нет зафиксированных кандидатов</span>}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">История и сроки</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="space-y-2">
                                            <div className="flex items-start gap-2">
                                                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                                                <div>
                                                    <span className="font-medium text-slate-800">Создан</span>
                                                    <span className="ml-2 text-xs text-muted-foreground">{formatDate(selectedRequest.created_at)}</span>
                                                    <div className="text-xs text-muted-foreground">{selectedRequest.requested_by_user?.name || '—'}</div>
                                                </div>
                                            </div>
                                            {selectedRequest.approved_at && (
                                                <div className="flex items-start gap-2">
                                                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                                    <div>
                                                        <span className="font-medium text-emerald-800">Одобрен</span>
                                                        <span className="ml-2 text-xs text-muted-foreground">{formatDate(selectedRequest.approved_at)}</span>
                                                        <div className="text-xs text-muted-foreground">{selectedRequest.approver_user?.name || selectedRequest.approver?.name || '—'}</div>
                                                    </div>
                                                </div>
                                            )}
                                            {selectedRequest.rejected_at && (
                                                <div className="flex items-start gap-2">
                                                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                                                    <div>
                                                        <span className="font-medium text-red-800">Отклонён</span>
                                                        <span className="ml-2 text-xs text-muted-foreground">{formatDate(selectedRequest.rejected_at)}</span>
                                                        <div className="text-xs text-muted-foreground">{selectedRequest.rejection_reason || '—'}</div>
                                                    </div>
                                                </div>
                                            )}
                                            {selectedRequest.effective_applied_at && (
                                                <div className="flex items-start gap-2">
                                                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                                                    <div>
                                                        <span className="font-medium text-blue-800">Применено</span>
                                                        <span className="ml-2 text-xs text-muted-foreground">{formatDate(selectedRequest.effective_applied_at)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">Состояние рассмотрения</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div><span className="text-muted-foreground">Статус:</span> {selectedRequest.status_label}</div>
                                        <div><span className="text-muted-foreground">Инициатор:</span> {selectedRequest.requested_by_user?.name || '—'}</div>
                                        <div><span className="text-muted-foreground">Рецензент:</span> {selectedRequest.approver_user?.name || selectedRequest.approver?.name || '—'}</div>
                                        <div><span className="text-muted-foreground">Комментарий заявки:</span> {selectedRequest.request_comment || '—'}</div>
                                        <div><span className="text-muted-foreground">Комментарий рецензента:</span> {selectedRequest.review_comment || '—'}</div>
                                        {selectedRequest.rejection_reason && <div><span className="text-muted-foreground">Причина отклонения:</span> {selectedRequest.rejection_reason}</div>}
                                        {selectedRequest.override_reason && <div><span className="text-muted-foreground">Принудительное решение:</span> {selectedRequest.override_reason}</div>}
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(reviewDialog)} onOpenChange={(open) => !open && setReviewDialog(null)}>
                <DialogContent>
                    {reviewDialog ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>{reviewDialog.action === 'approve' ? 'Одобрить запрос' : 'Отклонить запрос'}</DialogTitle>
                                <DialogDescription>
                                    {reviewDialog.request.request_type_label}: {reviewDialog.request.subject_user?.name}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={submitReview} className="space-y-4">
                                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                                    <div><span className="text-muted-foreground">Текущее:</span> {renderValueSummary(reviewDialog.request.current_value)}</div>
                                    <div className="mt-1"><span className="text-muted-foreground">Запрошено:</span> {renderValueSummary(reviewDialog.request.requested_value)}</div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Комментарий review</label>
                                    <textarea
                                        rows={3}
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                        value={reviewForm.data.review_comment}
                                        onChange={(event) => reviewForm.setData('review_comment', event.target.value)}
                                        placeholder="Комментарий рецензента"
                                    />
                                </div>

                                {reviewDialog.action === 'reject' ? (
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">Причина отклонения</label>
                                        <textarea
                                            rows={3}
                                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                            value={reviewForm.data.rejection_reason}
                                            onChange={(event) => reviewForm.setData('rejection_reason', event.target.value)}
                                            placeholder="Почему заявка отклонена"
                                        />
                                    </div>
                                ) : null}

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Причина override</label>
                                    <Input
                                        value={reviewForm.data.reason}
                                        onChange={(event) => reviewForm.setData('reason', event.target.value)}
                                        placeholder="Обязательно для superadmin override"
                                    />
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setReviewDialog(null)}>Отмена</Button>
                                    <Button type="submit" variant={reviewDialog.action === 'approve' ? 'default' : 'destructive'} disabled={reviewForm.processing}>
                                        {reviewDialog.action === 'approve' ? 'Одобрить' : 'Отклонить'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
