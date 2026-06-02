import { Head, Link } from '@inertiajs/react';

const formatValue = (value, fallback = '—') => {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    return value;
};

export default function SystemReport({ report, top_teachers = [], top_disciplines = [], message }) {
    return (
        <>
            <Head title="Survey analytics - system report" />

            <div className="admin-page-wrap">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Survey</p>
                        <h1 className="text-3xl font-semibold text-slate-900">Системный отчёт</h1>
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
                        <div className="mb-6 grid gap-4 md:grid-cols-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="text-sm text-slate-500">Всего анкет</div>
                                <div className="mt-2 text-3xl font-semibold text-slate-900">{formatValue(report?.total_surveys)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="text-sm text-slate-500">Завершено</div>
                                <div className="mt-2 text-3xl font-semibold text-slate-900">{formatValue(report?.completed_surveys)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="text-sm text-slate-500">Процент завершения</div>
                                <div className="mt-2 text-3xl font-semibold text-slate-900">{formatValue(report?.completion_rate)}%</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="text-sm text-slate-500">Средняя оценка</div>
                                <div className="mt-2 text-3xl font-semibold text-slate-900">{formatValue(report?.system_average_rating)}</div>
                            </div>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-semibold text-slate-900">Топ преподавателей</h2>
                                <div className="mt-4 space-y-3">
                                    {top_teachers.length ? top_teachers.map((item, index) => (
                                        <div key={item.teacher?.id ?? index} className="rounded-xl bg-slate-50 p-4">
                                            <div className="font-medium text-slate-800">
                                                {index + 1}. {item.teacher?.first_name} {item.teacher?.last_name}
                                            </div>
                                            <div className="mt-1 text-sm text-slate-600">Средняя оценка: {formatValue(item.average_rating)}</div>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-slate-500">Нет данных.</p>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-semibold text-slate-900">Топ дисциплин</h2>
                                <div className="mt-4 space-y-3">
                                    {top_disciplines.length ? top_disciplines.map((item, index) => (
                                        <div key={item.discipline?.id ?? index} className="rounded-xl bg-slate-50 p-4">
                                            <div className="font-medium text-slate-800">{index + 1}. {item.discipline?.name}</div>
                                            <div className="mt-1 text-sm text-slate-600">Средняя оценка: {formatValue(item.average_rating)}</div>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-slate-500">Нет данных.</p>
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
