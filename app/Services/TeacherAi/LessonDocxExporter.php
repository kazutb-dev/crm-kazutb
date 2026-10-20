<?php

namespace App\Services\TeacherAi;

use App\Models\TeacherAiLesson;
use PhpOffice\PhpWord\Element\Section;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Settings;
use PhpOffice\PhpWord\SimpleType\Jc;
use Throwable;

/**
 * Renders a generated lesson (outline + section texts) as a Word document.
 *
 * The exporter is deliberately forgiving: any optional part of the outline
 * (glossary, references, examples, ...) may be missing or malformed and is
 * simply skipped. Only a lesson without an outline is rejected.
 */
final class LessonDocxExporter
{
    private const FONT = 'Times New Roman';

    private const BODY_SIZE = 12;

    /**
     * Twips (1/20 pt): 1 cm = 567 twips.
     */
    private const MARGIN_LEFT = 1701;   // 3 cm, standard for Kazakh/Russian academic papers

    private const MARGIN_RIGHT = 851;   // 1.5 cm

    private const MARGIN_TOP = 1134;    // 2 cm

    private const MARGIN_BOTTOM = 1134; // 2 cm

    private const LIST_INDENT = 720;    // 0.5 inch

    private const LIST_HANGING = 360;

    private const COLOR_TEXT = '1F2937';

    private const COLOR_MUTED = '6B7280';

    /**
     * Numbered lists get their own numbering definition each, otherwise Word
     * continues the numbers from the previous list (1, 2, 3 ... 4, 5, 6).
     */
    private const LIST_BULLETS = 'lessonBullets';

    private const LIST_PLAN = 'lessonPlan';

    private const LIST_QUESTIONS = 'lessonQuestions';

    private const LIST_REFERENCES = 'lessonReferences';

    /**
     * @var array<string, string>
     */
    private array $labels = [];

    /**
     * Builds the DOCX and returns the path of a temp file; the caller deletes it.
     *
     * @throws TeacherAiException when the lesson has no outline yet or the file cannot be written
     */
    public function export(TeacherAiLesson $lesson): string
    {
        $outline = is_array($lesson->outline) ? $lesson->outline : null;

        if ($outline === null || empty($outline['sections']) || ! is_array($outline['sections'])) {
            throw new TeacherAiException('Лекция ещё не готова.');
        }

        $this->labels = LessonLocale::labels((string) ($lesson->language ?: 'ru'));

        // PhpWord writes raw XML unless output escaping is switched on; with it
        // on, the XMLWriter escapes & < > " itself, so no manual escaping here.
        $escapingWasEnabled = Settings::isOutputEscapingEnabled();
        Settings::setOutputEscapingEnabled(true);

        try {
            $phpWord = $this->createDocument($lesson, $outline);
            $section = $phpWord->addSection([
                'paperSize' => 'A4',
                'marginLeft' => self::MARGIN_LEFT,
                'marginRight' => self::MARGIN_RIGHT,
                'marginTop' => self::MARGIN_TOP,
                'marginBottom' => self::MARGIN_BOTTOM,
            ]);

            $this->writeHeader($section, $lesson, $outline);
            $this->writeObjectives($section, $outline);
            $this->writePlan($section, $outline);
            $this->writeIntroduction($section, $outline);
            $this->writeSections($section, $lesson, $outline);
            $this->writeConclusion($section, $outline);
            $this->writeSelfCheck($section, $outline);
            $this->writeGlossary($section, $outline);
            $this->writeReferences($section, $outline);
            $this->writeKeywords($section, $outline);

            $path = $this->tempFile('docx');

            try {
                IOFactory::createWriter($phpWord, 'Word2007')->save($path);
            } catch (Throwable $e) {
                @unlink($path);

                throw new TeacherAiException('Не удалось подготовить файл лекции. Попробуйте ещё раз.', 0, $e);
            }

            return $path;
        } finally {
            Settings::setOutputEscapingEnabled($escapingWasEnabled);
        }
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function createDocument(TeacherAiLesson $lesson, array $outline): PhpWord
    {
        $phpWord = new PhpWord;
        $phpWord->setDefaultFontName(self::FONT);
        $phpWord->setDefaultFontSize(self::BODY_SIZE);
        $phpWord->setDefaultFontColor(self::COLOR_TEXT);
        $phpWord->setDefaultParagraphStyle([
            'lineHeight' => 1.15,
            'spaceAfter' => 120,
            'alignment' => Jc::BOTH,
        ]);

        $phpWord->addTitleStyle(1, ['name' => self::FONT, 'size' => 16, 'bold' => true, 'color' => self::COLOR_TEXT], [
            'spaceBefore' => 360,
            'spaceAfter' => 160,
            'keepNext' => true,
            'alignment' => Jc::START,
        ]);
        $phpWord->addTitleStyle(2, ['name' => self::FONT, 'size' => 14, 'bold' => true, 'color' => self::COLOR_TEXT], [
            'spaceBefore' => 240,
            'spaceAfter' => 120,
            'keepNext' => true,
            'alignment' => Jc::START,
        ]);

        $phpWord->addNumberingStyle(self::LIST_BULLETS, [
            'type' => 'multilevel',
            'levels' => [
                ['format' => 'bullet', 'text' => '•', 'left' => self::LIST_INDENT, 'hanging' => self::LIST_HANGING, 'tabPos' => self::LIST_INDENT, 'font' => self::FONT],
            ],
        ]);

        foreach ([self::LIST_PLAN, self::LIST_QUESTIONS, self::LIST_REFERENCES] as $name) {
            $phpWord->addNumberingStyle($name, [
                'type' => 'multilevel',
                'levels' => [
                    ['start' => 1, 'format' => 'decimal', 'text' => '%1.', 'left' => self::LIST_INDENT, 'hanging' => self::LIST_HANGING, 'tabPos' => self::LIST_INDENT, 'font' => self::FONT],
                ],
            ]);
        }

        $title = $this->title($lesson, $outline);
        $docInfo = $phpWord->getDocInfo();
        $docInfo->setCreator('KazUTB AI-ассистент');
        $docInfo->setLastModifiedBy('KazUTB AI-ассистент');
        $docInfo->setTitle($title);
        $docInfo->setSubject($this->clean($lesson->subject));
        $docInfo->setDescription($this->label('generated_note'));

        return $phpWord;
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function writeHeader(Section $section, TeacherAiLesson $lesson, array $outline): void
    {
        $section->addText(
            $this->label('lecture'),
            ['size' => 11, 'color' => self::COLOR_MUTED, 'allCaps' => true],
            ['alignment' => Jc::CENTER, 'spaceAfter' => 60]
        );
        $section->addText(
            $this->title($lesson, $outline),
            ['size' => 18, 'bold' => true],
            ['alignment' => Jc::CENTER, 'spaceAfter' => 240, 'lineHeight' => 1.0]
        );

        $duration = (int) $lesson->duration_minutes;

        $meta = [
            'discipline' => $this->clean($lesson->subject),
            'topic' => $this->clean($lesson->topic),
            'audience' => $this->clean($lesson->audience),
            'duration' => $duration > 0 ? $duration.' '.$this->label('minutes') : '',
            'date' => ($lesson->completed_at ?? $lesson->created_at ?? now())->format('d.m.Y'),
        ];

        foreach ($meta as $key => $value) {
            if ($value === '') {
                continue;
            }

            $run = $section->addTextRun(['alignment' => Jc::START, 'spaceAfter' => 40, 'lineHeight' => 1.0]);
            $run->addText($this->label($key).': ', ['bold' => true]);
            $run->addText($value);
        }

        $section->addText(
            $this->label('generated_note'),
            ['italic' => true, 'size' => 10, 'color' => self::COLOR_MUTED],
            ['alignment' => Jc::START, 'spaceBefore' => 160, 'spaceAfter' => 240, 'lineHeight' => 1.0]
        );
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function writeObjectives(Section $section, array $outline): void
    {
        $objectives = $this->stringList($outline['objectives'] ?? null);

        if ($objectives === []) {
            return;
        }

        $section->addTitle($this->label('objectives'), 1);

        foreach ($objectives as $objective) {
            $section->addListItem($objective, 0, null, self::LIST_BULLETS, ['spaceAfter' => 60]);
        }
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function writePlan(Section $section, array $outline): void
    {
        $titles = [];

        foreach ($this->plannedSections($outline) as $index => $planned) {
            $titles[] = $this->sectionTitle($planned, null, $index);
        }

        if ($titles === []) {
            return;
        }

        $section->addTitle($this->label('plan'), 1);

        foreach ($titles as $title) {
            $section->addListItem($title, 0, null, self::LIST_PLAN, ['spaceAfter' => 60]);
        }
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function writeIntroduction(Section $section, array $outline): void
    {
        $paragraphs = $this->paragraphs($outline['introduction'] ?? null);

        if ($paragraphs === []) {
            return;
        }

        $section->addTitle($this->label('introduction'), 1);
        $this->writeParagraphs($section, $paragraphs);
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function writeSections(Section $section, TeacherAiLesson $lesson, array $outline): void
    {
        $generated = is_array($lesson->sections) ? $lesson->sections : [];

        foreach ($this->plannedSections($outline) as $index => $planned) {
            $text = $generated[$index] ?? null;
            $text = is_array($text) ? $text : [];

            $section->addTitle(($index + 1).'. '.$this->sectionTitle($planned, $text, $index), 1);

            $paragraphs = $this->paragraphs($text['paragraphs'] ?? null);

            if ($paragraphs === []) {
                // Section text is not generated yet: fall back to the planned key points
                // so the document is still useful as a lecture plan.
                foreach ($this->stringList($planned['key_points'] ?? null) as $point) {
                    $section->addListItem($point, 0, null, self::LIST_BULLETS, ['spaceAfter' => 60]);
                }
            } else {
                $this->writeParagraphs($section, $paragraphs);
            }

            $this->writeTermList($section, $text['key_terms'] ?? null, 'key_terms', 2);
            $this->writeExamples($section, $text['examples'] ?? null);

            $summary = $this->singleLine($this->clean($text['summary'] ?? null));

            if ($summary !== '') {
                $run = $section->addTextRun(['spaceBefore' => 120]);
                $run->addText($this->label('summary').': ', ['bold' => true]);
                $run->addText($summary);
            }
        }
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function writeConclusion(Section $section, array $outline): void
    {
        $paragraphs = $this->paragraphs($outline['conclusion'] ?? null);

        if ($paragraphs === []) {
            return;
        }

        $section->addTitle($this->label('conclusion'), 1);
        $this->writeParagraphs($section, $paragraphs);
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function writeSelfCheck(Section $section, array $outline): void
    {
        $questions = $this->stringList($outline['self_check_questions'] ?? null);

        if ($questions === []) {
            return;
        }

        $section->addTitle($this->label('self_check'), 1);

        foreach ($questions as $question) {
            $section->addListItem($question, 0, null, self::LIST_QUESTIONS, ['spaceAfter' => 60]);
        }
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function writeGlossary(Section $section, array $outline): void
    {
        $this->writeTermList($section, $outline['glossary'] ?? null, 'glossary', 1);
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function writeReferences(Section $section, array $outline): void
    {
        $references = $this->stringList($outline['references'] ?? null);

        if ($references === []) {
            return;
        }

        $section->addTitle($this->label('references'), 1);

        foreach ($references as $reference) {
            $section->addListItem($reference, 0, null, self::LIST_REFERENCES, ['spaceAfter' => 60]);
        }
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function writeKeywords(Section $section, array $outline): void
    {
        $keywords = $this->stringList($outline['keywords'] ?? null);

        if ($keywords === []) {
            return;
        }

        $run = $section->addTextRun(['spaceBefore' => 240]);
        $run->addText($this->label('keywords').': ', ['bold' => true]);
        $run->addText(implode(', ', $keywords));
    }

    /**
     * Writes "term — definition" entries under a heading; skips entries without a term.
     */
    private function writeTermList(Section $section, mixed $items, string $labelKey, int $depth): void
    {
        $entries = [];

        foreach (is_array($items) ? $items : [] as $item) {
            if (! is_array($item)) {
                continue;
            }

            $term = $this->clean($item['term'] ?? null);
            $definition = $this->clean($item['definition'] ?? null);

            if ($term === '') {
                continue;
            }

            $entries[] = [$term, $definition];
        }

        if ($entries === []) {
            return;
        }

        $section->addTitle($this->label($labelKey), $depth);

        foreach ($entries as [$term, $definition]) {
            $run = $section->addTextRun(['spaceAfter' => 80]);
            $run->addText($term, ['bold' => true]);

            if ($definition !== '') {
                $run->addText(' — '.$this->singleLine($definition));
            }
        }
    }

    private function writeExamples(Section $section, mixed $examples): void
    {
        $examples = $this->stringList($examples, keepNewlines: true);

        if ($examples === []) {
            return;
        }

        $section->addTitle($this->label('examples'), 2);

        foreach ($examples as $number => $example) {
            $paragraphs = $this->paragraphs($example);

            if ($paragraphs === []) {
                continue;
            }

            $run = $section->addTextRun();
            $run->addText($this->label('example').' '.($number + 1).'. ', ['italic' => true, 'bold' => true]);
            $run->addText(array_shift($paragraphs));

            $this->writeParagraphs($section, $paragraphs);
        }
    }

    /**
     * @param  list<string>  $paragraphs
     */
    private function writeParagraphs(Section $section, array $paragraphs): void
    {
        foreach ($paragraphs as $paragraph) {
            $section->addText($paragraph);
        }
    }

    /**
     * @param  array<string, mixed>  $outline
     * @return array<int, array<string, mixed>>
     */
    private function plannedSections(array $outline): array
    {
        $sections = [];

        foreach (array_values($outline['sections']) as $index => $planned) {
            $sections[$index] = is_array($planned) ? $planned : [];
        }

        return $sections;
    }

    /**
     * @param  array<string, mixed>  $planned
     * @param  array<string, mixed>|null  $generated
     */
    private function sectionTitle(array $planned, ?array $generated, int $index): string
    {
        $title = $this->singleLine($this->clean($generated['title'] ?? null));

        if ($title === '') {
            $title = $this->singleLine($this->clean($planned['title'] ?? null));
        }

        return $title !== '' ? $title : $this->label('section').' '.($index + 1);
    }

    /**
     * @param  array<string, mixed>  $outline
     */
    private function title(TeacherAiLesson $lesson, array $outline): string
    {
        $title = $this->singleLine($this->clean($outline['title'] ?? null));

        if ($title !== '') {
            return $title;
        }

        $fallback = trim($this->clean($lesson->subject).': '.$this->clean($lesson->topic), ': ');

        return $fallback !== '' ? $fallback : $this->label('lecture');
    }

    private function label(string $key): string
    {
        return $this->labels[$key] ?? $key;
    }

    /**
     * Normalizes any scalar to a trimmed UTF-8 string without control characters
     * (newlines and tabs are kept so paragraphs can be split later).
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

        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/[^\P{C}\n\t]+/u', '', $text) ?? '';

        return trim($text);
    }

    private function singleLine(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
    }

    /**
     * Splits text (or a list of texts) on blank lines / newlines into non-empty paragraphs.
     *
     * @return list<string>
     */
    private function paragraphs(mixed $value): array
    {
        $chunks = is_array($value) ? $value : [$value];
        $paragraphs = [];

        foreach ($chunks as $chunk) {
            foreach (explode("\n", $this->clean($chunk)) as $line) {
                $line = trim($line);

                if ($line !== '') {
                    $paragraphs[] = $line;
                }
            }
        }

        return $paragraphs;
    }

    /**
     * @return list<string>
     */
    private function stringList(mixed $items, bool $keepNewlines = false): array
    {
        $list = [];

        foreach (is_array($items) ? $items : [] as $item) {
            $text = $this->clean($item);

            if (! $keepNewlines) {
                $text = $this->singleLine($text);
            }

            if ($text !== '') {
                $list[] = $text;
            }
        }

        return $list;
    }

    private function tempFile(string $extension): string
    {
        $base = tempnam(sys_get_temp_dir(), 'lesson');

        if ($base === false) {
            throw new TeacherAiException('Не удалось подготовить файл лекции. Попробуйте ещё раз.');
        }

        $path = $base.'.'.$extension;

        if (! @rename($base, $path)) {
            @unlink($base);

            throw new TeacherAiException('Не удалось подготовить файл лекции. Попробуйте ещё раз.');
        }

        return $path;
    }
}
