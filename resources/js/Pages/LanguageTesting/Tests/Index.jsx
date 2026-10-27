import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, EmptyState, FilterBar, FormField, FormGrid, Input, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Filter, Languages, ListChecks, Pencil, Plus, Search, Settings2, Target, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';

function sortIndicator(filters, column) {
    if (filters.sort !== column) return '';
    return filters.direction === 'desc' ? ' ↓' : ' ↑';
}

export default function LanguageTestingTestsIndex({ tests = [], filters = {}, pagination = {}, options = {}, permissions = {} }) {
    const canManage = Boolean(permissions.canManage);
    const languageOptions = options.languages ?? {};
    const statusOptions = options.statuses ?? {};

    const [search, setSearch] = useState(filters.q ?? '');
    const [language, setLanguage] = useState(filters.language ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [editingTest, setEditingTest] = useState(null);

    const form = useForm({
        name: '',
        language: Object.keys(languageOptions)[0] ?? 'english',
        description: '',
        passing_score: 60,
        total_questions: 20,
        status: 'active',
    });

    const activeCount = tests.filter((test) => test.status === 'active').length;
    const questionsTotal = tests.reduce((sum, test) => sum + (Number(test.questions_count) || 0), 0);
    const avgPassing = tests.length ? Math.round(tests.reduce((sum, test) => sum + (Number(test.passing_score) || 0), 0) / tests.length) : null;
    const languageBreakdown = Object.entries(tests.reduce((acc, test) => {
        const key = test.language_label || test.language || '—';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
    }, {}));

    const activeFilterCount = useMemo(() => [search, language, status].filter((value) => String(value ?? '').trim() !== '').length, [language, search, status]);

    const applyFilters = (patch = {}, resetPage = true) => {
        const payload = {
            ...filters,
            q: search,
            language,
            status,
            ...patch,
        };

        if (resetPage) payload.page = 1;

        router.get(route('language-testing.tests.index'), payload, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearFilters = () => {
        setSearch('');
        setLanguage('');
        setStatus('');

        router.get(route('language-testing.tests.index'), {
            per_page: filters.per_page ?? pagination.per_page ?? 10,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const toggleSort = (column) => {
        const nextDirection = filters.sort === column && filters.direction === 'asc' ? 'desc' : 'asc';
        applyFilters({ sort: column, direction: nextDirection }, false);
    };

    const goToPage = (page) => {
        if (!page || page < 1 || page > (pagination.last_page ?? 1)) return;
        applyFilters({ page }, false);
    };

    const openCreateDialog = () => {
        setEditingTest(null);
        form.reset();
        form.setData({
            name: '',
            language: Object.keys(languageOptions)[0] ?? 'english',
            description: '',
            passing_score: 60,
            total_questions: 20,
            status: 'active',
        });
        form.clearErrors();
        setDialogOpen(true);
    };

    const openEditDialog = (test) => {
        setEditingTest(test);
        form.setData({
            name: test.name ?? '',
            language: test.language ?? (Object.keys(languageOptions)[0] ?? 'english'),
            description: test.description ?? '',
            passing_score: test.passing_score ?? 60,
            total_questions: test.total_questions ?? 20,
            status: test.status ?? 'active',
        });
        form.clearErrors();
        setDialogOpen(true);
    };

    const submitForm = (event) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setDialogOpen(false);
                setEditingTest(null);
            },
        };

        if (editingTest) {
            form.patch(route('language-testing.tests.update', editingTest.id), options);
            return;
        }

        form.post(route('language-testing.tests.store'), options);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;

        router.delete(route('language-testing.tests.destroy', deleteTarget.id), {
            preserveScroll: true,
            onSuccess: () => setDeleteTarget(null),
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow={(
                        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                            <Link href={route('testing.index')} className="transition hover:text-[#102945]">Тестирование</Link>
                            <span>/</span>
                            <span>Проверка знаний языка</span>
                        </span>
                    )}
                    title="Тесты по языкам для AI Students"
                    description="Управляйте наборами вопросов, проходными баллами и лимитом выдачи вопросов."
                    actions={(
                        <>
                            <Button asChild variant="outline" className="gap-2">
                                <Link href={route('language-testing.statistics.index')}>
                                    <Download className="h-4 w-4" />
                                    Статистика
                                </Link>
                            </Button>
                            {canManage ? (
                                <Button onClick={openCreateDialog} className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Добавить тест
                                </Button>
                            ) : null}
                        </>
                    )}
                />
            )}
        >
            <Head title="Проверка знаний языка — Тесты" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего тестов" value={pagination.total ?? tests.length} tone="teal" icon={Languages} />
                    <StatTile label="Активных" value={activeCount} tone="success" icon={CheckCircle2} hint="на странице" />
                    <StatTile label="Вопросов в банке" value={questionsTotal} tone="navy" icon={ListChecks} hint="сумма по тестам на странице" />
                    <StatTile label="Средний порог" value={avgPassing === null ? '—' : `${avgPassing}%`} tone="gold" icon={Target} />
                    <StatTile label="Активных фильтров" value={activeFilterCount} tone="neutral" icon={Filter} />
                </StatGrid>

                <FilterBar>
                    <form
                        className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto] xl:items-end"
                        onSubmit={(event) => {
                            event.preventDefault();
                            applyFilters();
                        }}
                    >
                        <div className="md:col-span-2 xl:col-span-1">
                            <FormField label="Поиск">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Быстрый поиск по названию или описанию…"
                                        className="pl-9 pr-9"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            aria-label="Очистить поиск"
                                            onClick={() => setSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </FormField>
                        </div>
                        <FormField label="Язык">
                            <select value={language} onChange={(event) => setLanguage(event.target.value)} className={qdFieldClass}>
                                <option value="">Все языки</option>
                                {Object.entries(languageOptions).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Статус">
                            <select value={status} onChange={(event) => setStatus(event.target.value)} className={qdFieldClass}>
                                <option value="">Все статусы</option>
                                {Object.entries(statusOptions).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </FormField>
                        <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-1">
                            <Button type="submit">Применить</Button>
                            <Button type="button" variant="outline" onClick={clearFilters}>Сбросить</Button>
                        </div>
                    </form>
                </FilterBar>

                {tests.length === 0 ? (
                    <EmptyState
                        title="Тесты не найдены"
                        description="Создайте первый тест или измените фильтры поиска."
                        action={canManage ? <Button onClick={openCreateDialog}>Создать тест</Button> : null}
                    />
                ) : (
                    <Card className="overflow-hidden">
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2"><Languages className="h-4 w-4" />Список языковых тестов</CardTitle>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {languageBreakdown.map(([label, count]) => (
                                    <Badge key={label} variant="info" className="tabular-nums">{label}: {count}</Badge>
                                ))}
                                <Badge variant="default" className="tabular-nums">Всего: {pagination.total ?? tests.length}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[920px] text-sm">
                                    <thead>
                                        <tr>
                                            <th>
                                                <button type="button" onClick={() => toggleSort('name')} className="uppercase tracking-[inherit] hover:text-teal-700">
                                                    Тест{sortIndicator(filters, 'name')}
                                                </button>
                                            </th>
                                            <th>Язык</th>
                                            <th>Статус</th>
                                            <th className="text-right">Вопросов</th>
                                            <th className="text-right">Порог</th>
                                            <th className="text-right">Лимит</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tests.map((test) => (
                                            <tr key={test.id} className="align-top hover:bg-slate-50">
                                                <td className="max-w-[560px]">
                                                    <div className="font-medium text-slate-900">{test.name}</div>
                                                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                                                        {test.description || 'Описание не заполнено. Используйте этот тест для начального распределения студентов по уровню языка.'}
                                                    </div>
                                                </td>
                                                <td><Badge variant="info">{test.language_label}</Badge></td>
                                                <td>
                                                    <Badge variant={test.status === 'active' ? 'success' : 'warning'}>{test.status_label}</Badge>
                                                </td>
                                                <td className="text-right font-semibold tabular-nums text-[#102945]">{test.questions_count || 0}</td>
                                                <td className="text-right tabular-nums">{test.passing_score}%</td>
                                                <td className="text-right tabular-nums">
                                                    {test.total_questions}
                                                    {(test.questions_count || 0) < (test.total_questions || 0) ? (
                                                        <div className="text-[11px] text-amber-700">в банке меньше лимита</div>
                                                    ) : null}
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        <Button asChild size="sm">
                                                            <Link href={route('language-testing.questions.index', test.id)}>
                                                                <Settings2 className="h-3.5 w-3.5" />
                                                                Вопросы
                                                            </Link>
                                                        </Button>
                                                        {canManage ? (
                                                            <>
                                                                <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(test)} aria-label="Редактировать" title="Редактировать">
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button type="button" size="sm" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setDeleteTarget(test)} aria-label="Удалить" title="Удалить">
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600 sm:px-6">
                                <div className="tabular-nums">Показано {tests.length} из {pagination.total ?? tests.length}</div>
                                <div className="flex items-center gap-2">
                                    <Button type="button" size="sm" variant="outline" aria-label="Предыдущая страница" disabled={(pagination.current_page ?? 1) <= 1} onClick={() => goToPage((pagination.current_page ?? 1) - 1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="tabular-nums">Страница {pagination.current_page ?? 1} / {pagination.last_page ?? 1}</span>
                                    <Button type="button" size="sm" variant="outline" aria-label="Следующая страница" disabled={(pagination.current_page ?? 1) >= (pagination.last_page ?? 1)} onClick={() => goToPage((pagination.current_page ?? 1) + 1)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingTest ? 'Редактировать тест' : 'Новый тест'}</DialogTitle>
                        <DialogDescription>
                            Настройте язык, проходной балл и лимит вопросов для выдачи в AI Students.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submitForm} className="space-y-4">
                        <FormGrid>
                            <FormField label="Название">
                                <Input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} />
                                {form.errors.name ? <p className="text-xs text-red-700">{form.errors.name}</p> : null}
                            </FormField>
                            <FormField label="Язык">
                                <select value={form.data.language} onChange={(event) => form.setData('language', event.target.value)} className={qdFieldClass}>
                                    {Object.entries(languageOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                {form.errors.language ? <p className="text-xs text-red-700">{form.errors.language}</p> : null}
                            </FormField>
                            <FormField label="Проходной балл (%)">
                                <Input type="number" min="1" max="100" value={form.data.passing_score} onChange={(event) => form.setData('passing_score', Number(event.target.value))} />
                                {form.errors.passing_score ? <p className="text-xs text-red-700">{form.errors.passing_score}</p> : null}
                            </FormField>
                            <FormField label="Максимум вопросов">
                                <Input type="number" min="1" max="500" value={form.data.total_questions} onChange={(event) => form.setData('total_questions', Number(event.target.value))} />
                                {form.errors.total_questions ? <p className="text-xs text-red-700">{form.errors.total_questions}</p> : null}
                            </FormField>
                            <FormField label="Статус">
                                <select value={form.data.status} onChange={(event) => form.setData('status', event.target.value)} className={qdFieldClass}>
                                    {Object.entries(statusOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </FormField>
                        </FormGrid>

                        <FormField label="Описание">
                            <Textarea value={form.data.description} onChange={(event) => form.setData('description', event.target.value)} rows={4} />
                            {form.errors.description ? <p className="text-xs text-red-700">{form.errors.description}</p> : null}
                        </FormField>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={form.processing} className="gap-2">
                                {editingTest ? 'Сохранить изменения' : 'Создать тест'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
                title="Удалить тест"
                description={deleteTarget ? `Тест «${deleteTarget.name}» будет удален вместе с вопросами, сессиями и результатами.` : 'Удалить тест?'}
                confirmLabel="Удалить"
                onConfirm={confirmDelete}
            />
        </AuthenticatedLayout>
    );
}
