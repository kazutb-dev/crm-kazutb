import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router, useForm } from '@inertiajs/react';
import {
    BarChart3,
    BookOpen,
    CircleAlert,
    FileUp,
    FlaskConical,
    GraduationCap,
    MessageSquareText,
    NotebookPen,
    Send,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const sectionLabels = {
    teaching: 'Учебная деятельность',
    science: 'Научная деятельность',
    social: 'Общественная деятельность',
    qualification: 'Повышение квалификации',
    survey: 'Опросные показатели',
};

const sectionIcons = {
    teaching: GraduationCap,
    science: FlaskConical,
    social: Sparkles,
    qualification: ShieldCheck,
    survey: MessageSquareText,
};

const stageLabels = {
    plan: 'План',
    fact: 'Факт',
    review: 'Рассмотрение',
};

const statusLabels = {
    draft: 'Черновик',
    submitted: 'На рассмотрении у завкафедры',
    returned: 'Возвращено',
    reviewed: 'Проверено',
    pending_dean: 'На рассмотрении декана',
    pending_structural: 'На рассмотрении структурного подразделения',
    approved: 'Утверждено',
    rejected: 'Отклонено',
    locked: 'Заблокировано',
    mixed: 'Смешанный статус',
};

const statusVariants = {
    draft: 'outline',
    submitted: 'secondary',
    returned: 'secondary',
    reviewed: 'secondary',
    pending_dean: 'secondary',
    pending_structural: 'secondary',
    approved: 'default',
    rejected: 'destructive',
    locked: 'destructive',
    mixed: 'outline',
};

function toEditableRows(rows) {
    return rows.map((row) => ({
        entry_id: row.entry_id ?? null,
        indicator_id: row.indicator_id,
        entity_type: row.entity_type,
        section: row.section,
        code: row.code,
        name: row.name,
        unit: row.unit ?? '',
        requires_file: Boolean(row.requires_file),
        plan_value: row.plan_value ?? '',
        fact_value: row.fact_value ?? '',
        calculated_points: row.calculated_points ?? '0.00',
        manual_points: row.manual_points ?? '',
        comment: row.comment ?? '',
        status: row.status ?? 'draft',
        files: row.files ?? [],
    }));
}

function normalizeNumeric(value) {
    return value === '' || value === null || value === undefined ? null : value;
}

function resolvePoints(row) {
    const raw = row.manual_points || row.calculated_points || 0;
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed : 0;
}

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

function buildPayloadRows(rows, mode) {
    return rows.map((row) => ({
        indicator_id: row.indicator_id,
        entity_type: row.entity_type,
        faculty_id: null,
        department_id: null,
        plan_value: mode === 'plan' ? normalizeNumeric(row.plan_value) : null,
        fact_value: mode === 'fact' ? normalizeNumeric(row.fact_value) : null,
        manual_points: normalizeNumeric(row.manual_points),
        comment: row.comment || null,
    }));
}

export default function TeacherForm({
    period = null,
    rows = [],
    overallStatus = 'draft',
    stageOptions = ['plan', 'fact', 'review'],
    filters = {},
}) {
    const [uploadingEntryId, setUploadingEntryId] = useState(null);
    const [localRows, setLocalRows] = useState(() => toEditableRows(rows));
    const entryForm = useForm({
        entries: buildPayloadRows(toEditableRows(rows), period?.stage ?? 'plan'),
    });

    useEffect(() => {
        const nextRows = toEditableRows(rows);
        setLocalRows(nextRows);
        entryForm.setData('entries', buildPayloadRows(nextRows, period?.stage ?? 'plan'));
    }, [rows, period?.stage]);

    const groupedSections = useMemo(() => {
        return localRows.reduce((accumulator, row) => {
            if (!accumulator[row.section]) {
                accumulator[row.section] = [];
            }

            accumulator[row.section].push(row);
            return accumulator;
        }, {});
    }, [localRows]);

    const sectionKeys = ['teaching', 'science', 'social', 'qualification', 'survey'].filter(
        (section) => groupedSections[section]?.length,
    );

    const totalPoints = useMemo(
        () => localRows.reduce((sum, row) => sum + resolvePoints(row), 0),
        [localRows],
    );

    const isPlanStage = period?.stage === 'plan';
    const isFactStage = period?.stage === 'fact';
    const isReviewStage = period?.stage === 'review';

    const handleStageSwitch = (stage) => {
        router.get(route('kpi.my-form'), {
            stage,
            academic_year_id: filters.academic_year_id ?? undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const updateRow = (indicatorId, field, value) => {
        setLocalRows((currentRows) => {
            const nextRows = currentRows.map((row) => (
                row.indicator_id === indicatorId ? { ...row, [field]: value } : row
            ));

            entryForm.setData('entries', buildPayloadRows(nextRows, period?.stage ?? 'plan'));

            return nextRows;
        });
    };

    const saveEntries = () => {
        if (!period) {
            return;
        }

        const routeName = isPlanStage ? 'kpi.entries.save-plan' : 'kpi.entries.save-fact';

        entryForm.post(route(routeName, period.id), {
            preserveScroll: true,
        });
    };

    const submitEntries = () => {
        if (!period) {
            return;
        }

        router.post(route('kpi.entries.submit', period.id), {
            entity_type: 'teacher',
        }, {
            preserveScroll: true,
        });
    };

    const uploadFile = (entryId, file) => {
        if (!entryId || !file) {
            return;
        }

        setUploadingEntryId(entryId);

        router.post(route('kpi.entries.files.store', entryId), {
            file,
        }, {
            preserveScroll: true,
            forceFormData: true,
            onFinish: () => setUploadingEntryId(null),
        });
    };

    const isRowReadOnly = (row) => row.status === 'approved' || row.status === 'locked' || isReviewStage;
    const canEditPlan = (row) => isPlanStage && !isRowReadOnly(row);
    const canEditFact = (row) => isFactStage && !isRowReadOnly(row);
    const canSubmit = Boolean(period) && (isPlanStage || isFactStage) && !entryForm.processing;

    return (
        <AuthenticatedLayout
            headerRight={
                <div className="flex items-center gap-2">
                    {stageOptions.map((stage) => (
                        <Button
                            key={stage}
                            type="button"
                            size="sm"
                            variant={period?.stage === stage ? 'default' : 'outline'}
                            onClick={() => handleStageSwitch(stage)}
                        >
                            {stageLabels[stage] ?? stage}
                        </Button>
                    ))}
                </div>
            }
        >
            <Head title="Моя KPI-форма" />

            <div className="admin-page-wrap">
                <Card className="border-0 bg-gradient-to-r from-sky-50 via-white to-emerald-50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <BarChart3 className="h-5 w-5" />
                            KPI-форма преподавателя
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <p>
                                Заполняйте показатели по разделам. В стадии <strong>plan</strong> доступно только плановое значение.
                                В стадии <strong>fact</strong> доступны фактическое значение и подтверждающий файл.
                            </p>
                            {period ? (
                                <p>
                                    Период: <span className="font-medium text-foreground">{period.name}</span>. Окно подачи:{' '}
                                    {formatDate(period.start_date)} - {formatDate(period.end_date)}.
                                </p>
                            ) : (
                                <p>Активный KPI-период для выбранной стадии сейчас не открыт.</p>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                            <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Этап</p>
                                <p className="mt-2 text-lg font-semibold">{stageLabels[period?.stage] ?? '—'}</p>
                            </div>
                            <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Общий статус</p>
                                <div className="mt-2">
                                    <Badge variant={statusVariants[overallStatus] ?? 'outline'}>
                                        {statusLabels[overallStatus] ?? overallStatus}
                                    </Badge>
                                </div>
                            </div>
                            <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Сумма баллов</p>
                                <p className="mt-2 text-lg font-semibold">{totalPoints.toFixed(2)}</p>
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
                        {sectionKeys.map((section) => {
                            const Icon = sectionIcons[section] ?? NotebookPen;
                            const sectionRows = groupedSections[section] ?? [];
                            const sectionTotal = sectionRows.reduce((sum, row) => sum + resolvePoints(row), 0);

                            return (
                                <Card key={section}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center justify-between gap-3 text-base">
                                            <span className="flex items-center gap-2">
                                                <Icon className="h-4 w-4" />
                                                {sectionLabels[section] ?? section}
                                            </span>
                                            <Badge variant="outline">Итог: {sectionTotal.toFixed(2)}</Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[1200px] text-sm">
                                                <thead>
                                                    <tr className="border-b text-left text-muted-foreground">
                                                        <th className="py-3 pe-3 font-medium">Показатель</th>
                                                        <th className="py-3 pe-3 font-medium">План</th>
                                                        <th className="py-3 pe-3 font-medium">Факт</th>
                                                        <th className="py-3 pe-3 font-medium">Баллы</th>
                                                        <th className="py-3 pe-3 font-medium">Комментарий</th>
                                                        <th className="py-3 pe-3 font-medium">Файл</th>
                                                        <th className="py-3 pe-3 font-medium">Статус</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sectionRows.map((row) => (
                                                        <tr key={row.indicator_id} className="border-b align-top last:border-0">
                                                            <td className="py-4 pe-3">
                                                                <div className="font-medium">{row.name}</div>
                                                                <div className="mt-1 text-xs text-muted-foreground">
                                                                    Код: {row.code}{row.unit ? ` • Ед.: ${row.unit}` : ''}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 pe-3">
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    min="0"
                                                                    value={row.plan_value ?? ''}
                                                                    disabled={!canEditPlan(row)}
                                                                    onChange={(event) => updateRow(row.indicator_id, 'plan_value', event.target.value)}
                                                                    placeholder="0"
                                                                />
                                                            </td>
                                                            <td className="py-4 pe-3">
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    min="0"
                                                                    value={row.fact_value ?? ''}
                                                                    disabled={!canEditFact(row)}
                                                                    onChange={(event) => updateRow(row.indicator_id, 'fact_value', event.target.value)}
                                                                    placeholder="0"
                                                                />
                                                            </td>
                                                            <td className="py-4 pe-3">
                                                                <div className="rounded-md border bg-muted/40 px-3 py-2 font-medium">
                                                                    {resolvePoints(row).toFixed(2)}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 pe-3">
                                                                <textarea
                                                                    className="min-h-20 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm"
                                                                    value={row.comment ?? ''}
                                                                    disabled
                                                                    readOnly
                                                                />
                                                            </td>
                                                            <td className="py-4 pe-3">
                                                                <div className="space-y-2">
                                                                    {row.files.length > 0 ? (
                                                                        row.files.map((file) => (
                                                                            <a
                                                                                key={file.id}
                                                                                href={file.file_url}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="block text-sm text-primary underline-offset-4 hover:underline"
                                                                            >
                                                                                {file.file_name}
                                                                            </a>
                                                                        ))
                                                                    ) : (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {row.requires_file ? 'Файл обязателен на стадии fact.' : 'Файл не требуется.'}
                                                                        </p>
                                                                    )}

                                                                    {row.requires_file && isFactStage && canEditFact(row) && (
                                                                        row.entry_id ? (
                                                                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
                                                                                <FileUp className="h-4 w-4" />
                                                                                <span>{uploadingEntryId === row.entry_id ? 'Загрузка...' : 'Загрузить файл'}</span>
                                                                                <input
                                                                                    type="file"
                                                                                    className="hidden"
                                                                                    disabled={uploadingEntryId === row.entry_id}
                                                                                    onChange={(event) => {
                                                                                        const file = event.target.files?.[0];
                                                                                        if (file) {
                                                                                            uploadFile(row.entry_id, file);
                                                                                        }
                                                                                        event.target.value = '';
                                                                                    }}
                                                                                />
                                                                            </label>
                                                                        ) : (
                                                                            <p className="text-xs text-amber-700">Сначала сохраните факт, затем загрузите файл.</p>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 pe-3">
                                                                <Badge variant={statusVariants[row.status] ?? 'outline'}>
                                                                    {statusLabels[row.status] ?? row.status}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}

                        <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-medium">Общий статус отправки: {statusLabels[overallStatus] ?? overallStatus}</p>
                                <p className="text-sm text-muted-foreground">
                                    {isPlanStage && 'Сейчас редактируются только плановые значения.'}
                                    {isFactStage && 'Сейчас редактируются фактические значения и подтверждающие файлы.'}
                                    {isReviewStage && 'Период в review: форма доступна только для просмотра.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(isPlanStage || isFactStage) && (
                                    <Button type="button" variant="outline" onClick={saveEntries} disabled={!period || entryForm.processing}>
                                        Сохранить
                                    </Button>
                                )}
                                <Button type="button" onClick={submitEntries} disabled={!canSubmit || isReviewStage}>
                                    <Send className="h-4 w-4" />
                                    Отправить
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
