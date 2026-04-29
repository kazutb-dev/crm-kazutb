<?php

namespace App\Services;

use App\Models\AcademicYear;
use App\Models\Department;
use App\Models\Diploma;
use App\Models\EducationalProgram;
use App\Models\Faculty;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class DiplomaImportService
{
    public function __construct(
        private readonly TopicSimilarityService $similarityService,
    ) {
    }

    /**
     * @return array{imported:int,errors:list<string>}
     */
    public function importFromCsv(UploadedFile|string $file): array
    {
        $path = $file instanceof UploadedFile ? $file->getRealPath() : $file;

        if (!is_string($path) || !is_file($path)) {
            return [
                'imported' => 0,
                'errors' => ['CSV файл не найден.'],
            ];
        }

        $handle = fopen($path, 'r');

        if ($handle === false) {
            return [
                'imported' => 0,
                'errors' => ['Не удалось открыть CSV файл.'],
            ];
        }

        $header = fgetcsv($handle);

        if (!is_array($header)) {
            fclose($handle);

            return [
                'imported' => 0,
                'errors' => ['Пустой CSV файл.'],
            ];
        }

        $headerMap = array_flip(array_map(static fn (string $item): string => trim(mb_strtolower($item)), $header));
        $required = ['year', 'department', 'program', 'title_ru', 'student', 'supervisor', 'keywords'];

        foreach ($required as $column) {
            if (!array_key_exists($column, $headerMap)) {
                fclose($handle);

                return [
                    'imported' => 0,
                    'errors' => ["В CSV отсутствует колонка: {$column}"],
                ];
            }
        }

        $imported = 0;
        $errors = [];
        $line = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $line++;

            try {
                DB::transaction(function () use (&$imported, $headerMap, $row): void {
                    $year = (int) ($row[$headerMap['year']] ?? 0);
                    $departmentName = trim((string) ($row[$headerMap['department']] ?? ''));
                    $programName = trim((string) ($row[$headerMap['program']] ?? ''));
                    $titleRu = trim((string) ($row[$headerMap['title_ru']] ?? ''));
                    $student = trim((string) ($row[$headerMap['student']] ?? ''));
                    $supervisor = trim((string) ($row[$headerMap['supervisor']] ?? ''));
                    $keywordsRaw = trim((string) ($row[$headerMap['keywords']] ?? ''));

                    if ($year < 2000 || $titleRu === '' || $departmentName === '' || $programName === '') {
                        throw new \RuntimeException('Обязательные поля не заполнены корректно.');
                    }

                    $faculty = Faculty::query()->orderBy('id')->first();

                    if (!$faculty) {
                        throw new \RuntimeException('Для импорта требуется хотя бы один факультет.');
                    }

                    $department = Department::query()->firstOrCreate(
                        ['name' => $departmentName],
                        [
                            'faculty_id' => $faculty->id,
                            'code' => null,
                            'description' => null,
                        ],
                    );

                    $academicYear = AcademicYear::query()->firstOrCreate(
                        ['start_year' => $year, 'end_year' => $year + 1],
                        [
                            'name' => $year . '/' . ($year + 1),
                            'is_active' => false,
                        ],
                    );

                    $programCode = strtoupper(substr(preg_replace('/[^A-Za-z0-9]+/', '', $programName) ?? 'PRG', 0, 12));

                    if ($programCode === '') {
                        $programCode = 'PRG' . $department->id . $academicYear->id;
                    }

                    $program = EducationalProgram::query()->firstOrCreate(
                        [
                            'name' => $programName,
                            'department_id' => $department->id,
                            'academic_year_id' => $academicYear->id,
                        ],
                        [
                            'code' => $this->uniqueProgramCode($programCode),
                            'degree' => 'bachelor',
                        ],
                    );

                    $keywords = array_values(array_filter(array_map('trim', explode(',', $keywordsRaw))));

                    Diploma::query()->create([
                        'year' => $year,
                        'semester' => 'spring',
                        'faculty_id' => $faculty->id,
                        'department_id' => $department->id,
                        'program_id' => $program->id,
                        'student_id' => null,
                        'external_student_code' => $student !== '' ? $student : null,
                        'supervisor_id' => null,
                        'title_ru' => $titleRu,
                        'title_kz' => null,
                        'title_en' => null,
                        'abstract' => null,
                        'keywords' => $keywords,
                        'normalized_title' => $this->similarityService->normalize($titleRu),
                        'type' => Diploma::TYPE_DIPLOMA,
                        'status' => Diploma::STATUS_ARCHIVED,
                        'file_path' => null,
                        'is_reference' => true,
                    ]);

                    $imported++;
                });
            } catch (\Throwable $e) {
                $errors[] = "Строка {$line}: {$e->getMessage()}";
            }
        }

        fclose($handle);

        return [
            'imported' => $imported,
            'errors' => $errors,
        ];
    }

    private function uniqueProgramCode(string $base): string
    {
        $candidate = $base;
        $i = 1;

        while (EducationalProgram::query()->where('code', $candidate)->exists()) {
            $suffix = (string) $i;
            $candidate = substr($base, 0, max(1, 50 - strlen($suffix))) . $suffix;
            $i++;
        }

        return $candidate;
    }
}
