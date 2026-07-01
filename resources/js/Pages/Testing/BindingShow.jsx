import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, BarChart3, Pencil, Plus, Search, Shuffle, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
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

const statusTone = {
    draft: 'bg-amber-500 text-white border-0',
    published: 'bg-emerald-600 text-white border-0',
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
        <AuthenticatedLayout>
            <Head title={`Тестирование - ${binding.subject?.name || 'Привязка'}`} />

            <div className="admin-page-wrap space-y-6">
                {/* Header card with subject details and brief analytics */}
                <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#123153] via-[#15466a] to-[#0f8b94] text-white shadow-[0_16px_40px_-24px_rgba(15,35,58,0.6)] rounded-3xl">
                    <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <Link href={route('testing.index')}>
                                <Button type="button" variant="outline" className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white rounded-xl transition-all">
                                    <ArrowLeft className="h-4 w-4" />
                                    Ко всем предметам
                                </Button>
                            </Link>

                            <div className="flex flex-wrap gap-2">
                                <Link href={route('testing.bindings.analytics', binding.id)}>
                                    <Button type="button" variant="outline" className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white rounded-xl transition-all">
                                        <BarChart3 className="h-4 w-4" />
                                        Аналитика
                                    </Button>
                                </Link>
                                <Button type="button" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white rounded-xl transition-all" onClick={removeBinding}>
                                    Удалить привязку
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
                            <div className="space-y-3">
                                <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/90 backdrop-blur-sm">
                                    Привязка предмета
                                </div>
                                <h1 className="text-3xl font-bold tracking-tight">{binding.subject?.name}</h1>
                                <p className="text-sm text-white/70 font-mono tracking-wider">{binding.subject?.code || 'Без кода'}</p>
                                <p className="max-w-2xl text-sm leading-6 text-white/80">
                                    {binding.subject?.description || 'Описание предмета не заполнено.'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                    <div className="text-xs uppercase tracking-[0.15em] text-white/60">Тестов</div>
                                    <div className="mt-1 text-3xl font-bold tracking-tight">{analytics?.tests_count ?? 0}</div>
                                </div>
                                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                    <div className="text-xs uppercase tracking-[0.15em] text-white/60">Прохождений</div>
                                    <div className="mt-1 text-3xl font-bold tracking-tight">{analytics?.attempts_count ?? 0}</div>
                                </div>
                                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                    <div className="text-xs uppercase tracking-[0.15em] text-white/60">Студентов</div>
                                    <div className="mt-1 text-3xl font-bold tracking-tight">{analytics?.users_count ?? 0}</div>
                                </div>
                                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                    <div className="text-xs uppercase tracking-[0.15em] text-white/60">Средний балл</div>
                                    <div className="mt-1 text-3xl font-bold tracking-tight">{analytics?.average_score ?? 0}</div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tests Section */}
                <Card className="border border-slate-200/60 shadow-[0_4px_20px_rgba(15,23,42,0.02)] rounded-2xl">
                    <CardHeader className="pb-3 border-b border-slate-100">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <CardTitle className="text-xl font-bold text-[#132844] font-sans">Тесты по предмету</CardTitle>
                                <p className="mt-1 text-xs text-slate-400">Создавайте новые тесты, управляйте вопросами и отслеживайте результаты сдачи.</p>
                            </div>

                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row items-center">
                                <div className="relative min-w-[280px] w-full sm:w-auto">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                                    <Input className="pl-9 h-10 border-slate-200 focus-visible:ring-[#139AA4]/20 focus-visible:border-[#139AA4] rounded-lg text-xs" placeholder="Поиск по тестам…" value={search} onChange={(event) => setSearch(event.target.value)} />
                                </div>

                                <Link href={route('testing.tests.create', binding.id)} className="w-full sm:w-auto shrink-0">
                                    <Button type="button" className="gap-2 h-10 px-4 w-full sm:w-auto rounded-lg text-xs bg-gradient-to-r from-[#1b4d74] to-[#139AA4] hover:opacity-90 shadow-sm">
                                        <Plus className="h-4 w-4" />
                                        Создать тест
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-5 pt-5">
                        {filteredTests.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center text-sm text-slate-400 italic">
                                {tests.length === 0
                                    ? 'В этой привязке пока нет тестов.'
                                    : 'По вашему запросу тесты не найдены.'}
                            </div>
                        ) : (
                            filteredTests.map((test) => {
                                const isExpanded = !!expandedTests[test.id];
                                return (
                                    <div key={test.id} className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] transition-all duration-300">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="space-y-1.5">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h2 className="text-lg font-bold text-[#132844]">{test.title}</h2>
                                                        <Badge className={statusTone[test.status] || 'bg-slate-200 text-slate-700'}>
                                                            {test.status === 'published' ? 'Опубликован' : 'Черновик'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs leading-relaxed text-slate-500">{test.description || 'Описание отсутствует.'}</p>
                                                </div>

                                                <div className="flex flex-wrap gap-2 shrink-0">
                                                    <Link href={route('testing.tests.edit', test.id)}>
                                                        <Button type="button" variant="outline" className="gap-2 h-9 px-3 rounded-xl text-xs hover:bg-slate-50 border-slate-200">
                                                            <Pencil className="h-3.5 w-3.5 text-slate-500" />
                                                            Редактировать
                                                        </Button>
                                                    </Link>
                                                    <Button type="button" variant="outline" className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-slate-200 h-9 px-3 rounded-xl text-xs" onClick={() => removeTest(test.id, test.title)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Удалить
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Grid Stats */}
                                            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Вопросов в тесте</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844]">{test.question_count}</div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Подготовлено</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844]">{test.questions_total}</div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Прохождений</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844]">{test.results_count}</div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Средний балл</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844]">{test.average_score}</div>
                                                </div>
                                            </div>

                                            {/* Toggle button */}
                                            <div className="flex justify-center pt-2 border-t border-slate-100/70">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleTestExpand(test.id)}
                                                    className="gap-2 text-[#139AA4] hover:text-[#139AA4]/80 hover:bg-[#139AA4]/5 font-semibold text-xs py-1.5 px-3 rounded-lg transition-colors"
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

                                            {/* Expanded section */}
                                            {isExpanded && (
                                                <div className="space-y-5 pt-3 border-t border-slate-100 animate-in fade-in slide-in-from-top-3 duration-200">
                                                    {/* Configuration bar */}
                                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 bg-slate-50/50 px-4 py-2.5 rounded-xl border border-slate-100">
                                                        <span>Проходной балл: <strong className="text-slate-600">{test.passing_score}%</strong></span>
                                                        <span className="inline-flex items-center gap-1">
                                                            <Shuffle className="h-3.5 w-3.5 text-slate-400" />
                                                            {test.shuffle_questions ? 'Случайный порядок вопросов' : 'Фиксированный порядок'}
                                                        </span>
                                                        <span>Обновлено: {formatDate(test.updated_at)}</span>
                                                    </div>

                                                    <div className="grid gap-5 lg:grid-cols-2">
                                                        {/* Questions Box */}
                                                        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                                                            <div className="mb-3 text-[11px] uppercase font-bold tracking-widest text-[#132844] flex items-center gap-1.5">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-[#139AA4]" />
                                                                Вопросы ({test.questions.length})
                                                            </div>
                                                            <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2">
                                                                {test.questions.map((question) => (
                                                                    <div key={question.id} className="flex items-start gap-3 rounded-xl bg-white p-3 text-xs text-slate-700 shadow-sm border border-slate-100/50">
                                                                        <span className="mt-0.5 inline-flex h-5.5 w-5.5 flex-shrink-0 items-center justify-center rounded-lg bg-[#123153]/10 text-[10px] font-bold text-[#123153]">
                                                                            {question.position}
                                                                        </span>
                                                                        <div>
                                                                            <div className="font-semibold text-slate-800 leading-snug">{question.text}</div>
                                                                            <div className="mt-1 text-[9px] uppercase tracking-wider text-slate-400 font-medium">Тип: {question.type === 'single_choice' ? 'один выбор' : question.type === 'multiple_choice' ? 'множественный выбор' : 'текстовый ответ'}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Results Box */}
                                                        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                                                            <div className="mb-3 text-[11px] uppercase font-bold tracking-widest text-[#132844] flex items-center gap-1.5">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                Результаты сдачи ({test.results?.length || 0})
                                                            </div>
                                                            {test.results && test.results.length > 0 ? (
                                                                <div className="max-h-[300px] overflow-y-auto pr-1">
                                                                    <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                                                        <table className="w-full text-left text-[11px]">
                                                                            <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100">
                                                                                <tr>
                                                                                    <th className="px-3 py-2.5">Студент</th>
                                                                                    <th className="px-3 py-2.5 text-center">Балл</th>
                                                                                    <th className="px-3 py-2.5 text-center">Статус</th>
                                                                                    <th className="px-3 py-2.5 text-right">Дата</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100 text-slate-600">
                                                                                {test.results.map((res) => (
                                                                                    <tr key={res.id} className="hover:bg-slate-50/30">
                                                                                        <td className="px-3 py-2.5 font-medium text-slate-700 leading-snug">{res.user_name}</td>
                                                                                        <td className="px-3 py-2.5 text-center font-bold text-[#132844]">{res.score}%</td>
                                                                                        <td className="px-3 py-2.5 text-center">
                                                                                            {res.passed ? (
                                                                                                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                                                                                                    <CheckCircle className="h-2.5 w-2.5" />
                                                                                                    Сдано
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/10">
                                                                                                    <XCircle className="h-2.5 w-2.5" />
                                                                                                    Не сдано
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-3 py-2.5 text-right text-slate-400 whitespace-nowrap">{formatDate(res.completed_at).split(',')[0]}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400 text-xs italic">
                                                                    Этот тест еще не проходили.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
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
