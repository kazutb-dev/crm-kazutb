<?php

namespace App\Http\Controllers;

use App\Models\LibraryReservation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LibraryReservationAdminController extends Controller
{
    public function index(Request $request): Response
    {
        $this->ensureAdmin($request);

        return Inertia::render('Library/ReservationsAdmin');
    }

    public function data(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $perPage = min(max((int) $request->integer('per_page', 20), 1), 100);
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

        return response()->json([
            'message' => $message,
            'data' => $this->serializeReservation($reservation->fresh([
                'user:id,name,display_name,email,ad_login',
                'reviewer:id,name,display_name,email',
            ])),
        ]);
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
