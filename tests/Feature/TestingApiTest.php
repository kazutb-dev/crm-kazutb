<?php

namespace Tests\Feature;

use App\Models\Testing\TestingBinding;
use App\Models\Testing\TestingQuestion;
use App\Models\Testing\TestingStudentBinding;
use App\Models\Testing\TestingSubject;
use App\Models\Testing\TestingTest;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class TestingApiTest extends TestCase
{
    use DatabaseTransactions;

    private string $apiKey = 'kazutb_super_secret_api_key_2026';

    protected function setUp(): void
    {
        parent::setUp();
        // Ensure default API Key matches what VerifyTestingApiKey middleware uses
        config(['services.crm.api_key' => $this->apiKey]);
    }

    /**
     * Test API Key verification.
     */
    public function test_api_requires_valid_key(): void
    {
        $response = $this->getJson('/api/testing/subjects');
        $response->assertStatus(401);

        $response = $this->withHeaders(['X-API-KEY' => 'wrong_key'])
            ->getJson('/api/testing/subjects');
        $response->assertStatus(401);

        $response = $this->withHeaders(['X-API-KEY' => $this->apiKey])
            ->getJson('/api/testing/subjects');
        $response->assertStatus(200);
    }

    /**
     * Test getting subjects list.
     */
    public function test_can_list_subjects(): void
    {
        $subject1 = TestingSubject::create(['name' => 'Math Analysis', 'code' => 'MATH101']);
        $subject2 = TestingSubject::create(['name' => 'Linear Algebra', 'code' => 'MATH102']);

        $response = $this->withHeaders(['X-API-KEY' => $this->apiKey])
            ->getJson('/api/testing/subjects?search=MATH');

        $response->assertStatus(200);
        $response->assertJsonFragment(['name' => 'Math Analysis']);
        $response->assertJsonFragment(['name' => 'Linear Algebra']);
    }

    /**
     * Test getting teachers.
     */
    public function test_can_list_teachers_by_subject(): void
    {
        $subject = TestingSubject::create(['name' => 'Programming', 'code' => 'CS101']);
        $teacher = User::factory()->create(['name' => 'John Doe']);
        
        $binding = TestingBinding::create([
            'subject_id' => $subject->id,
            'teacher_id' => $teacher->id,
        ]);

        $response = $this->withHeaders(['X-API-KEY' => $this->apiKey])
            ->getJson("/api/testing/subjects/{$subject->id}/teachers");

        $response->assertStatus(200);
        $response->assertJsonFragment(['name' => 'John Doe', 'teacher_binding_id' => $binding->id]);
    }

    /**
     * Test creating student binding.
     */
    public function test_can_create_student_binding(): void
    {
        $subject = TestingSubject::create(['name' => 'Programming', 'code' => 'CS101']);
        $teacher = User::factory()->create(['name' => 'John Doe']);
        $binding = TestingBinding::create([
            'subject_id' => $subject->id,
            'teacher_id' => $teacher->id,
        ]);

        $response = $this->withHeaders(['X-API-KEY' => $this->apiKey])
            ->postJson('/api/testing/student-bindings', [
                'studentId' => 'student_ad_login',
                'teacherBindingId' => $binding->id,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('testing_student_bindings', [
            'student_id' => 'student_ad_login',
            'teacher_binding_id' => $binding->id,
        ]);
    }

    /**
     * Test list of tests (published vs draft).
     */
    public function test_can_list_published_tests_for_student(): void
    {
        $subject = TestingSubject::create(['name' => 'Programming', 'code' => 'CS101']);
        $teacher = User::factory()->create();
        $binding = TestingBinding::create([
            'subject_id' => $subject->id,
            'teacher_id' => $teacher->id,
        ]);

        // Student Binding
        TestingStudentBinding::create([
            'student_id' => 'student_ad_login',
            'teacher_binding_id' => $binding->id,
        ]);

        $publishedTest = TestingTest::create([
            'binding_id' => $binding->id,
            'title' => 'Midterm Exam',
            'status' => 'published',
        ]);

        $draftTest = TestingTest::create([
            'binding_id' => $binding->id,
            'title' => 'Draft Quiz',
            'status' => 'draft',
        ]);

        $response = $this->withHeaders(['X-API-KEY' => $this->apiKey])
            ->getJson("/api/testing/tests?studentId=student_ad_login&bindingId={$binding->id}");

        $response->assertStatus(200);
        $response->assertJsonFragment(['title' => 'Midterm Exam']);
        $response->assertJsonMissing(['title' => 'Draft Quiz']);
    }

    /**
     * Test getting test details hides correct answers.
     */
    public function test_show_test_hides_correct_answers(): void
    {
        $subject = TestingSubject::create(['name' => 'Programming', 'code' => 'CS101']);
        $teacher = User::factory()->create();
        $binding = TestingBinding::create(['subject_id' => $subject->id, 'teacher_id' => $teacher->id]);
        
        $test = TestingTest::create([
            'binding_id' => $binding->id,
            'title' => 'Midterm',
            'status' => 'published',
        ]);

        TestingQuestion::create([
            'test_id' => $test->id,
            'text' => 'What is OOP?',
            'type' => 'single_choice',
            'options' => ['Option A', 'Option B'],
            'correct_answers' => ['Option A'],
        ]);

        $response = $this->withHeaders(['X-API-KEY' => $this->apiKey])
            ->getJson("/api/testing/tests/{$test->id}");

        $response->assertStatus(200);
        $response->assertJsonFragment(['text' => 'What is OOP?']);
        $response->assertJsonMissing(['correct_answers' => ['Option A']]);
    }

    /**
     * Test submitting test and evaluation logic.
     */
    public function test_can_submit_test_and_evaluate_score(): void
    {
        $subject = TestingSubject::create(['name' => 'Programming', 'code' => 'CS101']);
        $teacher = User::factory()->create();
        $binding = TestingBinding::create(['subject_id' => $subject->id, 'teacher_id' => $teacher->id]);
        
        $test = TestingTest::create([
            'binding_id' => $binding->id,
            'title' => 'Midterm',
            'status' => 'published',
        ]);

        $q1 = TestingQuestion::create([
            'test_id' => $test->id,
            'text' => 'Question 1',
            'type' => 'single_choice',
            'options' => ['A', 'B'],
            'correct_answers' => ['A'],
        ]);

        $q2 = TestingQuestion::create([
            'test_id' => $test->id,
            'text' => 'Question 2',
            'type' => 'multiple_choice',
            'options' => ['X', 'Y', 'Z'],
            'correct_answers' => ['X', 'Z'],
        ]);

        $response = $this->withHeaders(['X-API-KEY' => $this->apiKey])
            ->postJson("/api/testing/tests/{$test->id}/submit", [
                'studentId' => 'alex_student',
                'answers' => [
                    ['questionId' => $q1->id, 'selected' => 'A'], // correct
                    ['questionId' => $q2->id, 'selected' => ['X', 'Z']], // correct
                ]
            ]);

        $response->assertStatus(200);
        $response->assertJsonFragment([
            'score' => 100.0,
            'correct_answers_count' => 2,
            'total_questions' => 2,
            'passed' => true,
        ]);

        // Assert database has attempt
        $this->assertDatabaseHas('testing_attempts', [
            'student_id' => 'alex_student',
            'score' => 100.0,
        ]);

        // Assert self-healing student account created in crm users table
        $this->assertDatabaseHas('users', [
            'ad_login' => 'alex_student',
            'role' => 'student',
        ]);

        // Assert result synced in main crm testing_results table
        $this->assertDatabaseHas('testing_results', [
            'test_id' => $test->id,
            'score' => 100.0,
        ]);
    }
}
