<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Questionnaire\GroupCourse;
use App\Models\Questionnaire\GroupEducationalProgram;
use App\Models\Questionnaire\GroupSpeciality;
use Illuminate\Database\Seeder;

class QuestionnaireGroupReferenceSeeder extends Seeder
{
    public function run(): void
    {
        $courses = ['1', '2', '3', '4'];
        foreach ($courses as $index => $name) {
            GroupCourse::query()->updateOrCreate(
                ['name' => $name],
                ['sort_order' => $index + 1, 'status' => 'active']
            );
        }

        $specialityPrograms = [
            [
                'speciality' => 'Информационные системы',
                'department' => 'Кафедра информационных технологий',
                'programs' => [
                    '6B06101 - Информационные системы',
                    '6B06102 - Компьютерная инженерия',
                ],
            ],
            [
                'speciality' => 'Автоматизация и управление',
                'department' => 'Кафедра автоматизации и управления',
                'programs' => [
                    '6B07101 - Автоматизация и управление',
                ],
            ],
            [
                'speciality' => 'Вычислительная техника и программное обеспечение',
                'department' => 'Кафедра информационных технологий',
                'programs' => [
                    '6B06103 - Вычислительная техника и программное обеспечение',
                ],
            ],
            [
                'speciality' => 'Нефтегазовое дело',
                'department' => 'Кафедра нефтегазового дела',
                'programs' => [
                    '6B07201 - Нефтегазовое дело',
                ],
            ],
            [
                'speciality' => 'Финансы',
                'department' => 'Кафедра финансов и учета',
                'programs' => [
                    '6B04101 - Финансы',
                ],
            ],
            [
                'speciality' => 'Менеджмент',
                'department' => 'Кафедра экономики и управления',
                'programs' => [
                    '6B04102 - Менеджмент',
                ],
            ],
        ];

        $specialitySortOrder = 1;
        $programSortOrder = 1;

        foreach ($specialityPrograms as $item) {
            $department = Department::query()->firstOrCreate(
                ['name' => (string) $item['department']],
                ['description' => 'Справочник кафедр для модуля анкетирования']
            );

            $speciality = GroupSpeciality::query()->updateOrCreate(
                ['name' => (string) $item['speciality']],
                [
                    'department_id' => $department->id,
                    'sort_order' => $specialitySortOrder,
                    'status' => 'active',
                ]
            );

            $specialitySortOrder++;

            foreach ($item['programs'] as $programName) {
                GroupEducationalProgram::query()->updateOrCreate(
                    ['name' => $programName],
                    [
                        'group_speciality_id' => $speciality->id,
                        'sort_order' => $programSortOrder,
                        'status' => 'active',
                    ]
                );

                $programSortOrder++;
            }
        }
    }
}
