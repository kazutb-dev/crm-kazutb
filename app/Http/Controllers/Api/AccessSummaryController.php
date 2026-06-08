<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AcademicScopeResolverService;
use App\Services\ElevatedAuthorityService;
use App\Services\OrgScopeResolverService;
use App\Services\ScopedAuthorityLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccessSummaryController extends Controller
{
    public function __construct(
        private readonly OrgScopeResolverService $orgScopeResolver,
        private readonly ElevatedAuthorityService $elevatedAuthority,
        private readonly ScopedAuthorityLedgerService $authorityLedger,
        private readonly AcademicScopeResolverService $academicScopeResolver,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'Не авторизован.',
            ], 401);
        }

        $orgScope = $this->orgScopeResolver->resolveForUser($user);
        $elevated = $this->elevatedAuthority->resolveForUser($user);
        $ledger = $this->authorityLedger->resolveForUser($user, $orgScope);
        $academic = $this->academicScopeResolver->resolveForUser(
            $user,
            $user->employeeProfile,
            $user->studentProfile,
            $user->academicScopeAssignments,
        );

        return response()->json([
            'data' => [
                'user_id' => $user->id,
                'role' => [
                    'slug' => $user->resolvedRoleSlug(),
                    'label' => $user->resolveRoleLabel(),
                ],
                'identity_context' => [
                    'employee' => (bool) ($academic['employee_profile']['exists'] ?? false),
                    'student' => (bool) ($academic['student_profile']['exists'] ?? false),
                    'dual' => (bool) ($academic['dual_context'] ?? false),
                ],
                'org_scope' => $orgScope,
                'elevated_authority' => $elevated,
                'academic_scope' => $academic,
                'authority_ledger_summary' => $ledger['summary'] ?? [],
                'effective_access_summary' => [
                    'org_scope_status' => $orgScope['status'] ?? 'missing',
                    'academic_scope_status' => $academic['status'] ?? 'missing',
                    'elevated_categories' => $elevated['categories'] ?? [],
                    'mobile_payload_ready' => true,
                ],
            ],
        ]);
    }
}
