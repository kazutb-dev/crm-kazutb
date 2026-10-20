<?php

namespace App\Services\TeacherAi;

/**
 * Shape of a version-2 presentation (KazUTB template layouts).
 *
 * Every stored slide has the same keys so that the PPTX exporter and the
 * React preview never need to guess; this class owns that contract
 * (see docs/modules/teacher-ai/LESSON_GENERATOR.md).
 */
final class LessonDeck
{
    public const VERSION = 2;

    public const LAYOUT_COVER = 'cover';

    public const LAYOUT_LECTURE_TITLE = 'lecture_title';

    public const LAYOUT_TEXT_BULLETS = 'text_bullets';

    public const LAYOUT_TIMELINE = 'timeline';

    public const LAYOUT_BANNER_COLUMNS = 'banner_columns';

    public const LAYOUT_CARDS = 'cards';

    public const LAYOUT_IMAGE_TEXT = 'image_text';

    public const LAYOUT_CHART = 'chart';

    public const LAYOUT_PYRAMID = 'pyramid';

    public const LAYOUT_STATS = 'stats';

    public const LAYOUT_STEPS = 'steps';

    public const LAYOUT_HIERARCHY = 'hierarchy';

    public const LAYOUT_CONCLUSION = 'conclusion';

    /**
     * Layouts the model may choose for content slides.
     *
     * @var list<string>
     */
    public const CONTENT_LAYOUTS = [
        self::LAYOUT_TEXT_BULLETS,
        self::LAYOUT_TIMELINE,
        self::LAYOUT_BANNER_COLUMNS,
        self::LAYOUT_CARDS,
        self::LAYOUT_IMAGE_TEXT,
        self::LAYOUT_CHART,
        self::LAYOUT_PYRAMID,
        self::LAYOUT_STATS,
        self::LAYOUT_STEPS,
        self::LAYOUT_HIERARCHY,
    ];

    /**
     * Layouts that carry an image slot.
     *
     * @var list<string>
     */
    public const IMAGE_LAYOUTS = [
        self::LAYOUT_LECTURE_TITLE,
        self::LAYOUT_IMAGE_TEXT,
        self::LAYOUT_BANNER_COLUMNS,
    ];

    /**
     * Content layouts in the order they are suggested to the model, so that a
     * deck alternates pictures, diagrams and text like the template does.
     *
     * @var list<string>
     */
    public const ROTATION = [
        self::LAYOUT_IMAGE_TEXT,
        self::LAYOUT_CARDS,
        self::LAYOUT_TIMELINE,
        self::LAYOUT_BANNER_COLUMNS,
        self::LAYOUT_STEPS,
        self::LAYOUT_CHART,
        self::LAYOUT_IMAGE_TEXT,
        self::LAYOUT_HIERARCHY,
        self::LAYOUT_CARDS,
        self::LAYOUT_PYRAMID,
        self::LAYOUT_BANNER_COLUMNS,
        self::LAYOUT_TEXT_BULLETS,
        self::LAYOUT_STATS,
        self::LAYOUT_IMAGE_TEXT,
        self::LAYOUT_STEPS,
        self::LAYOUT_CARDS,
        self::LAYOUT_TIMELINE,
        self::LAYOUT_TEXT_BULLETS,
    ];

    /**
     * A slide with every key present and empty.
     *
     * @return array<string, mixed>
     */
    public static function emptySlide(string $layout = self::LAYOUT_TEXT_BULLETS): array
    {
        return [
            'layout' => $layout,
            'title' => '',
            'subtitle' => '',
            'paragraphs' => [],
            'side_title' => '',
            'bullets' => [],
            'items' => [],
            'columns' => [],
            'stats' => [],
            'categories' => [],
            'series' => [],
            'unit' => '',
            'text' => '',
            'footer' => '',
            'image' => false,
            'image_side' => '',
            'notes' => '',
            'cover' => null,
        ];
    }

    /**
     * Fills missing keys of a stored slide (defensive read of older or edited rows).
     *
     * @param  array<string, mixed>  $slide
     * @return array<string, mixed>
     */
    public static function uniform(array $slide): array
    {
        $result = self::emptySlide((string) ($slide['layout'] ?? self::LAYOUT_TEXT_BULLETS));

        foreach ($result as $key => $default) {
            if (! array_key_exists($key, $slide)) {
                continue;
            }

            $value = $slide[$key];

            $result[$key] = match (true) {
                is_array($default) => is_array($value) ? array_values($value) : [],
                is_bool($default) => (bool) $value,
                $key === 'cover' => is_array($value) ? $value : null,
                default => is_scalar($value) ? (string) $value : '',
            };
        }

        $result['items'] = array_values(array_map(static fn ($item): array => [
            'title' => (string) (is_array($item) ? ($item['title'] ?? '') : ''),
            'text' => (string) (is_array($item) ? ($item['text'] ?? '') : ''),
            'detail' => (string) (is_array($item) ? ($item['detail'] ?? '') : ''),
        ], $result['items']));

        $result['columns'] = array_values(array_map(static fn ($column): array => [
            'title' => (string) (is_array($column) ? ($column['title'] ?? '') : ''),
            'text' => (string) (is_array($column) ? ($column['text'] ?? '') : ''),
            'bullets' => array_values(array_map('strval', (array) (is_array($column) ? ($column['bullets'] ?? []) : []))),
        ], $result['columns']));

        return $result;
    }

    public static function hasImageSlot(string $layout): bool
    {
        return in_array($layout, self::IMAGE_LAYOUTS, true);
    }
}
