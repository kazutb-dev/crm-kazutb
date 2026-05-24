<?php

namespace Tests\Feature\Questionnaire;

use App\Models\Questionnaire\Discipline;
use App\Models\Questionnaire\Group;
use App\Models\Questionnaire\GroupDiscipline;
use App\Models\Questionnaire\Student;
use App\Models\Questionnaire\Survey;
use App\Models\Questionnaire\SurveyOption;
use App\Models\Questionnaire\SurveyQuestion;
use App\Models\Questionnaire\TeacherDiscipline;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QuestionnaireApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_can_get_available_surveys(): void
    {
        $fixture = $this->createFixture();

        Sanctum::actingAs($fixture['studentUser']);

        $response = $this->getJson('/api/questionnaire/student/surveys');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.survey_id', $fixture['survey']->id)
            ->assertJsonPath('data.0.group_discipline_id', $fixture['groupDiscipline']->id);
    }

    public function test_student_cannot_submit_duplicate_response(): void
    {
        $fixture = $this->createFixture();

        Sanctum::actingAs($fixture['studentUser']);

        $payload = [
            'survey_id' => $fixture['survey']->id,
            'group_discipline_id' => $fixture['groupDiscipline']->id,
            'answers' => [
                [
                    'question_id' => $fixture['question']->id,
                    'option_id' => $fixture['option']->id,
                ],
            ],
        ];

        $first = $this->postJson('/api/questionnaire/student/surveys/submit', $payload);
        $first->assertCreated();

        $second = $this->postJson('/api/questionnaire/student/surveys/submit', $payload);

        $second
            ->assertStatus(422)
            ->assertJsonValidationErrors(['survey_id']);
    }

    public function test_admin_can_view_results(): void
    {
        $fixture = $this->createFixture();

        Sanctum::actingAs($fixture['studentUser']);

        $this->postJson('/api/questionnaire/student/surveys/submit', [
            'survey_id' => $fixture['survey']->id,
            'group_discipline_id' => $fixture['groupDiscipline']->id,
            'answers' => [
                [
                    'question_id' => $fixture['question']->id,
                    'option_id' => $fixture['option']->id,
                ],
            ],
        ])->assertCreated();

        Sanctum::actingAs($fixture['adminUser']);

        $response = $this->getJson('/api/questionnaire/admin/results?survey_id='.$fixture['survey']->id);

        $response
            ->assertOk()
            ->assertJsonPath('data.summary.total_responses', 1)
            ->assertJsonPath('data.responses.0.survey_id', $fixture['survey']->id);
    }

    /**
     * @return array<string, mixed>
     */
    private function createFixture(): array
    {
        Role::query()->firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);
        Role::query()->firstOrCreate(['slug' => 'student'], ['name' => 'Student']);
        Role::query()->firstOrCreate(['slug' => 'teacher'], ['name' => 'Teacher']);

        $adminUser = User::factory()->create(['role' => 'admin']);
        $teacherUser = User::factory()->create(['role' => 'teacher']);
        $studentUser = User::factory()->create([
            'role' => 'student',
            'ad_login' => 'student_login',
        ]);

        $group = Group::query()->create([
            'name' => 'ИС-101',
            'course' => '1',
            'speciality' => 'Информатика',
            'status' => 'active',
        ]);

        $student = Student::query()->create([
            'full_name' => 'Student Test',
            'user_id' => $studentUser->id,
            'login' => 'student_login',
            'group_id' => $group->id,
            'status' => 'active',
        ]);

        $discipline = Discipline::query()->create([
            'name' => 'Математика',
            'code' => 'MATH-01',
            'status' => 'active',
        ]);

        $teacherDiscipline = TeacherDiscipline::query()->create([
            'teacher_id' => $teacherUser->id,
            'discipline_id' => $discipline->id,
            'academic_year' => '2025/2026',
            'semester' => '1',
            'status' => 'active',
        ]);

        $groupDiscipline = GroupDiscipline::query()->create([
            'group_id' => $group->id,
            'teacher_discipline_id' => $teacherDiscipline->id,
            'academic_year' => '2025/2026',
            'semester' => '1',
            'status' => 'active',
        ]);

        $survey = Survey::query()->create([
            'title' => 'Оценка преподавателя',
            'description' => 'Тестовая анкета',
            'academic_year' => '2025/2026',
            'semester' => '1',
            'start_date' => now()->subDay()->toDateString(),
            'end_date' => now()->addDay()->toDateString(),
            'status' => 'active',
        ]);

        $question = SurveyQuestion::query()->create([
            'survey_id' => $survey->id,
            'question_text' => 'Насколько понятно объяснение?',
            'question_type' => 'single_choice',
            'is_required' => true,
            'sort_order' => 1,
        ]);

        $option = SurveyOption::query()->create([
            'question_id' => $question->id,
            'option_text' => 'Отлично',
            'score' => 5,
            'sort_order' => 1,
        ]);

        return [
            'adminUser' => $adminUser,
            'teacherUser' => $teacherUser,
            'studentUser' => $studentUser,
            'student' => $student,
            'group' => $group,
            'discipline' => $discipline,
            'teacherDiscipline' => $teacherDiscipline,
            'groupDiscipline' => $groupDiscipline,
            'survey' => $survey,
            'question' => $question,
            'option' => $option,
        ];
    }
}
