import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, Segmented, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SeverityCounts, StatusBadge as ReviewStatusBadge, isInProgress } from '@/components/teacher-ai/shared';
import { Link, router, useForm } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileText, Gauge, Inbox, LoaderCircle, Sparkles, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 5000;

const textareaClassName = `${qdFieldClass} h-auto py-2.5`;

function FieldError({ message }) {
    if (!message) {
        return null;
    }

    return <p className="mt-1.5 text-sm text-red-700">{message}</p>;
}

export default function Index({ documentTypes = [], reviews = [], aiEnabled = false, limits = {} }) {
    const [mode, setMode] = useState('file');
    const [fileError, setFileError] = useState(null);
    const form = useForm({
        document_type: documentTypes[0]?.value ?? 'syllabus',
        title: '',
        focus: '',
        document: null,
        text: '',
    });

    const dailyLimit = limits.daily ?? 0;
    const usedToday = limits.used_today ?? 0;
    const maxFileMb = limits.max_file_mb ?? 10;
    const limitReached = dailyLimit > 0 && usedToday >= dailyLimit;
    const hasInProgress = reviews.some((review) => isInProgress(review.status));
    const completedCount = reviews.filter((review) => review.status === 'completed').length;
    const inProgressCount = reviews.filter((review) => isInProgress(review.status)).length;
    const failedCount = reviews.filter((review) => review.status === 'failed').length;
    const findingTotals = reviews.reduce((acc, review) => {
        ['critical', 'major', 'minor'].forEach((key) => { acc[key] += review.findings_count?.[key] ?? 0; });
        return acc;
    }, { critical: 0, major: 0, minor: 0 });
    const canSubmit = aiEnabled && !limitReached && !form.processing
        && (mode === 'file' ? Boolean(form.data.document) : form.data.text.trim().length > 0);

    useEffect(() => {
        if (!hasInProgress) {
            return undefined;
        }

        const timer = window.setInterval(() => {
            router.reload({ only: ['reviews', 'limits'], preserveScroll: true });
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [hasInProgress]);

    const handleFileChange = (event) => {
        const file = event.target.files?.[0] ?? null;
        setFileError(null);

        if (file && file.size > maxFileMb * 1024 * 1024) {
            setFileError(`Файл больше ${maxFileMb} МБ.`);
            form.setData('document', null);
            event.target.value = '';
            return;
        }

        form.setData('document', file);
    };

    const submit = (event) => {
        event.preventDefault();

        form.transform((data) => (mode === 'file' ? { ...data, text: '' } : { ...data, document: null }));
        form.post(route('teacher-ai.reviews.store'), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="AI-ассистент преподавателя"
                    title="Проверка документов"
                    description="ИИ кратко перескажет документ и отметит спорные места. Это только подсказки: ИИ может ошибаться, решение всегда принимаете вы."
                    meta={(
                        <StatusBadge tone={limitReached ? 'warning' : 'info'}>
                            Сегодня: {usedToday} из {dailyLimit}
                        </StatusBadge>
                    )}
                />
            )}
        >
            <div className="admin-page-wrap space-y-6">
                {!aiEnabled && (
                    <Notice tone="warning" title="AI-ассистент отключён">
                        AI-ассистент сейчас отключён. Обратитесь к администратору системы.
                    </Notice>
                )}

                <StatGrid>
                    <StatTile label="Сегодня" value={`${usedToday} / ${dailyLimit}`} hint={dailyLimit > 0 ? `осталось ${Math.max(dailyLimit - usedToday, 0)}` : 'лимит не задан'} icon={Gauge} tone={limitReached ? 'warning' : 'teal'} />
                    <StatTile label="Мои проверки" value={reviews.length} hint={failedCount > 0 ? `с ошибкой: ${failedCount}` : 'последние 50'} icon={FileText} tone="navy" />
                    <StatTile label="Готово" value={completedCount} hint="результаты доступны" icon={CheckCircle2} tone="success" />
                    <StatTile label="В работе" value={inProgressCount} hint="в очереди и анализе" icon={LoaderCircle} tone="info" />
                    <StatTile label="Замечаний" value={findingTotals.critical + findingTotals.major + findingTotals.minor} hint={`критично ${findingTotals.critical} · важно ${findingTotals.major} · рекоменд. ${findingTotals.minor}`} icon={AlertTriangle} tone={findingTotals.critical > 0 ? 'danger' : 'gold'} />
                </StatGrid>

                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                Новая проверка
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label htmlFor="document_type" className="qd-field-label block">Тип документа</label>
                                        <select
                                            id="document_type"
                                            value={form.data.document_type}
                                            onChange={(event) => form.setData('document_type', event.target.value)}
                                            className={qdFieldClass}
                                        >
                                            {documentTypes.map((type) => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
                                        <FieldError message={form.errors.document_type} />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="title" className="qd-field-label block">
                                            Название <span className="font-normal normal-case tracking-normal text-slate-400">(необязательно)</span>
                                        </label>
                                        <input
                                            id="title"
                                            type="text"
                                            value={form.data.title}
                                            onChange={(event) => form.setData('title', event.target.value)}
                                            placeholder="Например: Силлабус «Базы данных»"
                                            maxLength={255}
                                            className={qdFieldClass}
                                        />
                                        <FieldError message={form.errors.title} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <span className="qd-field-label block">Документ</span>
                                    <Segmented
                                        value={mode}
                                        onChange={setMode}
                                        items={[
                                            { key: 'file', label: <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" />Загрузить файл</span> },
                                            { key: 'text', label: <span className="inline-flex items-center gap-2"><ClipboardPaste className="h-4 w-4" />Вставить текст</span> },
                                        ]}
                                    />

                                    {mode === 'file' ? (
                                        <div>
                                            <label
                                                htmlFor="document"
                                                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-teal-500 hover:bg-teal-50"
                                            >
                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                                    <FileText className="h-4 w-4" />
                                                </span>
                                                <span className="text-sm font-semibold text-[#102945]">
                                                    {form.data.document ? form.data.document.name : 'Выберите файл'}
                                                </span>
                                                <span className="text-xs text-slate-500">PDF, DOCX или TXT, до {maxFileMb} МБ</span>
                                            </label>
                                            <input
                                                id="document"
                                                type="file"
                                                accept=".pdf,.docx,.txt"
                                                onChange={handleFileChange}
                                                className="sr-only"
                                            />
                                            <FieldError message={fileError ?? form.errors.document} />
                                        </div>
                                    ) : (
                                        <div>
                                            <textarea
                                                value={form.data.text}
                                                onChange={(event) => form.setData('text', event.target.value)}
                                                rows={10}
                                                placeholder="Вставьте текст документа"
                                                className={textareaClassName}
                                            />
                                            <FieldError message={form.errors.text} />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="focus" className="qd-field-label block">
                                        На что обратить внимание <span className="font-normal normal-case tracking-normal text-slate-400">(необязательно)</span>
                                    </label>
                                    <textarea
                                        id="focus"
                                        value={form.data.focus}
                                        onChange={(event) => form.setData('focus', event.target.value)}
                                        rows={2}
                                        maxLength={1000}
                                        placeholder="Например: проверь политику оценивания и список литературы"
                                        className={textareaClassName}
                                    />
                                    <FieldError message={form.errors.focus} />
                                </div>

                                <Notice tone="info" title="Конфиденциальность">
                                    Текст документа отправляется во внешний ИИ-сервис. Не загружайте персональные данные
                                    студентов и сотрудников: ИИН, телефоны, оценки. Номера из 12 цифр скрываются автоматически.
                                </Notice>

                                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
                                    {limitReached && (
                                        <span className="mr-auto text-sm text-amber-700">Дневной лимит проверок исчерпан.</span>
                                    )}
                                    <Button type="submit" disabled={!canSubmit} className="gap-2">
                                        <Sparkles className="h-4 w-4" />
                                        {form.processing ? 'Отправка…' : 'Отправить на проверку'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Мои проверки
                            </CardTitle>
                            <span className="text-xs text-slate-500">Видны только вам · <span className="font-semibold tabular-nums">{reviews.length}</span></span>
                        </CardHeader>
                        <CardContent className={reviews.length === 0 ? '' : 'p-0'}>
                            {reviews.length === 0 ? (
                                <InlineEmpty
                                    icon={FileText}
                                    title="Проверок пока нет"
                                    description="Здесь появятся результаты ваших проверок."
                                />
                            ) : (
                                <ul className="divide-y divide-slate-200">
                                    {reviews.map((review) => (
                                        <li key={review.id}>
                                            <Link
                                                href={route('teacher-ai.reviews.show', review.id)}
                                                className="flex flex-col gap-1 px-5 py-2.5 transition hover:bg-slate-50"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <span className="min-w-0 break-words font-medium text-slate-900">{review.title}</span>
                                                    <ReviewStatusBadge status={review.status} />
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                                                    <span>{review.document_type_label}</span>
                                                    <span className="tabular-nums">{review.created_at}</span>
                                                    {review.status === 'completed' && <SeverityCounts counts={review.findings_count} />}
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function InlineEmpty({ icon: Icon = Inbox, title, description = null, action = null }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <Icon className="h-5 w-5" />
            </span>
            <div className="max-w-md space-y-1">
                <p className="font-display text-base font-bold text-[#102945]">{title}</p>
                {description ? <p className="text-sm leading-relaxed text-slate-600">{description}</p> : null}
            </div>
            {action}
        </div>
    );
}
