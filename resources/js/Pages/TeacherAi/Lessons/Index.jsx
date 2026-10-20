import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { LessonStatusBadge, isLessonInProgress, pluralSlides } from '@/components/teacher-ai/lesson-shared';
import { Link, router, useForm } from '@inertiajs/react';
import { BookOpenText, Presentation, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
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

const inputClassName = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20';

function FieldError({ message }) {
    if (!message) {
        return null;
    }

    return <p className="mt-1.5 text-sm text-rose-600">{message}</p>;
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
                <div className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">AI-ассистент преподавателя</p>
                    <h2 className="text-2xl font-semibold text-slate-900">Лекции и презентации</h2>
                    <p className="max-w-3xl text-sm text-slate-600">
                        Укажите дисциплину и тему — ИИ подготовит конспект лекции и презентацию. Это черновик для
                        преподавателя: проверьте факты, формулы и источники перед занятием.
                    </p>
                </div>
            )}
        >
            <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                {!aiEnabled && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                        <p>AI-ассистент сейчас отключён. Обратитесь к администратору системы.</p>
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                                <Sparkles className="h-5 w-5" />
                            </span>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Новое занятие</h3>
                                <p className="text-sm text-slate-500">
                                    Сегодня использовано {usedToday} из {dailyLimit}
                                </p>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-slate-700">
                                Дисциплина / название урока <span className="text-rose-500">*</span>
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
                            <label htmlFor="topic" className="mb-1.5 block text-sm font-medium text-slate-700">
                                Тема занятия <span className="text-rose-500">*</span>
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
                                <label htmlFor="language" className="mb-1.5 block text-sm font-medium text-slate-700">Язык материалов</label>
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
                                <label htmlFor="audience" className="mb-1.5 block text-sm font-medium text-slate-700">
                                    Аудитория <span className="font-normal text-slate-400">(необязательно)</span>
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
                                <label htmlFor="duration_minutes" className="mb-1.5 block text-sm font-medium text-slate-700">Длительность занятия</label>
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
                                <label htmlFor="slides_count" className="mb-1.5 block text-sm font-medium text-slate-700">
                                    Количество слайдов <span className="font-normal text-slate-400">({slidesLimits.min}–{slidesLimits.max})</span>
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

                        <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
                            <legend className="px-1 text-sm font-semibold text-slate-900">Титульный слайд</legend>
                            <p className="text-sm text-slate-500">
                                Эти данные появятся на обложке презентации. Все поля необязательны.
                            </p>

                            <div className="grid gap-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
                                <div>
                                    <label htmlFor="lecture_number" className="mb-1.5 block text-sm font-medium text-slate-700">Номер лекции</label>
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
                                <label htmlFor="faculty_name" className="mb-1.5 block text-sm font-medium text-slate-700">Факультет</label>
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
                                <label htmlFor="department_name" className="mb-1.5 block text-sm font-medium text-slate-700">Кафедра</label>
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
                            <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-slate-700">
                                Пожелания <span className="font-normal text-slate-400">(необязательно)</span>
                            </label>
                            <textarea
                                id="notes"
                                value={form.data.notes}
                                onChange={(event) => form.setData('notes', event.target.value)}
                                rows={3}
                                maxLength={1000}
                                placeholder="Например: больше практических примеров, добавить мини-кейс"
                                className={inputClassName}
                            />
                            <FieldError message={form.errors.notes} />
                        </div>

                        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                            <p>
                                Запрос отправляется во внешний ИИ-сервис. Не указывайте персональные данные
                                студентов и сотрудников.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                <Sparkles className="h-4 w-4" />
                                {form.processing ? 'Отправка…' : 'Сгенерировать лекцию и презентацию'}
                            </button>
                            {limitReached && (
                                <span className="text-sm text-amber-700">Дневной лимит генераций исчерпан.</span>
                            )}
                        </div>
                    </form>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <h3 className="text-lg font-semibold text-slate-900">Мои материалы</h3>
                        <p className="mt-1 text-sm text-slate-500">Видны только вам.</p>

                        {lessonList.length === 0 ? (
                            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                                Здесь появятся сгенерированные лекции и презентации.
                            </div>
                        ) : (
                            <ul className="mt-5 divide-y divide-slate-100">
                                {lessonList.map((lesson) => (
                                    <li key={lesson.id}>
                                        <Link
                                            href={route('teacher-ai.lessons.show', lesson.id)}
                                            className="-mx-3 flex flex-col gap-2 rounded-xl px-3 py-3 transition hover:bg-slate-50"
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
                                                {lesson.created_at && <span>{lesson.created_at}</span>}
                                            </div>
                                            {(lesson.has_lecture || lesson.has_presentation) && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {lesson.has_lecture && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
                                                            <BookOpenText className="h-3 w-3" />
                                                            Лекция
                                                        </span>
                                                    )}
                                                    {lesson.has_presentation && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800">
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
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

