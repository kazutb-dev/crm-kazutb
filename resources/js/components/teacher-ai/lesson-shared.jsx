import { Check, CheckCircle2, Clock3, LoaderCircle, XCircle } from 'lucide-react';

/**
 * Status palette for generated lessons. Mirrors STATUS_META from
 * teacher-ai/shared.jsx so both modules look identical in lists.
 */
export const LESSON_STATUS_META = {
    pending: {
        label: 'В очереди',
        className: 'border-slate-200 bg-slate-100 text-slate-700',
        Icon: Clock3,
    },
    processing: {
        label: 'Генерируется',
        className: 'border-blue-200 bg-blue-100 text-blue-700',
        Icon: LoaderCircle,
        spin: true,
    },
    completed: {
        label: 'Готово',
        className: 'border-emerald-200 bg-emerald-100 text-emerald-700',
        Icon: CheckCircle2,
    },
    failed: {
        label: 'Ошибка',
        className: 'border-red-200 bg-red-100 text-red-700',
        Icon: XCircle,
    },
};

/** Generation steps in execution order (see TeacherAiLesson::STEP_*). */
export const STEP_META = [
    { key: 'outline', label: 'План лекции' },
    { key: 'sections', label: 'Текст лекции' },
    { key: 'slides', label: 'Презентация' },
    { key: 'images', label: 'Иллюстрации' },
];

/**
 * Steps shown for a lesson: the images step is hidden when the deck has no
 * image slots (images_total = 0) and the lesson is not on that step.
 */
export function visibleSteps(lesson) {
    const imagesTotal = Number(lesson?.progress?.images_total ?? 0);

    return STEP_META.filter((step) => step.key !== 'images' || imagesTotal > 0 || lesson?.step === 'images');
}

export const isLessonInProgress = (status) => status === 'pending' || status === 'processing';

/** Russian plural: pluralRu(3, ['раздел', 'раздела', 'разделов']) → 'раздела'. */
export function pluralRu(count, [one, few, many]) {
    const n = Math.abs(Number(count) || 0);
    const mod10 = n % 10;
    const mod100 = n % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return one;
    }

    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return few;
    }

    return many;
}

/** Russian plural for «слайд»: 1 слайд, 2 слайда, 5 слайдов. */
export function pluralSlides(count) {
    const n = Math.abs(Number(count) || 0);
    const mod10 = n % 10;
    const mod100 = n % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return 'слайд';
    }

    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return 'слайда';
    }

    return 'слайдов';
}

export function LessonStatusBadge({ status }) {
    const meta = LESSON_STATUS_META[status] ?? LESSON_STATUS_META.pending;
    const { Icon } = meta;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
            <Icon className={`h-3.5 w-3.5 ${meta.spin ? 'animate-spin' : ''}`} />
            {meta.label}
        </span>
    );
}

/**
 * Resolves the visual state of one generation step.
 *
 * `lesson.step` is the NEXT step to run ('done' when finished), so every step
 * before it is done; the step itself is current (or failed when the lesson
 * failed), and later steps are pending. `lesson.progress` flags take priority
 * so a half-finished `sections` step is still shown as current, not done.
 */
function resolveStepState(stepKey, stepIndex, lesson, steps) {
    const status = lesson?.status;
    const progress = lesson?.progress ?? {};
    const currentIndex = lesson?.step === 'done'
        ? steps.length
        : steps.findIndex((step) => step.key === lesson?.step);
    const imagesTotal = Number(progress.images_total ?? 0);
    const isDoneByProgress = {
        outline: Boolean(progress.outline),
        sections: Boolean(progress.sections),
        slides: Boolean(progress.slides),
        images: imagesTotal > 0 && Number(progress.images_done ?? 0) >= imagesTotal,
    }[stepKey] ?? false;

    if (status === 'completed' || isDoneByProgress || (currentIndex >= 0 && stepIndex < currentIndex)) {
        return 'done';
    }

    if (stepIndex === currentIndex || (currentIndex < 0 && stepIndex === 0)) {
        return status === 'failed' ? 'failed' : 'current';
    }

    return 'pending';
}

const STEP_STATE_CLASSES = {
    done: {
        circle: 'border-teal-700 bg-teal-700 text-white',
        label: 'text-[#102945]',
        line: 'bg-teal-600',
    },
    current: {
        circle: 'border-teal-600 bg-teal-50 text-teal-700',
        label: 'text-teal-700',
        line: 'bg-slate-200',
    },
    failed: {
        circle: 'border-red-600 bg-red-50 text-red-700',
        label: 'text-red-800',
        line: 'bg-slate-200',
    },
    pending: {
        circle: 'border-slate-300 bg-white text-slate-400',
        label: 'text-slate-500',
        line: 'bg-slate-200',
    },
};

/**
 * Progress strip: План лекции → Текст лекции → Презентация → Иллюстрации.
 * Shows «Разделы: X из Y» under the sections step and «Картинки: X из Y»
 * under the images step once they have started.
 */
export function StepProgress({ lesson }) {
    const progress = lesson?.progress ?? {};
    const sectionsDone = Number(progress.sections_done ?? 0);
    const sectionsTotal = Number(progress.sections_total ?? 0);
    const imagesDone = Number(progress.images_done ?? 0);
    const imagesTotal = Number(progress.images_total ?? 0);
    const inProgress = isLessonInProgress(lesson?.status);
    const steps = visibleSteps(lesson);

    return (
        <ol className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
            {steps.map((step, index) => {
                const state = resolveStepState(step.key, index, lesson, steps);
                const classes = STEP_STATE_CLASSES[state];
                const isLast = index === steps.length - 1;
                const showSectionsCounter = step.key === 'sections' && sectionsTotal > 0 && state !== 'pending';
                const showImagesCounter = step.key === 'images' && imagesTotal > 0 && state !== 'pending';

                return (
                    <li key={step.key} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:gap-2">
                        <div className="flex items-center sm:w-full">
                            {/* Left connector (desktop only) */}
                            <span
                                aria-hidden="true"
                                className={`hidden h-0.5 flex-1 sm:block ${index === 0 ? 'bg-transparent' : classes.line}`}
                            />
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums ${classes.circle}`}>
                                {state === 'done' && <Check className="h-4 w-4" />}
                                {state === 'current' && (inProgress
                                    ? <LoaderCircle className="h-4 w-4 animate-spin" />
                                    : index + 1)}
                                {state === 'failed' && <XCircle className="h-4 w-4" />}
                                {state === 'pending' && index + 1}
                            </span>
                            {/* Right connector (desktop only) */}
                            <span
                                aria-hidden="true"
                                className={`hidden h-0.5 flex-1 sm:block ${isLast ? 'bg-transparent' : (state === 'done' ? 'bg-teal-600' : 'bg-slate-200')}`}
                            />
                        </div>
                        <div className="min-w-0 sm:text-center">
                            <p className={`text-sm font-semibold ${classes.label}`}>{step.label}</p>
                            {showSectionsCounter && (
                                <p className="text-xs text-slate-500">
                                    Разделы: {Math.min(sectionsDone, sectionsTotal)} из {sectionsTotal}
                                </p>
                            )}
                            {showImagesCounter && (
                                <p className="text-xs text-slate-500">
                                    Картинки: {Math.min(imagesDone, imagesTotal)} из {imagesTotal}
                                </p>
                            )}
                            {state === 'failed' && (
                                <p className="text-xs text-red-700">Остановлено на этом шаге</p>
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
