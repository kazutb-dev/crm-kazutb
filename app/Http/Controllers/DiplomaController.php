<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Diploma;
use App\Models\EducationalProgram;
use App\Models\Faculty;
use App\Models\TopicCheck;
use App\Services\DiplomaImportService;
use App\Services\TopicSimilarityService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DiplomaController extends Controller
{
    public function __construct(
        private readonly TopicSimilarityService $similarityService,
        private readonly DiplomaImportService $importService,
    ) {
    }

    public function index(): Response
    {
        $user = auth()->user();

        $query = Diploma::query()
            ->with([
                'faculty:id,name',
                'department:id,name',
                'program:id,name',
                'student:id,name',
                'supervisor:id,name',
                'topicChecks' => fn ($q) => $q->with('items')->latest('checked_at')->limit(1),
            ]);

        if ($user?->resolvedRoleSlug() === 'student') {
            $query->where('student_id', $user?->id);
        }

        $diplomas = $query
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Diplomas/Index', [
            'diplomas' => $diplomas,
            'faculties' => Faculty::query()->orderBy('name')->get(['id', 'name']),
            'departments' => Department::query()->orderBy('name')->get(['id', 'name', 'faculty_id']),
            'programs' => EducationalProgram::query()->orderBy('name')->get(['id', 'name', 'department_id']),
            'statusOptions' => Diploma::statuses(),
            'typeOptions' => Diploma::types(),
            'userRole' => $this->normalizeRoleForUi($user?->resolvedRoleSlug() ?? 'hod'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureRole($request, ['student', 'department', 'umo']);

        $data = $request->validate([
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'semester' => ['required', Rule::in(['fall', 'spring'])],
            'faculty_id' => ['required', 'integer', 'exists:faculties,id'],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'program_id' => ['required', 'integer', 'exists:educational_programs,id'],
            'student_id' => ['nullable', 'integer', 'exists:users,id'],
            'external_student_code' => ['nullable', 'string', 'max:100'],
            'supervisor_id' => ['nullable', 'integer', 'exists:users,id'],
            'title_ru' => ['required', 'string', 'max:500'],
            'title_kz' => ['nullable', 'string', 'max:500'],
            'title_en' => ['nullable', 'string', 'max:500'],
            'abstract' => ['nullable', 'string', 'max:10000'],
            'keywords' => ['nullable', 'array'],
            'keywords.*' => ['string', 'max:100'],
            'type' => ['required', Rule::in(Diploma::types())],
            'file_path' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();
        $role = $this->normalizeRoleForUi($user?->resolvedRoleSlug() ?? 'hod');

        if (empty($data['student_id']) && empty($data['external_student_code']) && $user?->id) {
            $data['student_id'] = $user->id;
        }

        if (empty($data['student_id']) && empty($data['external_student_code'])) {
            return back()->withErrors([
                'external_student_code' => 'Укажите student_id или external_student_code.',
            ]);
        }

        if ($role === 'student') {
            $data['student_id'] = $user?->id;
        }

        $diploma = Diploma::query()->create([
            ...$data,
            'normalized_title' => $this->similarityService->normalize($data['title_ru']),
            'status' => Diploma::STATUS_DRAFT,
            'is_reference' => false,
        ]);

        return redirect()->route('diplomas.index')->with('success', "Заявка #{$diploma->id} создана.");
    }

    public function submit(Request $request, Diploma $diploma): RedirectResponse
    {
        $this->ensureRole($request, ['student', 'department', 'umo']);

        if ($diploma->status !== Diploma::STATUS_DRAFT && $diploma->status !== Diploma::STATUS_REJECTED) {
            return back()->with('error', 'Отправить можно только Draft или Rejected.');
        }

        $diploma->update([
            'status' => Diploma::STATUS_SUBMITTED,
            'normalized_title' => $this->similarityService->normalize($diploma->title_ru),
        ]);

        $this->storeTopicCheckSnapshot($diploma, $request->user()?->id);

        return redirect()->route('diplomas.index')->with('success', 'Заявка отправлена на проверку.');
    }

    public function markInReview(Request $request, Diploma $diploma): RedirectResponse
    {
        $this->ensureRole($request, ['department', 'umo']);

        if ($diploma->status !== Diploma::STATUS_SUBMITTED) {
            return back()->with('error', 'В In review можно перевести только Submitted.');
        }

        $diploma->update([
            'status' => Diploma::STATUS_IN_REVIEW,
            'normalized_title' => $this->similarityService->normalize($diploma->title_ru),
        ]);

        $this->storeTopicCheckSnapshot($diploma, $request->user()?->id);

        return redirect()->route('diplomas.index')->with('success', 'Заявка переведена в In review.');
    }

    public function approve(Request $request, Diploma $diploma): RedirectResponse
    {
        $this->ensureRole($request, ['department', 'umo']);

        if (!in_array($diploma->status, [Diploma::STATUS_IN_REVIEW, Diploma::STATUS_SUBMITTED], true)) {
            return back()->with('error', 'Одобрить можно только Submitted/In review.');
        }

        $diploma->update([
            'status' => Diploma::STATUS_APPROVED,
            'is_reference' => true,
            'normalized_title' => $this->similarityService->normalize($diploma->title_ru),
        ]);

        return redirect()->route('diplomas.index')->with('success', 'Диплом одобрен и добавлен в реестр эталонов.');
    }

    public function reject(Request $request, Diploma $diploma): RedirectResponse
    {
        $this->ensureRole($request, ['department', 'umo']);

        if (!in_array($diploma->status, [Diploma::STATUS_SUBMITTED, Diploma::STATUS_IN_REVIEW], true)) {
            return back()->with('error', 'Отклонить можно только Submitted/In review.');
        }

        $diploma->update(['status' => Diploma::STATUS_REJECTED]);

        return redirect()->route('diplomas.index')->with('success', 'Заявка отклонена.');
    }

    public function runCheck(Request $request, Diploma $diploma): RedirectResponse
    {
        $this->ensureRole($request, ['department', 'umo']);

        if (in_array($diploma->status, [Diploma::STATUS_APPROVED, Diploma::STATUS_ARCHIVED], true)) {
            return back()->with('error', 'Одобренные и архивные работы не проверяются повторно.');
        }

        $this->storeTopicCheckSnapshot($diploma, $request->user()?->id);

        return redirect()->route('diplomas.index')->with('success', 'Проверка темы выполнена.');
    }

    public function import(Request $request): RedirectResponse
    {
        $this->ensureRole($request, ['department', 'umo']);

        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $result = $this->importService->importFromCsv($data['file']);

        if ($result['errors'] !== []) {
            return redirect()->route('diplomas.index')
                ->with('warning', 'Импорт завершен с ошибками: ' . implode(' | ', array_slice($result['errors'], 0, 5)))
                ->with('success', "Импортировано: {$result['imported']}");
        }

        return redirect()->route('diplomas.index')->with('success', "Импортировано записей: {$result['imported']}");
    }

    private function storeTopicCheckSnapshot(Diploma $diploma, ?int $checkedBy): TopicCheck
    {
        $result = $this->similarityService->findTopMatches($diploma->title_ru, $diploma->id, 10);

        $check = $diploma->topicChecks()->create([
            'checked_by' => $checkedBy,
            'checked_at' => now(),
            'input_title' => $diploma->title_ru,
            'normalized_title' => $result['normalized'],
        ]);

        foreach ($result['items'] as $item) {
            $check->items()->create([
                'matched_diploma_id' => $item['diploma_id'] ?? null,
                'original_title_ru' => $item['original_title_ru'],
                'score' => $item['score'],
                'match_type' => $item['match_type'],
                'risk_level' => $item['risk_level'],
            ]);
        }

        return $check;
    }

    /**
     * @param list<string> $allowedRoles
     */
    private function ensureRole(Request $request, array $allowedRoles): void
    {
        $role = $this->normalizeRoleForUi($request->user()?->resolvedRoleSlug() ?? null);

        abort_unless(is_string($role) && in_array($role, $allowedRoles, true), 403);
    }

    private function normalizeRoleForUi(?string $role): string
    {
        $normalized = strtolower(trim((string) $role));

        return match ($normalized) {
            'admin' => 'umo',
            'hod' => 'department',
            default => $normalized,
        };
    }
}
