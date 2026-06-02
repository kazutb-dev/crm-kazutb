import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { Clock3, FileCheck2, RotateCcw, Save, Send } from 'lucide-react';
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

    return (
        <AuthenticatedLayout>
            <Head title="Анкетирование - Студент" />

            <div className="admin-page-wrap">
                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Анкетирование / Студент</p>
                                <h1 className="text-2xl font-semibold tracking-tight text-[#132844]">Личный кабинет анкетирования</h1>
                                <p className="mt-1 text-sm text-muted-foreground">Прогресс сохраняется автоматически. Можно вернуться и продолжить позже.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">Дисциплин: {disciplineBuckets.length}</Badge>
                                <Badge variant="outline">Назначений: {filteredItems.length}</Badge>
                                <Badge variant="outline">Доступно к прохождению: {filteredItems.filter((item) => item.can_submit).length}</Badge>
                                <Badge variant="outline" className="gap-1"><Clock3 className="h-3.5 w-3.5" />Черновик: {draftSavedAt ? 'есть' : 'нет'}</Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="text-sm text-muted-foreground">
                                Курс
                                <select
                                    className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground"
                                    value={courseFilter}
                                    onChange={(e) => setCourseFilter(e.target.value)}
                                >
                                    <option value="all">Все курсы</option>
                                    {availableCourses.map((course) => (
                                        <option key={course} value={String(course)}>{course} курс</option>
                                    ))}
                                </select>
                            </label>

                            <label className="text-sm text-muted-foreground">
                                Семестр
                                <select
                                    className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground"
                                    value={semesterFilter}
                                    onChange={(e) => setSemesterFilter(e.target.value)}
                                >
                                    <option value="all">Все семестры</option>
                                    {availableSemesters.map((semester) => (
                                        <option key={semester} value={semester}>{semester}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        {selectedItem && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Прогресс заполнения</span>
                                    <span className="font-medium text-[#132844]">{answeredCount} / {questions.length}</span>
                                </div>
                                <Progress value={progressPercent} />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                {submittedAt && (
                    <Card className="border-emerald-200 bg-emerald-50/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 pt-6 text-sm text-emerald-800">
                            <FileCheck2 className="h-5 w-5" />
                            Анкета успешно отправлена {new Date(submittedAt).toLocaleString()}.
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-[#132844]">Мои дисциплины</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <p className="text-sm text-muted-foreground">Загрузка...</p>
                            ) : disciplineBuckets.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {visibleItems.length > 0
                                        ? 'По выбранным фильтрам дисциплины не найдены.'
                                        : 'Нет доступных дисциплин для анкетирования.'}
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {disciplineBuckets.map((bucket) => {
                                        const active = selectedDisciplineId === bucket.id;
                                        const availableCount = bucket.items.filter((item) => item.can_submit).length;
                                        const hasSurvey = bucket.items.some((item) => item.survey_id);

                                        return (
                                            <button
                                                key={bucket.id}
                                                type="button"
                                                onClick={() => selectDiscipline(bucket)}
                                                className={`w-full rounded-lg border px-3 py-3 text-left transition ${active ? 'border-[#139AA4] bg-[#e9fbfc]' : 'border-border hover:bg-muted/40'}`}
                                            >
                                                <p className="font-medium text-[#132844]">{bucket.discipline.name}</p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {availableCount > 0
                                                        ? `Доступно анкет: ${availableCount}`
                                                        : hasSurvey
                                                            ? 'Есть анкета, но сейчас недоступна'
                                                            : 'Анкетирование не назначено'}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <CardTitle className="text-base text-[#132844]">Форма анкеты</CardTitle>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={resetDraft} disabled={!canSubmitSelected}>
                                        <RotateCcw className="h-4 w-4" />
                                        Сбросить черновик
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" className="gap-2" disabled>
                                        <Save className="h-4 w-4" />
                                        Сохранено {draftSavedAt ? new Date(draftSavedAt).toLocaleTimeString() : 'авто'}
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!selectedItem ? (
                                <p className="text-sm text-muted-foreground">Выберите дисциплину слева.</p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Выбрано</p>
                                        <p className="mt-1 text-sm font-semibold text-[#132844]">{selectedItem.discipline?.name}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">Преподаватель: {selectedItem.teacher?.name || 'Не указан'}</p>
                                        <div className="mt-2">
                                            <Badge variant={canSubmitSelected ? 'secondary' : 'outline'}>
                                                {selectedItem.survey_state_label || 'Статус анкетирования неизвестен'}
                                            </Badge>
                                        </div>
                                    </div>

                                    {(selectedDiscipline?.items?.length ?? 0) > 1 && (
                                        <div className="space-y-2 rounded-lg border border-border/80 p-3">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">По этой дисциплине доступно несколько назначений</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedDiscipline.items.map((item) => {
                                                    const active = Number(item.group_discipline_id) === Number(selectedItem.group_discipline_id);

                                                    return (
                                                        <button
                                                            key={`${item.group_discipline_id}`}
                                                            type="button"
                                                            onClick={() => selectAssignment(item)}
                                                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-[#139AA4] bg-[#e9fbfc] text-[#0b5d63]' : 'border-border text-muted-foreground hover:bg-muted/40'}`}
                                                        >
                                                            {(item.teacher?.name || 'Преподаватель')} · {item.survey_state_label || 'нет статуса'}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {!canSubmitSelected && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                            Для выбранной дисциплины сейчас нет доступного анкетирования. Статус: {selectedItem.survey_state_label || 'не определен'}.
                                        </div>
                                    )}

                                    {canSubmitSelected && questions.map((question, index) => (
                                        <div key={question.id} className="rounded-lg border border-border/80 p-4">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Вопрос {index + 1}</p>
                                            <p className="mt-1 text-sm font-medium text-[#132844]">{question.question_text}</p>

                                            {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && (
                                                <select
                                                    className="mt-3 w-full rounded-md border border-input px-3 py-2 text-sm"
                                                    value={answers[question.id]?.option_id || ''}
                                                    onChange={(e) => setAnswers((prev) => ({
                                                        ...prev,
                                                        [question.id]: {
                                                            ...prev[question.id],
                                                            option_id: e.target.value,
                                                        },
                                                    }))}
                                                >
                                                    <option value="">Выберите вариант</option>
                                                    {(question.options || []).map((option) => (
                                                        <option key={option.id} value={option.id}>{option.option_text}</option>
                                                    ))}
                                                </select>
                                            )}

                                            {question.question_type === 'text' && (
                                                <textarea
                                                    className="mt-3 w-full rounded-md border border-input px-3 py-2 text-sm"
                                                    rows={4}
                                                    value={answers[question.id]?.text_answer || ''}
                                                    onChange={(e) => setAnswers((prev) => ({
                                                        ...prev,
                                                        [question.id]: {
                                                            ...prev[question.id],
                                                            text_answer: e.target.value,
                                                        },
                                                    }))}
                                                />
                                            )}

                                            {question.question_type === 'numeric' && (
                                                <input
                                                    className="mt-3 w-full rounded-md border border-input px-3 py-2 text-sm"
                                                    type="number"
                                                    value={answers[question.id]?.numeric_answer || ''}
                                                    onChange={(e) => setAnswers((prev) => ({
                                                        ...prev,
                                                        [question.id]: {
                                                            ...prev[question.id],
                                                            numeric_answer: e.target.value,
                                                        },
                                                    }))}
                                                />
                                            )}
                                        </div>
                                    ))}

                                    {canSubmitSelected && (
                                        <div className="sticky bottom-3 flex justify-end gap-2 rounded-xl border border-border/80 bg-white/95 p-3 backdrop-blur">
                                            <Button type="button" variant="outline" onClick={resetDraft}>Очистить</Button>
                                            <Button type="button" className="gap-2" onClick={submit}>
                                                <Send className="h-4 w-4" />
                                                Отправить анкету
                                            </Button>
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
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-700">
                            <FileCheck2 className="h-5 w-5" />
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
