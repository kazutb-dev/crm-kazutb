import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { LoaderCircle, Paperclip, Plus, Send, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';

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

const stageLabels = {
    plan: 'План',
    fact: 'Факт',
    review: 'Рассмотрение',
};

function formatDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
}

function formatScore(value) {
    const parsed = Number(value ?? 0);

    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

function formatFileSize(value) {
    const parsed = Number(value ?? 0);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return '0 Б';
    }

    if (parsed >= 1024 * 1024) {
        return `${(parsed / (1024 * 1024)).toFixed(2)} МБ`;
    }

    if (parsed >= 1024) {
        return `${(parsed / 1024).toFixed(1)} КБ`;
    }

    return `${parsed} Б`;
}

export default function TeacherDashboard({
    period = null,
    summary = {},
    entries,
    indicators = [],
    modules = [],
    groupCodesByModule = {},
    filters = {},
    statusOptions = [],
}) {
    const { flash, errors } = usePage().props;
    const items = entries?.data ?? [];
    const links = entries?.links ?? [];

    const [createOpen, setCreateOpen] = useState(false);
    const [uploadingEntryId, setUploadingEntryId] = useState(null);
    const [createFileName, setCreateFileName] = useState('');

    const filterForm = useForm({
        stage: filters.stage ?? 'plan',
        status: filters.status ?? '',
        module: filters.module ?? '',
        group_code: filters.group_code ?? '',
    });

    const createForm = useForm({
        stage: filters.stage ?? 'plan',
        module: modules[0]?.value ?? '',
        group_code: '',
        indicator_id: '',
        value: '',
        comment: '',
        external_source_url: '',
        file: null,
        action: 'draft',
    });

    const moduleOptions = modules;
    const currentCreateModule = createForm.data.module;
    const createGroupOptions = useMemo(
        () => groupCodesByModule[currentCreateModule] ?? [],
        [groupCodesByModule, currentCreateModule],
    );

    const indicatorOptions = useMemo(() => {
        return indicators.filter((indicator) => {
            const matchesModule = createForm.data.module === '' || indicator.section === createForm.data.module;
            const matchesGroup = createForm.data.group_code === '' || indicator.group_code === createForm.data.group_code;

            return matchesModule && matchesGroup;
        });
    }, [indicators, createForm.data.module, createForm.data.group_code]);

    const selectedIndicator = useMemo(
        () => indicatorOptions.find((indicator) => String(indicator.id) === String(createForm.data.indicator_id)) ?? null,
        [indicatorOptions, createForm.data.indicator_id],
    );

    const applyFilters = (event) => {
        event.preventDefault();

        router.get(route('kpi.my-form'), {
            stage: filterForm.data.stage || undefined,
            status: filterForm.data.status || undefined,
            module: filterForm.data.module || undefined,
            group_code: filterForm.data.group_code || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        filterForm.setData({
            stage: 'plan',
            status: '',
            module: '',
            group_code: '',
        });

        router.get(route('kpi.my-form'), { stage: 'plan' }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitCreate = (event, action) => {
        event.preventDefault();

        createForm.setData('action', action);

        createForm.post(route('kpi.my-entries.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                if (action === 'draft') {
                    createForm.reset('indicator_id', 'value', 'comment', 'external_source_url', 'file');
                    setCreateFileName('');
                }

                if (action === 'submit') {
                    setCreateOpen(false);
                    createForm.reset();
                    setCreateFileName('');
                }
            },
        });
    };

    const submitEntry = (entryId) => {
        router.post(route('kpi.my-entries.submit', entryId), {}, {
            preserveScroll: true,
        });
    };

    const deleteEntry = (entry) => {
        if (!window.confirm(`Удалить запись ${entry.indicator?.code ?? ''}?`)) {
            return;
        }

        router.delete(route('kpi.my-entries.destroy', entry.id), {
            preserveScroll: true,
        });
    };

    const uploadFile = (entry, file) => {
        if (!file) {
            return;
        }

        setUploadingEntryId(entry.id);

        router.post(route('kpi.entries.files.store', entry.id), {
            file,
        }, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => {
                setUploadingEntryId(null);
            },
        });
    };

    const isEditableEntry = (entry) => entry.status === 'draft' || entry.status === 'returned';

    const isFileMissing = (entry) => {
        if (!entry.indicator?.requires_file) {
            return false;
        }

        return (entry.files?.length ?? 0) === 0;
    };

    return (
        <AuthenticatedLayout
            headerRight={
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="h-4 w-4" />
                            Создать запись
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Новая KPI-запись</DialogTitle>
                            <DialogDescription>
                                Выберите модуль, код блока и конкретный код показателя, затем сохраните как черновик или сразу отправьте на проверку.
                            </DialogDescription>
                        </DialogHeader>

                        <form className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Этап</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                        value={createForm.data.stage}
                                        onChange={(event) => createForm.setData('stage', event.target.value)}
                                    >
                                        <option value="plan">План</option>
                                        <option value="fact">Факт</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Модуль</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                        value={createForm.data.module}
                                        onChange={(event) => {
                                            createForm.setData('module', event.target.value);
                                            createForm.setData('group_code', '');
                                            createForm.setData('indicator_id', '');
                                        }}
                                    >
                                        <option value="">Выберите модуль</option>
                                        {moduleOptions.map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Код блока</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                        value={createForm.data.group_code}
                                        onChange={(event) => {
                                            createForm.setData('group_code', event.target.value);
                                            createForm.setData('indicator_id', '');
                                        }}
                                    >
                                        <option value="">Выберите код блока</option>
                                        {createGroupOptions.map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Код показателя</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                        value={createForm.data.indicator_id}
                                        onChange={(event) => createForm.setData('indicator_id', event.target.value)}
                                    >
                                        <option value="">Выберите код</option>
                                        {indicatorOptions.map((indicator) => (
                                            <option key={indicator.id} value={indicator.id}>
                                                {indicator.code} — {indicator.name}
                                            </option>
                                        ))}
                                    </select>
                                    {createForm.errors.indicator_id && <p className="text-sm text-destructive">{createForm.errors.indicator_id}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Значение</label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={createForm.data.value}
                                            onChange={(event) => createForm.setData('value', event.target.value)}
                                        />
                                        <span className="shrink-0 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                            {selectedIndicator?.unit || 'без ед.'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Единица измерения: <span className="font-medium text-foreground">{selectedIndicator?.unit || 'не указана'}</span>
                                    </p>
                                    {createForm.errors.value && <p className="text-sm text-destructive">{createForm.errors.value}</p>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Комментарий</label>
                                <textarea
                                    className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                                    value={createForm.data.comment}
                                    onChange={(event) => createForm.setData('comment', event.target.value)}
                                    placeholder="Комментарий к записи"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Ссылка на внешний источник</label>
                                    <Input
                                        type="url"
                                        value={createForm.data.external_source_url}
                                        onChange={(event) => createForm.setData('external_source_url', event.target.value)}
                                        placeholder="https://example.com/source"
                                    />
                                    {createForm.errors.external_source_url && (
                                        <p className="text-sm text-destructive">{createForm.errors.external_source_url}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Файл подтверждения</label>
                                    <label className="flex h-10 cursor-pointer items-center justify-between rounded-md border border-input px-3 text-sm shadow-sm">
                                        <span className="truncate text-muted-foreground">
                                            {createFileName || 'Выберите файл (до 10 МБ)'}
                                        </span>
                                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={(event) => {
                                                const file = event.target.files?.[0] ?? null;
                                                createForm.setData('file', file);
                                                setCreateFileName(file?.name ?? '');
                                            }}
                                        />
                                    </label>
                                    {createForm.errors.file && <p className="text-sm text-destructive">{createForm.errors.file}</p>}
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Файл можно прикрепить сразу при создании записи.
                                {selectedIndicator?.requires_file ? ' Для выбранного показателя файл обязателен.' : ''}
                            </p>

                            <DialogFooter className="gap-2">
                                <Button type="button" variant="outline" onClick={(event) => submitCreate(event, 'draft')} disabled={createForm.processing}>
                                    Сохранить как черновик
                                </Button>
                                <Button type="button" onClick={(event) => submitCreate(event, 'submit')} disabled={createForm.processing}>
                                    <Send className="h-4 w-4" />
                                    Отправить на проверку
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            }
        >
            <Head title="Моя KPI-форма" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <Card className="border-0 bg-gradient-to-r from-sky-50 via-white to-emerald-50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-xl">KPI dashboard преподавателя</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Мои баллы</p>
                            <p className="mt-2 text-2xl font-semibold">{formatScore(summary.total_points)}</p>
                        </div>
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Всего записей</p>
                            <p className="mt-2 text-2xl font-semibold">{summary.total_entries ?? 0}</p>
                        </div>
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Черновики</p>
                            <p className="mt-2 text-2xl font-semibold">{summary.draft_entries ?? 0}</p>
                        </div>
                        <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Отправлено</p>
                            <p className="mt-2 text-2xl font-semibold">{summary.submitted_entries ?? 0}</p>
                        </div>
                    </CardContent>
                </Card>

                {period && (
                    <Card>
                        <CardContent className="pt-6 text-sm text-muted-foreground">
                            Период: <span className="font-medium text-foreground">{period.name}</span>. Этап:{' '}
                            <span className="font-medium text-foreground">{stageLabels[period.stage] ?? period.stage}</span>. Окно подачи:{' '}
                            {formatDate(period.start_date)} - {formatDate(period.end_date)}.
                        </CardContent>
                    </Card>
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
                        <CardTitle className="text-base">Фильтры записей</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="grid gap-4 md:grid-cols-4" onSubmit={applyFilters}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Этап</label>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                    value={filterForm.data.stage}
                                    onChange={(event) => filterForm.setData('stage', event.target.value)}
                                >
                                    <option value="plan">План</option>
                                    <option value="fact">Факт</option>
                                    <option value="review">Рассмотрение</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Модуль</label>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                    value={filterForm.data.module}
                                    onChange={(event) => filterForm.setData('module', event.target.value)}
                                >
                                    <option value="">Все</option>
                                    {modules.map((module) => (
                                        <option key={module.value} value={module.value}>{module.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Код блока</label>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                    value={filterForm.data.group_code}
                                    onChange={(event) => filterForm.setData('group_code', event.target.value)}
                                >
                                    <option value="">Все</option>
                                    {(groupCodesByModule[filterForm.data.module] ?? [])
                                        .map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Статус</label>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                    value={filterForm.data.status}
                                    onChange={(event) => filterForm.setData('status', event.target.value)}
                                >
                                    <option value="">Все</option>
                                    {statusOptions.map((status) => (
                                        <option key={status} value={status}>{statusLabels[status] ?? status}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-4 flex flex-wrap gap-2">
                                <Button type="submit">Применить</Button>
                                <Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Мои записи</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Записей пока нет. Создайте первую KPI-запись.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1100px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-3 pe-3 font-medium">Код</th>
                                            <th className="py-3 pe-3 font-medium">Показатель</th>
                                            <th className="py-3 pe-3 font-medium">План</th>
                                            <th className="py-3 pe-3 font-medium">Факт</th>
                                            <th className="py-3 pe-3 font-medium">Источник</th>
                                            <th className="py-3 pe-3 font-medium">Файлы</th>
                                            <th className="py-3 pe-3 font-medium">Баллы</th>
                                            <th className="py-3 pe-3 font-medium">Статус</th>
                                            <th className="py-3 text-right font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((entry) => (
                                            <tr key={entry.id} className="border-b align-top last:border-0">
                                                <td className="py-3 pe-3 font-mono">{entry.indicator?.code ?? '—'}</td>
                                                <td className="py-3 pe-3">
                                                    <div className="font-medium">{entry.indicator?.name ?? '—'}</div>
                                                    <div className="text-xs text-muted-foreground">{entry.indicator?.section ?? '—'}</div>
                                                </td>
                                                <td className="py-3 pe-3">{entry.plan_value ?? '—'}</td>
                                                <td className="py-3 pe-3">{entry.fact_value ?? '—'}</td>
                                                <td className="py-3 pe-3">
                                                    {entry.external_source_url ? (
                                                        <a
                                                            href={entry.external_source_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-xs text-sky-700 underline-offset-2 hover:underline"
                                                        >
                                                            Открыть
                                                        </a>
                                                    ) : '—'}
                                                </td>
                                                <td className="py-3 pe-3">
                                                    <div className="space-y-2">
                                                        {(entry.files?.length ?? 0) > 0 ? (
                                                            <div className="space-y-1">
                                                                {entry.files.map((file) => (
                                                                    <a
                                                                        key={file.id}
                                                                        href={file.file_url}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="flex items-center gap-2 text-xs text-sky-700 underline-offset-2 hover:underline"
                                                                    >
                                                                        <Paperclip className="h-3.5 w-3.5" />
                                                                        <span className="max-w-[220px] truncate">{file.file_name}</span>
                                                                        <span className="text-muted-foreground">({formatFileSize(file.file_size)})</span>
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground">
                                                                {entry.indicator?.requires_file ? 'Файл обязателен' : 'Файлы не прикреплены'}
                                                            </p>
                                                        )}

                                                        {isEditableEntry(entry) && (
                                                            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-sky-700">
                                                                {uploadingEntryId === entry.id ? (
                                                                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <Upload className="h-3.5 w-3.5" />
                                                                )}
                                                                <span>Загрузить файл</span>
                                                                <input
                                                                    type="file"
                                                                    className="hidden"
                                                                    disabled={uploadingEntryId === entry.id}
                                                                    onChange={(event) => {
                                                                        const file = event.target.files?.[0] ?? null;

                                                                        uploadFile(entry, file);
                                                                        event.target.value = '';
                                                                    }}
                                                                />
                                                            </label>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 pe-3">{formatScore(entry.manual_points ?? entry.calculated_points)}</td>
                                                <td className="py-3 pe-3">
                                                    <Badge variant={statusVariants[entry.status] ?? 'outline'}>
                                                        {statusLabels[entry.status] ?? entry.status}
                                                    </Badge>
                                                    {isFileMissing(entry) && (
                                                        <p className="mt-2 text-xs text-amber-700">Нужен подтверждающий файл</p>
                                                    )}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button asChild size="sm" variant="outline">
                                                            <Link href={route('kpi.entries.show', entry.id)}>Открыть</Link>
                                                        </Button>

                                                        {isEditableEntry(entry) && (
                                                            <Button size="sm" onClick={() => submitEntry(entry.id)} disabled={isFileMissing(entry)}>
                                                                <Send className="h-4 w-4" />
                                                                Отправить
                                                            </Button>
                                                        )}

                                                        {entry.status !== 'approved' && (
                                                            <Button size="sm" variant="destructive" onClick={() => deleteEntry(entry)}>
                                                                <Trash2 className="h-4 w-4" />
                                                                Удалить
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {links.length > 3 && (
                            <div className="mt-6 flex flex-wrap gap-2">
                                {links.map((link, index) => (
                                    <Button
                                        key={`${link.label}-${index}`}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                        asChild={Boolean(link.url)}
                                    >
                                        {link.url ? (
                                            <Link href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} />
                                        ) : (
                                            <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                        )}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
