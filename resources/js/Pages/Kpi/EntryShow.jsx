import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { CheckCheck, Download, FileText, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';

const statusLabels = {
    draft: 'Черновик',
    submitted: 'Отправлено',
    returned: 'Возвращено',
    reviewed: 'Проверено',
    approved: 'Утверждено',
    rejected: 'Отклонено',
    locked: 'Заблокировано',
};

const statusVariants = {
    draft: 'outline',
    submitted: 'secondary',
    returned: 'outline',
    reviewed: 'secondary',
    approved: 'default',
    rejected: 'destructive',
    locked: 'destructive',
};

const stageLabels = {
    plan: 'План',
    fact: 'Факт',
    review: 'Рассмотрение',
};

const actionLabels = {
    submit: 'Отправка на рассмотрение',
    return: 'Возврат исполнителю',
    review: 'Проверка',
    approve: 'Утверждение',
    reject: 'Отклонение',
    lock: 'Блокировка',
};

function formatDateTime(value) {
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
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function resolvePoints(entry) {
    const raw = entry.manual_points ?? entry.calculated_points ?? 0;
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

export default function EntryShow({ entry, permissions = {} }) {
    const { flash, errors } = usePage().props;
    const form = useForm({
        comment: '',
    });

    const files = entry?.files ?? [];
    const statusLogs = [...(entry?.status_logs ?? [])].sort((left, right) => {
        const leftTime = new Date(left.created_at ?? 0).getTime();
        const rightTime = new Date(right.created_at ?? 0).getTime();

        return rightTime - leftTime;
    });

    const submitAction = (routeName) => {
        form.post(route(routeName, entry.id), {
            preserveScroll: true,
            onSuccess: () => form.reset('comment'),
        });
    };

    return (
        <AuthenticatedLayout
            headerRight={
                <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                        <Link href={route('kpi.review-queue')}>Проверка</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                        <Link href={route('kpi.approval-queue')}>Утверждение</Link>
                    </Button>
                </div>
            }
        >
            <Head title={`KPI-запись #${entry.id}`} />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <Card className="border-0 bg-gradient-to-r from-sky-50 via-white to-emerald-50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-3 text-xl">
                            <span>{entry.indicator?.name ?? `KPI-запись #${entry.id}`}</span>
                            <Badge variant={statusVariants[entry.status] ?? 'outline'}>
                                {statusLabels[entry.status] ?? entry.status}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Сотрудник</p>
                            <p className="mt-2 font-semibold">{entry.user?.name ?? '—'}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{entry.user?.email ?? 'Без email'}</p>
                        </div>
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Период</p>
                            <p className="mt-2 font-semibold">{entry.period?.name ?? '—'}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{stageLabels[entry.period?.stage] ?? entry.period?.stage ?? '—'}</p>
                        </div>
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Баллы</p>
                            <p className="mt-2 text-lg font-semibold">{resolvePoints(entry)}</p>
                        </div>
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Последнее изменение</p>
                            <p className="mt-2 font-semibold">{formatDateTime(entry.updated_at)}</p>
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

                <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Детали записи</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <p className="text-sm text-muted-foreground">Код показателя</p>
                                    <p className="mt-1 font-medium">{entry.indicator?.code ?? '—'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Единица измерения</p>
                                    <p className="mt-1 font-medium">{entry.indicator?.unit ?? '—'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Плановое значение</p>
                                    <p className="mt-1 font-medium">{entry.plan_value ?? '—'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Фактическое значение</p>
                                    <p className="mt-1 font-medium">{entry.fact_value ?? '—'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Факультет</p>
                                    <p className="mt-1 font-medium">{entry.faculty?.name ?? '—'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Кафедра</p>
                                    <p className="mt-1 font-medium">{entry.department?.name ?? '—'}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <p className="text-sm text-muted-foreground">Комментарий исполнителя</p>
                                    <p className="mt-1 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">
                                        {entry.comment || 'Комментарий отсутствует.'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <FileText className="h-4 w-4" />
                                    Подтверждающие файлы
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {files.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Файлы не прикреплены.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {files.map((file) => (
                                            <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                                                <div>
                                                    <p className="font-medium">{file.file_name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {file.file_type || 'Неизвестный тип'} • {file.file_size ? `${Math.max(file.file_size / 1024, 1).toFixed(1)} КБ` : 'Размер неизвестен'}
                                                    </p>
                                                </div>
                                                <Button asChild size="sm" variant="outline">
                                                    <a href={file.file_url} target="_blank" rel="noreferrer">
                                                        <Download className="h-4 w-4" />
                                                        Открыть
                                                    </a>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">История статусов</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {statusLogs.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">История изменений пока пуста.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {statusLogs.map((log) => (
                                            <div key={log.id} className="rounded-lg border p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="font-medium">{actionLabels[log.action] ?? log.action}</p>
                                                    <p className="text-sm text-muted-foreground">{formatDateTime(log.created_at)}</p>
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                                    <Badge variant={statusVariants[log.from_status] ?? 'outline'}>
                                                        {statusLabels[log.from_status] ?? log.from_status ?? '—'}
                                                    </Badge>
                                                    <span className="text-muted-foreground">→</span>
                                                    <Badge variant={statusVariants[log.to_status] ?? 'outline'}>
                                                        {statusLabels[log.to_status] ?? log.to_status ?? '—'}
                                                    </Badge>
                                                </div>
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    Исполнитель действия: <span className="font-medium text-foreground">{log.actor?.name ?? 'Система'}</span>
                                                </p>
                                                {log.comment && (
                                                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/30 p-3 text-sm">{log.comment}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Действия модерации</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Комментарий</label>
                                    <textarea
                                        className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={form.data.comment}
                                        onChange={(event) => form.setData('comment', event.target.value)}
                                        placeholder="Комментарий к проверке, возврату, утверждению или отклонению"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    {permissions.canReview && (
                                        <Button disabled={form.processing} onClick={() => submitAction('kpi.entries.review')}>
                                            <CheckCheck className="h-4 w-4" />
                                            Отметить как проверенную
                                        </Button>
                                    )}

                                    {permissions.canReturn && (
                                        <Button disabled={form.processing} variant="outline" onClick={() => submitAction('kpi.entries.return')}>
                                            <RotateCcw className="h-4 w-4" />
                                            Вернуть исполнителю
                                        </Button>
                                    )}

                                    {permissions.canApprove && (
                                        <Button disabled={form.processing} onClick={() => submitAction('kpi.entries.approve')}>
                                            <ShieldCheck className="h-4 w-4" />
                                            Утвердить запись
                                        </Button>
                                    )}

                                    {permissions.canReject && (
                                        <Button disabled={form.processing} variant="destructive" onClick={() => submitAction('kpi.entries.reject')}>
                                            <ShieldAlert className="h-4 w-4" />
                                            Отклонить запись
                                        </Button>
                                    )}
                                </div>

                                {!permissions.canReview && !permissions.canReturn && !permissions.canApprove && !permissions.canReject && (
                                    <p className="text-sm text-muted-foreground">Для этой записи у текущего пользователя доступны только просмотр и история изменений.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}