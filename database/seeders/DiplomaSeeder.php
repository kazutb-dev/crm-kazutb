<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\Department;
use App\Models\Diploma;
use App\Models\EducationalProgram;
use App\Models\Faculty;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DiplomaSeeder extends Seeder
{
    /**
     * Seed diploma works with related reference data.
     */
    public function run(): void
    {
        $year = AcademicYear::query()->firstOrCreate(
            ['start_year' => 2025, 'end_year' => 2026],
            ['name' => '2025-2026', 'is_active' => true]
        );

        $faculties = collect([
            ['name' => 'Факультет информационных технологий', 'code' => 'FIT'],
            ['name' => 'Факультет экономики и управления', 'code' => 'FEU'],
        ])->map(function (array $row) {
            return Faculty::query()->firstOrCreate(
                ['code' => $row['code']],
                ['name' => $row['name']]
            );
        });

        $departments = collect([
            ['faculty_code' => 'FIT', 'name' => 'Кафедра информационных систем', 'code' => 'IS'],
            ['faculty_code' => 'FIT', 'name' => 'Кафедра программной инженерии', 'code' => 'SE'],
            ['faculty_code' => 'FEU', 'name' => 'Кафедра финансов', 'code' => 'FIN'],
            ['faculty_code' => 'FEU', 'name' => 'Кафедра менеджмента', 'code' => 'MGT'],
        ])->map(function (array $row) use ($faculties) {
            $faculty = $faculties->firstWhere('code', $row['faculty_code']);

            return Department::query()->firstOrCreate(
                ['code' => $row['code']],
                [
                    'name' => $row['name'],
                    'faculty_id' => $faculty?->id,
                ]
            );
        });

        $programs = collect([
            ['department_code' => 'IS', 'name' => 'Информационные системы', 'code' => '6B06101', 'degree' => 'bachelor'],
            ['department_code' => 'SE', 'name' => 'Программная инженерия', 'code' => '6B06102', 'degree' => 'bachelor'],
            ['department_code' => 'FIN', 'name' => 'Финансы', 'code' => '6B04101', 'degree' => 'bachelor'],
            ['department_code' => 'MGT', 'name' => 'Менеджмент', 'code' => '6B04102', 'degree' => 'bachelor'],
        ])->map(function (array $row) use ($departments, $year) {
            $department = $departments->firstWhere('code', $row['department_code']);

            return EducationalProgram::query()->firstOrCreate(
                ['code' => $row['code']],
                [
                    'name' => $row['name'],
                    'degree' => $row['degree'],
                    'department_id' => $department?->id,
                    'academic_year_id' => $year->id,
                ]
            );
        });

        $students = User::factory()->count(20)->create();
        $supervisors = User::factory()->count(6)->create();

        $topics = [
            'Разработка веб-платформы для мониторинга академической успеваемости',
            'Интеллектуальная система анализа рисков финансовых операций',
            'Оптимизация расписания занятий с использованием эвристических алгоритмов',
            'Система обнаружения аномалий в сетевом трафике университета',
            'Мобильное приложение для цифрового кампуса',
            'Платформа автоматизированной проверки заимствований в дипломных работах',
            'Прогнозирование оттока студентов на основе ML-моделей',
            'Система рекомендаций элективных дисциплин',
            'Автоматизация документооборота кафедры',
            'Аналитическая панель KPI для деканата',
        ];

        $statuses = Diploma::statuses();
        $types = Diploma::types();

        foreach (range(1, 40) as $i) {
            $program = $programs->random();
            $department = $departments->firstWhere('id', $program->department_id);
            $faculty = $faculties->firstWhere('id', $department?->faculty_id);
            $student = $students->random();
            $supervisor = $supervisors->random();
            $titleRu = $topics[array_rand($topics)] . ' #' . $i;

            Diploma::query()->create([
                'year' => 2026,
                'semester' => $i % 2 === 0 ? 'spring' : 'fall',
                'faculty_id' => $faculty->id,
                'department_id' => $department->id,
                'program_id' => $program->id,
                'student_id' => $student->id,
                'external_student_code' => 'EXT-' . str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'supervisor_id' => $supervisor->id,
                'title_ru' => $titleRu,
                'title_kz' => null,
                'title_en' => null,
                'abstract' => 'Тестовая запись дипломной работы для наполнения среды разработки.',
                'keywords' => ['diploma', 'research', 'analytics'],
                'normalized_title' => Str::of($titleRu)->lower()->squish()->value(),
                'type' => $types[array_rand($types)],
                'status' => $statuses[array_rand($statuses)],
                'file_path' => null,
                'is_reference' => $i % 10 === 0,
            ]);
        }
    }
}
