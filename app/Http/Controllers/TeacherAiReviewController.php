<?php

namespace App\Http\Controllers;

use App\Jobs\RunTeacherAiReview;
use App\Models\TeacherAiReview;
use App\Models\User;
use App\Services\TeacherAi\DocumentTextExtractor;
use App\Services\TeacherAi\TeacherAiReviewException;
use App\Services\TeacherAi\TeacherAiReviewService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeacherAiReviewController extends Controller
{
    /**
     * Everyone who teaches: teachers, heads of department, deans; admins for support.
     */
    private const ALLOWED_ROLES = ['teacher', 'hod', 'dean', 'admin', 'superadmin'];

    private const MAX_FILE_KB = 10240;

    public function __construct(private readonly TeacherAiReviewService $service)
    {
    }

    public function index(Request $request): Response
    {
        $user = $this->authorizeTeacher($request);

        $reviews = TeacherAiReview::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->limit(50)
            ->get(['id', 'document_type', 'title', 'status', 'findings', 'created_at', 'updated_at']);

        return Inertia::render('TeacherAi/Index', [
            'documentTypes' => TeacherAiReviewService::documentTypeOptions(),
            'reviews' => $reviews->map(fn (TeacherAiReview $review): array => [
                'id' => $review->id,
                'title' => $review->title,
                'document_type_label' => TeacherAiReviewService::documentTypeLabel($review->document_type),
                'status' => $review->isStale() ? TeacherAiReview::STATUS_FAILED : $review->status,
                'findings_count' => $this->countBySeverity($review->findings ?? []),
                'created_at' => $review->created_at?->format('d.m.Y H:i'),
            ])->values(),
            'aiEnabled' => $this->service->isEnabled(),
            'limits' => [
                'daily' => $this->service->dailyLimit(),
                'used_today' => $this->usedToday($user),
                'max_file_mb' => (int) (self::MAX_FILE_KB / 1024),
                'max_chars' => $this->service->maxChars(),
            ],
        ]);
    }

    public function store(Request $request, DocumentTextExtractor $extractor): RedirectResponse
    {
        $user = $this->authorizeTeacher($request);

        if (! $this->service->isEnabled()) {
            return Redirect::back()->with('error', 'ИИ-помощник сейчас отключён. Обратитесь к администратору.');
        }

        $validated = $request->validate([
            'document_type' => ['required', 'string', Rule::in(array_keys(TeacherAiReviewService::DOCUMENT_TYPES))],
            'title' => ['nullable', 'string', 'max:255'],
            'focus' => ['nullable', 'string', 'max:1000'],
            // Extension, not MIME sniffing: DOCX from Google Docs and similar editors is often
            // detected as application/zip. The extractor validates the content itself, and the
            // file is never stored or served back.
            'document' => ['nullable', 'required_without:text', 'file', 'extensions:' . implode(',', DocumentTextExtractor::EXTENSIONS), 'max:' . self::MAX_FILE_KB],
            'text' => ['nullable', 'required_without:document', 'string', 'max:200000'],
        ], [
            'document_type.required' => 'Выберите тип документа.',
            'document_type.in' => 'Выберите тип документа из списка.',
            'title.max' => 'Название не должно превышать 255 символов.',
            'focus.max' => 'Комментарий не должен превышать 1000 символов.',
            'document.required_without' => 'Прикрепите файл или вставьте текст документа.',
            'document.file' => 'Не удалось загрузить файл.',
            'document.uploaded' => 'Не удалось загрузить файл. Возможно, он слишком большой.',
            'document.extensions' => 'Поддерживаются только файлы PDF, DOCX и TXT. Файл DOC сохраните как DOCX.',
            'document.max' => 'Файл не должен превышать ' . (int) (self::MAX_FILE_KB / 1024) . ' МБ.',
            'text.required_without' => 'Прикрепите файл или вставьте текст документа.',
            'text.max' => 'Текст слишком длинный. Загрузите его файлом.',
        ]);

        if ($this->usedToday($user) >= $this->service->dailyLimit()) {
            return Redirect::back()->with('error', 'Дневной лимит проверок исчерпан. Попробуйте завтра.');
        }

        $file = $request->file('document');
        $source = $file instanceof UploadedFile ? TeacherAiReview::SOURCE_FILE : TeacherAiReview::SOURCE_TEXT;

        try {
            $rawText = $file instanceof UploadedFile
                ? $extractor->extract($file->getRealPath(), $file->getClientOriginalExtension())
                : $extractor->normalize((string) $validated['text']);
        } catch (TeacherAiReviewException $e) {
            return Redirect::back()->withErrors(['document' => $e->getMessage()]);
        }

        $errorField = $source === TeacherAiReview::SOURCE_FILE ? 'document' : 'text';

        if (mb_strlen($rawText) < TeacherAiReviewService::MIN_CHARS) {
            return Redirect::back()->withErrors([
                $errorField => $source === TeacherAiReview::SOURCE_FILE
                    ? 'В файле почти нет текста. Если это скан, загрузите DOCX или PDF, сохранённый из Word.'
                    : 'Текст слишком короткий для проверки.',
            ]);
        }

        $prepared = $this->service->prepareText($rawText);
        $title = trim((string) ($validated['title'] ?? ''));

        if ($title === '') {
            $title = $file instanceof UploadedFile
                ? pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)
                : mb_substr(strtok($prepared['text'], "\n") ?: 'Документ', 0, 120);
        }

        $review = TeacherAiReview::create([
            'user_id' => $user->id,
            'document_type' => $validated['document_type'],
            'title' => mb_substr($title, 0, 255),
            'source' => $source,
            'original_name' => $file instanceof UploadedFile ? mb_substr($file->getClientOriginalName(), 0, 255) : null,
            'focus' => $validated['focus'] ?? null,
            'content_text' => $prepared['text'],
            'content_chars' => $prepared['chars'],
            'is_partial' => $prepared['truncated'],
            'status' => TeacherAiReview::STATUS_PENDING,
        ]);

        RunTeacherAiReview::dispatch($review->id);

        return Redirect::route('teacher-ai.reviews.show', $review)
            ->with('success', 'Документ отправлен на проверку.');
    }

    public function show(Request $request, TeacherAiReview $review): Response
    {
        $this->authorizeOwner($request, $review);

        return Inertia::render('TeacherAi/Show', [
            'review' => [
                'id' => $review->id,
                'title' => $review->title,
                'document_type_label' => TeacherAiReviewService::documentTypeLabel($review->document_type),
                'source' => $review->source,
                'original_name' => $review->original_name,
                'focus' => $review->focus,
                'status' => $review->isStale() ? TeacherAiReview::STATUS_FAILED : $review->status,
                'error_message' => $review->isStale()
                    ? 'Проверка не завершилась. Запустите её ещё раз.'
                    : $review->error_message,
                'can_retry' => $review->canRetry(),
                'content_chars' => $review->content_chars,
                'analyzed_chars' => mb_strlen($review->content_text),
                'is_partial' => $review->is_partial,
                'summary' => $review->summary,
                'key_points' => $review->key_points ?? [],
                'findings' => $review->findings ?? [],
                'findings_count' => $this->countBySeverity($review->findings ?? []),
                'overall' => $review->overall,
                'created_at' => $review->created_at?->format('d.m.Y H:i'),
                'completed_at' => $review->completed_at?->format('d.m.Y H:i'),
            ],
        ]);
    }

    public function retry(Request $request, TeacherAiReview $review): RedirectResponse
    {
        $this->authorizeOwner($request, $review);

        if (! $this->service->isEnabled()) {
            return Redirect::back()->with('error', 'ИИ-помощник сейчас отключён. Обратитесь к администратору.');
        }

        if (! $review->canRetry()) {
            return Redirect::back()->with('warning', 'Эта проверка уже выполняется или завершена.');
        }

        $review->update([
            'status' => TeacherAiReview::STATUS_PENDING,
            'error_message' => null,
        ]);

        RunTeacherAiReview::dispatch($review->id);

        return Redirect::route('teacher-ai.reviews.show', $review)
            ->with('success', 'Проверка запущена повторно.');
    }

    public function destroy(Request $request, TeacherAiReview $review): RedirectResponse
    {
        $this->authorizeOwner($request, $review);

        $review->delete();

        return Redirect::route('teacher-ai.reviews.index')
            ->with('success', 'Проверка удалена.');
    }

    private function authorizeTeacher(Request $request): User
    {
        $user = $request->user();

        if (! $user || ! in_array($user->resolvedRoleSlug(), self::ALLOWED_ROLES, true)) {
            abort(403, 'ИИ-помощник доступен преподавателям.');
        }

        return $user;
    }

    private function authorizeOwner(Request $request, TeacherAiReview $review): void
    {
        $user = $this->authorizeTeacher($request);

        // 404 rather than 403: do not reveal that someone else's review exists.
        if ((int) $review->user_id !== (int) $user->id) {
            abort(404);
        }
    }

    private function usedToday(User $user): int
    {
        return TeacherAiReview::query()
            ->where('user_id', $user->id)
            ->where('created_at', '>=', now()->startOfDay())
            ->count();
    }

    /**
     * @param array<int, array<string, mixed>> $findings
     * @return array<string, int>
     */
    private function countBySeverity(array $findings): array
    {
        $counts = array_fill_keys(TeacherAiReviewService::SEVERITIES, 0);

        foreach ($findings as $finding) {
            $severity = $finding['severity'] ?? null;

            if (is_string($severity) && isset($counts[$severity])) {
                $counts[$severity]++;
            }
        }

        return $counts;
    }
}
