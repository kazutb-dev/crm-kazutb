import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SEVERITY_META, SEVERITY_ORDER, StatusBadge, isInProgress } from '@/components/teacher-ai/shared';
import { Link, router } from '@inertiajs/react';
import { ArrowLeft, Info, Lightbulb, LoaderCircle, RotateCcw, Trash2, TriangleAlert, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 4000;

const numberFormat = new Intl.NumberFormat('ru-RU');

function FindingCard({ finding }) {
    const meta = SEVERITY_META[finding.severity] ?? SEVERITY_META.minor;

    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} />
                    {meta.label}
                </span>
                {finding.category && <span className="text-sm font-medium text-slate-700">{finding.category}</span>}
            </div>

            {finding.quote && (
                <blockquote className="mt-3 break-words border-l-4 border-slate-200 pl-3 text-sm italic text-slate-500">
                    «{finding.quote}»
                </blockquote>
            )}

            <p className="mt-3 text-sm leading-6 text-slate-800">{finding.issue}</p>

            {finding.suggestion && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                    <p><span className="font-medium">Как исправить: </span>{finding.suggestion}</p>
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

    return (
        <AuthenticatedLayout
            header={(
                <div className="space-y-2">
                    <Link
                        href={route('teacher-ai.reviews.index')}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Все проверки
                    </Link>
                    <h2 className="break-words text-2xl font-semibold text-slate-900">{review.title}</h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
                        <StatusBadge status={review.status} />
                        <span>{review.document_type_label}</span>
                        <span>{review.created_at}</span>
                        {review.original_name && <span className="break-all">{review.original_name}</span>}
                    </div>
                </div>
            )}
        >
            <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                    <p>
                        Это рекомендации ИИ, а не решение. ИИ может ошибаться или пропустить важное:
                        проверяйте каждое замечание по тексту документа.
                    </p>
                </div>

                {inProgress && (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-sky-200 bg-sky-50 px-6 py-12 text-center">
                        <LoaderCircle className="h-10 w-10 animate-spin text-sky-600" />
                        <h3 className="mt-4 text-lg font-semibold text-sky-900">
                            {review.status === 'pending' ? 'Документ в очереди на проверку' : 'ИИ анализирует документ'}
                        </h3>
                        <p className="mt-1 max-w-md text-sm text-sky-800">
                            Обычно это занимает 1–2 минуты. Страница обновится сама, можно её не закрывать.
                        </p>
                    </div>
                )}

                {review.status === 'failed' && (
                    <div className="flex flex-col gap-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                            <div>
                                <h3 className="font-semibold text-rose-900">Проверка не выполнена</h3>
                                <p className="mt-1 text-sm text-rose-800">{review.error_message ?? 'Попробуйте ещё раз позже.'}</p>
                            </div>
                        </div>
                        {review.can_retry && (
                            <button
                                type="button"
                                onClick={retry}
                                disabled={busy}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Повторить
                            </button>
                        )}
                    </div>
                )}

                {review.status === 'completed' && (
                    <>
                        {review.is_truncated && (
                            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                                <p>
                                    Документ длинный: проанализированы первые {numberFormat.format(review.analyzed_chars)} из{' '}
                                    {numberFormat.format(review.content_chars)} символов. Окончание документа ИИ не видел.
                                </p>
                            </div>
                        )}

                        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                            <h3 className="text-lg font-semibold text-slate-900">Краткий пересказ</h3>
                            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{review.summary}</p>

                            {review.key_points.length > 0 && (
                                <>
                                    <h4 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Ключевые положения</h4>
                                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
                                        {review.key_points.map((point, index) => (
                                            <li key={index}>{point}</li>
                                        ))}
                                    </ul>
                                </>
                            )}

                            {review.overall && (
                                <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                                    <span className="font-medium text-slate-900">Общий вывод ИИ: </span>
                                    {review.overall}
                                </div>
                            )}
                        </section>

                        <section className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="text-lg font-semibold text-slate-900">
                                    Спорные места <span className="font-normal text-slate-400">({findings.length})</span>
                                </h3>
                                {findings.length > 0 && (
                                    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
                                        {[
                                            { key: 'all', label: `Все ${findings.length}` },
                                            ...SEVERITY_ORDER
                                                .filter((key) => (review.findings_count?.[key] ?? 0) > 0)
                                                .map((key) => ({ key, label: `${SEVERITY_META[key].label} ${review.findings_count[key]}` })),
                                        ].map((option) => (
                                            <button
                                                key={option.key}
                                                type="button"
                                                onClick={() => setFilter(option.key)}
                                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filter === option.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {findings.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                                    ИИ не нашёл спорных мест. Это не гарантия, что их нет.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {visibleFindings.map((finding, index) => (
                                        <FindingCard key={`${filter}-${index}`} finding={finding} />
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}

                {review.focus && (
                    <p className="text-sm text-slate-500">
                        <span className="font-medium text-slate-700">Ваш комментарий для ИИ: </span>
                        {review.focus}
                    </p>
                )}

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                    >
                        <Trash2 className="h-4 w-4" />
                        Удалить проверку
                    </button>
                </div>
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
