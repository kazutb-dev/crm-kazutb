import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Download, FileText, ShieldAlert, ShieldCheck } from 'lucide-react';

const statusLabels = {
    draft: 'Черновик',
    submitted: 'Отправлено',
    returned: 'Возвращено',
    reviewed: 'Скорректировано',
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

const actionLabels = {
    submit: 'Отправка на рассмотрение',
    return: 'Возврат исполнителю',
    review: 'Корректировка',
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
    const raw = entry.points_for_display ?? entry.manual_points ?? entry.calculated_points ?? 0;
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

function resolveCalculationDetails(entry) {
    const details = entry?.calculation_details;

    if (!details || typeof details !== 'object') {
        return [];
    }

    const rows = [];

    if (details.rule_kind) {
        rows.push({ label: 'Тип правила', value: String(details.rule_kind) });
    }

    if (details.rule_text) {
        rows.push({ label: 'Текст правила', value: String(details.rule_text) });
    }

    if (details.selection_label) {
        rows.push({ label: 'Выбранная категория/условие', value: String(details.selection_label) });
    }

    if (details.quantity !== undefined && details.quantity !== null) {
        rows.push({ label: 'Количество', value: String(details.quantity) });
    }

    if (details.sheet_count !== undefined && details.sheet_count !== null) {
        rows.push({ label: 'Печатные листы', value: String(details.sheet_count) });
    }

    if (details.coauthors_count !== undefined && details.coauthors_count !== null) {
        rows.push({ label: 'Соавторы', value: String(details.coauthors_count) });
    }

    if (details.selection_points !== undefined && details.selection_points !== null) {
        rows.push({ label: 'Ставка баллов', value: String(details.selection_points) });
    }

    if (details.per_sheet_points !== undefined && details.per_sheet_points !== null) {
        rows.push({ label: 'Баллы за 1 п.л.', value: String(details.per_sheet_points) });
    }

    if (details.computed_points !== undefined && details.computed_points !== null) {
        rows.push({ label: 'Расчетный балл', value: String(details.computed_points) });
    }

    return rows;
}

function resolveExternalLinks(entry) {
    const linksFromDetails = Array.isArray(entry?.calculation_details?.external_source_urls)
        ? entry.calculation_details.external_source_urls
            .map((url) => String(url ?? '').trim())
            .filter(Boolean)
        : [];

    if (linksFromDetails.length > 0) {
        return linksFromDetails;
    }

    return entry?.external_source_url
        ? [String(entry.external_source_url).trim()]
        : [];
}

function formatStructuralUnitName(unit) {
    const code = String(unit?.code ?? '').trim();
    const name = String(unit?.name ?? '').trim();

    if (code && name) {
        return `${code} — ${name}`;
    }

    return name || code || 'Структурное подразделение';
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
            status: confirmation?.status ?? 'pending',
            comment: confirmation?.comment ?? null,
            confirmed_by: confirmation?.confirmer?.display_name
                ?? confirmation?.confirmer?.name
                ?? confirmation?.confirmed_by
                ?? null,
            confirmed_at: confirmation?.confirmed_at ?? null,
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
            status: item?.status ?? 'pending',
            comment: item?.comment ?? null,
            confirmed_by: item?.confirmer?.display_name ?? item?.confirmer?.name ?? item?.confirmed_by ?? null,
            confirmed_at: item?.confirmed_at ?? null,
        });
    });

    return resolved;
}

export default function EntryShow({ entry, permissions = {}, moderationContext = {} }) {
    const form = useForm({
        comment: '',
    });

    const files = entry?.files ?? [];
    const calculationRows = resolveCalculationDetails(entry);
    const externalLinks = resolveExternalLinks(entry);
    const structuralConfirmations = resolveEntryStructuralConfirmations(entry);
    const isAdminViewer = Boolean(moderationContext?.is_admin);
    const actorStructuralUnitIds = new Set(
        Array.isArray(moderationContext?.actor_structural_unit_ids)
            ? moderationContext.actor_structural_unit_ids
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id))
            : [],
    );

    const canActForStructuralUnit = (unitId) => {
        if (isAdminViewer) {
            return true;
        }

        return actorStructuralUnitIds.has(Number(unitId));
    };

    const statusLogs = [...(entry?.status_logs ?? [])].sort((left, right) => {
        const leftTime = new Date(left.created_at ?? 0).getTime();
        const rightTime = new Date(right.created_at ?? 0).getTime();

        return rightTime - leftTime;
    });

    const submitAction = (routeName, extraData = {}) => {
        router.post(route(routeName, entry.id), {
            comment: form.data.comment || '',
            ...extraData,
        }, {
            preserveScroll: true,
            onSuccess: () => form.reset('comment'),
        });
    };

    return (
        <AuthenticatedLayout
            headerRight={
                <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                        <Link href={route('kpi.review-queue')}>Корректировка данных - Кафедра</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                        <Link href={route('kpi.approval-queue')}>Корректировка данных - Деканат</Link>
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

                                {externalLinks.length > 0 && (
                                    <div className="md:col-span-2">
                                        <p className="text-sm text-muted-foreground">Внешние ссылки</p>
                                        <div className="mt-1 rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                                            {externalLinks.map((link, index) => (
                                                <a
                                                    key={`entry-link-${index}`}
                                                    href={link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="block break-all text-sky-700 underline-offset-2 hover:underline"
                                                >
                                                    {link}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {calculationRows.length > 0 && (
                                    <div className="md:col-span-2">
                                        <p className="text-sm text-muted-foreground">Детали расчета баллов</p>
                                        <div className="mt-1 rounded-lg border bg-muted/30 p-3 text-sm">
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {calculationRows.map((row, index) => (
                                                    <div key={`${row.label}-${index}`}>
                                                        <p className="text-xs text-muted-foreground">{row.label}</p>
                                                        <p className="font-medium whitespace-pre-wrap">{row.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
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

                        {structuralConfirmations.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Подтверждения структурных подразделений</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {structuralConfirmations.map((item) => (
                                            <div key={`sp-confirm-${item.structural_unit_id}`} className="rounded-lg border p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="font-medium">{item.name}</p>
                                                    <Badge variant={spStatusVariants[item.status] ?? 'outline'}>
                                                        {spStatusLabels[item.status] ?? item.status}
                                                    </Badge>
                                                </div>
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    Подтвердил: <span className="font-medium text-foreground">{item.confirmed_by ?? '—'}</span>
                                                    {' · '}
                                                    {formatDateTime(item.confirmed_at)}
                                                </p>
                                                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/30 p-3 text-sm">
                                                    {item.comment || 'Комментарий отсутствует.'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
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
                                        placeholder="Комментарий к утверждению или отклонению"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    {entry.status === 'pending_structural' && structuralConfirmations.length > 0 ? (
                                        <div className="space-y-2">
                                            {structuralConfirmations.map((item) => {
                                                const canAct = canActForStructuralUnit(item.structural_unit_id);
                                                const isPending = item.status === 'pending';

                                                return (
                                                    <div key={`moderation-sp-${item.structural_unit_id}`} className="rounded-md border bg-muted/20 p-2.5">
                                                        <div className="mb-2 flex items-center justify-between gap-2">
                                                            <p className="text-sm font-medium">{item.name}</p>
                                                            <Badge variant={spStatusVariants[item.status] ?? 'outline'}>
                                                                {spStatusLabels[item.status] ?? item.status}
                                                            </Badge>
                                                        </div>

                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            <Button
                                                                type="button"
                                                                disabled={form.processing || !permissions.canApprove || !isPending || !canAct}
                                                                onClick={() => submitAction('kpi.entries.structural-confirm', { structural_unit_id: item.structural_unit_id })}
                                                            >
                                                                <ShieldCheck className="h-4 w-4" />
                                                                Утвердить СП
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                disabled={form.processing || !permissions.canReject || !isPending || !canAct}
                                                                variant="destructive"
                                                                onClick={() => submitAction('kpi.entries.structural-reject', { structural_unit_id: item.structural_unit_id })}
                                                            >
                                                                <ShieldAlert className="h-4 w-4" />
                                                                Отклонить СП
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <>
                                            {permissions.canApprove && (
                                                <Button type="button" disabled={form.processing} onClick={() => submitAction('kpi.entries.approve')}>
                                                    <ShieldCheck className="h-4 w-4" />
                                                    Утвердить запись
                                                </Button>
                                            )}

                                            {permissions.canReject && (
                                                <Button type="button" disabled={form.processing} variant="destructive" onClick={() => submitAction('kpi.entries.reject')}>
                                                    <ShieldAlert className="h-4 w-4" />
                                                    Отклонить запись
                                                </Button>
                                            )}

                                            {!permissions.canApprove && !permissions.canReject && (
                                                <p className="text-sm text-muted-foreground">Для этой записи у текущего пользователя доступны только просмотр и история изменений.</p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}