import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, FormField, LoadingState, Notice, PageHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { BookOpen, Check, ChevronRight, CircleCheck, ClipboardList, Clock3, FileCheck2, RotateCcw, Save, Send, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const draftKey = (surveyId, groupDisciplineId) => `questionnaire.student.draft.${surveyId}.${groupDisciplineId}`;

function buildInitialAnswers(item) {
    const initial = {};

    for (const question of item?.questions || []) {
        initial[question.id] = {
            question_id: question.id,
            option_id: '',
            text_answer: '',
            numeric_answer: '',
        };
    }

    return initial;
}

function isAnswered(question, answer) {
    if (!answer) {
        return false;
    }

    if (question.question_type === 'single_choice' || question.question_type === 'multiple_choice') {
        return answer.option_id !== '' && answer.option_id !== null;
    }

    if (question.question_type === 'text') {
        return String(answer.text_answer || '').trim() !== '';
    }

    if (question.question_type === 'numeric') {
        return String(answer.numeric_answer || '').trim() !== '';
    }

    return false;
}

export default function QuestionnaireStudentIndex({ selectedSurveyId = null }) {
    const [items, setItems] = useState([]);
    const [selectedDisciplineId, setSelectedDisciplineId] = useState('');
    const [selectedGroupDisciplineId, setSelectedGroupDisciplineId] = useState(null);
    const [courseFilter, setCourseFilter] = useState('all');
    const [semesterFilter, setSemesterFilter] = useState('all');
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitSuccessModalOpen, setIsSubmitSuccessModalOpen] = useState(false);
    const [draftSavedAt, setDraftSavedAt] = useState(null);
    const [submittedAt, setSubmittedAt] = useState(null);

    const visibleItems = useMemo(() => {
        if (!selectedSurveyId) {
            return items;
        }

        return items.filter((item) => Number(item.survey_id) === Number(selectedSurveyId));
    }, [items, selectedSurveyId]);

    const availableCourses = useMemo(() => {
        return Array.from(
            new Set(
                visibleItems
                    .map((item) => item.course)
                    .filter((course) => course !== null && course !== undefined && course !== ''),
            ),
        )
            .map((course) => Number(course))
            .sort((a, b) => a - b);
    }, [visibleItems]);

    const availableSemesters = useMemo(() => {
        return Array.from(
            new Set(
                visibleItems
                    .map((item) => item.semester)
                    .filter((semester) => semester !== null && semester !== undefined && semester !== ''),
            ),
        )
            .map((semester) => String(semester))
            .sort((a, b) => a.localeCompare(b, 'ru'));
    }, [visibleItems]);

    const filteredItems = useMemo(() => {
        return visibleItems.filter((item) => {
            const passCourse = courseFilter === 'all' || String(item.course ?? '') === courseFilter;
            const passSemester = semesterFilter === 'all' || String(item.semester ?? '') === semesterFilter;

            return passCourse && passSemester;
        });
    }, [visibleItems, courseFilter, semesterFilter]);

    const disciplineBuckets = useMemo(() => {
        const map = new Map();

        for (const item of filteredItems) {
            const bucketId = String(item.discipline?.id ?? `discipline-${item.group_discipline_id}`);
            const existing = map.get(bucketId);

            if (existing) {
                existing.items.push(item);
                continue;
            }

            map.set(bucketId, {
                id: bucketId,
                discipline: {
                    id: item.discipline?.id ?? null,
                    name: item.discipline?.name || 'Без названия дисциплины',
                },
                items: [item],
            });
        }

        return Array.from(map.values()).sort((a, b) => a.discipline.name.localeCompare(b.discipline.name, 'ru'));
    }, [filteredItems]);

    const selectedDiscipline = useMemo(
        () => disciplineBuckets.find((bucket) => bucket.id === selectedDisciplineId) ?? null,
        [disciplineBuckets, selectedDisciplineId],
    );

    const selectedItem = useMemo(() => {
        if (!selectedDiscipline) {
            return null;
        }

        if (selectedGroupDisciplineId !== null) {
            const match = selectedDiscipline.items.find(
                (item) => Number(item.group_discipline_id) === Number(selectedGroupDisciplineId),
            );

            if (match) {
                return match;
            }
        }

        return selectedDiscipline.items[0] ?? null;
    }, [selectedDiscipline, selectedGroupDisciplineId]);

    const canSubmitSelected = Boolean(selectedItem?.can_submit && selectedItem?.survey_id);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');

            try {
                const response = await axios.get('/api/questionnaire/student/surveys');
                const loadedItems = response.data?.data ?? [];
                setItems(loadedItems);

            } catch (e) {
                setError(e?.response?.data?.message || 'Не удалось загрузить доступные анкеты.');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    useEffect(() => {
        if (disciplineBuckets.length === 0) {
            setSelectedDisciplineId('');
            setSelectedGroupDisciplineId(null);
            return;
        }

        if (!selectedDisciplineId || !disciplineBuckets.some((bucket) => bucket.id === selectedDisciplineId)) {
            const firstBucket = disciplineBuckets[0];
            setSelectedDisciplineId(firstBucket.id);
            setSelectedGroupDisciplineId(firstBucket.items[0]?.group_discipline_id ?? null);
            return;
        }

        if (
            selectedDiscipline
            && selectedDiscipline.items.length > 0
            && !selectedDiscipline.items.some((item) => Number(item.group_discipline_id) === Number(selectedGroupDisciplineId))
        ) {
            setSelectedGroupDisciplineId(selectedDiscipline.items[0].group_discipline_id);
        }
    }, [disciplineBuckets, selectedDiscipline, selectedDisciplineId, selectedGroupDisciplineId]);

    useEffect(() => {
        if (!selectedItem || !selectedItem.survey_id || !selectedItem.can_submit) {
            setAnswers({});
            setDraftSavedAt(null);
            setSubmittedAt(null);
            return;
        }

        const initial = buildInitialAnswers(selectedItem);

        try {
            const rawDraft = window.localStorage.getItem(draftKey(selectedItem.survey_id, selectedItem.group_discipline_id));
            if (rawDraft) {
                const parsed = JSON.parse(rawDraft);
                setAnswers({ ...initial, ...(parsed.answers || {}) });
                setDraftSavedAt(parsed.saved_at || null);
                return;
            }
        } catch {
            // Ignore invalid local draft.
        }

        setAnswers(initial);
        setDraftSavedAt(null);
        setSubmittedAt(null);
    }, [selectedItem]);

    useEffect(() => {
        if (!selectedItem || !selectedItem.survey_id || !selectedItem.can_submit) {
            return;
        }

        const timeout = setTimeout(() => {
            const payload = {
                answers,
                saved_at: new Date().toISOString(),
            };

            try {
                window.localStorage.setItem(
                    draftKey(selectedItem.survey_id, selectedItem.group_discipline_id),
                    JSON.stringify(payload),
                );
                setDraftSavedAt(payload.saved_at);
            } catch {
                // Ignore storage failures.
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [answers, selectedItem]);

    const questions = selectedItem?.questions || [];
    const answeredCount = questions.filter((question) => isAnswered(question, answers[question.id])).length;
    const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

    const submit = async () => {
        if (!selectedItem || !canSubmitSelected) {
            return;
        }

        setError('');
        setSuccess('');

        try {
            const payloadAnswers = Object.values(answers)
                .map((answer) => ({
                    ...answer,
                    option_id: answer.option_id === '' ? null : Number(answer.option_id),
                    text_answer: answer.text_answer === '' ? null : answer.text_answer,
                    numeric_answer: answer.numeric_answer === '' ? null : Number(answer.numeric_answer),
                }));

            await axios.post('/api/questionnaire/student/surveys/submit', {
                survey_id: selectedItem.survey_id,
                group_discipline_id: selectedItem.group_discipline_id,
                answers: payloadAnswers,
            });

            window.localStorage.removeItem(draftKey(selectedItem.survey_id, selectedItem.group_discipline_id));
            setDraftSavedAt(null);
            setSubmittedAt(new Date().toISOString());
            setSuccess('Анкета отправлена. Спасибо за обратную связь.');
            setIsSubmitSuccessModalOpen(true);
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка отправки анкеты.');
        }
    };

    const resetDraft = () => {
        if (!selectedItem || !canSubmitSelected) {
            return;
        }

        const initial = buildInitialAnswers(selectedItem);
        setAnswers(initial);
        setDraftSavedAt(null);
        setSubmittedAt(null);
        window.localStorage.removeItem(draftKey(selectedItem.survey_id, selectedItem.group_discipline_id));
    };

    const selectDiscipline = (bucket) => {
        setSelectedDisciplineId(bucket.id);
        setSelectedGroupDisciplineId(bucket.items[0]?.group_discipline_id ?? null);
        setIsSubmitSuccessModalOpen(false);
        setSuccess('');
        setError('');
        setSubmittedAt(null);
    };

    const selectAssignment = (item) => {
        setSelectedGroupDisciplineId(item.group_discipline_id);
        setIsSubmitSuccessModalOpen(false);
        setSuccess('');
        setError('');
        setSubmittedAt(null);
    };

    const availableToSubmitCount = filteredItems.filter((item) => item.can_submit).length;

    const setAnswerField = (questionId, field, value) => setAnswers((prev) => ({
        ...prev,
        [questionId]: {
            ...prev[questionId],
            [field]: value,
        },
    }));

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Личный кабинет анкетирования"
                    description="Прогресс сохраняется автоматически. Можно вернуться и продолжить позже."
                    meta={(
                        <StatusBadge tone={draftSavedAt ? 'info' : 'default'}>
                            <Clock3 className="mr-1 h-3.5 w-3.5" />
                            Черновик: {draftSavedAt ? 'есть' : 'нет'}
                        </StatusBadge>
                    )}
                />
            )}
        >
            <Head title="Анкетирование - Студент" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Дисциплин" value={disciplineBuckets.length} tone="navy" icon={BookOpen} />
                    <StatTile label="Назначений" value={filteredItems.length} tone="teal" icon={ClipboardList} />
                    <StatTile label="Доступно к прохождению" value={availableToSubmitCount} tone="success" icon={CircleCheck} hint={availableToSubmitCount > 0 ? 'Выберите дисциплину слева и ответьте на вопросы' : null} />
                    <StatTile label="Черновик" value={draftSavedAt ? 'есть' : 'нет'} tone="gold" icon={Clock3} hint={draftSavedAt ? `Сохранён в ${new Date(draftSavedAt).toLocaleTimeString()}` : 'Сохраняется автоматически'} />
                </StatGrid>

                <FilterBar>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField label="Курс">
                            <select
                                className={qdFieldClass}
                                value={courseFilter}
                                onChange={(e) => setCourseFilter(e.target.value)}
                            >
                                <option value="all">Все курсы</option>
                                {availableCourses.map((course) => (
                                    <option key={course} value={String(course)}>{course} курс</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Семестр">
                            <select
                                className={qdFieldClass}
                                value={semesterFilter}
                                onChange={(e) => setSemesterFilter(e.target.value)}
                            >
                                <option value="all">Все семестры</option>
                                {availableSemesters.map((semester) => (
                                    <option key={semester} value={semester}>{semester}</option>
                                ))}
                            </select>
                        </FormField>
                    </div>
                </FilterBar>

                {error && <Notice tone="danger" title="Ошибка">{error}</Notice>}
                {success && <Notice tone="success">{success}</Notice>}

                {submittedAt && (
                    <Notice tone="success" title="Анкета отправлена">
                        Анкета успешно отправлена {new Date(submittedAt).toLocaleString()}.
                    </Notice>
                )}

                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[320px_1fr]">
                    <Card className="xl:sticky xl:top-5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen />
                                Мои дисциплины
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-5"><LoadingState /></div>
                            ) : disciplineBuckets.length === 0 ? (
                                <p className="px-5 py-6 text-sm text-slate-600">
                                    {visibleItems.length > 0
                                        ? 'По выбранным фильтрам дисциплины не найдены.'
                                        : 'Нет доступных дисциплин для анкетирования.'}
                                </p>
                            ) : (
                                <ul className="divide-y divide-slate-200">
                                    {disciplineBuckets.map((bucket) => {
                                        const active = selectedDisciplineId === bucket.id;
                                        const availableCount = bucket.items.filter((item) => item.can_submit).length;
                                        const hasSurvey = bucket.items.some((item) => item.survey_id);

                                        return (
                                            <li key={bucket.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => selectDiscipline(bucket)}
                                                    aria-current={active ? 'true' : undefined}
                                                    className={`flex w-full items-start justify-between gap-3 border-l-[3px] px-5 py-3.5 text-left transition-colors ${active ? 'border-l-teal-600 bg-teal-50' : 'border-l-transparent hover:bg-slate-50'}`}
                                                >
                                                    <span className="min-w-0">
                                                        <span className={`block font-medium ${active ? 'text-[#102945]' : 'text-slate-900'}`}>{bucket.discipline.name}</span>
                                                        <span className={`mt-1 block text-xs ${availableCount > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                            {availableCount > 0
                                                                ? `Доступно анкет: ${availableCount}`
                                                                : hasSurvey
                                                                    ? 'Есть анкета, но сейчас недоступна'
                                                                    : 'Анкетирование не назначено'}
                                                        </span>
                                                    </span>
                                                    {availableCount > 0 ? (
                                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-hidden="true" />
                                                    ) : (
                                                        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-300'}`} aria-hidden="true" />
                                                    )}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <ClipboardList />
                                    Форма анкеты
                                </CardTitle>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                        <Save className="h-3.5 w-3.5" />
                                        Сохранено {draftSavedAt ? new Date(draftSavedAt).toLocaleTimeString() : 'авто'}
                                    </span>
                                    <Button type="button" variant="ghost" size="sm" onClick={resetDraft} disabled={!canSubmitSelected}>
                                        <RotateCcw className="h-4 w-4" />
                                        Сбросить черновик
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!selectedItem ? (
                                <div className="flex flex-col items-center gap-3 py-12 text-center">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                        <ClipboardList className="h-6 w-6" />
                                    </div>
                                    <p className="font-display text-lg font-bold text-[#102945]">Выберите дисциплину слева</p>
                                    <p className="max-w-sm text-sm text-slate-600">Откройте дисциплину из списка «Мои дисциплины», чтобы увидеть вопросы анкеты.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="space-y-3 border-b border-slate-200 pb-5">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="qd-field-label text-slate-500">Выбрано</p>
                                                <h2 className="mt-1 font-display text-xl font-bold leading-snug text-[#102945]">{selectedItem.discipline?.name}</h2>
                                                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                                                    <UserRound className="h-4 w-4 text-teal-700" />
                                                    Преподаватель: {selectedItem.teacher?.name || 'Не указан'}
                                                </p>
                                            </div>
                                            <Badge variant={canSubmitSelected ? 'success' : 'outline'}>
                                                {selectedItem.survey_state_label || 'Статус анкетирования неизвестен'}
                                            </Badge>
                                        </div>

                                        {canSubmitSelected && questions.length > 0 && (
                                            <div className="space-y-2 pt-1">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-slate-600">Прогресс заполнения</span>
                                                    <span className="font-semibold tabular-nums text-[#102945]">{answeredCount} / {questions.length}</span>
                                                </div>
                                                <Progress value={progressPercent} />
                                            </div>
                                        )}
                                    </div>

                                    {(selectedDiscipline?.items?.length ?? 0) > 1 && (
                                        <div className="space-y-2">
                                            <p className="qd-field-label text-slate-500">По этой дисциплине доступно несколько назначений</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedDiscipline.items.map((item) => {
                                                    const active = Number(item.group_discipline_id) === Number(selectedItem.group_discipline_id);

                                                    return (
                                                        <button
                                                            key={`${item.group_discipline_id}`}
                                                            type="button"
                                                            onClick={() => selectAssignment(item)}
                                                            aria-pressed={active}
                                                            className={`rounded-[10px] border px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'border-teal-600 bg-teal-50 text-[#102945]' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#102945]'}`}
                                                        >
                                                            {(item.teacher?.name || 'Преподаватель')} · {item.survey_state_label || 'нет статуса'}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {!canSubmitSelected && (
                                        <Notice tone="warning">
                                            Для выбранной дисциплины сейчас нет доступного анкетирования. Статус: {selectedItem.survey_state_label || 'не определен'}.
                                        </Notice>
                                    )}

                                    {canSubmitSelected && (
                                        <ol className="space-y-4">
                                            {questions.map((question, index) => {
                                                const answered = isAnswered(question, answers[question.id]);
                                                const isChoice = question.question_type === 'single_choice' || question.question_type === 'multiple_choice';

                                                return (
                                                    <li key={question.id} className="rounded-[14px] border border-slate-200 bg-white p-4 sm:p-5">
                                                        <div className="flex items-start gap-3">
                                                            <span
                                                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${answered ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'}`}
                                                                aria-hidden="true"
                                                            >
                                                                {answered ? <Check className="h-4 w-4" /> : index + 1}
                                                            </span>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="qd-field-label text-slate-500">Вопрос {index + 1}</p>
                                                                <p className="mt-1 text-[0.9375rem] font-medium leading-relaxed text-[#102945]">{question.question_text}</p>

                                                                {isChoice && (
                                                                    <div role="radiogroup" aria-label={question.question_text} className="mt-3 grid gap-2 sm:grid-cols-2">
                                                                        {(question.options || []).map((option) => {
                                                                            const checked = String(answers[question.id]?.option_id || '') === String(option.id);

                                                                            return (
                                                                                <label
                                                                                    key={option.id}
                                                                                    className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2.5 text-sm transition-colors ${checked ? 'border-teal-600 bg-teal-50 text-[#102945]' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
                                                                                >
                                                                                    <input
                                                                                        type="radio"
                                                                                        className="h-4 w-4 accent-teal-700"
                                                                                        name={`question-${question.id}`}
                                                                                        value={option.id}
                                                                                        checked={checked}
                                                                                        onChange={(e) => setAnswerField(question.id, 'option_id', e.target.value)}
                                                                                    />
                                                                                    <span>{option.option_text}</span>
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}

                                                                {question.question_type === 'text' && (
                                                                    <textarea
                                                                        className={`${qdFieldClass} mt-3 h-auto py-2.5`}
                                                                        rows={4}
                                                                        placeholder="Ваш ответ"
                                                                        value={answers[question.id]?.text_answer || ''}
                                                                        onChange={(e) => setAnswerField(question.id, 'text_answer', e.target.value)}
                                                                    />
                                                                )}

                                                                {question.question_type === 'numeric' && (
                                                                    <input
                                                                        className={`${qdFieldClass} mt-3 sm:max-w-[12rem]`}
                                                                        type="number"
                                                                        placeholder="Число"
                                                                        value={answers[question.id]?.numeric_answer || ''}
                                                                        onChange={(e) => setAnswerField(question.id, 'numeric_answer', e.target.value)}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ol>
                                    )}

                                    {canSubmitSelected && (
                                        <div className="sticky bottom-3 flex flex-col gap-3 rounded-[14px] border border-slate-200 bg-white p-3 shadow-[0_4px_16px_0_rgba(25,28,29,0.08)] sm:flex-row sm:items-center sm:justify-between">
                                            <p className="px-1 text-sm text-slate-600">
                                                Отвечено <span className="font-semibold tabular-nums text-[#102945]">{answeredCount} из {questions.length}</span>
                                            </p>
                                            <div className="flex justify-end gap-2">
                                                <Button type="button" variant="outline" onClick={resetDraft}>Очистить</Button>
                                                <Button type="button" onClick={submit}>
                                                    <Send className="h-4 w-4" />
                                                    Отправить анкету
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isSubmitSuccessModalOpen} onOpenChange={setIsSubmitSuccessModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <FileCheck2 className="h-7 w-7" />
                    </div>
                    <DialogHeader>
                        <DialogTitle>
                            Анкета успешно отправлена
                        </DialogTitle>
                        <DialogDescription>
                            Спасибо за обратную связь. Ваш ответ сохранен.
                            {submittedAt ? ` Дата и время: ${new Date(submittedAt).toLocaleString()}.` : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end">
                        <Button type="button" onClick={() => setIsSubmitSuccessModalOpen(false)}>
                            Понятно
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
