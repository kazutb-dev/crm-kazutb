import { Head, Link } from '@inertiajs/react';

const formatValue = (value, fallback = '—') => {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    return value;
};

export default function DisciplineAnalytics({ discipline, completed_surveys_count, average_rating, question_analytics = [], group_analytics = [], message }) {
    return (
        <>
            <Head title="Survey analytics - discipline" />

            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Survey</p>
                        <h1 className="text-3xl font-semibold text-slate-900">Аналитика дисциплины</h1>
                        <p className="mt-2 text-sm text-slate-600">{discipline?.name}</p>
                    </div>

                    <Link href={route('admin.surveys.index')} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                        К списку анкет
                    </Link>
                </div>

                {message ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                        {message}
                    </div>
                ) : (
                    <>
                        <div className="mb-6 grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="text-sm text-slate-500">Завершено анкет</div>
                                <div className="mt-2 text-3xl font-semibold text-slate-900">{formatValue(completed_surveys_count)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="text-sm text-slate-500">Средняя оценка</div>
                                <div className="mt-2 text-3xl font-semibold text-slate-900">{formatValue(average_rating)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="text-sm text-slate-500">Вопросов в аналитике</div>
                                <div className="mt-2 text-3xl font-semibold text-slate-900">{question_analytics.length}</div>
                            </div>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-semibold text-slate-900">По вопросам</h2>
                                <div className="mt-4 space-y-3">
                                    {question_analytics.length ? question_analytics.map((question) => (
                                        <div key={question.question?.id ?? question.question?.text} className="rounded-xl bg-slate-50 p-4">
                                            <div className="font-medium text-slate-800">{question.question?.text}</div>
                                            <div className="mt-1 text-sm text-slate-600">
                                                Средняя: {formatValue(question.average_rating)} · Мин: {formatValue(question.min_rating)} · Макс: {formatValue(question.max_rating)} · Ответов: {formatValue(question.response_count)}
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-slate-500">Нет данных по вопросам.</p>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-semibold text-slate-900">По группам</h2>
                                <div className="mt-4 space-y-3">
                                    {group_analytics.length ? group_analytics.map((group) => (
                                        <div key={group.group?.id ?? group.group?.name} className="rounded-xl bg-slate-50 p-4">
                                            <div className="font-medium text-slate-800">{group.group?.name}</div>
                                            <div className="mt-1 text-sm text-slate-600">
                                                Анкет: {formatValue(group.survey_count)} · Средняя оценка: {formatValue(group.average_rating)}
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-slate-500">Нет групповых данных.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
