<?php

namespace App\Services\TeacherAi;

use App\Jobs\GenerateTeacherAiLesson;
use App\Models\TeacherAiLesson;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/**
 * Use cases of the lesson generator: creating and retrying lessons, running
 * the step machine from the queue job and presenting lessons to the UI.
 *
 * Generation is split into steps (outline → sections → slides → images), one
 * queue job run per step or batch, so that every run stays well below the
 * worker timeout. The lesson row is the only state: a retry resumes from `step`.
 */
final class TeacherAiLessonService
{
    public const DURATIONS = [50, 75, 90, 100, 120];

    public const SLIDES_MIN = LessonDeckGenerator::MIN_SLIDES;

    public const SLIDES_MAX = LessonDeckGenerator::MAX_SLIDES;

    public const SLIDES_DEFAULT = LessonDeckGenerator::DEFAULT_SLIDES;

    public const LECTURE_NUMBER_MAX = 60;

    /**
     * How many times the sections step may end with at least one failed
     * section before the whole lesson is marked failed.
     */
    private const MAX_SECTION_STEP_ATTEMPTS = 3;

    /**
     * Same for the slides step (a part of the deck that keeps failing).
     */
    private const MAX_SLIDES_STEP_ATTEMPTS = 3;

    /**
     * Attempts per slide image; a failed image never fails the lesson, the
     * slide just keeps its placeholder.
     */
    private const MAX_IMAGE_ATTEMPTS = 2;

    /**
     * A rate-limited image request is not counted as an attempt, up to this
     * many times; the next batch then waits RATE_LIMIT_DELAY seconds.
     */
    private const MAX_IMAGE_THROTTLES = 6;

    private const RATE_LIMIT_DELAY = 30;

    private const STALE_MESSAGE = 'Генерация не завершилась. Нажмите «Повторить» — работа продолжится с места остановки.';

    public function __construct(
        private readonly TeacherAiChatClient $client,
        private readonly LessonGenerator $generator,
        private readonly LessonDeckGenerator $deck,
        private readonly TeacherAiImageClient $images,
    ) {}

    public function isEnabled(): bool
    {
        return $this->client->isEnabled();
    }

    public function dailyLimit(): int
    {
        return max(1, (int) config('services.teacher_ai.lesson_daily_limit', 10));
    }

    /**
     * Parallel section requests per job run.
     */
    public function concurrency(): int
    {
        return max(1, min(8, (int) config('services.teacher_ai.lesson_concurrency', 4)));
    }

    public function imagesEnabled(): bool
    {
        return $this->images->isEnabled();
    }

    /**
     * Upper bound of illustrated slides per deck (the lecture title slide included).
     */
    public function imagesMax(): int
    {
        return max(1, min(20, (int) config('services.teacher_ai.images_max', 8)));
    }

    /**
     * Parallel image requests per job run.
     */
    public function imageConcurrency(): int
    {
        return max(1, min(6, (int) config('services.teacher_ai.image_concurrency', 3)));
    }

    public function usedToday(User $user): int
    {
        return TeacherAiLesson::query()
            ->where('user_id', $user->id)
            ->where('created_at', '>=', now()->startOfDay())
            ->count();
    }

    /**
     * @return array{languages: list<array{value: string, label: string}>, durations: list<int>, slides: array{min: int, max: int, default: int}}
     */
    public static function formOptions(): array
    {
        return [
            'languages' => LessonLocale::options(),
            'durations' => self::DURATIONS,
            'slides' => [
                'min' => self::SLIDES_MIN,
                'max' => self::SLIDES_MAX,
                'default' => self::SLIDES_DEFAULT,
            ],
        ];
    }

    /**
     * Latest lessons of the teacher for the index page.
     *
     * @return list<array<string, mixed>>
     */
    public function listForUser(User $user): array
    {
        // The list is polled every few seconds, so the JSON blobs stay in the
        // database: only the title and the slide count are extracted.
        return TeacherAiLesson::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->limit(50)
            ->select(['id', 'subject', 'topic', 'language', 'status', 'step', 'created_at', 'updated_at'])
            ->selectRaw("JSON_UNQUOTE(JSON_EXTRACT(outline, '$.title')) AS outline_title")
            ->selectRaw("JSON_LENGTH(JSON_EXTRACT(presentation, '$.slides')) AS slides_total")
            ->selectRaw("JSON_EXTRACT(presentation, '$.version') AS deck_version")
            ->get()
            ->map(function (TeacherAiLesson $lesson): array {
                $title = $lesson->getAttribute('outline_title');
                $hasDeck = (int) ($lesson->getAttribute('deck_version') ?? 0) >= TeacherAiLesson::PRESENTATION_VERSION;
                $slidesTotal = $hasDeck ? (int) ($lesson->getAttribute('slides_total') ?? 0) : 0;

                return [
                    'id' => $lesson->id,
                    'title' => is_string($title) && trim($title) !== '' && $title !== 'null' ? $title : (string) $lesson->topic,
                    'subject' => $lesson->subject,
                    'topic' => $lesson->topic,
                    'language_label' => LessonLocale::label((string) $lesson->language),
                    'status' => $this->publicStatus($lesson),
                    'step' => $lesson->step,
                    'created_at' => $lesson->created_at?->format('d.m.Y H:i'),
                    'slides_total' => $slidesTotal > 0 ? $slidesTotal : null,
                    // The step only advances past `sections` once every section exists.
                    'has_lecture' => in_array($lesson->step, [TeacherAiLesson::STEP_SLIDES, TeacherAiLesson::STEP_IMAGES, TeacherAiLesson::STEP_DONE], true),
                    'has_presentation' => $slidesTotal > 0,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $validated  already validated by the controller
     */
    public function create(User $user, array $validated): TeacherAiLesson
    {
        $audience = trim((string) ($validated['audience'] ?? ''));
        $notes = trim((string) ($validated['notes'] ?? ''));
        $faculty = trim((string) ($validated['faculty_name'] ?? ''));
        $department = trim((string) ($validated['department_name'] ?? ''));
        $number = (int) ($validated['lecture_number'] ?? 0);

        $lesson = TeacherAiLesson::create([
            'user_id' => $user->id,
            'subject' => mb_substr(trim((string) $validated['subject']), 0, 255),
            'topic' => mb_substr(trim((string) $validated['topic']), 0, 500),
            'language' => array_key_exists((string) $validated['language'], LessonLocale::LANGUAGES) ? (string) $validated['language'] : 'ru',
            'audience' => $audience !== '' ? mb_substr($audience, 0, 255) : null,
            'duration_minutes' => (int) $validated['duration_minutes'],
            'slides_count' => max(self::SLIDES_MIN, min(self::SLIDES_MAX, (int) $validated['slides_count'])),
            'lecture_number' => $number >= 1 && $number <= self::LECTURE_NUMBER_MAX ? $number : null,
            'faculty_name' => $faculty !== '' ? mb_substr($faculty, 0, 255) : null,
            'department_name' => $department !== '' ? mb_substr($department, 0, 255) : null,
            'notes' => $notes !== '' ? mb_substr($notes, 0, 1000) : null,
            'status' => TeacherAiLesson::STATUS_PENDING,
            'step' => TeacherAiLesson::STEP_OUTLINE,
            'step_attempts' => 0,
        ]);

        GenerateTeacherAiLesson::dispatch($lesson->id);

        return $lesson;
    }

    /**
     * Re-queues a failed or stuck lesson. Generated parts are kept, so the
     * job resumes at the step recorded in `step`.
     */
    public function retry(TeacherAiLesson $lesson): void
    {
        // Conditional update: a double click or a stale lesson whose original job
        // is still queued must not start a second, parallel generation chain.
        $claimed = TeacherAiLesson::query()
            ->whereKey($lesson->id)
            ->where(function ($query): void {
                $query->where('status', TeacherAiLesson::STATUS_FAILED)
                    ->orWhere(function ($query): void {
                        $query->whereIn('status', [TeacherAiLesson::STATUS_PENDING, TeacherAiLesson::STATUS_PROCESSING])
                            ->where('updated_at', '<', now()->subMinutes(TeacherAiLesson::STALE_AFTER_MINUTES));
                    });
            })
            ->update([
                'status' => TeacherAiLesson::STATUS_PENDING,
                'error_message' => null,
                'step_attempts' => 0,
                'updated_at' => now(),
            ]);

        $lesson->refresh();

        if ($claimed === 0) {
            return;
        }

        // A teacher's retry gives images that gave up another chance.
        if ($lesson->step === TeacherAiLesson::STEP_IMAGES) {
            $images = $lesson->images ?? [];

            foreach ($images as $index => $entry) {
                if (is_array($entry) && ($entry['status'] ?? null) === TeacherAiLesson::IMAGE_FAILED) {
                    $images[$index] = ['status' => 'pending', 'attempts' => 0, 'throttled' => 0] + $entry;
                }
            }

            $lesson->forceFill(['images' => $images])->save();
        }

        GenerateTeacherAiLesson::dispatch($lesson->id);
    }

    /**
     * Deletes the lesson and its generated images.
     */
    public function delete(TeacherAiLesson $lesson): void
    {
        Storage::disk(TeacherAiLesson::IMAGE_DISK)->deleteDirectory($lesson->imageDirectory());

        $lesson->delete();
    }

    /**
     * Executes the lesson's current step (or one batch of it). Returns the
     * number of seconds to wait before the next job run (0 = right away), or
     * null when the generation is finished.
     *
     * @throws TeacherAiException
     */
    public function runNextStep(TeacherAiLesson $lesson): ?int
    {
        if ($lesson->status === TeacherAiLesson::STATUS_COMPLETED) {
            return null;
        }

        $lesson->status = TeacherAiLesson::STATUS_PROCESSING;
        $lesson->error_message = null;

        if ($lesson->started_at === null) {
            $lesson->started_at = now();
        }

        $lesson->save();

        return match ($lesson->step) {
            TeacherAiLesson::STEP_OUTLINE => $this->runOutlineStep($lesson),
            TeacherAiLesson::STEP_SECTIONS => $this->runSectionsStep($lesson),
            TeacherAiLesson::STEP_SLIDES => $this->runSlidesStep($lesson),
            TeacherAiLesson::STEP_IMAGES => $this->runImagesStep($lesson),
            default => $this->complete($lesson),
        };
    }

    /**
     * A completed lesson is never downgraded: a late failure callback (e.g.
     * worker timeout fired after the last step saved) must not hide results.
     */
    public function markFailed(TeacherAiLesson $lesson, string $message): void
    {
        if ($lesson->status === TeacherAiLesson::STATUS_COMPLETED) {
            return;
        }

        $lesson->forceFill([
            'status' => TeacherAiLesson::STATUS_FAILED,
            'error_message' => $message,
        ])->save();
    }

    /**
     * @return array<string, mixed>
     */
    public function toListItem(TeacherAiLesson $lesson): array
    {
        return [
            'id' => $lesson->id,
            'title' => $this->title($lesson),
            'subject' => $lesson->subject,
            'topic' => $lesson->topic,
            'language_label' => LessonLocale::label((string) $lesson->language),
            'status' => $this->publicStatus($lesson),
            'step' => $lesson->step,
            'created_at' => $lesson->created_at?->format('d.m.Y H:i'),
            'slides_total' => $lesson->hasPresentation() ? count($lesson->presentation['slides']) : null,
            'has_lecture' => $lesson->hasLecture(),
            'has_presentation' => $lesson->hasPresentation(),
        ];
    }

    /**
     * The `lesson` prop of the Show page.
     *
     * @return array<string, mixed>
     */
    public function toDetails(TeacherAiLesson $lesson): array
    {
        $stale = $lesson->isStale();
        $lecture = $this->lecture($lesson);

        return [
            'id' => $lesson->id,
            'subject' => $lesson->subject,
            'topic' => $lesson->topic,
            'language' => $lesson->language,
            'language_label' => LessonLocale::label((string) $lesson->language),
            'audience' => $lesson->audience,
            'duration_minutes' => $lesson->duration_minutes,
            'slides_count' => $lesson->slides_count,
            'lecture_number' => $lesson->lecture_number,
            'faculty_name' => $lesson->faculty_name,
            'department_name' => $lesson->department_name,
            'notes' => $lesson->notes,
            'status' => $stale ? TeacherAiLesson::STATUS_FAILED : $lesson->status,
            'step' => $lesson->step,
            'error_message' => $stale ? self::STALE_MESSAGE : $lesson->error_message,
            'can_retry' => $lesson->canRetry(),
            'title' => $this->title($lesson),
            'model' => $lesson->model,
            'created_at' => $lesson->created_at?->format('d.m.Y H:i'),
            'completed_at' => $lesson->completed_at?->format('d.m.Y H:i'),
            'progress' => [
                'outline' => $lesson->outline !== null,
                'sections_done' => $lesson->sectionsDone(),
                'sections_total' => $lesson->sectionsTotal(),
                'sections' => $lesson->hasLecture(),
                'slides' => $lesson->hasPresentation(),
                'images_done' => $lesson->imagesDone(),
                'images_total' => count(array_filter(
                    $lesson->imageSlots(),
                    fn (int $index): bool => $lesson->imageEntry($index) !== null,
                )),
            ],
            'lecture' => $lecture,
            'presentation' => $this->presentation($lesson),
            'word_count' => $lecture === null ? 0 : $this->wordCount($lecture),
            'downloads' => [
                'lecture' => $lesson->hasLecture() ? route('teacher-ai.lessons.download.lecture', $lesson, false) : null,
                // The file is offered once the illustrations are done, so it is complete.
                'presentation' => $lesson->hasPresentation() && $lesson->status === TeacherAiLesson::STATUS_COMPLETED
                    ? route('teacher-ai.lessons.download.presentation', $lesson, false)
                    : null,
            ],
        ];
    }

    private function runOutlineStep(TeacherAiLesson $lesson): ?int
    {
        $result = $this->generator->generateOutline($lesson);
        $outline = $result['outline'];

        $lesson->outline = $outline;
        // One slot per planned section; null = not generated yet.
        $lesson->sections = array_fill(0, count($outline['sections'] ?? []), null);
        $lesson->step = TeacherAiLesson::STEP_SECTIONS;
        $lesson->step_attempts = 0;
        $this->applyUsage($lesson, $result['usage'] ?? []);
        $lesson->save();

        return 0;
    }

    private function runSectionsStep(TeacherAiLesson $lesson): ?int
    {
        $total = $lesson->sectionsTotal();

        if ($total === 0) {
            // No usable outline (should not happen): start over from the outline.
            $lesson->step = TeacherAiLesson::STEP_OUTLINE;
            $lesson->step_attempts = 0;
            $lesson->save();

            return 0;
        }

        $missing = $lesson->missingSectionIndexes();

        if ($missing !== []) {
            $batch = array_slice($missing, 0, $this->concurrency());
            $result = $this->generator->generateSections($lesson, $batch);

            // Rebuild the whole list and re-assign it: Eloquent only notices
            // a change of a JSON-cast attribute when the attribute itself is set.
            $existing = $lesson->sections ?? [];
            $sections = [];

            for ($index = 0; $index < $total; $index++) {
                $generated = $result['sections'][$index] ?? null;
                $sections[$index] = is_array($generated) ? $generated : ($existing[$index] ?? null);
            }

            $lesson->sections = $sections;
            $this->applyUsage($lesson, $result['usage'] ?? []);

            $failures = $result['failures'] ?? [];

            if ($failures !== []) {
                $lesson->step_attempts = $lesson->step_attempts + 1;

                if ($lesson->step_attempts >= self::MAX_SECTION_STEP_ATTEMPTS) {
                    $lesson->save();

                    throw new TeacherAiException('Не удалось сгенерировать разделы лекции: '.reset($failures));
                }
            }

            $lesson->save();
        }

        if ($lesson->missingSectionIndexes() !== []) {
            // Same step again on the next job run (remaining or failed sections).
            return 0;
        }

        $lesson->step = TeacherAiLesson::STEP_SLIDES;
        $lesson->step_attempts = 0;
        $lesson->save();

        return 0;
    }

    /**
     * Generates the deck in parts (opening, one part per section, closing).
     * Until every part exists, `presentation` holds the work state
     * {plan, parts, extras} — without a version, so it is not shown yet.
     */
    private function runSlidesStep(TeacherAiLesson $lesson): ?int
    {
        $imagesEnabled = $this->images->isEnabled();
        $state = $lesson->presentation;

        if (! is_array($state) || isset($state['version']) || ! is_array($state['plan'] ?? null)) {
            $state = [
                'plan' => $this->deck->plan($lesson, $imagesEnabled, $this->imagesMax()),
                'parts' => [],
                'extras' => [],
            ];
        }

        $missing = array_values(array_diff(array_column($state['plan'], 'key'), array_keys($state['parts'] ?? [])));

        if ($missing !== []) {
            $result = $this->deck->generateParts($lesson, $state['plan'], $missing, $imagesEnabled);

            $state['parts'] = array_merge($state['parts'] ?? [], $result['parts']);
            $state['extras'] = array_merge($state['extras'] ?? [], $result['extras']);
            $lesson->presentation = $state;
            $this->applyUsage($lesson, $result['usage']);

            if ($result['failures'] !== []) {
                $lesson->step_attempts = $lesson->step_attempts + 1;

                if ($lesson->step_attempts >= self::MAX_SLIDES_STEP_ATTEMPTS) {
                    $lesson->save();

                    throw new TeacherAiException('Не удалось подготовить слайды презентации: '.reset($result['failures']));
                }

                $lesson->save();

                return 0;
            }
        }

        $deck = $this->deck->assemble($lesson, $state['plan'], $state['parts'], $state['extras'] ?? [], $imagesEnabled, $this->imagesMax());

        $lesson->presentation = $deck['presentation'];
        $lesson->images = $deck['images'];
        $lesson->step_attempts = 0;

        if ($deck['images'] === []) {
            return $this->complete($lesson);
        }

        $lesson->step = TeacherAiLesson::STEP_IMAGES;
        $lesson->save();

        return 0;
    }

    /**
     * Illustrates the slides, a few images per job run. Image failures never
     * fail the lesson: after MAX_IMAGE_ATTEMPTS the slide keeps a placeholder.
     */
    private function runImagesStep(TeacherAiLesson $lesson): ?int
    {
        $entries = $lesson->images ?? [];
        $todo = [];

        foreach ($lesson->imageSlots() as $index) {
            $entry = is_array($entries[(string) $index] ?? null) ? $entries[(string) $index] : null;

            if ($entry === null || ($entry['status'] ?? null) === TeacherAiLesson::IMAGE_READY || ! is_string($entry['prompt'] ?? null)) {
                continue;
            }

            if ((int) ($entry['attempts'] ?? 0) >= self::MAX_IMAGE_ATTEMPTS) {
                $entries[(string) $index] = ['status' => TeacherAiLesson::IMAGE_FAILED] + $entry;

                continue;
            }

            $todo[$index] = $entry;
        }

        if ($todo === [] || ! $this->images->isEnabled()) {
            $lesson->images = $entries;

            return $this->complete($lesson);
        }

        $batch = array_slice($todo, 0, $this->imageConcurrency(), true);
        $results = $this->images->generatePool(array_map(static fn (array $entry): array => [
            'prompt' => (string) $entry['prompt'],
            'orientation' => (string) ($entry['orientation'] ?? TeacherAiImageClient::ORIENTATION_PORTRAIT),
        ], $batch));

        $disk = Storage::disk(TeacherAiLesson::IMAGE_DISK);
        $throttled = false;

        foreach ($results as $index => $result) {
            $entry = $batch[$index];

            if (is_array($result)) {
                $file = $lesson->imageDirectory().'/s'.$index.'-'.substr(sha1($result['bytes']), 0, 10).'.jpg';
                $disk->put($file, $result['bytes']);

                if (is_string($entry['file'] ?? null) && $entry['file'] !== $file) {
                    $disk->delete($entry['file']);
                }

                $entries[(string) $index] = array_merge($entry, [
                    'status' => TeacherAiLesson::IMAGE_READY,
                    'file' => $file,
                    'model' => $result['model'],
                    'attempts' => (int) ($entry['attempts'] ?? 0) + 1,
                    'error' => null,
                ]);

                continue;
            }

            $rateLimited = $result->getCode() === TeacherAiImageClient::CODE_RATE_LIMITED
                && (int) ($entry['throttled'] ?? 0) < self::MAX_IMAGE_THROTTLES;
            $throttled = $throttled || $rateLimited;
            $attempts = (int) ($entry['attempts'] ?? 0) + ($rateLimited ? 0 : 1);

            $entries[(string) $index] = array_merge($entry, [
                'status' => $attempts >= self::MAX_IMAGE_ATTEMPTS ? TeacherAiLesson::IMAGE_FAILED : 'pending',
                'attempts' => $attempts,
                'throttled' => (int) ($entry['throttled'] ?? 0) + ($rateLimited ? 1 : 0),
                'error' => $result->getMessage(),
            ]);
        }

        $lesson->images = $entries;

        // Nothing left to draw: finish now instead of spending one more queue run on it.
        $remaining = array_filter(
            $lesson->imageSlots(),
            fn (int $index): bool => in_array($entries[(string) $index]['status'] ?? null, ['pending'], true),
        );

        if ($remaining === []) {
            return $this->complete($lesson);
        }

        $lesson->save();

        return $throttled ? self::RATE_LIMIT_DELAY : 0;
    }

    private function complete(TeacherAiLesson $lesson): ?int
    {
        $lesson->step = TeacherAiLesson::STEP_DONE;
        $lesson->status = TeacherAiLesson::STATUS_COMPLETED;
        $lesson->error_message = null;

        if ($lesson->completed_at === null) {
            $lesson->completed_at = now();
        }

        $lesson->save();

        return null;
    }

    /**
     * Accumulates token usage over all requests of the lesson.
     *
     * @param  array{model?: string|null, prompt_tokens?: int|null, completion_tokens?: int|null}  $usage
     */
    private function applyUsage(TeacherAiLesson $lesson, array $usage): void
    {
        $lesson->prompt_tokens = (int) ($lesson->prompt_tokens ?? 0) + (int) ($usage['prompt_tokens'] ?? 0);
        $lesson->completion_tokens = (int) ($lesson->completion_tokens ?? 0) + (int) ($usage['completion_tokens'] ?? 0);

        $model = $usage['model'] ?? null;

        if (is_string($model) && trim($model) !== '') {
            $lesson->model = mb_substr(trim($model), 0, 255);
        }
    }

    private function title(TeacherAiLesson $lesson): string
    {
        $title = $lesson->outline['title'] ?? null;

        return is_string($title) && trim($title) !== '' ? $title : (string) $lesson->topic;
    }

    private function publicStatus(TeacherAiLesson $lesson): string
    {
        return $lesson->isStale() ? TeacherAiLesson::STATUS_FAILED : (string) $lesson->status;
    }

    /**
     * Outline merged with the generated section texts. Null until the outline exists.
     *
     * @return array<string, mixed>|null
     */
    private function lecture(TeacherAiLesson $lesson): ?array
    {
        $outline = $lesson->outline;

        if (! is_array($outline)) {
            return null;
        }

        $generated = $lesson->sections ?? [];
        $sections = [];

        foreach ((array) ($outline['sections'] ?? []) as $index => $planned) {
            $planned = is_array($planned) ? $planned : [];
            $text = $generated[$index] ?? null;
            $text = is_array($text) ? $text : null;

            $sections[] = [
                'title' => (string) ($text['title'] ?? $planned['title'] ?? (LessonLocale::labels((string) $lesson->language)['section'].' '.($index + 1))),
                'key_points' => array_values((array) ($planned['key_points'] ?? [])),
                'paragraphs' => $text === null ? null : array_values((array) ($text['paragraphs'] ?? [])),
                'key_terms' => $text === null ? [] : array_values((array) ($text['key_terms'] ?? [])),
                'examples' => $text === null ? [] : array_values((array) ($text['examples'] ?? [])),
                'summary' => (string) ($text['summary'] ?? ''),
            ];
        }

        return [
            'title' => $this->title($lesson),
            'objectives' => array_values((array) ($outline['objectives'] ?? [])),
            'introduction' => (string) ($outline['introduction'] ?? ''),
            'sections' => $sections,
            'conclusion' => (string) ($outline['conclusion'] ?? ''),
            'self_check_questions' => array_values((array) ($outline['self_check_questions'] ?? [])),
            'glossary' => array_values((array) ($outline['glossary'] ?? [])),
            'references' => array_values((array) ($outline['references'] ?? [])),
            'keywords' => array_values((array) ($outline['keywords'] ?? [])),
        ];
    }

    /**
     * Version-2 deck for the preview: uniform slides plus image_url / image_status.
     *
     * @return array<string, mixed>|null
     */
    private function presentation(TeacherAiLesson $lesson): ?array
    {
        if (! $lesson->hasPresentation()) {
            return null;
        }

        $presentation = $lesson->presentation;
        $slides = [];

        foreach (array_values((array) $presentation['slides']) as $index => $slide) {
            $slide = LessonDeck::uniform(is_array($slide) ? $slide : []);

            if ($slide['layout'] === LessonDeck::LAYOUT_COVER) {
                $slide['cover'] = $this->coverWithFallbacks($lesson, $slide['cover']);
            }

            [$url, $status] = $this->imageState($lesson, $index, $slide);
            $slides[] = $slide + ['image_url' => $url, 'image_status' => $status];
        }

        return [
            'version' => LessonDeck::VERSION,
            'title' => (string) ($presentation['title'] ?? $this->title($lesson)),
            'subtitle' => (string) ($presentation['subtitle'] ?? ''),
            'slides' => $slides,
        ];
    }

    /**
     * The cover as the PPTX exporter draws it: missing values come from the
     * locale labels and the lesson, so the preview never shows a blank cover.
     *
     * @param  array<string, mixed>|null  $cover
     * @return array<string, string>
     */
    private function coverWithFallbacks(TeacherAiLesson $lesson, ?array $cover): array
    {
        $labels = LessonLocale::labels((string) $lesson->language);
        $cover = is_array($cover) ? $cover : [];
        $value = static fn (string $key): string => trim((string) ($cover[$key] ?? ''));
        $city = trim((string) config('services.teacher_ai.lesson_city')) ?: $labels['city'];

        return [
            'university' => $value('university') ?: $labels['university'],
            'faculty' => array_key_exists('faculty', $cover) ? $value('faculty') : trim((string) $lesson->faculty_name),
            'department' => array_key_exists('department', $cover) ? $value('department') : trim((string) $lesson->department_name),
            'course_label' => $value('course_label') ?: $labels['course_label'],
            'course' => $value('course') ?: trim((string) $lesson->subject),
            'city_year' => $value('city_year') ?: $city.', '.($lesson->created_at ?? now())->format('Y'),
        ];
    }

    /**
     * @param  array<string, mixed>  $slide
     * @return array{0: string|null, 1: string} image URL and one of ready|pending|failed|none
     */
    private function imageState(TeacherAiLesson $lesson, int $index, array $slide): array
    {
        if (! $slide['image']) {
            return [null, 'none'];
        }

        $entry = $lesson->imageEntry($index);
        $status = $entry['status'] ?? null;

        if ($status === TeacherAiLesson::IMAGE_READY && $lesson->imagePath($index) !== null) {
            // The file name changes with the content, so the URL can be cached for long.
            $version = substr(sha1((string) $entry['file']), 0, 10);

            return [route('teacher-ai.lessons.image', ['lesson' => $lesson, 'slide' => $index, 'v' => $version], false), 'ready'];
        }

        if ($entry === null) {
            return [null, 'none'];
        }

        if ($status === TeacherAiLesson::IMAGE_FAILED) {
            return [null, 'failed'];
        }

        return [null, $lesson->isInProgress() && ! $lesson->isStale() ? 'pending' : 'failed'];
    }

    /**
     * Words in the lecture body (introduction, section paragraphs, conclusion).
     * str_word_count() is ASCII-only, so split on whitespace instead.
     *
     * @param  array<string, mixed>  $lecture
     */
    private function wordCount(array $lecture): int
    {
        $texts = [(string) $lecture['introduction'], (string) $lecture['conclusion']];

        foreach ($lecture['sections'] as $section) {
            foreach ((array) ($section['paragraphs'] ?? []) as $paragraph) {
                $texts[] = (string) $paragraph;
            }
        }

        $count = 0;

        foreach ($texts as $text) {
            $words = preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY);
            $count += is_array($words) ? count($words) : 0;
        }

        return $count;
    }
}
