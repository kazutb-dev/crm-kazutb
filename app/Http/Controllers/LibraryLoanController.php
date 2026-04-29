<?php

namespace App\Http\Controllers;

use App\Models\LibraryLoan;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use Inertia\Response;

class LibraryLoanController extends Controller
{
    public function index(Request $request): Response
    {
        $recentLoans = LibraryLoan::query()
            ->with([
                'user:id,name,display_name,email,ad_login,ad_department',
                'issuer:id,name,display_name',
            ])
            ->latest('id')
            ->limit(12)
            ->get()
            ->map(fn (LibraryLoan $loan): array => [
                'id' => $loan->id,
                'book_title' => $loan->book_title,
                'book_author' => $loan->book_author,
                'book_isbn' => $loan->book_isbn,
                'issued_at' => optional($loan->issued_at)?->format('Y-m-d'),
                'due_at' => optional($loan->due_at)?->format('Y-m-d'),
                'notes' => $loan->notes,
                'user' => [
                    'id' => $loan->user?->id,
                    'name' => $loan->user?->display_name ?? $loan->user?->name,
                    'email' => $loan->user?->email,
                    'ad_login' => $loan->user?->ad_login,
                    'department' => $loan->user?->ad_department,
                ],
                'issuer' => $loan->issuer?->display_name ?? $loan->issuer?->name,
            ])
            ->values();

        return Inertia::render('Library/IssueBook', [
            'recentLoans' => $recentLoans,
            'flash' => [
                'success' => $request->session()->get('success'),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'book_id' => ['required', 'string', 'max:100'],
            'book_legacy_doc_id' => ['nullable', 'integer'],
            'book_title' => ['required', 'string', 'max:500'],
            'book_author' => ['nullable', 'string', 'max:255'],
            'book_isbn' => ['nullable', 'string', 'max:64'],
            'user_id' => ['required', 'exists:users,id'],
            'issued_at' => ['required', 'date'],
            'due_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $availableCopies = $this->resolveAvailableCopies(
            (string) $data['book_id'],
            (string) $data['book_title'],
        );

        if ($availableCopies !== null && $availableCopies < 1) {
            return back()
                ->withErrors([
                    'book_id' => 'Эта книга сейчас недоступна для выдачи.',
                ])
                ->withInput();
        }

        LibraryLoan::query()->create([
            ...$data,
            'issued_by' => $request->user()?->id,
        ]);

        return redirect()
            ->route('library.issue-book')
            ->with('success', 'Выдача книги успешно оформлена.');
    }

    public function searchUsers(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        $perPage = min((int) $request->query('per_page', 10), 20);

        if ($query === '') {
            return response()->json(['data' => []]);
        }

        $users = User::query()
            ->where(function ($nested) use ($query): void {
                $nested
                    ->where('name', 'like', "%{$query}%")
                    ->orWhere('display_name', 'like', "%{$query}%")
                    ->orWhere('first_name', 'like', "%{$query}%")
                    ->orWhere('last_name', 'like', "%{$query}%")
                    ->orWhere('email', 'like', "%{$query}%")
                    ->orWhere('ad_login', 'like', "%{$query}%")
                    ->orWhere('ad_department', 'like', "%{$query}%");
            })
            ->orderBy('name')
            ->limit($perPage)
            ->get(['id', 'name', 'display_name', 'email', 'ad_login', 'ad_department']);

        return response()->json([
            'data' => $users->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->display_name ?? $user->name,
                'email' => $user->email,
                'ad_login' => $user->ad_login,
                'department' => $user->ad_department,
            ])->values(),
        ]);
    }

    private function resolveAvailableCopies(string $bookId, string $bookTitle): ?int
    {
        $endpoint = (string) config('services.library_catalog.endpoint', 'http://10.0.1.8:5173/api/v1/catalog');
        $timeout = (int) config('services.library_catalog.timeout', 15);

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->get($endpoint, [
                    'q' => $bookTitle,
                    'page' => 1,
                    'limit' => 20,
                ]);

            if (! $response->ok()) {
                return null;
            }

            $items = collect($response->json('data', []));
            $book = $items->first(fn (array $item): bool => (string) ($item['id'] ?? '') === $bookId);

            if (! is_array($book)) {
                return null;
            }

            $remoteAvailable = (int) data_get($book, 'copies.available', 0);
            $loaned = LibraryLoan::query()
                ->where('book_id', $bookId)
                ->count();

            return max(0, $remoteAvailable - $loaned);
        } catch (\Throwable) {
            return null;
        }
    }
}