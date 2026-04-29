<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LibraryReservation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LibraryReservationController extends Controller
{
    private const ALLOWED_STUDENT_SOURCE_IP = '10.0.1.8';

    public function store(Request $request): JsonResponse
    {
        $this->ensureAllowedStudentSourceIp($request);

        $data = $request->validate([
            'book_id' => ['required', 'string', 'max:100'],
            'book_title' => ['required', 'string', 'max:500'],
            'book_author' => ['nullable', 'string', 'max:255'],
            'book_isbn' => ['nullable', 'string', 'max:64'],
            'student_identifier' => ['required', 'string', 'max:120'],
            'student_name' => ['nullable', 'string', 'max:255'],
            'student_email' => ['nullable', 'email', 'max:255'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $userId = $data['user_id'] ?? null;

        if ($userId === null && !empty($data['student_email'])) {
            $userId = User::query()
                ->where('email', $data['student_email'])
                ->value('id');
        }

        $reservation = LibraryReservation::query()->create([
            ...$data,
            'user_id' => $userId,
            'source_ip' => (string) $request->ip(),
            'status' => 'pending',
            'requested_at' => now(),
        ]);

        $reservation->loadMissing([
            'user:id,name,display_name,email,ad_login',
            'reviewer:id,name,display_name,email',
        ]);

        return response()->json([
            'message' => 'Бронирование отправлено на подтверждение.',
            'data' => $this->serializeReservation($reservation),
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);
        $status = trim((string) $request->query('status', ''));
        $queryText = trim((string) $request->query('q', ''));

        $query = LibraryReservation::query()
            ->with([
                'user:id,name,display_name,email,ad_login',
                'reviewer:id,name,display_name,email',
            ])
            ->latest('id');

        if ($status !== '') {
            $query->where('status', $status);
        }

        if ($queryText !== '') {
            $query->where(function ($nested) use ($queryText): void {
                $nested
                    ->where('book_title', 'like', "%{$queryText}%")
                    ->orWhere('book_author', 'like', "%{$queryText}%")
                    ->orWhere('book_isbn', 'like', "%{$queryText}%")
                    ->orWhere('student_identifier', 'like', "%{$queryText}%")
                    ->orWhere('student_name', 'like', "%{$queryText}%")
                    ->orWhere('student_email', 'like', "%{$queryText}%");
            });
        }

        $reservations = $query->paginate($perPage)->appends($request->query());

        $reservations->setCollection(
            $reservations->getCollection()->map(
                fn (LibraryReservation $reservation): array => $this->serializeReservation($reservation)
            )
        );

        return response()->json($reservations);
    }

    public function show(Request $request, LibraryReservation $reservation): JsonResponse
    {
        $this->ensureAdmin($request);

        $reservation->loadMissing([
            'user:id,name,display_name,email,ad_login',
            'reviewer:id,name,display_name,email',
        ]);

        return response()->json([
            'data' => $this->serializeReservation($reservation),
        ]);
    }

    public function approve(Request $request, LibraryReservation $reservation): JsonResponse
    {
        return $this->changeStatus($request, $reservation, 'approved', 'Бронирование подтверждено.');
    }

    public function reject(Request $request, LibraryReservation $reservation): JsonResponse
    {
        return $this->changeStatus($request, $reservation, 'rejected', 'Бронирование отклонено.');
    }

    private function changeStatus(
        Request $request,
        LibraryReservation $reservation,
        string $status,
        string $message
    ): JsonResponse {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'review_note' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($reservation->status !== 'pending') {
            return response()->json([
                'message' => 'Эта бронь уже обработана.',
                'data' => $this->serializeReservation($reservation),
            ], 422);
        }

        $reservation->update([
            'status' => $status,
            'review_note' => $data['review_note'] ?? null,
            'reviewed_by' => $request->user()?->id,
            'reviewed_at' => now(),
        ]);

        $reservation->loadMissing([
            'user:id,name,display_name,email,ad_login',
            'reviewer:id,name,display_name,email',
        ]);

        return response()->json([
            'message' => $message,
            'data' => $this->serializeReservation($reservation->fresh([
                'user:id,name,display_name,email,ad_login',
                'reviewer:id,name,display_name,email',
            ])),
        ]);
    }

    private function ensureAllowedStudentSourceIp(Request $request): void
    {
        $ip = (string) $request->ip();

        abort_unless($ip === self::ALLOWED_STUDENT_SOURCE_IP, 403, 'Источник запроса не разрешен.');
    }

    private function ensureAdmin(Request $request): void
    {
        $role = $request->user()?->resolvedRoleSlug();

        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403, 'Недостаточно прав.');
    }

    private function serializeReservation(LibraryReservation $reservation): array
    {
        return [
            'id' => $reservation->id,
            'book_id' => $reservation->book_id,
            'book_title' => $reservation->book_title,
            'book_author' => $reservation->book_author,
            'book_isbn' => $reservation->book_isbn,
            'status' => $reservation->status,
            'student_identifier' => $reservation->student_identifier,
            'student_name' => $reservation->student_name,
            'student_email' => $reservation->student_email,
            'source_ip' => $reservation->source_ip,
            'review_note' => $reservation->review_note,
            'requested_at' => optional($reservation->requested_at)?->toIso8601String(),
            'reviewed_at' => optional($reservation->reviewed_at)?->toIso8601String(),
            'created_at' => optional($reservation->created_at)?->toIso8601String(),
            'updated_at' => optional($reservation->updated_at)?->toIso8601String(),
            'user' => [
                'id' => $reservation->user?->id,
                'name' => $reservation->user?->display_name ?? $reservation->user?->name,
                'email' => $reservation->user?->email,
                'ad_login' => $reservation->user?->ad_login,
            ],
            'reviewer' => [
                'id' => $reservation->reviewer?->id,
                'name' => $reservation->reviewer?->display_name ?? $reservation->reviewer?->name,
                'email' => $reservation->reviewer?->email,
            ],
        ];
    }
}
