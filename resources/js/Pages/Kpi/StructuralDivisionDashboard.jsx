import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, FilterBar, FormField, PageHeader, Segmented, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router, useForm } from '@inertiajs/react';
import {
    BarChart3,
    CircleAlert,
    FileUp,
    ListChecks,
    Plus,
    Send,
    Trash2,
    X,
} from 'lucide-react';
import { useState } from 'react';

const stageLabels = {
    plan: 'План',
    fact: 'Факт',
    review: 'Рассмотрение',
};

const statusLabels = {
    draft: 'Черновик',
    submitted: 'Отправлено',
    returned: 'Возвращено',
    reviewed: 'Проверено',
    approved: 'Утверждено',
    rejected: 'Отклонено',
    locked: 'Заблокировано',
};

const statusTones = {
    draft: 'default',
    submitted: 'info',
    returned: 'warning',
    reviewed: 'info',
    approved: 'success',
    rejected: 'danger',
    locked: 'danger',
};

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export default function StructuralDivisionDashboard({
    period = null,
    summary = {},
    entries = { data: [] },
    indicators = [],
    modules = [],
    stageOptions = ['plan', 'fact', 'review'],
    statusOptions = [],
    filters = {},
}) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [uploadingEntryId, setUploadingEntryId] = useState(null);

    const stage = period?.stage ?? filters.stage ?? 'plan';
    const isPlanStage = stage === 'plan';
    const isFactStage = stage === 'fact';
    const isEditable = isPlanStage || isFactStage;

    // ---- Add form ----
    const addForm = useForm({
        stage,
        indicator_id: '',
        value: '',
        comment: '',
        action: 'draft',
    });

    const handleStageSwitch = (s) => {
        router.get(route('kpi.structural-form'), {
            stage: s,
            academic_year_id: filters.academic_year_id ?? undefined,
        }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const handleFilterChange = (key, value) => {
        router.get(route('kpi.structural-form'), {
            ...filters,
            [key]: value || undefined,
        }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitAdd = (action) => {
        addForm.setData('action', action);
        addForm.post(route('kpi.structural-entries.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setShowAddForm(false);
                addForm.reset();
            },
        });
    };

    // ---- Edit inline ----
    const editForm = useForm({ stage, value: '', comment: '' });

    const startEdit = (entry) => {
        setEditingEntry(entry.id);
        editForm.setData({
            stage,
            value: isPlanStage ? (entry.plan_value ?? '') : (entry.fact_value ?? ''),
            comment: entry.comment ?? '',
        });
    };

    const cancelEdit = () => {
        setEditingEntry(null);
        editForm.reset();
    };

    const saveEdit = (entryId) => {
        editForm.patch(route('kpi.structural-entries.update', entryId), {
            preserveScroll: true,
            onSuccess: () => setEditingEntry(null),
        });
    };

    const submitEntry = (entryId) => {
        router.post(route('kpi.structural-entries.submit', entryId), {}, {
            preserveScroll: true,
        });
    };

    const deleteEntry = (entryId) => {
        if (!confirm('Удалить эту KPI-запись?')) return;
        router.delete(route('kpi.structural-entries.destroy', entryId), {
            preserveScroll: true,
        });
    };

    const uploadFile = (entryId, file) => {
        if (!entryId || !file) return;
        setUploadingEntryId(entryId);
        router.post(route('kpi.entries.files.store', entryId), { file }, {
            preserveScroll: true,
            forceFormData: true,
            onFinish: () => setUploadingEntryId(null),
        });
    };

    const entryData = entries?.data ?? [];
    const entryLinks = entries?.links ?? [];

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Структурные подразделения"
                    title="KPI — Структурные подразделения"
                    description={period ? (
                        <>
                            Период: <strong className="text-[#102945]">{period.name}</strong>. Окно подачи:{' '}
                            <span className="tabular-nums">{formatDate(period.start_date)} – {formatDate(period.end_date)}</span>.
                        </>
                    ) : 'Активный KPI-период для выбранной стадии сейчас не открыт.'}
                    actions={(
                        <Segmented
                            items={stageOptions.map((s) => ({ key: s, label: stageLabels[s] ?? s }))}
                            value={stage}
                            onChange={handleStageSwitch}
                        />
                    )}
                />
            )}
        >
            <Head title="KPI — Структурные подразделения" />

            <div className="admin-page-wrap space-y-4">
                <StatGrid>
                    <StatTile label="Этап" value={stageLabels[stage] ?? '—'} tone="teal" icon={BarChart3} />
                    <StatTile label="Сумма баллов" value={Number(summary.total_points ?? 0).toFixed(2)} tone="gold" />
                    <StatTile label="Черновики" value={summary.draft_entries ?? 0} tone="neutral" />
                    <StatTile label="Отправлено" value={summary.submitted_entries ?? 0} tone="info" />
                    <StatTile label="Записей" value={entries?.total ?? (entries?.data ?? []).length} tone="navy" icon={ListChecks} hint={`Показателей доступно: ${indicators.length}`} />
                </StatGrid>

                {!period ? (
                    <EmptyState
                        title="Нет активного периода"
                        description="Дождитесь открытия периода администратором или переключите этап выше."
                    />
                ) : (
                    <>
                        {(modules.length > 0 || statusOptions.length > 0) && (
                            <FilterBar>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    {modules.length > 0 && (
                                        <FormField label="Раздел">
                                            <select
                                                className={qdFieldClass}
                                                value={filters.module ?? ''}
                                                onChange={(e) => handleFilterChange('module', e.target.value)}
                                            >
                                                <option value="">Все разделы</option>
                                                {modules.map((m) => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                        </FormField>
                                    )}
                                    {statusOptions.length > 0 && (
                                        <FormField label="Статус">
                                            <select
                                                className={qdFieldClass}
                                                value={filters.status ?? ''}
                                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                            >
                                                <option value="">Все статусы</option>
                                                {statusOptions.map((s) => (
                                                    <option key={s} value={s}>{statusLabels[s] ?? s}</option>
                                                ))}
                                            </select>
                                        </FormField>
                                    )}
                                </div>
                            </FilterBar>
                        )}

                        {showAddForm && isEditable && (
                            <Card className="border-teal-200">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Plus className="h-4 w-4" />
                                        Новая KPI-запись
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_160px_minmax(0,1.5fr)] lg:items-start">
                                    <div className="space-y-1">
                                    <FormField label="Показатель">
                                        <select
                                            className={qdFieldClass}
                                            value={addForm.data.indicator_id}
                                            onChange={(e) => addForm.setData('indicator_id', e.target.value)}
                                        >
                                            <option value="">— Выберите показатель —</option>
                                            {indicators.map((ind) => (
                                                <option key={ind.id} value={ind.id}>
                                                    {ind.code} · {ind.name}{ind.unit ? ` (${ind.unit})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </FormField>
                                    {addForm.errors.indicator_id && (
                                        <p className="text-xs text-red-700">{addForm.errors.indicator_id}</p>
                                    )}
                                    </div>
                                    <div className="space-y-1">
                                    <FormField label={isPlanStage ? 'Плановое значение' : 'Фактическое значение'}>
                                        <Input
                                            type="number"
                                            step="1"
                                            min="0"
                                            value={addForm.data.value}
                                            onChange={(e) => addForm.setData('value', e.target.value)}
                                            placeholder="0"
                                        />
                                    </FormField>
                                    {addForm.errors.value && (
                                        <p className="text-xs text-red-700">{addForm.errors.value}</p>
                                    )}
                                    </div>
                                    <FormField label="Комментарий">
                                        <textarea
                                            rows={1}
                                            className={`${qdFieldClass} h-auto min-h-10 py-2`}
                                            value={addForm.data.comment}
                                            onChange={(e) => addForm.setData('comment', e.target.value)}
                                            placeholder="Необязательно"
                                        />
                                    </FormField>
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => { setShowAddForm(false); addForm.reset(); }}
                                        >
                                            <X className="h-4 w-4" />
                                            Отмена
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={addForm.processing}
                                            onClick={() => submitAdd('draft')}
                                        >
                                            Сохранить черновик
                                        </Button>
                                        <Button
                                            type="button"
                                            disabled={addForm.processing}
                                            onClick={() => submitAdd('submit')}
                                        >
                                            <Send className="h-4 w-4" />
                                            Сохранить и отправить
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                                <CardTitle className="flex items-center gap-2">
                                    <ListChecks className="h-4 w-4" />
                                    KPI-записи
                                </CardTitle>
                                {isEditable && !showAddForm && (
                                    <Button type="button" onClick={() => setShowAddForm(true)} size="sm">
                                        <Plus className="h-4 w-4" />
                                        Добавить показатель
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className={entryData.length === 0 ? '' : 'p-0'}>
                                {entryData.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-slate-500">
                                        <CircleAlert className="h-6 w-6 text-slate-400" />
                                        <p className="text-sm">Нет записей. Добавьте показатель с помощью кнопки выше.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[900px] text-sm">
                                            <thead className="border-b border-slate-200">
                                                <tr className="text-left">
                                                    <th>Показатель</th>
                                                    <th>Раздел</th>
                                                    <th className="text-right">План</th>
                                                    <th className="text-right">Факт</th>
                                                    <th className="text-right">Баллы</th>
                                                    <th>Файл</th>
                                                    <th>Статус</th>
                                                    <th className="text-right">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {entryData.map((entry) => {
                                                    const isEditing = editingEntry === entry.id;
                                                    const canEdit = isEditable && (entry.status === 'draft' || entry.status === 'returned');
                                                    const canSubmitEntry = isEditable && (entry.status === 'draft' || entry.status === 'returned');
                                                    const canDelete = canEdit;
                                                    const points = Number(entry.manual_points ?? entry.calculated_points ?? 0);
                                                    const indicator = entry.indicator ?? {};
                                                    const files = entry.files ?? [];

                                                    return (
                                                        <tr key={entry.id} className={`border-b border-slate-200 align-top last:border-0 ${isEditing ? 'bg-teal-50/50' : 'hover:bg-slate-50/60'}`}>
                                                            <td>
                                                                <div className="font-medium text-slate-900">{indicator.name ?? '—'}</div>
                                                                <div className="text-xs text-slate-500">
                                                                    {indicator.code}{indicator.unit ? ` · ${indicator.unit}` : ''}
                                                                </div>
                                                            </td>
                                                            <td className="text-slate-600">{indicator.section ?? '—'}</td>
                                                            <td className="text-right tabular-nums">
                                                                {isEditing && isPlanStage ? (
                                                                    <Input
                                                                        type="number"
                                                                        step="1"
                                                                        min="0"
                                                                        value={editForm.data.value}
                                                                        onChange={(e) => editForm.setData('value', e.target.value)}
                                                                        className="ml-auto w-24"
                                                                    />
                                                                ) : (
                                                                    entry.plan_value ?? '—'
                                                                )}
                                                            </td>
                                                            <td className="text-right tabular-nums">
                                                                {isEditing && isFactStage ? (
                                                                    <Input
                                                                        type="number"
                                                                        step="1"
                                                                        min="0"
                                                                        value={editForm.data.value}
                                                                        onChange={(e) => editForm.setData('value', e.target.value)}
                                                                        className="ml-auto w-24"
                                                                    />
                                                                ) : (
                                                                    entry.fact_value ?? '—'
                                                                )}
                                                            </td>
                                                            <td className="text-right font-semibold tabular-nums text-[#102945]">
                                                                {Number.isFinite(points) ? points.toFixed(2) : '0.00'}
                                                            </td>
                                                            <td>
                                                                {files.length > 0 ? (
                                                                    files.map((file) => (
                                                                        <a
                                                                            key={file.id}
                                                                            href={file.file_url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="block text-xs font-medium text-teal-700 hover:underline"
                                                                        >
                                                                            {file.file_name}
                                                                        </a>
                                                                    ))
                                                                ) : (
                                                                    <span className={`text-xs ${indicator.requires_file ? 'font-medium text-amber-700' : 'text-slate-400'}`}>
                                                                        {indicator.requires_file ? 'Файл обязателен' : '—'}
                                                                    </span>
                                                                )}
                                                                {indicator.requires_file && isFactStage && canEdit && entry.id && (
                                                                    <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-[10px] border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-[#102945] hover:border-teal-600 hover:text-teal-700">
                                                                        <FileUp className="h-3 w-3" />
                                                                        {uploadingEntryId === entry.id ? 'Загрузка...' : 'Файл'}
                                                                        <input
                                                                            type="file"
                                                                            className="hidden"
                                                                            disabled={uploadingEntryId === entry.id}
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) uploadFile(entry.id, file);
                                                                                e.target.value = '';
                                                                            }}
                                                                        />
                                                                    </label>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <StatusBadge tone={statusTones[entry.status] ?? 'default'}>
                                                                    {statusLabels[entry.status] ?? entry.status}
                                                                </StatusBadge>
                                                                {entry.comment && (
                                                                    <p className="mt-1 max-w-xs text-xs text-slate-500">{entry.comment}</p>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <div className="flex flex-wrap justify-end gap-1">
                                                                    {isEditing ? (
                                                                        <>
                                                                            <Button
                                                                                size="sm"
                                                                                disabled={editForm.processing}
                                                                                onClick={() => saveEdit(entry.id)}
                                                                            >
                                                                                Сохранить
                                                                            </Button>
                                                                            <Button size="sm" variant="ghost" onClick={cancelEdit} title="Отмена">
                                                                                <X className="h-3 w-3" />
                                                                            </Button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {canEdit && (
                                                                                <Button size="sm" variant="outline" onClick={() => startEdit(entry)}>
                                                                                    Изменить
                                                                                </Button>
                                                                            )}
                                                                            {canSubmitEntry && (
                                                                                <Button size="sm" onClick={() => submitEntry(entry.id)}>
                                                                                    <Send className="h-3 w-3" />
                                                                                    Отправить
                                                                                </Button>
                                                                            )}
                                                                            {canDelete && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="destructive"
                                                                                    onClick={() => deleteEntry(entry.id)}
                                                                                    title="Удалить"
                                                                                >
                                                                                    <Trash2 className="h-3 w-3" />
                                                                                </Button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {entryLinks.length > 3 && (
                                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 sm:px-6">
                                        {entryLinks.map((link, index) => (
                                            <Button
                                                key={index}
                                                type="button"
                                                size="sm"
                                                variant={link.active ? 'default' : 'outline'}
                                                disabled={!link.url || link.active}
                                                onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                            >
                                                <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
