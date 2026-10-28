<?php

namespace App\Http\Controllers;

use App\Models\TeacherAiLesson;
use App\Models\User;
use App\Services\TeacherAi\LessonDocxExporter;
use App\Services\TeacherAi\LessonLocale;
use App\Services\TeacherAi\LessonPptxExporter;
use App\Services\TeacherAi\TeacherAiException;
use App\Services\TeacherAi\TeacherAiLessonService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class TeacherAiLessonController extends Controller
{
    /**
     * Everyone who teaches: teachers, heads of department, deans; admins for support.
     */
    private const ALLOWED_ROLES = ['teacher', 'hod', 'dean', 'admin', 'superadmin'];

    private const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    private const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    public function __construct(private readonly TeacherAiLessonService $service) {}

    public function index(Request $request): Response|SymfonyResponse
    {
        $user = $this->authorizeTeacher($request);

        // The assistant moved to AI Tutors: a full page load there (an Inertia visit gets 409 + X-Inertia-Location).
        $redirectTo = (string) config('services.teacher_ai.redirect_to');
        if ($redirectTo !== '') {
            return Inertia::location($redirectTo);
        }

        return Inertia::render('TeacherAi/Lessons/Index', [
            'lessons' => $this->service->listForUser($user),
            'options' => TeacherAiLessonService::formOptions(),
            // Prefill of the title slide fields; the teacher may change them.
            'profile' => [
                'faculty_name' => (string) ($user->faculty?->name ?? ''),
                'department_name' => (string) ($user->department?->name ?? ''),
            ],
            'aiEnabled' => $this->service->isEnabled(),
            'limits' => [
                'daily' => $this->service->dailyLimit(),
                'used_today' => $this->service->usedToday($user),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->authorizeTeacher($request);

        if (! $this->service->isEnabled()) {
            return Redirect::back()->with('error', 'AI-ассистент сейчас отключён. Обратитесь к администратору.');
        }

        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'topic' => ['required', 'string', 'max:500'],
            'language' => ['required', 'string', Rule::in(array_keys(LessonLocale::LANGUAGES))],
            'audience' => ['nullable', 'string', 'max:255'],
            'duration_minutes' => ['required', 'integer', Rule::in(TeacherAiLessonService::DURATIONS)],
            'slides_count' => ['required', 'integer', 'min:'.TeacherAiLessonService::SLIDES_MIN, 'max:'.TeacherAiLessonService::SLIDES_MAX],
            'notes' => ['nullable', 'string', 'max:1000'],
            'lecture_number' => ['nullable', 'integer', 'min:1', 'max:'.TeacherAiLessonService::LECTURE_NUMBER_MAX],
            'faculty_name' => ['nullable', 'string', 'max:255'],
            'department_name' => ['nullable', 'string', 'max:255'],
        ], [
            'subject.required' => 'Укажите название дисциплины или урока.',
            'subject.max' => 'Название не должно превышать 255 символов.',
            'topic.required' => 'Укажите тему занятия.',
            'topic.max' => 'Тема не должна превышать 500 символов.',
            'language.required' => 'Выберите язык материалов.',
            'language.in' => 'Выберите язык материалов из списка.',
            'audience.max' => 'Описание аудитории не должно превышать 255 символов.',
            'duration_minutes.required' => 'Выберите длительность занятия.',
            'duration_minutes.integer' => 'Выберите длительность занятия из списка.',
            'duration_minutes.in' => 'Выберите длительность занятия из списка.',
            'slides_count.required' => 'Укажите количество слайдов.',
            'slides_count.integer' => 'Количество слайдов должно быть целым числом.',
            'slides_count.min' => 'Минимум '.TeacherAiLessonService::SLIDES_MIN.' слайдов.',
            'slides_count.max' => 'Максимум '.TeacherAiLessonService::SLIDES_MAX.' слайда.',
            'notes.max' => 'Пожелания не должны превышать 1000 символов.',
            'lecture_number.integer' => 'Номер лекции должен быть целым числом.',
            'lecture_number.min' => 'Номер лекции — от 1 до '.TeacherAiLessonService::LECTURE_NUMBER_MAX.'.',
            'lecture_number.max' => 'Номер лекции — от 1 до '.TeacherAiLessonService::LECTURE_NUMBER_MAX.'.',
            'faculty_name.max' => 'Название факультета не должно превышать 255 символов.',
            'department_name.max' => 'Название кафедры не должно превышать 255 символов.',
        ]);

        if ($this->service->usedToday($user) >= $this->service->dailyLimit()) {
            return Redirect::back()->with('error', 'Дневной лимит генераций исчерпан. Попробуйте завтра.');
        }

        $lesson = $this->service->create($user, $validated);

        return Redirect::route('teacher-ai.lessons.show', $lesson)
            ->with('success', 'Генерация запущена. Обычно это занимает 2–5 минут.');
    }

    public function show(Request $request, TeacherAiLesson $lesson): Response
    {
        $this->authorizeOwner($request, $lesson);

        return Inertia::render('TeacherAi/Lessons/Show', [
            'lesson' => $this->service->toDetails($lesson),
        ]);
    }

    public function retry(Request $request, TeacherAiLesson $lesson): RedirectResponse
    {
        $this->authorizeOwner($request, $lesson);

        if (! $this->service->isEnabled()) {
            return Redirect::back()->with('error', 'AI-ассистент сейчас отключён. Обратитесь к администратору.');
        }

        if (! $lesson->canRetry()) {
            return Redirect::back()->with('warning', 'Генерация уже выполняется или завершена.');
        }

        $this->service->retry($lesson);

        return Redirect::route('teacher-ai.lessons.show', $lesson)
            ->with('success', 'Генерация запущена повторно.');
    }

    public function destroy(Request $request, TeacherAiLesson $lesson): RedirectResponse
    {
        $this->authorizeOwner($request, $lesson);

        $this->service->delete($lesson);

        return Redirect::route('teacher-ai.lessons.index')
            ->with('success', 'Материалы удалены.');
    }

    /**
     * A generated slide illustration (private storage, owner only).
     */
    public function image(Request $request, TeacherAiLesson $lesson, int $slide): BinaryFileResponse
    {
        $this->authorizeOwner($request, $lesson);

        $path = $lesson->imagePath($slide);

        if ($path === null) {
            abort(404);
        }

        return response()->file($path, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'private, max-age=604800',
        ]);
    }

    public function downloadLecture(Request $request, TeacherAiLesson $lesson, LessonDocxExporter $exporter): BinaryFileResponse|RedirectResponse
    {
        $this->authorizeOwner($request, $lesson);

        if (! $lesson->hasLecture()) {
            return Redirect::route('teacher-ai.lessons.show', $lesson)->with('error', 'Лекция ещё не готова.');
        }

        try {
            $path = $exporter->export($lesson);
        } catch (TeacherAiException $e) {
            return Redirect::route('teacher-ai.lessons.show', $lesson)->with('error', $e->getMessage());
        }

        return $this->downloadFile($path, $this->fileName($lesson, 'Лекция', 'docx'), self::DOCX_MIME);
    }

    public function downloadPresentation(Request $request, TeacherAiLesson $lesson, LessonPptxExporter $exporter): BinaryFileResponse|RedirectResponse
    {
        $this->authorizeOwner($request, $lesson);

        if (! $lesson->hasPresentation()) {
            return Redirect::route('teacher-ai.lessons.show', $lesson)->with('error', 'Презентация ещё не готова.');
        }

        try {
            $path = $exporter->export($lesson);
        } catch (TeacherAiException $e) {
            return Redirect::route('teacher-ai.lessons.show', $lesson)->with('error', $e->getMessage());
        }

        return $this->downloadFile($path, $this->fileName($lesson, 'Презентация', 'pptx'), self::PPTX_MIME);
    }

    /**
     * The exporter writes a temp file; it is removed once sent. The MIME type
     * is set explicitly because finfo often reports OOXML files as plain zip.
     */
    private function downloadFile(string $path, string $name, string $mime): BinaryFileResponse
    {
        return response()
            ->download($path, $name, ['Content-Type' => $mime])
            ->deleteFileAfterSend(true);
    }

    /**
     * "Лекция — Название.docx": safe for file systems; Laravel adds the
     * ASCII fallback name for old browsers itself.
     */
    private function fileName(TeacherAiLesson $lesson, string $prefix, string $extension): string
    {
        $title = $lesson->outline['title'] ?? null;
        $title = is_string($title) && trim($title) !== '' ? $title : (string) $lesson->topic;

        $title = preg_replace('/[\/\\\\:*?"<>|\x00-\x1F\x7F]+/u', ' ', $title) ?? '';
        $title = trim(preg_replace('/\s+/u', ' ', $title) ?? '');
        $title = mb_substr($title, 0, 80);

        if ($title === '') {
            $title = 'Материалы';
        }

        return $prefix.' — '.$title.'.'.$extension;
    }

    private function authorizeTeacher(Request $request): User
    {
        $user = $request->user();

        if (! $user || ! in_array($user->resolvedRoleSlug(), self::ALLOWED_ROLES, true)) {
            abort(403, 'AI-ассистент доступен преподавателям.');
        }

        return $user;
    }

    private function authorizeOwner(Request $request, TeacherAiLesson $lesson): void
    {
        $user = $this->authorizeTeacher($request);

        // 404 rather than 403: do not reveal that someone else's lesson exists.
        if ((int) $lesson->user_id !== (int) $user->id) {
            abort(404);
        }
    }
}
