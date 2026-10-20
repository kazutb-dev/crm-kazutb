<?php

namespace Tests\Unit\TeacherAi;

use App\Models\TeacherAiLesson;
use App\Services\TeacherAi\LessonDocxExporter;
use App\Services\TeacherAi\LessonPptxExporter;
use App\Services\TeacherAi\TeacherAiException;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use SimpleXMLElement;
use Tests\TestCase;
use ZipArchive;

class LessonExportersTest extends TestCase
{
    private const TITLE = 'Базы данных & SQL: <нормализация> «3НФ» — Ақпарат қоры: әдіс, ғылым, қағида, ңұ, өту, ұғым, үлгі';

    private const PPTX_TITLE = 'Әдіс & <ғылым>: әдіс, қағида, ңұ, өту, ұғым, үлгі — «тырнақша» "quotes"';

    public function test_docx_contains_lecture_structure_and_escapes_special_characters(): void
    {
        $path = (new LessonDocxExporter)->export($this->lesson());

        try {
            $this->assertFileExists($path);
            $this->assertStringEndsWith('.docx', $path);

            $xml = $this->zipEntry($path, 'word/document.xml');
            $document = $this->assertWellFormedXml($xml, 'word/document.xml');
            $text = dom_import_simplexml($document)->textContent;

            $this->assertStringContainsString(htmlspecialchars(self::TITLE, ENT_QUOTES | ENT_XML1), $xml);
            $this->assertStringNotContainsString(' & SQL', $xml, 'ampersand must be escaped in the raw XML');
            $this->assertStringContainsString(self::TITLE, $text);

            foreach (['Цели обучения', 'План лекции', 'Введение', 'Заключение', 'Вопросы для самопроверки', 'Глоссарий', 'Рекомендуемая литература', 'Ключевые слова', 'Дисциплина', 'Длительность'] as $heading) {
                $this->assertStringContainsString($heading, $text, "heading {$heading}");
            }

            $this->assertStringContainsString('1. Реляционная модель & её свойства', $text);
            $this->assertStringContainsString('Раздел 2', $text, 'untitled planned section gets a generated title in the plan');
            $this->assertStringContainsString('2. Функциональные зависимости', $text, 'generated section title wins over the planned one');
            $this->assertStringContainsString('Понять аномалии <вставки>', $text);
            $this->assertStringContainsString('Первая нормальная форма (1НФ)', $text);
            $this->assertStringContainsString('Пример 1.', $text);
            $this->assertStringContainsString('Пример 2.', $text);
            $this->assertStringContainsString('Кортеж', $text);
            $this->assertStringContainsString('90 мин', $text);
            $this->assertStringContainsString('Материал сгенерирован AI-ассистентом КазУТБ', $text);
            $this->assertStringContainsString('SQL, 3НФ, ә ғ қ ң ө ұ ү', $text);

            // Multi-line paragraph strings become separate Word paragraphs.
            $this->assertStringContainsString('<w:t xml:space="preserve">Первый абзац введения.</w:t>', $xml);
            $this->assertStringContainsString('<w:t xml:space="preserve">Второй абзац введения.</w:t>', $xml);
            $this->assertStringNotContainsString("\x01", $xml, 'control characters are stripped');
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_docx_skips_missing_optional_parts_and_pending_sections(): void
    {
        $lesson = new TeacherAiLesson([
            'subject' => 'Физика',
            'topic' => 'Кинематика',
            'language' => 'kk',
            'duration_minutes' => 50,
            'outline' => [
                'title' => '',
                'sections' => [
                    ['title' => 'Жылдамдық', 'key_points' => ['Орташа жылдамдық', 'Лездік жылдамдық']],
                    null,
                    'not-an-array',
                ],
                'glossary' => [],
                'objectives' => 'not a list',
                'references' => [null, 42, ['nested']],
            ],
            'sections' => [null, ['title' => 'Үдеу', 'paragraphs' => ['Үдеу — жылдамдықтың өзгеру шапшаңдығы.'], 'key_terms' => 'oops']],
        ]);

        $path = (new LessonDocxExporter)->export($lesson);

        try {
            $document = $this->assertWellFormedXml($this->zipEntry($path, 'word/document.xml'), 'word/document.xml');
            $text = dom_import_simplexml($document)->textContent;

            $this->assertStringContainsString('Физика: Кинематика', $text, 'empty outline title falls back to subject: topic');
            $this->assertStringContainsString('Дәріс жоспары', $text);
            $this->assertStringContainsString('1. Жылдамдық', $text);
            $this->assertStringContainsString('Орташа жылдамдық', $text, 'planned key points stand in for a section that is not generated yet');
            $this->assertStringContainsString('2. Үдеу', $text);
            $this->assertStringContainsString('3. Бөлім 3', $text);
            $this->assertStringContainsString('42', $text);
            $this->assertStringNotContainsString('Глоссарий', $text);
            $this->assertStringNotContainsString('Оқу мақсаттары', $text);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_docx_requires_an_outline(): void
    {
        $this->expectException(TeacherAiException::class);
        $this->expectExceptionMessage('Лекция ещё не готова.');

        (new LessonDocxExporter)->export(new TeacherAiLesson(['subject' => 'Физика', 'topic' => 'Кинематика', 'language' => 'ru']));
    }

    public function test_pptx_renders_the_fixture_deck_in_the_kazutb_template(): void
    {
        Storage::fake('local');

        // Ready pictures for five slots (distinct colours so every file is unique);
        // the image of slide 14 (a banner) failed, so its slot gets the placeholder.
        [$images, $files] = $this->storeImages([1 => [200, 300], 4 => [300, 200], 6 => [200, 300], 8 => [200, 300], 13 => [200, 300]]);
        $images['14'] = ['status' => TeacherAiLesson::IMAGE_FAILED, 'file' => null, 'attempts' => 3];

        $deck = $this->fixtureDeck();
        $deck['slides'][2]['title'] = self::PPTX_TITLE;
        $tempImages = glob(sys_get_temp_dir().'/lesson*.jpg') ?: [];

        $path = (new LessonPptxExporter)->export(new TeacherAiLesson([
            'subject' => 'Компьютерлік жүйелердің сәулеті',
            'topic' => 'Жедел жады',
            'language' => 'kk',
            'presentation' => $deck,
            'images' => $images,
        ]));

        try {
            $this->assertFileExists($path);
            $this->assertStringEndsWith('.pptx', $path);
            $this->assertSame([], array_diff(glob(sys_get_temp_dir().'/lesson*.jpg') ?: [], $tempImages), 'cropped temp images are deleted');

            $slides = $this->zipEntries($path, '#^ppt/slides/slide(\d+)\.xml$#');
            $this->assertSame(array_map(static fn (int $n): string => "ppt/slides/slide{$n}.xml", range(1, 16)), $slides);

            foreach ($slides as $entry) {
                $this->assertWellFormedXml($this->zipEntry($path, $entry), $entry);
                $this->assertStringContainsString('typeface="Times New Roman"', $this->zipEntry($path, $entry), "{$entry} uses Times New Roman");
            }

            // Every fixture slide has speaker notes.
            $notes = $this->zipEntries($path, '#^ppt/notesSlides/notesSlide(\d+)\.xml$#');
            $this->assertCount(16, $notes);
            $this->assertStringContainsString('Курс пен дәріс тақырыбын таныстырыңыз.', $this->xmlText($this->zipEntry($path, $notes[0]), $notes[0]));
            $this->assertStringContainsString('Негізгі тұжырымдарды қайталаңыз.', $this->xmlText($this->zipEntry($path, $notes[15]), $notes[15]));

            $cover = $this->xmlText($this->zipEntry($path, 'ppt/slides/slide1.xml'), 'slide1');

            foreach (['«Қ.Құлажанов атындағы Қазақ технология және бизнес университеті» АҚ', '«Инженерлік және ақпараттық технологиялар» факультеті', '«Ақпараттық технологиялар» кафедрасы', 'Курс атауы:', 'Компьютерлік жүйелердің сәулеті', 'Астана, 2026'] as $text) {
                $this->assertStringContainsString($text, $cover);
            }

            // Kazakh letters, & and angle brackets survive: CDATA in the raw XML, no double escaping.
            $raw = $this->zipEntry($path, 'ppt/slides/slide3.xml');
            $this->assertStringContainsString('<![CDATA['.self::PPTX_TITLE.']]>', $raw);
            $this->assertStringContainsString(self::PPTX_TITLE, $this->xmlText($raw, 'slide3'));
            $this->assertStringNotContainsString('&amp;amp;', $raw);
            $this->assertStringNotContainsString('&amp;lt;', $raw);
            $this->assertStringContainsString('7-Дәріс. Жедел жады (RAM)', $this->xmlText($this->zipEntry($path, 'ppt/slides/slide2.xml'), 'slide2'));

            // The emblem is on every slide and stored once.
            $media = $this->zipNames($path, '#^ppt/media/#');
            $logos = array_values(array_filter($media, static fn (string $name): bool => str_ends_with($name, '.png')));
            $this->assertCount(1, $logos);

            foreach (range(1, 16) as $n) {
                $this->assertContains($logos[0], $this->slideMedia($path, $n), "slide {$n} shows the logo");
            }

            // Cover photo + five ready pictures; the failed slot adds nothing.
            $this->assertCount(6, array_diff($media, $logos));
            $this->assertCount(1, array_filter($this->slideMedia($path, 1), static fn (string $name): bool => str_contains($name, 'cover-photo')));

            // A picture that already has the slot's aspect ratio is embedded as is.
            $lectureTitle = $this->slideJpegs($path, 2);
            $this->assertCount(1, $lectureTitle);
            $this->assertSame($files[1], $this->zipEntry($path, $lectureTitle[0]));

            // A landscape picture in the banner slot is cover-cropped to 1280:215.
            $banner = $this->slideJpegs($path, 5);
            $this->assertCount(1, $banner);
            [$width, $height] = getimagesizefromstring($this->zipEntry($path, $banner[0]));
            $this->assertEqualsWithDelta(1280 / 215, $width / $height, 0.05);

            // The slot without a ready picture is the indigo gradient placeholder.
            $this->assertSame([], $this->slideJpegs($path, 15));
            $placeholder = $this->zipEntry($path, 'ppt/slides/slide15.xml');
            $this->assertStringContainsString('<a:gradFill>', $placeholder);
            $this->assertStringContainsString('2E2A78', $placeholder);
            $this->assertStringContainsString('6A5ACD', $placeholder);

            // Rounded rectangles get a small radius instead of PowerPoint's default.
            $this->assertMatchesRegularExpression('#prst="roundRect">\s*<a:avLst><a:gd name="adj" fmla="val \d+"/></a:avLst>#', $this->zipEntry($path, 'ppt/slides/slide6.xml'));

            foreach ($slides as $entry) {
                $this->assertDoesNotMatchRegularExpression('#prst="roundRect">\s*<a:avLst/>#', $this->zipEntry($path, $entry), "{$entry} has no default-radius roundRect");
            }

            $this->assertStringContainsString('<p:sldSz cx="12192000" cy="6858000"/>', $this->zipEntry($path, 'ppt/presentation.xml'));

            $core = $this->assertWellFormedXml($this->zipEntry($path, 'docProps/core.xml'), 'docProps/core.xml');
            $core->registerXPathNamespace('dc', 'http://purl.org/dc/elements/1.1/');
            $this->assertSame($deck['title'], (string) $core->xpath('//dc:title')[0]);
            $this->assertSame('KazUTB AI-ассистент', (string) $core->xpath('//dc:creator')[0]);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_pptx_fits_overlong_text_and_survives_odd_input(): void
    {
        Storage::fake('local');
        $long = str_repeat('Өте ұзын абзац мәтіні, ол бір слайдқа сыймайды. ', 60);

        $lesson = new TeacherAiLesson([
            'subject' => 'Физика',
            'topic' => 'Кинематика',
            'language' => 'kk',
            'presentation' => [
                'version' => 2,
                'title' => 'Физика & <механика>',
                'slides' => [
                    ['layout' => 'cover', 'cover' => null, 'notes' => null],
                    [
                        'layout' => 'text_bullets',
                        'title' => 'Жылдамдық',
                        'paragraphs' => [$long],
                        'bullets' => ['Terminator ]]> inside', 42, '', null, ['nested']],
                        'notes' => "Бір\n\nЕкі",
                    ],
                    'not-a-slide',
                    ['layout' => 'mystery', 'title' => 'Белгісіз', 'text' => 'Қалып мәтін', 'items' => [['title' => 'A', 'text' => 'B'], 'junk']],
                    ['layout' => 'chart', 'title' => 'Диаграмма', 'categories' => ['X', 'Y'], 'series' => [['name' => 'S', 'values' => ['abc', -5]]]],
                    ['layout' => 'image_text', 'title' => 'Сурет', 'paragraphs' => ['Мәтін'], 'image' => true, 'image_side' => 'left'],
                ],
            ],
        ]);

        $path = (new LessonPptxExporter)->export($lesson);

        try {
            $slides = $this->zipEntries($path, '#^ppt/slides/slide(\d+)\.xml$#');
            $this->assertCount(5, $slides, 'entries that are not slide objects are dropped');

            $texts = [];

            foreach ($slides as $i => $entry) {
                $texts[$i + 1] = $this->xmlText($this->zipEntry($path, $entry), $entry);
            }

            // A cover without its object falls back to the locale and the lesson.
            $this->assertStringContainsString('«Қ.Құлажанов атындағы Қазақ технология және бизнес университеті» АҚ', $texts[1]);
            $this->assertStringContainsString('Курс атауы:', $texts[1]);
            $this->assertStringContainsString('Физика', $texts[1]);
            $this->assertStringContainsString('Астана, '.date('Y'), $texts[1]);

            // The overlong paragraph shrinks to the 12 pt minimum and is cut with an ellipsis.
            $raw = $this->zipEntry($path, 'ppt/slides/slide2.xml');
            $this->assertStringContainsString('sz="1200"', $raw);
            $paragraph = current(array_filter($this->runs($raw), static fn (string $run): bool => str_starts_with($run, 'Өте ұзын')));
            $this->assertIsString($paragraph);
            $this->assertStringEndsWith('…', $paragraph);
            $this->assertLessThan(mb_strlen(trim($long)), mb_strlen($paragraph));
            $this->assertStringContainsString("Terminator ]]\u{200B}> inside", $texts[2], '"]]>" cannot end the CDATA section early');
            $this->assertContains('42', $this->runs($raw));

            $notes = $this->xmlText($this->zipEntry($path, 'ppt/notesSlides/notesSlide2.xml'), 'notesSlide2');
            $this->assertStringContainsString('Бір', $notes);
            $this->assertStringContainsString('Екі', $notes);
            $this->assertSame([], array_values(array_diff($this->zipEntries($path, '#^ppt/notesSlides/notesSlide(\d+)\.xml$#'), ['ppt/notesSlides/notesSlide2.xml'])), 'only slides with notes get a notes page');

            // An unknown layout shows its text as a plain text slide.
            $this->assertStringContainsString('Қалып мәтін', $texts[3]);
            $this->assertStringContainsString('A: B', $texts[3]);

            // Non-numeric and negative chart values are drawn as 0 (two value labels + the 0 tick).
            $runs = $this->runs($this->zipEntry($path, 'ppt/slides/slide4.xml'));
            $this->assertContains('Диаграмма', $runs);
            $this->assertCount(3, array_keys($runs, '0', true));
            $this->assertNotContains('-5', $runs);

            // An image slot without any image entry is the placeholder.
            $this->assertStringContainsString('2E2A78', $this->zipEntry($path, 'ppt/slides/slide5.xml'));

            // Document properties are escaped XML text.
            $coreXml = $this->zipEntry($path, 'docProps/core.xml');
            $this->assertStringContainsString('Физика &amp; &lt;механика&gt;', $coreXml);
            $core = $this->assertWellFormedXml($coreXml, 'docProps/core.xml');
            $core->registerXPathNamespace('dc', 'http://purl.org/dc/elements/1.1/');
            $this->assertSame('Физика & <механика>', (string) $core->xpath('//dc:title')[0]);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    /**
     * @param  array<string, mixed>|null  $presentation
     */
    #[DataProvider('presentationsNotReady')]
    public function test_pptx_requires_a_version_2_presentation(?array $presentation): void
    {
        $this->expectException(TeacherAiException::class);
        $this->expectExceptionMessage('Презентация ещё не готова.');

        (new LessonPptxExporter)->export(new TeacherAiLesson([
            'subject' => 'Физика',
            'topic' => 'Кинематика',
            'language' => 'ru',
            'presentation' => $presentation,
        ]));
    }

    /**
     * @return array<string, array{0: array<string, mixed>|null}>
     */
    public static function presentationsNotReady(): array
    {
        return [
            'no presentation' => [null],
            'version 1 deck' => [['title' => 'Старая', 'slides' => [['layout' => 'title', 'title' => 'Старая', 'bullets' => ['Пункт']]]]],
            'empty version 2 deck' => [['version' => 2, 'title' => 'Пустая', 'slides' => []]],
            'no usable slide' => [['version' => 2, 'title' => 'Пустая', 'slides' => ['junk', 42]]],
        ];
    }

    private function lesson(): TeacherAiLesson
    {
        return new TeacherAiLesson([
            'subject' => 'Базы данных & SQL',
            'topic' => 'Нормализация <реляционных> БД',
            'language' => 'ru',
            'audience' => '2 курс бакалавриата, «ИС»',
            'duration_minutes' => 90,
            'slides_count' => 6,
            'outline' => [
                'title' => self::TITLE,
                'objectives' => ['Понять аномалии <вставки>', 'Научиться приводить схему к 3НФ & BCNF', '', null],
                'introduction' => "Первый абзац введения.\nВторой абзац введения.",
                'sections' => [
                    ['title' => 'Реляционная модель & её свойства', 'key_points' => ['Отношение', 'Кортеж']],
                    ['title' => '', 'key_points' => ['Функциональная зависимость']],
                ],
                'conclusion' => "Итог лекции.\x01 Контрольный символ удалён.",
                'self_check_questions' => ['Что такое 1НФ?', 'Чем 2НФ отличается от 3НФ?'],
                'glossary' => [
                    ['term' => 'Кортеж', 'definition' => 'Строка отношения'],
                    ['term' => '', 'definition' => 'без термина — пропускается'],
                    'garbage',
                ],
                'references' => ['Дейт К. Дж. Введение в системы баз данных, 2005'],
                'keywords' => ['SQL', '3НФ', 'ә ғ қ ң ө ұ ү'],
            ],
            'sections' => [
                [
                    'title' => '',
                    'paragraphs' => ["Первая нормальная форма (1НФ) требует атомарности.\nКаждое поле — одно значение.", 'Вторая нормальная форма.'],
                    'key_terms' => [['term' => 'Атомарность', 'definition' => 'Неделимость значения']],
                    'examples' => ["Таблица «Студенты» с полем «Телефоны».\nРазбиваем на две таблицы.", 'Второй пример.'],
                    'summary' => 'Нормализация устраняет избыточность.',
                ],
                [
                    'title' => 'Функциональные зависимости',
                    'paragraphs' => ['A → B означает, что A определяет B.'],
                ],
            ],
            'presentation' => [
                'title' => self::TITLE,
                'subtitle' => 'Базы данных & SQL · 2 курс',
                'slides' => [
                    ['layout' => 'title', 'title' => self::TITLE, 'bullets' => [], 'notes' => 'Поздоровайтесь & представьте тему.'],
                    ['layout' => 'content', 'title' => 'План', 'bullets' => ['Реляционная модель', 'Аномалии', 'Нормальные формы'], 'notes' => ''],
                    ['layout' => 'content', 'title' => 'Аномалии <вставки> & удаления', 'bullets' => ['Избыточность данных ведёт к противоречиям', 'Аномалия вставки', 'Аномалия удаления', 'Аномалия обновления', 'Пятый пункт', 'Шестой пункт', 'Седьмой пункт'], 'notes' => "Объясните на примере.\nСпросите студентов."],
                    ['layout' => 'section', 'title' => 'Нормальные формы', 'bullets' => [], 'notes' => null],
                    ['layout' => 'content', 'title' => 'Заключение', 'bullets' => ['3НФ — практический минимум'], 'notes' => 'Подведите итоги.'],
                ],
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function fixtureDeck(): array
    {
        return json_decode((string) file_get_contents(base_path('tests/Fixtures/TeacherAi/presentation-v2.json')), true, flags: JSON_THROW_ON_ERROR);
    }

    /**
     * Stores one small JPEG per slide index on the fake image disk.
     *
     * @param  array<int, array{0: int, 1: int}>  $sizes  slide index => [width, height]
     * @return array{0: array<string, array<string, mixed>>, 1: array<int, string>} images column, JPEG bytes per slide index
     */
    private function storeImages(array $sizes): array
    {
        $images = [];
        $files = [];

        foreach ($sizes as $index => [$width, $height]) {
            $image = imagecreatetruecolor($width, $height);
            imagefill($image, 0, 0, (int) imagecolorallocate($image, 40 + 30 * ($index % 7), 30, 120 + 9 * $index));
            ob_start();
            imagejpeg($image, null, 80);
            $files[$index] = (string) ob_get_clean();

            $file = "teacher-ai/lessons/test/s{$index}.jpg";
            Storage::disk(TeacherAiLesson::IMAGE_DISK)->put($file, $files[$index]);
            $images[(string) $index] = ['status' => TeacherAiLesson::IMAGE_READY, 'file' => $file, 'attempts' => 1];
        }

        return [$images, $files];
    }

    /**
     * @return list<string>
     */
    private function zipNames(string $path, string $pattern): array
    {
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path), "{$path} is not a valid zip");
        $names = [];

        for ($i = 0; $i < $zip->numFiles; $i++) {
            if (preg_match($pattern, (string) $zip->getNameIndex($i)) === 1) {
                $names[] = (string) $zip->getNameIndex($i);
            }
        }

        $zip->close();

        return $names;
    }

    /**
     * Texts of the slide's runs (PhpPresentation writes them as CDATA).
     *
     * @return list<string>
     */
    private function runs(string $xml): array
    {
        preg_match_all('#<a:t><!\[CDATA\[(.*?)\]\]></a:t>#s', $xml, $m);

        return $m[1];
    }

    /**
     * Media files (zip entry names) the slide's relationships point to.
     *
     * @return list<string>
     */
    private function slideMedia(string $path, int $slide): array
    {
        preg_match_all('#Target="\.\./media/([^"]+)"#', $this->zipEntry($path, "ppt/slides/_rels/slide{$slide}.xml.rels"), $m);

        return array_map(static fn (string $file): string => 'ppt/media/'.$file, $m[1]);
    }

    /**
     * JPEG pictures of the slide other than the cover photo.
     *
     * @return list<string>
     */
    private function slideJpegs(string $path, int $slide): array
    {
        return array_values(array_filter(
            $this->slideMedia($path, $slide),
            static fn (string $name): bool => preg_match('#\.jpe?g$#', $name) === 1 && ! str_contains($name, 'cover-photo'),
        ));
    }

    private function zipEntry(string $path, string $name): string
    {
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path), "{$path} is not a valid zip");

        try {
            $content = $zip->getFromName($name);
        } finally {
            $zip->close();
        }

        $this->assertNotFalse($content, "zip entry {$name} is missing");

        return $content;
    }

    /**
     * @return list<string>
     */
    private function zipEntries(string $path, string $pattern): array
    {
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path), "{$path} is not a valid zip");

        $names = [];

        try {
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = (string) $zip->getNameIndex($i);

                if (preg_match($pattern, $name, $m) === 1) {
                    $names[(int) $m[1]] = $name;
                }
            }
        } finally {
            $zip->close();
        }

        ksort($names);

        return array_values($names);
    }

    private function assertWellFormedXml(string $xml, string $context): SimpleXMLElement
    {
        libxml_use_internal_errors(true);
        libxml_clear_errors();

        $element = simplexml_load_string($xml);
        $errors = array_map(static fn ($error): string => trim($error->message), libxml_get_errors());

        libxml_clear_errors();
        libxml_use_internal_errors(false);

        $this->assertNotFalse($element, "{$context} is not well-formed XML: ".implode('; ', $errors));

        return $element;
    }

    private function xmlText(string $xml, string $context): string
    {
        return dom_import_simplexml($this->assertWellFormedXml($xml, $context))->textContent;
    }
}
