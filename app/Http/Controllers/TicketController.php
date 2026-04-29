<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TicketController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('Tickets/Index', [
            'flash' => [
                'success' => $request->session()->get('success'),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'max:50'],
            'building' => ['required', 'string', 'max:120'],
            'room' => ['nullable', 'string', 'max:30'],
            'contact' => ['required', 'string', 'max:120'],
            'description' => ['required', 'string', 'max:4000'],
        ]);

        Ticket::query()->create([
            ...$data,
            'status' => 'new',
            'submitted_by' => $request->user('sanctum')?->id ?? $request->user()?->id,
        ]);

        return redirect()
            ->route('tickets.index')
            ->with('success', 'Заявка успешно отправлена.');
    }

    public function adminIndex(Request $request): Response
    {
        $user = $request->user();
        $role = $user?->resolvedRoleSlug();
        $isAdmin = in_array($role, ['admin', 'superadmin'], true);
        $userDepartment = trim((string) ($user?->ad_department ?? ''));

        $department = trim((string) $request->query('department', ''));

        $ticketsQuery = Ticket::query()
            ->with([
                'submittedBy:id,name,email,ad_department,first_name,last_name,display_name',
                'acceptedBy:id,name,email,first_name,last_name,display_name',
            ])
            ->latest('id')
            ->when($department !== '', function ($query) use ($department): void {
                $query->whereHas('submittedBy', function ($userQuery) use ($department): void {
                    $userQuery->where('ad_department', $department);
                });
            });

        if (! $isAdmin) {
            // Non-admin users can view only tickets from their own department.
            $ticketsQuery->whereHas('submittedBy', function ($userQuery) use ($userDepartment): void {
                $userQuery->where('ad_department', $userDepartment);
            });
        }

        $tickets = $ticketsQuery
            ->paginate(15)
            ->withQueryString();

        $departments = collect();

        if ($isAdmin) {
            $departments = User::query()
                ->whereNotNull('ad_department')
                ->where('ad_department', '!=', '')
                ->orderBy('ad_department')
                ->distinct()
                ->pluck('ad_department')
                ->values();
        }

        return Inertia::render('Tickets/AdminIndex', [
            'tickets' => $tickets,
            'departments' => $departments,
            'canFilterByDepartment' => $isAdmin,
            'filters' => [
                'department' => $isAdmin ? $department : $userDepartment,
            ],
        ]);
    }

    public function updateStatus(Request $request, Ticket $ticket): JsonResponse
    {
        $role = $request->user()?->resolvedRoleSlug();
        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403);

        $data = $request->validate([
            'status' => ['required', 'in:new,in_progress,closed'],
        ]);

        $updateData = ['status' => $data['status']];

        if (in_array($data['status'], ['in_progress', 'closed'], true) && $ticket->accepted_by === null) {
            $updateData['accepted_by'] = $request->user()?->id;
            $updateData['accepted_at'] = now();
        }

        $ticket->update($updateData);

        return response()->json([
            'message' => 'Статус обновлён.',
            'status'  => $ticket->status,
            'accepted_by' => $ticket->acceptedBy?->display_name ?? $ticket->acceptedBy?->name,
        ]);
    }
}
