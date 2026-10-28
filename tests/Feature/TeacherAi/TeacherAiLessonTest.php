<?php

namespace Tests\Feature\TeacherAi;

use App\Models\TeacherAiLesson;
use App\Models\User;
use App\Services\TeacherAi\LessonDeck;
use GuzzleHttp\Promise\PromiseInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TeacherAiLessonTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = 'https://ai.test/v1/chat/completions';

    private const IMAGE_ENDPOINT = 'https://images.test/v1/images/generations';

    /**
     * Planned section count for a 50-minute lesson: clamp(round(50 / 15), 4, 7) = 4.
     */
    private const SECTIONS_FOR_50_MINUTES = 4;

    /**
     * 8 slides = cover + lecture title + overview + 4 content slides (one per
     * section: image_text, cards, timeline, banner_columns) + conclusion.
     */
    private const SLIDES = 8;

    /**
     * Deck parts requested in the slides step: opening + 4 sections + closing.
     */
    private const DECK_PARTS = 6;

    /**
     * Image slots of that deck: lecture title, image_text, banner_columns.
     */
    private const IMAGES = 3;

    private int $failingSectionIndex = 0;

    private int $failingSectionCalls = 0;

    private int $failuresBeforeSuccess = 2;

    private bool $outlineUnavailable = false;

    /**
     * Section number whose deck part the fake rejects, and how many times.
     */
    private int $failingPartSection = 0;

    private int $failingPartCalls = 0;

    private int $partFailuresBeforeSuccess = 2;

    /**
     * Image requests: HTTP status to answer for the prompts containing $failingImageMarker.
     */
    private string $failingImageMarker = '';

    private int $failingImageStatus = 0;

    private int $failingImageCalls = 0;

    private int $imageFailuresBeforeSuccess = PHP_INT_MAX;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        config()->set('services.teacher_ai.enabled', true);
        config()->set('services.teacher_ai.endpoint', self::ENDPOINT);
        config()->set('services.teacher_ai.api_key', 'test-key');
        config()->set('services.teacher_ai.lesson_daily_limit', 3);
        config()->set('services.teacher_ai.lesson_concurrency', 4);
        config()->set('services.teacher_ai.lesson_timeout', 30);
        config()->set('services.teacher_ai.lesson_retry_sleep_ms', 0);
        config()->set('services.teacher_ai.images_enabled', true);
        config()->set('services.teacher_ai.image_endpoint', self::IMAGE_ENDPOINT);
        config()->set('services.teacher_ai.image_model', 'gpt-image-1.5');
        config()->set('services.teacher_ai.images_max', 8);
        config()->set('services.teacher_ai.image_concurrency', 3);

        Http::fake(fn (Request $request): PromiseInterface => str_starts_with($request->url(), self::IMAGE_ENDPOINT)
            ? $this->fakeImage($request)
            : $this->fakeCompletion($request));
    }

    public function test_teacher_generates_lecture_and_illustrated_presentation(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);

        $response = $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), $this->formData());

        $lesson = TeacherAiLesson::query()->sole();
        $response->assertRedirect(route('teacher-ai.lessons.show', $lesson));
        $response->assertSessionHas('success');

        // QUEUE_CONNECTION=sync in phpunit.xml: the job and its re-dispatches run inline.
        $lesson->refresh();
        $this->assertSame(TeacherAiLesson::STATUS_COMPLETED, $lesson->status);
        $this->assertSame(TeacherAiLesson::STEP_DONE, $lesson->step);
        $this->assertSame('Базы данных', $lesson->subject);
        $this->assertSame(3, $lesson->lecture_number);
        $this->assertSame('Факультет инжиниринга и информационных технологий', $lesson->faculty_name);
        $this->assertSame(self::SECTIONS_FOR_50_MINUTES, $lesson->sectionsDone());
        $this->assertNotNull($lesson->completed_at);
        $this->assertNull($lesson->error_message);

        $deck = $lesson->presentation;
        $this->assertSame(LessonDeck::VERSION, $deck['version']);
        $this->assertSame([
            'cover', 'lecture_title', 'text_bullets', 'image_text', 'cards', 'timeline', 'banner_columns', 'conclusion',
        ], array_column($deck['slides'], 'layout'));
        $this->assertSame('Лекция 3. Нормализация реляционных баз данных', $deck['slides'][1]['title']);
        $this->assertSame('Дисциплина:', $deck['slides'][0]['cover']['course_label']);
        $this->assertSame('Базы данных', $deck['slides'][0]['cover']['course']);
        $this->assertSame('Кафедра «Информационные технологии»', $deck['slides'][0]['cover']['department']);
        $this->assertSame('right', $deck['slides'][3]['image_side']);

        // Every image slot got a JPEG on the private disk.
        $this->assertSame([1, 3, 6], $lesson->imageSlots());
        $this->assertSame(self::IMAGES, $lesson->imagesDone());

        foreach ($lesson->imageSlots() as $index) {
            Storage::disk('local')->assertExists($lesson->imageEntry($index)['file']);
        }

        // outline + sections + deck parts + images; tokens of all chat requests accumulate.
        Http::assertSentCount(1 + self::SECTIONS_FOR_50_MINUTES + self::DECK_PARTS + self::IMAGES);
        $this->assertSame(100 * (1 + self::SECTIONS_FOR_50_MINUTES + self::DECK_PARTS), $lesson->prompt_tokens);
        $this->assertSame('gpt-4o-mini', $lesson->model);

        // Images ask for the right orientation and carry the shared style.
        $imageRequests = $this->imageRequests();
        $this->assertCount(self::IMAGES, $imageRequests);
        $this->assertEqualsCanonicalizing(['1024x1536', '1024x1536', '1536x1024'], array_column($imageRequests, 'size'));
        $this->assertStringContainsString('No text', $imageRequests[0]['prompt']);
        $this->assertSame('gpt-image-1.5', $imageRequests[0]['model']);

        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.show', $lesson))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('TeacherAi/Lessons/Show')
                ->where('lesson.status', 'completed')
                ->where('lesson.lecture_number', 3)
                ->where('lesson.progress.slides', true)
                ->where('lesson.progress.images_done', self::IMAGES)
                ->where('lesson.progress.images_total', self::IMAGES)
                ->where('lesson.presentation.version', 2)
                ->has('lesson.presentation.slides', self::SLIDES)
                ->where('lesson.presentation.slides.0.layout', 'cover')
                ->where('lesson.presentation.slides.0.image_status', 'none')
                ->where('lesson.presentation.slides.1.image_status', 'ready')
                ->where('lesson.presentation.slides.1.image_url', fn ($url) => str_starts_with((string) $url, '/teacher-ai/lessons/'.$lesson->id.'/images/1'))
                ->where('lesson.presentation.slides.4.items.0.title', 'Свойство 1')
                ->where('lesson.downloads.lecture', route('teacher-ai.lessons.download.lecture', $lesson, false))
                ->where('lesson.downloads.presentation', route('teacher-ai.lessons.download.presentation', $lesson, false)));

        $image = $this->actingAs($teacher)->get(route('teacher-ai.lessons.image', ['lesson' => $lesson, 'slide' => 1]));
        $image->assertOk()->assertHeader('Content-Type', 'image/jpeg');

        $this->actingAs($teacher)->get(route('teacher-ai.lessons.image', ['lesson' => $lesson, 'slide' => 2]))->assertNotFound();
    }

    public function test_kazakh_deck_gets_a_kazakh_cover_and_numbered_title(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);

        $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), array_merge($this->formData(), [
            'language' => 'kk',
            'lecture_number' => 7,
        ]))->assertSessionHasNoErrors();

        $deck = TeacherAiLesson::query()->sole()->presentation;
        $this->assertStringStartsWith('7-Дәріс. ', $deck['slides'][1]['title']);
        $this->assertSame('«Қ.Құлажанов атындағы Қазақ технология және бизнес университеті» АҚ', $deck['slides'][0]['cover']['university']);
        $this->assertSame('Курс атауы:', $deck['slides'][0]['cover']['course_label']);
        $this->assertStringStartsWith('Астана, ', $deck['slides'][0]['cover']['city_year']);

        // Every deck request tells the model to write in Kazakh.
        foreach ($this->chatRequests('presentation_section') as $request) {
            $this->assertStringContainsString('Пиши на казахском языке', $request['messages'][0]['content']);
        }
    }

    public function test_index_opens_ai_tutors(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);

        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.index'))
            ->assertRedirect('/ai-tutors/');

        // a click in the sidebar of the Inertia app: a full page load of AI Tutors
        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.index'), ['X-Inertia' => 'true'])
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location', '/ai-tutors/');
    }

    public function test_index_lists_the_teachers_lessons_and_prefills_the_cover_fields(): void
    {
        config()->set('services.teacher_ai.redirect_to', '');
        $facultyId = DB::table('faculties')->insertGetId(['name' => 'Факультет экономики и бизнеса', 'created_at' => now(), 'updated_at' => now()]);
        $departmentId = DB::table('departments')->insertGetId(['faculty_id' => $facultyId, 'name' => 'Финансы и учет', 'created_at' => now(), 'updated_at' => now()]);
        $teacher = User::factory()->create(['role' => 'dean', 'faculty_id' => $facultyId, 'department_id' => $departmentId]);
        $other = User::factory()->create(['role' => 'teacher']);
        $this->makeCompletedLesson($teacher);
        $this->makeLesson($teacher, ['status' => TeacherAiLesson::STATUS_PENDING]);
        $this->makeCompletedLesson($other);

        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('TeacherAi/Lessons/Index')
                ->has('lessons', 2)
                ->where('lessons.0.status', 'pending')
                ->where('lessons.0.has_lecture', false)
                ->where('lessons.0.has_presentation', false)
                ->where('lessons.1.status', 'completed')
                ->where('lessons.1.has_lecture', true)
                ->where('lessons.1.has_presentation', true)
                ->where('lessons.1.slides_total', 16)
                ->where('profile.faculty_name', 'Факультет экономики и бизнеса')
                ->where('profile.department_name', 'Финансы и учет')
                ->where('aiEnabled', true)
                ->where('limits.daily', 3)
                ->where('limits.used_today', 2)
                ->has('options.languages', 3)
                ->where('options.slides.min', 8)
                ->where('options.slides.max', 30)
                ->where('options.slides.default', 15));
    }

    public function test_students_cannot_use_the_assistant(): void
    {
        $student = User::factory()->create(['role' => 'student']);

        $this->actingAs($student)->get(route('teacher-ai.lessons.index'))->assertForbidden();
        $this->actingAs($student)->post(route('teacher-ai.lessons.store'), $this->formData())->assertForbidden();

        $this->assertDatabaseCount('teacher_ai_lessons', 0);
        Http::assertNothingSent();
    }

    public function test_teachers_cannot_open_someone_elses_lesson(): void
    {
        $owner = User::factory()->create(['role' => 'teacher']);
        $other = User::factory()->create(['role' => 'teacher']);
        $lesson = $this->makeCompletedLesson($owner, ['status' => TeacherAiLesson::STATUS_FAILED]);

        $this->actingAs($other)->get(route('teacher-ai.lessons.show', $lesson))->assertNotFound();
        $this->actingAs($other)->post(route('teacher-ai.lessons.retry', $lesson))->assertNotFound();
        $this->actingAs($other)->delete(route('teacher-ai.lessons.destroy', $lesson))->assertNotFound();
        $this->actingAs($other)->get(route('teacher-ai.lessons.download.lecture', $lesson))->assertNotFound();
        $this->actingAs($other)->get(route('teacher-ai.lessons.download.presentation', $lesson))->assertNotFound();
        $this->actingAs($other)->get(route('teacher-ai.lessons.image', ['lesson' => $lesson, 'slide' => 1]))->assertNotFound();

        $this->assertModelExists($lesson);
        Http::assertNothingSent();
    }

    public function test_validation_errors_are_reported(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);

        $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), [
            'subject' => 'Базы данных',
            'topic' => '',
            'language' => 'de',
            'duration_minutes' => 45,
            'slides_count' => 40,
            'lecture_number' => 61,
            'faculty_name' => str_repeat('ф', 256),
        ])->assertSessionHasErrors(['topic', 'language', 'duration_minutes', 'slides_count', 'lecture_number', 'faculty_name']);

        $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), array_merge($this->formData(), [
            'slides_count' => 7,
            'lecture_number' => 0,
        ]))->assertSessionHasErrors(['slides_count', 'lecture_number']);

        $this->assertDatabaseCount('teacher_ai_lessons', 0);
        Http::assertNothingSent();
    }

    public function test_daily_limit_is_enforced(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);

        foreach (range(1, 3) as $ignored) {
            $this->makeCompletedLesson($teacher);
        }

        $this->actingAs($teacher)
            ->post(route('teacher-ai.lessons.store'), $this->formData())
            ->assertSessionHas('error');

        $this->assertDatabaseCount('teacher_ai_lessons', 3);
        Http::assertNothingSent();
    }

    public function test_disabled_assistant_rejects_new_lessons(): void
    {
        config()->set('services.teacher_ai.enabled', false);
        config()->set('services.teacher_ai.redirect_to', '');
        $teacher = User::factory()->create(['role' => 'teacher']);

        $this->actingAs($teacher)
            ->post(route('teacher-ai.lessons.store'), $this->formData())
            ->assertSessionHas('error');

        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.index'))
            ->assertInertia(fn ($page) => $page->where('aiEnabled', false));

        $this->assertDatabaseCount('teacher_ai_lessons', 0);
        Http::assertNothingSent();
    }

    public function test_retry_resumes_from_the_slides_step(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $lesson = $this->makeLesson($teacher, [
            'status' => TeacherAiLesson::STATUS_FAILED,
            'step' => TeacherAiLesson::STEP_SLIDES,
            'outline' => $this->normalizedOutline(),
            'sections' => $this->normalizedSections(),
            'error_message' => 'ИИ-сервис временно недоступен. Попробуйте ещё раз позже.',
            'prompt_tokens' => 500,
        ]);

        $this->actingAs($teacher)
            ->post(route('teacher-ai.lessons.retry', $lesson))
            ->assertRedirect(route('teacher-ai.lessons.show', $lesson));

        // Only the deck parts and the images are requested: outline and sections are kept.
        Http::assertSentCount(self::DECK_PARTS + self::IMAGES);
        $lesson->refresh();
        $this->assertSame(TeacherAiLesson::STATUS_COMPLETED, $lesson->status);
        $this->assertCount(self::SLIDES, $lesson->presentation['slides']);
        $this->assertSame(500 + 100 * self::DECK_PARTS, $lesson->prompt_tokens);
        $this->assertNull($lesson->error_message);
    }

    public function test_retry_generates_only_the_missing_sections(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $sections = $this->normalizedSections();
        $sections[1] = null;
        $sections[3] = null;

        $lesson = $this->makeLesson($teacher, [
            'status' => TeacherAiLesson::STATUS_FAILED,
            'step' => TeacherAiLesson::STEP_SECTIONS,
            'step_attempts' => 2,
            'outline' => $this->normalizedOutline(),
            'sections' => $sections,
        ]);

        $this->actingAs($teacher)->post(route('teacher-ai.lessons.retry', $lesson))->assertRedirect();

        Http::assertSentCount(2 + self::DECK_PARTS + self::IMAGES);
        $this->assertSame([2, 4], $this->requestedSectionIndexes());

        $lesson->refresh();
        $this->assertSame(TeacherAiLesson::STATUS_COMPLETED, $lesson->status);
        $this->assertSame(self::SECTIONS_FOR_50_MINUTES, $lesson->sectionsDone());
        // MySQL reorders JSON keys, so compare fields.
        $this->assertSame($this->normalizedSections()[0]['title'], $lesson->sections[0]['title']);
        $this->assertSame('Вторая нормальная форма', $lesson->sections[1]['title']);
        $this->assertSame(0, $lesson->step_attempts);
    }

    public function test_failed_section_is_regenerated_on_the_next_job_run(): void
    {
        $this->failingSectionIndex = 2;
        $this->failuresBeforeSuccess = 2;

        $teacher = User::factory()->create(['role' => 'teacher']);
        $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), $this->formData())->assertSessionHasNoErrors();

        $lesson = TeacherAiLesson::query()->sole();
        $this->assertSame(TeacherAiLesson::STATUS_COMPLETED, $lesson->status);
        $this->assertSame(self::SECTIONS_FOR_50_MINUTES, $lesson->sectionsDone());
        $this->assertSame('Вторая нормальная форма', $lesson->sections[1]['title']);

        // outline + 4 sections + 2 failed attempts for section 2 + deck + images.
        Http::assertSentCount(1 + self::SECTIONS_FOR_50_MINUTES + 2 + self::DECK_PARTS + self::IMAGES);
        $this->assertSame(3, count(array_filter($this->requestedSectionIndexes(), fn (int $index): bool => $index === 2)));
    }

    public function test_sections_step_gives_up_after_three_failed_runs(): void
    {
        $this->failingSectionIndex = 3;
        $this->failuresBeforeSuccess = PHP_INT_MAX;

        $teacher = User::factory()->create(['role' => 'teacher']);
        $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), $this->formData());

        $lesson = TeacherAiLesson::query()->sole();
        $this->assertSame(TeacherAiLesson::STATUS_FAILED, $lesson->status);
        $this->assertSame(TeacherAiLesson::STEP_SECTIONS, $lesson->step);
        $this->assertSame(3, $lesson->step_attempts);
        $this->assertStringStartsWith('Не удалось сгенерировать разделы лекции', (string) $lesson->error_message);
        $this->assertSame(self::SECTIONS_FOR_50_MINUTES - 1, $lesson->sectionsDone());
        $this->assertNull($lesson->presentation);

        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.show', $lesson))
            ->assertInertia(fn ($page) => $page
                ->where('lesson.status', 'failed')
                ->where('lesson.can_retry', true)
                ->where('lesson.progress.sections_done', self::SECTIONS_FOR_50_MINUTES - 1)
                ->where('lesson.lecture.sections.2.paragraphs', null)
                ->where('lesson.presentation', null)
                ->where('lesson.downloads.lecture', null));
    }

    public function test_failed_deck_part_is_regenerated_on_the_next_job_run(): void
    {
        // The part for section 2 fails in the pool and in the sequential retry;
        // the next job run asks only for that part.
        $this->failingPartSection = 2;
        $this->partFailuresBeforeSuccess = 2;

        $teacher = User::factory()->create(['role' => 'teacher']);
        $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), $this->formData())->assertSessionHasNoErrors();

        $lesson = TeacherAiLesson::query()->sole();
        $this->assertSame(TeacherAiLesson::STATUS_COMPLETED, $lesson->status);
        $this->assertCount(self::SLIDES, $lesson->presentation['slides']);
        $this->assertSame('cards', $lesson->presentation['slides'][4]['layout']);
        $this->assertSame(2, $this->failingPartCalls);
        Http::assertSentCount(1 + self::SECTIONS_FOR_50_MINUTES + self::DECK_PARTS + 2 + self::IMAGES);
    }

    public function test_slides_step_gives_up_after_three_failed_runs_and_keeps_the_good_parts(): void
    {
        $this->failingPartSection = 3;
        $this->partFailuresBeforeSuccess = PHP_INT_MAX;

        $teacher = User::factory()->create(['role' => 'teacher']);
        $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), $this->formData());

        $lesson = TeacherAiLesson::query()->sole();
        $this->assertSame(TeacherAiLesson::STATUS_FAILED, $lesson->status);
        $this->assertSame(TeacherAiLesson::STEP_SLIDES, $lesson->step);
        $this->assertStringStartsWith('Не удалось подготовить слайды презентации', (string) $lesson->error_message);
        $this->assertFalse($lesson->hasPresentation());
        $this->assertCount(self::DECK_PARTS - 1, $lesson->presentation['parts']);

        // A retry asks only for the missing part.
        $this->partFailuresBeforeSuccess = 0;
        $before = count(Http::recorded());
        $this->actingAs($teacher)->post(route('teacher-ai.lessons.retry', $lesson))->assertRedirect();

        $this->assertCount($before + 1 + self::IMAGES, Http::recorded());
        $this->assertSame(TeacherAiLesson::STATUS_COMPLETED, $lesson->refresh()->status);
        $this->assertCount(self::SLIDES, $lesson->presentation['slides']);
    }

    public function test_an_image_that_keeps_failing_leaves_a_placeholder_but_the_lesson_completes(): void
    {
        $this->failingImageMarker = 'MARKER-BANNER';
        $this->failingImageStatus = 400;

        $teacher = User::factory()->create(['role' => 'teacher']);
        $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), $this->formData())->assertSessionHasNoErrors();

        $lesson = TeacherAiLesson::query()->sole();
        $this->assertSame(TeacherAiLesson::STATUS_COMPLETED, $lesson->status);
        $this->assertSame(self::IMAGES - 1, $lesson->imagesDone());
        $this->assertSame(TeacherAiLesson::IMAGE_FAILED, $lesson->imageEntry(6)['status']);
        $this->assertSame(2, $lesson->imageEntry(6)['attempts']);
        $this->assertNull($lesson->imagePath(6));

        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.show', $lesson))
            ->assertInertia(fn ($page) => $page
                ->where('lesson.presentation.slides.6.image_status', 'failed')
                ->where('lesson.presentation.slides.6.image_url', null)
                ->where('lesson.downloads.presentation', fn ($url) => $url !== null));
    }

    public function test_a_rate_limited_image_is_requested_again(): void
    {
        $this->failingImageMarker = 'MARKER-BANNER';
        $this->failingImageStatus = 429;
        $this->imageFailuresBeforeSuccess = 2;

        $teacher = User::factory()->create(['role' => 'teacher']);
        $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), $this->formData())->assertSessionHasNoErrors();

        $lesson = TeacherAiLesson::query()->sole();
        $this->assertSame(TeacherAiLesson::STATUS_COMPLETED, $lesson->status);
        $this->assertSame(self::IMAGES, $lesson->imagesDone());
        // Rate limits are not counted as attempts.
        $this->assertSame(1, $lesson->imageEntry(6)['attempts']);
        $this->assertSame(2, $lesson->imageEntry(6)['throttled']);
        $this->assertCount(self::IMAGES + 2, $this->imageRequests());
    }

    public function test_without_images_the_deck_uses_text_layouts_and_skips_the_images_step(): void
    {
        config()->set('services.teacher_ai.images_enabled', false);

        $teacher = User::factory()->create(['role' => 'teacher']);
        $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), $this->formData())->assertSessionHasNoErrors();

        $lesson = TeacherAiLesson::query()->sole();
        $this->assertSame(TeacherAiLesson::STATUS_COMPLETED, $lesson->status);
        $this->assertSame([], $lesson->images);
        $this->assertSame([], $this->imageRequests());

        $layouts = array_column($lesson->presentation['slides'], 'layout');
        $this->assertNotContains('image_text', $layouts);
        $this->assertNotContains('banner_columns', $layouts);
        // The lecture title keeps its slot, shown as a decorative placeholder.
        $this->assertTrue($lesson->presentation['slides'][1]['image']);

        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.show', $lesson))
            ->assertInertia(fn ($page) => $page
                ->where('lesson.presentation.slides.1.image_status', 'none')
                ->where('lesson.progress.images_total', 0));
    }

    public function test_presentation_download_waits_for_the_images(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $lesson = $this->makeCompletedLesson($teacher, [
            'status' => TeacherAiLesson::STATUS_PROCESSING,
            'step' => TeacherAiLesson::STEP_IMAGES,
            'images' => ['1' => ['status' => 'pending', 'prompt' => 'x', 'attempts' => 0]],
        ]);

        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.show', $lesson))
            ->assertInertia(fn ($page) => $page
                ->where('lesson.step', 'images')
                ->where('lesson.presentation.slides.1.image_status', 'pending')
                ->where('lesson.downloads.presentation', null)
                ->where('lesson.downloads.lecture', fn ($url) => $url !== null));
    }

    public function test_outline_failure_marks_the_lesson_failed_and_retryable(): void
    {
        $this->outlineUnavailable = true;
        $teacher = User::factory()->create(['role' => 'teacher']);

        $this->actingAs($teacher)->post(route('teacher-ai.lessons.store'), $this->formData());

        $lesson = TeacherAiLesson::query()->sole();
        $this->assertSame(TeacherAiLesson::STATUS_FAILED, $lesson->status);
        $this->assertSame(TeacherAiLesson::STEP_OUTLINE, $lesson->step);
        $this->assertNotEmpty($lesson->error_message);
        $this->assertNull($lesson->outline);
        $this->assertTrue($lesson->canRetry());
    }

    public function test_stale_lesson_is_shown_as_failed_and_can_be_retried(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $lesson = $this->makeLesson($teacher, [
            'status' => TeacherAiLesson::STATUS_PROCESSING,
            'step' => TeacherAiLesson::STEP_SLIDES,
            'outline' => $this->normalizedOutline(),
            'sections' => $this->normalizedSections(),
        ]);
        DB::table('teacher_ai_lessons')->where('id', $lesson->id)->update([
            'updated_at' => now()->subMinutes(TeacherAiLesson::STALE_AFTER_MINUTES + 5),
        ]);

        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.show', $lesson))
            ->assertInertia(fn ($page) => $page
                ->where('lesson.status', 'failed')
                ->where('lesson.can_retry', true)
                ->where('lesson.error_message', 'Генерация не завершилась. Нажмите «Повторить» — работа продолжится с места остановки.'));

        $this->actingAs($teacher)->post(route('teacher-ai.lessons.retry', $lesson))->assertRedirect();
        $this->assertSame(TeacherAiLesson::STATUS_COMPLETED, $lesson->refresh()->status);
    }

    public function test_retry_is_rejected_while_generation_is_running(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $lesson = $this->makeLesson($teacher, ['status' => TeacherAiLesson::STATUS_PROCESSING]);

        $this->actingAs($teacher)
            ->post(route('teacher-ai.lessons.retry', $lesson))
            ->assertSessionHas('warning');

        Http::assertNothingSent();
        $this->assertSame(TeacherAiLesson::STATUS_PROCESSING, $lesson->refresh()->status);
    }

    public function test_downloads_return_office_files(): void
    {
        $teacher = User::factory()->create(['role' => 'hod']);
        $lesson = $this->makeCompletedLesson($teacher);

        $docx = $this->actingAs($teacher)->get(route('teacher-ai.lessons.download.lecture', $lesson));
        $docx->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        $this->assertStringContainsString('attachment', (string) $docx->headers->get('Content-Disposition'));
        $this->assertStringContainsString('.docx', (string) $docx->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('PK', $this->downloadedBody($docx));

        $pptx = $this->actingAs($teacher)->get(route('teacher-ai.lessons.download.presentation', $lesson));
        $pptx->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        $this->assertStringContainsString('.pptx', (string) $pptx->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('PK', $this->downloadedBody($pptx));
    }

    public function test_download_before_ready_redirects_with_error(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $lesson = $this->makeLesson($teacher, [
            'status' => TeacherAiLesson::STATUS_PROCESSING,
            'step' => TeacherAiLesson::STEP_SECTIONS,
            'outline' => $this->normalizedOutline(),
            'sections' => [null, null, null, null],
        ]);

        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.download.lecture', $lesson))
            ->assertRedirect(route('teacher-ai.lessons.show', $lesson))
            ->assertSessionHas('error');

        $this->actingAs($teacher)
            ->get(route('teacher-ai.lessons.download.presentation', $lesson))
            ->assertRedirect(route('teacher-ai.lessons.show', $lesson))
            ->assertSessionHas('error');
    }

    public function test_owner_can_delete_a_lesson_with_its_images(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $lesson = $this->makeCompletedLesson($teacher);
        $file = $lesson->imageDirectory().'/s1-abc.jpg';
        Storage::disk('local')->put($file, 'jpeg');
        $lesson->update(['images' => ['1' => ['status' => 'ready', 'file' => $file, 'attempts' => 1]]]);

        $this->actingAs($teacher)
            ->delete(route('teacher-ai.lessons.destroy', $lesson))
            ->assertRedirect(route('teacher-ai.lessons.index'));

        $this->assertModelMissing($lesson);
        Storage::disk('local')->assertMissing($file);
    }

    /**
     * Routes the fake by the `task_type` of the JSON user message, like the
     * real API would see it.
     */
    private function fakeCompletion(Request $request): PromiseInterface
    {
        $content = (string) ($request->data()['messages'][1]['content'] ?? '');
        $payload = json_decode($content, true);

        if (! is_array($payload)) {
            // A retry hint may follow the JSON: cut it off.
            $payload = json_decode(substr($content, 0, (int) strrpos($content, '}') + 1), true) ?: [];
        }

        switch ($payload['task_type'] ?? null) {
            case 'outline':
                if ($this->outlineUnavailable) {
                    return Http::response(['error' => ['message' => 'overloaded']], 503);
                }

                return $this->aiResponse($this->outlinePayload());

            case 'section':
                $index = (int) ($payload['section_index'] ?? 0);

                if ($index === $this->failingSectionIndex && $this->failingSectionCalls < $this->failuresBeforeSuccess) {
                    $this->failingSectionCalls++;

                    return Http::response(['error' => ['message' => 'upstream error']], 500);
                }

                return $this->aiResponse($this->sectionPayload($index));

            case 'presentation_opening':
                return $this->aiResponse($this->openingPayload());

            case 'presentation_section':
                $number = (int) ($payload['section']['number'] ?? 0);

                if ($number === $this->failingPartSection && $this->failingPartCalls < $this->partFailuresBeforeSuccess) {
                    $this->failingPartCalls++;

                    return Http::response(['error' => ['message' => 'upstream error']], 500);
                }

                return $this->aiResponse(['slides' => array_map(
                    fn (string $layout): array => $this->slideFor($layout, $number),
                    (array) ($payload['layouts'] ?? []),
                )]);

            case 'presentation_closing':
                return $this->aiResponse($this->closingPayload());

            default:
                return Http::response(['error' => ['message' => 'unknown task_type']], 400);
        }
    }

    private function fakeImage(Request $request): PromiseInterface
    {
        $prompt = (string) ($request->data()['prompt'] ?? '');

        if ($this->failingImageMarker !== '' && str_contains($prompt, $this->failingImageMarker)
            && $this->failingImageCalls < $this->imageFailuresBeforeSuccess) {
            $this->failingImageCalls++;

            return Http::response(['error' => ['message' => 'rejected']], $this->failingImageStatus);
        }

        return Http::response([
            'created' => 1,
            'data' => [['b64_json' => base64_encode($this->tinyJpeg())]],
            'usage' => ['output_tokens' => 400],
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function aiResponse(array $payload): PromiseInterface
    {
        return Http::response([
            'model' => 'gpt-4o-mini',
            'choices' => [[
                'finish_reason' => 'stop',
                'message' => ['role' => 'assistant', 'content' => json_encode($payload, JSON_UNESCAPED_UNICODE)],
            ]],
            'usage' => ['prompt_tokens' => 100, 'completion_tokens' => 50],
        ]);
    }

    /**
     * 1-based section indexes requested so far, in request order.
     *
     * @return list<int>
     */
    private function requestedSectionIndexes(): array
    {
        $indexes = [];

        foreach ($this->chatRequests('section') as $data) {
            $payload = json_decode((string) $data['messages'][1]['content'], true);
            $indexes[] = (int) ($payload['section_index'] ?? 0);
        }

        return $indexes;
    }

    /**
     * Chat requests of one task type, as sent.
     *
     * @return list<array<string, mixed>>
     */
    private function chatRequests(string $taskType): array
    {
        $requests = [];

        foreach (Http::recorded() as [$request]) {
            $content = (string) ($request->data()['messages'][1]['content'] ?? '');

            if (preg_match('/"task_type":\s*"([a-z_]+)"/u', $content, $match) === 1 && $match[1] === $taskType) {
                $requests[] = $request->data();
            }
        }

        return $requests;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function imageRequests(): array
    {
        $requests = [];

        foreach (Http::recorded() as [$request]) {
            if (str_starts_with($request->url(), self::IMAGE_ENDPOINT)) {
                $requests[] = $request->data();
            }
        }

        return $requests;
    }

    private function tinyJpeg(): string
    {
        $image = imagecreatetruecolor(16, 24);
        imagefill($image, 0, 0, (int) imagecolorallocate($image, 75, 79, 196));
        ob_start();
        imagejpeg($image, null, 80);
        imagedestroy($image);

        return (string) ob_get_clean();
    }

    private function downloadedBody(\Illuminate\Testing\TestResponse $response): string
    {
        $file = $response->baseResponse->getFile();
        $body = (string) file_get_contents($file->getPathname());
        @unlink($file->getPathname());

        return $body;
    }

    /**
     * @return array<string, mixed>
     */
    private function formData(): array
    {
        return [
            'subject' => '  Базы данных ',
            'topic' => 'Нормализация реляционных баз данных',
            'language' => 'ru',
            'audience' => '',
            'duration_minutes' => 50,
            'slides_count' => self::SLIDES,
            'lecture_number' => 3,
            'faculty_name' => 'Факультет инжиниринга и информационных технологий',
            'department_name' => 'Информационные технологии',
            'notes' => 'Больше практических примеров.',
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function makeLesson(User $user, array $overrides = []): TeacherAiLesson
    {
        return TeacherAiLesson::create(array_merge([
            'user_id' => $user->id,
            'subject' => 'Базы данных',
            'topic' => 'Нормализация реляционных баз данных',
            'language' => 'ru',
            'duration_minutes' => 50,
            'slides_count' => self::SLIDES,
            'status' => TeacherAiLesson::STATUS_PENDING,
            'step' => TeacherAiLesson::STEP_OUTLINE,
        ], $overrides));
    }

    /**
     * A finished lesson whose deck is the 16-slide template fixture.
     *
     * @param  array<string, mixed>  $overrides
     */
    private function makeCompletedLesson(User $user, array $overrides = []): TeacherAiLesson
    {
        $deck = json_decode((string) file_get_contents(base_path('tests/Fixtures/TeacherAi/presentation-v2.json')), true);

        return $this->makeLesson($user, array_merge([
            'status' => TeacherAiLesson::STATUS_COMPLETED,
            'step' => TeacherAiLesson::STEP_DONE,
            'outline' => $this->normalizedOutline(),
            'sections' => $this->normalizedSections(),
            'presentation' => $deck,
            'images' => [],
            'model' => 'gpt-4o-mini',
            'completed_at' => now(),
        ], $overrides));
    }

    /**
     * Raw model answer for the outline step (exactly 4 sections for 50 minutes).
     *
     * @return array<string, mixed>
     */
    private function outlinePayload(): array
    {
        return [
            'title' => 'Нормализация реляционных баз данных',
            'objectives' => [
                'Объяснить назначение нормализации и виды аномалий данных.',
                'Определять функциональные зависимости между атрибутами.',
                'Приводить отношение к 1НФ, 2НФ и 3НФ.',
            ],
            'introduction' => "Нормализация — это процесс организации данных в реляционной базе, уменьшающий избыточность и предотвращающий аномалии обновления, вставки и удаления.\n\nВ этой лекции мы рассмотрим первые три нормальные формы и научимся применять их к реальным схемам.",
            'sections' => [
                ['title' => 'Первая нормальная форма', 'key_points' => ['Атомарность значений', 'Отсутствие повторяющихся групп', 'Первичный ключ']],
                ['title' => 'Вторая нормальная форма', 'key_points' => ['Полная функциональная зависимость', 'Составные ключи', 'Частичные зависимости']],
                ['title' => 'Третья нормальная форма', 'key_points' => ['Транзитивные зависимости', 'Декомпозиция без потерь', 'Сохранение зависимостей']],
                ['title' => 'Денормализация и практика', 'key_points' => ['Когда денормализация оправдана', 'Производительность чтения', 'Примеры из промышленных систем']],
            ],
            'conclusion' => 'Нормализация делает схему данных устойчивой к аномалиям; выбор уровня нормализации — компромисс между целостностью и производительностью.',
            'self_check_questions' => [
                'Что такое функциональная зависимость?',
                'Чем 2НФ отличается от 3НФ?',
                'Приведите пример аномалии обновления.',
                'Когда допустима денормализация?',
                'Что такое декомпозиция без потерь?',
            ],
            'glossary' => [
                ['term' => 'Нормальная форма', 'definition' => 'Набор требований к структуре отношения, исключающий определённый класс аномалий.'],
                ['term' => 'Функциональная зависимость', 'definition' => 'Связь, при которой значение одного набора атрибутов однозначно определяет значение другого.'],
                ['term' => 'Транзитивная зависимость', 'definition' => 'Зависимость неключевого атрибута от другого неключевого атрибута.'],
                ['term' => 'Декомпозиция', 'definition' => 'Разбиение отношения на несколько отношений с сохранением информации.'],
                ['term' => 'Аномалия', 'definition' => 'Нежелательный побочный эффект операций вставки, обновления или удаления.'],
                ['term' => 'Составной ключ', 'definition' => 'Первичный ключ, состоящий из нескольких атрибутов.'],
            ],
            'references' => [
                'Дейт К. Дж. Введение в системы баз данных. 8-е изд., 2005.',
                'Коннолли Т., Бегг К. Базы данных. Проектирование, реализация и сопровождение. 2003.',
                'Garcia-Molina H., Ullman J., Widom J. Database Systems: The Complete Book. 2008.',
            ],
            'keywords' => ['нормализация', '1НФ', '2НФ', '3НФ', 'функциональная зависимость', 'декомпозиция'],
        ];
    }

    /**
     * Raw model answer for one section (1-based index).
     *
     * @return array<string, mixed>
     */
    private function sectionPayload(int $index): array
    {
        $titles = [
            1 => 'Первая нормальная форма',
            2 => 'Вторая нормальная форма',
            3 => 'Третья нормальная форма',
            4 => 'Денормализация и практика',
        ];
        $title = $titles[$index] ?? ('Раздел '.$index);

        return [
            'title' => $title,
            'paragraphs' => [
                'Отношение находится в '.$title.', если выполняются её условия. Рассмотрим их подробнее на примере таблицы заказов интернет-магазина, в которой хранятся клиенты, товары и даты покупок.',
                'Нарушение требований ведёт к избыточности: одни и те же сведения повторяются в нескольких строках, а исправление адреса клиента требует обновить десятки записей. Декомпозиция устраняет этот недостаток.',
            ],
            'key_terms' => [
                ['term' => 'Атрибут', 'definition' => 'Именованный столбец отношения.'],
            ],
            'examples' => [
                'Пример: таблица «Заказы» со столбцами (номер заказа, клиент, телефон клиента, товар) разбивается на «Клиенты» и «Заказы».',
            ],
            'summary' => 'Раздел «'.$title.'» показывает, какие зависимости допустимы и как провести декомпозицию.',
        ];
    }

    /**
     * Raw model answer for the opening part of the deck.
     *
     * @return array<string, mixed>
     */
    private function openingPayload(): array
    {
        return [
            'cover' => [
                'faculty' => 'Факультет инжиниринга и информационных технологий',
                'department' => 'Кафедра «Информационные технологии»',
            ],
            'subtitle' => 'Как устранить избыточность и аномалии в реляционных схемах',
            'slides' => [
                ['layout' => 'lecture_title', 'subtitle' => 'Как устранить избыточность и аномалии в реляционных схемах', 'image_prompt' => 'MARKER-TITLE Database tables floating in space', 'notes' => 'Обозначьте цель занятия.'],
                [
                    'layout' => 'text_bullets',
                    'title' => 'Нормализация – способ организовать данные без аномалий',
                    'paragraphs' => ['Нормализация уменьшает избыточность данных.', 'Она основана на функциональных зависимостях.'],
                    'side_title' => 'Основные характеристики',
                    'bullets' => ['Атомарность', 'Отсутствие избыточности', 'Целостность данных'],
                    'notes' => 'Дайте определение.',
                ],
            ],
        ];
    }

    /**
     * Raw model answer for one content slide of a section part.
     *
     * @return array<string, mixed>
     */
    private function slideFor(string $layout, int $section): array
    {
        $items = array_map(fn (int $index): array => ['title' => 'Свойство '.$index, 'text' => 'Пояснение к свойству '.$index.'.'], range(1, 4));

        return match ($layout) {
            'image_text' => ['layout' => 'image_text', 'title' => 'Раздел '.$section.': суть', 'paragraphs' => ['Первый абзац.', 'Второй абзац.'], 'image_prompt' => 'MARKER-IMAGE Server racks', 'notes' => 'Заметки.'],
            'banner_columns' => [
                'layout' => 'banner_columns',
                'title' => 'Раздел '.$section.': сравнение',
                'columns' => [['title' => 'Плюсы', 'text' => 'Быстро.', 'bullets' => ['Скорость']], ['title' => 'Минусы', 'text' => 'Дорого.', 'bullets' => ['Цена']]],
                'image_prompt' => 'MARKER-BANNER Data center panorama',
                'notes' => 'Заметки.',
            ],
            'text_bullets' => ['layout' => 'text_bullets', 'title' => 'Раздел '.$section.': обзор', 'paragraphs' => ['Абзац раздела.'], 'side_title' => 'Главное', 'bullets' => ['Пункт 1', 'Пункт 2'], 'notes' => 'Заметки.'],
            'timeline' => ['layout' => 'timeline', 'title' => 'Раздел '.$section.': этапы', 'items' => $items, 'footer' => 'Итог этапов.', 'notes' => 'Заметки.'],
            default => ['layout' => $layout, 'title' => 'Раздел '.$section.': свойства', 'items' => $items, 'footer' => 'Итог.', 'notes' => 'Заметки.'],
        };
    }

    /**
     * Raw model answer for the closing part of the deck.
     *
     * @return array<string, mixed>
     */
    private function closingPayload(): array
    {
        return [
            'slides' => [[
                'layout' => 'conclusion',
                'title' => 'Заключение: нормализация на практике',
                'items' => [
                    ['title' => '1НФ', 'text' => 'Атомарные значения.'],
                    ['title' => '2НФ', 'text' => 'Нет частичных зависимостей.'],
                    ['title' => '3НФ', 'text' => 'Нет транзитивных зависимостей.'],
                    ['title' => 'Практика', 'text' => 'Денормализация — осознанный компромисс.'],
                ],
                'footer' => 'Нормализация делает схему устойчивой к аномалиям.',
                'notes' => 'Подведите итоги.',
            ]],
        ];
    }

    /**
     * Outline as stored after LessonGenerator::normalizeOutline().
     *
     * @return array<string, mixed>
     */
    private function normalizedOutline(): array
    {
        return $this->outlinePayload();
    }

    /**
     * Sections as stored after LessonGenerator::normalizeSection().
     *
     * @return list<array<string, mixed>>
     */
    private function normalizedSections(): array
    {
        return array_map(fn (int $index): array => $this->sectionPayload($index), range(1, self::SECTIONS_FOR_50_MINUTES));
    }
}
