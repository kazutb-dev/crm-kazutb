import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import Dropdown from '@/Components/Dropdown';
import { Button, EmptyState, FilterBar, FormField, FormGrid, Input, PageHeader, SectionHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ChevronLeft, Filter, Languages, ChevronRight, Download, MoreHorizontal, Pencil, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
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
                    <StatTile label="Активных фильтров" value={activeFilterCount} tone="navy" icon={Filter} />
                </StatGrid>

                <FilterBar>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            applyFilters();
                        }}
                    >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="md:col-span-2">
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
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 mt-2">
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
                    <div className="space-y-4">
                        <SectionHeader
                            title="Список языковых тестов"
                            actions={<Badge variant="default" className="tabular-nums">Всего: {pagination.total ?? tests.length}</Badge>}
                        />
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {tests.map((test) => (
                                <Card key={test.id} className="flex min-h-[240px] flex-col">
                                    <CardContent className="flex flex-1 flex-col gap-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h3 className="font-display text-lg font-bold leading-snug text-[#102945]">{test.name}</h3>
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <Badge variant="info">{test.language_label}</Badge>
                                                    <Badge variant={test.status === 'active' ? 'success' : 'warning'}>
                                                        {test.status_label}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Dropdown>
                                                <Dropdown.Trigger>
                                                    <button type="button" aria-label="Действия" className="rounded-[10px] p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#102945]">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </button>
                                                </Dropdown.Trigger>
                                                <Dropdown.Content width="48" contentClasses="py-1 bg-white">
                                                    <Dropdown.Link href={route('language-testing.questions.index', test.id)} className="flex items-center gap-2">
                                                        <Settings2 className="h-4 w-4" />
                                                        Вопросы
                                                    </Dropdown.Link>
                                                    {canManage ? (
                                                        <button type="button" onClick={() => openEditDialog(test)} className="block w-full px-4 py-2 text-left text-sm leading-5 text-slate-700 transition duration-150 ease-in-out hover:bg-slate-100 focus:bg-slate-100 focus:outline-none">
                                                            <span className="flex items-center gap-2"><Pencil className="h-4 w-4" />Редактировать</span>
                                                        </button>
                                                    ) : null}
                                                    {canManage ? (
                                                        <button type="button" onClick={() => setDeleteTarget(test)} className="block w-full px-4 py-2 text-left text-sm leading-5 text-red-700 transition duration-150 ease-in-out hover:bg-red-50 focus:bg-red-50 focus:outline-none">
                                                            <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" />Удалить</span>
                                                        </button>
                                                    ) : null}
                                                </Dropdown.Content>
                                            </Dropdown>
                                        </div>

                                        <p className="min-h-[42px] text-sm leading-relaxed text-slate-600">
                                            {test.description || 'Описание не заполнено. Используйте этот тест для начального распределения студентов по уровню языка.'}
                                        </p>

                                        <dl className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
                                            <Metric label="Вопросов" value={test.questions_count || 0} />
                                            <Metric label="Порог" value={`${test.passing_score}%`} />
                                            <Metric label="Лимит" value={test.total_questions} />
                                        </dl>

                                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                                            <p className="text-xs text-slate-500">Сортировка: {sortIndicator(filters, 'name') || 'по умолчанию'}</p>
                                            <div className="flex items-center gap-2">
                                                {canManage ? (
                                                    <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(test)} className="gap-2">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        Изменить
                                                    </Button>
                                                ) : null}
                                                <Button asChild size="sm">
                                                    <Link href={route('language-testing.questions.index', test.id)}>
                                                        Открыть вопросы
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {tests.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
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

function Metric({ label, value }) {
    return (
        <div>
            <dt className="qd-field-label text-slate-500">{label}</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums text-[#102945]">{value}</dd>
        </div>
    );
}
