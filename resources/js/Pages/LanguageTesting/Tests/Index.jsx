import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import Dropdown from '@/Components/Dropdown';
import { Button, EmptyState, FormField, FormGrid, Input } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { BookOpenText, ChevronLeft, ChevronRight, Download, MoreHorizontal, Pencil, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
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
        <AuthenticatedLayout>
            <Head title="Проверка знаний языка — Тесты" />

            <div className="admin-page-wrap space-y-6">
                <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#123153] via-[#1b4d74] to-[#139AA4] text-white shadow-[0_20px_50px_-20px_rgba(12,45,78,0.55)] rounded-3xl">
                    <CardContent className="relative flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/90 backdrop-blur-sm">
                                <BookOpenText className="h-3.5 w-3.5" />
                                Language Testing
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                                <Link href={route('testing.index')} className="transition hover:text-white">Тестирование</Link>
                                <span>/</span>
                                <span className="text-white/90">Проверка знаний языка</span>
                            </div>
                            <h1 className="text-3xl font-semibold leading-tight text-white tracking-tight">
                                Тесты по языкам для AI Students
                            </h1>
                            <p className="max-w-2xl text-sm leading-6 text-white/80">
                                Управляйте наборами вопросов, проходными баллами и лимитом выдачи в знакомом интерфейсе модуля Testing.
                            </p>
                            <div className="flex flex-wrap items-center gap-3 mt-4 pt-1">
                                {canManage ? (
                                    <Button onClick={openCreateDialog} className="bg-white text-[#132844] hover:bg-white/95 gap-2 rounded-xl transition-all font-semibold shadow-md border-0 h-10 px-5">
                                        <Plus className="h-4 w-4 text-[#132844]" />
                                        Добавить тест
                                    </Button>
                                ) : null}
                                <Button asChild variant="outline" className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white rounded-xl transition-all shadow-md h-10 px-5">
                                    <Link href={route('language-testing.statistics.index')}>
                                        <Download className="h-4 w-4 text-white" />
                                        Статистика
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        <div className="grid min-w-[240px] grid-cols-2 gap-3 shrink-0">
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                <div className="text-xs uppercase tracking-[0.15em] text-white/70">Всего тестов</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight">{pagination.total ?? tests.length}</div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                                <div className="text-xs uppercase tracking-[0.15em] text-white/70">Активных фильтров</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight">{activeFilterCount}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-4">
                    <div className="relative max-w-md shadow-sm rounded-xl">
                        <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Быстрый поиск по названию или описанию…"
                            className="pl-10 pr-9 h-11 border-slate-200 focus-visible:ring-2 focus-visible:ring-[#139AA4]/20 focus-visible:border-[#139AA4] rounded-xl bg-white shadow-sm"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.02)]">
                        <form
                            className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]"
                            onSubmit={(event) => {
                                event.preventDefault();
                                applyFilters();
                            }}
                        >
                            <FormField label="Язык">
                                <select value={language} onChange={(event) => setLanguage(event.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#139AA4]/50">
                                    <option value="">Все языки</option>
                                    {Object.entries(languageOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="Статус">
                                <select value={status} onChange={(event) => setStatus(event.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#139AA4]/50">
                                    <option value="">Все статусы</option>
                                    {Object.entries(statusOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </FormField>
                            <div className="flex items-end gap-2 lg:col-start-4">
                                <Button type="submit" className="gap-2 bg-gradient-to-r from-[#1b4d74] to-[#139AA4] hover:opacity-90 shadow-md transition-all active:scale-[0.98]">
                                    Применить
                                </Button>
                                <Button type="button" variant="outline" onClick={clearFilters} className="h-10 rounded-xl border-slate-200 hover:bg-slate-50">
                                    Сбросить
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {tests.length === 0 ? (
                    <EmptyState
                        title="Тесты не найдены"
                        description="Создайте первый тест или измените фильтры поиска."
                        action={canManage ? <Button onClick={openCreateDialog}>Создать тест</Button> : null}
                    />
                ) : (
                    <Card className="border border-slate-200/60 shadow-[0_4px_20px_rgba(15,23,42,0.02)] rounded-2xl">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-slate-100">
                            <CardTitle className="text-xl font-bold text-[#132844] font-sans">Список языковых тестов</CardTitle>
                            <Badge className="bg-[#139AA4]/10 text-[#139AA4] border-0 px-2.5 py-0.5 rounded-lg font-semibold hover:bg-[#139AA4]/10">
                                Всего: {pagination.total ?? tests.length}
                            </Badge>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                {tests.map((test) => (
                                    <div key={test.id} className="group relative rounded-3xl border border-slate-200/60 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] hover:shadow-[0_12px_30px_-10px_rgba(15,23,42,0.08)] transition-all duration-300 flex flex-col justify-between min-h-[240px]">
                                        <div className="space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-lg font-bold text-[#132844] leading-snug group-hover:text-[#139AA4] transition-colors">{test.name}</h3>
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-[11px] tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md inline-block">
                                                            {test.language_label}
                                                        </span>
                                                        <Badge className={`${test.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'} text-[11px] rounded-lg px-2.5 py-0.5 hover:bg-inherit`}>
                                                            {test.status_label}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <Dropdown>
                                                    <Dropdown.Trigger>
                                                        <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </button>
                                                    </Dropdown.Trigger>
                                                    <Dropdown.Content width="48" contentClasses="py-1 bg-white">
                                                        <Dropdown.Link href={route('language-testing.questions.index', test.id)} className="flex items-center gap-2">
                                                            <Settings2 className="h-4 w-4" />
                                                            Вопросы
                                                        </Dropdown.Link>
                                                        {canManage ? (
                                                            <button type="button" onClick={() => openEditDialog(test)} className="block w-full px-4 py-2 text-left text-sm leading-5 text-gray-700 transition duration-150 ease-in-out hover:bg-gray-100 focus:bg-gray-100 focus:outline-none">
                                                                <span className="flex items-center gap-2"><Pencil className="h-4 w-4" />Редактировать</span>
                                                            </button>
                                                        ) : null}
                                                        {canManage ? (
                                                            <button type="button" onClick={() => setDeleteTarget(test)} className="block w-full px-4 py-2 text-left text-sm leading-5 text-red-600 transition duration-150 ease-in-out hover:bg-red-50 focus:bg-red-50 focus:outline-none">
                                                                <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" />Удалить</span>
                                                            </button>
                                                        ) : null}
                                                    </Dropdown.Content>
                                                </Dropdown>
                                            </div>

                                            <p className="text-sm text-slate-500 leading-relaxed min-h-[42px]">
                                                {test.description || 'Описание не заполнено. Используйте этот тест для начального распределения студентов по уровню языка.'}
                                            </p>

                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Вопросов</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844] tracking-tight">{test.questions_count || 0}</div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Порог</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844] tracking-tight">{test.passing_score}%</div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100/50">
                                                    <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Лимит</div>
                                                    <div className="mt-1 text-lg font-bold text-[#132844] tracking-tight">{test.total_questions}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                                            <p className="text-[11px] text-slate-400">Сортировка: {sortIndicator(filters, 'name') || 'по умолчанию'}</p>
                                            <div className="flex items-center gap-2">
                                                {canManage ? (
                                                    <Button type="button" variant="outline" onClick={() => openEditDialog(test)} className="h-9 px-3 gap-2 rounded-xl text-xs hover:bg-slate-50 border-slate-200">
                                                        <Pencil className="h-3.5 w-3.5 text-slate-500" />
                                                        Изменить
                                                    </Button>
                                                ) : null}
                                                <Link href={route('language-testing.questions.index', test.id)}>
                                                    <Button type="button" className="h-9 px-4 rounded-xl text-xs bg-gradient-to-r from-[#1b4d74] to-[#139AA4] hover:opacity-90 shadow-sm">
                                                        Открыть вопросы
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div>Показано {tests.length} из {pagination.total ?? tests.length}</div>
                    <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={(pagination.current_page ?? 1) <= 1} onClick={() => goToPage((pagination.current_page ?? 1) - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span>Страница {pagination.current_page ?? 1} / {pagination.last_page ?? 1}</span>
                        <Button type="button" size="sm" variant="outline" disabled={(pagination.current_page ?? 1) >= (pagination.last_page ?? 1)} onClick={() => goToPage((pagination.current_page ?? 1) + 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-xl border-slate-200/50 shadow-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#132844]">{editingTest ? 'Редактировать тест' : 'Новый тест'}</DialogTitle>
                        <DialogDescription className="text-slate-500 text-sm">
                            Настройте язык, проходной балл и лимит вопросов для выдачи в AI Students.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submitForm} className="space-y-4">
                        <FormGrid>
                            <FormField label="Название">
                                <Input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} />
                                {form.errors.name ? <p className="text-xs text-red-600">{form.errors.name}</p> : null}
                            </FormField>
                            <FormField label="Язык">
                                <select value={form.data.language} onChange={(event) => form.setData('language', event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    {Object.entries(languageOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                {form.errors.language ? <p className="text-xs text-red-600">{form.errors.language}</p> : null}
                            </FormField>
                            <FormField label="Проходной балл (%)">
                                <Input type="number" min="1" max="100" value={form.data.passing_score} onChange={(event) => form.setData('passing_score', Number(event.target.value))} />
                                {form.errors.passing_score ? <p className="text-xs text-red-600">{form.errors.passing_score}</p> : null}
                            </FormField>
                            <FormField label="Максимум вопросов">
                                <Input type="number" min="1" max="500" value={form.data.total_questions} onChange={(event) => form.setData('total_questions', Number(event.target.value))} />
                                {form.errors.total_questions ? <p className="text-xs text-red-600">{form.errors.total_questions}</p> : null}
                            </FormField>
                            <FormField label="Статус">
                                <select value={form.data.status} onChange={(event) => form.setData('status', event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    {Object.entries(statusOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </FormField>
                        </FormGrid>

                        <FormField label="Описание">
                            <Textarea value={form.data.description} onChange={(event) => form.setData('description', event.target.value)} rows={4} />
                            {form.errors.description ? <p className="text-xs text-red-600">{form.errors.description}</p> : null}
                        </FormField>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Отмена</Button>
                            <Button type="submit" disabled={form.processing} className="gap-2 bg-gradient-to-r from-[#1b4d74] to-[#139AA4] hover:opacity-90 shadow-md transition-all active:scale-[0.98]">
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