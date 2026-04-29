<?php

namespace Database\Seeders;

use App\Models\KpiIndicator;
use Illuminate\Database\Seeder;

class KpiStructuralSeeder extends Seeder
{
    public function run(): void
    {
        $indicators = [
            // Раздел: Образовательная деятельность
            [
                'section'          => 'educational',
                'code'             => 'SD-EDU-01',
                'name'             => 'Доля студентов, успешно прошедших итоговую аттестацию',
                'unit'             => '%',
                'base_points'      => 15,
                'requires_file'    => false,
                'calculation_type' => KpiIndicator::CALCULATION_TYPE_MANUAL,
                'sort_order'       => 10,
            ],
            [
                'section'          => 'educational',
                'code'             => 'SD-EDU-02',
                'name'             => 'Количество разработанных образовательных программ',
                'unit'             => 'шт',
                'base_points'      => 10,
                'requires_file'    => true,
                'calculation_type' => KpiIndicator::CALCULATION_TYPE_MANUAL,
                'sort_order'       => 20,
            ],
            [
                'section'          => 'educational',
                'code'             => 'SD-EDU-03',
                'name'             => 'Средний балл успеваемости студентов',
                'unit'             => 'балл',
                'base_points'      => 10,
                'requires_file'    => false,
                'calculation_type' => KpiIndicator::CALCULATION_TYPE_MANUAL,
                'sort_order'       => 30,
            ],

            // Раздел: Научная и инновационная деятельность
            [
                'section'          => 'science',
                'code'             => 'SD-SCI-01',
                'name'             => 'Количество научных публикаций сотрудников',
                'unit'             => 'шт',
                'base_points'      => 20,
                'requires_file'    => true,
                'calculation_type' => KpiIndicator::CALCULATION_TYPE_MANUAL,
                'sort_order'       => 40,
            ],
            [
                'section'          => 'science',
                'code'             => 'SD-SCI-02',
                'name'             => 'Объём привлечённого внешнего финансирования (гранты, договоры)',
                'unit'             => 'тыс. тг.',
                'base_points'      => 15,
                'requires_file'    => true,
                'calculation_type' => KpiIndicator::CALCULATION_TYPE_MANUAL,
                'sort_order'       => 50,
            ],

            // Раздел: Кадровый потенциал
            [
                'section'          => 'staff',
                'code'             => 'SD-STF-01',
                'name'             => 'Доля докторов и кандидатов наук среди ППС',
                'unit'             => '%',
                'base_points'      => 15,
                'requires_file'    => false,
                'calculation_type' => KpiIndicator::CALCULATION_TYPE_MANUAL,
                'sort_order'       => 60,
            ],
            [
                'section'          => 'staff',
                'code'             => 'SD-STF-02',
                'name'             => 'Количество сотрудников, прошедших повышение квалификации',
                'unit'             => 'чел.',
                'base_points'      => 10,
                'requires_file'    => true,
                'calculation_type' => KpiIndicator::CALCULATION_TYPE_MANUAL,
                'sort_order'       => 70,
            ],

            // Раздел: Международная и внешняя деятельность
            [
                'section'          => 'international',
                'code'             => 'SD-INT-01',
                'name'             => 'Количество международных соглашений о сотрудничестве',
                'unit'             => 'шт',
                'base_points'      => 10,
                'requires_file'    => true,
                'calculation_type' => KpiIndicator::CALCULATION_TYPE_MANUAL,
                'sort_order'       => 80,
            ],
            [
                'section'          => 'international',
                'code'             => 'SD-INT-02',
                'name'             => 'Количество иностранных студентов',
                'unit'             => 'чел.',
                'base_points'      => 5,
                'requires_file'    => false,
                'calculation_type' => KpiIndicator::CALCULATION_TYPE_MANUAL,
                'sort_order'       => 90,
            ],
        ];

        foreach ($indicators as $data) {
            KpiIndicator::query()->updateOrCreate(
                [
                    'entity_type' => KpiIndicator::ENTITY_TYPE_STRUCTURAL_DIVISION,
                    'code'        => $data['code'],
                ],
                [
                    'section'          => $data['section'],
                    'name'             => $data['name'],
                    'description'      => null,
                    'unit'             => $data['unit'],
                    'base_points'      => $data['base_points'],
                    'calculation_type' => $data['calculation_type'],
                    'requires_file'    => $data['requires_file'],
                    'is_active'        => true,
                    'sort_order'       => $data['sort_order'],
                ]
            );
        }

        $this->command->info('Создано/обновлено ' . count($indicators) . ' KPI-индикаторов для структурных подразделений.');
    }
}
