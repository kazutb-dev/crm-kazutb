<?php

namespace App\Services\TeacherAi;

use App\Models\TeacherAiLesson;
use App\Services\TeacherAi\Concerns\GeneratesLessonText;

/**
 * Domain service of the presentation step: plans a deck in the KazUTB
 * template style, asks the model for its parts in parallel, normalizes every
 * slide into the version-2 contract (LessonDeck) and assembles the deck with
 * a cover slide and image slots.
 *
 * A deck is generated in parts — the opening (title + overview slides), one
 * part per lecture section and the closing slide — so that each request stays
 * small and fast and a failed part can be repeated on its own. Each part gets
 * suggested layouts from LessonDeck::ROTATION, which keeps the deck varied
 * like the template: pictures, timelines, cards, diagrams and text alternate.
 *
 * Pure with respect to persistence: the lesson passed in is never written to.
 */
final class LessonDeckGenerator
{
    use GeneratesLessonText;

    public const TASK_OPENING = 'presentation_opening';

    public const TASK_SECTION = 'presentation_section';

    public const TASK_CLOSING = 'presentation_closing';

    public const PART_OPENING = 'opening';

    public const PART_CLOSING = 'closing';

    public const MIN_SLIDES = 8;

    public const MAX_SLIDES = 30;

    public const DEFAULT_SLIDES = 15;

    /**
     * Slides outside the section parts: cover, lecture title, overview, conclusion.
     */
    private const FIXED_SLIDES = 4;

    private const OPENING_OPTIONS = ['temperature' => 0.4, 'max_tokens' => 2200];

    private const CLOSING_OPTIONS = ['temperature' => 0.4, 'max_tokens' => 1600];

    private const SECTION_TEMPERATURE = 0.5;

    /**
     * Wall-clock budget (seconds) for one generateParts() call; the queue job is
     * killed at 110 s, so sequential retries must fit into what the pool left.
     */
    private const TIME_BUDGET = 100;

    private const MIN_RETRY_TIMEOUT = 15;

    /**
     * Appended to every image prompt so that all illustrations of a deck share
     * the template's look (glowing indigo/violet renders) and carry no text.
     */
    public const IMAGE_STYLE = ' Photorealistic, highly detailed image (a clean 3D render for technical subjects) with cool indigo, violet and blue lighting, modern minimal composition, soft depth of field, suitable as an illustration in a university lecture presentation. No text, no letters, no numbers, no captions, no logos, no watermarks.';

    /**
     * What each layout needs; sent to the model with the section parts.
     *
     * @var array<string, string>
     */
    private const LAYOUT_GUIDE = [
        LessonDeck::LAYOUT_TEXT_BULLETS => 'title; paragraphs — 2–3 абзаца по 200–300 символов; side_title — подзаголовок списка (до 40 символов); bullets — 4–6 коротких пунктов до 60 символов.',
        LessonDeck::LAYOUT_TIMELINE => 'title; items — 3–6 этапов по порядку: title до 30 символов (этап, версия, период), text до 100 символов; footer — вывод до 250 символов. Только для последовательности: эволюция, история, этапы процесса.',
        LessonDeck::LAYOUT_BANNER_COLUMNS => 'title; columns — ровно 2 колонки: title до 40 символов, text 150–260 символов, bullets 0–3 пункта до 60 символов; image_prompt.',
        LessonDeck::LAYOUT_CARDS => 'title; items — 2–6 карточек: title до 40 символов, text до 120 символов (свойства, виды, преимущества и недостатки); footer — необязательный вывод до 200 символов.',
        LessonDeck::LAYOUT_IMAGE_TEXT => 'title; paragraphs — 2–3 абзаца по 150–260 символов ИЛИ columns — 2 блока (title до 40 символов, text до 260 символов); image_prompt.',
        LessonDeck::LAYOUT_CHART => 'title; text — что показывает диаграмма (до 260 символов); categories — 3–5 КРИТЕРИЕВ сравнения (скорость, стоимость, надёжность…; до 28 символов); series — 2 ряда, каждый ряд — один сравниваемый объект (технология, метод, вариант): name «<объект> — {relative}», values — оценка 0–100 по каждому критерию; unit оставь пустым. Только качественное сравнение технологий или методов по критериям. ЗАПРЕЩЕНО: страны, годы, исторические события, статистика и проценты — в таком случае используй cards.',
        LessonDeck::LAYOUT_PYRAMID => 'title; items — ровно 3 уровня реальной иерархии от вершины к основанию (уровни, от частного к общему или от быстрого к медленному): title до 24 символов, text до 60 символов, detail — пояснение до 160 символов. Если в разделе нет иерархии — используй cards.',
        LessonDeck::LAYOUT_STATS => 'title; items — 2 понятия (title до 30 символов, text до 110 символов); stats — ровно 3 показателя: value до 10 символов (число, %, ×, диапазон), label до 30 символов, text до 90 символов. Только общеизвестные цифры или цифры из текста раздела.',
        LessonDeck::LAYOUT_STEPS => 'title; items — 4 пункта (допустимо 2–6): title до 40 символов, text до 130 символов (шаги, этапы алгоритма, области применения); footer — вывод до 220 символов.',
        LessonDeck::LAYOUT_HIERARCHY => 'title; items — 3–6 уровней сверху вниз: title до 30 символов, text до 100 символов; footer — принцип иерархии до 220 символов.',
    ];

    public function __construct(private readonly TeacherAiChatClient $client) {}

    /**
     * Deterministic plan of the deck, in deck order. A list (not a map keyed
     * by part): the plan is stored as JSON and MySQL reorders object keys.
     *
     * @return list<array{key: string, type: string, section: int|null, count: int, layouts: list<string>}>
     */
    public function plan(TeacherAiLesson $lesson, bool $imagesEnabled, int $maxImages): array
    {
        $sections = $this->plannedSections($lesson);
        $content = max(0, $this->slidesCount($lesson) - self::FIXED_SLIDES);
        $counts = $this->distribute($content, count($sections));

        $imagesUsed = $imagesEnabled ? 1 : 0; // the lecture title slide always has an image slot
        $chartUsed = false;
        $rotation = 0;

        $plan = [
            [
                'key' => self::PART_OPENING,
                'type' => self::PART_OPENING,
                'section' => null,
                'count' => 2,
                'layouts' => [LessonDeck::LAYOUT_LECTURE_TITLE, LessonDeck::LAYOUT_TEXT_BULLETS],
            ],
        ];

        foreach ($counts as $index => $count) {
            if ($count === 0) {
                continue;
            }

            $layouts = [];

            for ($slide = 0; $slide < $count; $slide++) {
                $layout = LessonDeck::ROTATION[$rotation % count(LessonDeck::ROTATION)];
                $rotation++;

                if (LessonDeck::hasImageSlot($layout)) {
                    if (! $imagesEnabled || $imagesUsed >= $maxImages) {
                        $layout = $layout === LessonDeck::LAYOUT_IMAGE_TEXT ? LessonDeck::LAYOUT_TEXT_BULLETS : LessonDeck::LAYOUT_CARDS;
                    } else {
                        $imagesUsed++;
                    }
                }

                if ($layout === LessonDeck::LAYOUT_CHART) {
                    if ($chartUsed) {
                        $layout = LessonDeck::LAYOUT_CARDS;
                    }

                    $chartUsed = true;
                }

                $layouts[] = $layout;
            }

            $plan[] = [
                'key' => 'section:'.$index,
                'type' => 'section',
                'section' => $index,
                'count' => $count,
                'layouts' => $layouts,
            ];
        }

        $plan[] = [
            'key' => self::PART_CLOSING,
            'type' => self::PART_CLOSING,
            'section' => null,
            'count' => 1,
            'layouts' => [LessonDeck::LAYOUT_CONCLUSION],
        ];

        return $plan;
    }

    /**
     * Requests the given parts concurrently; a failed part is retried once
     * sequentially within the time budget, the rest is reported as failures.
     *
     * @param  list<array{key: string, type: string, section: int|null, count: int, layouts: list<string>}>  $plan
     * @param  list<string>  $keys
     * @return array{parts: array<string, list<array{slide: array<string, mixed>, image_prompt: string}>>, extras: array<string, mixed>, failures: array<string, string>, usage: array{model: string, prompt_tokens: int|null, completion_tokens: int|null}}
     */
    public function generateParts(TeacherAiLesson $lesson, array $plan, array $keys, bool $imagesEnabled): array
    {
        $plan = array_column($plan, null, 'key');

        if ($this->plannedSections($lesson) === []) {
            throw new TeacherAiException('Сначала нужно сгенерировать план лекции. Попробуйте ещё раз.');
        }

        $systemPrompt = $this->deckSystemPrompt($lesson);
        $requests = [];

        foreach ($keys as $key) {
            if (! isset($plan[$key])) {
                continue;
            }

            $requests[$key] = [
                'system' => $systemPrompt,
                'user' => $this->encode($this->partRequest($lesson, $plan[$key])),
                'options' => $this->partOptions($plan[$key]),
            ];
        }

        $empty = ['parts' => [], 'extras' => [], 'failures' => [], 'usage' => $this->mergeUsage([])];

        if ($requests === []) {
            return $empty;
        }

        $startedAt = microtime(true);
        $pooled = $this->client->completeJsonPool($requests);

        $parts = [];
        $extras = [];
        $failures = [];
        $usages = [];

        foreach ($requests as $key => $request) {
            $result = $pooled[$key] ?? new TeacherAiException('ИИ вернул ответ в неожиданном формате. Попробуйте ещё раз.');

            if (is_array($result)) {
                $usages[] = $this->usageOf($result);

                try {
                    [$parts[$key], $partExtras] = $this->normalizePart($result['data'], $plan[$key], $lesson, $imagesEnabled);
                    $extras += $partExtras;

                    continue;
                } catch (TeacherAiException $e) {
                    $this->logRejectedAnswer('presentation '.$key, $result['data'], $e);
                    $result = $e;
                }
            }

            $remaining = (int) floor(self::TIME_BUDGET - (microtime(true) - $startedAt));

            if ($remaining < self::MIN_RETRY_TIMEOUT) {
                $failures[$key] = $result->getMessage();

                continue;
            }

            try {
                $retried = $this->client->completeJson(
                    $request['system'],
                    $request['user'].$this->client->retryHintFor($result),
                    $request['options'] + ['retry' => false, 'timeout' => $remaining],
                );
                $usages[] = $this->usageOf($retried);
                [$parts[$key], $partExtras] = $this->normalizePart($retried['data'], $plan[$key], $lesson, $imagesEnabled);
                $extras += $partExtras;
            } catch (TeacherAiException $e) {
                unset($parts[$key]);
                $failures[$key] = $e->getMessage();
            }
        }

        return [
            'parts' => $parts,
            'extras' => $extras,
            'failures' => $failures,
            'usage' => $this->mergeUsage($usages),
        ];
    }

    /**
     * Builds the final version-2 deck: cover, then the parts in plan order.
     * Enforces the image budget and a single chart, alternates the image side
     * and returns the pending image jobs for the slots.
     *
     * @param  list<array{key: string, type: string, section: int|null, count: int, layouts: list<string>}>  $plan
     * @param  array<string, list<array{slide: array<string, mixed>, image_prompt: string}>>  $parts
     * @param  array<string, mixed>  $extras
     * @return array{presentation: array<string, mixed>, images: array<string, array<string, mixed>>}
     */
    public function assemble(TeacherAiLesson $lesson, array $plan, array $parts, array $extras, bool $imagesEnabled, int $maxImages): array
    {
        $code = (string) $lesson->language;
        $labels = LessonLocale::labels($code);
        $title = $this->cleanLine($lesson->outline['title'] ?? null, 200) ?: $this->fallbackTitle($lesson);
        $subtitle = $this->cleanLine($extras['subtitle'] ?? null, 220);

        $slides = [$this->coverSlide($lesson, $extras, $labels)];
        $prompts = [0 => ''];

        foreach (array_column($plan, 'key') as $key) {
            foreach ($parts[$key] ?? [] as $entry) {
                $slides[] = $entry['slide'];
                $prompts[count($slides) - 1] = $entry['image_prompt'];
            }
        }

        $imagesUsed = 0;
        $chartUsed = false;
        $imageTextCount = 0;
        $images = [];

        foreach ($slides as $index => &$slide) {
            if ($slide['layout'] === LessonDeck::LAYOUT_LECTURE_TITLE) {
                $slide['title'] = LessonLocale::lectureTitle($code, $lesson->lecture_number, $title);
                $slide['subtitle'] = $slide['subtitle'] !== '' ? $slide['subtitle'] : $subtitle;
            }

            if ($slide['layout'] === LessonDeck::LAYOUT_CHART) {
                if ($chartUsed) {
                    $slide = $this->chartToCards($slide);
                }

                $chartUsed = true;
            }

            if ($slide['image'] && $slide['layout'] !== LessonDeck::LAYOUT_LECTURE_TITLE
                && (! $imagesEnabled || $imagesUsed >= $maxImages)) {
                $slide = $this->withoutImage($slide);
            }

            if ($slide['layout'] === LessonDeck::LAYOUT_IMAGE_TEXT) {
                $slide['image_side'] = $imageTextCount % 2 === 0 ? 'right' : 'left';
                $imageTextCount++;
            }

            if ($slide['image']) {
                $imagesUsed++;

                if ($imagesEnabled) {
                    $images[(string) $index] = [
                        'status' => 'pending',
                        'prompt' => $this->imagePrompt($prompts[$index] ?? '', $slide, $lesson),
                        'orientation' => $slide['layout'] === LessonDeck::LAYOUT_BANNER_COLUMNS
                            ? TeacherAiImageClient::ORIENTATION_LANDSCAPE
                            : TeacherAiImageClient::ORIENTATION_PORTRAIT,
                        'attempts' => 0,
                    ];
                }
            }
        }
        unset($slide);

        return [
            'presentation' => [
                'version' => LessonDeck::VERSION,
                'title' => $title,
                'subtitle' => $subtitle,
                'slides' => $slides,
            ],
            'images' => $images,
        ];
    }

    /**
     * Normalizes one model slide into the uniform version-2 shape, converting
     * it to a simpler layout when the content does not fit the chosen one.
     * Returns null when nothing usable is left.
     *
     * @param  array<string, mixed>  $raw
     * @return array{slide: array<string, mixed>, image_prompt: string}|null
     */
    public function normalizeSlide(array $raw, string $suggested, bool $imagesEnabled): ?array
    {
        $layout = strtolower($this->cleanLine($raw['layout'] ?? $raw['type'] ?? null, 30));
        $allowed = [...LessonDeck::CONTENT_LAYOUTS, LessonDeck::LAYOUT_LECTURE_TITLE, LessonDeck::LAYOUT_CONCLUSION];

        if (! in_array($layout, $allowed, true)) {
            $layout = $suggested;
        }

        // The opening and closing slides keep their role whatever the model wrote.
        if (in_array($suggested, [LessonDeck::LAYOUT_LECTURE_TITLE, LessonDeck::LAYOUT_CONCLUSION], true)) {
            $layout = $suggested;
        }

        $slide = LessonDeck::emptySlide($layout);
        $slide['title'] = $this->cleanLine($raw['title'] ?? $raw['heading'] ?? null, 120);
        $slide['subtitle'] = $this->cleanLine($raw['subtitle'] ?? null, 220);
        $slide['paragraphs'] = $this->cleanParagraphs($raw['paragraphs'] ?? null, 4, 420);
        $slide['side_title'] = $this->cleanLine($raw['side_title'] ?? null, 70);
        $slide['bullets'] = $this->cleanItems($raw['bullets'] ?? null, 8, 140);
        $slide['items'] = $this->cleanEntries($raw['items'] ?? null, 6);
        $slide['columns'] = $this->cleanColumns($raw['columns'] ?? null);
        $slide['stats'] = $this->cleanStats($raw['stats'] ?? null);
        $slide['categories'] = $this->cleanItems($raw['categories'] ?? null, 6, 40);
        $slide['series'] = $this->cleanSeries($raw['series'] ?? null, count($slide['categories']));
        $slide['unit'] = $this->cleanLine($raw['unit'] ?? null, 20);
        $slide['text'] = $this->cleanText($raw['text'] ?? null, 420);
        $slide['footer'] = $this->cleanLine($raw['footer'] ?? null, 340);
        $slide['notes'] = $this->cleanText($raw['notes'] ?? $raw['speaker_notes'] ?? null, 1500);
        $imagePrompt = $this->cleanLine($raw['image_prompt'] ?? null, 500);

        // A text slide whose body came as one "text" string.
        if ($slide['paragraphs'] === [] && $slide['text'] !== ''
            && in_array($layout, [LessonDeck::LAYOUT_TEXT_BULLETS, LessonDeck::LAYOUT_IMAGE_TEXT], true)) {
            $slide['paragraphs'] = $this->cleanParagraphs($slide['text'], 4, 420);
        }

        $slide = $this->fitLayout($slide, $imagesEnabled);

        if ($slide === null) {
            return null;
        }

        if ($layout !== LessonDeck::LAYOUT_CHART && $slide['layout'] !== LessonDeck::LAYOUT_CHART) {
            $slide['text'] = '';
        }

        return ['slide' => $slide, 'image_prompt' => $slide['image'] ? $imagePrompt : ''];
    }

    // ----------------------------------------------------------------------
    // Planning
    // ----------------------------------------------------------------------

    /**
     * Spreads the content slides over the sections, earlier sections first.
     *
     * @return list<int>
     */
    private function distribute(int $content, int $sections): array
    {
        if ($sections === 0) {
            return [];
        }

        $base = intdiv($content, $sections);
        $extra = $content % $sections;
        $counts = [];

        for ($index = 0; $index < $sections; $index++) {
            $counts[] = $base + ($index < $extra ? 1 : 0);
        }

        return $counts;
    }

    private function slidesCount(TeacherAiLesson $lesson): int
    {
        $count = (int) $lesson->slides_count;

        return $count > 0 ? self::clamp($count, self::MIN_SLIDES, self::MAX_SLIDES) : self::DEFAULT_SLIDES;
    }

    /**
     * @param  array{type: string, section: int|null, count: int, layouts: list<string>}  $part
     * @return array{temperature: float, max_tokens: int}
     */
    private function partOptions(array $part): array
    {
        return match ($part['type']) {
            self::PART_OPENING => self::OPENING_OPTIONS,
            self::PART_CLOSING => self::CLOSING_OPTIONS,
            default => [
                'temperature' => self::SECTION_TEMPERATURE,
                'max_tokens' => min(6000, 900 + 750 * $part['count']),
            ],
        };
    }

    // ----------------------------------------------------------------------
    // Prompts
    // ----------------------------------------------------------------------

    private function deckSystemPrompt(TeacherAiLesson $lesson): string
    {
        return $this->systemPrompt($lesson).' '.implode(' ', [
            'Сейчас ты готовишь слайды учебной презентации в фирменном стиле университета: короткие точные заголовки, сжатые тезисы, разнообразные макеты.',
            'Тексты на слайдах — законченные фразы без markdown, без нумерации в начале пунктов.',
            'Поле image_prompt пиши на английском языке; все остальные тексты — на языке материалов.',
        ]);
    }

    /**
     * @param  array{type: string, section: int|null, count: int, layouts: list<string>}  $part
     * @return array<string, mixed>
     */
    private function partRequest(TeacherAiLesson $lesson, array $part): array
    {
        return match ($part['type']) {
            self::PART_OPENING => $this->openingRequest($lesson),
            self::PART_CLOSING => $this->closingRequest($lesson),
            default => $this->sectionRequest($lesson, (int) $part['section'], $part['count'], $part['layouts']),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function openingRequest(TeacherAiLesson $lesson): array
    {
        $outline = $lesson->outline ?? [];
        $labels = LessonLocale::labels((string) $lesson->language);
        $faculty = $this->cleanLine($lesson->faculty_name, 255);
        $department = $this->cleanLine($lesson->department_name, 255);

        // Cover lines are only formatted from what the teacher gave; with nothing
        // given the model would copy the example names from the instruction.
        $coverTask = $faculty === '' && $department === ''
            ? 'cover — оставь обе строки пустыми.'
            : 'cover.faculty и cover.department — строки титульного слайда на языке материалов по данным cover_source. Если название уже на языке материалов, оставь его как есть; иначе переведи точно. Оформление: казахский — «<название>» факультеті, «<название>» кафедрасы; русский — Факультет <название>, Кафедра «<название>»; английский — Faculty of <name>, Department of <name>. Пустое значение в cover_source — пустая строка. Не придумывай названия, которых нет в cover_source.';

        return [
            'task_type' => self::TASK_OPENING,
            'input' => $this->inputBlock($lesson),
            'lecture' => [
                'title' => $this->cleanLine($outline['title'] ?? null, 200),
                'objectives' => $this->cleanItems($outline['objectives'] ?? null, 8, 300),
                'introduction' => $this->cleanText($outline['introduction'] ?? null, 1800),
                'plan' => array_map(fn (array $section): string => $this->cleanLine($section['title'] ?? null, 200), $this->plannedSections($lesson)),
            ],
            'cover_source' => [
                'faculty' => $faculty,
                'department' => $department,
            ],
            'task' => [
                $coverTask,
                'subtitle — подзаголовок лекции: одно предложение до 140 символов о том, что изучается.',
                'slides — ровно 2 слайда.',
                'Слайд 1, layout "lecture_title": subtitle (тот же подзаголовок) и image_prompt — иллюстрация к теме всей лекции.',
                'Слайд 2, layout "text_bullets": вводный слайд с определением и значением главного понятия темы. title — главное понятие и его роль через тире, до 80 символов (например: «Жедел жады (RAM) – компьютер жүйесінің негізгі жұмыс аймағы», «Инфляция – устойчивый рост общего уровня цен»); paragraphs — 2–3 абзаца по 200–300 символов; side_title — «'.$labels['overview_side_title'].'»; bullets — 4–6 ключевых характеристик до 60 символов.',
                'image_prompt — на английском, 1–2 предложения: конкретный объект, оборудование, процесс или наглядная метафора по теме (например: "Close-up of DDR5 memory modules installed on a motherboard"). Без текста и надписей, без реальных известных людей. Стиль не указывай.',
                'notes — заметки докладчика к каждому слайду: 2–4 предложения.',
            ],
            'response_format' => [
                'cover' => ['faculty' => '', 'department' => ''],
                'subtitle' => '',
                'slides' => [
                    ['layout' => LessonDeck::LAYOUT_LECTURE_TITLE, 'subtitle' => '', 'image_prompt' => '', 'notes' => ''],
                    ['layout' => LessonDeck::LAYOUT_TEXT_BULLETS, 'title' => '', 'paragraphs' => [''], 'side_title' => '', 'bullets' => [''], 'notes' => ''],
                ],
            ],
        ];
    }

    /**
     * @param  list<string>  $layouts
     * @return array<string, mixed>
     */
    private function sectionRequest(TeacherAiLesson $lesson, int $index, int $count, array $layouts): array
    {
        $planned = $this->plannedSections($lesson)[$index] ?? [];
        $generated = $lesson->sections[$index] ?? null;
        $generated = is_array($generated) ? $generated : [];

        $text = $this->cleanText(implode("\n\n", array_map('strval', (array) ($generated['paragraphs'] ?? []))), 2800);
        $example = $this->cleanText(((array) ($generated['examples'] ?? []))[0] ?? null, 700);

        $guide = [];

        $relative = LessonLocale::labels((string) $lesson->language)['relative_value'];

        foreach (array_unique([...$layouts, LessonDeck::LAYOUT_CARDS, LessonDeck::LAYOUT_TEXT_BULLETS]) as $layout) {
            if (isset(self::LAYOUT_GUIDE[$layout])) {
                $guide[$layout] = str_replace('{relative}', $relative, self::LAYOUT_GUIDE[$layout]);
            }
        }

        return [
            'task_type' => self::TASK_SECTION,
            'input' => $this->inputBlock($lesson),
            'lecture_title' => $this->cleanLine($lesson->outline['title'] ?? null, 200),
            'section' => [
                'number' => $index + 1,
                'title' => $this->cleanLine($generated['title'] ?? $planned['title'] ?? null, 200),
                'key_points' => $this->cleanItems($planned['key_points'] ?? null, 8, 300),
                'summary' => $this->cleanText($generated['summary'] ?? null, 600),
                'text' => $text !== '' ? $text : null,
                'example' => $example !== '' ? $example : null,
            ],
            'slides_count' => $count,
            'layouts' => $layouts,
            'layout_guide' => $guide,
            'task' => [
                "Подготовь ровно {$count} слайд(а/ов) по разделу section лекции lecture_title, опираясь на section.text и section.key_points.",
                'Используй макеты из layouts в указанном порядке: слайд N — layouts[N-1]. Для каждого слайда в response_format уже дан шаблон с нужными полями — заполни именно его, не добавляй поля из других макетов. Если содержание явно не подходит под макет (нет последовательности для timeline, нет сравнения для chart, нет цифр для stats, нет иерархии для pyramid), замени его на cards с полями title, items, footer.',
                'Требования к полям каждого макета — в layout_guide.',
                'Каждый слайд раскрывает отдельный аспект раздела, без повторов. Заголовки конкретные, до 80 символов, как в учебной презентации.',
                'image_prompt — только для image_text и banner_columns: на английском, 1–2 предложения, конкретный объект или сцена по теме слайда, без текста и надписей, без реальных известных людей. Стиль не указывай.',
                'notes — заметки докладчика: 2–4 предложения о том, что сказать на этом слайде.',
            ],
            'response_format' => [
                'slides' => array_map(fn (string $layout): array => $this->skeleton($layout), $layouts),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function closingRequest(TeacherAiLesson $lesson): array
    {
        $outline = $lesson->outline ?? [];
        $sections = [];

        foreach ($this->plannedSections($lesson) as $index => $planned) {
            $generated = $lesson->sections[$index] ?? null;
            $sections[] = [
                'title' => $this->cleanLine(is_array($generated) ? ($generated['title'] ?? $planned['title'] ?? null) : ($planned['title'] ?? null), 200),
                'summary' => $this->cleanText(is_array($generated) ? ($generated['summary'] ?? null) : null, 600),
            ];
        }

        return [
            'task_type' => self::TASK_CLOSING,
            'input' => $this->inputBlock($lesson),
            'lecture' => [
                'title' => $this->cleanLine($outline['title'] ?? null, 200),
                'sections' => $sections,
                'conclusion' => $this->cleanText($outline['conclusion'] ?? null, 1500),
                'keywords' => $this->cleanItems($outline['keywords'] ?? null, 12, 60),
            ],
            'task' => [
                'slides — ровно 1 слайд, layout "conclusion": итоговые выводы лекции.',
                'title — «Қорытынды: …» / «Заключение: …» / «Conclusion: …» на языке материалов, до 80 символов.',
                'items — 4–6 ключевых выводов (по разделам или главным идеям): title до 40 символов, text до 150 символов.',
                'footer — общий вывод в 1–2 предложениях, до 260 символов.',
                'notes — заметки докладчика: 2–4 предложения.',
            ],
            'response_format' => [
                'slides' => [[
                    'layout' => LessonDeck::LAYOUT_CONCLUSION,
                    'title' => '',
                    'items' => [['title' => '', 'text' => '']],
                    'footer' => '',
                    'notes' => '',
                ]],
            ],
        ];
    }

    // ----------------------------------------------------------------------
    // Normalization
    // ----------------------------------------------------------------------

    /**
     * @param  array<string, mixed>  $payload
     * @param  array{type: string, section: int|null, count: int, layouts: list<string>}  $part
     * @return array{0: list<array{slide: array<string, mixed>, image_prompt: string}>, 1: array<string, mixed>}
     *
     * @throws TeacherAiException when the part has no usable slide
     */
    private function normalizePart(array $payload, array $part, TeacherAiLesson $lesson, bool $imagesEnabled): array
    {
        $entries = [];

        foreach (array_values($this->listOf($payload['slides'] ?? null)) as $position => $raw) {
            if (! is_array($raw) || count($entries) === $part['count']) {
                continue;
            }

            $suggested = $part['layouts'][$position] ?? end($part['layouts']);
            $entry = $this->normalizeSlide($raw, $suggested, $imagesEnabled);

            if ($entry === null) {
                continue;
            }

            if ($entry['slide']['title'] === '' && $entry['slide']['layout'] !== LessonDeck::LAYOUT_LECTURE_TITLE) {
                $entry['slide']['title'] = $this->partFallbackTitle($part, $lesson);
            }

            $entries[] = $entry;
        }

        if ($part['type'] === self::PART_OPENING) {
            $entries = $this->ensureLectureTitle($entries);
        }

        if ($entries === []) {
            throw new TeacherAiException('ИИ вернул неполный набор слайдов. Попробуйте ещё раз.');
        }

        $extras = [];

        if ($part['type'] === self::PART_OPENING) {
            $cover = is_array($payload['cover'] ?? null) ? $payload['cover'] : [];
            $extras = [
                'cover' => [
                    'faculty' => $this->cleanLine($cover['faculty'] ?? null, 255),
                    'department' => $this->cleanLine($cover['department'] ?? null, 255),
                ],
                'subtitle' => $this->cleanLine($payload['subtitle'] ?? null, 220),
            ];
        }

        return [$entries, $extras];
    }

    /**
     * The opening part must start with the lecture title slide even when the
     * model returned only the overview.
     *
     * @param  list<array{slide: array<string, mixed>, image_prompt: string}>  $entries
     * @return list<array{slide: array<string, mixed>, image_prompt: string}>
     */
    private function ensureLectureTitle(array $entries): array
    {
        foreach ($entries as $entry) {
            if ($entry['slide']['layout'] === LessonDeck::LAYOUT_LECTURE_TITLE) {
                return $entries;
            }
        }

        $title = LessonDeck::emptySlide(LessonDeck::LAYOUT_LECTURE_TITLE);
        $title['image'] = true;

        return [['slide' => $title, 'image_prompt' => ''], ...$entries];
    }

    /**
     * Checks the counts each layout needs and degrades to a simpler layout
     * when the content does not fit; null when nothing usable is left.
     *
     * @param  array<string, mixed>  $slide
     * @return array<string, mixed>|null
     */
    private function fitLayout(array $slide, bool $imagesEnabled): ?array
    {
        $items = count($slide['items']);

        $slide = match ($slide['layout']) {
            LessonDeck::LAYOUT_LECTURE_TITLE => $slide,
            LessonDeck::LAYOUT_TEXT_BULLETS => $slide['paragraphs'] !== [] || $slide['bullets'] !== [] ? $slide : $this->toCards($slide),
            LessonDeck::LAYOUT_TIMELINE => $items >= 3 ? $slide : $this->toCards($slide),
            LessonDeck::LAYOUT_BANNER_COLUMNS => count($this->repairColumns($slide)['columns']) === 2
                ? $this->repairColumns($slide)
                : $this->columnsToText($slide),
            LessonDeck::LAYOUT_CARDS => $items >= 2 ? $slide : $this->toText($slide),
            LessonDeck::LAYOUT_IMAGE_TEXT => $slide['paragraphs'] !== [] || $slide['bullets'] !== [] || count($slide['columns']) === 2
                ? $slide
                : $this->toText($slide),
            LessonDeck::LAYOUT_CHART => $this->validChart($slide) ? $slide : $this->chartToCards($slide),
            LessonDeck::LAYOUT_PYRAMID => match (true) {
                $items >= 3 && $items <= 4 => $slide,
                $items > 4 => ['layout' => LessonDeck::LAYOUT_HIERARCHY] + $slide,
                default => $this->toCards($slide),
            },
            LessonDeck::LAYOUT_STATS => count($slide['stats']) >= 2 ? $slide : $this->toCards($slide),
            LessonDeck::LAYOUT_STEPS => $items >= 2 ? $slide : $this->toText($slide),
            LessonDeck::LAYOUT_HIERARCHY => $items >= 3 ? $slide : $this->toCards($slide),
            LessonDeck::LAYOUT_CONCLUSION => $items >= 2 ? $slide : $this->toText($slide),
            default => $slide,
        };

        if ($slide === null) {
            return null;
        }

        // Per-layout caps (the renderers lay out at most this many elements).
        $slide['items'] = array_slice($slide['items'], 0, match ($slide['layout']) {
            LessonDeck::LAYOUT_PYRAMID => 4,
            LessonDeck::LAYOUT_STATS => 2,
            default => 6,
        });
        $slide['stats'] = array_slice($slide['stats'], 0, 3);
        $slide['columns'] = array_slice($slide['columns'], 0, 2);

        if ($slide['layout'] === LessonDeck::LAYOUT_TEXT_BULLETS && $slide['paragraphs'] === [] && $slide['bullets'] === []) {
            return null;
        }

        $slide['image'] = LessonDeck::hasImageSlot($slide['layout'])
            && ($slide['layout'] === LessonDeck::LAYOUT_LECTURE_TITLE || $imagesEnabled);

        if ($slide['layout'] === LessonDeck::LAYOUT_IMAGE_TEXT && ! $slide['image']) {
            $slide = $this->withoutImage($slide);
        }

        return $slide;
    }

    /**
     * The answer template of one slide: only the fields its layout uses, so
     * that the model fills the planned layout instead of a mix of fields.
     *
     * @return array<string, mixed>
     */
    private function skeleton(string $layout): array
    {
        $item = ['title' => '', 'text' => ''];

        $fields = match ($layout) {
            LessonDeck::LAYOUT_TEXT_BULLETS => ['title' => '', 'paragraphs' => ['', ''], 'side_title' => '', 'bullets' => ['', '', '', '']],
            LessonDeck::LAYOUT_TIMELINE => ['title' => '', 'items' => [$item, $item, $item, $item], 'footer' => ''],
            LessonDeck::LAYOUT_BANNER_COLUMNS => [
                'title' => '',
                'columns' => [['title' => '', 'text' => '', 'bullets' => ['']], ['title' => '', 'text' => '', 'bullets' => ['']]],
                'image_prompt' => '',
            ],
            LessonDeck::LAYOUT_IMAGE_TEXT => ['title' => '', 'paragraphs' => ['', ''], 'image_prompt' => ''],
            LessonDeck::LAYOUT_CHART => [
                'title' => '',
                'text' => '',
                'categories' => ['', '', ''],
                'series' => [['name' => '', 'values' => [0, 0, 0]], ['name' => '', 'values' => [0, 0, 0]]],
                'unit' => '',
            ],
            LessonDeck::LAYOUT_PYRAMID => ['title' => '', 'items' => array_fill(0, 3, ['title' => '', 'text' => '', 'detail' => ''])],
            LessonDeck::LAYOUT_STATS => [
                'title' => '',
                'items' => [$item, $item],
                'stats' => array_fill(0, 3, ['value' => '', 'label' => '', 'text' => '']),
            ],
            LessonDeck::LAYOUT_STEPS, LessonDeck::LAYOUT_HIERARCHY => ['title' => '', 'items' => [$item, $item, $item, $item], 'footer' => ''],
            default => ['title' => '', 'items' => [$item, $item, $item, $item], 'footer' => ''],
        };

        return ['layout' => $layout] + $fields + ['notes' => ''];
    }

    /**
     * Models often put the first column of a two-column slide into
     * side_title/paragraphs/bullets and only the second into columns; that
     * first column is rebuilt from those fields.
     *
     * @param  array<string, mixed>  $slide
     * @return array<string, mixed>
     */
    private function repairColumns(array $slide): array
    {
        if (count($slide['columns']) !== 1 || ($slide['paragraphs'] === [] && $slide['bullets'] === [])) {
            return $slide;
        }

        $first = [
            'title' => rtrim($slide['side_title'], ': '),
            'text' => implode(' ', $slide['paragraphs']),
            'bullets' => array_slice($slide['bullets'], 0, 5),
        ];

        return array_merge($slide, [
            'columns' => [$first, $slide['columns'][0]],
            'paragraphs' => [],
            'side_title' => '',
            'bullets' => [],
        ]);
    }

    /**
     * @param  array<string, mixed>  $slide
     */
    private function validChart(array $slide): bool
    {
        $categories = count($slide['categories']);

        return $categories >= 2 && $slide['series'] !== [];
    }

    /**
     * An image layout that cannot have its image: image_text becomes a text
     * slide, banner_columns keeps its columns without the banner.
     *
     * @param  array<string, mixed>  $slide
     * @return array<string, mixed>
     */
    private function withoutImage(array $slide): array
    {
        if ($slide['layout'] === LessonDeck::LAYOUT_BANNER_COLUMNS) {
            return ['image' => false] + $slide;
        }

        if ($slide['layout'] !== LessonDeck::LAYOUT_IMAGE_TEXT) {
            return $slide;
        }

        $paragraphs = $slide['paragraphs'];

        foreach ($slide['columns'] as $column) {
            $paragraphs[] = trim($column['title'].'. '.$column['text'], '. ');
        }

        return array_merge($slide, [
            'layout' => LessonDeck::LAYOUT_TEXT_BULLETS,
            'paragraphs' => array_slice(array_values(array_filter($paragraphs)), 0, 4),
            'columns' => [],
            'image' => false,
            'image_side' => '',
        ]);
    }

    /**
     * @param  array<string, mixed>  $slide
     * @return array<string, mixed>|null
     */
    private function toCards(array $slide): ?array
    {
        if (count($slide['items']) >= 2) {
            return array_merge($slide, ['layout' => LessonDeck::LAYOUT_CARDS]);
        }

        return $this->toText($slide);
    }

    /**
     * Last resort: a text slide from whatever text the slide has.
     *
     * @param  array<string, mixed>  $slide
     * @return array<string, mixed>|null
     */
    private function toText(array $slide): ?array
    {
        $paragraphs = $slide['paragraphs'];
        $bullets = $slide['bullets'];

        foreach ($slide['items'] as $item) {
            $bullets[] = trim($item['title'].($item['text'] !== '' ? ' — '.$item['text'] : ''));
        }

        foreach ($slide['columns'] as $column) {
            $paragraphs[] = trim($column['title'].'. '.$column['text'], '. ');
        }

        if ($paragraphs === [] && $slide['text'] !== '') {
            $paragraphs[] = $slide['text'];
        }

        if ($paragraphs === [] && $bullets === []) {
            return null;
        }

        return array_merge(LessonDeck::emptySlide(LessonDeck::LAYOUT_TEXT_BULLETS), [
            'title' => $slide['title'],
            'paragraphs' => array_slice(array_values(array_filter($paragraphs)), 0, 4),
            'side_title' => $slide['side_title'],
            'bullets' => array_slice(array_values(array_filter($bullets)), 0, 8),
            'notes' => $slide['notes'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $slide
     * @return array<string, mixed>|null
     */
    private function columnsToText(array $slide): ?array
    {
        if (count($slide['columns']) === 1) {
            $column = $slide['columns'][0];

            return array_merge(LessonDeck::emptySlide(LessonDeck::LAYOUT_TEXT_BULLETS), [
                'title' => $slide['title'],
                'paragraphs' => $column['text'] !== '' ? [$column['text']] : $slide['paragraphs'],
                'side_title' => $column['title'],
                'bullets' => $column['bullets'] !== [] ? $column['bullets'] : $slide['bullets'],
                'notes' => $slide['notes'],
            ]);
        }

        return $this->toText($slide);
    }

    /**
     * A chart that cannot be drawn (or a second chart) shown as cards: one card per criterion.
     *
     * @param  array<string, mixed>  $slide
     * @return array<string, mixed>|null
     */
    private function chartToCards(array $slide): ?array
    {
        $items = $slide['items'];

        foreach ($slide['categories'] as $position => $category) {
            $values = [];

            foreach ($slide['series'] as $series) {
                $value = $series['values'][$position] ?? null;

                if ($value !== null) {
                    $values[] = $series['name'].': '.$this->formatNumber((float) $value).($slide['unit'] !== '' ? ' '.$slide['unit'] : '');
                }
            }

            $items[] = ['title' => $category, 'text' => implode('; ', $values), 'detail' => ''];
        }

        $cards = array_merge($slide, [
            'layout' => LessonDeck::LAYOUT_CARDS,
            'items' => array_slice($items, 0, 6),
            'footer' => $slide['footer'] !== '' ? $slide['footer'] : $this->cleanLine($slide['text'], 340),
            'categories' => [],
            'series' => [],
            'unit' => '',
            'text' => '',
        ]);

        return count($cards['items']) >= 2 ? $cards : $this->toText($slide);
    }

    /**
     * @return list<array{title: string, text: string, detail: string}>
     */
    private function cleanEntries(mixed $value, int $max): array
    {
        $entries = [];

        foreach ($this->listOf($value) as $item) {
            if (is_string($item)) {
                $parts = preg_split('/\s+[—–-]\s+|:\s+/u', $item, 2) ?: [];
                $item = ['title' => $parts[0] ?? '', 'text' => $parts[1] ?? ''];
            }

            if (! is_array($item)) {
                continue;
            }

            $entry = [
                'title' => $this->cleanLine($item['title'] ?? $item['name'] ?? $item['term'] ?? null, 90),
                'text' => $this->cleanLine($item['text'] ?? $item['description'] ?? $item['definition'] ?? null, 240),
                'detail' => $this->cleanLine($item['detail'] ?? null, 280),
            ];

            if ($entry['title'] === '' && $entry['text'] === '') {
                continue;
            }

            $entries[] = $entry;

            if (count($entries) === $max) {
                break;
            }
        }

        return $entries;
    }

    /**
     * @return list<array{title: string, text: string, bullets: list<string>}>
     */
    private function cleanColumns(mixed $value): array
    {
        $columns = [];

        foreach ($this->listOf($value) as $column) {
            if (! is_array($column)) {
                continue;
            }

            $entry = [
                'title' => $this->cleanLine($column['title'] ?? $column['heading'] ?? null, 90),
                'text' => $this->cleanText($column['text'] ?? null, 420),
                'bullets' => $this->cleanItems($column['bullets'] ?? null, 5, 120),
            ];

            if ($entry['title'] === '' && $entry['text'] === '' && $entry['bullets'] === []) {
                continue;
            }

            $columns[] = $entry;

            if (count($columns) === 2) {
                break;
            }
        }

        return $columns;
    }

    /**
     * @return list<array{value: string, label: string, text: string}>
     */
    private function cleanStats(mixed $value): array
    {
        $stats = [];

        foreach ($this->listOf($value) as $stat) {
            if (! is_array($stat)) {
                continue;
            }

            $entry = [
                'value' => $this->cleanLine($stat['value'] ?? null, 16),
                'label' => $this->cleanLine($stat['label'] ?? $stat['title'] ?? null, 60),
                'text' => $this->cleanLine($stat['text'] ?? $stat['description'] ?? null, 160),
            ];

            if ($entry['value'] === '' || $entry['label'] === '') {
                continue;
            }

            $stats[] = $entry;

            if (count($stats) === 4) {
                break;
            }
        }

        return $stats;
    }

    /**
     * Chart series with exactly one non-negative number per category.
     *
     * @return list<array{name: string, values: list<float|int>}>
     */
    private function cleanSeries(mixed $value, int $categories): array
    {
        if ($categories === 0) {
            return [];
        }

        $series = [];

        foreach ($this->listOf($value) as $row) {
            if (! is_array($row)) {
                continue;
            }

            $values = [];

            foreach (array_values((array) ($row['values'] ?? $row['data'] ?? [])) as $number) {
                if (is_string($number)) {
                    $number = str_replace([' ', ','], ['', '.'], $number);
                }

                if (! is_numeric($number) || (float) $number < 0 || ! is_finite((float) $number)) {
                    continue 2;
                }

                $values[] = $this->roundNumber((float) $number);
            }

            if (count($values) < $categories) {
                continue;
            }

            $name = $this->cleanLine($row['name'] ?? $row['title'] ?? null, 50);
            $series[] = ['name' => $name !== '' ? $name : '—', 'values' => array_slice($values, 0, $categories)];

            if (count($series) === 3) {
                break;
            }
        }

        return $series;
    }

    private function roundNumber(float $number): float|int
    {
        $rounded = round($number, 2);

        return floor($rounded) === $rounded ? (int) $rounded : $rounded;
    }

    private function formatNumber(float $number): string
    {
        return rtrim(rtrim(number_format($number, 2, ',', ' '), '0'), ',');
    }

    // ----------------------------------------------------------------------
    // Assembly helpers
    // ----------------------------------------------------------------------

    /**
     * @param  array<string, mixed>  $extras
     * @param  array<string, string>  $labels
     * @return array<string, mixed>
     */
    private function coverSlide(TeacherAiLesson $lesson, array $extras, array $labels): array
    {
        $cover = is_array($extras['cover'] ?? null) ? $extras['cover'] : [];
        $faculty = $this->coverLine($cover['faculty'] ?? null, $lesson->faculty_name);
        $department = $this->coverLine($cover['department'] ?? null, $lesson->department_name);
        $city = $this->cleanLine(config('services.teacher_ai.lesson_city'), 60) ?: $labels['city'];
        $year = ($lesson->created_at ?? now())->format('Y');

        $slide = LessonDeck::emptySlide(LessonDeck::LAYOUT_COVER);
        $slide['notes'] = $labels['cover_notes'];
        $slide['cover'] = [
            'university' => $labels['university'],
            'faculty' => $faculty,
            'department' => $department,
            'course_label' => $labels['course_label'],
            'course' => $this->cleanLine($lesson->subject, 255),
            'city_year' => $city.', '.$year,
        ];

        return $slide;
    }

    /**
     * The model's formatted line for the cover, but only for a field the teacher
     * filled in: an empty source must stay empty whatever the model wrote.
     */
    private function coverLine(mixed $formatted, ?string $source): string
    {
        $source = $this->cleanLine($source, 255);

        if ($source === '') {
            return '';
        }

        return $this->cleanLine($formatted, 255) ?: $source;
    }

    /**
     * @param  array<string, mixed>  $slide
     */
    private function imagePrompt(string $scene, array $slide, TeacherAiLesson $lesson): string
    {
        if ($scene === '') {
            $scene = sprintf(
                'An illustration for a university lecture on "%s" (course "%s"): %s.',
                $this->cleanLine($lesson->topic, 200),
                $this->cleanLine($lesson->subject, 120),
                $slide['title'] !== '' ? $slide['title'] : 'the main idea of the topic',
            );
        }

        return mb_substr(rtrim($scene, '. ').'.'.self::IMAGE_STYLE, 0, 1500);
    }

    /**
     * @param  array{type: string, section: int|null, count: int, layouts: list<string>}  $part
     */
    private function partFallbackTitle(array $part, TeacherAiLesson $lesson): string
    {
        if ($part['type'] === 'section') {
            $planned = $this->plannedSections($lesson)[(int) $part['section']] ?? [];
            $title = $this->cleanLine($planned['title'] ?? null, 120);

            if ($title !== '') {
                return $title;
            }
        }

        return $this->cleanLine($lesson->outline['title'] ?? null, 120) ?: $this->fallbackTitle($lesson);
    }
}
