<?php

namespace Tests\Unit\Hr;

use App\Services\Hr\Docx\HrTemplateException;
use App\Services\Hr\Docx\HrTemplateProcessor;
use PHPUnit\Framework\TestCase;
use ZipArchive;

class HrTemplateProcessorTest extends TestCase
{
    /** @var list<string> */
    private array $files = [];

    protected function tearDown(): void
    {
        foreach ($this->files as $file) {
            @unlink($file);
        }

        parent::tearDown();
    }

    public function test_nested_blocks_keep_or_drop_independently(): void
    {
        $body = $this->p('before')
            .$this->p('${if_outer}').$this->p('outer text')
            .$this->p('${if_inner}').$this->p('inner text').$this->p('${/if_inner}')
            .$this->p('${/if_outer}').$this->p('after');

        $this->assertSame(['before', 'outer text', 'after'], $this->resolve($body, ['if_outer' => true, 'if_inner' => false]));
        $this->assertSame(['before', 'after'], $this->resolve($body, ['if_outer' => false, 'if_inner' => true]));
        $this->assertSame(['before', 'outer text', 'inner text', 'after'], $this->resolve($body, ['if_outer' => true, 'if_inner' => true]));
    }

    public function test_repeated_block_names_in_both_columns_resolve_each_occurrence(): void
    {
        $column = fn (string $lang) => $this->p("{$lang} 1.6").$this->p('${if_main}').$this->p("{$lang} main").$this->p('${/if_main}')
            .$this->p('${if_sovm}').$this->p("{$lang} part-time").$this->p('${/if_sovm}').$this->p("{$lang} 1.8");
        $body = $this->table([[$column('KZ'), $column('RU')]]);

        $this->assertSame(['KZ 1.6', 'KZ part-time', 'KZ 1.8', 'RU 1.6', 'RU part-time', 'RU 1.8'], $this->resolve($body, ['if_main' => false, 'if_sovm' => true]));
    }

    public function test_blocks_inside_a_nested_table_like_section_11(): void
    {
        $requisites = $this->table([[
            $this->p('ЖҰМЫС БЕРУШІ:').$this->p('${if_visa}').$this->p('_________ ${visa_name}').$this->p('${/if_visa}'),
            $this->p('ЖҰМЫСКЕР:').$this->p('${if_apt}').$this->p('пәтер').$this->p('${/if_apt}').$this->p('Тел:'),
        ]]);
        $body = $this->table([[$this->p('11. РЕКВИЗИТТЕР').$requisites.$this->p('ШАРТТЫ ТОҚТАТУ'), $this->p('11. РЕКВИЗИТЫ')]]);

        $this->assertSame(
            ['11. РЕКВИЗИТТЕР', 'ЖҰМЫС БЕРУШІ:', '_________ ${visa_name}', 'ЖҰМЫСКЕР:', 'Тел:', 'ШАРТТЫ ТОҚТАТУ', '11. РЕКВИЗИТЫ'],
            $this->resolve($body, ['if_visa' => true, 'if_apt' => false]),
        );
    }

    public function test_a_block_can_drop_a_whole_table(): void
    {
        $body = $this->p('5. Дети').$this->p('${if_has_children}').$this->table([[$this->p('ФИО'), $this->p('Дата рождения')]])
            .$this->p('${/if_has_children}').$this->p('${if_no_children}').$this->p('Нет').$this->p('${/if_no_children}');

        $this->assertSame(['5. Дети', 'Нет'], $this->resolve($body, ['if_has_children' => false, 'if_no_children' => true]));
    }

    public function test_a_cell_emptied_by_a_block_keeps_an_empty_paragraph(): void
    {
        $path = $this->docx($this->table([[$this->p('${if_x}').$this->p('only').$this->p('${/if_x}'), $this->p('right')]]));
        $processor = new HrTemplateProcessor($path);
        $processor->prepare(['if_x' => false]);

        $this->assertStringContainsString('<w:tc><w:p/></w:tc>', str_replace(["\n", ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'], '', $processor->mainPartXml()));
    }

    public function test_unclosed_block_is_reported(): void
    {
        $this->expectException(HrTemplateException::class);
        $this->expectExceptionMessage('Блок ${if_prob} не закрыт: нет ${/if_prob}.');

        $this->resolve($this->p('${if_prob}').$this->p('2.3. …'), ['if_prob' => true]);
    }

    public function test_crossed_blocks_are_reported(): void
    {
        $this->expectException(HrTemplateException::class);
        $this->expectExceptionMessage('Блок ${if_b} закрыт тегом ${/if_a}');

        $this->resolve($this->p('${if_a}').$this->p('${if_b}').$this->p('${/if_a}').$this->p('${/if_b}'), ['if_a' => true, 'if_b' => true]);
    }

    public function test_a_block_spanning_two_cells_is_reported(): void
    {
        $this->expectException(HrTemplateException::class);
        $this->expectExceptionMessage('начинается и заканчивается в разных ячейках');

        $this->resolve($this->table([[$this->p('${if_a}').$this->p('kz'), $this->p('ru').$this->p('${/if_a}')]]), ['if_a' => true]);
    }

    public function test_a_block_without_a_condition_is_reported(): void
    {
        $this->expectException(HrTemplateException::class);
        $this->expectExceptionMessage('В шаблоне есть блок ${if_unknown}, для которого нет условия.');

        $this->resolve($this->p('${if_unknown}').$this->p('x').$this->p('${/if_unknown}'), []);
    }

    public function test_values_are_escaped_and_line_breaks_kept(): void
    {
        $path = $this->docx($this->p('Работодатель: ${emp_name}').$this->p('${emp_address}'));
        $processor = new HrTemplateProcessor($path);
        $processor->prepare([]);
        $processor->fill(['emp_name' => 'АО «A & B» <test>', 'emp_address' => "Астана қ.\nҚайым Мұхамедханов к. 37А"]);

        $xml = $processor->mainPartXml();
        $this->assertStringContainsString('Работодатель: АО «A &amp; B» &lt;test&gt;', $xml);
        $this->assertStringContainsString('Астана қ.</w:t><w:br/><w:t xml:space="preserve">Қайым Мұхамедханов к. 37А', $xml);
    }

    public function test_fill_ignores_global_output_escaping(): void
    {
        \PhpOffice\PhpWord\Settings::setOutputEscapingEnabled(true);
        try {
            $processor = new HrTemplateProcessor($this->docx($this->p('${v}')));
            $processor->fill(['v' => 'A & B']);

            $this->assertStringContainsString('A &amp; B', $processor->mainPartXml());
            $this->assertStringNotContainsString('&amp;amp;', $processor->mainPartXml());
            $this->assertTrue(\PhpOffice\PhpWord\Settings::isOutputEscapingEnabled());
        } finally {
            \PhpOffice\PhpWord\Settings::setOutputEscapingEnabled(false);
        }
    }

    public function test_highlight_is_removed_only_from_tag_runs(): void
    {
        $highlighted = fn (string $text) => '<w:p><w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t xml:space="preserve">'.$text.'</w:t></w:r></w:p>';
        $processor = new HrTemplateProcessor($this->docx($highlighted('${fio}').$highlighted('12.30')));
        $processor->prepare([]);

        $this->assertSame(1, substr_count($processor->mainPartXml(), '<w:highlight'));
        $this->assertMatchesRegularExpression('/<w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">12\.30/', $processor->mainPartXml());
    }

    public function test_word_split_macro_is_glued_back(): void
    {
        $split = '<w:p><w:r><w:t>$</w:t></w:r><w:proofErr w:type="spellStart"/><w:r><w:rPr><w:b/></w:rPr><w:t>{fi</w:t></w:r><w:r><w:t>o}</w:t></w:r></w:p>';
        $processor = new HrTemplateProcessor($this->docx($split));
        $processor->fill(['fio' => 'Иванова Мария Петровна']);

        $this->assertStringContainsString('Иванова Мария Петровна', $processor->mainPartXml());
        $this->assertStringNotContainsString('{fi', $processor->mainPartXml());
    }

    /**
     * @param  array<string, bool>  $flags
     * @return list<string> non-empty paragraph texts after the blocks are resolved
     */
    private function resolve(string $body, array $flags): array
    {
        $processor = new HrTemplateProcessor($this->docx($body));
        $processor->prepare($flags);
        [, $xpath] = HrTemplateProcessor::load($processor->mainPartXml());

        $texts = [];
        foreach ($xpath->query('//w:p') as $paragraph) {
            $text = HrTemplateProcessor::paragraphText($xpath, $paragraph);
            if ($text !== '') {
                $texts[] = $text;
            }
        }

        return $texts;
    }

    private function p(string $text): string
    {
        return '<w:p><w:r><w:t xml:space="preserve">'.htmlspecialchars($text, ENT_XML1).'</w:t></w:r></w:p>';
    }

    /**
     * @param  list<list<string>>  $rows  cell XML per row
     */
    private function table(array $rows): string
    {
        $xml = '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>';
        foreach ($rows as $cells) {
            $xml .= '<w:tr>'.implode('', array_map(fn (string $cell) => '<w:tc>'.$cell.'</w:tc>', $cells)).'</w:tr>';
        }

        return $xml.'</w:tbl>';
    }

    private function docx(string $body): string
    {
        $path = tempnam(sys_get_temp_dir(), 'hr-tpl-').'.docx';
        $this->files[] = $path;

        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            .'<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
        $zip->addFromString('word/settings.xml', '<?xml version="1.0" encoding="UTF-8"?><w:settings xmlns:w="'.HrTemplateProcessor::WORD_NS.'"/>');
        $zip->addFromString('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="'.HrTemplateProcessor::WORD_NS.'"><w:body>'.$body.'</w:body></w:document>');
        $zip->close();

        return $path;
    }
}
