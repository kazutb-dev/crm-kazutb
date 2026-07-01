import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BarChart3, Clock3, Users } from 'lucide-react';

function formatDate(value) {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export default function BindingAnalytics({ binding, analytics, testAnalytics = [], results = [] }) {
    return (
        <AuthenticatedLayout>
            <Head title={`Аналитика - ${binding.subject?.name || 'Тестирование'}`} />

            <div className="admin-page-wrap space-y-6">
                <Card className="admin-surface overflow-hidden border-0 bg-gradient-to-r from-[#123153] via-[#15466a] to-[#139AA4] text-white">
                    <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/80">
                                    <BarChart3 className="h-3.5 w-3.5" />
                                    Аналитика
                                </div>
                                <h1 className="text-3xl font-semibold">{binding.subject?.name}</h1>
                                <p className="mt-2 text-sm text-white/75">{binding.subject?.code || 'Без кода'}</p>
                            </div>

                            <Link href={route('testing.bindings.show', binding.id)}>
                                <Button type="button" variant="outline" className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                                    <ArrowLeft className="h-4 w-4" />
                                    К списку тестов
                                </Button>
                            </Link>
                        </div>

                        <div className="grid gap-3 md:grid-cols-5">
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/70">Тестов</div>
                                <div className="mt-2 text-3xl font-semibold">{analytics?.tests_count ?? 0}</div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/70">Прохождений</div>
                                <div className="mt-2 text-3xl font-semibold">{analytics?.attempts_count ?? 0}</div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/70">Уникальных</div>
                                <div className="mt-2 text-3xl font-semibold">{analytics?.users_count ?? 0}</div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/70">Средний балл</div>
                                <div className="mt-2 text-3xl font-semibold">{analytics?.average_score ?? 0}</div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/70">Успешность</div>
                                <div className="mt-2 text-3xl font-semibold">{analytics?.success_rate ?? 0}%</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <Card className="admin-surface">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xl text-[#132844]">Сводка по тестам</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {testAnalytics.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
                                    По этой привязке еще нет тестов.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {testAnalytics.map((item) => (
                                        <div key={item.id} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_16px_38px_-32px_rgba(15,23,42,0.55)]">
                                            <div className="flex flex-col gap-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div>
                                                        <h2 className="text-lg font-semibold text-[#132844]">{item.title}</h2>
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <Badge className={item.status === 'published' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}>
                                                                {item.status === 'published' ? 'Опубликован' : 'Черновик'}
                                                            </Badge>
                                                            <span className="text-sm text-slate-500">{item.question_count} вопросов</span>
                                                        </div>
                                                    </div>

                                                    <div className="text-right text-sm text-slate-500">
                                                        <div>Последнее прохождение</div>
                                                        <div className="mt-1 font-medium text-[#132844]">{formatDate(item.last_completed_at)}</div>
                                                    </div>
                                                </div>

                                                <div className="grid gap-3 md:grid-cols-4">
                                                    <StatCard icon={BarChart3} label="Прохождений" value={item.attempts_count} />
                                                    <StatCard icon={Users} label="Пользователей" value={item.users_count} />
                                                    <StatCard icon={BarChart3} label="Средний балл" value={item.average_score} />
                                                    <StatCard icon={Clock3} label="Успешность" value={`${item.success_rate}%`} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="admin-surface">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xl text-[#132844]">Последние результаты</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {results.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
                                    Результатов прохождения пока нет.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {results.map((result) => (
                                        <div key={result.id} className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold text-[#132844]">{result.user_name || 'Пользователь'}</div>
                                                    <div className="mt-1 text-sm text-slate-500">{result.user_email || 'Без email'}</div>
                                                    <div className="mt-2 text-sm text-slate-600">{result.test_title}</div>
                                                </div>

                                                <Badge className={result.passed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}>
                                                    {result.passed ? 'Успешно' : 'Не пройден'}
                                                </Badge>
                                            </div>

                                            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                                                <div className="rounded-2xl bg-slate-50 p-3">
                                                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Балл</div>
                                                    <div className="mt-1 font-semibold text-[#132844]">{result.score}</div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50 p-3">
                                                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Верно</div>
                                                    <div className="mt-1 font-semibold text-[#132844]">{result.correct_answers_count}</div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50 p-3">
                                                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Дата</div>
                                                    <div className="mt-1 font-semibold text-[#132844]">{formatDate(result.completed_at)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function StatCard({ icon: Icon, label, value }) {
    return (
        <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                <Icon className="h-4 w-4" />
                {label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#132844]">{value}</div>
        </div>
    );
}
