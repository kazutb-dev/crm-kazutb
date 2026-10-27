import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Inbox, BarChart3, Pencil, Plus, Search, Shuffle, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle, ClipboardList, ListChecks, Users, Target } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

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

    const publishedCount = tests.filter((test) => test.status === 'published').length;

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
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Тесты по предмету
                            <span className="text-xs font-medium normal-case tracking-normal text-slate-500">
                                {tests.length} · опубликовано {publishedCount} · черновиков {tests.length - publishedCount}
                            </span>
                        </CardTitle>
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

                    <CardContent className="p-0">
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
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1100px] text-sm">
                                    <thead>
                                        <tr>
                                            <th>Тест</th>
                                            <th>Статус</th>
                                            <th className="text-right">В тесте</th>
                                            <th className="text-right">Подготовлено</th>
                                            <th className="text-right">Прохождений</th>
                                            <th className="text-right">Ср. балл</th>
                                            <th className="text-right">Порог</th>
                                            <th>Порядок</th>
                                            <th>Обновлено</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTests.map((test) => {
                                            const isExpanded = !!expandedTests[test.id];
                                            return (
                                                <Fragment key={test.id}>
                                                    <tr className={`align-top ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                                                        <td className="max-w-[420px]">
                                                            <div className="font-medium text-slate-900">{test.title}</div>
                                                            <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{test.description || 'Описание отсутствует.'}</div>
                                                        </td>
                                                        <td>
                                                            <Badge variant={statusVariant[test.status] || 'secondary'}>
                                                                {test.status === 'published' ? 'Опубликован' : 'Черновик'}
                                                            </Badge>
                                                        </td>
                                                        <td className="text-right font-semibold tabular-nums text-[#102945]">{test.question_count}</td>
                                                        <td className="text-right tabular-nums">{test.questions_total}</td>
                                                        <td className="text-right tabular-nums">{test.results_count}</td>
                                                        <td className="text-right tabular-nums">{test.average_score}</td>
                                                        <td className="text-right tabular-nums">{test.passing_score}%</td>
                                                        <td className="whitespace-nowrap text-xs text-slate-600">
                                                            <span className="inline-flex items-center gap-1">
                                                                <Shuffle className="h-3.5 w-3.5 text-teal-700" />
                                                                {test.shuffle_questions ? 'Случайный' : 'Фиксированный'}
                                                            </span>
                                                        </td>
                                                        <td className="whitespace-nowrap text-xs tabular-nums text-slate-500">{formatDate(test.updated_at)}</td>
                                                        <td className="text-right">
                                                            <div className="flex flex-wrap justify-end gap-2">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => toggleTestExpand(test.id)}
                                                                    aria-expanded={isExpanded}
                                                                    className="gap-1.5"
                                                                    title={isExpanded ? 'Скрыть подробности и результаты' : 'Показать подробности и результаты'}
                                                                >
                                                                    Результаты ({test.results?.length || 0})
                                                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                                </Button>
                                                                <Button asChild size="sm" variant="outline" className="gap-2">
                                                                    <Link href={route('testing.tests.edit', test.id)}>
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                        Редактировать
                                                                    </Link>
                                                                </Button>
                                                                <Button type="button" size="sm" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => removeTest(test.id, test.title)} aria-label="Удалить" title="Удалить">
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr className="bg-slate-50">
                                                            <td colSpan={10}>
                                                                <div className="grid gap-4 lg:grid-cols-2">
                                                                    <section>
                                                                        <h3 className="qd-field-label mb-2 flex items-center gap-1.5 text-[#102945]">
                                                                            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                                                                            Вопросы ({test.questions.length})
                                                                        </h3>
                                                                        <div className="max-h-[300px] divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                                                                            {test.questions.map((question) => (
                                                                                <div key={question.id} className="flex items-start gap-3 px-3 py-2 text-sm text-slate-700">
                                                                                    <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-teal-100 text-[11px] font-bold tabular-nums text-teal-700">
                                                                                        {question.position}
                                                                                    </span>
                                                                                    <div className="min-w-0">
                                                                                        <span className="font-medium leading-snug text-slate-900">{question.text}</span>
                                                                                        <span className="ml-2 text-xs text-slate-500">{question.type === 'single_choice' ? 'один выбор' : question.type === 'multiple_choice' ? 'множественный выбор' : 'текстовый ответ'}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </section>

                                                                    <section>
                                                                        <h3 className="qd-field-label mb-2 flex items-center gap-1.5 text-[#102945]">
                                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                                                            Результаты сдачи ({test.results?.length || 0})
                                                                        </h3>
                                                                        {test.results && test.results.length > 0 ? (
                                                                            <div className="max-h-[300px] overflow-auto rounded-xl border border-slate-200 bg-white">
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
                                                                            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                                                                                Этот тест еще не проходили.
                                                                            </div>
                                                                        )}
                                                                    </section>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
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
