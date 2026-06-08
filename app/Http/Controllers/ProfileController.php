<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\GovernanceAccessRequest;
use App\Models\Position;
use App\Models\PositionChangeRequest;
use App\Models\Questionnaire\Student as QuestionnaireStudent;
use App\Models\User;
use App\Services\BusinessActivityLogger;
use App\Services\GovernanceAccessRequestService;
use App\Services\GreenApiWhatsAppNotifier;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user()->loadMissing([
            'faculty',
            'department',
            'divisions',
            'kpiStructuralUnits',
            'roleRef',
        ]);

        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status' => session('status'),
            'profile' => $this->buildProfilePayload($user),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request, GreenApiWhatsAppNotifier $whatsAppNotifier): RedirectResponse
    {
        $user = $request->user();
        $validated = $this->normalizeProfileData($request->validated());

        $requestedGovernedValues = [
            'position_confirmed' => $validated['position_confirmed'] ?? null,
            'position_id' => $validated['position_id'] ?? null,
            'faculty_id' => $validated['faculty_id'] ?? null,
            'department_id' => $validated['department_id'] ?? null,
            'request_comment' => $validated['request_comment'] ?? null,
        ];

        $blockedSelfEditFields = [];

        if ($this->isAdSynced($user)) {
            foreach (['name', 'email'] as $identityField) {
                if (array_key_exists($identityField, $validated)) {
                    unset($validated[$identityField]);
                    $blockedSelfEditFields[] = $identityField;
                }
            }
        }

        // Phase 1 hard-freeze: never accept self-edits for access-affecting profile fields.
        unset(
            $validated['position_confirmed'],
            $validated['position_id'],
            $validated['position_title'],
            $validated['faculty_id'],
            $validated['department_id'],
            $validated['profile_visibility'],
            $validated['request_comment'],
        );

        $newPhone = trim((string) ($validated['phone'] ?? ''));
        $currentPhone = trim((string) ($user->phone ?? ''));
        $isPhoneChanged = $newPhone !== '' && $newPhone !== $currentPhone;

        if ($isPhoneChanged) {
            $isValidWhatsApp = $whatsAppNotifier->verifyWhatsAppPhone($newPhone, [
                'user_id' => $user->id,
                'flow' => 'profile_phone_verification',
            ]);

            if (! $isValidWhatsApp) {
                return Redirect::route('profile.edit')
                    ->withErrors([
                        'phone' => 'Указанный номер не найден в WhatsApp или недоступен для проверки. Проверьте номер и повторите попытку.',
                    ])
                    ->withInput();
            }

            $welcomeMessage = "Здравствуйте! Это проверочное сообщение WhatsApp для вашего профиля. Если вы получили это сообщение, номер подтвержден.";

            $sent = $whatsAppNotifier->sendMessageToPhone($newPhone, $welcomeMessage, [
                'user_id' => $user->id,
                'flow' => 'profile_phone_verification',
            ]);

            if (! $sent) {
                return Redirect::route('profile.edit')
                    ->withErrors([
                        'phone' => 'Не удалось отправить проверочное сообщение в WhatsApp. Проверьте номер и повторите попытку.',
                    ])
                    ->withInput();
            }
        }


        $dangerousSelfEditKeys = [
            'position_confirmed',
            'position_id',
            'position_title',
            'faculty_id',
            'department_id',
            'profile_visibility',
            'division_id',
            'role',
            'role_id',
        ];
        $blockedSelfEditFields = array_values(array_unique(array_merge(
            $blockedSelfEditFields,
            array_values(array_intersect($dangerousSelfEditKeys, array_keys($request->all()))),
        )));

        $user->fill($validated);

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->updated_profile_at = now();

        if ($user->profile_completed_at === null && $this->profileCompletionPercent($user) >= 100) {
            $user->profile_completed_at = now();
        }

        $user->save();

        $createdGovernanceRequests = $this->submitProfileGovernanceRequests(
            $user->fresh(['faculty', 'department']),
            $request,
            $requestedGovernedValues,
        );

        app(BusinessActivityLogger::class)->log(
            'profile_updated',
            'Профиль пользователя обновлён',
            $user,
            [
                'changed_fields' => array_values(array_diff(array_keys($validated), ['password'])),
                'email_changed' => $user->wasChanged('email'),
                'phone_changed' => $isPhoneChanged,
                'academic_bindings_changed' => in_array('academic_affiliation', $createdGovernanceRequests, true),
                'position_request_created' => in_array('position', $createdGovernanceRequests, true),
                'structural_request_created' => in_array('structural_binding', $createdGovernanceRequests, true),
                'blocked_self_edit_fields' => $blockedSelfEditFields,
            ],
            $user,
            $request,
        );

        $message = empty($createdGovernanceRequests)
            ? 'Профиль обновлён.'
            : 'Профиль обновлён, security-relevant изменения отправлены на согласование.';

        return Redirect::route('profile.edit')->with('success', $message);
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        app(BusinessActivityLogger::class)->log(
            'profile_deleted',
            'Пользователь удалил свой аккаунт',
            $user,
            [
                'reason' => 'self_service_delete',
            ],
            $user,
            $request,
        );

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }

    private function buildProfilePayload(User $user): array
    {
        $isAdSynced = $this->isAdSynced($user);
        $profileCompletionPercent = $this->profileCompletionPercent($user);
        $profileCompletionLabel = $profileCompletionPercent . '%';
        $profileVisibility = $this->profileVisibilityValue($user->profile_visibility);
        $profileVisibilityLabel = $this->profileVisibilityLabel($profileVisibility);
        $syncLabel = $isAdSynced ? 'AD-синхронизация' : 'Локальный аккаунт';
        $isStructuralRole = $user->resolvedRoleSlug() === 'structural';
        $divisionSource = $isStructuralRole
            ? $user->kpiStructuralUnits->map(static fn($unit) => [
                'id' => $unit->id,
                'name' => $unit->name,
            ])->values()
            : $user->divisions->map(static fn($division) => [
                'id' => $division->id,
                'name' => $division->name,
            ])->values();
        $canEditAcademicBindings = $this->canEditAcademicBindings($user);
        $positionRequests = collect();
        $hasPendingPositionRequest = false;
        $pendingPositionRequest = null;
        $pendingAcademicRequest = null;

        if ($this->governanceAccessRequestsTableExists()) {
            $pendingRequests = GovernanceAccessRequest::query()
                ->where('subject_user_id', $user->id)
                ->where('status', GovernanceAccessRequest::STATUS_PENDING)
                ->latest('id')
                ->get()
                ->keyBy('request_type');

            $pendingPositionRequest = $pendingRequests->get(GovernanceAccessRequest::TYPE_POSITION);
            $pendingAcademicRequest = $pendingRequests->get(GovernanceAccessRequest::TYPE_ACADEMIC);
            $hasPendingPositionRequest = $pendingPositionRequest !== null;
        }

        if (! $this->governanceAccessRequestsTableExists() && $this->positionRequestsTableExists()) {
            $positionRequests = PositionChangeRequest::query()
                ->where('user_id', $user->id)
                ->with('requestedPosition:id,name')
                ->latest('id')
                ->limit(5)
                ->get()
                ->map(static fn(PositionChangeRequest $request) => [
                    'id' => $request->id,
                    'status' => $request->status,
                    'requested_position' => $request->requestedPosition?->name,
                    'created_at' => $request->created_at?->toDateString(),
                    'admin_note' => $request->admin_note,
                ])
                ->values();

            $hasPendingPositionRequest = PositionChangeRequest::query()
                ->where('user_id', $user->id)
                ->where('status', 'pending')
                ->exists();

            $pendingPositionRequest = PositionChangeRequest::query()
                ->where('user_id', $user->id)
                ->where('status', 'pending')
                ->with('requestedPosition:id,name')
                ->latest('id')
                ->first();
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone ?: null,
            'ad_phone' => $user->ad_phone ?? null,
            'ad_title'           => $user->ad_title,
            'position_confirmed' => $user->position_confirmed,
            'position_id'        => $user->position_id,
            'position_title' => $user->position_title ?: ($user->ad_title ?: null),
            'office_location' => $user->office_location ?: ($user->room ?: null),
            'telegram' => $user->telegram ?: null,
            'bio' => $user->bio ?: null,
            'avatar_url' => $user->avatar_url ?: null,
            'profile_visibility' => $profileVisibility,
            'profile_visibility_label' => $profileVisibilityLabel,
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'created_at' => $user->created_at?->toIso8601String(),
            'updated_at' => $user->updated_at?->toIso8601String(),
            'updated_profile_at' => $user->updated_profile_at?->toIso8601String(),
            'profile_completed_at' => $user->profile_completed_at?->toIso8601String(),
            'login_count' => (int) ($user->login_count ?? 0),
            'role_label' => $user->resolveRoleLabel(),
            'role_slug' => $user->resolvedRoleSlug(),
            'sync_status' => $isAdSynced ? 'ad' : 'local',
            'sync_label' => $syncLabel,
            'identity_editable' => ! $isAdSynced,
            'profile_completion_percent' => $profileCompletionPercent,
            'profile_completion_label' => $profileCompletionLabel,
            'profile_completion' => $profileCompletionPercent,
            'has_pending_position_request' => $hasPendingPositionRequest,
            'pending_position_request' => $pendingPositionRequest ? [
                'id' => $pendingPositionRequest->id,
                'requested_position' => $pendingPositionRequest instanceof GovernanceAccessRequest
                    ? ($pendingPositionRequest->requested_value['position_title'] ?? null)
                    : $pendingPositionRequest->requestedPosition?->name,
                'created_at' => $pendingPositionRequest->created_at?->toDateString(),
            ] : null,
            'pending_academic_request' => $pendingAcademicRequest ? [
                'id' => $pendingAcademicRequest->id,
                'faculty_id' => $pendingAcademicRequest->requested_value['faculty_id'] ?? null,
                'department_id' => $pendingAcademicRequest->requested_value['department_id'] ?? null,
                'created_at' => $pendingAcademicRequest->created_at?->toDateString(),
            ] : null,
            'position_requests' => $positionRequests->all(),
            'faculty' => $user->faculty ? [
                'id' => $user->faculty->id,
                'name' => $user->faculty->name,
            ] : null,
            'department' => $user->department ? [
                'id' => $user->department->id,
                'name' => $user->department->name,
            ] : null,
            'student_binding' => $this->resolveStudentBinding($user),
            'divisions' => $divisionSource->all(),
            'bindings' => [
                'faculty_label' => $user->faculty?->name,
                'department_label' => $user->department?->name,
                'division_labels' => $divisionSource->pluck('name')->values()->all(),
            ],
            'academic_bindings' => [
                'can_edit' => $canEditAcademicBindings,
                'positions' => Position::query()
                    ->orderBy('name')
                    ->get(['id', 'name'])
                    ->values()
                    ->all(),
                'faculties' => Faculty::query()
                    ->orderBy('name')
                    ->get(['id', 'name'])
                    ->map(static fn(Faculty $faculty) => [
                        'id' => $faculty->id,
                        'name' => $faculty->name,
                    ])
                    ->values()
                    ->all(),
                'departments' => Department::query()
                    ->orderBy('name')
                    ->get(['id', 'name', 'faculty_id'])
                    ->map(static fn(Department $department) => [
                        'id' => $department->id,
                        'name' => $department->name,
                        'faculty_id' => $department->faculty_id,
                    ])
                    ->values()
                    ->all(),
            ],
            'snapshot' => [
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone ?: ($user->ad_phone ?? null),
                'position_title' => $user->position_title ?: $user->ad_title,
                'ad_title'           => $user->ad_title,
                'position_confirmed' => $user->position_confirmed,
                'position_id'        => $user->position_id ? (string) $user->position_id : '',
                'office_location' => $user->office_location ?: $user->room,
                'telegram' => $user->telegram,
                'bio' => $user->bio,
                'avatar_url' => $user->avatar_url,
                'profile_visibility' => $profileVisibility,
                'faculty_id' => $user->faculty_id,
                'department_id' => $user->department_id,
                'request_comment' => '',
            ],
            'authorization_core' => [
                'identity_source' => $isAdSynced ? 'ad' : 'local',
                'academic_context_source' => config('academic.upstream_source', 'platonus_read_only'),
                'authorization_source' => 'crm',
                'academic_contract' => app(\App\Services\AcademicScopeResolverService::class)->contractState(),
                'self_editable_fields' => ['phone', 'telegram', 'bio', 'avatar_url', 'office_location'],
                'approval_required_fields' => ['position_id', 'faculty_id', 'department_id', 'structural_unit_ids'],
                'sync_only_fields' => ['ad_guid', 'ad_login', 'ad_title', 'ad_department', 'ad_division'],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $requestedGovernedValues
     * @return array<int, string>
     */
    private function submitProfileGovernanceRequests(User $user, Request $request, array $requestedGovernedValues): array
    {
        $service = app(GovernanceAccessRequestService::class);
        $created = [];
        $comment = is_string($requestedGovernedValues['request_comment'] ?? null)
            ? trim((string) $requestedGovernedValues['request_comment'])
            : null;

        if (($requestedGovernedValues['position_confirmed'] ?? null) === false && ! empty($requestedGovernedValues['position_id'])) {
            $positionRequest = $service->submitPositionRequest(
                $user,
                $request->user(),
                (int) $requestedGovernedValues['position_id'],
                $comment,
                'profile_self_service'
            );

            if ($positionRequest) {
                $created[] = GovernanceAccessRequest::TYPE_POSITION;
            }
        }

        $academicRequest = $service->submitAcademicRequest(
            $user,
            $request->user(),
            isset($requestedGovernedValues['faculty_id']) ? (int) ($requestedGovernedValues['faculty_id'] ?: 0) ?: null : null,
            isset($requestedGovernedValues['department_id']) ? (int) ($requestedGovernedValues['department_id'] ?: 0) ?: null : null,
            $comment,
            'profile_self_service'
        );

        if ($academicRequest) {
            $created[] = GovernanceAccessRequest::TYPE_ACADEMIC;
        }

        return $created;
    }

    private function resolveStudentBinding(User $user): ?array
    {
        $student = QuestionnaireStudent::query()
            ->with([
                'group:id,name,group_speciality_id,group_educational_program_id,speciality,educational_program',
                'group.specialityRef:id,name,department_id',
                'group.specialityRef.department:id,name',
                'group.educationalProgramRef:id,name',
            ])
            ->where(function ($query) use ($user): void {
                $query->where('user_id', $user->id);

                if (filled($user->ad_login)) {
                    $query->orWhere('login', (string) $user->ad_login);
                }

                if (filled($user->name)) {
                    $query->orWhere('login', (string) $user->name);
                }
            })
            ->orderByDesc('id')
            ->first();

        if ($student === null) {
            return null;
        }

        $group = $student->group;
        if ($group === null) {
            return null;
        }

        return [
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
            ],
            'department' => $group->specialityRef?->department ? [
                'id' => $group->specialityRef->department->id,
                'name' => $group->specialityRef->department->name,
            ] : null,
            'speciality' => $group->specialityRef ? [
                'id' => $group->specialityRef->id,
                'name' => $group->specialityRef->name,
            ] : (filled($group->speciality) ? [
                'id' => null,
                'name' => (string) $group->speciality,
            ] : null),
            'educational_program' => $group->educationalProgramRef ? [
                'id' => $group->educationalProgramRef->id,
                'name' => $group->educationalProgramRef->name,
            ] : (filled($group->educational_program) ? [
                'id' => null,
                'name' => (string) $group->educational_program,
            ] : null),
        ];
    }

    private function normalizeProfileData(array $validated): array
    {
        $validated['name'] = trim((string) ($validated['name'] ?? ''));
        // $validated['email'] = mb_strtolower(trim((string) ($validated['email'] ?? '')));
        $validated['email'] = trim((string) ($validated['email'] ?? ''));
        foreach (['phone', 'position_title', 'office_location', 'telegram', 'bio', 'avatar_url'] as $field) {
            if (array_key_exists($field, $validated)) {
                $value = trim((string) ($validated[$field] ?? ''));
                $validated[$field] = $value === '' ? null : $value;
            }
        }

        foreach (['faculty_id', 'department_id'] as $field) {
            if (array_key_exists($field, $validated)) {
                $value = $validated[$field];
                $validated[$field] = $value === null || $value === '' ? null : (int) $value;
            }
        }

        $validated['profile_visibility'] = trim((string) ($validated['profile_visibility'] ?? 'internal')) ?: 'internal';

        return $validated;
    }

    private function canEditAcademicBindings(User $user): bool
    {
        $rawRole = strtolower(trim((string) ($user->role ?? '')));
        $relationRole = strtolower(trim((string) ($user->roleRef?->slug ?? '')));

        return $user->resolvedRoleSlug() === 'teacher'
            || ($rawRole === '' && $relationRole === '');
    }

    private function profileVisibilityValue(?string $visibility): string
    {
        return in_array($visibility, ['public', 'internal', 'private'], true)
            ? $visibility
            : 'internal';
    }

    private function profileCompletionPercent(User $user): int
    {
        $fields = [
            $user->name,
            $user->email,
            $user->phone ?: ($user->ad_phone ?? null),
            $user->position_title ?: $user->ad_title,
            $user->bio,
            $user->avatar_url,
        ];

        $filledCount = 0;

        foreach ($fields as $field) {
            if (filled($field)) {
                $filledCount++;
            }
        }

        return (int) round(($filledCount / count($fields)) * 100);
    }

    private function isAdSynced(User $user): bool
    {
        return filled($user->ad_guid)
            || filled($user->ad_login)
            || filled($user->ad_title)
            || filled($user->ad_department)
            || filled($user->ad_division)
            || filled($user->ad_description);
    }

    private function profileVisibilityLabel(?string $visibility): string
    {
        return match ($visibility) {
            'public' => 'Публичный',
            'private' => 'Приватный',
            default => 'Внутренний',
        };
    }

    private function positionRequestsTableExists(): bool
    {
        static $exists = null;

        if ($exists === null) {
            $exists = Schema::hasTable('position_change_requests');
        }

        return $exists;
    }

    private function governanceAccessRequestsTableExists(): bool
    {
        static $exists = null;

        if ($exists === null) {
            $exists = Schema::hasTable('governance_access_requests');
        }

        return $exists;
    }
}
