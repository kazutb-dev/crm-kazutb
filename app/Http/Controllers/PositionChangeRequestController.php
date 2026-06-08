<?php

namespace App\Http\Controllers;

use App\Models\GovernanceAccessRequest;
use App\Models\Position;
use App\Models\PositionChangeRequest;
use App\Services\BusinessActivityLogger;
use App\Services\ElevatedAuthorityService;
use App\Services\GovernanceAccessRequestService;
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

        $governanceRequest = app(GovernanceAccessRequestService::class)->submitPositionRequest(
            $user,
            $user,
            (int) $data['requested_position_id'],
            null,
            'legacy_position_request'
        );

        app(BusinessActivityLogger::class)->log(
            'position_request_created',
            'Создана заявка на смену должности',
            $governanceRequest,
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
    public function adminIndex(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user, 403);
        abort_unless(app(ElevatedAuthorityService::class)->canAccessGovernanceSurface($user), 403);

        return redirect()->route('governance.access-requests', [
            'request_type' => GovernanceAccessRequest::TYPE_POSITION,
            'status' => $request->query('status', GovernanceAccessRequest::STATUS_PENDING),
        ]);
    }

    /**
     * Admin: approve a request.
     */
    public function approve(Request $request, PositionChangeRequest $positionRequest): RedirectResponse
    {
        $decision = $this->abortUnlessDangerousActionAllowed($request, 'position_request_decision');
        $reason = $this->validateDangerousActionReason($request, (bool) ($decision['reason_required'] ?? false));

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
                'reason' => $reason,
            ],
            $request->user(),
            $request,
        );

        $this->logSuperAdminOverride($request, 'position_request_approved', [
            'position_request_id' => $positionRequest->id,
            'approved_position_id' => $position->id,
            'reason' => $reason,
            'authority_decision' => $decision,
        ]);

        return back()->with('success', 'Заявка одобрена, должность обновлена.');
    }

    /**
     * Admin: reject a request.
     */
    public function reject(Request $request, PositionChangeRequest $positionRequest): RedirectResponse
    {
        $decision = $this->abortUnlessDangerousActionAllowed($request, 'position_request_decision');
        $reason = $this->validateDangerousActionReason($request, (bool) ($decision['reason_required'] ?? false));

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
                'reason' => $reason,
            ],
            $request->user(),
            $request,
        );

        $this->logSuperAdminOverride($request, 'position_request_rejected', [
            'position_request_id' => $positionRequest->id,
            'reason' => $reason,
            'authority_decision' => $decision,
        ]);

        return back()->with('success', 'Заявка отклонена.');
    }

    /**
     * @return array<string, mixed>
     */
    private function abortUnlessDangerousActionAllowed(Request $request, string $action): array
    {
        $user = $request->user();
        abort_unless($user, 403);

        $decision = app(ElevatedAuthorityService::class)->evaluateDangerousAction($user, $action);

        if (! ($decision['allow'] ?? false)) {
            abort(403, 'Недостаточно категориальных elevated-полномочий.');
        }

        return $decision;
    }

    private function validateDangerousActionReason(Request $request, bool $required): ?string
    {
        $rules = $required
            ? ['required', 'string', 'min:8', 'max:500']
            : ['nullable', 'string', 'max:500'];

        $validated = $request->validate([
            'reason' => $rules,
        ]);

        return isset($validated['reason']) ? trim((string) $validated['reason']) : null;
    }

    private function logSuperAdminOverride(Request $request, string $action, array $context = []): void
    {
        $actor = $request->user();

        if (! $actor || $actor->resolvedRoleSlug() !== 'superadmin') {
            return;
        }

        app(BusinessActivityLogger::class)->log(
            'superadmin_override',
            'Superadmin override: ' . $action,
            null,
            $context,
            $actor,
            $request,
        );
    }
}
