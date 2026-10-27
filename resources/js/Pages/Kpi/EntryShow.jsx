import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { InfoField, Notice, PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Award, Building2, CalendarRange, Calculator, Clock3, Download, ExternalLink, FileText, Gavel, History, ShieldAlert, ShieldCheck, User } from 'lucide-react';

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
    const roleSlug = moderationContext?.role_slug;

    const isEntryScopeActive = (entryObj) => {
        if (!entryObj?.period || entryObj.period?.status !== 'active') {
            return false;
        }

        if (roleSlug === 'teacher') {
            return Boolean(entryObj.period?.is_teacher_active);
        }

        if (roleSlug === 'department_head' || roleSlug === 'hod') {
            return Boolean(entryObj.period?.is_hod_active);
        }

        if (roleSlug === 'dean') {
            return Boolean(entryObj.period?.is_dean_active);
        }

        if (roleSlug === 'structural' || roleSlug === 'structural_unit') {
            return Boolean(entryObj.period?.is_structural_active);
        }

        return true;
    };
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
            header={(
                <PageHeader
                    eyebrow={`KPI-запись #${entry.id}`}
                    title={entry.indicator?.name ?? `KPI-запись #${entry.id}`}
                    description={[
                        entry.indicator?.code ? `Код ${entry.indicator.code}` : null,
                        entry.faculty?.name ?? null,
                        entry.department?.name ?? null,
                    ].filter(Boolean).join(' · ') || null}
                    meta={(
                        <Badge variant={statusVariants[entry.status] ?? 'outline'}>
                            {statusLabels[entry.status] ?? entry.status}
                        </Badge>
                    )}
                />
            )}
        >
            <Head title={`KPI-запись #${entry.id}`} />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile
                        label="Сотрудник"
                        value={<span className="text-xl leading-snug">{entry.user?.name ?? '—'}</span>}
                        hint={entry.user?.email ?? 'Без email'}
                        tone="navy"
                        icon={User}
                    />
                    <StatTile
                        label="Период"
                        value={<span className="text-xl leading-snug">{entry.period?.name ?? '—'}</span>}
                        hint={stageLabels[entry.period?.stage] ?? entry.period?.stage ?? '—'}
                        tone="teal"
                        icon={CalendarRange}
                    />
                    <StatTile label="Баллы" value={resolvePoints(entry)} tone="gold" icon={Award} />
                    <StatTile
                        label="Последнее изменение"
                        value={<span className="text-xl leading-snug">{formatDateTime(entry.updated_at)}</span>}
                        tone="neutral"
                        icon={Clock3}
                    />
                </StatGrid>

                <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText />
                                    Детали записи
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
                                    <InfoField label="Код показателя">{entry.indicator?.code ?? '—'}</InfoField>
                                    <InfoField label="Единица измерения">{entry.indicator?.unit ?? '—'}</InfoField>
                                    <InfoField label="Фактическое значение"><span className="tabular-nums">{entry.fact_value ?? '—'}</span></InfoField>
                                    <InfoField label="Факультет">{entry.faculty?.name ?? '—'}</InfoField>
                                    <InfoField label="Кафедра" className="md:col-span-2">{entry.department?.name ?? '—'}</InfoField>
                                    <InfoField label="Комментарий исполнителя" className="md:col-span-2">
                                        <span className={`whitespace-pre-wrap text-sm ${entry.comment ? 'font-normal text-slate-800' : 'font-normal text-slate-500'}`}>
                                            {entry.comment || 'Комментарий отсутствует.'}
                                        </span>
                                    </InfoField>
                                </div>

                                {externalLinks.length > 0 && (
                                    <div className="space-y-2">
                                        <span className="qd-field-label block text-slate-500">Внешние ссылки</span>
                                        <div className="space-y-1.5">
                                            {externalLinks.map((link, index) => (
                                                <a
                                                    key={`entry-link-${index}`}
                                                    href={link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-start gap-2 break-all text-sm font-medium text-teal-700 underline-offset-2 hover:text-[#102945] hover:underline"
                                                >
                                                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                    {link}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {calculationRows.length > 0 && (
                                    <div className="rounded-xl border border-slate-200 bg-white">
                                        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm font-semibold text-[#102945]">
                                            <Calculator className="h-4 w-4 text-teal-700" />
                                            Детали расчета баллов
                                        </div>
                                        <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
                                            {calculationRows.map((row, index) => (
                                                <div key={`${row.label}-${index}`}>
                                                    <p className="qd-field-label text-slate-500">{row.label}</p>
                                                    <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">{row.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText />
                                    Подтверждающие файлы
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {files.length === 0 ? (
                                    <Notice tone="info">Файлы не прикреплены.</Notice>
                                ) : (
                                    <div className="divide-y divide-slate-200">
                                        {files.map((file) => (
                                            <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-teal-50 text-teal-700">
                                                        <FileText className="h-4 w-4" />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-slate-900">{file.file_name}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {file.file_type || 'Неизвестный тип'} • {file.file_size ? `${Math.max(file.file_size / 1024, 1).toFixed(1)} КБ` : 'Размер неизвестен'}
                                                        </p>
                                                    </div>
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
                                <CardTitle className="flex items-center gap-2">
                                    <History />
                                    История статусов
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {statusLogs.length === 0 ? (
                                    <Notice tone="info">История изменений пока пуста.</Notice>
                                ) : (
                                    <ol className="relative space-y-5 border-l border-slate-200 pl-6">
                                        {statusLogs.map((log) => (
                                            <li key={log.id} className="relative">
                                                <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-teal-600 ring-1 ring-teal-600" aria-hidden="true" />
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="font-semibold text-[#102945]">{actionLabels[log.action] ?? log.action}</p>
                                                    <p className="text-xs tabular-nums text-slate-500">{formatDateTime(log.created_at)}</p>
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                                    <Badge variant={statusVariants[log.from_status] ?? 'outline'}>
                                                        {statusLabels[log.from_status] ?? log.from_status ?? '—'}
                                                    </Badge>
                                                    <span className="text-slate-400">→</span>
                                                    <Badge variant={statusVariants[log.to_status] ?? 'outline'}>
                                                        {statusLabels[log.to_status] ?? log.to_status ?? '—'}
                                                    </Badge>
                                                </div>
                                                <p className="mt-2 text-sm text-slate-600">
                                                    Исполнитель действия: <span className="font-medium text-slate-900">{log.actor?.name ?? 'Система'}</span>
                                                </p>
                                                {log.comment && (
                                                    <p className="mt-2 whitespace-pre-wrap rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{log.comment}</p>
                                                )}
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </CardContent>
                        </Card>

                        {structuralConfirmations.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Building2 />
                                        Подтверждения структурных подразделений
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="divide-y divide-slate-200">
                                        {structuralConfirmations.map((item) => (
                                            <div key={`sp-confirm-${item.structural_unit_id}`} className="py-4 first:pt-0 last:pb-0">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="font-medium text-slate-900">{item.name}</p>
                                                    <Badge variant={spStatusVariants[item.status] ?? 'outline'}>
                                                        {spStatusLabels[item.status] ?? item.status}
                                                    </Badge>
                                                </div>
                                                <p className="mt-1.5 text-sm text-slate-600">
                                                    Подтвердил: <span className="font-medium text-slate-900">{item.confirmed_by ?? '—'}</span>
                                                    {' · '}
                                                    <span className="tabular-nums">{formatDateTime(item.confirmed_at)}</span>
                                                </p>
                                                <p className={`mt-2 whitespace-pre-wrap text-sm ${item.comment ? 'text-slate-800' : 'text-slate-500'}`}>
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
                        <Card className="xl:sticky xl:top-6">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Gavel />
                                    Действия модерации
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <label className="block space-y-2">
                                    <span className="qd-field-label block">Комментарий</span>
                                    <Textarea
                                        className="min-h-32"
                                        value={form.data.comment}
                                        onChange={(event) => form.setData('comment', event.target.value)}
                                        placeholder="Комментарий к утверждению или отклонению"
                                    />
                                </label>

                                <div className="grid gap-2 border-t border-slate-200 pt-4">
                                    {entry.status === 'pending_structural' && structuralConfirmations.length > 0 ? (
                                        <div className="space-y-3">
                                            {structuralConfirmations.map((item) => {
                                                const canAct = canActForStructuralUnit(item.structural_unit_id);
                                                const isPending = item.status === 'pending';
                                                // Пока запись находится на финальном утверждении
                                                // (pending_structural), ответственный СП может заново
                                                // утвердить или отклонить её, даже если его прошлый статус
                                                // «застрял» на rejected/approved (например, после повторной
                                                // отправки исполнителем). Блок уже ограничен статусом
                                                // pending_structural, поэтому действие доступно всегда для
                                                // ответственного СП и администратора.
                                                const isActionable = entry.status === 'pending_structural' || isPending || isAdminViewer;

                                                return (
                                                    <div key={`moderation-sp-${item.structural_unit_id}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                                        <div className="mb-3 flex items-center justify-between gap-2">
                                                            <p className="text-sm font-medium text-slate-900">{item.name}</p>
                                                            <Badge variant={spStatusVariants[item.status] ?? 'outline'}>
                                                                {spStatusLabels[item.status] ?? item.status}
                                                            </Badge>
                                                        </div>

                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            <Button
                                                                type="button"
                                                                disabled={form.processing || !permissions.canApprove || !isActionable || !canAct}
                                                                onClick={() => submitAction('kpi.entries.structural-confirm', { structural_unit_id: item.structural_unit_id })}
                                                            >
                                                                <ShieldCheck className="h-4 w-4" />
                                                                Утвердить СП
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                disabled={form.processing || !permissions.canReject || !isActionable || !canAct}
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
                                            <div className="grid gap-2">
                                                <Button
                                                    type="button"
                                                    disabled={form.processing || !permissions.canApprove || (!isEntryScopeActive(entry) && !isAdminViewer)}
                                                    onClick={() => submitAction('kpi.entries.approve')}
                                                    title={!isEntryScopeActive(entry) && !isAdminViewer ? 'Сезон/область деактивированы — действие недоступно' : undefined}
                                                >
                                                    <ShieldCheck className="h-4 w-4" />
                                                    Утвердить запись
                                                </Button>

                                                <Button
                                                    type="button"
                                                    disabled={form.processing || !(permissions.canReject || permissions.canReturn) || (!isEntryScopeActive(entry) && !isAdminViewer)}
                                                    variant="destructive"
                                                    onClick={() => {
                                                        if (permissions.canReject) {
                                                            submitAction('kpi.entries.reject');
                                                        } else if (permissions.canReturn) {
                                                            submitAction('kpi.entries.return');
                                                        }
                                                    }}
                                                    title={!isEntryScopeActive(entry) && !isAdminViewer ? 'Сезон/область деактивированы — действие недоступно' : undefined}
                                                >
                                                    <ShieldAlert className="h-4 w-4" />
                                                    Отклонить запись
                                                </Button>

                                                {!permissions.canApprove && !permissions.canReject && !permissions.canReturn && (
                                                    <Notice tone="info" className="mt-2">Для этой записи у текущего пользователя доступны только просмотр и история изменений.</Notice>
                                                )}
                                            </div>
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
