<?php

namespace App\Http\Controllers;

use App\Models\KpiAccessGrant;
use App\Models\Position;
use App\Models\PositionChangeRequest;
use App\Services\BusinessActivityLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PositionChangeRequestController extends Controller
{
    /**
     * Teacher: submit a new position change request.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        // One active pending request at a time
        $alreadyPending = PositionChangeRequest::query()
            ->where('user_id', $user->id)
            ->where('status', 'pending')
            ->exists();

        if ($alreadyPending) {
            return back()->withErrors(['requested_position_id' => 'У вас уже есть активная заявка на рассмотрении.']);
        }

        $data = $request->validate([
            'requested_position_id' => ['required', 'integer', 'exists:positions,id'],
        ]);

        PositionChangeRequest::create([
            'user_id'               => $user->id,
            'current_position'      => $user->position_title ?: $user->ad_title,
            'requested_position_id' => $data['requested_position_id'],
            'status'                => 'pending',
        ]);

        app(BusinessActivityLogger::class)->log(
            'position_request_created',
            'Создана заявка на смену должности',
            null,
            [
                'requested_position_id' => $data['requested_position_id'],
            ],
            $user,
            $request,
        );

        return back()->with('success', 'Заявка отправлена на рассмотрение.');
    }

    /**
     * Admin: view all requests.
     */
    public function adminIndex(Request $request): Response
    {
        abort_unless($this->isAdmin($request), 403);

        $status = $request->query('status', 'pending');

        $query = PositionChangeRequest::query()
            ->with([
                'user:id,name,display_name,email,ad_department',
                'requestedPosition:id,name',
                'reviewer:id,name,display_name',
            ])
            ->latest();

        if (in_array($status, ['pending', 'approved', 'rejected'], true)) {
            $query->where('status', $status);
        }

        $requests = $query->paginate(20)->withQueryString();

        $requests->getCollection()->transform(fn (PositionChangeRequest $r) => [
            'id'                  => $r->id,
            'user'                => [
                'id'         => $r->user?->id,
                'name'       => $r->user?->display_name ?? $r->user?->name,
                'email'      => $r->user?->email,
                'department' => $r->user?->ad_department,
            ],
            'current_position'    => $r->current_position,
            'requested_position'  => $r->requestedPosition?->name,
            'requested_position_id' => $r->requested_position_id,
            'status'              => $r->status,
            'admin_note'          => $r->admin_note,
            'reviewer'            => $r->reviewer?->display_name ?? $r->reviewer?->name,
            'reviewed_at'         => $r->reviewed_at?->toDateTimeString(),
            'created_at'          => $r->created_at?->toDateTimeString(),
        ]);

        $counts = PositionChangeRequest::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return Inertia::render('PositionRequests/AdminIndex', [
            'requests' => $requests,
            'counts'   => [
                'pending'  => (int) ($counts['pending'] ?? 0),
                'approved' => (int) ($counts['approved'] ?? 0),
                'rejected' => (int) ($counts['rejected'] ?? 0),
            ],
            'filters'  => ['status' => $status],
        ]);
    }

    /**
     * Admin: approve a request.
     */
    public function approve(Request $request, PositionChangeRequest $positionRequest): RedirectResponse
    {
        abort_unless($this->isAdmin($request), 403);

        if (! $positionRequest->isPending()) {
            return back()->withErrors(['error' => 'Заявка уже обработана.']);
        }

        $data = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $position = Position::findOrFail($positionRequest->requested_position_id);

        // Apply the new position to the user
        $positionRequest->user()->update([
            'position_id'        => $position->id,
            'position_title'     => $position->name,
            'position_confirmed' => false, // confirmed via request, not LDAP
        ]);

        $positionRequest->update([
            'status'      => 'approved',
            'admin_note'  => $data['admin_note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        app(BusinessActivityLogger::class)->log(
            'position_request_approved',
            'Заявка на смену должности одобрена',
            $positionRequest,
            [
                'approved_position_id' => $position->id,
                'admin_note' => $data['admin_note'] ?? null,
            ],
            $request->user(),
            $request,
        );

        return back()->with('success', 'Заявка одобрена, должность обновлена.');
    }

    /**
     * Admin: reject a request.
     */
    public function reject(Request $request, PositionChangeRequest $positionRequest): RedirectResponse
    {
        abort_unless($this->isAdmin($request), 403);

        if (! $positionRequest->isPending()) {
            return back()->withErrors(['error' => 'Заявка уже обработана.']);
        }

        $data = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $positionRequest->update([
            'status'      => 'rejected',
            'admin_note'  => $data['admin_note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        app(BusinessActivityLogger::class)->log(
            'position_request_rejected',
            'Заявка на смену должности отклонена',
            $positionRequest,
            [
                'admin_note' => $data['admin_note'] ?? null,
            ],
            $request->user(),
            $request,
        );

        return back()->with('success', 'Заявка отклонена.');
    }

    private function isAdmin(Request $request): bool
    {
        $user = $request->user();
        $role = $user?->resolvedRoleSlug();

        if ($user && KpiAccessGrant::userHasKpiAdmin((int) $user->id)) {
            return true;
        }

        // Доступ: kpi-админ, структурное подразделение, декан, завкафедрой
        return in_array($role, ['admin', 'superadmin', 'structural', 'dean', 'hod', 'department_head'], true);
    }
}
