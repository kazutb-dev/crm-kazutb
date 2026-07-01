import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowUpDown, Plus, Save, Shuffle, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

const questionTypeOptions = [
    { value: 'single_choice', label: 'Один правильный ответ' },
    { value: 'multiple_choice', label: 'Несколько правильных ответов' },
    { value: 'short_text', label: 'Короткий текст' },
];

const emptyQuestion = () => ({
    text: '',
    type: 'single_choice',
    options: ['', ''],
    correct_answers: [],
});

function normalizeTest(test) {
    if (!test) {
        return {
            title: '',
            description: '',
            status: 'draft',
            question_count: 1,
            shuffle_questions: false,
            allow_reordering: true,
            passing_score: 70,
            questions: [emptyQuestion()],
        };
    }

    return {
        title: test.title || '',
        description: test.description || '',
        status: test.status || 'draft',
        question_count: Number(test.question_count || 1),
        shuffle_questions: Boolean(test.shuffle_questions),
        allow_reordering: Boolean(test.allow_reordering ?? true),
        passing_score: Number(test.passing_score ?? 70),
        questions: (test.questions?.length ? test.questions : [emptyQuestion()]).map((question) => ({
            text: question.text || '',
            type: question.type || 'single_choice',
            options: question.type === 'short_text'
                ? []
                : (question.options?.length ? question.options : ['', '']),
            correct_answers: question.correct_answers?.length ? question.correct_answers : [],
        })),
    };
}

export default function TestForm({ binding, test = null }) {
    const submitStatusRef = useRef(test?.status || 'draft');
    const { data, setData, post, patch, processing, errors, transform } = useForm(normalizeTest(test));

    useEffect(() => {
        setData((current) => {
            const maxQuestions = Math.max(current.questions.length, 1);
            const normalizedCount = Math.min(Math.max(Number(current.question_count || 1), 1), maxQuestions);

            if (normalizedCount === current.question_count) {
                return current;
            }

            return {
                ...current,
                question_count: normalizedCount,
            };
        });
    }, [data.questions.length, setData]);

    const updateQuestion = (index, patchValue) => {
        setData('questions', data.questions.map((question, questionIndex) => (
            questionIndex === index ? { ...question, ...patchValue } : question
        )));
    };

    const addQuestion = () => {
        setData('questions', [...data.questions, emptyQuestion()]);
    };

    const removeQuestion = (index) => {
        if (data.questions.length === 1) {
            return;
        }

        setData('questions', data.questions.filter((_, questionIndex) => questionIndex !== index));
    };

    const moveQuestion = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= data.questions.length) {
            return;
        }

        const nextQuestions = [...data.questions];
        [nextQuestions[index], nextQuestions[targetIndex]] = [nextQuestions[targetIndex], nextQuestions[index]];
        setData('questions', nextQuestions);
    };

    const updateOption = (questionIndex, optionIndex, value) => {
        setData('questions', data.questions.map((question, currentIndex) => {
            if (currentIndex !== questionIndex) {
                return question;
            }

            const nextOptions = question.options.map((option, currentOptionIndex) => (
                currentOptionIndex === optionIndex ? value : option
            ));

            const nextCorrectAnswers = question.correct_answers.filter((answer) => answer !== question.options[optionIndex]);

            if (question.correct_answers.includes(question.options[optionIndex]) && value.trim() !== '') {
                nextCorrectAnswers.push(value);
            }

            return {
                ...question,
                options: nextOptions,
                correct_answers: Array.from(new Set(nextCorrectAnswers)),
            };
        }));
    };

    const addOption = (questionIndex) => {
        setData('questions', data.questions.map((question, currentIndex) => (
            currentIndex === questionIndex
                ? { ...question, options: [...question.options, ''] }
                : question
        )));
    };

    const removeOption = (questionIndex, optionIndex) => {
        setData('questions', data.questions.map((question, currentIndex) => {
            if (currentIndex !== questionIndex || question.options.length <= 2) {
                return question;
            }

            const removedOption = question.options[optionIndex];

            return {
                ...question,
                options: question.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex),
                correct_answers: question.correct_answers.filter((answer) => answer !== removedOption),
            };
        }));
    };

    const toggleCorrectAnswer = (questionIndex, value) => {
        setData('questions', data.questions.map((question, currentIndex) => {
            if (currentIndex !== questionIndex) {
                return question;
            }

            if (question.type === 'single_choice') {
                return {
                    ...question,
                    correct_answers: [value],
                };
            }

            if (question.type === 'multiple_choice') {
                const exists = question.correct_answers.includes(value);

                return {
                    ...question,
                    correct_answers: exists
                        ? question.correct_answers.filter((answer) => answer !== value)
                        : [...question.correct_answers, value],
                };
            }

            return question;
        }));
    };

    const updateQuestionType = (questionIndex, value) => {
        setData('questions', data.questions.map((question, currentIndex) => {
            if (currentIndex !== questionIndex) {
                return question;
            }

            if (value === 'short_text') {
                return {
                    ...question,
                    type: value,
                    options: [],
                    correct_answers: question.correct_answers.length ? [question.correct_answers[0]] : [''],
                };
            }

            return {
                ...question,
                type: value,
                options: question.options.length >= 2 ? question.options : ['', ''],
                correct_answers: value === 'single_choice'
                    ? question.correct_answers.slice(0, 1)
                    : question.correct_answers,
            };
        }));
    };

    const submit = (event) => {
        event.preventDefault();

        const send = test ? patch : post;
        const target = test ? route('testing.tests.update', test.id) : route('testing.tests.store', binding.id);

        transform((current) => ({
            ...current,
            status: submitStatusRef.current,
            question_count: Number(current.question_count || 1),
            passing_score: Number(current.passing_score || 0),
            questions: current.questions.map((question) => ({
                ...question,
                text: question.text.trim(),
                options: question.type === 'short_text'
                    ? []
                    : question.options.map((option) => option.trim()).filter(Boolean),
                correct_answers: question.correct_answers.map((answer) => answer.trim()).filter(Boolean),
            })),
        }));

        send(target, {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title={test ? `Редактирование теста - ${test.title}` : 'Новый тест'} />

            <form className="admin-page-wrap space-y-6" onSubmit={submit}>
                <Card className="admin-surface overflow-hidden border-0 bg-gradient-to-r from-[#123153] via-[#15466a] to-[#0f8b94] text-white">
                    <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="mb-3 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/80">
                                    Конструктор теста
                                </div>
                                <h1 className="text-3xl font-semibold">{test ? 'Редактирование теста' : 'Создание нового теста'}</h1>
                                <p className="mt-2 text-sm text-white/75">
                                    Предмет: {binding.subject?.name} {binding.subject?.code ? `(${binding.subject.code})` : ''}
                                </p>
                            </div>

                            <Link href={route('testing.bindings.show', binding.id)}>
                                <Button type="button" variant="outline" className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                                    <ArrowLeft className="h-4 w-4" />
                                    Назад к привязке
                                </Button>
                            </Link>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/70">Подготовлено вопросов</div>
                                <div className="mt-2 text-3xl font-semibold">{data.questions.length}</div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/70">В тесте используется</div>
                                <div className="mt-2 text-3xl font-semibold">{data.question_count}</div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/70">Статус</div>
                                <div className="mt-2 text-xl font-semibold">{submitStatusRef.current === 'published' || data.status === 'published' ? 'Опубликован' : 'Черновик'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/70">Проходной балл</div>
                                <div className="mt-2 text-3xl font-semibold">{data.passing_score}%</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="admin-surface">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-xl text-[#132844]">Основные параметры</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-5 lg:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Название теста</label>
                            <Input value={data.title} onChange={(event) => setData('title', event.target.value)} placeholder="Например, Промежуточный тест по теме" />
                            {errors.title && <div className="text-sm text-red-600">{errors.title}</div>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Статус</label>
                            <NativeSelect
                                value={data.status}
                                onValueChange={(value) => setData('status', value)}
                                options={[
                                    { value: 'draft', label: 'Черновик' },
                                    { value: 'published', label: 'Опубликован' },
                                ]}
                            />
                            {errors.status && <div className="text-sm text-red-600">{errors.status}</div>}
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-sm font-medium text-slate-700">Описание</label>
                            <Textarea
                                value={data.description}
                                onChange={(event) => setData('description', event.target.value)}
                                placeholder="Кратко опишите цель теста, инструкции или особенности прохождения."
                            />
                            {errors.description && <div className="text-sm text-red-600">{errors.description}</div>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Количество вопросов в прохождении</label>
                            <Input
                                type="number"
                                min="1"
                                max={Math.max(data.questions.length, 1)}
                                value={data.question_count}
                                onChange={(event) => setData('question_count', Number(event.target.value))}
                            />
                            <p className="text-xs text-slate-500">Значение не может превышать количество подготовленных вопросов.</p>
                            {errors.question_count && <div className="text-sm text-red-600">{errors.question_count}</div>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Проходной балл, %</label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={data.passing_score}
                                onChange={(event) => setData('passing_score', Number(event.target.value))}
                            />
                            {errors.passing_score && <div className="text-sm text-red-600">{errors.passing_score}</div>}
                        </div>

                        <div className="flex flex-wrap gap-6 lg:col-span-2">
                            <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={data.shuffle_questions}
                                    onChange={(event) => setData('shuffle_questions', event.target.checked)}
                                />
                                <span className="inline-flex items-center gap-2">
                                    <Shuffle className="h-4 w-4 text-[#139AA4]" />
                                    Перемешивать порядок вопросов
                                </span>
                            </label>

                            <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={data.allow_reordering}
                                    onChange={(event) => setData('allow_reordering', event.target.checked)}
                                />
                                Разрешить ручную перестановку вопросов
                            </label>
                        </div>
                    </CardContent>
                </Card>

                <Card className="admin-surface">
                    <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-xl text-[#132844]">Вопросы</CardTitle>
                                <p className="mt-1 text-sm text-slate-500">Для MVP поддерживаются выбор одного ответа, выбор нескольких ответов и короткий текст.</p>
                            </div>

                            <Button type="button" className="gap-2" onClick={addQuestion}>
                                <Plus className="h-4 w-4" />
                                Добавить вопрос
                            </Button>
                        </div>
                        {errors.questions && <div className="text-sm text-red-600">{errors.questions}</div>}
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {data.questions.map((question, index) => (
                            <div key={`${index}-${question.type}`} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_16px_38px_-32px_rgba(15,23,42,0.55)]">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#123153] text-sm font-semibold text-white">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <div className="font-semibold text-[#132844]">Вопрос {index + 1}</div>
                                            <Badge className="mt-1 bg-slate-200 text-slate-700">{questionTypeOptions.find((item) => item.value === question.type)?.label}</Badge>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {data.allow_reordering && (
                                            <>
                                                <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>
                                                    Вверх
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" disabled={index === data.questions.length - 1} onClick={() => moveQuestion(index, 1)}>
                                                    Вниз
                                                </Button>
                                            </>
                                        )}
                                        <Button type="button" variant="outline" size="sm" className="text-red-700" disabled={data.questions.length === 1} onClick={() => removeQuestion(index)}>
                                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                                            Удалить
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-5">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Текст вопроса</label>
                                        <Textarea
                                            value={question.text}
                                            onChange={(event) => updateQuestion(index, { text: event.target.value })}
                                            placeholder="Введите формулировку вопроса"
                                        />
                                        {errors[`questions.${index}.text`] && <div className="text-sm text-red-600">{errors[`questions.${index}.text`]}</div>}
                                    </div>

                                    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Тип вопроса</label>
                                            <NativeSelect
                                                value={question.type}
                                                onValueChange={(value) => updateQuestionType(index, value)}
                                                options={questionTypeOptions}
                                            />
                                        </div>

                                        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                                            <div className="mb-2 inline-flex items-center gap-2 font-medium text-[#132844]">
                                                <ArrowUpDown className="h-4 w-4" />
                                                Правильные ответы
                                            </div>
                                            {question.type === 'short_text'
                                                ? 'Укажите один или несколько допустимых текстовых ответов.'
                                                : 'Отметьте варианты, которые считаются правильными при проверке.'}
                                        </div>
                                    </div>

                                    {question.type === 'short_text' ? (
                                        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                            {(question.correct_answers.length ? question.correct_answers : ['']).map((answer, answerIndex) => (
                                                <div key={answerIndex} className="flex gap-2">
                                                    <Input
                                                        value={answer}
                                                        onChange={(event) => updateQuestion(index, {
                                                            correct_answers: (question.correct_answers.length ? question.correct_answers : ['']).map((currentAnswer, currentIndex) => (
                                                                currentIndex === answerIndex ? event.target.value : currentAnswer
                                                            )),
                                                        })}
                                                        placeholder="Допустимый правильный ответ"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        disabled={(question.correct_answers.length ? question.correct_answers : ['']).length === 1}
                                                        onClick={() => updateQuestion(index, {
                                                            correct_answers: (question.correct_answers.length ? question.correct_answers : ['']).filter((_, currentIndex) => currentIndex !== answerIndex),
                                                        })}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}

                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => updateQuestion(index, {
                                                    correct_answers: [...(question.correct_answers.length ? question.correct_answers : ['']), ''],
                                                })}
                                            >
                                                Добавить допустимый ответ
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                            {question.options.map((option, optionIndex) => {
                                                const checked = question.correct_answers.includes(option);

                                                return (
                                                    <div key={optionIndex} className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                                                        <Input
                                                            value={option}
                                                            onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                                                            placeholder={`Вариант ответа ${optionIndex + 1}`}
                                                        />

                                                        <Button
                                                            type="button"
                                                            variant={checked ? 'default' : 'outline'}
                                                            className="justify-center"
                                                            onClick={() => toggleCorrectAnswer(index, option)}
                                                        >
                                                            {question.type === 'single_choice' ? 'Сделать правильным' : checked ? 'Правильный' : 'Отметить'}
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="text-red-700"
                                                            disabled={question.options.length <= 2}
                                                            onClick={() => removeOption(index, optionIndex)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                );
                                            })}

                                            <div className="flex flex-wrap gap-2">
                                                <Button type="button" variant="outline" onClick={() => addOption(index)}>
                                                    Добавить вариант
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <div className="flex flex-wrap items-center justify-end gap-3">
                    <Button
                        type="submit"
                        variant="outline"
                        disabled={processing}
                        className="gap-2"
                        onClick={() => { submitStatusRef.current = 'draft'; }}
                    >
                        <Save className="h-4 w-4" />
                        Сохранить как черновик
                    </Button>
                    <Button
                        type="submit"
                        disabled={processing}
                        className="gap-2"
                        onClick={() => { submitStatusRef.current = 'published'; }}
                    >
                        <Save className="h-4 w-4" />
                        Опубликовать
                    </Button>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
