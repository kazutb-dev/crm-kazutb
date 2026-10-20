<?php

namespace App\Services\TeacherAi;

use App\Models\TeacherAiLesson;
use DOMDocument;
use PhpOffice\PhpPresentation\DocumentLayout;
use PhpOffice\PhpPresentation\IOFactory;
use PhpOffice\PhpPresentation\PhpPresentation;
use PhpOffice\PhpPresentation\Shape\AutoShape;
use PhpOffice\PhpPresentation\Shape\RichText;
use PhpOffice\PhpPresentation\Slide;
use PhpOffice\PhpPresentation\Slide\Background\Color as BackgroundColor;
use PhpOffice\PhpPresentation\Style\Alignment;
use PhpOffice\PhpPresentation\Style\Bullet;
use PhpOffice\PhpPresentation\Style\Color;
use PhpOffice\PhpPresentation\Style\Fill;
use Throwable;
use ZipArchive;

/**
 * Renders a version-2 lesson presentation as a PowerPoint deck in the KazUTB
 * lecture template: white 1280x720 slides, Times New Roman, the round emblem
 * in the top-right corner of every slide, lavender cards with indigo accents
 * and AI pictures in fixed slots (13 layouts, geometry from SPEC v2 §3).
 *
 * Geometry is in canvas pixels (PhpPresentation's unit, 1 px = 9525 EMU),
 * font sizes in points. Nothing relies on the viewer's autofit: every text
 * box is fitted up front with a glyph-width estimate (see shrinkFor()).
 */
final class LessonPptxExporter
{
    private const CREATOR = 'KazUTB AI-ассистент';

    private const FONT = 'Times New Roman';

    /**
     * 1280 x 720 px canvas = 13.333 x 7.5 in ("Widescreen").
     */
    private const SLIDE_CX = 12192000;

    private const SLIDE_CY = 6858000;

    private const TEXT_TITLE = 'FF111111';

    private const TEXT_BODY = 'FF333333';

    private const TEXT_MUTED = 'FF555555';

    private const TEXT_ITEM = 'FF1F1F1F';

    private const COVER_NAVY = 'FF1B2A4A';

    private const INDIGO = 'FF4B4FC4';

    private const LAVENDER = 'FFDCDCF3';

    private const LAVENDER_BORDER = 'FFC3C3E6';

    private const LINE = 'FFC9C9DD';

    private const GRID = 'FFE5E7EB';

    private const WHITE = 'FFFFFFFF';

    private const PLACEHOLDER_FROM = 'FF2E2A78';

    private const PLACEHOLDER_TO = 'FF6A5ACD';

    private const CHART_SERIES = ['FF161A38', 'FF3C3F9F', 'FF8C8FD9'];

    private const LOGO_BOX = [1160, 24, 92, 92];

    /**
     * Paragraph defaults; the styles below override them. Sizes and the fit
     * minimum are in pt, `spacing` is the line spacing factor, `after` the
     * space after the paragraph in pt, `lines` a line limit (0 = none).
     */
    private const PARAGRAPH = [
        'size' => 16, 'min' => 12, 'bold' => false, 'color' => self::TEXT_BODY,
        'align' => Alignment::HORIZONTAL_LEFT, 'spacing' => 1.0, 'after' => 0, 'bullet' => false, 'lines' => 0,
    ];

    private const TITLE = ['size' => 22, 'min' => 16, 'bold' => true, 'color' => self::TEXT_TITLE, 'lines' => 2];

    /**
     * Title boxes 50 px high hold two lines only from 15 pt down.
     */
    private const TITLE_COMPACT = ['min' => 15] + self::TITLE;

    private const BODY = ['size' => 16, 'min' => 12, 'spacing' => 1.15, 'after' => 8];

    private const BULLET = ['bullet' => true] + self::BODY;

    private const HEADING = ['size' => 17, 'min' => 13, 'bold' => true, 'color' => self::TEXT_TITLE];

    private const ITEM_TITLE = ['size' => 16, 'min' => 12, 'bold' => true, 'color' => self::TEXT_ITEM];

    private const ITEM_TEXT = ['size' => 14, 'min' => 11];

    private const FOOTER = ['size' => 15, 'min' => 12];

    /**
     * Single-line height in units of the font size: LibreOffice lays Times
     * New Roman out at 1.2 (measured), PowerPoint slightly tighter.
     */
    private const LINE_HEIGHT = 1.2;

    /**
     * Glyph widths of Times New Roman in em, measured on Liberation Serif
     * (identical metrics): narrow ≈ 0.31, wide ≈ 0.71, extra wide ≈ 0.95,
     * other capitals 0.70, everything else 0.49, space 0.25; bold ≈ +7 %.
     * Over Kazakh/Russian text the estimate is 0–11 % wider than real; in a
     * check against LibreOffice renders (800 paragraphs, 8 box widths and
     * sizes) the wrapped line count was exact 750 times, one line too many
     * 50 times and never too few.
     */
    private const GLYPHS_NARROW = ".,:;!'\"|()[]{}-/iljtfrIіІ";

    private const GLYPHS_WIDE = 'mwжмшщыюф';

    private const GLYPHS_EXTRA_WIDE = 'MWЖМШЩЫЮФ%—';

    private const SPACE_EM = 0.25;

    private const BOLD_FACTOR = 1.07;

    /**
     * Estimated text may exceed its box by this much (px): the last line's
     * box includes leading below the descenders.
     */
    private const FIT_TOLERANCE = 2;

    /**
     * Corner radius (px) of rounded rectangles; shapes thinner than twice the
     * radius become pills.
     */
    private const CORNER_RADIUS = 8;

    private const LAYOUTS = [
        'cover', 'lecture_title', 'text_bullets', 'timeline', 'banner_columns', 'cards', 'image_text',
        'chart', 'pyramid', 'stats', 'steps', 'hierarchy', 'conclusion',
    ];

    /**
     * Most items a layout can draw (the generator guarantees these counts).
     */
    private const MAX_ITEMS = ['timeline' => 6, 'cards' => 6, 'pyramid' => 4, 'stats' => 2, 'steps' => 6, 'hierarchy' => 6, 'conclusion' => 6];

    private ?TeacherAiLesson $lesson = null;

    /**
     * @var array<string, string>
     */
    private array $labels = [];

    private string $language = 'ru-RU';

    private string $title = '';

    /**
     * Temp images of the current export, deleted once the file is written.
     *
     * @var list<string>
     */
    private array $tempFiles = [];

    /**
     * Word widths in em of the current export, keyed by weight + word.
     *
     * @var array<string, float>
     */
    private array $wordWidths = [];

    /**
     * Builds the PPTX and returns the path of a temp file; the caller deletes it.
     *
     * @throws TeacherAiException when the lesson has no version-2 presentation or the file cannot be written
     */
    public function export(TeacherAiLesson $lesson): string
    {
        $slides = $lesson->hasPresentation() ? $this->slides((array) $lesson->presentation['slides']) : [];

        if ($slides === []) {
            throw new TeacherAiException('Презентация ещё не готова.');
        }

        $this->begin($lesson);

        try {
            $deck = $this->deck();

            foreach ($slides as $data) {
                $this->renderSlide($deck->createSlide(), $data);
            }

            return $this->save($deck);
        } finally {
            $this->finish();
        }
    }

    private function begin(TeacherAiLesson $lesson): void
    {
        $code = LessonLocale::normalize((string) $lesson->language);

        $this->lesson = $lesson;
        $this->labels = LessonLocale::labels($code);
        $this->language = match ($code) {
            'kk' => 'kk-KZ',
            'en' => 'en-US',
            default => 'ru-RU',
        };
        $this->title = $this->deckTitle($lesson);
        $this->tempFiles = [];
        $this->wordWidths = [];
    }

    private function finish(): void
    {
        foreach ($this->tempFiles as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }

        $this->tempFiles = [];
        $this->wordWidths = [];
        $this->lesson = null;
    }

    private function deck(): PhpPresentation
    {
        $deck = new PhpPresentation;
        $deck->getLayout()
            ->setCX(self::SLIDE_CX, DocumentLayout::UNIT_EMU)
            ->setCY(self::SLIDE_CY, DocumentLayout::UNIT_EMU);

        $deck->getDocumentProperties()
            ->setCreator(self::CREATOR)
            ->setLastModifiedBy(self::CREATOR)
            ->setTitle($this->title)
            ->setSubject($this->line($this->lesson?->subject))
            ->setDescription($this->label('generated_note'));

        $background = new BackgroundColor;
        $background->setColor(new Color(self::WHITE));

        foreach ($deck->getAllMasterSlides() as $master) {
            $master->setBackground($background);
        }

        // A new presentation starts with one empty slide.
        $deck->removeSlideByIndex(0);

        return $deck;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function renderSlide(Slide $slide, array $data): void
    {
        match ($data['layout']) {
            'cover' => $this->coverSlide($slide, $data),
            'lecture_title' => $this->lectureTitleSlide($slide, $data),
            'timeline' => $this->timelineSlide($slide, $data),
            'banner_columns' => $this->bannerColumnsSlide($slide, $data),
            'cards' => $this->cardsSlide($slide, $data),
            'image_text' => $this->imageTextSlide($slide, $data),
            'chart' => $this->chartSlide($slide, $data),
            'pyramid' => $this->pyramidSlide($slide, $data),
            'stats' => $this->statsSlide($slide, $data),
            'steps' => $this->stepsSlide($slide, $data),
            'hierarchy' => $this->hierarchySlide($slide, $data),
            'conclusion' => $this->conclusionSlide($slide, $data),
            default => $this->textBulletsSlide($slide, $data),
        };

        $this->addLogo($slide);
        $this->addNotes($slide, $data['notes']);
    }

    // ---------------------------------------------------------------- layouts

    /**
     * A) University, faculty, department, course and city centred on the left,
     * the building photo with the curved edge on the right.
     *
     * @param  array<string, mixed>  $data
     */
    private function coverSlide(Slide $slide, array $data): void
    {
        $cover = $this->coverTexts($data['cover']);
        $this->addPicture($slide, [560, 0, 720, 720], $this->publicFile('assets/teacher-ai/cover-photo.jpg'), $cover['university']);

        $navy = ['color' => self::COVER_NAVY, 'align' => Alignment::HORIZONTAL_CENTER];
        $this->addText($slide, [40, 40, 500, 74], [$this->para($cover['university'], ['size' => 16, 'min' => 12] + $navy)]);
        // Faculty (y 122) and department (y 152) share a box: 6 pt after a 14 pt line puts the
        // department at y = 152, and a faculty name that wraps pushes it down instead of overlapping.
        $this->addText($slide, [40, 122, 500, 78], [
            $this->para($cover['faculty'], ['size' => 14, 'min' => 10, 'after' => 6] + $navy),
            $this->para($cover['department'], ['size' => 14, 'min' => 10] + $navy),
        ]);
        $this->addText($slide, [40, 236, 500, 40], [$this->para($cover['course_label'], ['size' => 26, 'min' => 18, 'lines' => 1] + $navy)]);
        $this->addText($slide, [40, 280, 500, 110], [$this->para($cover['course'], ['size' => 26, 'min' => 18, 'bold' => true] + $navy)]);
        $this->addText($slide, [40, 650, 500, 30], [$this->para($cover['city_year'], ['size' => 15, 'min' => 12, 'lines' => 1] + $navy)]);
    }

    /**
     * B) Portrait picture on the left, lecture title (bottom-anchored) and subtitle on the right.
     *
     * @param  array<string, mixed>  $data
     */
    private function lectureTitleSlide(Slide $slide, array $data): void
    {
        $this->addPicture($slide, [0, 0, 480, 720], $this->slideImage($data), $data['title']);

        $this->addText($slide, [548, 150, 640, 220], [
            $this->para($data['title'], ['size' => 24, 'min' => 18, 'bold' => true, 'color' => self::TEXT_TITLE]),
        ], Alignment::VERTICAL_BOTTOM);
        $this->addText($slide, [548, 392, 640, 150], [$this->para($data['subtitle'], ['size' => 18, 'min' => 14])]);
    }

    /**
     * C) Title, paragraphs on the left, side title + bullets on the right; either part alone takes the full width.
     *
     * @param  array<string, mixed>  $data
     */
    private function textBulletsSlide(Slide $slide, array $data): void
    {
        $this->addText($slide, [70, 120, 1060, 80], [$this->para($data['title'], self::TITLE)]);
        $paragraphs = $this->paras($data['paragraphs'], self::BODY);

        if ($data['bullets'] === []) {
            $this->addText($slide, [70, 225, 1140, 420], $paragraphs);

            return;
        }

        [$x, $width] = $paragraphs === [] ? [70, 1140] : [770, 440];
        $this->addText($slide, [70, 225, 650, 420], $paragraphs);

        $top = 225;

        if ($data['side_title'] !== '') {
            $this->addText($slide, [$x, 225, $width, 34], [$this->para($data['side_title'], self::HEADING, ['min' => 14, 'lines' => 1])]);
            $top = 268;
        }

        $this->addText($slide, [$x, $top, $width, 645 - $top], $this->paras($data['bullets'], self::BULLET, ['after' => 6]));
    }

    /**
     * D) Vertical axis with numbered boxes; items alternate left (right-aligned) and right.
     *
     * @param  array<string, mixed>  $data
     */
    private function timelineSlide(Slide $slide, array $data): void
    {
        $this->addText($slide, [70, 40, 1060, 60], [$this->para($data['title'], self::TITLE)]);

        $count = count($data['items']);
        $step = $count > 1 ? 420 / ($count - 1) : 0;
        $textHeight = $count > 1 ? min(60, $step - 34) : 60;
        $this->addLine($slide, 640, 110, 640, 140 + ($count - 1) * $step + 40, self::LINE, 2);

        $titles = [];
        $texts = [];

        foreach ($data['items'] as $i => $item) {
            $cy = 140 + $i * $step;
            $left = $i % 2 === 0;
            $align = ['align' => $left ? Alignment::HORIZONTAL_RIGHT : Alignment::HORIZONTAL_LEFT];

            $this->addShape($slide, AutoShape::TYPE_ROUNDED_RECTANGLE, [620, $cy - 20, 40, 40], self::LAVENDER, self::LAVENDER_BORDER);
            $this->addNumber($slide, [620, $cy - 20, 40, 40], (string) ($i + 1), 15, self::TEXT_BODY);
            $this->addLine($slide, $left ? 560 : 660, $cy, $left ? 620 : 720, $cy, self::LINE, 1.5);

            $titles[$i] = [[$left ? 90 : 730, $cy - 17, $left ? 460 : 480, 30], [$this->para($item['title'], self::ITEM_TITLE, $align + ['lines' => 1])]];
            $texts[$i] = [[$left ? 90 : 680, $cy + 13, $left ? 520 : 530, $textHeight], [$this->para($item['text'], self::ITEM_TEXT, $align)]];
        }

        $this->addTexts($slide, $titles);
        $bottom = 0.0;

        foreach ($this->addTexts($slide, $texts) as $i => $height) {
            $bottom = max($bottom, $texts[$i][0][1] + $height);
        }

        // The last item's text box reaches below y = 600: the footer moves down only when that text gets there.
        $footerTop = max(600, (int) ceil($bottom) + 8);
        $this->addFooter($slide, [70, $footerTop, 1140, 700 - $footerTop], $data['footer']);
    }

    /**
     * E) Optional full-width banner picture, title, two text columns (heading, text, bullets).
     *
     * @param  array<string, mixed>  $data
     */
    private function bannerColumnsSlide(Slide $slide, array $data): void
    {
        [$titleTop, $top] = $data['image'] ? [248, 325] : [110, 195];

        if ($data['image']) {
            $this->addPicture($slide, [0, 0, 1280, 215], $this->slideImage($data), $data['title']);
        }

        $this->addText($slide, [70, $titleTop, 1060, 60], [$this->para($data['title'], self::TITLE)]);

        $width = count($data['columns']) > 1 ? 540 : 1140;
        $columns = [];

        foreach ($data['columns'] as $k => $column) {
            $columns[] = [[70 + $k * 600, $top, $width, 690 - $top], $this->columnParagraphs($column, self::HEADING + ['after' => 10], self::BODY)];
        }

        $this->addTexts($slide, $columns);
    }

    /**
     * F) Grid of lavender cards with an indigo number circle, a title and a text.
     * Tall cards stack circle, title and text; short ones put the title next to a smaller circle.
     *
     * @param  array<string, mixed>  $data
     */
    private function cardsSlide(Slide $slide, array $data): void
    {
        $this->addText($slide, [70, 95, 1060, 60], [$this->para($data['title'], self::TITLE)]);

        $count = count($data['items']);
        $columns = $count === 3 ? 3 : ($count <= 4 ? 2 : 3);
        $rows = (int) ceil($count / $columns);
        $width = (1140 - 20 * ($columns - 1)) / $columns;
        $height = (($data['footer'] !== '' ? 380 : 450) - 20 * ($rows - 1)) / $rows;

        // [circle inset, circle size, number pt, title x, title y, text x, text y, text bottom margin]
        [$inset, $circle, $number, $titleX, $titleY, $textX, $textY, $margin] = $height >= 170
            ? [20, 48, 18, 20, 82, 20, 116, 12]
            : [18, 34, 14, 64, 20, 18, 62, 10];

        $corners = [];
        $titles = [];

        foreach ($data['items'] as $i => $item) {
            [$x, $y] = $corners[$i] = [70 + ($i % $columns) * ($width + 20), 180 + intdiv($i, $columns) * ($height + 20)];

            $this->addShape($slide, AutoShape::TYPE_ROUNDED_RECTANGLE, [$x, $y, $width, $height], self::LAVENDER, self::LAVENDER_BORDER);
            $this->addCircle($slide, [$x + $inset, $y + $inset, $circle, $circle], (string) ($i + 1), $number);
            $titles[$i] = [[$x + $titleX, $y + $titleY, $width - $titleX - 20, 52], [$this->para($item['title'], self::ITEM_TITLE, ['lines' => 2])]];
        }

        $texts = [];

        // A title that wraps to a second line pushes its text down.
        foreach ($this->addTexts($slide, $titles) as $i => $used) {
            [$x, $y] = $corners[$i];
            $top = max($y + $textY, $y + $titleY + $used + 8);
            $texts[$i] = [[$x + $textX, $top, $width - 2 * $textX, $y + $height - $margin - $top], [$this->para($data['items'][$i]['text'], self::ITEM_TEXT)]];
        }

        $this->addTexts($slide, $texts);
        $this->addFooter($slide, [70, 580, 1140, 110], $data['footer']);
    }

    /**
     * G) Portrait picture on one side; title and paragraphs + bullets (or two sub-columns) on the other.
     *
     * @param  array<string, mixed>  $data
     */
    private function imageTextSlide(Slide $slide, array $data): void
    {
        $left = $data['image_side'] === 'left';
        $this->addPicture($slide, $left ? [0, 0, 480, 720] : [800, 0, 480, 720], $this->slideImage($data), $data['title']);

        // With the picture on the left the title box would reach under the emblem (x ≥ 1160): it stops at 1150.
        [$x, $width, $titleWidth] = $left ? [540, 670, 610] : [70, 680, 680];
        $this->addText($slide, [$x, 110, $titleWidth, 80], [$this->para($data['title'], self::TITLE)]);

        if (count($data['columns']) === 2) {
            $columnWidth = ($width - 30) / 2;
            $body = ['size' => 15, 'min' => 11] + self::BODY;
            $columns = [];

            foreach ($data['columns'] as $k => $column) {
                $columns[] = [[$x + $k * ($columnWidth + 30), 210, $columnWidth, 450], $this->columnParagraphs($column, self::HEADING + ['after' => 8], $body)];
            }

            $this->addTexts($slide, $columns);

            return;
        }

        $paragraphs = $this->paras($data['paragraphs'], self::BODY);

        foreach ($data['columns'] as $column) {
            $paragraphs = array_merge($paragraphs, $this->columnParagraphs($column, self::HEADING + ['after' => 8], self::BODY));
        }

        $this->addText($slide, [$x, 210, $width, 450], array_merge($paragraphs, $this->paras($data['bullets'], self::BULLET)));
    }

    /**
     * H) Explanation on the left, horizontal bar chart (bars grouped by category) on the right.
     *
     * @param  array<string, mixed>  $data
     */
    private function chartSlide(Slide $slide, array $data): void
    {
        $this->addText($slide, [110, 30, 1000, 50], [$this->para($data['title'], self::TITLE_COMPACT, ['align' => Alignment::HORIZONTAL_CENTER])]);
        $this->addText($slide, [40, 120, 390, 440], [$this->para($data['text'], self::BODY)]);

        [$x0, $x1, $top, $bottom] = [640, 1190, 100, 560];
        $max = $this->niceMax($data['series']);

        foreach ([0.25, 0.5, 0.75, 1.0] as $share) {
            $this->addLine($slide, $x0 + $share * ($x1 - $x0), $top, $x0 + $share * ($x1 - $x0), $bottom, self::GRID, 1);
        }

        $groupHeight = ($bottom - $top) / count($data['categories']);
        $seriesCount = count($data['series']);
        $barHeight = min(30, ($groupHeight - 18) / $seriesCount);
        $barsTop = ($groupHeight - $seriesCount * $barHeight - ($seriesCount - 1) * 4) / 2;
        $labels = [];

        foreach ($data['categories'] as $k => $category) {
            $groupTop = $top + $k * $groupHeight;
            $labels[] = [[470, $groupTop, 160, $groupHeight], [$this->para($category, ['size' => 14, 'min' => 10, 'align' => Alignment::HORIZONTAL_RIGHT])]];

            foreach ($data['series'] as $j => $series) {
                $y = $groupTop + $barsTop + $j * ($barHeight + 4);
                $length = $series['values'][$k] / $max * ($x1 - $x0);

                if ($length >= 0.5) {
                    $this->addShape($slide, AutoShape::TYPE_RECTANGLE, [$x0, $y, $length, $barHeight], self::CHART_SERIES[$j]);
                }

                $this->addBarValue($slide, $this->number($series['values'][$k]), [$x0, $y, $length, $barHeight], $j);
            }
        }

        $this->addTexts($slide, $labels, Alignment::VERTICAL_CENTER);
        $this->addLine($slide, $x0, $top, $x0, $bottom, self::TEXT_BODY, 1.5);
        $this->addLine($slide, $x0, $bottom, $x1, $bottom, self::TEXT_BODY, 1.5);

        foreach ([0, 0.25, 0.5, 0.75, 1.0] as $share) {
            $this->addText($slide, [$x0 + $share * ($x1 - $x0) - 40, 566, 80, 22], [
                $this->para($this->number($max * $share), ['size' => 13, 'min' => 10, 'color' => self::TEXT_MUTED, 'align' => Alignment::HORIZONTAL_CENTER, 'lines' => 1]),
            ]);
        }

        $this->chartLegend($slide, $data['series'], $data['unit']);
    }

    /**
     * Value label right of the bar end; inside the bar end when it would run into the emblem.
     *
     * @param  array{0: float, 1: float, 2: float, 3: float}  $bar
     */
    private function addBarValue(Slide $slide, string $value, array $bar, int $series): void
    {
        [$x, $y, $length, $height] = $bar;
        $width = $this->labelWidth($value, 12);
        $box = [$x + $length + 6, $y + $height / 2 - 11, $width, 22];
        $style = ['size' => 12, 'min' => 9, 'lines' => 1];

        if ($this->hitsLogo($box) && $length > $width + 12) {
            $box[0] = $x + $length - 6 - $width;
            $style += ['align' => Alignment::HORIZONTAL_RIGHT, 'color' => $series === 2 ? self::TEXT_TITLE : self::WHITE];
        }

        $this->addText($slide, $box, [$this->para($value, $style)], Alignment::VERTICAL_CENTER);
    }

    /**
     * Legend row (470, 612, 740, 30): colour square + name per series, then the unit in parentheses.
     *
     * @param  list<array{name: string, values: list<float>}>  $series
     */
    private function chartLegend(Slide $slide, array $series, string $unit): void
    {
        $entries = [];

        foreach ($series as $j => $one) {
            if ($one['name'] !== '') {
                $entries[] = ['text' => $one['name'], 'color' => self::CHART_SERIES[$j]];
            }
        }

        if ($unit !== '') {
            $entries[] = ['text' => '('.$unit.')', 'color' => null];
        }

        // Largest size from 15 pt down at which the whole row fits its 740 px.
        for ($size = 15; $size > 11; $size--) {
            $width = -24.0;

            foreach ($entries as $entry) {
                $width += ($entry['color'] !== null ? 20 : 0) + $this->labelWidth($entry['text'], $size) + 24;
            }

            if ($width <= 740) {
                break;
            }
        }

        $x = 470.0;

        foreach ($entries as $entry) {
            if ($entry['color'] !== null) {
                $this->addShape($slide, AutoShape::TYPE_RECTANGLE, [$x, 620, 14, 14], $entry['color']);
                $x += 20;
            }

            $width = min($this->labelWidth($entry['text'], $size), max(40, 1210 - $x));
            $this->addText($slide, [$x, 612, $width, 30], [$this->para($entry['text'], ['size' => $size, 'min' => 9, 'lines' => 1])], Alignment::VERTICAL_CENTER);
            $x += $width + 24;
        }
    }

    /**
     * Box width (px) a one-line label needs at the given size, with a little slack.
     */
    private function labelWidth(string $text, int $size): float
    {
        $em = -self::SPACE_EM;

        foreach (explode(' ', $text) as $word) {
            $em += $this->wordWidth($word, false) + self::SPACE_EM;
        }

        return $em * $size * 4 / 3 + 6;
    }

    /**
     * I) Lavender triangle split into numbered bands, labels to the right, detail columns below.
     *
     * @param  array<string, mixed>  $data
     */
    private function pyramidSlide(Slide $slide, array $data): void
    {
        $this->addText($slide, [70, 95, 1060, 60], [$this->para($data['title'], self::TITLE)]);
        $this->addShape($slide, AutoShape::TYPE_ISOSCELES_TRIANGLE, [75, 165, 560, 305], self::LAVENDER);

        $count = count($data['items']);
        $band = 305 / $count;
        // Half width of the triangle at height y (apex (355, 165), 560 px base at y = 470).
        $halfWidth = static fn (float $y): float => 280 * ($y - 165) / 305;
        $titles = [];
        $texts = [];

        foreach ($data['items'] as $k => $item) {
            $top = 165 + $k * $band;

            if ($k > 0) {
                $this->addLine($slide, 355 - $halfWidth($top), $top, 355 + $halfWidth($top), $top, self::WHITE, 3);
            }

            // The tip is narrow: the first number sits at 60 % of its band.
            $numberY = $top + $band * ($k === 0 ? 0.6 : 0.5);
            $this->addNumber($slide, [325, $numberY - 15, 60, 30], (string) ($k + 1), 18, self::TEXT_BODY);

            $labelX = 355 + $halfWidth($top + $band / 2) + 40;
            $titles[] = [[$labelX, $top + 10, 1210 - $labelX, 26], [$this->para($item['title'], self::ITEM_TITLE, ['lines' => 1])]];
            $texts[] = [[$labelX, $top + 38, 1210 - $labelX, $band - 44], [$this->para($item['text'], self::ITEM_TEXT)]];

            if ($k < $count - 1) {
                $this->addLine($slide, $labelX, $top + $band, 1210, $top + $band, self::LINE, 1);
            }
        }

        $this->addTexts($slide, $titles);
        $this->addTexts($slide, $texts);

        $columnWidth = (1140 - 30 * ($count - 1)) / $count;
        $details = [];

        foreach ($data['items'] as $k => $item) {
            if ($item['detail'] !== '') {
                $details[] = [[70 + $k * ($columnWidth + 30), 495, $columnWidth, 195], [
                    $this->para($item['title'], ['size' => 15, 'min' => 12, 'bold' => true, 'color' => self::TEXT_ITEM, 'after' => 6]),
                    $this->para($item['detail'], self::ITEM_TEXT),
                ]];
            }
        }

        $this->addTexts($slide, $details);
    }

    /**
     * J) Up to two concepts under arrow shapes, then a row of (three) big numbers.
     *
     * @param  array<string, mixed>  $data
     */
    private function statsSlide(Slide $slide, array $data): void
    {
        $this->addText($slide, [70, 120, 1060, 60], [$this->para($data['title'], self::TITLE)]);

        $titles = [];
        $texts = [];

        if ($data['items'] !== []) {
            $this->addShape($slide, AutoShape::TYPE_PENTAGON, [70, 200, 575, 70], self::LAVENDER);
            $this->addShape($slide, AutoShape::TYPE_CHEVRON, [630, 200, 580, 70], self::LAVENDER);
        }

        foreach ($data['items'] as $k => $concept) {
            [$x, $width] = $k === 0 ? [90, 520] : [660, 530];
            $titles[] = [[$x, 290, $width, 30], [$this->para($concept['title'], self::HEADING, ['lines' => 1])]];
            $texts[] = [[$x, 322, $width, 80], [$this->para($concept['text'], ['size' => 15, 'min' => 11])]];
        }

        $this->addTexts($slide, $titles);
        $this->addTexts($slide, $texts);

        $top = $data['items'] !== [] ? 440 : 240;
        $count = count($data['stats']);
        $center = ['align' => Alignment::HORIZONTAL_CENTER];
        $rows = [[], [], []];

        foreach ($data['stats'] as $k => $stat) {
            $x = 640 + ($k - ($count - 1) / 2) * 380 - 170;
            $rows[0][] = [[$x, $top, 340, 44], [$this->para($stat['value'], ['size' => 26, 'min' => 18, 'bold' => true, 'color' => self::TEXT_TITLE, 'lines' => 1] + $center)]];
            $rows[1][] = [[$x, $top + 52, 340, 30], [$this->para($stat['label'], self::HEADING, ['lines' => 1] + $center)]];
            $rows[2][] = [[$x, $top + 88, 340, 70], [$this->para($stat['text'], self::ITEM_TEXT, $center)]];
        }

        foreach ($rows as $row) {
            $this->addTexts($slide, $row);
        }
    }

    /**
     * K) Numbered steps in two columns: "01" label, indigo rule, title, text.
     *
     * @param  array<string, mixed>  $data
     */
    private function stepsSlide(Slide $slide, array $data): void
    {
        // Centred on the canvas like the spec's (70, 110, 1140, 50), but narrow enough to stay clear of the emblem.
        $this->addText($slide, [132, 110, 1016, 50], [$this->para($data['title'], self::TITLE_COMPACT, ['align' => Alignment::HORIZONTAL_CENTER])]);

        $rows = (int) ceil(count($data['items']) / 2);
        $rowHeight = (($data['footer'] !== '' ? 540 : 650) - 190) / $rows;
        $titles = [];
        $texts = [];

        foreach ($data['items'] as $i => $item) {
            $x = $i % 2 === 0 ? 70 : 650;
            $y = 190 + intdiv($i, 2) * $rowHeight;

            $this->addText($slide, [$x, $y, 100, 26], [$this->para(sprintf('%02d', $i + 1), ['size' => 15])]);
            $this->addLine($slide, $x, $y + 30, $x + 560, $y + 30, self::INDIGO, 3);
            $titles[] = [[$x, $y + 40, 560, 28], [$this->para($item['title'], self::ITEM_TITLE, ['lines' => 1])]];
            $texts[] = [[$x, $y + 72, 560, $rowHeight - 80], [$this->para($item['text'], self::ITEM_TEXT)]];
        }

        $this->addTexts($slide, $titles);
        $this->addTexts($slide, $texts);
        $this->addFooter($slide, [70, 560, 1140, 110], $data['footer']);
    }

    /**
     * L) Staircase of levels, each with a lavender down arrow, a title and a text.
     *
     * @param  array<string, mixed>  $data
     */
    private function hierarchySlide(Slide $slide, array $data): void
    {
        // Centred like the spec's (70, 40, 1140, 50) box, narrow enough to stay clear of the emblem.
        $this->addText($slide, [132, 40, 1016, 50], [$this->para($data['title'], self::TITLE_COMPACT, ['align' => Alignment::HORIZONTAL_CENTER])]);

        $step = 510 / count($data['items']);
        $titles = [];
        $texts = [];

        foreach ($data['items'] as $i => $item) {
            $y = 110 + $i * $step;
            $dx = $i * 24;

            $this->addShape($slide, AutoShape::TYPE_DOWN_ARROW, [70 + $dx, $y + 4, 44, $step - 12], self::LAVENDER);
            $titles[] = [[130 + $dx, $y + 6, 1080 - $dx, 28], [$this->para($item['title'], self::ITEM_TITLE, ['lines' => 1])]];
            $texts[] = [[130 + $dx, $y + 36, 1080 - $dx, $step - 42], [$this->para($item['text'], self::ITEM_TEXT)]];
        }

        $this->addTexts($slide, $titles);
        $this->addTexts($slide, $texts);
        $this->addFooter($slide, [70, 632, 1140, 70], $data['footer']);
    }

    /**
     * M) Two columns of white cards with an indigo accent bar on the left.
     *
     * @param  array<string, mixed>  $data
     */
    private function conclusionSlide(Slide $slide, array $data): void
    {
        $this->addText($slide, [70, 62, 1060, 50], [$this->para($data['title'], self::TITLE_COMPACT)]);

        $rows = (int) ceil(count($data['items']) / 2);
        $height = (($data['footer'] !== '' ? 590 : 690) - 130 - 16 * ($rows - 1)) / $rows;
        $titles = [];
        $texts = [];

        foreach ($data['items'] as $i => $item) {
            $x = $i % 2 === 0 ? 70 : 650;
            $y = 130 + intdiv($i, 2) * ($height + 16);

            // Outline widths are whole pixels in PhpPresentation: 2 px stands in for 1.5 px.
            $this->addShape($slide, AutoShape::TYPE_ROUNDED_RECTANGLE, [$x, $y, 560, $height], self::WHITE, self::LAVENDER_BORDER, 2);
            // A pill 3 px shorter at both ends stays inside the card's rounded corners.
            $this->addShape($slide, AutoShape::TYPE_ROUNDED_RECTANGLE, [$x, $y + 3, 7, $height - 6], self::INDIGO);
            $titles[] = [[$x + 24, $y + 14, 520, 28], [$this->para($item['title'], self::ITEM_TITLE, ['lines' => 1])]];
            $texts[] = [[$x + 24, $y + 46, 520, $height - 56], [$this->para($item['text'], self::ITEM_TEXT)]];
        }

        $this->addTexts($slide, $titles);
        $this->addTexts($slide, $texts);
        $this->addFooter($slide, [70, 602, 1140, 100], $data['footer']);
    }

    // ------------------------------------------------------------ text boxes

    /**
     * One paragraph spec: text + overrides + style on top of the defaults.
     *
     * @param  array<string, mixed>  $style
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function para(string $text, array $style, array $overrides = []): array
    {
        return ['text' => $text] + $overrides + $style + self::PARAGRAPH;
    }

    /**
     * @param  list<string>  $texts
     * @param  array<string, mixed>  $style
     * @param  array<string, mixed>  $overrides
     * @return list<array<string, mixed>>
     */
    private function paras(array $texts, array $style, array $overrides = []): array
    {
        return array_map(fn (string $text): array => $this->para($text, $style, $overrides), $texts);
    }

    /**
     * Heading, text paragraph(s) and bullets of one column.
     *
     * @param  array{title: string, text: string, bullets: list<string>}  $column
     * @param  array<string, mixed>  $heading
     * @param  array<string, mixed>  $body
     * @return list<array<string, mixed>>
     */
    private function columnParagraphs(array $column, array $heading, array $body): array
    {
        return array_merge(
            [$this->para($column['title'], $heading)],
            $this->paras($this->lines($column['text']), $body),
            $this->paras($column['bullets'], ['bullet' => true] + $body),
        );
    }

    /**
     * Draws sibling text boxes (the titles of all cards, the texts of all
     * steps, …) with one common shrink step, so parallel items keep the same
     * size. Returns the estimated text heights, keyed like the entries.
     *
     * @param  array<int, array{0: array{0: int|float, 1: int|float, 2: int|float, 3: int|float}, 1: list<array<string, mixed>>}>  $entries  [box, paragraphs] pairs
     * @return array<int, float>
     */
    private function addTexts(Slide $slide, array $entries, string $anchor = Alignment::VERTICAL_TOP): array
    {
        $shrink = 0;

        foreach ($entries as [$box, $paragraphs]) {
            $paragraphs = $this->prepared($paragraphs);

            if ($paragraphs !== []) {
                [, , $width, $height] = $this->px($box);
                $shrink = max($shrink, $this->shrinkFor($paragraphs, $width, $height));
            }
        }

        return array_map(fn (array $entry): float => $this->addText($slide, $entry[0], $entry[1], $anchor, $shrink), $entries);
    }

    /**
     * Fits the paragraphs into the box (shrinking at least `$shrink` steps) and
     * draws them as one text box with zero insets. Returns the estimated
     * height (px) the text takes.
     *
     * @param  array{0: int|float, 1: int|float, 2: int|float, 3: int|float}  $box
     * @param  list<array<string, mixed>>  $paragraphs
     */
    private function addText(Slide $slide, array $box, array $paragraphs, string $anchor = Alignment::VERTICAL_TOP, int $shrink = 0): float
    {
        $paragraphs = $this->prepared($paragraphs);

        if ($paragraphs === []) {
            return 0.0;
        }

        [$x, $y, $width, $height] = $this->px($box);
        $paragraphs = $this->shrunk($paragraphs, max($shrink, $this->shrinkFor($paragraphs, $width, $height)));

        if (! $this->fits($paragraphs, $width, $height)) {
            $paragraphs = $this->truncated($paragraphs, $width, $height);
        }

        $shape = $slide->createRichTextShape();
        $shape->setOffsetX($x)->setOffsetY($y)->setWidthAndHeight($width, $height);
        $shape->setInsetTop(0)->setInsetBottom(0)->setInsetLeft(0)->setInsetRight(0);
        $shape->setWrap(RichText::WRAP_SQUARE)->setAutoFit(RichText::AUTOFIT_NOAUTOFIT);

        foreach ($paragraphs as $i => $paragraph) {
            $this->writeParagraph($shape, $paragraph, $anchor, $i === 0);
        }

        return $this->textHeight($paragraphs, $width);
    }

    /**
     * Drops empty paragraphs; the last one gets no space after (it would
     * only push bottom-anchored text up).
     *
     * @param  list<array<string, mixed>>  $paragraphs
     * @return list<array<string, mixed>>
     */
    private function prepared(array $paragraphs): array
    {
        $paragraphs = array_values(array_filter($paragraphs, static fn (array $p): bool => $p['text'] !== ''));

        if ($paragraphs !== []) {
            $paragraphs[array_key_last($paragraphs)]['after'] = 0;
        }

        return $paragraphs;
    }

    /**
     * @param  array<string, mixed>  $p
     */
    private function writeParagraph(RichText $shape, array $p, string $anchor, bool $first): void
    {
        // The first paragraph of a shape already exists; later ones start as a copy of the previous one.
        $paragraph = $first ? $shape->getActiveParagraph() : $shape->createParagraph();
        $paragraph->setLineSpacing((int) round($p['spacing'] * 100))->setSpacingAfter($p['after']);

        $indent = $p['bullet'] ? $this->bulletIndent($p['size']) : 0;
        $paragraph->getAlignment()
            ->setHorizontal($p['align'])
            ->setVertical($anchor)
            ->setMarginLeft($indent)
            ->setIndent(-$indent);

        $bullet = $paragraph->getBulletStyle();
        $bullet->setBulletType($p['bullet'] ? Bullet::TYPE_BULLET : Bullet::TYPE_NONE);

        if ($p['bullet']) {
            $bullet->setBulletFont(self::FONT)->setBulletChar('•')->setBulletColor(new Color($p['color']));
        }

        $run = $paragraph->createTextRun($this->xmlSafe($p['text']));
        $run->setLanguage($this->language);
        $run->getFont()
            ->setName(self::FONT)
            ->setSize($p['size'])
            ->setBold($p['bold'])
            ->setColor(new Color($p['color']));
    }

    /**
     * Hanging indent (px) of a bulleted paragraph: about one em.
     */
    private function bulletIndent(int $size): int
    {
        return (int) round($size * 1.25);
    }

    /**
     * @param  array{0: int|float, 1: int|float, 2: int|float, 3: int|float}  $box
     */
    private function addFooter(Slide $slide, array $box, string $text): void
    {
        $this->addText($slide, $box, [$this->para($text, self::FOOTER)]);
    }

    /**
     * Number centred in a filled indigo circle.
     *
     * @param  array{0: int|float, 1: int|float, 2: int|float, 3: int|float}  $box
     */
    private function addCircle(Slide $slide, array $box, string $number, int $size): void
    {
        $this->addShape($slide, AutoShape::TYPE_OVAL, $box, self::INDIGO);
        $this->addNumber($slide, $box, $number, $size, self::WHITE);
    }

    /**
     * Bold number centred (both ways) in the box.
     *
     * @param  array{0: int|float, 1: int|float, 2: int|float, 3: int|float}  $box
     */
    private function addNumber(Slide $slide, array $box, string $number, int $size, string $color): void
    {
        $this->addText($slide, $box, [
            $this->para($number, ['size' => $size, 'min' => $size - 4, 'bold' => true, 'color' => $color, 'align' => Alignment::HORIZONTAL_CENTER]),
        ], Alignment::VERTICAL_CENTER);
    }

    /**
     * @param  array{0: int|float, 1: int|float, 2: int|float, 3: int|float}  $box
     */
    private function hitsLogo(array $box): bool
    {
        [$x, $y, $width, $height] = $box;
        [$logoX, $logoY, $logoWidth, $logoHeight] = self::LOGO_BOX;

        return $x < $logoX + $logoWidth + 6 && $x + $width > $logoX - 6
            && $y < $logoY + $logoHeight + 6 && $y + $height > $logoY - 6;
    }

    // ----------------------------------------------------------- text fitting

    /**
     * Deterministic overflow protection, part 1: the number of 1-pt steps all
     * paragraphs shrink together (each down to its own minimum) until the
     * estimated height fits the box and no line limit is exceeded. When even
     * the minimum sizes do not fit, the last step is returned and
     * truncated() cuts the text.
     *
     * @param  list<array<string, mixed>>  $paragraphs
     */
    private function shrinkFor(array $paragraphs, float $width, float $height): int
    {
        for ($shrink = 0; ; $shrink++) {
            $sized = $this->shrunk($paragraphs, $shrink);

            if ($this->fits($sized, $width, $height) || $this->shrunk($paragraphs, $shrink + 1) === $sized) {
                return $shrink;
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $paragraphs
     * @return list<array<string, mixed>>
     */
    private function shrunk(array $paragraphs, int $shrink): array
    {
        return array_map(static function (array $p) use ($shrink): array {
            $size = max($p['min'], $p['size'] - $shrink);

            return ['size' => $size, 'after' => (int) round($p['after'] * $size / $p['size'])] + $p;
        }, $paragraphs);
    }

    /**
     * @param  list<array<string, mixed>>  $paragraphs
     */
    private function fits(array $paragraphs, float $width, float $height): bool
    {
        return $this->textHeight($paragraphs, $width) <= $height + self::FIT_TOLERANCE;
    }

    /**
     * Part 2: drops words from the end (and then whole trailing paragraphs)
     * until the text fits, marking the cut with "…".
     *
     * @param  list<array<string, mixed>>  $paragraphs
     * @return list<array<string, mixed>>
     */
    private function truncated(array $paragraphs, float $width, float $height): array
    {
        while (! $this->fits($paragraphs, $width, $height)) {
            $last = array_key_last($paragraphs);
            $words = explode(' ', $this->withoutEllipsis($paragraphs[$last]['text']));

            if (count($words) > 1) {
                array_pop($words);
                $paragraphs[$last]['text'] = $this->withEllipsis(implode(' ', $words));
            } elseif ($last > 0) {
                array_pop($paragraphs);
                $paragraphs[$last - 1]['text'] = $this->withEllipsis($this->withoutEllipsis($paragraphs[$last - 1]['text']));
                $paragraphs[$last - 1]['after'] = 0;
            } else {
                break;
            }
        }

        return $paragraphs;
    }

    private function withEllipsis(string $text): string
    {
        return (preg_replace('/[\s,.;:–—-]+$/u', '', $text) ?? $text).'…';
    }

    private function withoutEllipsis(string $text): string
    {
        return preg_replace('/…$/u', '', $text) ?? $text;
    }

    /**
     * Estimated height (px) of the paragraphs in a box of the given width;
     * INF when a paragraph exceeds its line limit.
     *
     * @param  list<array<string, mixed>>  $paragraphs
     */
    private function textHeight(array $paragraphs, float $width): float
    {
        $points = 0.0;

        foreach ($paragraphs as $p) {
            $indent = $p['bullet'] ? $this->bulletIndent($p['size']) : 0;
            $lines = $this->lineCount($p['text'], $p['size'], $p['bold'], $width - $indent);

            if ($p['lines'] > 0 && $lines > $p['lines']) {
                return INF;
            }

            $points += $lines * $p['size'] * self::LINE_HEIGHT * $p['spacing'] + $p['after'];
        }

        return $points * 4 / 3;
    }

    /**
     * Greedy word wrap with estimated glyph widths; a word longer than the
     * line is broken across lines, as PowerPoint does.
     */
    private function lineCount(string $text, int $size, bool $bold, float $width): int
    {
        $limit = $width * 0.75 / $size;   // line width in em (1 px = 0.75 pt)

        if ($limit < 1) {
            return 1000;
        }

        $lines = 1;
        $used = 0.0;

        foreach (explode(' ', $text) as $word) {
            if ($word === '') {
                continue;
            }

            $em = $this->wordWidth($word, $bold);

            if ($used > 0 && $used + self::SPACE_EM + $em <= $limit) {
                $used += self::SPACE_EM + $em;

                continue;
            }

            $extra = max(0, (int) ceil($em / $limit) - 1);
            $lines += ($used > 0 ? 1 : 0) + $extra;
            $used = $em - $extra * $limit;
        }

        return $lines;
    }

    private function wordWidth(string $word, bool $bold): float
    {
        $key = ($bold ? 'b' : 'r').$word;

        if (! isset($this->wordWidths[$key])) {
            $em = 0.0;

            foreach (mb_str_split($word) as $char) {
                $em += $this->glyphWidth($char);
            }

            $this->wordWidths[$key] = $em * ($bold ? self::BOLD_FACTOR : 1.0);
        }

        return $this->wordWidths[$key];
    }

    private function glyphWidth(string $char): float
    {
        return match (true) {
            str_contains(self::GLYPHS_NARROW, $char) => 0.31,
            str_contains(self::GLYPHS_EXTRA_WIDE, $char) => 0.95,
            str_contains(self::GLYPHS_WIDE, $char) => 0.71,
            preg_match('/^\p{Lu}$/u', $char) === 1 => 0.70,
            default => 0.49,
        };
    }

    // ------------------------------------------------------ shapes & images

    /**
     * Preset shape (rect, roundRect, ellipse, triangle, …) with an optional fill and outline.
     *
     * @param  array{0: int|float, 1: int|float, 2: int|float, 3: int|float}  $box
     */
    private function addShape(Slide $slide, string $type, array $box, ?string $fill, ?string $border = null, int $borderWidth = 1): AutoShape
    {
        [$x, $y, $width, $height] = $this->px($box);

        $shape = $slide->createAutoShape();
        $shape->setType($type);
        $shape->setOffsetX($x)->setOffsetY($y)->setWidthAndHeight($width, $height);
        $this->paint($shape->getFill(), $fill);
        $this->paint($shape->getOutline()->setWidth($borderWidth)->getFill(), $border);

        return $shape;
    }

    private function paint(?Fill $fill, ?string $argb): void
    {
        if ($fill === null) {
            return;
        }

        if ($argb === null) {
            $fill->setFillType(Fill::FILL_NONE);

            return;
        }

        $fill->setFillType(Fill::FILL_SOLID)->setStartColor(new Color($argb))->setEndColor(new Color($argb));
    }

    private function addLine(Slide $slide, float $x1, float $y1, float $x2, float $y2, string $argb, float $width): void
    {
        $line = $slide->createLineShape((int) round($x1), (int) round($y1), (int) round($x2), (int) round($y2));
        $line->getBorder()->setLineWidth($width)->setColor(new Color($argb));
    }

    /**
     * Picture "cover"-fitted into the box (centred crop, never distorted); a
     * missing or unreadable picture becomes the indigo placeholder gradient.
     *
     * @param  array{0: int|float, 1: int|float, 2: int|float, 3: int|float}  $box
     */
    private function addPicture(Slide $slide, array $box, ?string $source, string $description): void
    {
        [, , $width, $height] = $this->px($box);
        $file = $source !== null ? $this->fittedImage($source, $width, $height) : null;

        if ($file !== null) {
            $this->addDrawing($slide, $box, $file, 'Picture', $description !== '' ? $description : $this->title);

            return;
        }

        $this->addShape($slide, AutoShape::TYPE_RECTANGLE, $box, null)->getFill()
            ->setFillType(Fill::FILL_GRADIENT_LINEAR)
            ->setRotation(45)
            ->setStartColor(new Color(self::PLACEHOLDER_FROM))
            ->setEndColor(new Color(self::PLACEHOLDER_TO));
    }

    /**
     * The emblem, embedded untouched (transparent PNG). It repeats on every
     * slide; dedupeMedia() keeps a single copy in the package.
     */
    private function addLogo(Slide $slide): void
    {
        $logo = $this->publicFile('assets/images/logo.png');

        if ($logo !== null) {
            $this->addDrawing($slide, self::LOGO_BOX, $logo, 'Logo', $this->label('university'));
        }
    }

    /**
     * Picture shape; the description is its alt text.
     *
     * @param  array{0: int|float, 1: int|float, 2: int|float, 3: int|float}  $box
     */
    private function addDrawing(Slide $slide, array $box, string $file, string $name, string $description): void
    {
        [$x, $y, $width, $height] = $this->px($box);

        $drawing = $slide->createDrawingShape();
        $drawing->setName($name)->setDescription($description);
        $drawing->setPath($file)->setResizeProportional(false);
        $drawing->setOffsetX($x)->setOffsetY($y);
        $drawing->setWidth($width)->setHeight($height);
    }

    /**
     * Path of a JPEG/PNG with the box's aspect ratio: the source itself when it
     * already fits, otherwise a centred crop (at most 2x the box size) in a
     * temp JPEG. Null when the file is not a readable image.
     */
    private function fittedImage(string $source, int $width, int $height): ?string
    {
        $info = is_file($source) ? @getimagesize($source) : false;

        if ($info === false || $info[0] < 1 || $info[1] < 1) {
            return null;
        }

        [$sourceWidth, $sourceHeight, $type] = $info;
        $extension = strtolower(pathinfo($source, PATHINFO_EXTENSION));
        $embeddable = ($type === IMAGETYPE_JPEG && in_array($extension, ['jpg', 'jpeg'], true))
            || ($type === IMAGETYPE_PNG && $extension === 'png');
        $sameShape = abs($sourceWidth * $height - $sourceHeight * $width) <= 0.01 * $sourceHeight * $width;

        if ($embeddable && $sameShape && $sourceWidth <= 2.25 * $width) {
            return $source;
        }

        return $this->croppedCopy($source, $sourceWidth, $sourceHeight, $width, $height);
    }

    private function croppedCopy(string $source, int $sourceWidth, int $sourceHeight, int $width, int $height): ?string
    {
        $contents = function_exists('imagecreatefromstring') ? @file_get_contents($source) : false;
        $image = $contents === false ? false : @imagecreatefromstring($contents);

        if ($image === false) {
            return null;
        }

        // Largest centred region with the box's aspect ratio, scaled to at most 2x the box.
        $cropWidth = min($sourceWidth, (int) round($sourceHeight * $width / $height));
        $cropHeight = min($sourceHeight, (int) round($sourceWidth * $height / $width));
        $scale = min(1.0, 2 * $width / $cropWidth);
        $outWidth = max(1, (int) round($cropWidth * $scale));
        $outHeight = max(1, (int) round($cropHeight * $scale));

        $canvas = imagecreatetruecolor($outWidth, $outHeight);
        imagefill($canvas, 0, 0, (int) imagecolorallocate($canvas, 255, 255, 255));
        imagecopyresampled(
            $canvas, $image, 0, 0,
            intdiv($sourceWidth - $cropWidth, 2), intdiv($sourceHeight - $cropHeight, 2),
            $outWidth, $outHeight, $cropWidth, $cropHeight,
        );

        $path = $this->tempFile('jpg');
        $this->tempFiles[] = $path;

        return imagejpeg($canvas, $path, 85) ? $path : null;
    }

    /**
     * Ready image of the slide's slot, or null (the slot shows the placeholder).
     *
     * @param  array<string, mixed>  $data
     */
    private function slideImage(array $data): ?string
    {
        return $this->lesson?->imagePath($data['index']);
    }

    private function publicFile(string $relative): ?string
    {
        $path = public_path($relative);

        return is_file($path) ? $path : null;
    }

    private function addNotes(Slide $slide, string $notes): void
    {
        $paragraphs = $this->lines($notes);

        if ($paragraphs === []) {
            return;
        }

        $shape = $slide->getNote()->createRichTextShape();
        $shape->setOffsetX(60)->setOffsetY(400)->setWidthAndHeight(600, 480);

        foreach ($paragraphs as $i => $text) {
            $this->writeParagraph($shape, $this->para($text, ['size' => 12, 'color' => 'FF000000', 'after' => 6]), Alignment::VERTICAL_TOP, $i === 0);
        }
    }

    // ------------------------------------------------------------- the file

    /**
     * @throws TeacherAiException
     */
    private function save(PhpPresentation $deck): string
    {
        $path = $this->tempFile('pptx');

        try {
            IOFactory::createWriter($deck, 'PowerPoint2007')->save($path);
            $this->polish($path);
        } catch (Throwable $e) {
            @unlink($path);

            throw new TeacherAiException('Не удалось подготовить файл презентации. Попробуйте ещё раз.', 0, $e);
        }

        return $path;
    }

    /**
     * Post-processes the written package: small corner radius on rounded
     * rectangles, one copy of identical pictures (the logo is on every slide).
     */
    private function polish(string $path): void
    {
        $zip = new ZipArchive;

        if ($zip->open($path) !== true) {
            throw new TeacherAiException('Не удалось подготовить файл презентации. Попробуйте ещё раз.');
        }

        try {
            $this->roundCorners($zip);
            $this->dedupeMedia($zip);
        } finally {
            $zip->close();
        }
    }

    /**
     * PhpPresentation writes roundRect with an empty adjust list, i.e. the
     * default radius of 16.7 % of the short side (28 px on a 170 px card).
     * Sets the radius to CORNER_RADIUS instead: adj = radius / short side.
     */
    private function roundCorners(ZipArchive $zip): void
    {
        $pattern = '#(<a:ext cx="(\d+)" cy="(\d+)"/>\s*</a:xfrm>\s*<a:prstGeom prst="roundRect">\s*)<a:avLst/>#';

        foreach ($this->entries($zip, '#^ppt/slides/slide\d+\.xml$#') as $name) {
            $xml = (string) $zip->getFromName($name);
            $rounded = preg_replace_callback($pattern, static function (array $m): string {
                $short = max(1, min((int) $m[2], (int) $m[3]));
                $adjust = min(50000, (int) round(self::CORNER_RADIUS * 9525 / $short * 100000));

                return $m[1].'<a:avLst><a:gd name="adj" fmla="val '.$adjust.'"/></a:avLst>';
            }, $xml);

            if (is_string($rounded) && $rounded !== $xml && $this->isWellFormed($rounded)) {
                $zip->addFromString($name, $rounded);
            }
        }
    }

    /**
     * Points every relationship at the first of identical media files and drops the copies.
     */
    private function dedupeMedia(ZipArchive $zip): void
    {
        $first = [];
        $duplicates = [];

        foreach ($this->entries($zip, '#^ppt/media/[^/]+$#') as $name) {
            $hash = sha1((string) $zip->getFromName($name));
            $file = substr($name, strlen('ppt/media/'));

            if (isset($first[$hash])) {
                $duplicates[$file] = $first[$hash];
            } else {
                $first[$hash] = $file;
            }
        }

        if ($duplicates === []) {
            return;
        }

        foreach ($this->entries($zip, '#\.rels$#') as $name) {
            $xml = (string) $zip->getFromName($name);
            $relinked = preg_replace_callback(
                '#Target="\.\./media/([^"]+)"#',
                static fn (array $m): string => isset($duplicates[$m[1]]) ? 'Target="../media/'.$duplicates[$m[1]].'"' : $m[0],
                $xml,
            );

            if (is_string($relinked) && $relinked !== $xml) {
                $zip->addFromString($name, $relinked);
            }
        }

        foreach (array_keys($duplicates) as $file) {
            $zip->deleteName('ppt/media/'.$file);
        }
    }

    /**
     * @return list<string>
     */
    private function entries(ZipArchive $zip, string $pattern): array
    {
        $names = [];

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = (string) $zip->getNameIndex($i);

            if (preg_match($pattern, $name) === 1) {
                $names[] = $name;
            }
        }

        return $names;
    }

    private function isWellFormed(string $xml): bool
    {
        $previous = libxml_use_internal_errors(true);
        $valid = (new DOMDocument)->loadXML($xml, LIBXML_NONET) !== false;
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        return $valid;
    }

    private function tempFile(string $extension): string
    {
        $base = tempnam(sys_get_temp_dir(), 'lesson');

        if ($base === false) {
            throw new TeacherAiException('Не удалось подготовить файл презентации. Попробуйте ещё раз.');
        }

        $path = $base.'.'.$extension;

        if (! @rename($base, $path)) {
            @unlink($base);

            throw new TeacherAiException('Не удалось подготовить файл презентации. Попробуйте ещё раз.');
        }

        return $path;
    }

    // ------------------------------------------------------------ slide data

    /**
     * Normalises the stored slides; entries that are not objects are skipped.
     *
     * @param  array<int|string, mixed>  $raw
     * @return list<array<string, mixed>>
     */
    private function slides(array $raw): array
    {
        $slides = [];

        foreach ($raw as $index => $slide) {
            if (is_array($slide)) {
                $slides[] = $this->slide($slide, (int) $index);
            }
        }

        return $slides;
    }

    /**
     * One slide with every key of the version-2 shape, cleaned and with list
     * sizes clamped to what its layout can draw. An unknown layout, or one
     * without the data it needs, falls back to text_bullets. `index` is the
     * position in the stored deck (the key of its image).
     *
     * @param  array<string, mixed>  $raw
     * @return array<string, mixed>
     */
    private function slide(array $raw, int $index): array
    {
        $layout = strtolower($this->line($raw['layout'] ?? null));
        $known = in_array($layout, self::LAYOUTS, true);
        $categories = array_slice($this->lineList($raw['categories'] ?? null), 0, 6);

        $data = [
            'index' => $index,
            'layout' => $known ? $layout : 'text_bullets',
            'title' => $this->line($raw['title'] ?? null),
            'subtitle' => $this->line($raw['subtitle'] ?? null),
            'paragraphs' => $this->paragraphList($raw['paragraphs'] ?? null),
            'side_title' => $this->line($raw['side_title'] ?? null),
            'bullets' => $this->lineList($raw['bullets'] ?? null),
            'items' => array_slice($this->records($raw['items'] ?? null, ['title', 'text', 'detail']), 0, self::MAX_ITEMS[$layout] ?? 6),
            'columns' => array_slice($this->columns($raw['columns'] ?? null), 0, 2),
            'stats' => array_slice($this->records($raw['stats'] ?? null, ['value', 'label', 'text']), 0, 3),
            'categories' => $categories,
            'series' => $this->series($raw['series'] ?? null, count($categories)),
            'unit' => $this->line($raw['unit'] ?? null),
            'text' => $this->line($raw['text'] ?? null),
            'footer' => $this->line($raw['footer'] ?? null),
            'image' => ($raw['image'] ?? false) === true,
            'image_side' => ($raw['image_side'] ?? '') === 'left' ? 'left' : 'right',
            'notes' => $this->clean($raw['notes'] ?? null),
            'cover' => is_array($raw['cover'] ?? null) ? $raw['cover'] : [],
        ];

        return $known && $this->hasLayoutData($data) ? $data : $this->asTextSlide($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function hasLayoutData(array $data): bool
    {
        return match ($data['layout']) {
            'timeline', 'cards', 'pyramid', 'steps', 'hierarchy', 'conclusion' => $data['items'] !== [],
            'banner_columns' => $data['columns'] !== [],
            'chart' => $data['categories'] !== [] && $data['series'] !== [],
            'stats' => $data['stats'] !== [],
            default => true,
        };
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function asTextSlide(array $data): array
    {
        $filled = static fn (array $texts): array => array_values(array_filter($texts, static fn (string $text): bool => $text !== ''));
        $items = array_map(static fn (array $item): string => implode(': ', $filled([$item['title'], $item['text']])), $data['items']);

        $data['layout'] = 'text_bullets';
        $data['paragraphs'] = $filled([...$data['paragraphs'], $data['text'], $data['footer']]);
        $data['bullets'] = $filled([...$data['bullets'], ...$items]);

        return $data;
    }

    /**
     * Cover texts with fallbacks from the lesson and the locale.
     *
     * @param  array<string, mixed>  $cover
     * @return array<string, string>
     */
    private function coverTexts(array $cover): array
    {
        $value = fn (string $key, string $fallback): string => $this->line($cover[$key] ?? null) ?: $fallback;

        return [
            'university' => $value('university', $this->label('university')),
            'faculty' => $value('faculty', $this->line($this->lesson?->faculty_name)),
            'department' => $value('department', $this->line($this->lesson?->department_name)),
            'course_label' => $value('course_label', $this->label('course_label')),
            'course' => $value('course', $this->line($this->lesson?->subject) ?: $this->title),
            'city_year' => $value('city_year', $this->label('city').', '.date('Y')),
        ];
    }

    /**
     * @param  list<string>  $keys
     * @return list<array<string, string>>
     */
    private function records(mixed $raw, array $keys): array
    {
        $records = [];

        foreach (is_array($raw) ? $raw : [] as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $record = [];

            foreach ($keys as $key) {
                $record[$key] = $this->line($entry[$key] ?? null);
            }

            if (implode('', $record) !== '') {
                $records[] = $record;
            }
        }

        return $records;
    }

    /**
     * @return list<array{title: string, text: string, bullets: list<string>}>
     */
    private function columns(mixed $raw): array
    {
        $columns = [];

        foreach (is_array($raw) ? $raw : [] as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $column = [
                'title' => $this->line($entry['title'] ?? null),
                'text' => $this->clean($entry['text'] ?? null),
                'bullets' => $this->lineList($entry['bullets'] ?? null),
            ];

            if ($column['title'] !== '' || $column['text'] !== '' || $column['bullets'] !== []) {
                $columns[] = $column;
            }
        }

        return $columns;
    }

    /**
     * Up to three series with one non-negative value per category.
     *
     * @return list<array{name: string, values: list<float>}>
     */
    private function series(mixed $raw, int $categories): array
    {
        $series = [];

        foreach (is_array($raw) ? $raw : [] as $entry) {
            if (! is_array($entry) || ! is_array($entry['values'] ?? null)) {
                continue;
            }

            $values = [];

            for ($k = 0; $k < $categories; $k++) {
                $value = $entry['values'][$k] ?? 0;
                $values[] = is_numeric($value) ? max(0.0, (float) $value) : 0.0;
            }

            $series[] = ['name' => $this->line($entry['name'] ?? null), 'values' => $values];
        }

        return array_slice($series, 0, 3);
    }

    /**
     * Axis maximum: 100 when every value fits, else 1/2/2.5/5 x 10^k.
     *
     * @param  list<array{name: string, values: list<float>}>  $series
     */
    private function niceMax(array $series): float
    {
        $largest = max([0.0, ...array_merge(...array_column($series, 'values'))]);

        if ($largest <= 100) {
            return 100.0;
        }

        $power = 10 ** floor(log10($largest));

        foreach ([1, 2, 2.5, 5] as $factor) {
            if ($factor * $power >= $largest) {
                return $factor * $power;
            }
        }

        return 10 * $power;
    }

    private function number(float $value): string
    {
        $point = $this->language === 'en-US' ? '.' : ',';

        return rtrim(rtrim(number_format($value, 2, $point, ''), '0'), $point);
    }

    private function deckTitle(TeacherAiLesson $lesson): string
    {
        $title = $this->line($lesson->presentation['title'] ?? null);

        if ($title === '') {
            $title = trim($this->line($lesson->subject).': '.$this->line($lesson->topic), ': ');
        }

        return $title !== '' ? $title : $this->label('presentation');
    }

    private function label(string $key): string
    {
        return $this->labels[$key] ?? $key;
    }

    // ------------------------------------------------------------- strings

    /**
     * Normalises any scalar to a trimmed UTF-8 string without control
     * characters (newlines are kept so text can be split into paragraphs).
     */
    private function clean(mixed $value): string
    {
        if (is_array($value) || is_object($value) || $value === null || is_bool($value)) {
            return '';
        }

        $text = (string) $value;

        if (! mb_check_encoding($text, 'UTF-8')) {
            $text = mb_convert_encoding($text, 'UTF-8', 'UTF-8');
        }

        $text = str_replace(["\r\n", "\r", "\t"], ["\n", "\n", ' '], $text);
        $text = preg_replace('/[^\P{C}\n]+/u', '', $text) ?? '';

        return trim($text);
    }

    /**
     * Cleaned text on a single line (runs of whitespace become one space).
     */
    private function line(mixed $value): string
    {
        $text = $this->clean($value);

        return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
    }

    /**
     * Non-empty lines of a multi-line text.
     *
     * @return list<string>
     */
    private function lines(string $text): array
    {
        return $this->lineList(explode("\n", $text));
    }

    /**
     * @return list<string>
     */
    private function lineList(mixed $items): array
    {
        $list = [];

        foreach (is_array($items) ? $items : [] as $item) {
            $text = $this->line($item);

            if ($text !== '') {
                $list[] = $text;
            }
        }

        return $list;
    }

    /**
     * Paragraph strings; a string with line breaks becomes several paragraphs.
     *
     * @return list<string>
     */
    private function paragraphList(mixed $items): array
    {
        $list = [];

        foreach (is_array($items) ? $items : [] as $item) {
            array_push($list, ...$this->lines($this->clean($item)));
        }

        return $list;
    }

    /**
     * PhpPresentation writes text as CDATA and does not split a literal "]]>",
     * which would end the section early and corrupt the XML. Everything else
     * (& < > ") is safe inside CDATA as is, so nothing else is escaped.
     */
    private function xmlSafe(string $text): string
    {
        return str_replace(']]>', "]]\u{200B}>", $text);
    }

    /**
     * Box with whole-pixel edges (shared edges of neighbouring boxes stay aligned).
     *
     * @param  array{0: int|float, 1: int|float, 2: int|float, 3: int|float}  $box
     * @return array{0: int, 1: int, 2: int, 3: int}
     */
    private function px(array $box): array
    {
        [$x, $y, $width, $height] = $box;
        $left = (int) round($x);
        $top = (int) round($y);

        return [$left, $top, max(1, (int) round($x + $width) - $left), max(1, (int) round($y + $height) - $top)];
    }
}
