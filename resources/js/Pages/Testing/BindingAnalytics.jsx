import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Inbox, BarChart3, ClipboardList, ListChecks, Target, Users } from 'lucide-react';

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

                <div className="grid grid-cols-1 items-start gap-4 2xl:grid-cols-2">
                    <Card className="overflow-hidden">
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Сводка по тестам
                            </CardTitle>
                            <span className="text-xs font-medium tabular-nums text-slate-500">
                                {testAnalytics.length} тестов · опубликовано {testAnalytics.filter((item) => item.status === 'published').length}
                            </span>
                        </CardHeader>
                        <CardContent className="p-0">
                            {testAnalytics.length === 0 ? (
                                <InlineEmpty
                                    icon={ClipboardList}
                                    title="Тестов пока нет"
                                    description="По этой привязке еще нет тестов."
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] text-sm">
                                        <thead>
                                            <tr>
                                                <th>Тест</th>
                                                <th className="whitespace-nowrap text-right">Прохожд.</th>
                                                <th className="whitespace-nowrap text-right">Польз.</th>
                                                <th className="whitespace-nowrap text-right">Ср. балл</th>
                                                <th className="text-right">Успешность</th>
                                                <th>Последнее</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {testAnalytics.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50">
                                                    <td>
                                                        <div className="font-medium text-slate-900">{item.title}</div>
                                                        <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-xs text-slate-500">
                                                            <Badge variant={item.status === 'published' ? 'success' : 'warning'}>
                                                                {item.status === 'published' ? 'Опубликован' : 'Черновик'}
                                                            </Badge>
                                                            {item.question_count} вопросов
                                                        </div>
                                                    </td>
                                                    <td className="text-right tabular-nums">{item.attempts_count}</td>
                                                    <td className="text-right tabular-nums">{item.users_count}</td>
                                                    <td className="text-right font-semibold tabular-nums text-[#102945]">{item.average_score}</td>
                                                    <td className="text-right">
                                                        <div className="ml-auto flex w-28 items-center justify-end gap-2">
                                                            <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                                                                <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, Number(item.success_rate) || 0)}%` }} />
                                                            </div>
                                                            <span className="font-semibold tabular-nums text-emerald-700">{item.success_rate}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap text-xs tabular-nums text-slate-500">{formatDate(item.last_completed_at)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="overflow-hidden">
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                Последние результаты
                            </CardTitle>
                            {results.length ? (
                                <span className="text-xs font-medium tabular-nums text-slate-500">
                                    {results.length} · успешно {results.filter((result) => result.passed).length}
                                </span>
                            ) : null}
                        </CardHeader>
                        <CardContent className="p-0">
                            {results.length === 0 ? (
                                <InlineEmpty
                                    icon={ListChecks}
                                    title="Результатов нет"
                                    description="Результатов прохождения пока нет."
                                />
                            ) : (
                                <div className="max-h-[720px] overflow-auto">
                                    <table className="w-full min-w-[720px] text-sm">
                                        <thead>
                                            <tr>
                                                <th>Студент</th>
                                                <th>Тест</th>
                                                <th className="text-right">Балл</th>
                                                <th className="text-right">Верно</th>
                                                <th>Статус</th>
                                                <th>Дата</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map((result) => (
                                                <tr key={result.id} className="hover:bg-slate-50">
                                                    <td>
                                                        <div className="font-medium text-slate-900">{result.user_name || 'Пользователь'}</div>
                                                        <div className="text-xs text-slate-500">{result.user_email || 'Без email'}</div>
                                                    </td>
                                                    <td className="text-slate-700">{result.test_title}</td>
                                                    <td className="text-right font-semibold tabular-nums text-[#102945]">{result.score}</td>
                                                    <td className="text-right tabular-nums">{result.correct_answers_count}</td>
                                                    <td>
                                                        <Badge variant={result.passed ? 'success' : 'destructive'}>
                                                            {result.passed ? 'Успешно' : 'Не пройден'}
                                                        </Badge>
                                                    </td>
                                                    <td className="whitespace-nowrap text-xs tabular-nums text-slate-500">{formatDate(result.completed_at)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <Icon className="h-5 w-5" />
            </span>
            <div className="max-w-md space-y-1">
                <p className="text-base font-bold text-[#102945]">{title}</p>
                {description ? <p className="text-sm leading-relaxed text-slate-600">{description}</p> : null}
            </div>
            {action}
        </div>
    );
}
