<?php

/**
 * Minimal run-aware editor for word/document.xml used to turn the sample contract into a template.
 * Paragraphs are addressed by their index in document order (see index.php), captured once up front,
 * so later deletions/insertions do not shift the addresses.
 */
final class DocxEditor
{
    public const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    public DOMDocument $dom;

    public DOMXPath $xp;

    /** @var list<DOMElement> */
    private array $paras = [];

    public function __construct(string $xml)
    {
        $this->dom = new DOMDocument;
        $this->dom->preserveWhiteSpace = true;
        $this->dom->loadXML($xml);
        $this->xp = new DOMXPath($this->dom);
        $this->xp->registerNamespace('w', self::W);
        foreach ($this->xp->query('//w:body//w:p') as $p) {
            $this->paras[] = $p;
        }
    }

    public function p(int $i): DOMElement
    {
        return $this->paras[$i] ?? throw new RuntimeException("No paragraph #$i");
    }

    public function text(int $i): string
    {
        return implode('', array_column($this->segments($this->p($i)), 'text'));
    }

    /** Replace a literal fragment of the paragraph text; the replacement inherits the formatting of the first run it touches. */
    public function replace(int $i, string $search, string $replacement): self
    {
        $p = $this->p($i);
        $segments = $this->segments($p);
        $full = implode('', array_column($segments, 'text'));
        if (str_starts_with($search, '/')) {
            if (preg_match_all($search.'u', $full, $m, PREG_OFFSET_CAPTURE) !== 1) {
                throw new RuntimeException("#$i: {$search} must match exactly once in «{$full}»");
            }
            $start = mb_strlen(substr($full, 0, $m[0][0][1]));
            $end = $start + mb_strlen($m[0][0][0]);
        } else {
            $start = mb_strpos($full, $search);
            if ($start === false || mb_substr_count($full, $search) !== 1) {
                throw new RuntimeException("#$i: «{$search}» not found exactly once in «{$full}»");
            }
            $end = $start + mb_strlen($search);
        }
        $inserted = false;
        foreach ($segments as $seg) {
            $segStart = $seg['start'];
            $segEnd = $segStart + mb_strlen($seg['text']);
            if ($segEnd <= $start || $segStart >= $end) {
                continue;
            }
            $before = mb_substr($seg['text'], 0, max(0, $start - $segStart));
            $after = mb_substr($seg['text'], max(0, $end - $segStart));
            $this->setRunText($seg['run'], $before.($inserted ? '' : $replacement).$after);
            $inserted = true;
        }

        return $this;
    }

    /** Replace the whole paragraph text (first run keeps its formatting, the other runs go away). */
    public function setText(int $i, string $text): self
    {
        $segments = $this->segments($this->p($i));
        foreach ($segments as $k => $seg) {
            $this->setRunText($seg['run'], $k === 0 ? $text : '');
        }

        return $this;
    }

    public function delete(int ...$indexes): self
    {
        foreach ($indexes as $i) {
            $p = $this->p($i);
            $p->parentNode->removeChild($p);
        }

        return $this;
    }

    /** Insert a copy of paragraph $like (its pPr and first-run rPr) right after paragraph $after, holding $text. */
    public function insertAfter(int $after, int $like, string $text): self
    {
        $model = $this->p($like);
        $new = $this->dom->createElementNS(self::W, 'w:p');
        $pPr = $this->xp->query('./w:pPr', $model)->item(0);
        if ($pPr) {
            $new->appendChild($pPr->cloneNode(true));
        }
        $run = $this->dom->createElementNS(self::W, 'w:r');
        $rPr = $this->xp->query('.//w:r/w:rPr', $model)->item(0);
        if ($rPr) {
            $run->appendChild($rPr->cloneNode(true));
        }
        $new->appendChild($run);
        $this->setRunText($run, $text);
        $ref = $this->p($after);
        $ref->parentNode->insertBefore($new, $ref->nextSibling);

        return $this;
    }

    /** Insert, right after paragraph $after, a new block ${name} holding one paragraph formatted like $like. */
    public function blockAfter(int $after, int $like, string $name, string $text): self
    {
        $ref = $this->p($after);
        $this->insertAfter($after, $like, $text);
        $new = $ref->nextSibling;
        $new->parentNode->insertBefore($this->markerParagraph('${'.$name.'}'), $new);
        $new->parentNode->insertBefore($this->markerParagraph('${/'.$name.'}'), $new->nextSibling);

        return $this;
    }

    /** Wrap paragraphs [$from..$to] (same container) with block marker paragraphs ${name} / ${/name}. */
    public function block(string $name, int $from, int $to): self
    {
        $first = $this->p($from);
        $last = $this->p($to);
        $first->parentNode->insertBefore($this->markerParagraph('${'.$name.'}'), $first);
        $last->parentNode->insertBefore($this->markerParagraph('${/'.$name.'}'), $last->nextSibling);

        return $this;
    }

    /** The sample marks fill-in places with a yellow highlight; runs that now hold ${tags} lose it. */
    public function stripMacroHighlight(): self
    {
        foreach ($this->xp->query('//w:r[w:t[contains(., "${")]]/w:rPr/w:highlight') as $highlight) {
            $highlight->parentNode->removeChild($highlight);
        }

        return $this;
    }

    /**
     * Highlighted runs left in the document, grouped by paragraph: [column, paragraph text, highlighted fragments].
     *
     * @return list<array{string, string, list<string>}>
     */
    public function highlightReport(): array
    {
        $report = [];
        foreach ($this->xp->query('//w:body//w:p[.//w:r/w:rPr/w:highlight]') as $p) {
            $cells = $this->xp->query('ancestor::w:tc', $p);
            $column = 'вне таблицы';
            if ($cells->length) {
                $column = $this->xp->query('preceding-sibling::w:tc', $cells->item(0))->length ? 'RU' : 'KZ';
                $column .= $cells->length > 1 ? ', раздел 11' : '';
            }
            $fragments = [];
            foreach ($this->xp->query('.//w:r[w:rPr/w:highlight]', $p) as $run) {
                $fragments[] = implode('', array_map(fn ($t) => $t->textContent, iterator_to_array($this->xp->query('./w:t', $run))));
            }
            $text = '';
            foreach ($this->xp->query('.//w:t', $p) as $t) {
                $text .= $t->textContent;
            }
            $report[] = [$column, $text, $fragments];
        }

        return $report;
    }

    public function xml(): string
    {
        return $this->dom->saveXML();
    }

    private function markerParagraph(string $text): DOMElement
    {
        $p = $this->dom->createElementNS(self::W, 'w:p');
        $r = $this->dom->createElementNS(self::W, 'w:r');
        $t = $this->dom->createElementNS(self::W, 'w:t', $text);
        $r->appendChild($t);
        $p->appendChild($r);

        return $p;
    }

    /** @return list<array{run: DOMElement, start: int, text: string}> */
    private function segments(DOMElement $p): array
    {
        $out = [];
        $pos = 0;
        foreach ($this->xp->query('.//w:r', $p) as $run) {
            $text = '';
            foreach ($run->childNodes as $child) {
                if (! $child instanceof DOMElement || $child->localName === 'rPr') {
                    continue;
                }
                $text .= match ($child->localName) {
                    't' => $child->textContent,
                    'tab' => "\t",
                    'br' => "\n",
                    'lastRenderedPageBreak' => '',
                    default => throw new RuntimeException('Unsupported run child w:'.$child->localName),
                };
            }
            $out[] = ['run' => $run, 'start' => $pos, 'text' => $text];
            $pos += mb_strlen($text);
        }

        return $out;
    }

    private function setRunText(DOMElement $run, string $text): void
    {
        // A run emptied by a replacement goes away instead of lingering with its (highlighted) formatting.
        if ($text === '' && $run->parentNode !== null) {
            $run->parentNode->removeChild($run);

            return;
        }

        foreach (iterator_to_array($run->childNodes) as $child) {
            if (! ($child instanceof DOMElement && $child->localName === 'rPr')) {
                $run->removeChild($child);
            }
        }
        foreach (preg_split("/(\t|\n)/u", $text, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) as $piece) {
            if ($piece === "\t" || $piece === "\n") {
                $run->appendChild($this->dom->createElementNS(self::W, $piece === "\t" ? 'w:tab' : 'w:br'));

                continue;
            }
            $t = $this->dom->createElementNS(self::W, 'w:t');
            $t->appendChild($this->dom->createTextNode($piece));
            $t->setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
            $run->appendChild($t);
        }
    }
}
