<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Position;
use App\Models\PositionChangeRequest;
use App\Models\User;
use App\Services\BusinessActivityLogger;
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

        if (! $this->canEditAcademicBindings($user)) {
            unset($validated['faculty_id'], $validated['department_id']);
        }

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

        // Handle position confirmation
        $confirmed = isset($validated['position_confirmed'])
            ? filter_var($validated['position_confirmed'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
            : null;

        if ($confirmed === true) {
            $user->position_title     = $user->position_title ?: $user->ad_title;
            $user->position_id        = null;
            $user->position_confirmed = true;
        } elseif ($confirmed === false && ! empty($validated['position_id'])) {
            $requestedPosition = Position::query()->find((int) $validated['position_id']);
            $positionRequestsEnabled = $this->positionRequestsTableExists();

            if ($requestedPosition !== null) {
                $hasPendingRequest = $positionRequestsEnabled
                    ? PositionChangeRequest::query()
                        ->where('user_id', $user->id)
                        ->where('status', 'pending')
                        ->exists()
                    : false;

                if ($hasPendingRequest) {
                    // Position change is locked while request is pending; keep saving other profile fields.
                    unset($validated['position_id']);
                    $requestedPosition = null;
                }

                if ($requestedPosition !== null) {
                    $currentPosition = trim((string) ($user->position_title ?: $user->ad_title));
                    if ($currentPosition !== '' && $currentPosition === (string) $requestedPosition->name) {
                        // Selecting the already assigned position is a no-op: continue saving other profile fields.
                        unset($validated['position_id']);
                    } elseif ($positionRequestsEnabled) {
                        PositionChangeRequest::query()->create([
                            'user_id' => $user->id,
                            'current_position' => $user->position_title ?: $user->ad_title,
                            'requested_position_id' => $requestedPosition->id,
                            'status' => 'pending',
                        ]);
                    } else {
                        unset($validated['position_id']);
                    }
                }
            }
        }

        unset($validated['position_confirmed'], $validated['position_id'], $validated['position_title']);

        $user->fill($validated);

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->updated_profile_at = now();

        if ($user->profile_completed_at === null && $this->profileCompletionPercent($user) >= 100) {
            $user->profile_completed_at = now();
        }

        $user->save();

        app(BusinessActivityLogger::class)->log(
            'profile_updated',
            'Профиль пользователя обновлён',
            $user,
            [
                'changed_fields' => array_values(array_diff(array_keys($validated), ['password'])),
                'email_changed' => $user->wasChanged('email'),
                'phone_changed' => $isPhoneChanged,
                'academic_bindings_changed' => $this->canEditAcademicBindings($request->user()) ? ['faculty_id', 'department_id'] : [],
                'position_request_created' => isset($requestedPosition) && $requestedPosition !== null,
            ],
            $user,
            $request,
        );

        return Redirect::route('profile.edit');
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
            ? $user->kpiStructuralUnits->map(static fn ($unit) => [
                'id' => $unit->id,
                'name' => $unit->name,
            ])->values()
            : $user->divisions->map(static fn ($division) => [
                'id' => $division->id,
                'name' => $division->name,
            ])->values();
        $canEditAcademicBindings = $this->canEditAcademicBindings($user);
        $positionRequests = collect();
        $hasPendingPositionRequest = false;
        $pendingPositionRequest = null;

        if ($this->positionRequestsTableExists()) {
            $positionRequests = PositionChangeRequest::query()
                ->where('user_id', $user->id)
                ->with('requestedPosition:id,name')
                ->latest('id')
                ->limit(5)
                ->get()
                ->map(static fn (PositionChangeRequest $request) => [
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
            'profile_completion_percent' => $profileCompletionPercent,
            'profile_completion_label' => $profileCompletionLabel,
            'profile_completion' => $profileCompletionPercent,
            'has_pending_position_request' => $hasPendingPositionRequest,
            'pending_position_request' => $pendingPositionRequest ? [
                'id' => $pendingPositionRequest->id,
                'requested_position' => $pendingPositionRequest->requestedPosition?->name,
                'created_at' => $pendingPositionRequest->created_at?->toDateString(),
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
                    ->map(static fn (Faculty $faculty) => [
                        'id' => $faculty->id,
                        'name' => $faculty->name,
                    ])
                    ->values()
                    ->all(),
                'departments' => Department::query()
                    ->orderBy('name')
                    ->get(['id', 'name', 'faculty_id'])
                    ->map(static fn (Department $department) => [
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
            ],
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
}
