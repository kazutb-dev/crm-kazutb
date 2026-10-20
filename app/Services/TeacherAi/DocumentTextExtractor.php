<?php

namespace App\Services\TeacherAi;

use Illuminate\Support\Facades\Process;
use ZipArchive;

class DocumentTextExtractor
{
    public const EXTENSIONS = ['pdf', 'docx', 'txt'];

    /**
     * Upper bound for the unpacked word/document.xml, protects against zip bombs.
     */
    private const MAX_DOCX_XML_BYTES = 30 * 1024 * 1024;

    public function extract(string $path, string $extension): string
    {
        $text = match (strtolower($extension)) {
            'pdf' => $this->extractPdf($path),
            'docx' => $this->extractDocx($path),
            'txt' => $this->extractTxt($path),
            default => throw new TeacherAiReviewException('Формат файла не поддерживается. Загрузите PDF, DOCX или TXT.'),
        };

        return $this->normalize($text);
    }

    public function normalize(string $text): string
    {
        if (str_starts_with($text, "\xEF\xBB\xBF")) {
            $text = substr($text, 3);
        }

        if (! mb_check_encoding($text, 'UTF-8')) {
            // Plain-text exports from Russian-locale Windows are usually CP1251.
            $text = mb_convert_encoding($text, 'UTF-8', 'Windows-1251');
        }

        $text = str_replace(["\r\n", "\r", "\0", "\f"], ["\n", "\n", '', "\n"], $text);
        $text = preg_replace('/[ \t\x{00A0}]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/ *\n */', "\n", $text) ?? $text;
        $text = preg_replace('/\n{3,}/', "\n\n", $text) ?? $text;

        return trim($text);
    }

    private function extractPdf(string $path): string
    {
        $binary = (string) config('services.teacher_ai.pdftotext_binary', 'pdftotext');

        $result = Process::timeout(30)->run([$binary, '-enc', 'UTF-8', '-q', $path, '-']);

        if (! $result->successful()) {
            throw new TeacherAiReviewException('Не удалось прочитать PDF. Проверьте, что файл не повреждён и не защищён паролем.');
        }

        return $result->output();
    }

    private function extractDocx(string $path): string
    {
        $zip = new ZipArchive();

        if ($zip->open($path) !== true) {
            throw new TeacherAiReviewException('Не удалось открыть DOCX. Проверьте, что файл не повреждён.');
        }

        try {
            $stat = $zip->statName('word/document.xml');

            if ($stat === false) {
                throw new TeacherAiReviewException('Файл не похож на документ Word (DOCX).');
            }

            if ((int) $stat['size'] > self::MAX_DOCX_XML_BYTES) {
                throw new TeacherAiReviewException('Документ слишком большой для проверки.');
            }

            $xml = $zip->getFromName('word/document.xml');
        } finally {
            $zip->close();
        }

        if ($xml === false) {
            throw new TeacherAiReviewException('Не удалось прочитать содержимое DOCX.');
        }

        // Keep table rows on one line ("cell | cell | ...") so weekly plans and
        // grading tables stay readable for the model.
        $xml = preg_replace('/<\/w:p>\s*<\/w:tc>/', '</w:tc>', $xml) ?? $xml;
        $xml = str_replace(['</w:tc>', '</w:tr>', '</w:p>', '<w:tab/>'], [' | ', "\n", "\n", ' '], $xml);
        $xml = preg_replace('/<w:(br|cr)\b[^>]*\/>/', "\n", $xml) ?? $xml;

        return html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    private function extractTxt(string $path): string
    {
        $content = @file_get_contents($path);

        if ($content === false) {
            throw new TeacherAiReviewException('Не удалось прочитать текстовый файл.');
        }

        if (str_contains($content, "\0")) {
            throw new TeacherAiReviewException('Файл не похож на текстовый. Загрузите PDF или DOCX.');
        }

        return $content;
    }
}
