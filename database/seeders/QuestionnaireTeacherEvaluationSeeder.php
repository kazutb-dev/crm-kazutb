<?php

namespace Database\Seeders;

use App\Models\Questionnaire\GroupDiscipline;
use App\Models\Questionnaire\Survey;
use App\Models\Questionnaire\SurveyOption;
use App\Models\Questionnaire\SurveyQuestion;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class QuestionnaireTeacherEvaluationSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::today();
        $periodSource = GroupDiscipline::query()
            ->orderByDesc('id')
            ->first(['academic_year', 'semester']);

        $academicYear = $periodSource?->academic_year ?? $this->defaultAcademicYear($now);
        $semester = $periodSource?->semester ?? $this->defaultSemester($now);

        $survey = Survey::query()->updateOrCreate(
            [
                'title' => 'Оценка качества преподавания',
                'academic_year' => $academicYear,
                'semester' => (string) $semester,
                'target_scope' => 'global',
            ],
            [
                'description' => 'Опрос студентов о качестве проведения занятий преподавателем.',
                'start_date' => $now->copy()->subDay()->toDateString(),
                'end_date' => $now->copy()->addMonths(6)->toDateString(),
                'status' => 'active',
                'target_group_id' => null,
            ]
        );

        $questions = [
            'Преподаватель понятно объясняет материал.',
            'Преподаватель хорошо структурирует занятие (логика, последовательность).',
            'Темп занятия комфортный для усвоения темы.',
            'Преподаватель отвечает на вопросы студентов доступно и по существу.',
            'Преподаватель вовлекает студентов в работу на занятии.',
            'Преподаватель относится к студентам уважительно и корректно.',
            'Критерии оценивания по дисциплине прозрачны и понятны.',
            'Обратная связь по заданиям помогает улучшить результат.',
            'Учебные материалы (слайды, задания, примеры) полезны и актуальны.',
            'Содержание дисциплины связано с будущей профессией/практикой.',
            'Преподаватель соблюдает расписание и учебную дисциплину.',
            'В целом я удовлетворен(а) качеством преподавания по этой дисциплине.',
        ];

        $scale = [
            ['text' => 'Полностью не согласен', 'score' => 1],
            ['text' => 'Скорее не согласен', 'score' => 2],
            ['text' => 'Затрудняюсь / нейтрально', 'score' => 3],
            ['text' => 'Скорее согласен', 'score' => 4],
            ['text' => 'Полностью согласен', 'score' => 5],
        ];

        foreach ($questions as $index => $text) {
            $question = SurveyQuestion::query()->updateOrCreate(
                [
                    'survey_id' => $survey->id,
                    'question_text' => $text,
                ],
                [
                    'question_type' => 'single_choice',
                    'is_required' => true,
                    'sort_order' => $index + 1,
                ]
            );

            foreach ($scale as $scaleIndex => $option) {
                SurveyOption::query()->updateOrCreate(
                    [
                        'question_id' => $question->id,
                        'option_text' => $option['text'],
                    ],
                    [
                        'score' => $option['score'],
                        'sort_order' => $scaleIndex + 1,
                    ]
                );
            }
        }
    }

    private function defaultAcademicYear(Carbon $date): string
    {
        $year = (int) $date->format('Y');
        $month = (int) $date->format('n');

        if ($month >= 9) {
            return $year.'/'.($year + 1);
        }

        return ($year - 1).'/'.$year;
    }

    private function defaultSemester(Carbon $date): string
    {
        $month = (int) $date->format('n');

        return ($month >= 9 || $month <= 1) ? '1' : '2';
    }
}
