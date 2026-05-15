<?php

namespace Tests\Feature;

use App\Models\Discipline;
use App\Models\Group;
use App\Models\Student;
use App\Models\Survey;
use App\Models\SurveyQuestion;
use App\Models\User;
use Tests\TestCase;

class SurveyTest extends TestCase
{
    protected Group $group;
    protected Student $student;
    protected User $teacher;
    protected Discipline $discipline;

    protected function setUp(): void
    {
        parent::setUp();

        $this->group = Group::factory()->create();
        $this->student = Student::factory()->create(['group_id' => $this->group->id]);
        $this->teacher = User::factory()->create(['role' => 'teacher']);
        $this->discipline = Discipline::factory()->create(['user_id' => $this->teacher->id]);
        
        $this->discipline->groups()->attach($this->group->id);
    }

    public function test_can_create_survey(): void
    {
        $survey = Survey::create([
            'student_id' => $this->student->id,
            'teacher_id' => $this->teacher->id,
            'discipline_id' => $this->discipline->id,
            'group_id' => $this->group->id,
            'status' => 'draft',
        ]);

        $this->assertDatabaseHas('surveys', [
            'id' => $survey->id,
            'status' => 'draft',
        ]);
    }

    public function test_survey_start(): void
    {
        $survey = Survey::factory()->create([
            'student_id' => $this->student->id,
            'teacher_id' => $this->teacher->id,
            'discipline_id' => $this->discipline->id,
            'group_id' => $this->group->id,
        ]);

        $survey->start();

        $this->assertEquals('in_progress', $survey->status);
        $this->assertNotNull($survey->started_at);
    }

    public function test_survey_complete(): void
    {
        $survey = Survey::factory()->create([
            'student_id' => $this->student->id,
            'teacher_id' => $this->teacher->id,
            'discipline_id' => $this->discipline->id,
            'group_id' => $this->group->id,
            'status' => 'in_progress',
        ]);

        $survey->complete();

        $this->assertEquals('completed', $survey->status);
        $this->assertNotNull($survey->completed_at);
    }

    public function test_survey_relationships(): void
    {
        $survey = Survey::factory()->create([
            'student_id' => $this->student->id,
            'teacher_id' => $this->teacher->id,
            'discipline_id' => $this->discipline->id,
            'group_id' => $this->group->id,
        ]);

        $this->assertTrue($survey->student->is($this->student));
        $this->assertTrue($survey->teacher->is($this->teacher));
        $this->assertTrue($survey->discipline->is($this->discipline));
        $this->assertTrue($survey->group->is($this->group));
    }

    public function test_survey_unique_constraint(): void
    {
        Survey::create([
            'student_id' => $this->student->id,
            'teacher_id' => $this->teacher->id,
            'discipline_id' => $this->discipline->id,
            'group_id' => $this->group->id,
        ]);

        // Попытка создать дубликат должна вызвать исключение
        $this->expectException(\Illuminate\Database\QueryException::class);

        Survey::create([
            'student_id' => $this->student->id,
            'teacher_id' => $this->teacher->id,
            'discipline_id' => $this->discipline->id,
            'group_id' => $this->group->id,
        ]);
    }

    public function test_discipline_group_relationship(): void
    {
        $this->assertDatabaseHas('discipline_group', [
            'discipline_id' => $this->discipline->id,
            'group_id' => $this->group->id,
        ]);
    }

    public function test_student_belongs_to_group(): void
    {
        $this->assertTrue($this->student->group->is($this->group));
    }

    public function test_teacher_has_many_disciplines(): void
    {
        $this->assertTrue(
            $this->teacher->disciplines()
                ->where('id', $this->discipline->id)
                ->exists()
        );
    }
}
