import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { ListChecks, Plus, Save, Search, Settings2, Trash2 } from 'lucide-react';
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
        <AuthenticatedLayout>
            <Head title="Анкетирование - Опросы, вопросы и опции" />

            <div className="admin-page-wrap">
                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-[#132844]">Анкетирование - Опросы, вопросы и опции</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Создавайте опросы с привязкой ко всем связкам преподаватель+дисциплина или к конкретной группе, затем наполняйте вопросами.</p>
                        </div>
                        <Badge variant="secondary" className="w-fit">{questions.length} вопросов</Badge>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-[#132844]">{editingSurveyId ? 'Редактирование опроса' : 'Новый опрос'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form className="space-y-3" onSubmit={submitSurvey}>
                                <Input
                                    placeholder="Название опроса"
                                    value={surveyForm.title}
                                    onChange={(e) => setSurveyForm((prev) => ({ ...prev, title: e.target.value }))}
                                />

                                <Input
                                    placeholder="Описание (необязательно)"
                                    value={surveyForm.description}
                                    onChange={(e) => setSurveyForm((prev) => ({ ...prev, description: e.target.value }))}
                                />

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <Input
                                        placeholder="Учебный год (например 2026/2027)"
                                        value={surveyForm.academic_year}
                                        onChange={(e) => setSurveyForm((prev) => ({ ...prev, academic_year: e.target.value }))}
                                    />

                                    <Input
                                        placeholder="Семестр"
                                        value={surveyForm.semester}
                                        onChange={(e) => setSurveyForm((prev) => ({ ...prev, semester: e.target.value }))}
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <select
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={surveyForm.target_scope}
                                        onChange={(e) => setSurveyForm((prev) => ({ ...prev, target_scope: e.target.value, target_group_id: e.target.value === 'group' ? prev.target_group_id : '' }))}
                                    >
                                        <option value="global">Общий: все связки преподаватель+дисциплина</option>
                                        <option value="group">Только конкретная группа</option>
                                    </select>

                                    <select
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <label className="text-xs text-muted-foreground">
                                        Дата начала
                                        <Input
                                            type="date"
                                            value={surveyForm.start_date}
                                            onChange={(e) => setSurveyForm((prev) => ({ ...prev, start_date: e.target.value }))}
                                        />
                                    </label>
                                    <label className="text-xs text-muted-foreground">
                                        Дата окончания
                                        <Input
                                            type="date"
                                            value={surveyForm.end_date}
                                            onChange={(e) => setSurveyForm((prev) => ({ ...prev, end_date: e.target.value }))}
                                        />
                                    </label>
                                </div>

                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={surveyForm.status}
                                    onChange={(e) => setSurveyForm((prev) => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="active">active</option>
                                    <option value="inactive">inactive</option>
                                </select>

                                <div className="flex gap-2">
                                    <Button type="submit" className="gap-2">
                                        {editingSurveyId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                        {editingSurveyId ? 'Сохранить' : 'Создать'}
                                    </Button>
                                    {editingSurveyId && (
                                        <Button type="button" variant="outline" onClick={() => { setEditingSurveyId(null); setSurveyForm(emptySurveyForm); }}>
                                            Отмена
                                        </Button>
                                    )}
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-[#132844]">Список опросов</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {surveys.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Опросы пока не созданы.</p>
                            ) : (
                                <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                                    {surveys.map((survey) => (
                                        <div key={survey.id} className="rounded-md border border-border/80 p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-[#132844]">{survey.title}</p>
                                                <Badge variant={survey.status === 'active' ? 'secondary' : 'outline'}>{survey.status}</Badge>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {survey.academic_year}, семестр {survey.semester} ·
                                                {' '}
                                                {survey.target_scope === 'group'
                                                    ? `Группа: ${survey.target_group?.name || survey.target_group_id}`
                                                    : 'Общий для всех групп'}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">Период: {survey.start_date} - {survey.end_date}</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Button type="button" variant="outline" size="sm" onClick={() => startEditSurvey(survey)}>Ред.</Button>
                                                <Button type="button" variant="outline" size="sm" className="text-red-700" onClick={() => removeSurvey(survey.id)}>
                                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                    Удалить
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard title="Анкет" value={surveys.length} icon={<ListChecks className="h-5 w-5 text-[#139AA4]" />} />
                    <StatCard title="Single choice" value={questionTypeStats.single_choice} />
                    <StatCard title="Text" value={questionTypeStats.text} />
                    <StatCard title="Numeric" value={questionTypeStats.numeric} />
                </div>

                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-[#132844]">{editingQuestionId ? 'Редактирование вопроса' : 'Новый вопрос'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form className="space-y-3" onSubmit={submitQuestion}>
                                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={questionForm.survey_id} onChange={(e) => setQuestionForm((prev) => ({ ...prev, survey_id: e.target.value }))}>
                                    <option value="">Выберите анкету</option>
                                    {surveys.map((survey) => (
                                        <option key={survey.id} value={survey.id}>
                                            {survey.title} ({survey.academic_year}, сем. {survey.semester})
                                        </option>
                                    ))}
                                </select>

                                <Input placeholder="Текст вопроса" value={questionForm.question_text} onChange={(e) => setQuestionForm((prev) => ({ ...prev, question_text: e.target.value }))} />

                                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={questionForm.question_type} onChange={(e) => setQuestionForm((prev) => ({ ...prev, question_type: e.target.value }))}>
                                    <option value="single_choice">single_choice</option>
                                    <option value="multiple_choice">multiple_choice</option>
                                    <option value="text">text</option>
                                    <option value="numeric">numeric</option>
                                </select>

                                <Input type="number" placeholder="Порядок" value={questionForm.sort_order} onChange={(e) => setQuestionForm((prev) => ({ ...prev, sort_order: e.target.value }))} />

                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={questionForm.is_required} onChange={(e) => setQuestionForm((prev) => ({ ...prev, is_required: e.target.checked }))} />
                                    Обязательный вопрос
                                </label>

                                <div className="flex gap-2">
                                    <Button type="submit" className="gap-2">
                                        {editingQuestionId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                        {editingQuestionId ? 'Сохранить' : 'Создать'}
                                    </Button>
                                    {editingQuestionId && (
                                        <Button type="button" variant="outline" onClick={() => { setEditingQuestionId(null); setQuestionForm(emptyQuestionForm); }}>
                                            Отмена
                                        </Button>
                                    )}
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <CardTitle className="text-base text-[#132844]">Список вопросов</CardTitle>
                                <div className="relative w-full sm:w-72">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input className="pl-9" placeholder="Поиск вопроса" value={questionSearch} onChange={(e) => setQuestionSearch(e.target.value)} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedSurveyId} onChange={(e) => setSelectedSurveyId(e.target.value)}>
                                <option value="">Все анкеты</option>
                                {surveys.map((survey) => (
                                    <option key={survey.id} value={survey.id}>{survey.title}</option>
                                ))}
                            </select>

                            {loading ? (
                                <p className="text-sm text-muted-foreground">Загрузка...</p>
                            ) : selectedQuestions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Вопросы не найдены.</p>
                            ) : (
                                <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                                    {selectedQuestions.map((question) => (
                                        <div key={question.id} className="rounded-md border border-border/80 p-3">
                                            <p className="text-sm font-medium text-[#132844]">{question.question_text}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">Тип: {question.question_type} · Анкета: {question.survey?.title || question.survey_id}</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Button type="button" variant="outline" size="sm" onClick={() => startEditQuestion(question)}>Ред.</Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedQuestionId(String(question.id)); setOptionForm((prev) => ({ ...prev, question_id: String(question.id) })); }}>
                                                    <Settings2 className="mr-1 h-3.5 w-3.5" />
                                                    Опции
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" className="text-red-700" onClick={() => removeQuestion(question.id)}>
                                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                    Удалить
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base text-[#132844]">Опции вопроса</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-5" onSubmit={submitOption}>
                            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={optionForm.question_id} onChange={(e) => { setOptionForm((prev) => ({ ...prev, question_id: e.target.value })); setSelectedQuestionId(e.target.value); }}>
                                <option value="">Выберите вопрос</option>
                                {questions.map((question) => (
                                    <option key={question.id} value={question.id}>{question.question_text}</option>
                                ))}
                            </select>
                            <Input className="lg:col-span-2" placeholder="Текст опции" value={optionForm.option_text} onChange={(e) => setOptionForm((prev) => ({ ...prev, option_text: e.target.value }))} />
                            <Input type="number" step="0.01" placeholder="Балл" value={optionForm.score} onChange={(e) => setOptionForm((prev) => ({ ...prev, score: e.target.value }))} />
                            <Input type="number" placeholder="Порядок" value={optionForm.sort_order} onChange={(e) => setOptionForm((prev) => ({ ...prev, sort_order: e.target.value }))} />

                            <div className="lg:col-span-5 flex gap-2">
                                <Button type="submit" className="gap-2">
                                    {editingOptionId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                    {editingOptionId ? 'Сохранить опцию' : 'Создать опцию'}
                                </Button>
                                {editingOptionId && (
                                    <Button type="button" variant="outline" onClick={() => { setEditingOptionId(null); setOptionForm((prev) => ({ ...emptyOptionForm, question_id: prev.question_id })); }}>
                                        Отмена
                                    </Button>
                                )}
                            </div>
                        </form>

                        {options.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Выберите вопрос, чтобы увидеть опции.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="px-3 py-2 text-left font-medium">Опция</th>
                                            <th className="px-3 py-2 text-left font-medium">Балл</th>
                                            <th className="px-3 py-2 text-left font-medium">Порядок</th>
                                            <th className="px-3 py-2 text-right font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {options.map((option) => (
                                            <tr key={option.id} className="border-b last:border-b-0">
                                                <td className="px-3 py-2">{option.option_text}</td>
                                                <td className="px-3 py-2">{option.score ?? '—'}</td>
                                                <td className="px-3 py-2">{option.sort_order ?? 0}</td>
                                                <td className="px-3 py-2 text-right">
                                                    <div className="inline-flex gap-2">
                                                        <Button type="button" variant="outline" size="sm" onClick={() => startEditOption(option)}>Ред.</Button>
                                                        <Button type="button" variant="outline" size="sm" className="text-red-700" onClick={() => removeOption(option.id)}>
                                                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                            Удалить
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
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

function StatCard({ title, value, icon = null }) {
    return (
        <Card className="border-border/80 bg-white/90 shadow-sm">
            <CardContent className="flex items-center justify-between pt-6">
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
                    <p className="text-2xl font-semibold text-[#132844]">{value}</p>
                </div>
                {icon}
            </CardContent>
        </Card>
    );
}
