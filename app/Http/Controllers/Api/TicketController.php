<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TicketController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'max:50'],
            'building' => ['required', 'string', 'max:120'],
            'room' => ['nullable', 'string', 'max:30'],
            'contact' => ['required', 'string', 'max:120'],
            'description' => ['required', 'string', 'max:4000'],
        ]);

        $ticket = Ticket::query()->create([
            ...$data,
            'status' => 'new',
            'submitted_by' => $request->user('sanctum')?->id ?? $request->user()?->id,
        ]);

        $ticket->loadMissing([
            'submittedBy:id,name,email,ad_department,first_name,last_name,display_name',
            'acceptedBy:id,name,email,first_name,last_name,display_name',
        ]);

        return response()->json([
            'message' => 'Заявка успешно отправлена.',
            'data' => $this->serializeTicket($ticket),
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);
        $status = trim((string) $request->query('status', ''));
        $department = trim((string) $request->query('department', ''));

        $query = Ticket::query()
            ->with([
                'submittedBy:id,name,email,ad_department,first_name,last_name,display_name',
                'acceptedBy:id,name,email,first_name,last_name,display_name',
            ])
            ->latest('id');

        if ($status !== '') {
            $query->where('status', $status);
        }

        if ($department !== '') {
            $query->whereHas('submittedBy', function ($userQuery) use ($department): void {
                $userQuery->where('ad_department', $department);
            });
        }

        $tickets = $query->paginate($perPage)->appends($request->query());

        $tickets->setCollection(
            $tickets->getCollection()->map(
                fn (Ticket $ticket): array => $this->serializeTicket($ticket)
            )
        );

        return response()->json($tickets);
    }

    public function show(Request $request, Ticket $ticket): JsonResponse
    {
        $this->ensureAdmin($request);

        $ticket->loadMissing([
            'submittedBy:id,name,email,ad_department,first_name,last_name,display_name',
            'acceptedBy:id,name,email,first_name,last_name,display_name',
        ]);

        return response()->json([
            'data' => $this->serializeTicket($ticket),
        ]);
    }

    public function update(Request $request, Ticket $ticket): JsonResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'status' => ['required', 'in:new,in_progress,closed'],
        ]);

        $updateData = [
            'status' => $data['status'],
        ];

        if (in_array($data['status'], ['in_progress', 'closed'], true) && $ticket->accepted_by === null) {
            $updateData['accepted_by'] = $request->user()?->id;
            $updateData['accepted_at'] = now();
        }

        $ticket->update($updateData);

        $ticket->loadMissing([
            'submittedBy:id,name,email,ad_department,first_name,last_name,display_name',
            'acceptedBy:id,name,email,first_name,last_name,display_name',
        ]);

        return response()->json([
            'message' => 'Статус заявки обновлен.',
            'data' => $this->serializeTicket($ticket->fresh([
                'submittedBy:id,name,email,ad_department,first_name,last_name,display_name',
                'acceptedBy:id,name,email,first_name,last_name,display_name',
            ])),
        ]);
    }

    public function accept(Request $request, Ticket $ticket): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401, 'Не авторизован.');

        if ($ticket->status === 'closed') {
            return response()->json([
                'message' => 'Заявка уже закрыта.',
            ], 422);
        }

        if ($ticket->accepted_by !== null && (int) $ticket->accepted_by !== (int) $user->id) {
            return response()->json([
                'message' => 'Заявка уже принята другим пользователем.',
            ], 409);
        }

        $ticket->update([
            'accepted_by' => $user->id,
            'accepted_at' => $ticket->accepted_at ?? now(),
            'status' => 'in_progress',
        ]);

        $ticket->loadMissing([
            'submittedBy:id,name,email,ad_department,first_name,last_name,display_name',
            'acceptedBy:id,name,email,first_name,last_name,display_name',
        ]);

        return response()->json([
            'message' => 'Заявка принята.',
            'data' => $this->serializeTicket($ticket),
        ]);
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();
        $role = $user?->resolvedRoleSlug();

        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403, 'Недостаточно прав.');
    }

    private function serializeTicket(Ticket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'type' => $ticket->type,
            'building' => $ticket->building,
            'room' => $ticket->room,
            'contact' => $ticket->contact,
            'description' => $ticket->description,
            'status' => $ticket->status,
            'accepted_at' => optional($ticket->accepted_at)?->toIso8601String(),
            'created_at' => optional($ticket->created_at)?->toIso8601String(),
            'updated_at' => optional($ticket->updated_at)?->toIso8601String(),
            'submitted_by' => [
                'id' => $ticket->submittedBy?->id,
                'name' => $ticket->submittedBy?->name,
                'full_name' => trim((string) ($ticket->submittedBy?->display_name ?? '')) !== ''
                    ? $ticket->submittedBy?->display_name
                    : trim(implode(' ', array_filter([
                        $ticket->submittedBy?->last_name,
                        $ticket->submittedBy?->first_name,
                    ]))),
                'email' => $ticket->submittedBy?->email,
                'department' => $ticket->submittedBy?->ad_department,
            ],
            'accepted_by' => [
                'id' => $ticket->acceptedBy?->id,
                'name' => $ticket->acceptedBy?->name,
                'full_name' => trim((string) ($ticket->acceptedBy?->display_name ?? '')) !== ''
                    ? $ticket->acceptedBy?->display_name
                    : trim(implode(' ', array_filter([
                        $ticket->acceptedBy?->last_name,
                        $ticket->acceptedBy?->first_name,
                    ]))),
                'email' => $ticket->acceptedBy?->email,
            ],
        ];
    }
}
