import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, Card, CardContent, EmptyState, FilterBar, FormField, FormGrid, Input, PageHeader, StatusBadge } from '@/components/platform';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, ChevronLeft, ChevronRight, GripVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

function createEmptyOptions() {
    return [
        { text: '', is_correct: true },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
    ];
}

export default function LanguageTestingQuestionsIndex({ test, questions = [], filters = {}, pagination = {}, permissions = {} }) {
    const canManage = Boolean(permissions.canManage);
    const [search, setSearch] = useState(filters.q ?? '');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [draggingQuestionId, setDraggingQuestionId] = useState(null);
    const [localQuestions, setLocalQuestions] = useState(questions);

    const form = useForm({
        question: '',
        points: 1,
        sort_order: '',
        options: createEmptyOptions(),
    });

    useEffect(() => {
        setLocalQuestions(questions);
    }, [questions]);

    const activeFilterCount = useMemo(() => [search].filter((value) => String(value ?? '').trim() !== '').length, [search]);

    const applyFilters = (patch = {}, resetPage = true) => {
        const payload = {
            ...filters,
            q: search,
            ...patch,
        };

        if (resetPage) payload.page = 1;

        router.get(route('language-testing.questions.index', test.id), payload, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearFilters = () => {
        setSearch('');
        router.get(route('language-testing.questions.index', test.id), {
            per_page: filters.per_page ?? pagination.per_page ?? 10,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const goToPage = (page) => {
        if (!page || page < 1 || page > (pagination.last_page ?? 1)) return;
        applyFilters({ page }, false);
    };

    const openCreateDialog = () => {
        setEditingQuestion(null);
        form.setData({
            question: '',
            points: 1,
            sort_order: '',
            options: createEmptyOptions(),
        });
        form.clearErrors();
        setDialogOpen(true);
    };

    const openEditDialog = (question) => {
        setEditingQuestion(question);
        form.setData({
            question: question.question ?? '',
            points: question.points ?? 1,
            sort_order: question.sort_order ?? '',
            options: (question.options ?? []).map((option) => ({ text: option.text, is_correct: Boolean(option.is_correct) })),
        });
        form.clearErrors();
        setDialogOpen(true);
    };

    const updateOption = (index, patch) => {
        const nextOptions = [...form.data.options];
        nextOptions[index] = { ...nextOptions[index], ...patch };
        form.setData('options', nextOptions);
    };

    const setCorrectOption = (index) => {
        form.setData('options', form.data.options.map((option, optionIndex) => ({ ...option, is_correct: optionIndex === index })));
    };

    const addOption = () => {
        if (form.data.options.length >= 10) return;
        form.setData('options', [...form.data.options, { text: '', is_correct: false }]);
    };

    const removeOption = (index) => {
        if (form.data.options.length <= 2) return;
        const nextOptions = form.data.options.filter((_, optionIndex) => optionIndex !== index);
        const hasCorrect = nextOptions.some((option) => option.is_correct);
        form.setData('options', hasCorrect ? nextOptions : nextOptions.map((option, optionIndex) => ({ ...option, is_correct: optionIndex === 0 })));
    };

    const submitForm = (event) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setDialogOpen(false);
                setEditingQuestion(null);
            },
        };

        if (editingQuestion) {
            form.patch(route('language-testing.questions.update', editingQuestion.id), options);
            return;
        }

        form.post(route('language-testing.questions.store', test.id), options);
    };

    const handleDragStart = (event, questionId) => {
        if (!canManage) return;
        setDraggingQuestionId(questionId);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(questionId));
    };

    const reorderLocalQuestions = (draggedQuestionId, targetQuestionId) => {
        const nextQuestions = [...localQuestions];
        const draggedIndex = nextQuestions.findIndex((question) => question.id === draggedQuestionId);
        const targetIndex = nextQuestions.findIndex((question) => question.id === targetQuestionId);

        if (draggedIndex < 0 || targetIndex < 0) return nextQuestions;

        const [draggedQuestion] = nextQuestions.splice(draggedIndex, 1);
        nextQuestions.splice(targetIndex, 0, draggedQuestion);

        return nextQuestions.map((question, index) => ({ ...question, sort_order: index + 1 }));
    };

    const persistOrder = (nextQuestions) => {
        setLocalQuestions(nextQuestions);
        router.patch(route('language-testing.questions.reorder', test.id), {
            question_ids: nextQuestions.map((question) => question.id),
        }, {
            preserveScroll: true,
            onFinish: () => setDraggingQuestionId(null),
        });
    };

    const handleDrop = (event, targetQuestionId) => {
        event.preventDefault();
        if (!canManage) return;

        const raw = event.dataTransfer.getData('text/plain');
        const draggedQuestionId = Number(raw);

        if (!Number.isFinite(draggedQuestionId) || draggedQuestionId === targetQuestionId) return;

        persistOrder(reorderLocalQuestions(draggedQuestionId, targetQuestionId));
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(route('language-testing.questions.destroy', deleteTarget.id), {
            preserveScroll: true,
            onSuccess: () => setDeleteTarget(null),
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Проверка знаний языка"
                    title={`Вопросы: ${test?.name ?? ''}`}
                    description="Управляйте банком вопросов, вариантами ответов и порядком показа через drag & drop."
                    actions={(
                        <div className="flex flex-wrap items-center gap-2">
                            <Button asChild variant="outline" className="gap-2">
                                <Link href={route('language-testing.tests.index')}>
                                    <ArrowLeft className="h-4 w-4" />
                                    К тестам
                                </Link>
                            </Button>
                            {canManage ? (
                                <Button onClick={openCreateDialog} className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Добавить вопрос
                                </Button>
                            ) : null}
                        </div>
                    )}
                    meta={(
                        <div className="flex flex-wrap gap-2">
                            <StatusBadge tone="info">{test?.language_label}</StatusBadge>
                            <StatusBadge tone={test?.status === 'active' ? 'success' : 'warning'}>{test?.status_label}</StatusBadge>
                        </div>
                    )}
                />
            )}
        >
            <Head title="Проверка знаний языка — Вопросы" />

            <div className="admin-page-wrap space-y-6">
                <FilterBar>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            applyFilters();
                        }}
                    >
                        <FormField label="Поиск вопроса">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Введите текст вопроса" />
                            </div>
                        </FormField>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 mt-2">
                            <StatusBadge tone="default">Активных фильтров: {activeFilterCount}</StatusBadge>
                            <div className="ml-auto flex items-center gap-2">
                                <Button type="submit">Применить</Button>
                                <Button type="button" variant="outline" onClick={clearFilters}>Сбросить</Button>
                            </div>
                        </div>
                    </form>
                </FilterBar>

                {localQuestions.length === 0 ? (
                    <EmptyState
                        title="Вопросы не найдены"
                        description="Добавьте вопрос или измените поисковый запрос."
                        action={canManage ? <Button onClick={openCreateDialog}>Добавить вопрос</Button> : null}
                    />
                ) : (
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                        <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left">
                                <tr>
                                    <th className="w-12"></th>
                                    <th>Вопрос</th>
                                    <th className="text-right">Баллы</th>
                                    <th className="text-right">Порядок</th>
                                    <th>Правильный ответ</th>
                                    <th className="text-right">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {localQuestions.map((question) => (
                                    <tr
                                        key={question.id} className={`align-top hover:bg-slate-50 ${draggingQuestionId === question.id ? 'opacity-60' : ''}`}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={(event) => handleDrop(event, question.id)}
                                    >
                                        <td>
                                            {canManage ? (
                                                <button
                                                    type="button"
                                                    draggable
                                                    onDragStart={(event) => handleDragStart(event, question.id)}
                                                    onDragEnd={() => setDraggingQuestionId(null)}
                                                    aria-label="Перетащить для изменения порядка"
                                                    className="cursor-grab rounded-[10px] border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
                                                >
                                                    <GripVertical className="h-4 w-4" />
                                                </button>
                                            ) : null}
                                        </td>
                                        <td>
                                            <div className="space-y-2">
                                                <p className="font-medium text-slate-900">{question.question}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {(question.options ?? []).map((option) => (
                                                        <span key={option.id} className={`rounded-full border px-2.5 py-0.5 text-xs ${option.is_correct ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                                                            {option.text}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-right tabular-nums">{question.points}</td>
                                        <td className="text-right tabular-nums">{question.sort_order}</td>
                                        <td className="text-slate-700">{(question.options ?? []).find((option) => option.is_correct)?.text ?? '—'}</td>
                                        <td>
                                            <div className="flex justify-end gap-2">
                                                {canManage ? (
                                                    <>
                                                        <Button type="button" variant="outline" size="sm" aria-label="Редактировать" title="Редактировать" onClick={() => openEditDialog(question)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button type="button" variant="ghost" size="sm" aria-label="Удалить" title="Удалить" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setDeleteTarget(question)}>
                                                            <Trash2 className="h-4 w-4" />
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
                            <div className="tabular-nums">Показано {localQuestions.length} из {pagination.total ?? localQuestions.length}</div>
                            <div className="flex items-center gap-2">
                                <Button type="button" size="sm" variant="outline" disabled={(pagination.current_page ?? 1) <= 1} onClick={() => goToPage((pagination.current_page ?? 1) - 1)}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="tabular-nums">Страница {pagination.current_page ?? 1} / {pagination.last_page ?? 1}</span>
                                <Button type="button" size="sm" variant="outline" disabled={(pagination.current_page ?? 1) >= (pagination.last_page ?? 1)} onClick={() => goToPage((pagination.current_page ?? 1) + 1)}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        </CardContent>
                    </Card>
                )}

            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editingQuestion ? 'Редактировать вопрос' : 'Добавить вопрос'}</DialogTitle>
                        <DialogDescription>Используется только тип Single Choice. Один ответ должен быть отмечен как правильный.</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submitForm} className="space-y-4">
                        <FormGrid>
                            <div className="md:col-span-2">
                                <FormField label="Текст вопроса">
                                    <Textarea value={form.data.question} onChange={(event) => form.setData('question', event.target.value)} rows={4} />
                                    {form.errors.question ? <p className="text-xs text-red-700">{form.errors.question}</p> : null}
                                </FormField>
                            </div>
                            <FormField label="Баллы">
                                <Input type="number" min="1" max="100" value={form.data.points} onChange={(event) => form.setData('points', Number(event.target.value))} />
                            </FormField>
                            <FormField label="Порядок отображения">
                                <Input type="number" min="0" value={form.data.sort_order} onChange={(event) => form.setData('sort_order', event.target.value)} placeholder="Автоматически" />
                            </FormField>
                        </FormGrid>

                        <div className="space-y-3 border-t border-slate-200 pt-4">
                            <div className="flex items-center justify-between">
                                <p className="qd-field-label">Варианты ответов</p>
                                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addOption} disabled={form.data.options.length >= 10}>
                                    <Plus className="h-3.5 w-3.5" />
                                    Добавить вариант
                                </Button>
                            </div>
                            {form.errors.options ? <p className="text-xs text-red-700">{form.errors.options}</p> : null}
                            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                                {form.data.options.map((option, index) => (
                                    <div key={`option-${index}`} className={`grid gap-3 p-3 md:grid-cols-[1fr_auto_auto] md:items-center ${option.is_correct ? 'bg-emerald-50' : 'bg-white'}`}>
                                        <Input value={option.text} onChange={(event) => updateOption(index, { text: event.target.value })} placeholder={`Вариант ${index + 1}`} />
                                        <label className="flex items-center gap-2 text-sm text-slate-700">
                                            <input type="radio" name="correct-option" className="h-4 w-4 accent-teal-700" checked={option.is_correct} onChange={() => setCorrectOption(index)} />
                                            Правильный
                                        </label>
                                        <Button type="button" variant="ghost" size="sm" aria-label="Удалить вариант" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => removeOption(index)} disabled={form.data.options.length <= 2}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={form.processing}>{editingQuestion ? 'Сохранить' : 'Добавить'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
                title="Удалить вопрос"
                description={deleteTarget ? `Вопрос «${deleteTarget.question}» будет удален вместе со всеми вариантами ответов.` : 'Удалить вопрос?'}
                confirmLabel="Удалить"
                onConfirm={confirmDelete}
            />
        </AuthenticatedLayout>
    );
}