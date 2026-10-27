import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Inbox, BarChart3, ClipboardList, Clock3, ListChecks, Target, Users } from 'lucide-react';

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
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Тестирование · Аналитика"
                    title={binding.subject?.name || 'Тестирование'}
                    description={binding.subject?.code || 'Без кода'}
                    actions={(
                        <Button asChild variant="outline" className="gap-2">
                            <Link href={route('testing.bindings.show', binding.id)}>
                                <ArrowLeft className="h-4 w-4" />
                                К списку тестов
                            </Link>
                        </Button>
                    )}
                />
            )}
        >
            <Head title={`Аналитика - ${binding.subject?.name || 'Тестирование'}`} />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Тестов" value={analytics?.tests_count ?? 0} tone="teal" icon={ClipboardList} />
                    <StatTile label="Прохождений" value={analytics?.attempts_count ?? 0} tone="navy" icon={ListChecks} />
                    <StatTile label="Уникальных" value={analytics?.users_count ?? 0} tone="info" icon={Users} />
                    <StatTile label="Средний балл" value={analytics?.average_score ?? 0} tone="gold" icon={BarChart3} />
                    <StatTile label="Успешность" value={`${analytics?.success_rate ?? 0}%`} tone="success" icon={Target} />
                </StatGrid>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Сводка по тестам
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {testAnalytics.length === 0 ? (
                                <InlineEmpty
                                    icon={ClipboardList}
                                    title="Тестов пока нет"
                                    description="По этой привязке еще нет тестов."
                                />
                            ) : (
                                <div className="divide-y divide-slate-200">
                                    {testAnalytics.map((item) => (
                                        <div key={item.id} className="space-y-4 py-5 first:pt-0 last:pb-0">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h2 className="font-display text-lg font-bold text-[#102945]">{item.title}</h2>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <Badge variant={item.status === 'published' ? 'success' : 'warning'}>
                                                            {item.status === 'published' ? 'Опубликован' : 'Черновик'}
                                                        </Badge>
                                                        <span className="text-sm text-slate-500">{item.question_count} вопросов</span>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <div className="qd-field-label text-slate-500">Последнее прохождение</div>
                                                    <div className="mt-1 text-sm font-medium tabular-nums text-[#102945]">{formatDate(item.last_completed_at)}</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                                <MiniStat icon={BarChart3} label="Прохождений" value={item.attempts_count} />
                                                <MiniStat icon={Users} label="Пользователей" value={item.users_count} />
                                                <MiniStat icon={BarChart3} label="Средний балл" value={item.average_score} />
                                                <MiniStat icon={Clock3} label="Успешность" value={`${item.success_rate}%`} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                Последние результаты
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {results.length === 0 ? (
                                <InlineEmpty
                                    icon={ListChecks}
                                    title="Результатов нет"
                                    description="Результатов прохождения пока нет."
                                />
                            ) : (
                                <div className="divide-y divide-slate-200">
                                    {results.map((result) => (
                                        <div key={result.id} className="py-4 first:pt-0 last:pb-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-[#102945]">{result.user_name || 'Пользователь'}</div>
                                                    <div className="mt-0.5 text-sm text-slate-500">{result.user_email || 'Без email'}</div>
                                                    <div className="mt-1 text-sm text-slate-600">{result.test_title}</div>
                                                </div>

                                                <Badge variant={result.passed ? 'success' : 'destructive'}>
                                                    {result.passed ? 'Успешно' : 'Не пройден'}
                                                </Badge>
                                            </div>

                                            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                                                <div>
                                                    <dt className="qd-field-label text-slate-500">Балл</dt>
                                                    <dd className="mt-1 font-semibold tabular-nums text-[#102945]">{result.score}</dd>
                                                </div>
                                                <div>
                                                    <dt className="qd-field-label text-slate-500">Верно</dt>
                                                    <dd className="mt-1 font-semibold tabular-nums text-[#102945]">{result.correct_answers_count}</dd>
                                                </div>
                                                <div>
                                                    <dt className="qd-field-label text-slate-500">Дата</dt>
                                                    <dd className="mt-1 font-semibold tabular-nums text-[#102945]">{formatDate(result.completed_at)}</dd>
                                                </div>
                                            </dl>
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

function MiniStat({ icon: Icon, label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-center gap-1.5 text-slate-500">
                <Icon className="h-3.5 w-3.5 text-teal-700" />
                <span className="qd-field-label">{label}</span>
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-[#102945]">{value}</div>
        </div>
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
