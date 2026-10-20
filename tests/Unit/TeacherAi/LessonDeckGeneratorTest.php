<?php

namespace Tests\Unit\TeacherAi;

use App\Models\TeacherAiLesson;
use App\Services\TeacherAi\LessonDeck;
use App\Services\TeacherAi\LessonDeckGenerator;
use App\Services\TeacherAi\TeacherAiChatClient;
use App\Services\TeacherAi\TeacherAiImageClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LessonDeckGeneratorTest extends TestCase
{
    private const ENDPOINT = 'https://ai.test/v1/chat/completions';

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.teacher_ai', [
            'enabled' => true,
            'endpoint' => self::ENDPOINT,
            'model' => 'gpt-4o-mini',
            'api_key' => 'teacher-key',
            'lesson_timeout' => 30,
            'lesson_retry_sleep_ms' => 0,
        ]);
    }

    public function test_plan_spreads_content_slides_over_sections_with_varied_layouts(): void
    {
        $plan = $this->generator()->plan($this->lesson(['slides_count' => 15]), true, 8);

        $this->assertSame(
            ['opening', 'section:0', 'section:1', 'section:2', 'section:3', 'closing'],
            array_column($plan, 'key'),
        );
        // 15 slides = cover + lecture title + overview + conclusion + 11 content slides.
        $this->assertSame([2, 3, 3, 3, 2, 1], array_column($plan, 'count'));
        $this->assertSame(['lecture_title', 'text_bullets'], $plan[0]['layouts']);
        $this->assertSame(['image_text', 'cards', 'timeline'], $plan[1]['layouts']);
        $this->assertSame(['banner_columns', 'steps', 'chart'], $plan[2]['layouts']);
        $this->assertSame(['conclusion'], $plan[5]['layouts']);
    }

    public function test_plan_respects_the_image_budget_and_uses_one_chart(): void
    {
        $plan = $this->generator()->plan($this->lesson(['slides_count' => 30]), true, 3);
        $layouts = array_merge(...array_column(array_slice($plan, 1, -1), 'layouts'));

        // Lecture title + 2 more image slides fit into a budget of 3.
        $imageLayouts = array_filter($layouts, fn (string $layout): bool => LessonDeck::hasImageSlot($layout));
        $this->assertCount(2, $imageLayouts);
        $this->assertCount(1, array_filter($layouts, fn (string $layout): bool => $layout === 'chart'));
        $this->assertSame(26, count($layouts));
    }

    public function test_plan_without_images_never_suggests_image_layouts(): void
    {
        $plan = $this->generator()->plan($this->lesson(['slides_count' => 20]), false, 8);
        $layouts = array_merge(...array_column(array_slice($plan, 1, -1), 'layouts'));

        $this->assertNotContains('image_text', $layouts);
        $this->assertNotContains('banner_columns', $layouts);
    }

    public function test_plan_clamps_the_slide_count(): void
    {
        $small = $this->generator()->plan($this->lesson(['slides_count' => 3]), true, 8);
        $this->assertSame(8 - 1, array_sum(array_column($small, 'count')));

        $large = $this->generator()->plan($this->lesson(['slides_count' => 99]), true, 8);
        $this->assertSame(30 - 1, array_sum(array_column($large, 'count')));
    }

    public function test_normalize_slide_cleans_text_and_returns_the_uniform_shape(): void
    {
        $entry = $this->generator()->normalizeSlide([
            'layout' => 'CARDS',
            'title' => '  **Свойства** SRAM  ',
            'items' => [
                ['title' => '1. Скорость', 'text' => 'Очень **быстро**'],
                'Надёжность — нет обновления',
                ['title' => '', 'text' => ''],
                'not-a-card',
            ],
            'footer' => "Итог\nв две строки",
            'notes' => 'Заметки',
            'image_prompt' => 'should be dropped for cards',
        ], 'cards', true);

        $slide = $entry['slide'];
        $this->assertSame(array_keys(LessonDeck::emptySlide()), array_keys($slide));
        $this->assertSame('cards', $slide['layout']);
        $this->assertSame('Свойства SRAM', $slide['title']);
        $this->assertSame([
            ['title' => 'Скорость', 'text' => 'Очень быстро', 'detail' => ''],
            ['title' => 'Надёжность', 'text' => 'нет обновления', 'detail' => ''],
            ['title' => 'not-a-card', 'text' => '', 'detail' => ''],
        ], $slide['items']);
        $this->assertSame('Итог в две строки', $slide['footer']);
        $this->assertFalse($slide['image']);
        $this->assertSame('', $entry['image_prompt']);
    }

    public function test_unknown_layout_falls_back_to_the_suggested_one(): void
    {
        $entry = $this->generator()->normalizeSlide([
            'layout' => 'mosaic',
            'title' => 'Этапы',
            'items' => [['title' => 'A', 'text' => 'a'], ['title' => 'B', 'text' => 'b'], ['title' => 'C', 'text' => 'c']],
        ], 'timeline', true);

        $this->assertSame('timeline', $entry['slide']['layout']);
    }

    public function test_layouts_degrade_when_the_content_does_not_fit(): void
    {
        $generator = $this->generator();
        $two = [['title' => 'A', 'text' => 'a'], ['title' => 'B', 'text' => 'b']];

        // A timeline needs three stages.
        $this->assertSame('cards', $generator->normalizeSlide(['layout' => 'timeline', 'title' => 'T', 'items' => $two], 'timeline', true)['slide']['layout']);
        // A pyramid of five levels is a hierarchy.
        $five = array_fill(0, 5, ['title' => 'L', 'text' => 'l']);
        $this->assertSame('hierarchy', $generator->normalizeSlide(['layout' => 'pyramid', 'title' => 'P', 'items' => $five], 'pyramid', true)['slide']['layout']);
        // Stats need at least two figures.
        $this->assertSame('cards', $generator->normalizeSlide(['layout' => 'stats', 'title' => 'S', 'items' => $two, 'stats' => [['value' => '95%', 'label' => 'HIT']]], 'stats', true)['slide']['layout']);
        // A text slide made of items becomes cards.
        $this->assertSame('cards', $generator->normalizeSlide(['layout' => 'text_bullets', 'title' => 'X', 'items' => $two], 'text_bullets', true)['slide']['layout']);
        // Nothing usable at all.
        $this->assertNull($generator->normalizeSlide(['layout' => 'cards', 'title' => 'Пусто'], 'cards', true));
    }

    public function test_two_column_slide_is_repaired_when_the_first_column_came_as_paragraphs(): void
    {
        $entry = $this->generator()->normalizeSlide([
            'layout' => 'banner_columns',
            'title' => 'SRAM',
            'side_title' => 'Артықшылықтары:',
            'paragraphs' => ['Жылдам жад.'],
            'bullets' => ['Жылдамдық', 'Сенімділік'],
            'columns' => [['title' => 'Кемшіліктері', 'text' => 'Қымбат.', 'bullets' => ['Құны']]],
            'image_prompt' => 'SRAM chips on a board',
        ], 'banner_columns', true);

        $slide = $entry['slide'];
        $this->assertSame('banner_columns', $slide['layout']);
        $this->assertSame([
            ['title' => 'Артықшылықтары', 'text' => 'Жылдам жад.', 'bullets' => ['Жылдамдық', 'Сенімділік']],
            ['title' => 'Кемшіліктері', 'text' => 'Қымбат.', 'bullets' => ['Құны']],
        ], $slide['columns']);
        $this->assertSame([], $slide['paragraphs']);
        $this->assertTrue($slide['image']);
        $this->assertSame('SRAM chips on a board', $entry['image_prompt']);
    }

    public function test_image_layouts_without_images_become_text_or_lose_the_banner(): void
    {
        $generator = $this->generator();

        $text = $generator->normalizeSlide([
            'layout' => 'image_text',
            'title' => 'DRAM',
            'columns' => [['title' => 'Мәні', 'text' => 'Конденсатор.'], ['title' => 'Refresh', 'text' => 'Жаңарту.']],
        ], 'image_text', false)['slide'];
        $this->assertSame('text_bullets', $text['layout']);
        $this->assertSame(['Мәні. Конденсатор', 'Refresh. Жаңарту'], $text['paragraphs']);
        $this->assertFalse($text['image']);

        $banner = $generator->normalizeSlide([
            'layout' => 'banner_columns',
            'title' => 'HDD / SSD',
            'columns' => [['title' => 'HDD', 'text' => 'a'], ['title' => 'SSD', 'text' => 'b']],
        ], 'banner_columns', false)['slide'];
        $this->assertSame('banner_columns', $banner['layout']);
        $this->assertFalse($banner['image']);

        // The lecture title keeps its slot (drawn as a placeholder).
        $title = $generator->normalizeSlide(['layout' => 'lecture_title', 'subtitle' => 'x'], 'lecture_title', false)['slide'];
        $this->assertTrue($title['image']);
    }

    public function test_chart_needs_numeric_series_and_degrades_to_cards(): void
    {
        $generator = $this->generator();

        $chart = $generator->normalizeSlide([
            'layout' => 'chart',
            'title' => 'SRAM мен DRAM',
            'text' => 'Салыстыру',
            'categories' => ['Жылдамдық', 'Тығыздық', 'Құны'],
            'series' => [
                ['name' => 'SRAM — салыстырмалы мәні', 'values' => [95, '30', '20,5']],
                ['name' => 'Broken', 'values' => [1, 'x', 3]],
                ['name' => 'DRAM — салыстырмалы мәні', 'values' => [65, 90, 85, 99]],
            ],
        ], 'chart', true)['slide'];

        $this->assertSame('chart', $chart['layout']);
        $this->assertSame([
            ['name' => 'SRAM — салыстырмалы мәні', 'values' => [95, 30, 20.5]],
            ['name' => 'DRAM — салыстырмалы мәні', 'values' => [65, 90, 85]],
        ], $chart['series']);
        $this->assertSame('Салыстыру', $chart['text']);

        $cards = $generator->normalizeSlide([
            'layout' => 'chart',
            'title' => 'Без чисел',
            'categories' => ['Скорость', 'Цена'],
            'series' => [['name' => 'A', 'values' => ['быстро', 'дорого']]],
        ], 'chart', true)['slide'];
        $this->assertSame('cards', $cards['layout']);
        $this->assertSame(['Скорость', 'Цена'], array_column($cards['items'], 'title'));
    }

    public function test_generate_parts_sends_one_request_per_part_with_skeletons_and_normalizes_them(): void
    {
        Http::fake(fn (Request $request) => Http::response($this->completion($this->answerFor($request))));

        $lesson = $this->lesson(['language' => 'kk', 'slides_count' => 8, 'faculty_name' => 'Факультет инжиниринга', 'department_name' => 'Информационные технологии']);
        $generator = $this->generator();
        $plan = $generator->plan($lesson, true, 8);
        $result = $generator->generateParts($lesson, $plan, array_column($plan, 'key'), true);

        $this->assertSame([], $result['failures']);
        $this->assertCount(count($plan), $result['parts']);
        $this->assertSame('«Инженерлік және ақпараттық технологиялар» факультеті', $result['extras']['cover']['faculty']);
        $this->assertSame(count($plan) * 100, $result['usage']['prompt_tokens']);
        Http::assertSentCount(count($plan));

        Http::assertSent(function (Request $request): bool {
            $payload = json_decode((string) $request['messages'][1]['content'], true);

            if (($payload['task_type'] ?? null) !== LessonDeckGenerator::TASK_SECTION) {
                return false;
            }

            // One answer template per planned slide, each with only its layout's fields.
            $skeletons = $payload['response_format']['slides'];

            return str_contains($request['messages'][0]['content'], 'Пиши на казахском языке')
                && count($skeletons) === $payload['slides_count']
                && array_column($skeletons, 'layout') === $payload['layouts']
                && array_key_first($payload) === 'task_type';
        });
    }

    public function test_generate_parts_retries_a_failed_part_once_and_reports_a_second_failure(): void
    {
        $calls = 0;
        Http::fake(function (Request $request) use (&$calls) {
            $payload = json_decode((string) $request['messages'][1]['content'], true) ?: [];

            if (($payload['section']['number'] ?? null) === 1) {
                $calls++;

                return Http::response(['error' => ['message' => 'boom']], 500);
            }

            return Http::response($this->completion($this->answerFor($request)));
        });

        $lesson = $this->lesson(['slides_count' => 8]);
        $generator = $this->generator();
        $plan = $generator->plan($lesson, true, 8);
        $result = $generator->generateParts($lesson, $plan, array_column($plan, 'key'), true);

        $this->assertSame(2, $calls);
        $this->assertSame(['section:0'], array_keys($result['failures']));
        $this->assertArrayNotHasKey('section:0', $result['parts']);
        $this->assertStringContainsString('временно недоступен', $result['failures']['section:0']);
    }

    public function test_assemble_builds_cover_title_image_jobs_and_alternates_image_sides(): void
    {
        Carbon::setTestNow('2026-10-20 10:00:00');
        Http::fake(fn (Request $request) => Http::response($this->completion($this->answerFor($request))));

        $lesson = $this->lesson([
            'language' => 'kk',
            'lecture_number' => 7,
            'slides_count' => 16,
            'faculty_name' => 'Факультет инжиниринга и информационных технологий',
            'department_name' => 'Информационные технологии',
        ]);
        $generator = $this->generator();
        $plan = $generator->plan($lesson, true, 8);
        $result = $generator->generateParts($lesson, $plan, array_column($plan, 'key'), true);
        $deck = $generator->assemble($lesson, $plan, $result['parts'], $result['extras'], true, 8);

        $slides = $deck['presentation']['slides'];
        $this->assertSame(LessonDeck::VERSION, $deck['presentation']['version']);
        $this->assertSame('cover', $slides[0]['layout']);
        $this->assertSame([
            'university' => '«Қ.Құлажанов атындағы Қазақ технология және бизнес университеті» АҚ',
            'faculty' => '«Инженерлік және ақпараттық технологиялар» факультеті',
            'department' => '«Ақпараттық технологиялар» кафедрасы',
            'course_label' => 'Курс атауы:',
            'course' => 'Базы данных',
            'city_year' => 'Астана, 2026',
        ], $slides[0]['cover']);
        $this->assertSame('7-Дәріс. Нормализация', $slides[1]['title']);
        $this->assertSame('conclusion', end($slides)['layout']);
        $this->assertCount(16, $slides);

        $sides = array_column(array_filter($slides, fn (array $slide): bool => $slide['layout'] === 'image_text'), 'image_side');
        $this->assertSame(['right', 'left'], array_values($sides));

        foreach ($deck['images'] as $index => $job) {
            $this->assertTrue($slides[(int) $index]['image']);
            $this->assertSame('pending', $job['status']);
            $this->assertStringEndsWith(LessonDeckGenerator::IMAGE_STYLE, $job['prompt']);
            $this->assertSame(
                $slides[(int) $index]['layout'] === 'banner_columns' ? TeacherAiImageClient::ORIENTATION_LANDSCAPE : TeacherAiImageClient::ORIENTATION_PORTRAIT,
                $job['orientation'],
            );
        }

        Carbon::setTestNow();
    }

    public function test_cover_stays_without_faculty_and_department_when_the_teacher_gave_none(): void
    {
        // The model "helpfully" returns names although the source was empty.
        Http::fake(fn (Request $request) => Http::response($this->completion($this->answerFor($request))));

        $lesson = $this->lesson(['slides_count' => 8]);
        $generator = $this->generator();
        $plan = $generator->plan($lesson, true, 8);
        $result = $generator->generateParts($lesson, $plan, array_column($plan, 'key'), true);
        $cover = $generator->assemble($lesson, $plan, $result['parts'], $result['extras'], true, 8)['presentation']['slides'][0]['cover'];

        $this->assertSame('', $cover['faculty']);
        $this->assertSame('', $cover['department']);
        $this->assertSame('АО «Казахский университет технологии и бизнеса имени К. Кулажанова»', $cover['university']);

        Http::assertSent(function (Request $request): bool {
            $payload = json_decode((string) $request['messages'][1]['content'], true);

            return ($payload['task_type'] ?? null) === LessonDeckGenerator::TASK_OPENING
                && in_array('cover — оставь обе строки пустыми.', $payload['task'], true);
        });
    }

    public function test_assemble_enforces_the_image_budget(): void
    {
        Http::fake(fn (Request $request) => Http::response($this->completion($this->answerFor($request))));

        $lesson = $this->lesson(['slides_count' => 16]);
        $generator = $this->generator();
        $plan = $generator->plan($lesson, true, 8);
        $result = $generator->generateParts($lesson, $plan, array_column($plan, 'key'), true);
        $deck = $generator->assemble($lesson, $plan, $result['parts'], $result['extras'], true, 2);

        $this->assertCount(2, $deck['images']);
        $this->assertCount(2, array_filter($deck['presentation']['slides'], fn (array $slide): bool => $slide['image']));
    }

    // ----------------------------------------------------------------------

    private function generator(): LessonDeckGenerator
    {
        return new LessonDeckGenerator(new TeacherAiChatClient);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function lesson(array $overrides = []): TeacherAiLesson
    {
        $lesson = new TeacherAiLesson(array_merge([
            'subject' => 'Базы данных',
            'topic' => 'Нормализация',
            'language' => 'ru',
            'duration_minutes' => 50,
            'slides_count' => 15,
            'outline' => [
                'title' => 'Нормализация',
                'objectives' => ['Цель'],
                'introduction' => 'Введение.',
                'sections' => [
                    ['title' => 'Раздел A', 'key_points' => ['a']],
                    ['title' => 'Раздел B', 'key_points' => ['b']],
                    ['title' => 'Раздел C', 'key_points' => ['c']],
                    ['title' => 'Раздел D', 'key_points' => ['d']],
                ],
                'conclusion' => 'Итог.',
                'keywords' => ['нормализация'],
            ],
            'sections' => array_fill(0, 4, ['title' => 'Раздел', 'paragraphs' => ['Текст раздела.'], 'examples' => [], 'summary' => 'Итог раздела.']),
        ], $overrides));
        $lesson->created_at = Carbon::parse('2026-10-20 10:00:00');

        return $lesson;
    }

    /**
     * Valid answers for every part, built from the request's own layouts.
     *
     * @return array<string, mixed>
     */
    private function answerFor(Request $request): array
    {
        $payload = json_decode((string) $request['messages'][1]['content'], true) ?: [];
        $items = [['title' => 'A', 'text' => 'a'], ['title' => 'B', 'text' => 'b'], ['title' => 'C', 'text' => 'c']];

        return match ($payload['task_type'] ?? null) {
            LessonDeckGenerator::TASK_OPENING => [
                'cover' => ['faculty' => '«Инженерлік және ақпараттық технологиялар» факультеті', 'department' => '«Ақпараттық технологиялар» кафедрасы'],
                'subtitle' => 'Подзаголовок',
                'slides' => [
                    ['layout' => 'lecture_title', 'subtitle' => 'Подзаголовок', 'image_prompt' => 'A database'],
                    ['layout' => 'text_bullets', 'title' => 'Обзор', 'paragraphs' => ['Текст.'], 'bullets' => ['Пункт']],
                ],
            ],
            LessonDeckGenerator::TASK_CLOSING => ['slides' => [['layout' => 'conclusion', 'title' => 'Итоги', 'items' => $items, 'footer' => 'Вывод.']]],
            default => ['slides' => array_map(fn (string $layout): array => match ($layout) {
                'image_text' => ['layout' => $layout, 'title' => 'Картинка', 'paragraphs' => ['Текст.'], 'image_prompt' => 'Servers'],
                'banner_columns' => ['layout' => $layout, 'title' => 'Колонки', 'columns' => [['title' => 'L', 'text' => 'l'], ['title' => 'R', 'text' => 'r']], 'image_prompt' => 'Panorama'],
                'chart' => ['layout' => $layout, 'title' => 'Диаграмма', 'categories' => ['x', 'y', 'z'], 'series' => [['name' => 'A', 'values' => [1, 2, 3]]]],
                'stats' => ['layout' => $layout, 'title' => 'Цифры', 'items' => [['title' => 'HIT', 'text' => 'h']], 'stats' => [['value' => '95%', 'label' => 'HIT'], ['value' => '100x', 'label' => 'Gap'], ['value' => '1-5', 'label' => 'нс']]],
                'text_bullets' => ['layout' => $layout, 'title' => 'Текст', 'paragraphs' => ['Абзац.'], 'bullets' => ['Пункт']],
                default => ['layout' => $layout, 'title' => ucfirst($layout), 'items' => $items, 'footer' => 'Итог.'],
            }, (array) ($payload['layouts'] ?? []))],
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function completion(array $payload): array
    {
        return [
            'model' => 'gpt-4o-mini',
            'choices' => [['finish_reason' => 'stop', 'message' => ['content' => json_encode($payload, JSON_UNESCAPED_UNICODE)]]],
            'usage' => ['prompt_tokens' => 100, 'completion_tokens' => 40],
        ];
    }
}
