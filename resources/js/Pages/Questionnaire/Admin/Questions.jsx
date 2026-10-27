import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, FormField, LoadingState, Notice, PageHeader, SectionHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { ListChecks, Pencil, Plus, Save, Search, Settings2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const emptyQuestionForm = {
    survey_id: '',
    question_text: '',
    question_type: 'single_choice',
    is_required: true,
    sort_order: 0,
};

const emptySurveyForm = {
    title: '',
    description: '',
    academic_year: '',
    semester: '1',
    target_scope: 'global',
    target_group_id: '',
    start_date: '',
    end_date: '',
    status: 'active',
};

const emptyOptionForm = {
    question_id: '',
    option_text: '',
    score: '',
    sort_order: 0,
};

export default function Questions() {
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [surveys, setSurveys] = useState([]);
    const [groups, setGroups] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [options, setOptions] = useState([]);

    const [surveyForm, setSurveyForm] = useState(emptySurveyForm);
    const [questionForm, setQuestionForm] = useState(emptyQuestionForm);
    const [optionForm, setOptionForm] = useState(emptyOptionForm);

    const [editingSurveyId, setEditingSurveyId] = useState(null);
    const [editingQuestionId, setEditingQuestionId] = useState(null);
    const [editingOptionId, setEditingOptionId] = useState(null);

    const [selectedSurveyId, setSelectedSurveyId] = useState('');
    const [selectedQuestionId, setSelectedQuestionId] = useState('');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [questionSearch, setQuestionSearch] = useState('');

    const selectedQuestions = useMemo(() => {
        const surveyFiltered = !selectedSurveyId
            ? questions
            : questions.filter((question) => String(question.survey_id) === String(selectedSurveyId));

        const term = questionSearch.trim().toLowerCase();
        if (!term) {
            return surveyFiltered;
        }

        return surveyFiltered.filter((question) => {
            return [question.question_text, question.question_type, question.survey?.title]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(term);
        });
    }, [questions, selectedSurveyId, questionSearch]);

    const loadAll = async () => {
        setLoading(true);
        setError('');

        try {
            const [surveysResponse, questionsResponse] = await Promise.all([
                axios.get('/api/questionnaire/admin/surveys'),
                axios.get('/api/questionnaire/admin/questions'),
            ]);

            setSurveys(surveysResponse.data?.data ?? []);
            setGroups(surveysResponse.data?.meta?.groups ?? []);
            setQuestions(questionsResponse.data?.data ?? []);
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось загрузить вопросы.');
        } finally {
            setLoading(false);
        }
    };

    const loadOptions = async (questionId) => {
        if (!questionId) {
            setOptions([]);
            return;
        }

        try {
            const response = await axios.get('/api/questionnaire/admin/options', {
                params: { question_id: questionId },
            });
            setOptions(response.data?.data ?? []);
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось загрузить опции.');
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    const submitSurvey = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        try {
            const payload = {
                ...surveyForm,
                target_group_id: surveyForm.target_scope === 'group' && surveyForm.target_group_id !== ''
                    ? Number(surveyForm.target_group_id)
                    : null,
            };

            if (editingSurveyId) {
                await axios.patch(`/api/questionnaire/admin/surveys/${editingSurveyId}`, payload);
                setSuccess('Опрос обновлен.');
            } else {
                await axios.post('/api/questionnaire/admin/surveys', payload);
                setSuccess('Опрос создан.');
            }

            setSurveyForm(emptySurveyForm);
            setEditingSurveyId(null);
            await loadAll();
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения опроса.');
        }
    };

    const startEditSurvey = (survey) => {
        setEditingSurveyId(survey.id);
        setSurveyForm({
            title: survey.title || '',
            description: survey.description || '',
            academic_year: survey.academic_year || '',
            semester: survey.semester || '1',
            target_scope: survey.target_scope || 'global',
            target_group_id: survey.target_group_id ? String(survey.target_group_id) : '',
            start_date: survey.start_date || '',
            end_date: survey.end_date || '',
            status: survey.status || 'active',
        });
    };

    const removeSurvey = async (surveyId) => {
        setConfirmState({
            open: true,
            description: 'Удалить опрос? Все вопросы и ответы по нему тоже будут удалены.',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/surveys/${surveyId}`);
                    if (String(selectedSurveyId) === String(surveyId)) {
                        setSelectedSurveyId('');
                    }
                    setSuccess('Опрос удален.');
                    await loadAll();
                } catch (e) {
                    setError(e?.response?.data?.message || 'Ошибка удаления опроса.');
                }
            },
        });
    };

    useEffect(() => {
        if (selectedQuestionId) {
            loadOptions(selectedQuestionId);
        }
    }, [selectedQuestionId]);

    const submitQuestion = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        try {
            const payload = {
                ...questionForm,
                survey_id: Number(questionForm.survey_id),
                is_required: Boolean(questionForm.is_required),
                sort_order: Number(questionForm.sort_order || 0),
            };

            if (editingQuestionId) {
                await axios.patch(`/api/questionnaire/admin/questions/${editingQuestionId}`, payload);
                setSuccess('Вопрос обновлен.');
            } else {
                await axios.post('/api/questionnaire/admin/questions', payload);
                setSuccess('Вопрос создан.');
            }

            setQuestionForm(emptyQuestionForm);
            setEditingQuestionId(null);
            await loadAll();
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения вопроса.');
        }
    };

    const submitOption = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        try {
            const payload = {
                ...optionForm,
                question_id: Number(optionForm.question_id),
                score: optionForm.score === '' ? null : Number(optionForm.score),
                sort_order: Number(optionForm.sort_order || 0),
            };

            if (editingOptionId) {
                await axios.patch(`/api/questionnaire/admin/options/${editingOptionId}`, payload);
                setSuccess('Опция обновлена.');
            } else {
                await axios.post('/api/questionnaire/admin/options', payload);
                setSuccess('Опция создана.');
            }

            setOptionForm((prev) => ({ ...emptyOptionForm, question_id: prev.question_id }));
            setEditingOptionId(null);
            await loadOptions(optionForm.question_id);
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения опции.');
        }
    };

    const startEditQuestion = (question) => {
        setEditingQuestionId(question.id);
        setQuestionForm({
            survey_id: String(question.survey_id),
            question_text: question.question_text,
            question_type: question.question_type,
            is_required: Boolean(question.is_required),
            sort_order: question.sort_order || 0,
        });
    };

    const removeQuestion = async (questionId) => {
        setConfirmState({
            open: true,
            description: 'Удалить вопрос?',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/questions/${questionId}`);
                    if (selectedQuestionId && String(selectedQuestionId) === String(questionId)) {
                        setSelectedQuestionId('');
                        setOptions([]);
                        setOptionForm(emptyOptionForm);
                    }
                    setSuccess('Вопрос удален.');
                    await loadAll();
                } catch (e) {
                    setError(e?.response?.data?.message || 'Ошибка удаления вопроса.');
                }
            },
        });
    };

    const startEditOption = (option) => {
        setEditingOptionId(option.id);
        setOptionForm({
            question_id: String(option.question_id),
            option_text: option.option_text,
            score: option.score ?? '',
            sort_order: option.sort_order || 0,
        });
    };

    const removeOption = async (optionId) => {
        setConfirmState({
            open: true,
            description: 'Удалить опцию?',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/options/${optionId}`);
                    setSuccess('Опция удалена.');
                    await loadOptions(optionForm.question_id || selectedQuestionId);
                } catch (e) {
                    setError(e?.response?.data?.message || 'Ошибка удаления опции.');
                }
            },
        });
    };

    const questionTypeStats = {
        single_choice: questions.filter((item) => item.question_type === 'single_choice').length,
        multiple_choice: questions.filter((item) => item.question_type === 'multiple_choice').length,
        text: questions.filter((item) => item.question_type === 'text').length,
        numeric: questions.filter((item) => item.question_type === 'numeric').length,
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Опросы, вопросы и опции"
                    description="Создавайте опросы с привязкой ко всем связкам преподаватель+дисциплина или к конкретной группе, затем наполняйте вопросами."
                    meta={<StatusBadge tone="default">{questions.length} вопросов</StatusBadge>}
                />
            )}
        >
            <Head title="Анкетирование - Опросы, вопросы и опции" />

            <div className="admin-page-wrap space-y-8">
                <StatGrid>
                    <StatTile label="Анкет" value={surveys.length} tone="teal" icon={ListChecks} />
                    <StatTile label="Single choice" value={questionTypeStats.single_choice} tone="navy" hint={`Multiple choice: ${questionTypeStats.multiple_choice}`} />
                    <StatTile label="Text" value={questionTypeStats.text} tone="gold" />
                    <StatTile label="Numeric" value={questionTypeStats.numeric} tone="info" />
                </StatGrid>

                {(error || success) && (
                    <div className="space-y-3">
                        {error && <Notice tone="danger" title="Ошибка">{error}</Notice>}
                        {success && <Notice tone="success">{success}</Notice>}
                    </div>
                )}

                <section className="space-y-4">
                    <SectionHeader compact title="1 · Опросы" description="Период, охват и статус опроса." />
                    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[420px_1fr]">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {editingSurveyId ? <Save /> : <Plus />}
                                    {editingSurveyId ? 'Редактирование опроса' : 'Новый опрос'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form className="space-y-4" onSubmit={submitSurvey}>
                                    <FormField label="Название опроса">
                                        <Input
                                            placeholder="Название опроса"
                                            value={surveyForm.title}
                                            onChange={(e) => setSurveyForm((prev) => ({ ...prev, title: e.target.value }))}
                                        />
                                    </FormField>

                                    <FormField label="Описание">
                                        <Input
                                            placeholder="Описание (необязательно)"
                                            value={surveyForm.description}
                                            onChange={(e) => setSurveyForm((prev) => ({ ...prev, description: e.target.value }))}
                                        />
                                    </FormField>

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <FormField label="Учебный год">
                                            <Input
                                                placeholder="Например 2026/2027"
                                                value={surveyForm.academic_year}
                                                onChange={(e) => setSurveyForm((prev) => ({ ...prev, academic_year: e.target.value }))}
                                            />
                                        </FormField>

                                        <FormField label="Семестр">
                                            <Input
                                                placeholder="Семестр"
                                                value={surveyForm.semester}
                                                onChange={(e) => setSurveyForm((prev) => ({ ...prev, semester: e.target.value }))}
                                            />
                                        </FormField>
                                    </div>

                                    <FormField label="Охват">
                                        <select
                                            className={qdFieldClass}
                                            value={surveyForm.target_scope}
                                            onChange={(e) => setSurveyForm((prev) => ({ ...prev, target_scope: e.target.value, target_group_id: e.target.value === 'group' ? prev.target_group_id : '' }))}
                                        >
                                            <option value="global">Общий: все связки преподаватель+дисциплина</option>
                                            <option value="group">Только конкретная группа</option>
                                        </select>
                                    </FormField>

                                    <FormField label="Группа">
                                        <select
                                            className={qdFieldClass}
                                            value={surveyForm.target_group_id}
                                            onChange={(e) => setSurveyForm((prev) => ({ ...prev, target_group_id: e.target.value }))}
                                            disabled={surveyForm.target_scope !== 'group'}
                                        >
                                            <option value="">Выберите группу</option>
                                            {groups.map((group) => (
                                                <option key={group.id} value={group.id}>
                                                    {group.name}{group.course ? ` (курс ${group.course})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </FormField>

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <FormField label="Дата начала">
                                            <Input
                                                type="date"
                                                value={surveyForm.start_date}
                                                onChange={(e) => setSurveyForm((prev) => ({ ...prev, start_date: e.target.value }))}
                                            />
                                        </FormField>
                                        <FormField label="Дата окончания">
                                            <Input
                                                type="date"
                                                value={surveyForm.end_date}
                                                onChange={(e) => setSurveyForm((prev) => ({ ...prev, end_date: e.target.value }))}
                                            />
                                        </FormField>
                                    </div>

                                    <FormField label="Статус">
                                        <select
                                            className={qdFieldClass}
                                            value={surveyForm.status}
                                            onChange={(e) => setSurveyForm((prev) => ({ ...prev, status: e.target.value }))}
                                        >
                                            <option value="active">active</option>
                                            <option value="inactive">inactive</option>
                                        </select>
                                    </FormField>

                                    <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4">
                                        {editingSurveyId && (
                                            <Button type="button" variant="outline" onClick={() => { setEditingSurveyId(null); setSurveyForm(emptySurveyForm); }}>
                                                Отмена
                                            </Button>
                                        )}
                                        <Button type="submit">
                                            {editingSurveyId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                            {editingSurveyId ? 'Сохранить' : 'Создать'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ListChecks />
                                    Список опросов
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {surveys.length === 0 ? (
                                    <div className="px-5 py-12 text-center sm:px-6">
                                        <p className="font-display text-lg font-bold text-[#102945]">Опросы пока не созданы</p>
                                        <p className="mt-1 text-sm text-slate-600">Заполните форму «Новый опрос», затем добавьте в него вопросы.</p>
                                    </div>
                                ) : (
                                    <ul className="max-h-[560px] divide-y divide-slate-200 overflow-y-auto">
                                        {surveys.map((survey) => (
                                            <li key={survey.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:px-6 sm:items-start sm:justify-between ${editingSurveyId === survey.id ? 'bg-teal-50' : ''}`}>
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-semibold text-slate-900">{survey.title}</p>
                                                        <StatusBadge tone={survey.status === 'active' ? 'success' : 'default'}>{survey.status}</StatusBadge>
                                                    </div>
                                                    <p className="text-sm text-slate-600">
                                                        {survey.academic_year}, семестр {survey.semester} ·
                                                        {' '}
                                                        {survey.target_scope === 'group'
                                                            ? `Группа: ${survey.target_group?.name || survey.target_group_id}`
                                                            : 'Общий для всех групп'}
                                                    </p>
                                                    <p className="text-xs tabular-nums text-slate-500">Период: {survey.start_date} - {survey.end_date}</p>
                                                </div>
                                                <div className="flex shrink-0 gap-2">
                                                    <Button type="button" variant="outline" size="sm" onClick={() => startEditSurvey(survey)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        Ред.
                                                    </Button>
                                                    <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => removeSurvey(survey.id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Удалить
                                                    </Button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <section className="space-y-4">
                    <SectionHeader compact title="2 · Вопросы" description="Вопросы анкеты, их тип и порядок." />
                    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[420px_1fr]">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {editingQuestionId ? <Save /> : <Plus />}
                                    {editingQuestionId ? 'Редактирование вопроса' : 'Новый вопрос'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form className="space-y-4" onSubmit={submitQuestion}>
                                    <FormField label="Анкета">
                                        <select className={qdFieldClass} value={questionForm.survey_id} onChange={(e) => setQuestionForm((prev) => ({ ...prev, survey_id: e.target.value }))}>
                                            <option value="">Выберите анкету</option>
                                            {surveys.map((survey) => (
                                                <option key={survey.id} value={survey.id}>
                                                    {survey.title} ({survey.academic_year}, сем. {survey.semester})
                                                </option>
                                            ))}
                                        </select>
                                    </FormField>

                                    <FormField label="Текст вопроса">
                                        <Input placeholder="Текст вопроса" value={questionForm.question_text} onChange={(e) => setQuestionForm((prev) => ({ ...prev, question_text: e.target.value }))} />
                                    </FormField>

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
                                        <FormField label="Тип">
                                            <select className={qdFieldClass} value={questionForm.question_type} onChange={(e) => setQuestionForm((prev) => ({ ...prev, question_type: e.target.value }))}>
                                                <option value="single_choice">single_choice</option>
                                                <option value="multiple_choice">multiple_choice</option>
                                                <option value="text">text</option>
                                                <option value="numeric">numeric</option>
                                            </select>
                                        </FormField>

                                        <FormField label="Порядок">
                                            <Input type="number" placeholder="Порядок" value={questionForm.sort_order} onChange={(e) => setQuestionForm((prev) => ({ ...prev, sort_order: e.target.value }))} />
                                        </FormField>
                                    </div>

                                    <label className="flex items-center gap-2 text-sm text-slate-700">
                                        <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={questionForm.is_required} onChange={(e) => setQuestionForm((prev) => ({ ...prev, is_required: e.target.checked }))} />
                                        Обязательный вопрос
                                    </label>

                                    <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4">
                                        {editingQuestionId && (
                                            <Button type="button" variant="outline" onClick={() => { setEditingQuestionId(null); setQuestionForm(emptyQuestionForm); }}>
                                                Отмена
                                            </Button>
                                        )}
                                        <Button type="submit">
                                            {editingQuestionId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                            {editingQuestionId ? 'Сохранить' : 'Создать'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ListChecks />
                                    Список вопросов
                                </CardTitle>
                            </CardHeader>
                            <div className="grid gap-4 border-b border-slate-200 px-5 py-4 sm:grid-cols-2 sm:px-6">
                                <FormField label="Поиск">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <Input className="pl-9" placeholder="Поиск вопроса" value={questionSearch} onChange={(e) => setQuestionSearch(e.target.value)} />
                                    </div>
                                </FormField>
                                <FormField label="Анкета">
                                    <select className={qdFieldClass} value={selectedSurveyId} onChange={(e) => setSelectedSurveyId(e.target.value)}>
                                        <option value="">Все анкеты</option>
                                        {surveys.map((survey) => (
                                            <option key={survey.id} value={survey.id}>{survey.title}</option>
                                        ))}
                                    </select>
                                </FormField>
                            </div>
                            <CardContent className="p-0">
                                {loading ? (
                                    <div className="p-5 sm:p-6"><LoadingState /></div>
                                ) : selectedQuestions.length === 0 ? (
                                    <div className="px-5 py-12 text-center sm:px-6">
                                        <p className="font-display text-lg font-bold text-[#102945]">Вопросы не найдены</p>
                                        <p className="mt-1 text-sm text-slate-600">Измените фильтр или создайте вопрос в форме слева.</p>
                                    </div>
                                ) : (
                                    <ul className="max-h-[560px] divide-y divide-slate-200 overflow-y-auto">
                                        {selectedQuestions.map((question) => {
                                            const isSelected = String(selectedQuestionId) === String(question.id);
                                            return (
                                                <li key={question.id} className={`relative flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-start lg:justify-between ${isSelected ? 'bg-teal-50 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-teal-600' : ''}`}>
                                                    <div className="min-w-0 space-y-1.5">
                                                        <p className="font-medium text-slate-900">{question.question_text}</p>
                                                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                            <Badge variant="secondary" className="font-mono">{question.question_type}</Badge>
                                                            <span>Анкета: {question.survey?.title || question.survey_id}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 flex-wrap gap-2">
                                                        <Button type="button" variant="outline" size="sm" onClick={() => startEditQuestion(question)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                            Ред.
                                                        </Button>
                                                        <Button type="button" variant={isSelected ? 'secondary' : 'outline'} size="sm" onClick={() => { setSelectedQuestionId(String(question.id)); setOptionForm((prev) => ({ ...prev, question_id: String(question.id) })); }}>
                                                            <Settings2 className="h-3.5 w-3.5" />
                                                            Опции
                                                        </Button>
                                                        <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => removeQuestion(question.id)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            Удалить
                                                        </Button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <section className="space-y-4">
                    <SectionHeader compact title="3 · Опции вопроса" description="Варианты ответа и их баллы для выбранного вопроса." />
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings2 />
                                Опции вопроса
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <form className="grid grid-cols-1 gap-4 lg:grid-cols-6" onSubmit={submitOption}>
                                <div className="lg:col-span-2">
                                    <FormField label="Вопрос">
                                        <select className={qdFieldClass} value={optionForm.question_id} onChange={(e) => { setOptionForm((prev) => ({ ...prev, question_id: e.target.value })); setSelectedQuestionId(e.target.value); }}>
                                            <option value="">Выберите вопрос</option>
                                            {questions.map((question) => (
                                                <option key={question.id} value={question.id}>{question.question_text}</option>
                                            ))}
                                        </select>
                                    </FormField>
                                </div>
                                <div className="lg:col-span-2">
                                    <FormField label="Текст опции">
                                        <Input placeholder="Текст опции" value={optionForm.option_text} onChange={(e) => setOptionForm((prev) => ({ ...prev, option_text: e.target.value }))} />
                                    </FormField>
                                </div>
                                <FormField label="Балл">
                                    <Input type="number" step="0.01" placeholder="Балл" value={optionForm.score} onChange={(e) => setOptionForm((prev) => ({ ...prev, score: e.target.value }))} />
                                </FormField>
                                <FormField label="Порядок">
                                    <Input type="number" placeholder="Порядок" value={optionForm.sort_order} onChange={(e) => setOptionForm((prev) => ({ ...prev, sort_order: e.target.value }))} />
                                </FormField>

                                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 lg:col-span-6">
                                    {editingOptionId && (
                                        <Button type="button" variant="outline" onClick={() => { setEditingOptionId(null); setOptionForm((prev) => ({ ...emptyOptionForm, question_id: prev.question_id })); }}>
                                            Отмена
                                        </Button>
                                    )}
                                    <Button type="submit">
                                        {editingOptionId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                        {editingOptionId ? 'Сохранить опцию' : 'Создать опцию'}
                                    </Button>
                                </div>
                            </form>

                            {options.length === 0 ? (
                                <Notice tone="info">Выберите вопрос, чтобы увидеть опции.</Notice>
                            ) : (
                                <DataTable>
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="whitespace-nowrap text-left">Опция</th>
                                                <th className="whitespace-nowrap text-right">Балл</th>
                                                <th className="whitespace-nowrap text-right">Порядок</th>
                                                <th className="whitespace-nowrap text-right">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {options.map((option) => (
                                                <tr key={option.id} className={`border-b border-slate-200 last:border-b-0 hover:bg-slate-50 ${editingOptionId === option.id ? 'bg-teal-50' : ''}`}>
                                                    <td className="font-medium text-slate-900">{option.option_text}</td>
                                                    <td className="text-right tabular-nums text-slate-700">{option.score ?? '—'}</td>
                                                    <td className="text-right tabular-nums text-slate-700">{option.sort_order ?? 0}</td>
                                                    <td className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={() => startEditOption(option)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                                Ред.
                                                            </Button>
                                                            <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => removeOption(option.id)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                Удалить
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </DataTable>
                            )}
                        </CardContent>
                    </Card>
                </section>
            </div>
            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
                description={confirmState.description}
                onConfirm={() => {
                    confirmState.onConfirm?.();
                    setConfirmState({ open: false, description: '', onConfirm: null });
                }}
            />
        </AuthenticatedLayout>
    );
}
