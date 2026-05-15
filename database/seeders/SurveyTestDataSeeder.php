<?php

namespace Database\Seeders;

use App\Models\Discipline;
use App\Models\Group;
use App\Models\Student;
use App\Models\Survey;
use App\Models\SurveyAnswer;
use App\Models\SurveyQuestion;
use App\Models\User;
use Illuminate\Database\Seeder;

class SurveyTestDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Получить или создать группы
        $groups = Group::firstOrCreate(
            ['code' => 'БПМ-20-1'],
            ['name' => 'БПМ-20-1', 'code' => 'БПМ-20-1']
        );

        // Создать студентов для группы
        if ($groups->students()->count() === 0) {
            Student::factory(30)->create(['group_id' => $groups->id]);
        }

        // Получить или создать преподавателей
        $teachers = User::where('role', 'teacher')->limit(3)->get();

        if ($teachers->isEmpty()) {
            $teachers = User::factory(3)
                ->create([
                    'role' => 'teacher',
                ])
                ->each(function (User $user) {
                    $user->update(['role_id' => \App\Models\Role::where('slug', 'teacher')->value('id')]);
                });
        }

        // Создать дисциплины для преподавателей
        foreach ($teachers as $teacher) {
            $discipline = Discipline::firstOrCreate(
                [
                    'user_id' => $teacher->id,
                    'name' => 'Дисциплина - ' . $teacher->first_name,
                ],
                [
                    'code' => 'DIS' . $teacher->id . rand(100, 999),
                    'user_id' => $teacher->id,
                    'name' => 'Дисциплина - ' . $teacher->first_name,
                ]
            );

            // Привязать дисциплину к группе
            $discipline->groups()->syncWithoutDetaching($groups->id);

            // Создать анкеты для студентов группы
            $students = $groups->students()->get();
            foreach ($students as $student) {
                $survey = Survey::firstOrCreate(
                    [
                        'student_id' => $student->id,
                        'teacher_id' => $teacher->id,
                        'discipline_id' => $discipline->id,
                        'group_id' => $groups->id,
                    ],
                    [
                        'student_id' => $student->id,
                        'teacher_id' => $teacher->id,
                        'discipline_id' => $discipline->id,
                        'group_id' => $groups->id,
                        'status' => 'draft',
                    ]
                );

                // Заполнить некоторые анкеты для демонстрации
                if (rand(1, 3) === 1 && $survey->answers()->count() === 0) {
                    $survey->update([
                        'status' => 'completed',
                        'started_at' => now()->subDays(rand(1, 30)),
                        'completed_at' => now()->subDays(rand(0, 30)),
                    ]);

                    $questions = SurveyQuestion::where('is_active', true)->get();
                    foreach ($questions as $question) {
                        SurveyAnswer::firstOrCreate(
                            [
                                'survey_id' => $survey->id,
                                'question_id' => $question->id,
                            ],
                            [
                                'survey_id' => $survey->id,
                                'question_id' => $question->id,
                                'rating_value' => $question->type === 'rating' ? rand(3, 5) : null,
                                'text_answer' => $question->type === 'text' ? 'Отличный преподаватель!' : null,
                            ]
                        );
                    }
                }
            }
        }
    }
}
