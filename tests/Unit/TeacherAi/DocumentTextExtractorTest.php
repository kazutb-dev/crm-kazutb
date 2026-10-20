<?php

namespace Tests\Unit\TeacherAi;

use App\Services\TeacherAi\DocumentTextExtractor;
use App\Services\TeacherAi\TeacherAiReviewException;
use Illuminate\Support\Facades\Process;
use Tests\TestCase;
use ZipArchive;

class DocumentTextExtractorTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dir = sys_get_temp_dir() . '/teacher-ai-extractor-' . uniqid();
        mkdir($this->dir);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->dir . '/*') ?: [] as $file) {
            unlink($file);
        }

        rmdir($this->dir);

        parent::tearDown();
    }

    public function test_extracts_docx_paragraphs_and_keeps_table_rows_on_one_line(): void
    {
        $path = $this->makeDocx(
            '<w:p><w:r><w:t>Силлабус дисциплины</w:t></w:r></w:p>'
            . '<w:p><w:r><w:t>Цель &amp; задачи</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>курса</w:t></w:r></w:p>'
            . '<w:tbl>'
            . '<w:tr><w:tc><w:p><w:r><w:t>Неделя 1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Введение</w:t></w:r></w:p></w:tc></w:tr>'
            . '<w:tr><w:tc><w:p><w:r><w:t>Неделя 2</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Модели</w:t></w:r></w:p></w:tc></w:tr>'
            . '</w:tbl>'
        );

        $text = (new DocumentTextExtractor())->extract($path, 'docx');

        $this->assertStringContainsString('Силлабус дисциплины', $text);
        $this->assertStringContainsString("Цель & задачи\nкурса", $text);
        $this->assertStringContainsString('Неделя 1 | Введение |', $text);
        $this->assertStringContainsString('Неделя 2 | Модели |', $text);
        $this->assertStringNotContainsString('<w:', $text);
    }

    public function test_rejects_zip_that_is_not_a_word_document(): void
    {
        $path = $this->dir . '/fake.docx';
        $zip = new ZipArchive();
        $zip->open($path, ZipArchive::CREATE);
        $zip->addFromString('readme.txt', 'not a document');
        $zip->close();

        $this->expectException(TeacherAiReviewException::class);

        (new DocumentTextExtractor())->extract($path, 'docx');
    }

    public function test_converts_cp1251_text_files_to_utf8(): void
    {
        $path = $this->dir . '/plain.txt';
        file_put_contents($path, mb_convert_encoding("Рабочая   программа\r\n\r\n\r\n\r\nдисциплины", 'Windows-1251', 'UTF-8'));

        $text = (new DocumentTextExtractor())->extract($path, 'txt');

        $this->assertSame("Рабочая программа\n\nдисциплины", $text);
    }

    public function test_rejects_binary_file_renamed_to_txt(): void
    {
        $path = $this->dir . '/binary.txt';
        file_put_contents($path, "PK\x03\x04\0\0binary");

        $this->expectException(TeacherAiReviewException::class);

        (new DocumentTextExtractor())->extract($path, 'txt');
    }

    public function test_strips_utf8_bom(): void
    {
        $this->assertSame('Текст', (new DocumentTextExtractor())->normalize("\xEF\xBB\xBFТекст"));
    }

    public function test_rejects_unsupported_extension(): void
    {
        $this->expectException(TeacherAiReviewException::class);

        (new DocumentTextExtractor())->extract($this->dir . '/file.doc', 'doc');
    }

    public function test_reports_unreadable_pdf(): void
    {
        Process::fake(['*' => Process::result(errorOutput: 'Syntax Error', exitCode: 1)]);

        $this->expectException(TeacherAiReviewException::class);

        (new DocumentTextExtractor())->extract($this->dir . '/broken.pdf', 'pdf');
    }

    public function test_extracts_text_from_real_pdf(): void
    {
        if (trim((string) shell_exec('command -v pdftotext')) === '') {
            $this->markTestSkipped('pdftotext is not installed.');
        }

        $path = $this->dir . '/sample.pdf';
        file_put_contents($path, $this->makePdf('Syllabus Databases week one'));

        $text = (new DocumentTextExtractor())->extract($path, 'pdf');

        $this->assertStringContainsString('Syllabus Databases week one', $text);
    }

    private function makeDocx(string $bodyXml): string
    {
        $path = $this->dir . '/sample.docx';
        $zip = new ZipArchive();
        $zip->open($path, ZipArchive::CREATE);
        $zip->addFromString(
            'word/document.xml',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
            . $bodyXml
            . '</w:body></w:document>'
        );
        $zip->close();

        return $path;
    }

    private function makePdf(string $text): string
    {
        $stream = "BT /F1 12 Tf 72 720 Td ({$text}) Tj ET";
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length ' . strlen($stream) . " >>\nstream\n{$stream}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];

        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1) . " 0 obj\n{$object}\nendobj\n";
        }

        $xrefOffset = strlen($pdf);
        $pdf .= 'xref' . "\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";

        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf . 'trailer << /Size ' . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xrefOffset}\n%%EOF\n";
    }
}
