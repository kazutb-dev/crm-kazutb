import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LessonStatusBadge, StepProgress, isLessonInProgress, pluralSlides, pluralRu } from '@/components/teacher-ai/lesson-shared';
import SlideCanvas from '@/components/teacher-ai/slides/SlideCanvas';
import { Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    BookOpenText,
    Copy,
    Download,
    Info,
    Lightbulb,
    LoaderCircle,
    MessageSquareText,
    Presentation,
    RotateCcw,
    Trash2,
    TriangleAlert,
    XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

const POLL_INTERVAL_MS = 4000;

const numberFormat = new Intl.NumberFormat('ru-RU');

const asList = (value) => (Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined && item !== '') : []);

const asText = (value) => (typeof value === 'string' ? value : '');

/** Splits lecture prose on blank lines so each paragraph gets its own <p>. */
const splitParagraphs = (text) => asText(text)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * Plain-text rendering of the lecture for the clipboard. Mirrors the DOCX
 * export order so what the teacher pastes reads like the downloaded file.
 */
function buildLectureText(lecture, lesson) {
    if (!lecture) {
        return '';
    }

    const lines = [];
    const push = (...items) => lines.push(...items);
    const objectives = asList(lecture.objectives);
    const sections = asList(lecture.sections);
    const questions = asList(lecture.self_check_questions);
    const glossary = asList(lecture.glossary);
    const references = asList(lecture.references);

    push(asText(lecture.title) || asText(lesson?.title) || asText(lesson?.topic), '');

    const meta = [
        lesson?.subject ? `Дисциплина: ${lesson.subject}` : null,
        lesson?.topic ? `Тема: ${lesson.topic}` : null,
        lesson?.audience ? `Аудитория: ${lesson.audience}` : null,
        lesson?.duration_minutes ? `Длительность: ${lesson.duration_minutes} мин` : null,
    ].filter(Boolean);

    if (meta.length) {
        push(...meta, '');
    }

    if (objectives.length) {
        push('Цели обучения:', ...objectives.map((item) => `• ${item}`), '');
    }

    if (sections.length) {
        push('План лекции:', ...sections.map((section, index) => `${index + 1}. ${asText(section?.title) || `Раздел ${index + 1}`}`), '');
    }

    if (asText(lecture.introduction)) {
        push('Введение', '', asText(lecture.introduction).trim(), '');
    }

    sections.forEach((section, index) => {
        push(`${index + 1}. ${asText(section?.title) || `Раздел ${index + 1}`}`, '');

        const paragraphs = asList(section?.paragraphs);

        if (paragraphs.length) {
            paragraphs.forEach((paragraph) => push(asText(paragraph).trim(), ''));
        } else {
            push('(раздел ещё не сгенерирован)', '');
        }

        const keyTerms = asList(section?.key_terms);

        if (keyTerms.length) {
            push('Ключевые термины:', ...keyTerms.map((term) => `• ${asText(term?.term)} — ${asText(term?.definition)}`), '');
        }

        const examples = asList(section?.examples);

        if (examples.length) {
            examples.forEach((example, exampleIndex) => push(`Пример ${exampleIndex + 1}. ${asText(example).trim()}`, ''));
        }

        if (asText(section?.summary)) {
            push(`Итог: ${asText(section.summary).trim()}`, '');
        }
    });

    if (asText(lecture.conclusion)) {
        push('Заключение', '', asText(lecture.conclusion).trim(), '');
    }

    if (questions.length) {
        push('Вопросы для самопроверки:', ...questions.map((item, index) => `${index + 1}. ${item}`), '');
    }

    if (glossary.length) {
        push('Глоссарий:', ...glossary.map((item) => `• ${asText(item?.term)} — ${asText(item?.definition)}`), '');
    }

    if (references.length) {
        push('Рекомендуемая литература:', ...references.map((item, index) => `${index + 1}. ${item}`), '');
    }

    const keywords = asList(lecture.keywords);

    if (keywords.length) {
        push(`Ключевые слова: ${keywords.join(', ')}`, '');
    }

    push('Материал сгенерирован AI-ассистентом КазУТБ. Проверьте факты, формулы и источники перед использованием.');

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function SectionHeading({ children }) {
    return <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h4>;
}

function Paragraphs({ text, className = '' }) {
    const parts = splitParagraphs(text);

    if (!parts.length) {
        return null;
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {parts.map((part, index) => (
                <p key={index} className="whitespace-pre-line break-words text-sm leading-7 text-slate-800">{part}</p>
            ))}
        </div>
    );
}

function LectureSection({ section, index, inProgress }) {
    const title = asText(section?.title) || `Раздел ${index + 1}`;
    const paragraphs = asList(section?.paragraphs);
    const keyTerms = asList(section?.key_terms);
    const examples = asList(section?.examples);
    const summary = asText(section?.summary);
    const keyPoints = asList(section?.key_points);
    // `paragraphs` is null until the sections step reaches this index.
    const isGenerated = section?.paragraphs !== null && section?.paragraphs !== undefined && paragraphs.length > 0;

    return (
        <section id={`section-${index + 1}`} className="scroll-mt-24">
            <h3 className="break-words text-xl font-semibold text-slate-900">
                <span className="mr-2 text-teal-700">{index + 1}.</span>
                {title}
            </h3>

            {isGenerated ? (
                <>
                    <Paragraphs text={paragraphs.map(asText).join('\n\n')} className="mt-4" />

                    {keyTerms.length > 0 && (
                        <dl className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                            {keyTerms.map((term, termIndex) => (
                                <div key={termIndex} className="min-w-0">
                                    <dt className="break-words text-sm font-semibold text-slate-900">{asText(term?.term)}</dt>
                                    <dd className="mt-0.5 break-words text-sm leading-6 text-slate-700">{asText(term?.definition)}</dd>
                                </div>
                            ))}
                        </dl>
                    )}

                    {examples.map((example, exampleIndex) => (
                        <div key={exampleIndex} className="mt-4 flex items-start gap-2 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">
                            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                            <p className="whitespace-pre-line break-words leading-6">
                                <span className="font-medium">Пример{examples.length > 1 ? ` ${exampleIndex + 1}` : ''}: </span>
                                {asText(example)}
                            </p>
                        </div>
                    ))}

                    {summary && (
                        <p className="mt-4 break-words rounded-xl border-l-4 border-slate-300 bg-slate-50 px-4 py-3 text-sm italic leading-6 text-slate-700">
                            {summary}
                        </p>
                    )}
                </>
            ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
                    {keyPoints.length > 0 && (
                        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                            {keyPoints.map((point, pointIndex) => (
                                <li key={pointIndex} className="break-words">{asText(point)}</li>
                            ))}
                        </ul>
                    )}
                    <div className={`flex items-center gap-2 text-sm text-slate-500 ${keyPoints.length > 0 ? 'mt-3' : ''}`}>
                        {inProgress ? (
                            <>
                                <LoaderCircle className="h-4 w-4 animate-spin text-sky-600" />
                                Генерируется…
                            </>
                        ) : (
                            <>
                                <XCircle className="h-4 w-4 text-rose-500" />
                                Текст раздела не сгенерирован. Нажмите «Повторить», чтобы продолжить.
                            </>
                        )}
                    </div>
                    <div className="mt-3 space-y-2" aria-hidden="true">
                        <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                        <div className="h-3 w-11/12 animate-pulse rounded bg-slate-200" />
                        <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" />
                    </div>
                </div>
            )}
        </section>
    );
}

function LectureTab({ lesson, inProgress }) {
    const lecture = lesson?.lecture ?? null;

    if (!lecture) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                Лекция ещё не готова.
            </div>
        );
    }

    const objectives = asList(lecture.objectives);
    const sections = asList(lecture.sections);
    const questions = asList(lecture.self_check_questions);
    const glossary = asList(lecture.glossary);
    const references = asList(lecture.references);
    const keywords = asList(lecture.keywords);
    const wordCount = Number(lesson?.word_count ?? 0);

    return (
        <section className="space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <header className="space-y-2">
                <h3 className="break-words text-2xl font-semibold text-slate-900">{asText(lecture.title) || asText(lesson?.title)}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    {wordCount > 0 && <span>≈ {numberFormat.format(wordCount)} слов</span>}
                    {sections.length > 0 && <span>{sections.length} {pluralRu(sections.length, ['раздел', 'раздела', 'разделов'])}</span>}
                    {lesson?.model && <span className="text-slate-400">Модель: {lesson.model}</span>}
                </div>
            </header>

            {objectives.length > 0 && (
                <div>
                    <SectionHeading>Цели обучения</SectionHeading>
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
                        {objectives.map((objective, index) => (
                            <li key={index} className="break-words">{asText(objective)}</li>
                        ))}
                    </ul>
                </div>
            )}

            {sections.length > 0 && (
                <div>
                    <SectionHeading>План лекции</SectionHeading>
                    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
                        {sections.map((section, index) => (
                            <li key={index} className="break-words">
                                <a href={`#section-${index + 1}`} className="hover:text-teal-700">
                                    {asText(section?.title) || `Раздел ${index + 1}`}
                                </a>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {asText(lecture.introduction) && (
                <div>
                    <SectionHeading>Введение</SectionHeading>
                    <Paragraphs text={lecture.introduction} className="mt-3" />
                </div>
            )}

            {sections.length > 0 && (
                <div className="space-y-10 border-t border-slate-100 pt-8">
                    {sections.map((section, index) => (
                        <LectureSection key={index} section={section} index={index} inProgress={inProgress} />
                    ))}
                </div>
            )}

            {asText(lecture.conclusion) && (
                <div className="border-t border-slate-100 pt-8">
                    <SectionHeading>Заключение</SectionHeading>
                    <Paragraphs text={lecture.conclusion} className="mt-3" />
                </div>
            )}

            {questions.length > 0 && (
                <div>
                    <SectionHeading>Вопросы для самопроверки</SectionHeading>
                    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
                        {questions.map((question, index) => (
                            <li key={index} className="break-words">{asText(question)}</li>
                        ))}
                    </ol>
                </div>
            )}

            {glossary.length > 0 && (
                <div>
                    <SectionHeading>Глоссарий</SectionHeading>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                        {glossary.map((item, index) => (
                            <div key={index} className="min-w-0 rounded-2xl border border-slate-200 p-4">
                                <dt className="break-words text-sm font-semibold text-slate-900">{asText(item?.term)}</dt>
                                <dd className="mt-1 break-words text-sm leading-6 text-slate-700">{asText(item?.definition)}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}

            {references.length > 0 && (
                <div>
                    <SectionHeading>Рекомендуемая литература</SectionHeading>
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>Список литературы сформирован ИИ — проверьте источники.</p>
                    </div>
                    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
                        {references.map((reference, index) => (
                            <li key={index} className="break-words">{asText(reference)}</li>
                        ))}
                    </ol>
                </div>
            )}

            {keywords.length > 0 && (
                <div>
                    <SectionHeading>Ключевые слова</SectionHeading>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {keywords.map((keyword, index) => (
                            <span key={index} className="max-w-full break-words rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                                {asText(keyword)}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

/** Height of the sticky top bar: the viewer is scrolled below it. */
const STICKY_HEADER_OFFSET = 72;

/** Caption of a thumbnail: the slide title, or a generic name for title-less slides. */
function slideCaption(slide, presentation) {
    const title = asText(slide?.title).trim();

    if (title) {
        return title;
    }

    if (slide?.layout === 'cover') {
        return 'Титульный слайд';
    }

    return asText(presentation?.title).trim();
}

function PresentationTab({ lesson, inProgress }) {
    const presentation = lesson?.presentation ?? null;
    const slides = useMemo(
        () => asList(presentation?.slides).filter((slide) => typeof slide === 'object'),
        [presentation],
    );
    const total = slides.length;
    const [current, setCurrent] = useState(0);
    const viewerRef = useRef(null);
    // Polling may shrink the deck: keep the index in range.
    const index = total > 0 ? Math.min(Math.max(current, 0), total - 1) : 0;

    const goTo = useCallback((next) => {
        setCurrent(Math.min(Math.max(next, 0), Math.max(total - 1, 0)));
    }, [total]);

    useEffect(() => {
        if (total === 0) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
                return;
            }

            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
                return;
            }

            const target = event.target;

            if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
                return;
            }

            // Leave the keys to an open dialog (e.g. the delete confirmation).
            if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
                return;
            }

            event.preventDefault();
            const direction = event.key === 'ArrowLeft' ? -1 : 1;

            setCurrent((value) => Math.min(Math.max(Math.min(value, total - 1) + direction, 0), total - 1));
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [total]);

    if (!presentation || total === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                {inProgress ? 'Презентация готовится…' : 'Презентация ещё не готова.'}
            </div>
        );
    }

    const slide = slides[index];
    const notes = asText(slide?.notes).trim();
    const pendingImages = slides.filter((item) => item?.image_status === 'pending').length;

    const selectSlide = (next) => {
        goTo(next);

        const viewer = viewerRef.current;

        if (viewer) {
            const { top } = viewer.getBoundingClientRect();

            if (top < STICKY_HEADER_OFFSET || top > window.innerHeight) {
                viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    const navButtonClassName = 'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white';

    return (
        <section className="space-y-6">
            <div className="min-w-0">
                <h3 className="break-words text-xl font-semibold text-slate-900">{asText(presentation.title) || asText(lesson?.title)}</h3>
                {asText(presentation.subtitle) && (
                    <p className="mt-1 break-words text-sm text-slate-500">{presentation.subtitle}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span>{total} {pluralSlides(total)}</span>
                    {pendingImages > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-indigo-700">
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            Иллюстрации генерируются: осталось {pendingImages}
                        </span>
                    )}
                </div>
            </div>

            <div className="mx-auto w-full max-w-[1100px] space-y-4">
                <div
                    ref={viewerRef}
                    data-slide-viewer=""
                    className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                    <SlideCanvas
                        key={index}
                        slide={slide}
                        presentation={presentation}
                        language={lesson?.language}
                        eager
                        label={`Слайд ${index + 1} из ${total}`}
                    />
                </div>

                <nav aria-label="Навигация по слайдам" className="flex items-center justify-between gap-3">
                    <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} className={navButtonClassName}>
                        <ArrowLeft className="h-4 w-4" />
                        Назад
                    </button>
                    <span className="text-sm font-medium tabular-nums text-slate-600" aria-live="polite">
                        {index + 1} / {total}
                    </span>
                    <button type="button" onClick={() => goTo(index + 1)} disabled={index >= total - 1} className={navButtonClassName}>
                        Далее
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </nav>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <MessageSquareText className="h-4 w-4 text-slate-500" />
                        Заметки докладчика
                    </h4>
                    {notes ? (
                        <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-700">{notes}</p>
                    ) : (
                        <p className="mt-2 text-sm text-slate-400">Для этого слайда заметок нет.</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {slides.map((item, slideIndex) => {
                    const active = slideIndex === index;

                    return (
                        <button
                            key={slideIndex}
                            type="button"
                            data-slide-thumb={slideIndex}
                            onClick={() => selectSlide(slideIndex)}
                            aria-label={`Слайд ${slideIndex + 1}`}
                            aria-current={active ? 'true' : undefined}
                            className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${active ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-slate-200 hover:border-slate-300 hover:shadow'}`}
                        >
                            <div className="pointer-events-none w-full select-none">
                                <SlideCanvas slide={item} presentation={presentation} language={lesson?.language} />
                            </div>
                            <div className={`flex w-full min-w-0 items-center gap-2 border-t px-2.5 py-1.5 text-xs ${active ? 'border-indigo-100 bg-indigo-50 text-indigo-900' : 'border-slate-100 text-slate-600'}`}>
                                <span className="font-semibold tabular-nums">{slideIndex + 1}</span>
                                <span className="min-w-0 truncate">{slideCaption(item, presentation)}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

export default function Show({ lesson }) {
    const safeLesson = lesson ?? {};
    const inProgress = isLessonInProgress(safeLesson.status);
    const hasLecture = Boolean(safeLesson.lecture);
    // Copy only a complete lecture (mirrors the server-side hasLecture() used for the DOCX link).
    const lectureComplete = hasLecture && Boolean(safeLesson.progress?.sections);
    const hasPresentation = Boolean(safeLesson.presentation) && asList(safeLesson.presentation?.slides).length > 0;
    const downloads = safeLesson.downloads ?? {};
    const [tab, setTab] = useState(() => (hasLecture || !hasPresentation ? 'lecture' : 'presentation'));
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [busy, setBusy] = useState(false);

    // If the chosen tab's content is missing but the other one exists (e.g. after a poll), fall back.
    const activeTab = tab === 'presentation' && !hasPresentation && hasLecture
        ? 'lecture'
        : tab === 'lecture' && !hasLecture && hasPresentation
            ? 'presentation'
            : tab;

    useEffect(() => {
        if (!inProgress) {
            return undefined;
        }

        const timer = window.setInterval(() => {
            router.reload({ only: ['lesson'], preserveScroll: true });
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [inProgress]);

    const lectureText = useMemo(() => buildLectureText(safeLesson.lecture, safeLesson), [safeLesson]);

    const copyLecture = async () => {
        if (!lectureText) {
            toast.error('Лекция ещё не готова.');
            return;
        }

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(lectureText);
            } else {
                // Plain-HTTP or older browsers: fall back to the legacy selection-based copy.
                const area = document.createElement('textarea');
                area.value = lectureText;
                area.setAttribute('readonly', '');
                area.style.position = 'fixed';
                area.style.left = '-9999px';
                document.body.appendChild(area);
                area.select();
                const copied = document.execCommand('copy');
                document.body.removeChild(area);

                if (!copied) {
                    throw new Error('Clipboard API unavailable');
                }
            }

            toast.success('Текст лекции скопирован');
        } catch (error) {
            toast.error('Не удалось скопировать');
        }
    };

    const retry = () => {
        router.post(route('teacher-ai.lessons.retry', safeLesson.id), {}, {
            preserveScroll: true,
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
        });
    };

    const destroy = () => {
        router.delete(route('teacher-ai.lessons.destroy', safeLesson.id), {
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
        });
    };

    const tabs = [
        { key: 'lecture', label: 'Лекция', Icon: BookOpenText, disabled: !hasLecture, hint: !hasLecture && inProgress ? 'готовится…' : null },
        { key: 'presentation', label: 'Презентация', Icon: Presentation, disabled: !hasPresentation, hint: !hasPresentation && inProgress ? 'готовится…' : null },
    ];

    return (
        <AuthenticatedLayout
            header={(
                <div className="space-y-2">
                    <Link
                        href={route('teacher-ai.lessons.index')}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Все материалы
                    </Link>
                    <h2 className="break-words text-2xl font-semibold text-slate-900">{safeLesson.title || safeLesson.topic || 'Материалы занятия'}</h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
                        <LessonStatusBadge status={safeLesson.status} />
                        {safeLesson.subject && <span className="break-words">{safeLesson.subject}</span>}
                        {safeLesson.language_label && <span>{safeLesson.language_label}</span>}
                        {Number(safeLesson.duration_minutes) > 0 && <span>{safeLesson.duration_minutes} мин</span>}
                        {hasPresentation
                            ? <span>{asList(safeLesson.presentation?.slides).length} {pluralSlides(asList(safeLesson.presentation?.slides).length)}</span>
                            : Number(safeLesson.slides_count) > 0 && <span>Запрошено: {safeLesson.slides_count} {pluralSlides(safeLesson.slides_count)}</span>}
                        {safeLesson.created_at && <span>{safeLesson.created_at}</span>}
                    </div>
                </div>
            )}
        >
            <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                    <p>
                        Это черновик, сгенерированный ИИ. Проверяйте факты, формулы, даты и список литературы
                        перед использованием на занятии.
                    </p>
                </div>

                {inProgress && (
                    <div className="rounded-3xl border border-sky-200 bg-sky-50 px-6 py-8">
                        <div className="flex flex-col items-center text-center">
                            <LoaderCircle className="h-10 w-10 animate-spin text-sky-600" />
                            <h3 className="mt-4 text-lg font-semibold text-sky-900">
                                {safeLesson.status === 'pending' ? 'Занятие в очереди на генерацию' : 'ИИ готовит материалы'}
                            </h3>
                            <p className="mt-1 max-w-md text-sm text-sky-800">
                                Обычно это занимает 2–5 минут. Страница обновится сама, можно её не закрывать.
                            </p>
                        </div>
                        <div className="mt-6 rounded-2xl bg-white/70 p-4">
                            <StepProgress lesson={safeLesson} />
                        </div>
                    </div>
                )}

                {safeLesson.status === 'failed' && (
                    <div className="space-y-5 rounded-3xl border border-rose-200 bg-rose-50 p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-rose-900">Генерация не завершена</h3>
                                    <p className="mt-1 break-words text-sm text-rose-800">{safeLesson.error_message ?? 'Попробуйте ещё раз позже.'}</p>
                                </div>
                            </div>
                            {safeLesson.can_retry && (
                                <button
                                    type="button"
                                    onClick={retry}
                                    disabled={busy}
                                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Повторить
                                </button>
                            )}
                        </div>
                        <div className="rounded-2xl bg-white/70 p-4">
                            <StepProgress lesson={safeLesson} />
                        </div>
                    </div>
                )}

                {(hasLecture || hasPresentation || inProgress) && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div role="tablist" aria-label="Материалы занятия" className="inline-flex flex-wrap gap-1 self-start rounded-xl border border-slate-200 bg-white p-1">
                            {tabs.map(({ key, label, Icon, disabled, hint }) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    onClick={() => setTab(key)}
                                    disabled={disabled}
                                    title={disabled && !hint ? 'Ещё не готова' : undefined}
                                    aria-selected={activeTab === key}
                                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${activeTab === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                    {hint && <span className="text-xs font-normal opacity-80">{hint}</span>}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {/* Downloads are real files: plain anchors trigger a browser download, Inertia would try to parse the body. */}
                            {downloads.lecture && (
                                <a
                                    href={downloads.lecture}
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                                >
                                    <Download className="h-4 w-4" />
                                    Скачать лекцию (DOCX)
                                </a>
                            )}
                            {downloads.presentation && (
                                <a
                                    href={downloads.presentation}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[#2a4d7a]"
                                >
                                    <Download className="h-4 w-4" />
                                    Скачать презентацию (PPTX)
                                </a>
                            )}
                            {lectureComplete && (
                                <button
                                    type="button"
                                    onClick={copyLecture}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                    <Copy className="h-4 w-4" />
                                    Копировать текст лекции
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {(hasLecture || hasPresentation) && (
                    <div role="tabpanel">
                        {activeTab === 'lecture'
                            ? <LectureTab lesson={safeLesson} inProgress={inProgress} />
                            : <PresentationTab lesson={safeLesson} inProgress={inProgress} />}
                    </div>
                )}

                {safeLesson.notes && (
                    <p className="break-words text-sm text-slate-500">
                        <span className="font-medium text-slate-700">Ваши пожелания для ИИ: </span>
                        {safeLesson.notes}
                    </p>
                )}

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                    >
                        <Trash2 className="h-4 w-4" />
                        Удалить материалы
                    </button>
                </div>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Удалить материалы?"
                description="Лекция и презентация будут удалены без возможности восстановления."
                onConfirm={destroy}
            />
        </AuthenticatedLayout>
    );
}
