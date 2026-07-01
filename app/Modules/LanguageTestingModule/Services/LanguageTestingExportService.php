<?php

namespace App\Modules\LanguageTestingModule\Services;

use App\Modules\LanguageTestingModule\DTO\LanguageTestingStatisticsFiltersData;
use App\Modules\LanguageTestingModule\Repositories\LanguageTestingRepository;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class LanguageTestingExportService
{
    public function __construct(
        private readonly LanguageTestingRepository $repository,
        private readonly LanguageTestingService $service,
    ) {
    }

    public function csvFilename(): string
    {
        return 'language-testing-statistics-' . now()->format('Ymd_His') . '.csv';
    }

    public function excelFilename(): string
    {
        return 'language-testing-statistics-' . now()->format('Ymd_His') . '.xlsx';
    }

    /**
     * @return array<int, string>
     */
    public function headings(): array
    {
        return [
            'ID',
            'Имя',
            'Фамилия',
            'Email',
            'Телефон',
            'Язык теста',
            'Название теста',
            'Количество правильных ответов',
            'Количество вопросов',
            'Итоговый балл',
            'Процент',
            'Статус',
            'Дата прохождения',
        ];
    }

    /**
     * @return array<int, array<int, string|int|float|null>>
     */
    public function rows(LanguageTestingStatisticsFiltersData $filters): array
    {
        return $this->repository->resultsForExport($filters)
            ->map(function ($result): array {
                $serialized = $this->service->serializeResult($result);

                return [
                    $serialized['id'],
                    $serialized['first_name'],
                    $serialized['last_name'],
                    $serialized['email'],
                    $serialized['phone'],
                    $serialized['language_label'],
                    $serialized['test_name'],
                    $serialized['correct_answers'],
                    $serialized['total_questions'],
                    $serialized['score'],
                    $serialized['percentage'],
                    $serialized['status_label'],
                    $serialized['submitted_at'],
                ];
            })
            ->all();
    }

    public function createExcelFile(LanguageTestingStatisticsFiltersData $filters): string
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->fromArray($this->headings(), null, 'A1');
        $sheet->fromArray($this->rows($filters), null, 'A2');

        $path = storage_path('app/tmp/' . $this->excelFilename());
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0775, true);
        }

        $writer = new Xlsx($spreadsheet);
        $writer->save($path);

        return $path;
    }
}