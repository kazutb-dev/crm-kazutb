<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\KpiEntry;
use App\Models\KpiIndicator;
use App\Models\KpiPeriod;
use App\Models\KpiResult;
use App\Models\KpiStatusLog;
use App\Models\User;
use Illuminate\Database\Seeder;

class KpiSeeder extends Seeder
{
    /**
     * Seed KPI reference and demo data.
     */
    public function run(): void
    {
        $year = AcademicYear::query()->firstOrCreate(
            ['start_year' => 2025, 'end_year' => 2026],
            ['name' => '2025-2026', 'is_active' => true]
        );

        $facultyIt = Faculty::query()->firstOrCreate(
            ['code' => 'FIT'],
            ['name' => 'Факультет информационных технологий']
        );

        $facultyEcon = Faculty::query()->firstOrCreate(
            ['code' => 'FEU'],
            ['name' => 'Факультет экономики и управления']
        );

        $deptIs = Department::query()->firstOrCreate(
            ['code' => 'IS'],
            ['name' => 'Кафедра информационных систем', 'faculty_id' => $facultyIt->id]
        );

        $deptSe = Department::query()->firstOrCreate(
            ['code' => 'SE'],
            ['name' => 'Кафедра программной инженерии', 'faculty_id' => $facultyIt->id]
        );

        $period = KpiPeriod::query()->updateOrCreate(
            ['academic_year_id' => $year->id, 'name' => 'KPI Весна 2026'],
            [
                'stage' => KpiPeriod::STAGE_FACT,
                'start_date' => '2026-01-15',
                'end_date' => '2026-06-15',
                'status' => KpiPeriod::STATUS_ACTIVE,
                'description' => 'Демо-период для KPI записей',
            ]
        );

        $indicators = [
            [
                'entity_type' => KpiIndicator::ENTITY_TYPE_TEACHER,
                'section' => KpiIndicator::SECTION_TEACHING,
                'code' => 'TCH-LOAD',
                'name' => 'Выполнение учебной нагрузки',
                'unit' => '%',
                'base_points' => 20,
                'requires_file' => false,
                'sort_order' => 10,
            ],
            [
                'entity_type' => KpiIndicator::ENTITY_TYPE_TEACHER,
                'section' => KpiIndicator::SECTION_SCIENCE,
                'code' => 'SCI-PUB',
                'name' => 'Научные публикации',
                'unit' => 'шт',
                'base_points' => 25,
                'requires_file' => true,
                'sort_order' => 20,
            ],
            [
                'entity_type' => KpiIndicator::ENTITY_TYPE_TEACHER,
                'section' => KpiIndicator::SECTION_SOCIAL,
                'code' => 'SOC-EVT',
                'name' => 'Социально-воспитательная работа',
                'unit' => 'балл',
                'base_points' => 15,
                'requires_file' => false,
                'sort_order' => 30,
            ],
            [
                'entity_type' => KpiIndicator::ENTITY_TYPE_TEACHER,
                'section' => KpiIndicator::SECTION_QUALIFICATION,
                'code' => 'QLF-DEV',
                'name' => 'Повышение квалификации',
                'unit' => 'час',
                'base_points' => 20,
                'requires_file' => true,
                'sort_order' => 40,
            ],
            [
                'entity_type' => KpiIndicator::ENTITY_TYPE_TEACHER,
                'section' => KpiIndicator::SECTION_SURVEY,
                'code' => 'SRV-STU',
                'name' => 'Оценка студентов',
                'unit' => 'балл',
                'base_points' => 20,
                'requires_file' => false,
                'sort_order' => 50,
            ],
        ];

        $indicatorModels = collect($indicators)->map(function (array $data) {
            return KpiIndicator::query()->updateOrCreate(
                [
                    'entity_type' => $data['entity_type'],
                    'code' => $data['code'],
                ],
                [
                    'section' => $data['section'],
                    'name' => $data['name'],
                    'description' => null,
                    'unit' => $data['unit'],
                    'base_points' => $data['base_points'],
                    'calculation_type' => KpiIndicator::CALCULATION_TYPE_MANUAL,
                    'requires_file' => $data['requires_file'],
                    'is_active' => true,
                    'sort_order' => $data['sort_order'],
                ]
            );
        });

        $teachers = collect([
            ['name' => 'Айбек Смагулов', 'email' => 'kpi.teacher1@example.com', 'department_id' => $deptIs->id, 'faculty_id' => $facultyIt->id],
            ['name' => 'Мадина Ермекова', 'email' => 'kpi.teacher2@example.com', 'department_id' => $deptIs->id, 'faculty_id' => $facultyIt->id],
            ['name' => 'Нурлан Тлеужанов', 'email' => 'kpi.teacher3@example.com', 'department_id' => $deptSe->id, 'faculty_id' => $facultyIt->id],
            ['name' => 'Динара Алимхан', 'email' => 'kpi.teacher4@example.com', 'department_id' => $deptSe->id, 'faculty_id' => $facultyIt->id],
            ['name' => 'Руслан Жуматаев', 'email' => 'kpi.teacher5@example.com', 'department_id' => $deptSe->id, 'faculty_id' => $facultyIt->id],
        ])->map(function (array $row) {
            $user = User::query()->firstOrCreate(
                ['email' => $row['email']],
                [
                    'name' => $row['name'],
                    'password' => 'password',
                    'email_verified_at' => now(),
                ]
            );

            $row['user'] = $user;

            return $row;
        });

        foreach ($teachers as $teacherData) {
            /** @var User $teacher */
            $teacher = $teacherData['user'];

            foreach ($indicatorModels as $indicator) {
                $plan = random_int(60, 100);
                $fact = random_int(55, 110);
                $calcPoints = round(($fact / max($plan, 1)) * (float) $indicator->base_points, 2);

                $entry = KpiEntry::query()->updateOrCreate(
                    [
                        'kpi_period_id' => $period->id,
                        'entity_type' => KpiEntry::ENTITY_TYPE_TEACHER,
                        'user_id' => $teacher->id,
                        'faculty_id' => $teacherData['faculty_id'],
                        'department_id' => $teacherData['department_id'],
                        'indicator_id' => $indicator->id,
                    ],
                    [
                        'academic_year_id' => $year->id,
                        'plan_value' => $plan,
                        'fact_value' => $fact,
                        'calculated_points' => $calcPoints,
                        'manual_points' => null,
                        'comment' => 'Сгенерировано сидером KPI',
                        'status' => KpiEntry::STATUS_APPROVED,
                        'submitted_at' => now()->subDays(random_int(20, 40)),
                        'reviewed_at' => now()->subDays(random_int(10, 19)),
                        'approved_at' => now()->subDays(random_int(1, 9)),
                    ]
                );

                KpiStatusLog::query()->firstOrCreate(
                    [
                        'kpi_entry_id' => $entry->id,
                        'action' => 'submit',
                        'to_status' => KpiEntry::STATUS_SUBMITTED,
                    ],
                    [
                        'from_status' => KpiEntry::STATUS_DRAFT,
                        'comment' => 'Автоматический перевод в submitted',
                        'acted_by' => $teacher->id,
                    ]
                );

                KpiStatusLog::query()->firstOrCreate(
                    [
                        'kpi_entry_id' => $entry->id,
                        'action' => 'approve',
                        'to_status' => KpiEntry::STATUS_APPROVED,
                    ],
                    [
                        'from_status' => KpiEntry::STATUS_SUBMITTED,
                        'comment' => 'Автоматическое согласование',
                        'acted_by' => $teacher->id,
                    ]
                );
            }
        }

        foreach ($teachers as $teacherData) {
            /** @var User $teacher */
            $teacher = $teacherData['user'];

            $sectionScores = KpiEntry::query()
                ->join('kpi_indicators as ki', 'ki.id', '=', 'kpi_entries.indicator_id')
                ->where('kpi_entries.kpi_period_id', $period->id)
                ->where('kpi_entries.entity_type', KpiEntry::ENTITY_TYPE_TEACHER)
                ->where('kpi_entries.user_id', $teacher->id)
                ->where('kpi_entries.status', KpiEntry::STATUS_APPROVED)
                ->groupBy('ki.section')
                ->selectRaw('ki.section as section')
                ->selectRaw('COALESCE(SUM(kpi_entries.calculated_points), 0) as total_points')
                ->pluck('total_points', 'section');

            $approvedEntriesCount = KpiEntry::query()
                ->where('kpi_period_id', $period->id)
                ->where('entity_type', KpiEntry::ENTITY_TYPE_TEACHER)
                ->where('user_id', $teacher->id)
                ->where('status', KpiEntry::STATUS_APPROVED)
                ->count();

            $k1 = round((float) ($sectionScores[KpiIndicator::SECTION_TEACHING] ?? 0), 2);
            $k2 = round((float) ($sectionScores[KpiIndicator::SECTION_SCIENCE] ?? 0), 2);
            $k3 = round((float) ($sectionScores[KpiIndicator::SECTION_SOCIAL] ?? 0), 2);
            $k4 = round((float) ($sectionScores[KpiIndicator::SECTION_QUALIFICATION] ?? 0), 2);
            $k5 = round((float) ($sectionScores[KpiIndicator::SECTION_SURVEY] ?? 0), 2);
            $k6 = 0.0;
            $rank = round($k1 + $k2 + $k3 + $k4 + $k5 + $k6, 2);

            KpiResult::query()->updateOrCreate(
                [
                    'kpi_period_id' => $period->id,
                    'result_type' => KpiResult::RESULT_TYPE_USER,
                    'entity_type' => KpiEntry::ENTITY_TYPE_TEACHER,
                    'user_id' => $teacher->id,
                    'faculty_id' => $teacherData['faculty_id'],
                    'department_id' => $teacherData['department_id'],
                ],
                [
                    'academic_year_id' => $year->id,
                    'approved_entries_count' => $approvedEntriesCount,
                    'section_scores' => [
                        'teaching' => $k1,
                        'science' => $k2,
                        'social' => $k3,
                        'qualification' => $k4,
                        'survey' => $k5,
                    ],
                    'k1_score' => $k1,
                    'k2_score' => $k2,
                    'k3_score' => $k3,
                    'k4_score' => $k4,
                    'k5_score' => $k5,
                    'k6_score' => $k6,
                    'formula_name' => KpiResult::FORMULA_RPPS_V1,
                    'rank_score' => $rank,
                    'metadata' => ['seeded' => true],
                    'calculated_at' => now(),
                ]
            );
        }

        foreach ([
            ['department' => $deptIs, 'faculty' => $facultyIt],
            ['department' => $deptSe, 'faculty' => $facultyIt],
        ] as $scope) {
            $results = KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_USER)
                ->where('department_id', $scope['department']->id)
                ->get();

            KpiResult::query()->updateOrCreate(
                [
                    'kpi_period_id' => $period->id,
                    'result_type' => KpiResult::RESULT_TYPE_DEPARTMENT,
                    'entity_type' => KpiEntry::ENTITY_TYPE_TEACHER,
                    'user_id' => null,
                    'faculty_id' => $scope['faculty']->id,
                    'department_id' => $scope['department']->id,
                ],
                [
                    'academic_year_id' => $year->id,
                    'approved_entries_count' => (int) $results->sum('approved_entries_count'),
                    'section_scores' => null,
                    'k1_score' => round((float) $results->avg('k1_score'), 2),
                    'k2_score' => round((float) $results->avg('k2_score'), 2),
                    'k3_score' => round((float) $results->avg('k3_score'), 2),
                    'k4_score' => round((float) $results->avg('k4_score'), 2),
                    'k5_score' => round((float) $results->avg('k5_score'), 2),
                    'k6_score' => 0,
                    'formula_name' => KpiResult::FORMULA_RPPS_V1,
                    'rank_score' => round((float) $results->avg('rank_score'), 2),
                    'metadata' => ['seeded' => true, 'scope' => 'department'],
                    'calculated_at' => now(),
                ]
            );
        }

        $facultyResults = KpiResult::query()
            ->where('kpi_period_id', $period->id)
            ->where('result_type', KpiResult::RESULT_TYPE_USER)
            ->where('faculty_id', $facultyIt->id)
            ->get();

        KpiResult::query()->updateOrCreate(
            [
                'kpi_period_id' => $period->id,
                'result_type' => KpiResult::RESULT_TYPE_FACULTY,
                'entity_type' => KpiEntry::ENTITY_TYPE_TEACHER,
                'user_id' => null,
                'faculty_id' => $facultyIt->id,
                'department_id' => null,
            ],
            [
                'academic_year_id' => $year->id,
                'approved_entries_count' => (int) $facultyResults->sum('approved_entries_count'),
                'section_scores' => null,
                'k1_score' => round((float) $facultyResults->avg('k1_score'), 2),
                'k2_score' => round((float) $facultyResults->avg('k2_score'), 2),
                'k3_score' => round((float) $facultyResults->avg('k3_score'), 2),
                'k4_score' => round((float) $facultyResults->avg('k4_score'), 2),
                'k5_score' => round((float) $facultyResults->avg('k5_score'), 2),
                'k6_score' => 0,
                'formula_name' => KpiResult::FORMULA_RPPS_V1,
                'rank_score' => round((float) $facultyResults->avg('rank_score'), 2),
                'metadata' => ['seeded' => true, 'scope' => 'faculty'],
                'calculated_at' => now(),
            ]
        );

        // Keep second faculty in dictionary for demo relations usage.
        $facultyEcon = $facultyEcon;
    }
}
