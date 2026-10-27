import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, Notice, PageHeader, Segmented, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router, useForm } from '@inertiajs/react';
import {
    BarChart3,
    BookOpen,
    CalendarRange,
    CircleAlert,
    FileUp,
    Flag,
    Paperclip,
    Save,
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
    submitted: 'info',
    returned: 'warning',
    reviewed: 'secondary',
    pending_dean: 'info',
    pending_structural: 'default',
    approved: 'success',
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

    const stageItems = stageOptions.map((stage) => ({ key: stage, label: stageLabels[stage] ?? stage }));

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Преподаватель"
                    title="KPI-форма преподавателя"
                    description={(
                        <>
                            Заполняйте показатели по разделам. В стадии <strong>plan</strong> доступно только плановое значение,
                            в стадии <strong>fact</strong> — фактическое значение и подтверждающий файл.
                        </>
                    )}
                    actions={(
                        <Segmented items={stageItems} value={period?.stage} onChange={handleStageSwitch} />
                    )}
                />
            )}
        >
            <Head title="Моя KPI-форма" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Этап" value={stageLabels[period?.stage] ?? '—'} tone="teal" icon={Flag} />
                    <StatTile
                        label="Общий статус"
                        value={(
                            <Badge variant={statusVariants[overallStatus] ?? 'outline'} className="font-sans">
                                {statusLabels[overallStatus] ?? overallStatus}
                            </Badge>
                        )}
                        tone="info"
                        icon={ShieldCheck}
                    />
                    <StatTile
                        label="Окно подачи"
                        value={period ? <span className="block text-base sm:text-xl">{formatDate(period.start_date)}</span> : '—'}
                        hint={period ? `${period.name} · до ${formatDate(period.end_date)}` : 'Активный период не открыт'}
                        tone="navy"
                        icon={CalendarRange}
                    />
                    <StatTile label="Сумма баллов" value={totalPoints.toFixed(2)} tone="gold" icon={BarChart3} />
                </StatGrid>

                {!period ? (
                    <EmptyState
                        title="Нет активного периода"
                        description="Активный KPI-период для выбранной стадии сейчас не открыт. Дождитесь открытия периода администратором или переключите этап в шапке страницы."
                    />
                ) : (
                    <>
                        <Notice tone="brand" title={`Период: ${period.name}`}>
                            Окно подачи: {formatDate(period.start_date)} - {formatDate(period.end_date)}.
                        </Notice>

                        {sectionKeys.map((section) => {
                            const Icon = sectionIcons[section] ?? NotebookPen;
                            const sectionRows = groupedSections[section] ?? [];
                            const sectionTotal = sectionRows.reduce((sum, row) => sum + resolvePoints(row), 0);

                            return (
                                <Card key={section}>
                                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                                        <CardTitle className="flex items-center gap-2">
                                            <Icon />
                                            {sectionLabels[section] ?? section}
                                        </CardTitle>
                                        <Badge variant="default" className="tabular-nums">Итог: {sectionTotal.toFixed(2)}</Badge>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[1200px] text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-200 text-left">
                                                        <th>Показатель</th>
                                                        <th className="w-32">План</th>
                                                        <th className="w-32">Факт</th>
                                                        <th className="w-28 text-right">Баллы</th>
                                                        <th>Комментарий</th>
                                                        <th>Файл</th>
                                                        <th>Статус</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sectionRows.map((row) => (
                                                        <tr key={row.indicator_id} className="border-b border-slate-200 align-top last:border-0">
                                                            <td>
                                                                <div className="font-medium text-slate-900">{row.name}</div>
                                                                <div className="mt-1 text-xs text-slate-500">
                                                                    Код: {row.code}{row.unit ? ` • Ед.: ${row.unit}` : ''}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    min="0"
                                                                    className="tabular-nums"
                                                                    value={row.plan_value ?? ''}
                                                                    disabled={!canEditPlan(row)}
                                                                    onChange={(event) => updateRow(row.indicator_id, 'plan_value', event.target.value)}
                                                                    placeholder="0"
                                                                />
                                                            </td>
                                                            <td>
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    min="0"
                                                                    className="tabular-nums"
                                                                    value={row.fact_value ?? ''}
                                                                    disabled={!canEditFact(row)}
                                                                    onChange={(event) => updateRow(row.indicator_id, 'fact_value', event.target.value)}
                                                                    placeholder="0"
                                                                />
                                                            </td>
                                                            <td className="text-right">
                                                                <span className="font-display text-lg font-bold tabular-nums text-[#102945]">
                                                                    {resolvePoints(row).toFixed(2)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <textarea
                                                                    className="min-h-20 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed"
                                                                    value={row.comment ?? ''}
                                                                    disabled
                                                                    readOnly
                                                                />
                                                            </td>
                                                            <td>
                                                                <div className="space-y-2">
                                                                    {row.files.length > 0 ? (
                                                                        row.files.map((file) => (
                                                                            <a
                                                                                key={file.id}
                                                                                href={file.file_url}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="flex items-center gap-1.5 text-sm font-medium text-teal-700 underline-offset-4 hover:text-[#102945] hover:underline"
                                                                            >
                                                                                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                                                                <span className="truncate">{file.file_name}</span>
                                                                            </a>
                                                                        ))
                                                                    ) : (
                                                                        <p className="text-xs text-slate-500">
                                                                            {row.requires_file ? 'Файл обязателен на стадии fact.' : 'Файл не требуется.'}
                                                                        </p>
                                                                    )}

                                                                    {row.requires_file && isFactStage && canEditFact(row) && (
                                                                        row.entry_id ? (
                                                                            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border border-slate-300 bg-white px-3 text-xs font-bold uppercase tracking-[0.08em] text-[#102945] transition-colors hover:border-teal-600 hover:text-teal-700">
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
                                                                            <p className="flex items-start gap-1.5 text-xs text-amber-700">
                                                                                <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                                                                                Сначала сохраните факт, затем загрузите файл.
                                                                            </p>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td>
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

                        <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_0_rgba(25,28,29,0.08)] sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#102945]">
                                    Общий статус отправки:
                                    <Badge variant={statusVariants[overallStatus] ?? 'outline'}>{statusLabels[overallStatus] ?? overallStatus}</Badge>
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                    {isPlanStage && 'Сейчас редактируются только плановые значения.'}
                                    {isFactStage && 'Сейчас редактируются фактические значения и подтверждающие файлы.'}
                                    {isReviewStage && 'Период в review: форма доступна только для просмотра.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(isPlanStage || isFactStage) && (
                                    <Button type="button" variant="outline" onClick={saveEntries} disabled={!period || entryForm.processing}>
                                        <Save className="h-4 w-4" />
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
