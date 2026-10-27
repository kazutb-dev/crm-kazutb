import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LessonStatusBadge, isLessonInProgress, pluralSlides } from '@/components/teacher-ai/lesson-shared';
import { Link, router, useForm } from '@inertiajs/react';
import { BookOpenText, FolderOpen, Inbox, Presentation, Sparkles } from 'lucide-react';
import { useEffect } from 'react';

const POLL_INTERVAL_MS = 5000;

const DEFAULT_SLIDES = { min: 8, max: 30, default: 15 };

const LECTURE_NUMBER_MIN = 1;
const LECTURE_NUMBER_MAX = 60;

/** How the lecture number appears on the title slide, per material language. */
const lectureNumberLabel = (language, number) => {
    if (language === 'kk') {
        return `${number}-Дәріс`;
    }

    return language === 'en' ? `Lecture ${number}` : `Лекция ${number}`;
};

const profileText = (value) => (typeof value === 'string' ? value.slice(0, 255) : '');

const inputClassName = qdFieldClass;
const textareaClassName = `${qdFieldClass} h-auto py-2.5`;

function FieldError({ message }) {
    if (!message) {
        return null;
    }

    return <p className="mt-1.5 text-sm text-red-700">{message}</p>;
}

export default function Index({ lessons = [], options = {}, aiEnabled = false, limits = {}, profile = {} }) {
    const languages = Array.isArray(options?.languages) ? options.languages : [];
    const durations = Array.isArray(options?.durations) && options.durations.length > 0 ? options.durations : [50];
    const slidesLimits = { ...DEFAULT_SLIDES, ...(options?.slides ?? {}) };
    const lessonList = Array.isArray(lessons) ? lessons : [];

    const form = useForm({
        subject: '',
        topic: '',
        language: languages[0]?.value ?? 'ru',
        audience: '',
        duration_minutes: durations.includes(50) ? 50 : durations[0],
        slides_count: slidesLimits.default,
        notes: '',
        lecture_number: '',
        faculty_name: profileText(profile?.faculty_name),
        department_name: profileText(profile?.department_name),
    });

    const dailyLimit = limits?.daily ?? 0;
    const usedToday = limits?.used_today ?? 0;
    const limitReached = dailyLimit > 0 && usedToday >= dailyLimit;
    const hasInProgress = lessonList.some((lesson) => isLessonInProgress(lesson?.status));
    const canSubmit = aiEnabled && !limitReached && !form.processing
        && form.data.subject.trim().length > 0 && form.data.topic.trim().length > 0;

    useEffect(() => {
        if (!hasInProgress) {
            return undefined;
        }

        const timer = window.setInterval(() => {
            router.reload({ only: ['lessons', 'limits'], preserveScroll: true });
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [hasInProgress]);

    const handleSlidesChange = (event) => {
        // Keep the raw value while typing so the field is editable; the backend validates the range.
        const raw = event.target.value;
        form.setData('slides_count', raw === '' ? '' : Number(raw));
    };

    const handleLectureNumberChange = (event) => {
        const raw = event.target.value;
        form.setData('lecture_number', raw === '' ? '' : Number(raw));
    };

    const lectureNumber = Number(form.data.lecture_number);
    const lectureNumberPreview = Number.isInteger(lectureNumber) && lectureNumber >= LECTURE_NUMBER_MIN && lectureNumber <= LECTURE_NUMBER_MAX
        ? lectureNumberLabel(form.data.language, lectureNumber)
        : null;

    const submit = (event) => {
        event.preventDefault();

        // On success the server redirects to the Show page, so nothing is reset here:
        // a flash-error redirect back (limit reached, AI disabled) must keep the typed text.
        form.post(route('teacher-ai.lessons.store'), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="AI-ассистент преподавателя"
                    title="Лекции и презентации"
                    description="Укажите дисциплину и тему — ИИ подготовит конспект лекции и презентацию. Это черновик для преподавателя: проверьте факты, формулы и источники перед занятием."
                    meta={(
                        <StatusBadge tone={limitReached ? 'warning' : 'info'}>
                            Сегодня: {usedToday} из {dailyLimit}
                        </StatusBadge>
                    )}
                />
            )}
        >
            <div className="admin-page-wrap space-y-6">
                {!aiEnabled && (
                    <Notice tone="warning" title="AI-ассистент отключён">
                        AI-ассистент сейчас отключён. Обратитесь к администратору системы.
                    </Notice>
                )}

                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Новое занятие
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                    <form onSubmit={submit} className="space-y-5">
                        <p className="text-sm text-slate-600">
                            Сегодня использовано <span className="font-semibold tabular-nums text-[#102945]">{usedToday}</span> из <span className="font-semibold tabular-nums text-[#102945]">{dailyLimit}</span>
                        </p>

                        <div>
                            <label htmlFor="subject" className="qd-field-label mb-2 block">
                                Дисциплина / название урока <span className="text-red-600">*</span>
                            </label>
                            <input
                                id="subject"
                                type="text"
                                value={form.data.subject}
                                onChange={(event) => form.setData('subject', event.target.value)}
                                placeholder="Например: Базы данных"
                                maxLength={255}
                                className={inputClassName}
                            />
                            <FieldError message={form.errors.subject} />
                        </div>

                        <div>
                            <label htmlFor="topic" className="qd-field-label mb-2 block">
                                Тема занятия <span className="text-red-600">*</span>
                            </label>
                            <input
                                id="topic"
                                type="text"
                                value={form.data.topic}
                                onChange={(event) => form.setData('topic', event.target.value)}
                                placeholder="Например: Нормализация реляционных баз данных"
                                maxLength={500}
                                className={inputClassName}
                            />
                            <FieldError message={form.errors.topic} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="language" className="qd-field-label mb-2 block">Язык материалов</label>
                                <select
                                    id="language"
                                    value={form.data.language}
                                    onChange={(event) => form.setData('language', event.target.value)}
                                    className={inputClassName}
                                >
                                    {languages.length === 0 && <option value="ru">Русский</option>}
                                    {languages.map((language) => (
                                        <option key={language.value} value={language.value}>{language.label}</option>
                                    ))}
                                </select>
                                <FieldError message={form.errors.language} />
                            </div>
                            <div>
                                <label htmlFor="audience" className="qd-field-label mb-2 block">
                                    Аудитория <span className="font-normal normal-case tracking-normal text-slate-400">(необязательно)</span>
                                </label>
                                <input
                                    id="audience"
                                    type="text"
                                    value={form.data.audience}
                                    onChange={(event) => form.setData('audience', event.target.value)}
                                    placeholder="Например: 2 курс бакалавриата, ИС"
                                    maxLength={255}
                                    className={inputClassName}
                                />
                                <FieldError message={form.errors.audience} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="duration_minutes" className="qd-field-label mb-2 block">Длительность занятия</label>
                                <select
                                    id="duration_minutes"
                                    value={form.data.duration_minutes}
                                    onChange={(event) => form.setData('duration_minutes', Number(event.target.value))}
                                    className={inputClassName}
                                >
                                    {durations.map((duration) => (
                                        <option key={duration} value={duration}>{duration} мин</option>
                                    ))}
                                </select>
                                <FieldError message={form.errors.duration_minutes} />
                            </div>
                            <div>
                                <label htmlFor="slides_count" className="qd-field-label mb-2 block">
                                    Количество слайдов <span className="font-normal normal-case tracking-normal text-slate-400">({slidesLimits.min}–{slidesLimits.max})</span>
                                </label>
                                <input
                                    id="slides_count"
                                    type="number"
                                    inputMode="numeric"
                                    min={slidesLimits.min}
                                    max={slidesLimits.max}
                                    step={1}
                                    value={form.data.slides_count}
                                    onChange={handleSlidesChange}
                                    className={inputClassName}
                                />
                                <FieldError message={form.errors.slides_count} />
                            </div>
                        </div>

                        <fieldset className="min-w-0 space-y-4 rounded-xl border border-slate-200 p-5">
                            <legend className="float-left w-full font-display text-base font-bold text-[#102945]">Титульный слайд</legend>
                            <p className="clear-both !mt-1 text-sm text-slate-600">
                                Эти данные появятся на обложке презентации. Все поля необязательны.
                            </p>

                            <div className="grid gap-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
                                <div>
                                    <label htmlFor="lecture_number" className="qd-field-label mb-2 block">Номер лекции</label>
                                    <input
                                        id="lecture_number"
                                        type="number"
                                        inputMode="numeric"
                                        min={LECTURE_NUMBER_MIN}
                                        max={LECTURE_NUMBER_MAX}
                                        step={1}
                                        value={form.data.lecture_number}
                                        onChange={handleLectureNumberChange}
                                        placeholder="Например: 7"
                                        className={inputClassName}
                                    />
                                    <FieldError message={form.errors.lecture_number} />
                                </div>
                                <p className="text-sm text-slate-500 sm:pt-8">
                                    {lectureNumberPreview
                                        ? <>На слайде: «{lectureNumberPreview}»</>
                                        : <>От {LECTURE_NUMBER_MIN} до {LECTURE_NUMBER_MAX}: например, 7 → «7-Дәріс» / «Лекция 7».</>}
                                </p>
                            </div>

                            <div>
                                <label htmlFor="faculty_name" className="qd-field-label mb-2 block">Факультет</label>
                                <input
                                    id="faculty_name"
                                    type="text"
                                    value={form.data.faculty_name}
                                    onChange={(event) => form.setData('faculty_name', event.target.value)}
                                    placeholder="Например: Информационные технологии"
                                    maxLength={255}
                                    className={inputClassName}
                                />
                                <FieldError message={form.errors.faculty_name} />
                            </div>

                            <div>
                                <label htmlFor="department_name" className="qd-field-label mb-2 block">Кафедра</label>
                                <input
                                    id="department_name"
                                    type="text"
                                    value={form.data.department_name}
                                    onChange={(event) => form.setData('department_name', event.target.value)}
                                    placeholder="Например: Информационные системы"
                                    maxLength={255}
                                    className={inputClassName}
                                />
                                <FieldError message={form.errors.department_name} />
                            </div>
                        </fieldset>

                        <div>
                            <label htmlFor="notes" className="qd-field-label mb-2 block">
                                Пожелания <span className="font-normal normal-case tracking-normal text-slate-400">(необязательно)</span>
                            </label>
                            <textarea
                                id="notes"
                                value={form.data.notes}
                                onChange={(event) => form.setData('notes', event.target.value)}
                                rows={3}
                                maxLength={1000}
                                placeholder="Например: больше практических примеров, добавить мини-кейс"
                                className={textareaClassName}
                            />
                            <FieldError message={form.errors.notes} />
                        </div>

                        <Notice tone="info" title="Конфиденциальность">
                            Запрос отправляется во внешний ИИ-сервис. Не указывайте персональные данные
                            студентов и сотрудников.
                        </Notice>

                        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
                            {limitReached && (
                                <span className="mr-auto text-sm text-amber-700">Дневной лимит генераций исчерпан.</span>
                            )}
                            <Button type="submit" disabled={!canSubmit} className="gap-2">
                                <Sparkles className="h-4 w-4" />
                                {form.processing ? 'Отправка…' : 'Сгенерировать лекцию и презентацию'}
                            </Button>
                        </div>
                    </form>
                    </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FolderOpen className="h-4 w-4" />
                                Мои материалы
                            </CardTitle>
                            <CardDescription>Видны только вам.</CardDescription>
                        </CardHeader>
                        <CardContent className={lessonList.length === 0 ? '' : 'p-0'}>
                        {lessonList.length === 0 ? (
                            <InlineEmpty
                                icon={FolderOpen}
                                title="Материалов пока нет"
                                description="Здесь появятся сгенерированные лекции и презентации."
                            />
                        ) : (
                            <ul className="divide-y divide-slate-200">
                                {lessonList.map((lesson) => (
                                    <li key={lesson.id}>
                                        <Link
                                            href={route('teacher-ai.lessons.show', lesson.id)}
                                            className="flex flex-col gap-2 px-5 py-4 transition hover:bg-slate-50 sm:px-6"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="min-w-0 break-words font-medium text-slate-900">
                                                    {lesson.title || lesson.topic || 'Без названия'}
                                                </span>
                                                <LessonStatusBadge status={lesson.status} />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                                                {lesson.subject && <span className="break-words">{lesson.subject}</span>}
                                                {lesson.language_label && <span>{lesson.language_label}</span>}
                                                {lesson.created_at && <span className="tabular-nums">{lesson.created_at}</span>}
                                            </div>
                                            {(lesson.has_lecture || lesson.has_presentation) && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {lesson.has_lecture && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                                                            <BookOpenText className="h-3 w-3" />
                                                            Лекция
                                                        </span>
                                                    )}
                                                    {lesson.has_presentation && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                                                            <Presentation className="h-3 w-3" />
                                                            {lesson.slides_total
                                                                ? `Презентация: ${lesson.slides_total} ${pluralSlides(lesson.slides_total)}`
                                                                : 'Презентация'}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function InlineEmpty({ icon: Icon = Inbox, title, description = null, action = null }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <Icon className="h-6 w-6" />
            </span>
            <div className="max-w-md space-y-1">
                <p className="font-display text-lg font-bold text-[#102945]">{title}</p>
                {description ? <p className="text-sm leading-relaxed text-slate-600">{description}</p> : null}
            </div>
            {action}
        </div>
    );
}
