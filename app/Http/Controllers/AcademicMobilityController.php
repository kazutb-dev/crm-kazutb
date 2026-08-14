<?php

namespace App\Http\Controllers;

use App\Models\AcademicMobilityApplication;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class AcademicMobilityController extends Controller
{
    private const DOCUMENT_OPTIONS = [
        'Заявление',
        'Транскрипт',
        'Индивидуальный учебный план',
        'Анкета',
        'Приказ',
        'Трёхсторонний договор',
    ];

    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        if (! $user) {
            abort(403);
        }

        $role = $user->resolvedRoleSlug();

        if ($role === 'student') {
            $latestApplication = AcademicMobilityApplication::query()
                ->where('user_id', $user->id)
                ->latest('id')
                ->first();

            if ($latestApplication) {
                return Redirect::route('academic-mobility.student.status');
            }

            return Inertia::render('AcademicMobility/StudentPage', [
                'documents' => self::DOCUMENT_OPTIONS,
                'user' => [
                    'name' => $user->name,
                    'email' => $user->email,
                ],
            ]);
        }

        if ($role === 'academic_mobility') {
            return $this->staffIndex($request);
        }

        return Redirect::route('dashboard');
    }

    public function showResubmissionForm(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        if (! $user || $user->resolvedRoleSlug() !== 'student') {
            return Redirect::route('dashboard');
        }

        $latestApplication = AcademicMobilityApplication::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->first();

        if (! $latestApplication || $latestApplication->status !== 'rejected') {
            return Redirect::route('academic-mobility.student.status');
        }

        return Inertia::render('AcademicMobility/StudentPage', [
            'documents' => self::DOCUMENT_OPTIONS,
            'user' => [
                'name' => $user->name,
                'email' => $user->email,
            ],
            'resubmission' => [
                'enabled' => true,
                'previous_review_notes' => $latestApplication->review_notes,
            ],
        ]);
    }

    public function studentStatus(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        if (! $user || $user->resolvedRoleSlug() !== 'student') {
            return Redirect::route('dashboard');
        }

        $application = AcademicMobilityApplication::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->first();

        if (! $application) {
            return Redirect::route('academic-mobility.index');
        }

        return Inertia::render('AcademicMobility/StudentStatusPage', [
            'application' => [
                'id' => $application->id,
                'status' => $application->status,
                'phone' => $application->phone,
                'student_group' => $application->student_group,
                'document_types' => $application->document_types ?? [],
                'document_files' => $this->mapDocumentFilesForView($application),
                'notes' => $application->notes,
                'review_notes' => $application->review_notes,
                'reviewed_at' => $application->reviewed_at?->format('d.m.Y H:i'),
                'created_at' => $application->created_at?->format('d.m.Y H:i'),
            ],
            'user' => [
                'name' => $user->name,
                'email' => $user->email,
            ],
            'can_resubmit' => $application->status === 'rejected',
        ]);
    }

    public function viewDocument(Request $request, AcademicMobilityApplication $application, int $documentIndex): StreamedResponse
    {
        $user = $request->user();

        if (! $user) {
            abort(403);
        }

        $role = $user->resolvedRoleSlug();
        $canView = $role === 'academic_mobility' || ($role === 'student' && (int) $application->user_id === (int) $user->id);

        if (! $canView) {
            abort(403);
        }

        $files = $application->document_files ?? [];
        $file = $files[$documentIndex] ?? null;

        if (! is_array($file) || empty($file['path'])) {
            abort(404);
        }

        $path = (string) $file['path'];

        if (! Storage::disk('public')->exists($path)) {
            abort(404);
        }

        $originalName = (string) ($file['original_name'] ?? basename($path));
        $mimeType = (string) ($file['mime_type'] ?? Storage::disk('public')->mimeType($path) ?? 'application/octet-stream');

        return Storage::disk('public')->response($path, $originalName, [
            'Content-Type' => $mimeType,
            'Content-Disposition' => sprintf('inline; filename="%s"', addslashes($originalName)),
        ]);
    }

    public function storeStudentApplication(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user) {
            abort(403);
        }

        $latestApplication = AcademicMobilityApplication::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->first();

        if ($latestApplication && $latestApplication->status !== 'rejected') {
            return Redirect::route('academic-mobility.student.status')
                ->with('warning', 'Заявка уже подана. Повторная подача недоступна.');
        }

        $validated = $request->validate([
            'phone' => ['required', 'string', 'max:40'],
            'student_group' => ['required', 'string', 'max:120'],
            'document_types' => ['required', 'array', 'min:1'],
            'document_types.*' => ['string', 'in:' . implode(',', self::DOCUMENT_OPTIONS)],
            'document_files' => ['required', 'array', 'min:1'],
            'document_files.*' => ['file', 'mimes:pdf,jpg,jpeg,png,doc,docx,txt', 'max:10240'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $documentTypes = array_values(array_unique($validated['document_types']));
        $documentFiles = $request->file('document_files', []);

        if (count($documentTypes) !== count($documentFiles)) {
            return Redirect::back()->withErrors([
                'document_files' => 'Количество файлов не соответствует количеству выбранных документов.',
            ]);
        }

        $storedDocuments = [];

        foreach ($documentTypes as $index => $documentType) {
            $uploadedFile = $documentFiles[$index] ?? null;

            if (! $uploadedFile instanceof UploadedFile || ! $uploadedFile->isValid()) {
                continue;
            }

            $relativePath = $uploadedFile->storeAs(
                'academic-mobility/' . $user->id,
                $this->buildDocumentFileName($documentType, $uploadedFile),
                'public'
            );

            $storedDocuments[] = [
                'document_type' => $documentType,
                'original_name' => $uploadedFile->getClientOriginalName(),
                'stored_name' => basename($relativePath),
                'path' => $relativePath,
                'url' => Storage::url($relativePath),
                'mime_type' => $uploadedFile->getMimeType(),
                'extension' => $uploadedFile->getClientOriginalExtension(),
            ];
        }

        if ($storedDocuments === []) {
            return Redirect::back()->withErrors([
                'document_files' => 'Нужно прикрепить хотя бы один документ.',
            ]);
        }

        AcademicMobilityApplication::create([
            'user_id' => $user->id,
            'full_name' => (string) ($user->name ?? $user->display_name ?? $user->email),
            'phone' => $validated['phone'],
            'student_group' => $validated['student_group'],
            'document_types' => $documentTypes,
            'document_files' => $storedDocuments,
            'status' => 'pending',
            'notes' => $validated['notes'] ?? null,
        ]);

        return Redirect::route('academic-mobility.student.status')
            ->with('success', 'Заявка успешно отправлена.');
    }

    public function staffIndex(Request $request): Response
    {
        $user = $request->user();

        if (! $user || $user->resolvedRoleSlug() !== 'academic_mobility') {
            abort(403);
        }

        $applications = AcademicMobilityApplication::query()
            ->with('user')
            ->orderByDesc('created_at')
            ->get();

        return Inertia::render('AcademicMobility/StaffPage', [
            'applications' => $applications->map(function (AcademicMobilityApplication $application): array {
                return [
                    'id' => $application->id,
                    'full_name' => $application->full_name,
                    'phone' => $application->phone,
                    'student_group' => $application->student_group,
                    'document_types' => $application->document_types ?? [],
                    'document_files' => $this->mapDocumentFilesForView($application),
                    'status' => $application->status,
                    'notes' => $application->notes,
                    'review_notes' => $application->review_notes,
                    'reviewed_at' => $application->reviewed_at?->format('d.m.Y H:i'),
                    'reviewed_by' => $application->reviewed_by,
                    'created_at' => $application->created_at?->format('d.m.Y H:i'),
                    'user' => [
                        'name' => $application->user?->name,
                        'email' => $application->user?->email,
                    ],
                ];
            }),
            'documents' => self::DOCUMENT_OPTIONS,
        ]);
    }

    public function accept(Request $request, AcademicMobilityApplication $application): RedirectResponse
    {
        $user = $request->user();

        if (! $user || $user->resolvedRoleSlug() !== 'academic_mobility') {
            abort(403);
        }

        $validated = $request->validate([
            'review_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $application->update([
            'status' => 'accepted',
            'review_notes' => $validated['review_notes'] ?? null,
            'reviewed_at' => now(),
            'reviewed_by' => $user->id,
        ]);

        return Redirect::back()->with('success', 'Заявка принята.');
    }

    public function reject(Request $request, AcademicMobilityApplication $application): RedirectResponse
    {
        $user = $request->user();

        if (! $user || $user->resolvedRoleSlug() !== 'academic_mobility') {
            abort(403);
        }

        $validated = $request->validate([
            'review_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $application->update([
            'status' => 'rejected',
            'review_notes' => $validated['review_notes'] ?? null,
            'reviewed_at' => now(),
            'reviewed_by' => $user->id,
        ]);

        return Redirect::back()->with('success', 'Заявка отклонена.');
    }

    private function buildDocumentFileName(string $documentType, UploadedFile $file): string
    {
        $safeName = Str::slug($documentType, '_');
        $extension = $file->getClientOriginalExtension();

        return sprintf('%s_%s.%s', $safeName, now()->format('Ymd_His'), $extension ?: 'bin');
    }

    private function mapDocumentFilesForView(AcademicMobilityApplication $application): array
    {
        $files = $application->document_files ?? [];

        return collect($files)
            ->values()
            ->map(function ($file, int $index) use ($application): array {
                $payload = is_array($file) ? $file : [];
                $payload['view_url'] = route('academic-mobility.documents.view', [
                    'application' => $application->id,
                    'documentIndex' => $index,
                ]);

                return $payload;
            })
            ->all();
    }
}
