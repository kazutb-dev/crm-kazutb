<?php

namespace App\Services\Hr\Docx;

use Throwable;
use ZipArchive;

/**
 * Checks a .docx template before it is used: tags split by Word formatting that PhpWord cannot glue back,
 * unknown tags, unbalanced blocks, block tags sharing a paragraph with text, row tags outside a table,
 * required tags missing for the document type.
 */
final class TemplateInspector
{
    /** The sample contract unpacks to ~0.6 MB; anything far larger is not a real template (zip bomb guard). */
    public const MAX_DOCUMENT_XML_BYTES = 20 * 1024 * 1024;

    /**
     * @return array{errors: list<string>, tags: list<string>}
     */
    public function inspect(string $path, string $type): array
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true || $zip->locateName('word/document.xml') === false) {
            return ['errors' => ['Файл не является документом Word (.docx).'], 'tags' => []];
        }
        $size = $zip->statName('word/document.xml')['size'] ?? 0;
        $zip->close();
        if ($size > self::MAX_DOCUMENT_XML_BYTES) {
            return ['errors' => ['Документ слишком большой для шаблона.'], 'tags' => []];
        }

        try {
            $processor = new HrTemplateProcessor($path);
            [, $xpath] = HrTemplateProcessor::load($processor->mainPartXml());
        } catch (Throwable) {
            return ['errors' => ['Не удалось прочитать документ Word: файл повреждён.'], 'tags' => []];
        }

        $errors = [];
        $xmlTags = array_values(array_unique($processor->getVariables()));

        foreach ($xmlTags as $tag) {
            if (str_contains($tag, '<') || str_contains($tag, '>')) {
                $errors[] = 'Тег «${'.strip_tags($tag).'}» разбит форматированием Word. Удалите его и напечатайте заново целиком, без смены шрифта внутри тега.';
            }
        }

        foreach ($xpath->query('//w:p') as $paragraph) {
            $text = HrTemplateProcessor::paragraphText($xpath, $paragraph);
            if (! str_contains($text, '${')) {
                continue;
            }

            preg_match_all('/\$\{([^{}$]*)\}/u', $text, $matches);
            foreach ($matches[1] as $tag) {
                if (! in_array($tag, $xmlTags, true)) {
                    $errors[] = 'Тег «${'.$tag.'}» разбит форматированием Word (абзац «'.self::excerpt($text).'»). Удалите его и напечатайте заново целиком.';
                }
                if (preg_match(HrTemplateProcessor::BLOCK_PATTERN, '${'.$tag.'}') && trim($text) !== '${'.$tag.'}') {
                    $errors[] = 'Тег блока «${'.$tag.'}» должен стоять в отдельном абзаце (абзац «'.self::excerpt($text).'»).';
                }
                $base = explode(':', $tag, 2)[0];
                if (array_key_exists($base, HrTemplateCatalog::ROWS) && $xpath->query('ancestor::w:tr', $paragraph)->length === 0) {
                    $errors[] = 'Тег строки таблицы «${'.$tag.'}» должен стоять в строке таблицы.';
                }
            }

            if (preg_match('/\$\{[^}]*$/u', $text)) {
                $errors[] = 'Незакрытый тег в абзаце «'.self::excerpt($text).'»: не хватает «}».';
            }
        }

        foreach ($xmlTags as $tag) {
            if (! str_contains($tag, '<') && ! HrTemplateCatalog::isKnownTag($tag)) {
                $errors[] = 'Неизвестный тег «${'.$tag.'}». Проверьте написание: тег мог быть разбит форматированием Word. Список тегов — в инструкции ОУП.';
            }
        }

        try {
            HrTemplateProcessor::blockPairs($xpath);
        } catch (HrTemplateException $e) {
            $errors[] = $e->getMessage();
        }

        foreach (HrTemplateCatalog::REQUIRED[$type] ?? [] as $required) {
            if (! in_array($required, $xmlTags, true)) {
                $errors[] = 'В шаблоне нет обязательного тега «${'.$required.'}».';
            }
        }

        return ['errors' => array_values(array_unique($errors)), 'tags' => $xmlTags];
    }

    private static function excerpt(string $text): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', $text));

        return mb_strlen($text) > 80 ? mb_substr($text, 0, 77).'…' : $text;
    }
}
