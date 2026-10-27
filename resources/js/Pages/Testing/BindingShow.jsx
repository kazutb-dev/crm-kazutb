import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Inbox, BarChart3, Pencil, Plus, Search, Shuffle, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle, ClipboardList, ListChecks, Users, Target } from 'lucide-react';
import { useMemo, useState } from 'react';

function formatDate(value) {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

const statusVariant = {
    draft: 'warning',
    published: 'success',
};

export default function BindingShow({ binding, tests = [], analytics }) {
    const [search, setSearch] = useState('');
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [expandedTests, setExpandedTests] = useState({});

    const toggleTestExpand = (testId) => {
        setExpandedTests(prev => ({
            ...prev,
            [testId]: !prev[testId]
        }));
    };

    const filteredTests = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) {
            return tests;
        }

        return tests.filter((test) => [test.title, test.description, test.status]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(term));
    }, [search, tests]);

    const removeTest = (testId, title) => {
        setConfirmState({
            open: true,
            description: `Удалить тест «${title}»? Вместе с ним будут удалены вопросы и результаты прохождения.`,
            onConfirm: () => router.delete(route('testing.tests.destroy', testId), { preserveScroll: true }),
        });
    };

    const removeBinding = () => {
        setConfirmState({
            open: true,
            description: `Удалить привязку по предмету «${binding.subject?.name}»?`,
            onConfirm: () => router.delete(route('testing.bindings.destroy', binding.id)),
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow={`Привязка предмета${binding.subject?.code ? ` · ${binding.subject.code}` : ' · Без кода'}`}
                    title={binding.subject?.name || 'Привязка'}
                    description={binding.subject?.description || 'Описание предмета не заполнено.'}
                    actions={(
                        <>
                            <Button asChild variant="ghost" className="gap-2">
                                <Link href={route('testing.index')}>
                                    <ArrowLeft className="h-4 w-4" />
                                    Ко всем предметам
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="gap-2">
                                <Link href={route('testing.bindings.analytics', binding.id)}>
                                    <BarChart3 className="h-4 w-4" />
                                    Аналитика
                                </Link>
                            </Button>
                            <Button type="button" variant="destructive" className="gap-2" onClick={removeBinding}>
                                <Trash2 className="h-4 w-4" />
                                Удалить привязку
                            </Button>
                        </>
                    )}
                />
            )}
        >
            <Head title={`Тестирование - ${binding.subject?.name || 'Привязка'}`} />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Тестов" value={analytics?.tests_count ?? 0} tone="teal" icon={ClipboardList} />
                    <StatTile label="Прохождений" value={analytics?.attempts_count ?? 0} tone="navy" icon={ListChecks} />
                    <StatTile label="Студентов" value={analytics?.users_count ?? 0} tone="info" icon={Users} />
                    <StatTile label="Средний балл" value={analytics?.average_score ?? 0} tone="gold" icon={Target} />
                </StatGrid>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <div className="min-w-0 space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardList className="h-4 w-4" />
                                Тесты по предмету
                            </CardTitle>
                            <CardDescription>Создавайте новые тесты, управляйте вопросами и отслеживайте результаты сдачи.</CardDescription>
                        </div>
                        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input className="pl-9" aria-label="Поиск по тестам" placeholder="Поиск по тестам…" value={search} onChange={(event) => setSearch(event.target.value)} />
                            </div>
                            <Button asChild className="gap-2">
                                <Link href={route('testing.tests.create', binding.id)}>
                                    <Plus className="h-4 w-4" />
                                    Создать тест
                                </Link>
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {filteredTests.length === 0 ? (
                            <InlineEmpty
                                icon={ClipboardList}
                                title={tests.length === 0 ? 'Тестов пока нет' : 'Ничего не найдено'}
                                description={tests.length === 0
                                    ? 'В этой привязке пока нет тестов.'
                                    : 'По вашему запросу тесты не найдены.'}
                                action={tests.length === 0 ? (
                                    <Button asChild className="gap-2">
                                        <Link href={route('testing.tests.create', binding.id)}>
                                            <Plus className="h-4 w-4" />
                                            Создать тест
                                        </Link>
                                    </Button>
                                ) : null}
                            />
                        ) : (
                            filteredTests.map((test) => {
                                const isExpanded = !!expandedTests[test.id];
                                return (
                                    <div key={test.id} className="rounded-[14px] border border-slate-200 bg-white">
                                        <div className="flex flex-col gap-4 p-5">
                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="space-y-1.5">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h2 className="font-display text-lg font-bold text-[#102945]">{test.title}</h2>
                                                        <Badge variant={statusVariant[test.status] || 'secondary'}>
                                                            {test.status === 'published' ? 'Опубликован' : 'Черновик'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm leading-relaxed text-slate-600">{test.description || 'Описание отсутствует.'}</p>
                                                </div>

                                                <div className="flex shrink-0 flex-wrap gap-2">
                                                    <Button asChild size="sm" variant="outline" className="gap-2">
                                                        <Link href={route('testing.tests.edit', test.id)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                            Редактировать
                                                        </Link>
                                                    </Button>
                                                    <Button type="button" size="sm" variant="destructive" className="gap-2" onClick={() => removeTest(test.id, test.title)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Удалить
                                                    </Button>
                                                </div>
                                            </div>

                                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-200 pt-4 md:grid-cols-4">
                                                <Metric label="Вопросов в тесте" value={test.question_count} />
                                                <Metric label="Подготовлено" value={test.questions_total} />
                                                <Metric label="Прохождений" value={test.results_count} />
                                                <Metric label="Средний балл" value={test.average_score} />
                                            </dl>
                                        </div>

                                        <div className="flex justify-center border-t border-slate-200 px-5 py-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleTestExpand(test.id)}
                                                className="gap-2"
                                            >
                                                {isExpanded ? (
                                                    <>
                                                        Скрыть подробности и результаты
                                                        <ChevronUp className="h-4 w-4" />
                                                    </>
                                                ) : (
                                                    <>
                                                        Показать подробности и результаты ({test.results?.length || 0})
                                                        <ChevronDown className="h-4 w-4" />
                                                    </>
                                                )}
                                            </Button>
                                        </div>

                                        {isExpanded && (
                                            <div className="space-y-5 border-t border-slate-200 p-5">
                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                                                    <span>Проходной балл: <strong className="font-semibold tabular-nums text-[#102945]">{test.passing_score}%</strong></span>
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Shuffle className="h-3.5 w-3.5 text-teal-700" />
                                                        {test.shuffle_questions ? 'Случайный порядок вопросов' : 'Фиксированный порядок'}
                                                    </span>
                                                    <span>Обновлено: {formatDate(test.updated_at)}</span>
                                                </div>

                                                <div className="grid gap-5 lg:grid-cols-2">
                                                    <section>
                                                        <h3 className="qd-field-label mb-3 flex items-center gap-1.5 text-[#102945]">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                                                            Вопросы ({test.questions.length})
                                                        </h3>
                                                        <div className="max-h-[300px] divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200 pr-1">
                                                            {test.questions.map((question) => (
                                                                <div key={question.id} className="flex items-start gap-3 px-3 py-2.5 text-sm text-slate-700">
                                                                    <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-teal-100 text-[11px] font-bold tabular-nums text-teal-700">
                                                                        {question.position}
                                                                    </span>
                                                                    <div>
                                                                        <div className="font-medium leading-snug text-slate-900">{question.text}</div>
                                                                        <div className="mt-1 text-xs text-slate-500">Тип: {question.type === 'single_choice' ? 'один выбор' : question.type === 'multiple_choice' ? 'множественный выбор' : 'текстовый ответ'}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>

                                                    <section>
                                                        <h3 className="qd-field-label mb-3 flex items-center gap-1.5 text-[#102945]">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                                            Результаты сдачи ({test.results?.length || 0})
                                                        </h3>
                                                        {test.results && test.results.length > 0 ? (
                                                            <div className="max-h-[300px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                                <table className="w-full text-left text-sm">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Студент</th>
                                                                            <th className="text-right">Балл</th>
                                                                            <th>Статус</th>
                                                                            <th className="text-right">Дата</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-200 text-slate-600">
                                                                        {test.results.map((res) => (
                                                                            <tr key={res.id}>
                                                                                <td className="font-medium leading-snug text-slate-900">{res.user_name}</td>
                                                                                <td className="text-right font-semibold tabular-nums text-[#102945]">{res.score}%</td>
                                                                                <td>
                                                                                    {res.passed ? (
                                                                                        <Badge variant="success">
                                                                                            <CheckCircle className="h-3 w-3" />
                                                                                            Сдано
                                                                                        </Badge>
                                                                                    ) : (
                                                                                        <Badge variant="destructive">
                                                                                            <XCircle className="h-3 w-3" />
                                                                                            Не сдано
                                                                                        </Badge>
                                                                                    )}
                                                                                </td>
                                                                                <td className="whitespace-nowrap text-right tabular-nums text-slate-500">{formatDate(res.completed_at).split(',')[0]}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                                                                Этот тест еще не проходили.
                                                            </div>
                                                        )}
                                                    </section>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>
            </div>

            <ConfirmDialog
                open={confirmState.open}
                description={confirmState.description}
                onOpenChange={(open) => setConfirmState((prev) => ({ ...prev, open }))}
                onConfirm={confirmState.onConfirm}
            />
        </AuthenticatedLayout>
    );
}

function Metric({ label, value }) {
    return (
        <div>
            <dt className="qd-field-label text-slate-500">{label}</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums text-[#102945]">{value}</dd>
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
