<?php

namespace App\Services\TeacherAi;

use App\Models\TeacherAiLesson;
use App\Services\TeacherAi\Concerns\GeneratesLessonText;

/**
 * Domain service of the lecture text: builds the prompts for the outline and
 * section steps, calls the chat client and normalizes the model's answers into
 * the shapes stored on the lesson (the presentation lives in LessonDeckGenerator).
 *
 * Pure with respect to persistence: the lesson passed in may be unsaved and
 * is never written to.
 */
final class LessonGenerator
{
    use GeneratesLessonText;

    public const TASK_OUTLINE = 'outline';

    public const TASK_SECTION = 'section';

    private const MIN_SECTIONS = 3;

    private const MAX_SECTIONS = 8;

    private const OUTLINE_OPTIONS = ['temperature' => 0.4, 'max_tokens' => 3500];

    private const SECTION_OPTIONS = ['temperature' => 0.5, 'max_tokens' => 4000];

    /**
     * Wall-clock budget (seconds) for one generateSections() call: the queue job
     * is killed at 110 s, so sequential retries must fit into what the pool left.
     */
    private const SECTIONS_TIME_BUDGET = 100;

    private const MIN_RETRY_TIMEOUT = 15;

    public function __construct(private readonly TeacherAiChatClient $client) {}

    /**
     * Number of lecture sections for a lesson of the given length (~15 minutes each).
     */
    public static function plannedSectionCount(int $durationMinutes): int
    {
        return self::clamp((int) round($durationMinutes / 15), 4, 7);
    }

    /**
     * Target length of one section in words (~60 words per lecture minute).
     */
    public static function wordsPerSection(int $durationMinutes, int $sectionsCount): int
    {
        return self::clamp((int) round($durationMinutes * 60 / max(1, $sectionsCount)), 500, 900);
    }

    /**
     * Step 1: title, objectives, introduction, section plan, conclusion, etc.
     *
     * @return array{outline: array<string, mixed>, usage: array{model: string, prompt_tokens: int|null, completion_tokens: int|null}}
     *
     * @throws TeacherAiException
     */
    public function generateOutline(TeacherAiLesson $lesson): array
    {
        $result = $this->client->completeJson(
            $this->systemPrompt($lesson),
            $this->encode($this->outlineRequest($lesson)),
            self::OUTLINE_OPTIONS,
        );

        try {
            $outline = $this->normalizeOutline($result['data'], $lesson);
        } catch (TeacherAiException $e) {
            // One retry with the model's own answer rejected: usually a one-off shape glitch.
            $this->logRejectedAnswer('outline', $result['data'], $e);
            $result = $this->client->completeJson(
                $this->systemPrompt($lesson),
                $this->encode($this->outlineRequest($lesson))."\n\nВАЖНО: sections — массив объектов {title, key_points}, строго по схеме response_format.",
                self::OUTLINE_OPTIONS + ['retry' => false],
            );
            $outline = $this->normalizeOutline($result['data'], $lesson);
        }

        return [
            'outline' => $outline,
            'usage' => $this->usageOf($result),
        ];
    }

    /**
     * Step 2: full text of the planned sections with the given 0-based indexes,
     * requested concurrently. A key that fails in the pool is retried once
     * sequentially; a key that still fails is reported in `failures` with a
     * teacher-friendly message and left for the next run.
     *
     * @param  list<int>  $indexes
     * @return array{sections: array<int, array<string, mixed>>, failures: array<int, string>, usage: array{model: string, prompt_tokens: int|null, completion_tokens: int|null}}
     *
     * @throws TeacherAiException when the assistant is disabled
     */
    public function generateSections(TeacherAiLesson $lesson, array $indexes): array
    {
        $planned = $this->plannedSections($lesson);
        $indexes = array_values(array_unique(array_filter(
            array_map('intval', $indexes),
            static fn (int $index): bool => $index >= 0 && $index < count($planned),
        )));

        if ($indexes === []) {
            return ['sections' => [], 'failures' => [], 'usage' => $this->mergeUsage([])];
        }

        $systemPrompt = $this->systemPrompt($lesson);
        $requests = [];

        foreach ($indexes as $index) {
            $requests[$index] = [
                'system' => $systemPrompt,
                'user' => $this->encode($this->sectionRequest($lesson, $planned, $index)),
                'options' => self::SECTION_OPTIONS,
            ];
        }

        $startedAt = microtime(true);
        $pooled = $this->client->completeJsonPool($requests);

        $sections = [];
        $failures = [];
        $usages = [];

        foreach ($indexes as $index) {
            $result = $pooled[$index] ?? new TeacherAiException('ИИ вернул ответ в неожиданном формате. Попробуйте ещё раз.');

            if (is_array($result)) {
                $usages[] = $this->usageOf($result);

                try {
                    $sections[$index] = $this->normalizeSection($result['data'], $planned[$index]);

                    continue;
                } catch (TeacherAiException $e) {
                    $result = $e;
                }
            }

            // One sequential retry for this section only, within the remaining time budget;
            // whatever does not fit is left missing and picked up by the next job run.
            $remaining = (int) floor(self::SECTIONS_TIME_BUDGET - (microtime(true) - $startedAt));

            if ($remaining < self::MIN_RETRY_TIMEOUT) {
                $failures[$index] = $result->getMessage();

                continue;
            }

            try {
                $retried = $this->client->completeJson(
                    $requests[$index]['system'],
                    $requests[$index]['user'].$this->client->retryHintFor($result),
                    self::SECTION_OPTIONS + ['retry' => false, 'timeout' => $remaining],
                );
                $usages[] = $this->usageOf($retried);
                $sections[$index] = $this->normalizeSection($retried['data'], $planned[$index]);
            } catch (TeacherAiException $e) {
                $failures[$index] = $e->getMessage();
            }
        }

        return [
            'sections' => $sections,
            'failures' => $failures,
            'usage' => $this->mergeUsage($usages),
        ];
    }

    /**
     * Brings the outline answer to the stored shape; tolerant to messy input.
     *
     * @param  array<mixed>  $payload
     * @return array{title: string, objectives: list<string>, introduction: string, sections: list<array{title: string, key_points: list<string>}>, conclusion: string, self_check_questions: list<string>, glossary: list<array{term: string, definition: string}>, references: list<string>, keywords: list<string>}
     *
     * @throws TeacherAiException when fewer than 3 usable sections came back
     */
    public function normalizeOutline(array $payload, TeacherAiLesson $lesson): array
    {
        $sections = [];

        foreach ($this->listOf($payload['sections'] ?? null) as $raw) {
            if (is_string($raw)) {
                $raw = ['title' => $raw];
            }

            if (! is_array($raw)) {
                continue;
            }

            $title = $this->cleanLine($raw['title'] ?? $raw['name'] ?? null, 200);
            $keyPoints = $this->cleanItems($raw['key_points'] ?? $raw['points'] ?? null, 8, 300);

            if ($title === '' && $keyPoints === []) {
                continue;
            }

            $sections[] = [
                'title' => $title !== '' ? $title : LessonLocale::labels((string) $lesson->language)['section'].' '.(count($sections) + 1),
                'key_points' => $keyPoints,
            ];

            if (count($sections) === self::MAX_SECTIONS) {
                break;
            }
        }

        if (count($sections) < self::MIN_SECTIONS) {
            throw new TeacherAiException('ИИ вернул неполный план лекции. Попробуйте ещё раз.');
        }

        $title = $this->cleanLine($payload['title'] ?? null, 200);

        return [
            'title' => $title !== '' ? $title : $this->fallbackTitle($lesson),
            'objectives' => $this->cleanItems($payload['objectives'] ?? null, 8, 300),
            'introduction' => $this->cleanText($payload['introduction'] ?? null, 6000),
            'sections' => $sections,
            'conclusion' => $this->cleanText($payload['conclusion'] ?? null, 4000),
            'self_check_questions' => $this->cleanItems($payload['self_check_questions'] ?? $payload['questions'] ?? null, 10, 500),
            'glossary' => $this->cleanTerms($payload['glossary'] ?? null, 15, 120, 600),
            'references' => $this->cleanItems($payload['references'] ?? null, 8, 300),
            'keywords' => $this->cleanItems($payload['keywords'] ?? null, 12, 60),
        ];
    }

    /**
     * @param  array<mixed>  $payload
     * @param  array<mixed>  $planned  the outline entry this section was generated for
     * @return array{title: string, paragraphs: list<string>, key_terms: list<array{term: string, definition: string}>, examples: list<string>, summary: string}
     *
     * @throws TeacherAiException when no paragraph text came back
     */
    public function normalizeSection(array $payload, array $planned): array
    {
        $paragraphs = $this->cleanParagraphs(
            $payload['paragraphs'] ?? $payload['text'] ?? $payload['content'] ?? $payload['body'] ?? null,
            12,
            4000,
        );

        if ($paragraphs === []) {
            throw new TeacherAiException('ИИ вернул пустой раздел лекции. Попробуйте ещё раз.');
        }

        $title = $this->cleanLine($payload['title'] ?? null, 200);

        return [
            'title' => $title !== '' ? $title : $this->cleanLine($planned['title'] ?? null, 200),
            'paragraphs' => $paragraphs,
            'key_terms' => $this->cleanTerms($payload['key_terms'] ?? null, 6, 120, 600),
            'examples' => $this->cleanParagraphs($payload['examples'] ?? null, 5, 2000),
            'summary' => $this->cleanText($payload['summary'] ?? null, 600),
        ];
    }

    // ----------------------------------------------------------------------
    // Prompts
    // ----------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    private function outlineRequest(TeacherAiLesson $lesson): array
    {
        $sectionsCount = self::plannedSectionCount($this->duration($lesson));
        $wordsPerSection = self::wordsPerSection($this->duration($lesson), $sectionsCount);

        return [
            'task_type' => self::TASK_OUTLINE,
            'input' => $this->inputBlock($lesson),
            'sections_count' => $sectionsCount,
            'words_per_section' => $wordsPerSection,
            'task' => [
                'Составь план лекции по теме input.topic в рамках дисциплины input.subject для аудитории input.audience, учитывая пожелания преподавателя input.notes.',
                'title — название лекции, не длиннее 120 символов.',
                'objectives — 3–6 целей как измеримые результаты обучения: что студент сможет объяснить, рассчитать или сделать после занятия.',
                'introduction — 2–3 абзаца (250–400 слов), разделённые пустой строкой: актуальность темы, её место в дисциплине и что будет рассмотрено.',
                "sections — ровно {$sectionsCount} разделов в логическом порядке; у каждого title и 3–6 key_points — конкретные тезисы, которые нужно раскрыть. Полный текст каждого раздела (примерно {$wordsPerSection} слов) будет написан отдельно, здесь нужен только план.",
                'conclusion — 1–2 абзаца с итогами лекции.',
                'self_check_questions — 5–8 вопросов для самопроверки студентов.',
                'glossary — 6–12 ключевых терминов с короткими точными определениями.',
                'references — 3–6 источников: только широко известные учебники и работы (автор, название, год), без URL и DOI. Если не уверен в источнике — не включай его.',
                'keywords — 5–10 ключевых слов.',
                'Верни только JSON строго по схеме response_format; все строки — обычный текст без markdown.',
            ],
            'response_format' => [
                'title' => '',
                'objectives' => [''],
                'introduction' => '',
                'sections' => [['title' => '', 'key_points' => ['']]],
                'conclusion' => '',
                'self_check_questions' => [''],
                'glossary' => [['term' => '', 'definition' => '']],
                'references' => [''],
                'keywords' => [''],
            ],
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $planned  outline sections
     * @return array<string, mixed>
     */
    private function sectionRequest(TeacherAiLesson $lesson, array $planned, int $index): array
    {
        $total = count($planned);
        $wordsTarget = self::wordsPerSection($this->duration($lesson), $total);
        $section = $planned[$index];

        return [
            'task_type' => self::TASK_SECTION,
            'input' => $this->inputBlock($lesson),
            'lecture_title' => $this->cleanLine($lesson->outline['title'] ?? null, 200),
            'section_index' => $index + 1,
            'sections_total' => $total,
            'plan' => array_values(array_map(
                fn (array $item): string => $this->cleanLine($item['title'] ?? null, 200),
                $planned,
            )),
            'section' => [
                'title' => $this->cleanLine($section['title'] ?? null, 200),
                'key_points' => $this->cleanItems($section['key_points'] ?? null, 8, 300),
            ],
            'words_target' => $wordsTarget,
            'task' => [
                'Напиши полный текст раздела section лекции lecture_title (раздел section_index из sections_total). Остальные разделы из plan пишутся отдельно: не повторяй их содержание и не пересказывай введение лекции.',
                'Раскрой все key_points раздела.',
                "paragraphs — 6–9 связных абзацев по 90–140 слов каждый, общий объём примерно {$wordsTarget} слов (не менее 80 % от этого объёма). Конспект должен быть достаточно подробным для лекции на input.duration_minutes минут.",
                'Каждый тезис раскрывай полностью: определение, объяснение сути, пример, типичные ошибки или ограничения. Без заголовков внутри абзацев и без markdown.',
                'key_terms — 0–4 новых термина раздела с точными определениями.',
                'examples — 1–3 разобранных примера или мини-кейса; для технических и расчётных тем включи небольшую решённую задачу с ходом решения.',
                'summary — итог раздела в 1–2 предложениях.',
                'Верни только JSON строго по схеме response_format; все строки — обычный текст без markdown.',
            ],
            'response_format' => [
                'title' => '',
                'paragraphs' => [''],
                'key_terms' => [['term' => '', 'definition' => '']],
                'examples' => [''],
                'summary' => '',
            ],
        ];
    }
}
