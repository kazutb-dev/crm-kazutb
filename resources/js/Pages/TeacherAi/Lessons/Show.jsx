import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Notice, PageHeader, underlineTabClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    return <h4 className="qd-field-label text-teal-700">{children}</h4>;
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
            <h3 className="break-words font-display text-lg font-bold text-[#102945]">
                <span className="mr-2 tabular-nums text-teal-700">{index + 1}.</span>
                {title}
            </h3>

            {isGenerated ? (
                <>
                    <Paragraphs text={paragraphs.map(asText).join('\n\n')} className="mt-3" />

                    {keyTerms.length > 0 && (
                        <dl className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:grid-cols-2 2xl:grid-cols-3">
                            {keyTerms.map((term, termIndex) => (
                                <div key={termIndex} className="min-w-0">
                                    <dt className="break-words text-sm font-semibold text-[#102945]">{asText(term?.term)}</dt>
                                    <dd className="mt-0.5 break-words text-sm leading-6 text-slate-700">{asText(term?.definition)}</dd>
                                </div>
                            ))}
                        </dl>
                    )}

                    {examples.map((example, exampleIndex) => (
                        <div key={exampleIndex} className="mt-3 flex items-start gap-2 rounded-[10px] border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-[#102945]">
                            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                            <p className="whitespace-pre-line break-words leading-6">
                                <span className="font-semibold">Пример{examples.length > 1 ? ` ${exampleIndex + 1}` : ''}: </span>
                                {asText(example)}
                            </p>
                        </div>
                    ))}

                    {summary && (
                        <p className="mt-3 break-words border-l-[3px] border-teal-600 bg-slate-50 px-4 py-2.5 text-sm italic leading-6 text-slate-700">
                            {summary}
                        </p>
                    )}
                </>
            ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
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
                                <LoaderCircle className="h-4 w-4 animate-spin text-teal-700" />
                                Генерируется…
                            </>
                        ) : (
                            <>
                                <XCircle className="h-4 w-4 text-red-600" />
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
            <div className="rounded-[14px] border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
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

    const railCard = 'rounded-[14px] border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_0_rgba(25,28,29,0.04)]';
    const hasRail = objectives.length > 0 || sections.length > 0 || questions.length > 0 || glossary.length > 0 || references.length > 0 || keywords.length > 0;

    return (
        <div className={`grid items-start gap-4 ${hasRail ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : ''}`}>
        <section className="min-w-0 space-y-6 rounded-[14px] border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_0_rgba(25,28,29,0.04)] sm:px-6">
            <header className="space-y-1">
                <h3 className="break-words font-display text-xl font-bold leading-tight text-[#102945]">{asText(lecture.title) || asText(lesson?.title)}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    {wordCount > 0 && <span className="tabular-nums">≈ {numberFormat.format(wordCount)} слов</span>}
                    {sections.length > 0 && <span>{sections.length} {pluralRu(sections.length, ['раздел', 'раздела', 'разделов'])}</span>}
                    {questions.length > 0 && <span className="tabular-nums">{questions.length} {pluralRu(questions.length, ['вопрос', 'вопроса', 'вопросов'])}</span>}
                    {glossary.length > 0 && <span className="tabular-nums">{glossary.length} {pluralRu(glossary.length, ['термин', 'термина', 'терминов'])}</span>}
                    {lesson?.model && <span className="text-slate-400">Модель: {lesson.model}</span>}
                </div>
            </header>

            {asText(lecture.introduction) && (
                <div>
                    <SectionHeading>Введение</SectionHeading>
                    <Paragraphs text={lecture.introduction} className="mt-2" />
                </div>
            )}

            {sections.length > 0 && (
                <div className="space-y-8 border-t border-slate-200 pt-6">
                    {sections.map((section, index) => (
                        <LectureSection key={index} section={section} index={index} inProgress={inProgress} />
                    ))}
                </div>
            )}

            {asText(lecture.conclusion) && (
                <div className="border-t border-slate-200 pt-6">
                    <SectionHeading>Заключение</SectionHeading>
                    <Paragraphs text={lecture.conclusion} className="mt-2" />
                </div>
            )}
        </section>

        {hasRail && (
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
            {objectives.length > 0 && (
                <div className={railCard}>
                    <SectionHeading>Цели обучения</SectionHeading>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 marker:text-teal-600">
                        {objectives.map((objective, index) => (
                            <li key={index} className="break-words">{asText(objective)}</li>
                        ))}
                    </ul>
                </div>
            )}

            {sections.length > 0 && (
                <div className={railCard}>
                    <SectionHeading>План лекции</SectionHeading>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-700">
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

            {questions.length > 0 && (
                <div className={railCard}>
                    <SectionHeading>Вопросы для самопроверки</SectionHeading>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-700">
                        {questions.map((question, index) => (
                            <li key={index} className="break-words">{asText(question)}</li>
                        ))}
                    </ol>
                </div>
            )}

            {glossary.length > 0 && (
                <div className={railCard}>
                    <SectionHeading>Глоссарий</SectionHeading>
                    <dl className="mt-2 divide-y divide-slate-200">
                        {glossary.map((item, index) => (
                            <div key={index} className="min-w-0 py-2 first:pt-0 last:pb-0">
                                <dt className="break-words text-sm font-semibold text-[#102945]">{asText(item?.term)}</dt>
                                <dd className="mt-0.5 break-words text-sm leading-6 text-slate-700">{asText(item?.definition)}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}

            {references.length > 0 && (
                <div className={railCard}>
                    <SectionHeading>Рекомендуемая литература</SectionHeading>
                    <Notice tone="warning" className="mt-2">
                        Список литературы сформирован ИИ — проверьте источники.
                    </Notice>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-700">
                        {references.map((reference, index) => (
                            <li key={index} className="break-words">{asText(reference)}</li>
                        ))}
                    </ol>
                </div>
            )}

            {keywords.length > 0 && (
                <div className={railCard}>
                    <SectionHeading>Ключевые слова</SectionHeading>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {keywords.map((keyword, index) => (
                            <span key={index} className="max-w-full break-words rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                                {asText(keyword)}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </aside>
        )}
        </div>
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
            <div className="rounded-[14px] border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
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

    

    return (
        <section className="space-y-4">
            <div className="min-w-0">
                <h3 className="break-words font-display text-lg font-bold text-[#102945]">{asText(presentation.title) || asText(lesson?.title)}</h3>
                {asText(presentation.subtitle) && (
                    <p className="mt-1 break-words text-sm text-slate-500">{presentation.subtitle}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span className="tabular-nums">{total} {pluralSlides(total)}</span>
                    {pendingImages > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-teal-700">
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            Иллюстрации генерируются: осталось {pendingImages}
                        </span>
                    )}
                </div>
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="min-w-0 space-y-3">
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
                        <Button type="button" variant="outline" onClick={() => goTo(index - 1)} disabled={index === 0} className="gap-1.5">
                            <ArrowLeft className="h-4 w-4" />
                            Назад
                        </Button>
                        <span className="text-sm font-medium tabular-nums text-slate-600" aria-live="polite">
                            {index + 1} / {total}
                        </span>
                        <Button type="button" variant="outline" onClick={() => goTo(index + 1)} disabled={index >= total - 1} className="gap-1.5">
                            Далее
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </nav>
                </div>

                <div className="min-w-0 space-y-4 xl:sticky xl:top-4">
                    <div className="rounded-[14px] border border-slate-200 bg-white px-4 py-3">
                        <h4 className="qd-field-label flex items-center gap-2 text-[#102945]">
                            <MessageSquareText className="h-4 w-4 text-teal-700" />
                            Заметки докладчика · слайд {index + 1}
                        </h4>
                        {notes ? (
                            <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line break-words text-sm leading-6 text-slate-700">{notes}</p>
                        ) : (
                            <p className="mt-2 text-sm text-slate-500">Для этого слайда заметок нет.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:max-h-[calc(100vh-18rem)] xl:grid-cols-2 xl:overflow-y-auto xl:pr-1">
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
                                    className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${active ? 'border-teal-600 ring-2 ring-teal-600' : 'border-slate-200 hover:border-slate-400'}`}
                                >
                                    <div className="pointer-events-none w-full select-none">
                                        <SlideCanvas slide={item} presentation={presentation} language={lesson?.language} />
                                    </div>
                                    <div className={`flex w-full min-w-0 items-center gap-2 border-t px-2 py-1 text-xs ${active ? 'border-teal-200 bg-teal-50 text-[#102945]' : 'border-slate-200 text-slate-600'}`}>
                                        <span className="font-semibold tabular-nums">{slideIndex + 1}</span>
                                        <span className="min-w-0 truncate">{slideCaption(item, presentation)}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
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

    const slidesTotal = asList(safeLesson.presentation?.slides).length;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow={(
                        <Link
                            href={route('teacher-ai.lessons.index')}
                            className="inline-flex items-center gap-1.5 hover:text-[#102945]"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Все материалы
                        </Link>
                    )}
                    title={<span className="break-words">{safeLesson.title || safeLesson.topic || 'Материалы занятия'}</span>}
                    description={(
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {safeLesson.subject && <span className="break-words">{safeLesson.subject}</span>}
                            {safeLesson.language_label && <span>{safeLesson.language_label}</span>}
                            {Number(safeLesson.duration_minutes) > 0 && <span className="tabular-nums">{safeLesson.duration_minutes} мин</span>}
                            {hasPresentation
                                ? <span className="tabular-nums">{slidesTotal} {pluralSlides(slidesTotal)}</span>
                                : Number(safeLesson.slides_count) > 0 && <span className="tabular-nums">Запрошено: {safeLesson.slides_count} {pluralSlides(safeLesson.slides_count)}</span>}
                            {safeLesson.created_at && <span className="tabular-nums">{safeLesson.created_at}</span>}
                        </span>
                    )}
                    meta={<LessonStatusBadge status={safeLesson.status} />}
                    actions={(
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setConfirmDelete(true)}
                            disabled={busy}
                            className="gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            Удалить материалы
                        </Button>
                    )}
                />
            )}
        >
            <div className="admin-page-wrap space-y-6">
                <Notice tone="brand">
                    Это черновик, сгенерированный ИИ. Проверяйте факты, формулы, даты и список литературы
                    перед использованием на занятии.
                </Notice>

                {inProgress && (
                    <Card>
                        <CardContent className="space-y-4 py-6">
                            <div className="flex flex-col items-center text-center">
                                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                    <LoaderCircle className="h-6 w-6 animate-spin" />
                                </span>
                                <h3 className="mt-3 font-display text-base font-bold text-[#102945]">
                                    {safeLesson.status === 'pending' ? 'Занятие в очереди на генерацию' : 'ИИ готовит материалы'}
                                </h3>
                                <p className="mt-1 max-w-md text-sm text-slate-600">
                                    Обычно это занимает 2–5 минут. Страница обновится сама, можно её не закрывать.
                                </p>
                            </div>
                            <div className="border-t border-slate-200 pt-4">
                                <StepProgress lesson={safeLesson} />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {safeLesson.status === 'failed' && (
                    <Card className="border-red-200">
                        <CardContent className="space-y-4">
                            <Notice
                                tone="danger"
                                title="Генерация не завершена"
                                action={safeLesson.can_retry ? (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={retry}
                                        disabled={busy}
                                        className="shrink-0 gap-2"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                        Повторить
                                    </Button>
                                ) : null}
                            >
                                <span className="break-words">{safeLesson.error_message ?? 'Попробуйте ещё раз позже.'}</span>
                            </Notice>
                            <StepProgress lesson={safeLesson} />
                        </CardContent>
                    </Card>
                )}

                {(hasLecture || hasPresentation || inProgress) && (
                    <div className="flex flex-col gap-3 border-b border-slate-200 lg:flex-row lg:items-end lg:justify-between">
                        <div role="tablist" aria-label="Материалы занятия" className="flex flex-wrap gap-x-6 gap-y-1">
                            {tabs.map(({ key, label, Icon, disabled, hint }) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    onClick={() => setTab(key)}
                                    disabled={disabled}
                                    title={disabled && !hint ? 'Ещё не готова' : undefined}
                                    aria-selected={activeTab === key}
                                    className={`${underlineTabClass(activeTab === key)} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-transparent`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                    {hint && <span className="text-xs font-normal opacity-80">{hint}</span>}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-2 pb-3">
                            {/* Downloads are real files: plain anchors trigger a browser download, Inertia would try to parse the body. */}
                            {downloads.lecture && (
                                <Button asChild size="sm" className="gap-2">
                                    <a href={downloads.lecture}>
                                        <Download className="h-4 w-4" />
                                        Скачать лекцию (DOCX)
                                    </a>
                                </Button>
                            )}
                            {downloads.presentation && (
                                <Button asChild size="sm" variant="ink" className="gap-2">
                                    <a href={downloads.presentation}>
                                        <Download className="h-4 w-4" />
                                        Скачать презентацию (PPTX)
                                    </a>
                                </Button>
                            )}
                            {lectureComplete && (
                                <Button type="button" size="sm" variant="outline" onClick={copyLecture} className="gap-2">
                                    <Copy className="h-4 w-4" />
                                    Копировать текст лекции
                                </Button>
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
                    <div className="rounded-[14px] border border-slate-200 bg-white px-5 py-3">
                        <p className="qd-field-label text-slate-500">Ваши пожелания для ИИ</p>
                        <p className="mt-1.5 break-words text-sm text-slate-700">{safeLesson.notes}</p>
                    </div>
                )}
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
