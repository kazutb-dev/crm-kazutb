import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router, useForm } from '@inertiajs/react';
import {
    BarChart3,
    CircleAlert,
    FileUp,
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

const statusVariants = {
    draft: 'outline',
    submitted: 'secondary',
    returned: 'secondary',
    reviewed: 'secondary',
    approved: 'default',
    rejected: 'destructive',
    locked: 'destructive',
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
            headerRight={
                <div className="flex items-center gap-2">
                    {stageOptions.map((s) => (
                        <Button
                            key={s}
                            type="button"
                            size="sm"
                            variant={stage === s ? 'default' : 'outline'}
                            onClick={() => handleStageSwitch(s)}
                        >
                            {stageLabels[s] ?? s}
                        </Button>
                    ))}
                </div>
            }
        >
            <Head title="KPI — Структурные подразделения" />

            <div className="admin-page-wrap">

                {/* Header card */}
                <Card className="border-0 bg-gradient-to-r from-indigo-50 via-white to-sky-50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <BarChart3 className="h-5 w-5" />
                            KPI — Структурные подразделения
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                        <div className="space-y-2 text-sm text-muted-foreground">
                            {period ? (
                                <p>
                                    Период: <strong className="text-foreground">{period.name}</strong>. Окно подачи:{' '}
                                    {formatDate(period.start_date)} – {formatDate(period.end_date)}.
                                </p>
                            ) : (
                                <p>Активный KPI-период для выбранной стадии сейчас не открыт.</p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                            <div className="rounded-xl border bg-white/80 p-3 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Этап</p>
                                <p className="mt-1 font-semibold">{stageLabels[stage] ?? '—'}</p>
                            </div>
                            <div className="rounded-xl border bg-white/80 p-3 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Сумма баллов</p>
                                <p className="mt-1 font-semibold">{Number(summary.total_points ?? 0).toFixed(2)}</p>
                            </div>
                            <div className="rounded-xl border bg-white/80 p-3 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Черновики</p>
                                <p className="mt-1 font-semibold">{summary.draft_entries ?? 0}</p>
                            </div>
                            <div className="rounded-xl border bg-white/80 p-3 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Отправлено</p>
                                <p className="mt-1 font-semibold">{summary.submitted_entries ?? 0}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {!period ? (
                    <Card>
                        <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 py-10 text-center">
                            <CircleAlert className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Нет активного периода</p>
                                <p className="text-sm text-muted-foreground">Дождитесь открытия периода администратором или переключите этап выше.</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Filters + Add button */}
                        <div className="flex flex-wrap items-center gap-3">
                            {modules.length > 0 && (
                                <select
                                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={filters.module ?? ''}
                                    onChange={(e) => handleFilterChange('module', e.target.value)}
                                >
                                    <option value="">Все разделы</option>
                                    {modules.map((m) => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            )}
                            {statusOptions.length > 0 && (
                                <select
                                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={filters.status ?? ''}
                                    onChange={(e) => handleFilterChange('status', e.target.value)}
                                >
                                    <option value="">Все статусы</option>
                                    {statusOptions.map((s) => (
                                        <option key={s} value={s}>{statusLabels[s] ?? s}</option>
                                    ))}
                                </select>
                            )}
                            <div className="ml-auto">
                                {isEditable && !showAddForm && (
                                    <Button type="button" onClick={() => setShowAddForm(true)} size="sm">
                                        <Plus className="h-4 w-4" />
                                        Добавить показатель
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Add form */}
                        {showAddForm && isEditable && (
                            <Card className="border-dashed">
                                <CardHeader>
                                    <CardTitle className="text-base">Новая KPI-запись</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Показатель</label>
                                        <select
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                                        {addForm.errors.indicator_id && (
                                            <p className="mt-1 text-xs text-destructive">{addForm.errors.indicator_id}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">
                                            {isPlanStage ? 'Плановое значение' : 'Фактическое значение'}
                                        </label>
                                        <Input
                                            type="number"
                                            step="1"
                                            min="0"
                                            value={addForm.data.value}
                                            onChange={(e) => addForm.setData('value', e.target.value)}
                                            placeholder="0"
                                        />
                                        {addForm.errors.value && (
                                            <p className="mt-1 text-xs text-destructive">{addForm.errors.value}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Комментарий</label>
                                        <textarea
                                            className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={addForm.data.comment}
                                            onChange={(e) => addForm.setData('comment', e.target.value)}
                                            placeholder="Необязательно"
                                        />
                                    </div>
                                    <div className="flex gap-2">
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
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => { setShowAddForm(false); addForm.reset(); }}
                                        >
                                            <X className="h-4 w-4" />
                                            Отмена
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Entries table */}
                        <Card>
                            <CardContent className="pt-6">
                                {entryData.length === 0 ? (
                                    <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                                        <CircleAlert className="h-6 w-6" />
                                        <p className="text-sm">Нет записей. Добавьте показатель с помощью кнопки выше.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[900px] text-sm">
                                            <thead>
                                                <tr className="border-b text-left text-muted-foreground">
                                                    <th className="pb-3 pe-3 font-medium">Показатель</th>
                                                    <th className="pb-3 pe-3 font-medium">Раздел</th>
                                                    <th className="pb-3 pe-3 font-medium">План</th>
                                                    <th className="pb-3 pe-3 font-medium">Факт</th>
                                                    <th className="pb-3 pe-3 font-medium">Баллы</th>
                                                    <th className="pb-3 pe-3 font-medium">Файл</th>
                                                    <th className="pb-3 pe-3 font-medium">Статус</th>
                                                    <th className="pb-3 font-medium">Действия</th>
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
                                                        <tr key={entry.id} className="border-b align-top last:border-0">
                                                            <td className="py-3 pe-3">
                                                                <div className="font-medium">{indicator.name ?? '—'}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {indicator.code}{indicator.unit ? ` · ${indicator.unit}` : ''}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 pe-3 text-muted-foreground">{indicator.section ?? '—'}</td>
                                                            <td className="py-3 pe-3">
                                                                {isEditing && isPlanStage ? (
                                                                    <Input
                                                                        type="number"
                                                                        step="1"
                                                                        min="0"
                                                                        value={editForm.data.value}
                                                                        onChange={(e) => editForm.setData('value', e.target.value)}
                                                                        className="w-24"
                                                                    />
                                                                ) : (
                                                                    entry.plan_value ?? '—'
                                                                )}
                                                            </td>
                                                            <td className="py-3 pe-3">
                                                                {isEditing && isFactStage ? (
                                                                    <Input
                                                                        type="number"
                                                                        step="1"
                                                                        min="0"
                                                                        value={editForm.data.value}
                                                                        onChange={(e) => editForm.setData('value', e.target.value)}
                                                                        className="w-24"
                                                                    />
                                                                ) : (
                                                                    entry.fact_value ?? '—'
                                                                )}
                                                            </td>
                                                            <td className="py-3 pe-3 font-medium">
                                                                {Number.isFinite(points) ? points.toFixed(2) : '0.00'}
                                                            </td>
                                                            <td className="py-3 pe-3">
                                                                {files.length > 0 ? (
                                                                    files.map((file) => (
                                                                        <a
                                                                            key={file.id}
                                                                            href={file.file_url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="block text-xs text-primary hover:underline"
                                                                        >
                                                                            {file.file_name}
                                                                        </a>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {indicator.requires_file ? 'Файл обязателен' : '—'}
                                                                    </span>
                                                                )}
                                                                {indicator.requires_file && isFactStage && canEdit && entry.id && (
                                                                    <label className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/40">
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
                                                            <td className="py-3 pe-3">
                                                                <Badge variant={statusVariants[entry.status] ?? 'outline'}>
                                                                    {statusLabels[entry.status] ?? entry.status}
                                                                </Badge>
                                                                {entry.comment && (
                                                                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">{entry.comment}</p>
                                                                )}
                                                            </td>
                                                            <td className="py-3">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {isEditing ? (
                                                                        <>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                disabled={editForm.processing}
                                                                                onClick={() => saveEdit(entry.id)}
                                                                            >
                                                                                Сохранить
                                                                            </Button>
                                                                            <Button size="sm" variant="ghost" onClick={cancelEdit}>
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

                                {/* Pagination */}
                                {entryLinks.length > 3 && (
                                    <div className="mt-4 flex flex-wrap justify-center gap-1">
                                        {entryLinks.map((link, index) => (
                                            <button
                                                key={index}
                                                disabled={!link.url || link.active}
                                                onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                                className={`rounded-md px-3 py-1 text-sm ${link.active
                                                    ? 'bg-primary text-primary-foreground'
                                                    : link.url
                                                        ? 'border hover:bg-muted'
                                                        : 'cursor-default text-muted-foreground'
                                                    }`}
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
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
