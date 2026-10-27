import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { InfoField, Notice, PageHeader, UnderlineTabs } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SEVERITY_META, SEVERITY_ORDER, StatusBadge as ReviewStatusBadge, isInProgress } from '@/components/teacher-ai/shared';
import { Link, router } from '@inertiajs/react';
import { ArrowLeft, FileText, Inbox, Lightbulb, LoaderCircle, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 4000;

const numberFormat = new Intl.NumberFormat('ru-RU');

function FindingCard({ finding }) {
    const meta = SEVERITY_META[finding.severity] ?? SEVERITY_META.minor;

    return (
        <article className="py-5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} />
                    {meta.label}
                </span>
                {finding.category && <span className="text-sm font-semibold text-[#102945]">{finding.category}</span>}
            </div>

            {finding.quote && (
                <blockquote className="mt-3 break-words border-l-[3px] border-teal-600 pl-3 text-sm italic text-slate-600">
                    «{finding.quote}»
                </blockquote>
            )}

            <p className="mt-3 text-sm leading-6 text-slate-800">{finding.issue}</p>

            {finding.suggestion && (
                <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-teal-200 bg-teal-50 p-3 text-sm text-[#102945]">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                    <p><span className="font-semibold">Как исправить: </span>{finding.suggestion}</p>
                </div>
            )}
        </article>
    );
}

export default function Show({ review }) {
    const [filter, setFilter] = useState('all');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const inProgress = isInProgress(review.status);
    const findings = review.findings ?? [];
    const visibleFindings = filter === 'all' ? findings : findings.filter((finding) => finding.severity === filter);

    useEffect(() => {
        if (!inProgress) {
            return undefined;
        }

        const timer = window.setInterval(() => {
            router.reload({ only: ['review'], preserveScroll: true });
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [inProgress]);

    const retry = () => {
        router.post(route('teacher-ai.reviews.retry', review.id), {}, {
            preserveScroll: true,
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
        });
    };

    const destroy = () => {
        router.delete(route('teacher-ai.reviews.destroy', review.id), {
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
        });
    };

    const filterTabs = [
        { key: 'all', label: 'Все', count: findings.length },
        ...SEVERITY_ORDER
            .filter((key) => (review.findings_count?.[key] ?? 0) > 0)
            .map((key) => ({ key, label: SEVERITY_META[key].label, count: review.findings_count[key] })),
    ];

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow={(
                        <Link
                            href={route('teacher-ai.reviews.index')}
                            className="inline-flex items-center gap-1.5 hover:text-[#102945]"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Все проверки
                        </Link>
                    )}
                    title={<span className="break-words">{review.title}</span>}
                    description={(
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <span>{review.document_type_label}</span>
                            <span className="tabular-nums">{review.created_at}</span>
                            {review.original_name && <span className="break-all">{review.original_name}</span>}
                        </span>
                    )}
                    meta={<ReviewStatusBadge status={review.status} />}
                    actions={(
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setConfirmDelete(true)}
                            disabled={busy}
                            className="gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            Удалить проверку
                        </Button>
                    )}
                />
            )}
        >
            <div className="admin-page-wrap space-y-6">
                <Notice tone="brand">
                    Это рекомендации ИИ, а не решение. ИИ может ошибаться или пропустить важное:
                    проверяйте каждое замечание по тексту документа.
                </Notice>

                {inProgress && (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
                            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                <LoaderCircle className="h-8 w-8 animate-spin" />
                            </span>
                            <h3 className="mt-4 font-display text-lg font-bold text-[#102945]">
                                {review.status === 'pending' ? 'Документ в очереди на проверку' : 'ИИ анализирует документ'}
                            </h3>
                            <p className="mt-1 max-w-md text-sm text-slate-600">
                                Обычно это занимает 1–2 минуты. Страница обновится сама, можно её не закрывать.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {review.status === 'failed' && (
                    <Notice
                        tone="danger"
                        title="Проверка не выполнена"
                        action={review.can_retry ? (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={retry}
                                disabled={busy}
                                className="shrink-0 gap-2"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Повторить
                            </Button>
                        ) : null}
                    >
                        {review.error_message ?? 'Попробуйте ещё раз позже.'}
                    </Notice>
                )}

                {review.status === 'completed' && (
                    <>
                        {review.is_partial && (
                            <Notice tone="warning">
                                Документ длинный: проанализированы первые {numberFormat.format(review.analyzed_chars)} из{' '}
                                {numberFormat.format(review.content_chars)} символов. Окончание документа ИИ не видел.
                            </Notice>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Краткий пересказ
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <p className="whitespace-pre-line text-[0.9375rem] leading-7 text-slate-700">{review.summary}</p>

                                {review.key_points.length > 0 && (
                                    <div className="border-t border-slate-200 pt-5">
                                        <h4 className="qd-field-label text-slate-500">Ключевые положения</h4>
                                        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700 marker:text-teal-600">
                                            {review.key_points.map((point, index) => (
                                                <li key={index}>{point}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {review.overall && (
                                    <div className="border-t border-slate-200 pt-5">
                                        <h4 className="qd-field-label text-slate-500">Общий вывод ИИ</h4>
                                        <p className="mt-2 text-sm leading-6 text-slate-700">{review.overall}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TriangleAlert className="h-4 w-4" />
                                    Спорные места ({findings.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {findings.length > 0 && (
                                    <UnderlineTabs items={filterTabs} value={filter} onChange={setFilter} />
                                )}

                                {findings.length === 0 ? (
                                    <InlineEmpty
                                        icon={Lightbulb}
                                        title="Спорных мест не найдено"
                                        description="ИИ не нашёл спорных мест. Это не гарантия, что их нет."
                                    />
                                ) : (
                                    <div className="divide-y divide-slate-200">
                                        {visibleFindings.map((finding, index) => (
                                            <FindingCard key={`${filter}-${index}`} finding={finding} />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}

                {review.focus && (
                    <InfoField label="Ваш комментарий для ИИ" className="border-b-0">
                        <span className="font-normal text-slate-700">{review.focus}</span>
                    </InfoField>
                )}
            </div>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Удалить проверку?"
                description="Текст документа и результат ИИ будут удалены без возможности восстановления."
                onConfirm={destroy}
            />
        </AuthenticatedLayout>
    );
}

function InlineEmpty({ icon: Icon = Inbox, title, description = null, action = null }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <Icon className="h-6 w-6" />
            </span>
            <div className="max-w-md space-y-1">
                <p className="font-display text-lg font-bold text-[#102945]">{title}</p>
                {description ? <p className="text-sm leading-relaxed text-slate-600">{description}</p> : null}
            </div>
            {action}
        </div>
    );
}
