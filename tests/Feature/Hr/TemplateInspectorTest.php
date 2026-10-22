<?php

namespace Tests\Feature\Hr;

use App\Models\HrDocumentTemplate;
use App\Services\Hr\Docx\HrTemplateProcessor;
use App\Services\Hr\Docx\TemplateInspector;
use Tests\TestCase;
use ZipArchive;

class TemplateInspectorTest extends TestCase
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

    public function test_built_in_templates_pass(): void
    {
        foreach (array_keys(HrDocumentTemplate::TYPE_LABELS) as $type) {
            $report = app(TemplateInspector::class)->inspect(HrDocumentTemplate::builtInPath($type), $type);

            $this->assertSame([], $report['errors'], $type);
            $this->assertNotEmpty($report['tags']);
        }
    }

    public function test_contract_template_has_no_pcre_dependency(): void
    {
        // The DOM block resolver must work with the stock PCRE limits on the 560 KB contract.
        $this->assertSame('1000000', ini_get('pcre.backtrack_limit'));

        $processor = new HrTemplateProcessor(HrDocumentTemplate::builtInPath(HrDocumentTemplate::TYPE_CONTRACT));
        $processor->prepare(array_fill_keys(['if_main', 'if_has_end', 'if_prob', 'if_week', 'if_sched_pps'], true)
            + array_fill_keys(['if_sovm', 'if_sched_aup', 'if_sched_shift'], false));

        $this->assertDoesNotMatchRegularExpression('/\$\{\/?if_/', $processor->mainPartXml());
    }

    public function test_split_tag_that_word_left_broken_is_reported(): void
    {
        // A closing brace in its own run after a field code: PhpWord cannot glue this back.
        $broken = '<w:p><w:r><w:t>Работник ${f</w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t>io}</w:t></w:r></w:p>';

        $errors = $this->inspect($broken.$this->p('${num} ${iin} ${position_full_ru} ${position_full_kz} ${start_ru} ${start_kz} ${salary}'));

        // PhpWord glues the pieces together with the field result inside: the tag becomes unknown and is reported.
        $this->assertContains('Неизвестный тег «${f1io}». Проверьте написание: тег мог быть разбит форматированием Word. Список тегов — в инструкции ОУП.', $errors);
    }

    public function test_unknown_tags_misplaced_blocks_and_missing_required_tags_are_reported(): void
    {
        $errors = $this->inspect(
            $this->p('Оклад ${salary} ${zarplata}')
            .$this->p('${if_prob} 2.3. Испытательный срок')
            .$this->p('${/if_prob}')
            .$this->p('${edu_level}'),
        );

        $this->assertContains('Неизвестный тег «${zarplata}». Проверьте написание: тег мог быть разбит форматированием Word. Список тегов — в инструкции ОУП.', $errors);
        $this->assertContains('Тег блока «${if_prob}» должен стоять в отдельном абзаце (абзац «${if_prob} 2.3. Испытательный срок»).', $errors);
        $this->assertContains('Тег строки таблицы «${edu_level}» должен стоять в строке таблицы.', $errors);
        $this->assertContains('Закрывающий ${/if_prob} без открывающего ${if_prob}.', $errors);
        $this->assertContains('В шаблоне нет обязательного тега «${fio}».', $errors);
    }

    public function test_not_a_word_file(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'hr-bad-');
        $this->files[] = $path;
        file_put_contents($path, '%PDF-1.4');

        $this->assertSame(['Файл не является документом Word (.docx).'], app(TemplateInspector::class)->inspect($path, HrDocumentTemplate::TYPE_CONTRACT)['errors']);
    }

    /**
     * @return list<string>
     */
    private function inspect(string $body): array
    {
        $path = HrDocumentTemplate::builtInPath(HrDocumentTemplate::TYPE_ORDER);
        $copy = tempnam(sys_get_temp_dir(), 'hr-tpl-').'.docx';
        $this->files[] = $copy;
        copy($path, $copy);

        $zip = new ZipArchive;
        $zip->open($copy);
        $zip->addFromString('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="'.HrTemplateProcessor::WORD_NS.'"><w:body>'.$body.'</w:body></w:document>');
        $zip->close();

        return app(TemplateInspector::class)->inspect($copy, HrDocumentTemplate::TYPE_CONTRACT)['errors'];
    }

    private function p(string $text): string
    {
        return '<w:p><w:r><w:t xml:space="preserve">'.htmlspecialchars($text, ENT_XML1).'</w:t></w:r></w:p>';
    }
}
