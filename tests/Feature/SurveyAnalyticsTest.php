<?php

namespace Tests\Feature;

use App\Models\Discipline;
use App\Models\Group;
use App\Models\SurveyQuestion;
use App\Services\SurveyAnalyticsService;
use App\Models\Student;
use App\Models\Survey;
use App\Models\SurveyAnswer;
use App\Models\User;
use Tests\TestCase;

class SurveyAnalyticsTest extends TestCase
{
    protected SurveyAnalyticsService $analyticsService;
    protected Group $group;
    protected User $teacher;
    protected Discipline $discipline;

    protected function setUp(): void
    {
        parent::setUp();

        $this->analyticsService = app(SurveyAnalyticsService::class);
        
        $this->group = Group::factory()->create();
        $this->teacher = User::factory()->create(['role' => 'teacher']);
        $this->discipline = Discipline::factory()->create(['user_id' => $this->teacher->id]);
        $this->discipline->groups()->attach($this->group->id);

        // Создать вопросы
        SurveyQuestion::factory(5)->create(['type' => 'rating']);
    }

    public function test_get_teacher_overall_rating(): void
    {
        $this->createCompletedSurveys(5, [4, 5, 5, 4, 5]);

        $rating = $this->analyticsService->getTeacherOverallRating($this->teacher);

        $this->assertGreaterThan(0, $rating);
        $this->assertLessThanOrEqual(5, $rating);
    }

    public function test_get_discipline_question_statistics(): void
    {
        $this->createCompletedSurveys(3, [4, 5, 4, 5, 5]);

        $stats = $this->analyticsService->getDisciplineQuestionStatistics($this->discipline);

        $this->assertNotEmpty($stats);
        foreach ($stats as $stat) {
            $this->assertArrayHasKey('question_text', $stat);
            $this->assertArrayHasKey('average_rating', $stat);
        }
    }

    public function test_get_survey_completion_progress(): void
    {
        // Создать 10 анкет (5 выполненных, 3 в процессе, 2 черновика)
        for ($i = 0; $i < 5; $i++) {
            $student = Student::factory()->create(['group_id' => $this->group->id]);
            Survey::create([
                'student_id' => $student->id,
                'teacher_id' => $this->teacher->id,
                'discipline_id' => $this->discipline->id,
                'group_id' => $this->group->id,
                'status' => 'completed',
            ]);
        }

        for ($i = 0; $i < 3; $i++) {
            $student = Student::factory()->create(['group_id' => $this->group->id]);
            Survey::create([
                'student_id' => $student->id,
                'teacher_id' => $this->teacher->id,
                'discipline_id' => $this->discipline->id,
                'group_id' => $this->group->id,
                'status' => 'in_progress',
            ]);
        }

        $progress = $this->analyticsService->getSurveyCompletionProgress($this->discipline);

        $this->assertEquals(10, $progress['total']);
        $this->assertEquals(5, $progress['completed']);
        $this->assertEquals(3, $progress['in_progress']);
        $this->assertEquals(50, $progress['completion_percentage']);
    }

    protected function createCompletedSurveys(int $count, array $ratings): void
    {
        $questions = SurveyQuestion::where('type', 'rating')->get();

        for ($i = 0; $i < $count; $i++) {
            $student = Student::factory()->create(['group_id' => $this->group->id]);
            
            $survey = Survey::create([
                'student_id' => $student->id,
                'teacher_id' => $this->teacher->id,
                'discipline_id' => $this->discipline->id,
                'group_id' => $this->group->id,
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            foreach ($questions as $index => $question) {
                SurveyAnswer::create([
                    'survey_id' => $survey->id,
                    'question_id' => $question->id,
                    'rating_value' => $ratings[$index] ?? 5,
                ]);
            }
        }
    }
}
