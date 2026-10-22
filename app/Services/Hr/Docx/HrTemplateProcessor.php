<?php

namespace App\Services\Hr\Docx;

use DOMDocument;
use DOMElement;
use DOMXPath;
use PhpOffice\PhpWord\Settings;
use PhpOffice\PhpWord\TemplateProcessor;

/**
 * PhpWord TemplateProcessor with conditional blocks resolved over the DOM.
 *
 * PhpWord's own cloneBlock/deleteBlock use regular expressions over the whole document; on the 560 KB
 * contract they hit the PCRE backtrack limit and silently do nothing. Here a block is a pair of paragraphs
 * that hold only `${if_name}` and `${/if_name}`; everything between them (paragraphs, tables) is kept or
 * removed. Blocks may be nested and a name may repeat (KZ and RU columns use the same names).
 * Values and Word's split macros (fixBrokenMacros) are still handled by PhpWord.
 */
class HrTemplateProcessor extends TemplateProcessor
{
    public const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    /** `${if_…}` opens a block, `${/if_…}` closes it. */
    public const BLOCK_PATTERN = '/^\$\{(\/?)(if_[a-z0-9_]+)\}$/';

    /**
     * Removes the fill-in highlight from runs that hold macros and resolves the blocks.
     *
     * @param  array<string, bool>  $flags  block name => keep its content
     *
     * @throws HrTemplateException on unbalanced blocks or a block without a flag
     */
    public function prepare(array $flags): void
    {
        [$dom, $xpath] = self::load($this->tempDocumentMainPart);

        self::stripMacroHighlight($xpath);

        foreach (self::blockPairs($xpath) as [$name, $open, $close]) {
            if (! array_key_exists($name, $flags)) {
                throw new HrTemplateException("В шаблоне есть блок \${{$name}}, для которого нет условия.");
            }

            if (! $flags[$name]) {
                for ($node = $open->nextSibling; $node !== null && $node !== $close; $node = $next) {
                    $next = $node->nextSibling;
                    $node->parentNode->removeChild($node);
                }
            }

            $open->parentNode->removeChild($open);
            $close->parentNode->removeChild($close);
        }

        // Word refuses a table cell without a paragraph.
        foreach ($xpath->query('//w:tc[not(w:p)]') as $cell) {
            $cell->appendChild($dom->createElementNS(self::WORD_NS, 'w:p'));
        }

        $this->tempDocumentMainPart = $dom->saveXML();
    }

    /**
     * Sets plain-text values: XML-escaped here, "\n" becomes a line break inside the run.
     *
     * @param  array<string, string>  $values
     */
    public function fill(array $values): void
    {
        $escapingWasEnabled = Settings::isOutputEscapingEnabled();
        Settings::setOutputEscapingEnabled(false);

        try {
            foreach ($values as $macro => $value) {
                $this->setValue($macro, self::xmlText((string) $value));
            }
        } finally {
            Settings::setOutputEscapingEnabled($escapingWasEnabled);
        }
    }

    /**
     * Repeats the table row holding `${$macro}` once per item and fills it; an empty list removes the row.
     *
     * @param  list<array<string, string>>  $rows
     */
    public function fillRows(string $macro, array $rows): void
    {
        if (! in_array($macro, $this->getVariables(), true)) {
            return;
        }

        $this->cloneRow($macro, count($rows));

        $values = [];
        foreach ($rows as $index => $row) {
            foreach ($row as $name => $value) {
                $values[$name.'#'.($index + 1)] = $value;
            }
        }
        $this->fill($values);
    }

    /** Main document XML after PhpWord glued Word's split macros back together. */
    public function mainPartXml(): string
    {
        return $this->tempDocumentMainPart;
    }

    public static function xmlText(string $value): string
    {
        $escaped = htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');

        return str_replace("\n", '</w:t><w:br/><w:t xml:space="preserve">', $escaped);
    }

    /**
     * @return array{DOMDocument, DOMXPath}
     */
    public static function load(string $xml): array
    {
        $dom = new DOMDocument;
        $dom->preserveWhiteSpace = true;
        if (! @$dom->loadXML($xml, LIBXML_PARSEHUGE)) {
            throw new HrTemplateException('Файл шаблона повреждён: document.xml не читается.');
        }

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('w', self::WORD_NS);

        return [$dom, $xpath];
    }

    /** Visible text of a paragraph (runs only; tabs and breaks ignored). */
    public static function paragraphText(DOMXPath $xpath, DOMElement $paragraph): string
    {
        $text = '';
        foreach ($xpath->query('.//w:t', $paragraph) as $node) {
            $text .= $node->textContent;
        }

        return $text;
    }

    /**
     * Matched block marker paragraphs, innermost first.
     *
     * @return list<array{string, DOMElement, DOMElement}>
     *
     * @throws HrTemplateException
     */
    public static function blockPairs(DOMXPath $xpath): array
    {
        $stack = [];
        $pairs = [];

        foreach ($xpath->query('//w:p') as $paragraph) {
            if (! preg_match(self::BLOCK_PATTERN, trim(self::paragraphText($xpath, $paragraph)), $match)) {
                continue;
            }

            [, $closing, $name] = $match;
            if ($closing === '') {
                $stack[] = [$name, $paragraph];

                continue;
            }

            $open = array_pop($stack);
            if ($open === null) {
                throw new HrTemplateException("Закрывающий \${/{$name}} без открывающего \${{$name}}.");
            }
            if ($open[0] !== $name) {
                throw new HrTemplateException("Блок \${{$open[0]}} закрыт тегом \${/{$name}}: проверьте вложенность блоков.");
            }
            if (! $open[1]->parentNode->isSameNode($paragraph->parentNode)) {
                throw new HrTemplateException("Блок \${{$name}} начинается и заканчивается в разных ячейках или уровнях таблицы.");
            }

            $pairs[] = [$name, $open[1], $paragraph];
        }

        if ($stack !== []) {
            throw new HrTemplateException("Блок \${{$stack[0][0]}} не закрыт: нет \${/{$stack[0][0]}}.");
        }

        return $pairs;
    }

    /**
     * The sample marks every fill-in place with a yellow highlight; substituted values must not keep it.
     */
    private static function stripMacroHighlight(DOMXPath $xpath): void
    {
        foreach ($xpath->query('//w:r[w:t[contains(., "${")]]/w:rPr/w:highlight') as $highlight) {
            $highlight->parentNode->removeChild($highlight);
        }
    }
}
