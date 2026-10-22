<?php

namespace App\Services\Hr;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * .docx → .pdf with LibreOffice headless (binary from HR_LIBREOFFICE_BINARY). Every run gets its own
 * throw-away profile (-env:UserInstallation), so parallel conversions do not wait on each other's lock,
 * and runs under coreutils `timeout`, which kills the whole LibreOffice process group when it hangs.
 */
class DocxToPdfConverter
{
    public function isAvailable(): bool
    {
        $binary = $this->binary();

        return $binary !== null && is_file($binary) && is_executable($binary);
    }

    /**
     * @return string path of the PDF written next to the .docx
     *
     * @throws RuntimeException with a message safe to show (no personal data)
     */
    public function convert(string $docxPath): string
    {
        if (! $this->isAvailable()) {
            throw new RuntimeException('Предпросмотр недоступен: LibreOffice не установлен на сервере.');
        }

        $outDir = dirname($docxPath);
        $profile = storage_path('framework/libreoffice/'.Str::uuid());
        $timeout = max(5, (int) config('hr.libreoffice.timeout'));

        $command = [
            $this->binary(),
            '-env:UserInstallation=file://'.$profile,
            '--headless', '--norestore', '--nolockcheck', '--nologo',
            '--convert-to', 'pdf',
            '--outdir', $outDir,
            $docxPath,
        ];
        if (is_executable('/usr/bin/timeout')) {
            $command = array_merge(['/usr/bin/timeout', '--kill-after=5', (string) $timeout], $command);
        }

        try {
            $result = Process::timeout($timeout + 10)->run($command);
        } finally {
            File::deleteDirectory($profile);
        }

        $pdfPath = $outDir.'/'.pathinfo($docxPath, PATHINFO_FILENAME).'.pdf';

        if ($result->exitCode() === 124 || $result->exitCode() === 137) {
            throw new RuntimeException("Предпросмотр не построен: LibreOffice не ответил за {$timeout} с.");
        }
        if (! $result->successful() || ! is_file($pdfPath)) {
            Log::warning('HR preview: LibreOffice conversion failed', ['exit_code' => $result->exitCode(), 'error' => Str::limit($result->errorOutput(), 500)]);

            throw new RuntimeException('Предпросмотр не построен: ошибка LibreOffice.');
        }

        return $pdfPath;
    }

    private function binary(): ?string
    {
        $binary = trim((string) config('hr.libreoffice.binary'));

        return $binary === '' ? null : $binary;
    }
}
