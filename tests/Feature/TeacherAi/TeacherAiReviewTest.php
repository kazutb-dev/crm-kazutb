<?php

namespace Tests\Feature\TeacherAi;

use App\Models\TeacherAiReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TeacherAiReviewTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = 'https://ai.test/v1/chat/completions';

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.teacher_ai.enabled', true);
        config()->set('services.teacher_ai.endpoint', self::ENDPOINT);
        config()->set('services.teacher_ai.api_key', 'test-key');
        config()->set('services.teacher_ai.daily_limit', 3);

        Http::fake([
            self::ENDPOINT => Http::response([
                'model' => 'gpt-4o-mini',
                'choices' => [['message' => ['content' => json_encode([
                    'summary' => 'Силлабус курса «Базы данных».',
                    'key_points' => ['5 кредитов'],
                    'findings' => [
                        ['severity' => 'critical', 'category' => 'Оценивание', 'quote' => '', 'issue' => 'Сумма весов 110%', 'suggestion' => 'Приведите к 100%'],
                    ],
                    'overall' => 'Нужна доработка.',
                ], JSON_UNESCAPED_UNICODE)]]],
                'usage' => ['prompt_tokens' => 900, 'completion_tokens' => 200],
            ]),
        ]);
    }

    public function test_teacher_submits_text_and_gets_a_completed_review(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);

        $response = $this->actingAs($teacher)->post(route('teacher-ai.reviews.store'), [
            'document_type' => 'syllabus',
            'title' => 'Силлабус БД',
            'text' => $this->documentText(),
        ]);

        $review = TeacherAiReview::query()->sole();
        $response->assertRedirect(route('teacher-ai.reviews.show', $review));

        // QUEUE_CONNECTION=sync in phpunit.xml runs the job inline.
        $review->refresh();
        $this->assertSame(TeacherAiReview::STATUS_COMPLETED, $review->status);
        $this->assertSame('Силлабус БД', $review->title);
        $this->assertSame('Сумма весов 110%', $review->findings[0]['issue']);
        $this->assertSame(900, $review->prompt_tokens);

        $this->actingAs($teacher)
            ->get(route('teacher-ai.reviews.show', $review))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('TeacherAi/Show')
                ->where('review.status', 'completed')
                ->where('review.findings_count.critical', 1));
    }

    public function test_teacher_uploads_a_docx_file(): void
    {
        $teacher = User::factory()->create(['role' => 'hod']);

        $this->actingAs($teacher)->post(route('teacher-ai.reviews.store'), [
            'document_type' => 'umkd',
            'document' => $this->makeDocxUpload('УМКД по дисциплине.docx'),
        ])->assertSessionHasNoErrors();

        $review = TeacherAiReview::query()->sole();
        $this->assertSame(TeacherAiReview::SOURCE_FILE, $review->source);
        $this->assertSame('УМКД по дисциплине', $review->title);
        $this->assertStringContainsString('Лекция 1', $review->content_text);
    }

    public function test_students_cannot_use_the_assistant(): void
    {
        $student = User::factory()->create(['role' => 'student']);

        $this->actingAs($student)->get(route('teacher-ai.reviews.index'))->assertForbidden();
        $this->actingAs($student)->post(route('teacher-ai.reviews.store'), [
            'document_type' => 'syllabus',
            'text' => $this->documentText(),
        ])->assertForbidden();

        $this->assertDatabaseCount('teacher_ai_reviews', 0);
        Http::assertNothingSent();
    }

    public function test_teachers_cannot_open_someone_elses_review(): void
    {
        $owner = User::factory()->create(['role' => 'teacher']);
        $other = User::factory()->create(['role' => 'teacher']);
        $review = $this->makeReview($owner);

        $this->actingAs($other)->get(route('teacher-ai.reviews.show', $review))->assertNotFound();
        $this->actingAs($other)->delete(route('teacher-ai.reviews.destroy', $review))->assertNotFound();
        $this->assertModelExists($review);
    }

    public function test_daily_limit_is_enforced(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);

        foreach (range(1, 3) as $ignored) {
            $this->makeReview($teacher);
        }

        $this->actingAs($teacher)->post(route('teacher-ai.reviews.store'), [
            'document_type' => 'syllabus',
            'text' => $this->documentText(),
        ])->assertSessionHas('error');

        $this->assertDatabaseCount('teacher_ai_reviews', 3);
    }

    public function test_short_text_is_rejected(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);

        $this->actingAs($teacher)->post(route('teacher-ai.reviews.store'), [
            'document_type' => 'syllabus',
            'text' => 'Слишком коротко',
        ])->assertSessionHasErrors('text');

        $this->assertDatabaseCount('teacher_ai_reviews', 0);
    }

    public function test_failed_review_can_be_retried(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $review = $this->makeReview($teacher, [
            'status' => TeacherAiReview::STATUS_FAILED,
            'error_message' => 'ИИ-сервис временно недоступен.',
        ]);

        $this->actingAs($teacher)
            ->post(route('teacher-ai.reviews.retry', $review))
            ->assertRedirect(route('teacher-ai.reviews.show', $review));

        $this->assertSame(TeacherAiReview::STATUS_COMPLETED, $review->refresh()->status);
    }

    public function test_owner_can_delete_a_review(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $review = $this->makeReview($teacher);

        $this->actingAs($teacher)
            ->delete(route('teacher-ai.reviews.destroy', $review))
            ->assertRedirect(route('teacher-ai.reviews.index'));

        $this->assertModelMissing($review);
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function makeReview(User $user, array $overrides = []): TeacherAiReview
    {
        return TeacherAiReview::create(array_merge([
            'user_id' => $user->id,
            'document_type' => 'syllabus',
            'title' => 'Документ',
            'source' => TeacherAiReview::SOURCE_TEXT,
            'content_text' => $this->documentText(),
            'content_chars' => mb_strlen($this->documentText()),
            'status' => TeacherAiReview::STATUS_COMPLETED,
            'summary' => 'Кратко',
            'findings' => [],
        ], $overrides));
    }

    private function documentText(): string
    {
        return str_repeat('Силлабус дисциплины «Базы данных», 5 кредитов. Оценивание: РК1 30%, РК2 30%, экзамен 50%. ', 3);
    }

    private function makeDocxUpload(string $name): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'docx');
        $zip = new \ZipArchive();
        $zip->open($path, \ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
        $zip->addFromString('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
            . str_repeat('<w:p><w:r><w:t>Лекция 1. Введение в реляционные базы данных и модели данных.</w:t></w:r></w:p>', 4)
            . '</w:body></w:document>');
        $zip->close();

        return new UploadedFile($path, $name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', null, true);
    }
}
