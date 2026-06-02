import { Head, Link } from '@inertiajs/react';

const formatValue = (value, fallback = '—') => {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    return value;
};

export default function TeacherAnalytics({ teacher, analytics = [], overall_average }) {
    return (
        <>
            <Head title="Survey analytics - teacher" />

            <div className="admin-page-wrap">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Survey</p>
                        <h1 className="text-3xl font-semibold text-slate-900">Аналитика преподавателя</h1>
                        <p className="mt-2 text-sm text-slate-600">
                            {teacher?.first_name} {teacher?.last_name}
                        </p>
                    </div>

                    <Link href={route('admin.surveys.index')} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                        К списку анкет
                    </Link>
                </div>

                <div className="mb-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-sm text-slate-500">Средняя оценка</div>
                        <div className="mt-2 text-3xl font-semibold text-slate-900">{formatValue(overall_average)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
                        <div className="text-sm text-slate-500">Дисциплин в аналитике</div>
                        <div className="mt-2 text-3xl font-semibold text-slate-900">{analytics.length}</div>
                    </div>
                </div>

                <div className="space-y-4">
                    {analytics.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
                            Нет завершённых анкет по этому преподавателю.
                        </div>
                    ) : (
                        analytics.map((item) => (
                            <div key={item.discipline?.id ?? item.discipline?.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-900">{item.discipline?.name}</h2>
                                        <p className="text-sm text-slate-500">
                                            Завершено анкет: {item.completed_surveys_count} · Средняя оценка: {formatValue(item.average_rating)} · Процент отклика: {formatValue(item.response_rate)}%
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                    <div>
                                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Вопросы</h3>
                                        <div className="mt-3 space-y-3">
                                            {item.question_analytics?.length ? item.question_analytics.map((question) => (
                                                <div key={question.question_id} className="rounded-xl bg-slate-50 p-4">
                                                    <div className="text-sm font-medium text-slate-800">{question.question_text}</div>
                                                    <div className="mt-1 text-sm text-slate-600">
                                                        Средняя оценка: {formatValue(question.average_rating)} · Ответов: {formatValue(question.response_count)}
                                                    </div>
                                                </div>
                                            )) : (
                                                <p className="text-sm text-slate-500">Нет данных по вопросам.</p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Краткая сводка</h3>
                                        <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                                            <p>Количество групп: {item.discipline?.groups?.length ?? '—'}</p>
                                            <p className="mt-2">Средняя оценка по дисциплине: {formatValue(item.average_rating)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
