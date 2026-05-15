<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Division;
use App\Models\Faculty;
use App\Models\KpiAccessGrant;
use App\Models\KpiStructuralUnit;
use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use App\Services\ActiveDirectoryAuthenticator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DirectoryUserController extends Controller
{
    private const API_LOGINS = ['api', 'api-kiosk', 'api-library', 'api-platonus', 'glpi'];

    public function adminAccess(Request $request): Response
    {
        $this->abortUnlessAdminRole($request);

        $search = trim((string) $request->query('search', ''));

        $users = User::query()
            ->with('roleRef:id,slug,name')
            ->select([
                'id',
                'name',
                'display_name',
                'email',
                'ad_login',
                'ad_department',
                'ad_title',
                'role',
                'role_id',
            ])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $nested) use ($search): void {
                    $nested
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('display_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('ad_login', 'like', "%{$search}%")
                        ->orWhere('ad_department', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->limit(300)
            ->get()
            ->filter(fn (User $user): bool => $user->resolvedRoleSlug() !== 'student')
            ->take(100)
            ->values()
            ->map(function (User $user): array {
                $role = $user->resolvedRoleSlug();

                return [
                    'id' => $user->id,
                    'name' => $user->display_name ?: $user->name,
                    'email' => $user->email,
                    'login' => $user->ad_login,
                    'department' => $user->ad_department,
                    'title' => $user->ad_title,
                    'role' => $role,
                    'can_grant_admin' => ! in_array($role, ['admin', 'superadmin'], true),
                    'can_revoke_admin' => $role === 'admin',
                ];
            })
            ->all();

        return Inertia::render('Users/AdminAccess', [
            'users' => $users,
            'search' => $search,
        ]);
    }

    public function grantAdmin(Request $request): RedirectResponse
    {
        $this->abortUnlessAdminRole($request);

        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $user = User::query()->findOrFail((int) $data['user_id']);
        $role = $user->resolvedRoleSlug();

        if (in_array($role, ['admin', 'superadmin'], true)) {
            return back()->with('warning', 'У пользователя уже есть админ-доступ.');
        }

        $adminRoleId = Role::query()->where('slug', 'admin')->value('id');

        if (! $adminRoleId) {
            return back()->with('error', 'Роль admin не найдена.');
        }

        $user->update([
            'role_id' => $adminRoleId,
            'role' => 'admin',
        ]);

        return back()->with('success', 'Права администратора выданы.');
    }

    public function revokeAdmin(Request $request): RedirectResponse
    {
        $this->abortUnlessAdminRole($request);

        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $user = User::query()->findOrFail((int) $data['user_id']);
        $role = $user->resolvedRoleSlug();

        if ($role === 'superadmin') {
            return back()->with('warning', 'Нельзя снять права у superadmin.');
        }

        if ($role !== 'admin') {
            return back()->with('warning', 'У пользователя нет роли admin.');
        }

        $teacherRoleId = Role::query()->where('slug', 'teacher')->value('id');

        if (! $teacherRoleId) {
            return back()->with('error', 'Роль teacher не найдена.');
        }

        $user->update([
            'role_id' => $teacherRoleId,
            'role' => 'teacher',
        ]);

        return back()->with('success', 'Права администратора сняты.');
    }

    public function index(Request $request): Response
    {
        $directoryType = $request->routeIs('users.students') ? 'students' : 'staff';
        $hasIsHidden = Schema::hasColumn('users', 'is_hidden');

        $perPage = (int) $request->integer('per_page', 50);
        if (! in_array($perPage, [25, 50, 100], true)) {
            $perPage = 50;
        }

        $page = max(1, (int) $request->integer('page', 1));

        $filters = [
            'q' => trim((string) $request->query('q', '')),
            'tab' => trim((string) $request->query('tab', 'all')),
            'sort_by' => trim((string) $request->query('sort_by', '')),
            'sort_dir' => trim((string) $request->query('sort_dir', '')),
            'faculty_id' => trim((string) $request->query('faculty_id', '')),
            'department_id' => trim((string) $request->query('department_id', '')),
            'synced' => trim((string) $request->query('synced', 'all')),
            'last_login_range' => trim((string) $request->query('last_login_range', 'all')),
            'per_page' => $perPage,
            'page' => $page,
        ];

        $localUsers = User::query()
            ->with([
                'roleRef:id,slug,name',
                'position:id,name,division_id',
                'department:id,name,faculty_id',
                'department.faculty:id,name',
                'faculty:id,name',
                'kpiStructuralUnits:id,name,code',
                'kpiAccessGrants:id,user_id,permission,division_id,is_active',
            ])
            ->select([
                'id',
                'name',
                'display_name',
                'email',
                'ad_guid',
                'ad_login',
                'ad_title',
                'ad_department',
                'ad_division',
                'role',
                'role_id',
                'position_id',
                'department_id',
                'faculty_id',
                'last_login_at',
                'login_count',
                'created_at',
            ])
            ->when($hasIsHidden, function (Builder $query): void {
                $query->where(function (Builder $hiddenQuery): void {
                    $hiddenQuery->whereNull('is_hidden')->orWhere('is_hidden', 0);
                });
            })
            ->where(function (Builder $query): void {
                $query->whereNull('ad_login')
                    ->orWhereRaw('LOWER(ad_login) NOT IN (?, ?, ?, ?, ?)', self::API_LOGINS);
            })
            ->get();

        $adService = app(ActiveDirectoryAuthenticator::class);
        $directoryUsers = $directoryType === 'students'
            ? ($adService->listStudentUsers() ?? [])
            : ($adService->listDirectoryUsers() ?? []);

        if ($directoryType === 'staff') {
            $directoryUsers = array_values(array_filter(
                $directoryUsers,
                fn (array $entry): bool => ! $adService->isStudentEntry($entry)
            ));
        }

        $directoryUsers = array_values(array_filter(
            $directoryUsers,
            function (array $entry): bool {
                $login = Str::lower(trim((string) ($entry['login'] ?? '')));

                if ($login === '') {
                    return true;
                }

                return ! in_array($login, self::API_LOGINS, true);
            }
        ));

        if ($directoryType === 'students') {
            $directoryUsers = array_values(array_filter(
                $directoryUsers,
                fn (array $entry): bool => $adService->isStudentEntry($entry)
            ));
        }

        $localCandidates = $localUsers->filter(function (User $user) use ($directoryType): bool {
            $roleSlug = $this->resolveMergedRoleForLocalUser($user);

            if ($directoryType === 'students') {
                return $roleSlug === 'student';
            }

            return $roleSlug !== 'student';
        })->values();

        $structuralAccessByUser = [];
        foreach ($localCandidates as $candidate) {
            $divisionIds = $candidate->kpiAccessGrants
                ->where('permission', KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
                ->where('is_active', true)
                ->pluck('division_id')
                ->filter()
                ->map(fn ($divisionId) => (int) $divisionId)
                ->unique()
                ->values()
                ->all();

            $structuralAccessByUser[$candidate->id] = $divisionIds;
        }

        $localByGuid = $localCandidates
            ->filter(fn (User $user): bool => trim((string) $user->ad_guid) !== '')
            ->keyBy(fn (User $user): string => Str::lower(trim((string) $user->ad_guid)));

        $localByLogin = $localCandidates
            ->filter(fn (User $user): bool => trim((string) $user->ad_login) !== '')
            ->keyBy(fn (User $user): string => Str::lower(trim((string) $user->ad_login)));

        $localByEmail = $localCandidates
            ->filter(fn (User $user): bool => trim((string) $user->email) !== '')
            ->keyBy(fn (User $user): string => Str::lower(trim((string) $user->email)));

        $matchedLocalIds = [];
        $combinedRows = collect();

        foreach ($directoryUsers as $directoryUser) {
            $adGuid = Str::lower(trim((string) ($directoryUser['guid'] ?? '')));
            $login = Str::lower(trim((string) ($directoryUser['login'] ?? '')));
            $email = Str::lower(trim((string) ($directoryUser['email'] ?? '')));

            $localMatch = null;

            if ($adGuid !== '' && $localByGuid->has($adGuid)) {
                $localMatch = $localByGuid->get($adGuid);
            }

            if (! $localMatch && $login !== '' && $localByLogin->has($login)) {
                $localMatch = $localByLogin->get($login);
            }

            if (! $localMatch && $email !== '' && $localByEmail->has($email)) {
                $localMatch = $localByEmail->get($email);
            }

            if ($localMatch instanceof User) {
                $matchedLocalIds[$localMatch->id] = true;
            }

            $combinedRows->push($this->mapDirectoryRow($directoryUser, $localMatch, $structuralAccessByUser));
        }

        $unmatchedLocalRows = $localCandidates
            ->filter(fn (User $user): bool => ! isset($matchedLocalIds[$user->id]))
            ->map(fn (User $user): array => $this->mapLocalOnlyRow($user, $structuralAccessByUser));

        $allRows = $combinedRows->merge($unmatchedLocalRows)->values();
        $directoryTotals = $adService->countDirectoryUsersByCategory();

        if ($directoryType === 'staff') {
            $allRows = $allRows
                ->filter(fn (array $row): bool => ! $this->isStudentTitleOrEntry($row))
                ->values();

            $serviceAccountCount = $allRows->filter(function (array $row): bool {
                $login = Str::lower(trim((string) ($row['login'] ?? '')));

                return in_array($login, self::API_LOGINS, true);
            })->count();

            $staffCount = max(0, (int) ($directoryTotals['staff'] ?? $allRows->count()) - $serviceAccountCount);
            $studentCount = (int) ($directoryTotals['students'] ?? 0);
            $hodCount = $allRows->filter(fn (array $u): bool => (($u['role'] ?? '') === 'hod'))->count();
            $deanCount = $allRows->filter(fn (array $u): bool => (($u['role'] ?? '') === 'dean'))->count();
            $teacherCount = $allRows->filter(function (array $u): bool {
                $role = $u['role'] ?? null;

                return $role === null || $role === '' || $role === 'teacher';
            })->count();

            Cache::put('ad_staff_count', $staffCount, now()->addHours(6));
            Cache::put('ad_student_count', $studentCount, now()->addHours(6));
            Cache::put('ad_hod_count', $hodCount, now()->addHours(6));
            Cache::put('ad_dean_count', $deanCount, now()->addHours(6));
            Cache::put('ad_teacher_count', $teacherCount, now()->addHours(6));
            Cache::put('metrics_generated_at', now()->toDateTimeString(), now()->addHours(6));
            Cache::put('metrics_source', 'cached-from-users', now()->addHours(6));
        }

        if ($directoryType === 'students') {
            $studentCount = (int) ($directoryTotals['students'] ?? $allRows->count());

            Cache::put('ad_student_count', $studentCount, now()->addHours(6));
            Cache::put('metrics_generated_at', now()->toDateTimeString(), now()->addHours(6));
            Cache::put('metrics_source', 'cached-from-users', now()->addHours(6));
        }
        $filteredRows = $this->applyCommonFiltersToRows($allRows, $filters)->values();

        $counts = $directoryType === 'students'
            ? [
                'bachelor' => $this->countRowsByTab($filteredRows, 'bachelor', 'students'),
                'master' => $this->countRowsByTab($filteredRows, 'master', 'students'),
                'all' => $this->countRowsByTab($filteredRows, 'all', 'students'),
            ]
            : [
                'teacher' => $this->countRowsByTab($filteredRows, 'teacher', 'staff'),
                'hod' => $this->countRowsByTab($filteredRows, 'hod', 'staff'),
                'dean' => $this->countRowsByTab($filteredRows, 'dean', 'staff'),
                'structural' => $this->countRowsByTab($filteredRows, 'structural', 'staff'),
                'test_users' => $this->countRowsByTab($filteredRows, 'test_users', 'staff'),
                'all' => $this->countRowsByTab($filteredRows, 'all', 'staff'),
            ];

        $users = $this->applyTabFilterToRows($filteredRows, $filters['tab'], $directoryType);
        $users = $this->applySortToRows($users, $filters, $directoryType)->values();

        $total = $users->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $currentPage = min($page, $lastPage);
        $offset = ($currentPage - 1) * $perPage;

        $paginatedUsers = $users->slice($offset, $perPage)->values()->all();
        $pagination = [
            'total' => $total,
            'per_page' => $perPage,
            'current_page' => $currentPage,
            'last_page' => $lastPage,
            'from' => $total > 0 ? ($offset + 1) : 0,
            'to' => $total > 0 ? min($offset + $perPage, $total) : 0,
        ];

        return Inertia::render('Users/Index', [
            'users' => $paginatedUsers,
            'positions' => Position::query()
                ->with('division:id,name')
                ->orderBy('name')
                ->get(['id', 'name', 'division_id'])
                ->map(fn (Position $position): array => [
                    'id' => $position->id,
                    'name' => $position->name,
                    'division_name' => $position->division?->name,
                ])
                ->values(),
            'departments' => Department::query()->orderBy('name')->get(['id', 'name'])->values(),
            'faculties' => Faculty::query()->orderBy('name')->get(['id', 'name'])->values(),
            'filters' => $filters,
            'counts' => $counts,
            'pagination' => $pagination,
            'adAvailable' => true,
            'pageTitle' => $directoryType === 'students' ? 'Студенты' : 'Сотрудники',
            'searchRouteName' => $directoryType === 'students' ? 'users.students' : 'users.index',
            'directoryType' => $directoryType,
            'structuralDivisionOptions' => KpiStructuralUnit::query()->orderBy('name')->get(['id', 'name', 'code'])->values(),
        ]);
    }

    public function createFromAd(Request $request): JsonResponse
    {
        $this->abortUnlessAdminRole($request);

        $data = $request->validate([
            'ad_login' => ['nullable', 'string', 'max:255'],
            'ad_guid' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'name' => ['nullable', 'string', 'max:190'],
        ]);

        $adLogin = Str::lower(trim((string) ($data['ad_login'] ?? '')));
        $adGuid = trim((string) ($data['ad_guid'] ?? ''));
        $email = Str::lower(trim((string) ($data['email'] ?? '')));
        $name = trim((string) ($data['name'] ?? ''));

        if ($adLogin === '' && $adGuid === '' && $email === '') {
            return response()->json([
                'message' => 'Не переданы идентификаторы AD пользователя.',
            ], 422);
        }

        $existing = User::query()
            ->where(function (Builder $query) use ($adLogin, $adGuid, $email): void {
                if ($adLogin !== '') {
                    $query->orWhereRaw('LOWER(ad_login) = ?', [$adLogin]);
                }

                if ($adGuid !== '') {
                    $query->orWhere('ad_guid', $adGuid);
                }

                if ($email !== '') {
                    $query->orWhereRaw('LOWER(email) = ?', [$email]);
                }
            })
            ->first();

        if ($existing) {
            return response()->json(['user_id' => $existing->id]);
        }

        $baseEmail = $email !== '' ? $email : (($adLogin !== '' ? $adLogin : 'ad-user') . '@ad.local');
        $resolvedEmail = $baseEmail;
        $suffix = 1;
        while (User::query()->whereRaw('LOWER(email) = ?', [Str::lower($resolvedEmail)])->exists()) {
            $resolvedEmail = preg_replace('/@/', '+' . $suffix . '@', $baseEmail, 1) ?: ($baseEmail . '+' . $suffix);
            $suffix++;
        }

        $teacherRoleId = $this->resolveAssignableRoleId('teacher') ?? 3;

        $user = User::query()->create([
            'name' => $name !== '' ? $name : ($adLogin !== '' ? $adLogin : 'AD User'),
            'display_name' => $name !== '' ? $name : null,
            'email' => $resolvedEmail,
            'ad_login' => $adLogin !== '' ? $adLogin : null,
            'ad_guid' => $adGuid !== '' ? $adGuid : null,
            'role' => 'teacher',
            'role_id' => $teacherRoleId,
            'password' => bcrypt(Str::random(32)),
        ]);

        $user->forceFill(['email_verified_at' => now()])->save();

        return response()->json(['user_id' => $user->id]);
    }

    public function updatePosition(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'position_id' => ['nullable', 'integer', 'exists:positions,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'faculty_id' => ['nullable', 'integer', 'exists:faculties,id'],
            'division_ids' => ['nullable', 'array'],
            'division_ids.*' => ['integer', 'exists:kpi_structural_units,id'],
        ]);

        if (! empty($data['position_id'])) {
            $position = Position::query()
                ->with('division:id,name')
                ->findOrFail((int) $data['position_id']);

            $normalizedTitle = Str::lower(trim((string) $position->name));
            $isDean = Str::contains($normalizedTitle, 'декан') || Str::contains($normalizedTitle, 'dean');
            $isDepartmentHead = Str::contains($normalizedTitle, 'заведующ')
                || Str::contains($normalizedTitle, 'зав. кафед')
                || Str::contains($normalizedTitle, 'head of department')
                || Str::contains($normalizedTitle, 'department head')
                || Str::contains($normalizedTitle, 'hod');

            $user->update([
                'position_id' => (int) $position->id,
                'ad_title' => $position->name,
                'ad_division' => $position->division?->name,
                'ad_department' => $position->division?->name,
                'department_id' => $isDepartmentHead ? ($data['department_id'] ?? null) : null,
                'faculty_id' => $isDean ? ($data['faculty_id'] ?? null) : null,
            ]);
        } else {
            $roleSlug = $user->resolvedRoleSlug();
            $isDean = $roleSlug === 'dean';
            $isDepartmentHead = in_array($roleSlug, ['hod', 'department_head'], true);

            $updates = ['position_id' => null];

            if ($isDean) {
                $updates['faculty_id'] = $data['faculty_id'] ?? null;
            } elseif ($isDepartmentHead) {
                $updates['department_id'] = $data['department_id'] ?? null;
            } else {
                $updates['faculty_id'] = $data['faculty_id'] ?? null;
                $updates['department_id'] = $data['department_id'] ?? null;
            }

            $user->update($updates);
        }

        if (array_key_exists('division_ids', $data)) {
            $user->kpiStructuralUnits()->sync($data['division_ids'] ?? []);
        }

        return back()->with('success', 'Должность и привязки пользователя обновлены.');
    }

    public function updatePositionByDirectory(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'position_id' => ['nullable', 'integer', 'exists:positions,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'faculty_id' => ['nullable', 'integer', 'exists:faculties,id'],
            'division_ids' => ['nullable', 'array'],
            'division_ids.*' => ['integer', 'exists:kpi_structural_units,id'],
            'login' => ['nullable', 'string', 'max:255', 'required_without:email'],
            'email' => ['nullable', 'email', 'max:255', 'required_without:login'],
            'display_name' => ['nullable', 'string', 'max:190'],
            'employee_type' => ['nullable', 'string', 'max:120'],
        ]);

        $login = Str::lower(trim((string) ($data['login'] ?? '')));
        $email = Str::lower(trim((string) ($data['email'] ?? '')));
        $displayName = trim((string) ($data['display_name'] ?? ''));

        $user = User::query()
            ->where(function (Builder $query) use ($login, $email): void {
                if ($login !== '') {
                    $query->whereRaw('LOWER(ad_login) = ?', [$login]);
                }

                if ($email !== '') {
                    $query->orWhereRaw('LOWER(email) = ?', [$email]);
                }
            })
            ->first();

        if (! $user) {
            return back()->with('error', 'Пользователь не найден в системе. Сначала синхронизируйте его.');
        }

        $position = ! empty($data['position_id'])
            ? Position::query()->with('division:id,name')->findOrFail((int) $data['position_id'])
            : null;

        if ($position) {
            $normalizedTitle = Str::lower(trim((string) $position->name));
            $isDean = Str::contains($normalizedTitle, 'декан') || Str::contains($normalizedTitle, 'dean');
            $isDepartmentHead = Str::contains($normalizedTitle, 'заведующ')
                || Str::contains($normalizedTitle, 'зав. кафед')
                || Str::contains($normalizedTitle, 'head of department')
                || Str::contains($normalizedTitle, 'department head')
                || Str::contains($normalizedTitle, 'hod');

            $user->update([
                'position_id' => (int) $position->id,
                'ad_title' => $position->name,
                'ad_division' => $position->division?->name,
                'ad_department' => $position->division?->name,
                'department_id' => $isDepartmentHead ? ($data['department_id'] ?? null) : null,
                'faculty_id' => $isDean ? ($data['faculty_id'] ?? null) : null,
            ]);
        } else {
            $roleSlug = $user->resolvedRoleSlug();
            $isDean = $roleSlug === 'dean';
            $isDepartmentHead = in_array($roleSlug, ['hod', 'department_head'], true);

            $updates = ['position_id' => null];

            if ($isDean) {
                $updates['faculty_id'] = $data['faculty_id'] ?? null;
            } elseif ($isDepartmentHead) {
                $updates['department_id'] = $data['department_id'] ?? null;
            } else {
                $updates['faculty_id'] = $data['faculty_id'] ?? null;
                $updates['department_id'] = $data['department_id'] ?? null;
            }

            $user->update($updates);
        }

        if (array_key_exists('division_ids', $data)) {
            $user->kpiStructuralUnits()->sync($data['division_ids'] ?? []);
        }

        return back()->with('success', 'Должность и привязки пользователя обновлены.');
    }

    public function updateDivisions(Request $request, User $user): RedirectResponse
    {
        $this->abortUnlessAdminRole($request);

        $data = $request->validate([
            'division_ids' => ['nullable', 'array'],
            'division_ids.*' => ['integer', 'exists:kpi_structural_units,id'],
        ]);

        $user->kpiStructuralUnits()->sync($data['division_ids'] ?? []);

        return back()->with('success', 'Подразделения сотрудника обновлены.');
    }

    public function updateDivisionsByDirectory(Request $request): RedirectResponse
    {
        $this->abortUnlessAdminRole($request);

        $data = $request->validate([
            'division_ids' => ['nullable', 'array'],
            'division_ids.*' => ['integer', 'exists:kpi_structural_units,id'],
            'login' => ['nullable', 'string', 'max:255', 'required_without:email'],
            'email' => ['nullable', 'email', 'max:255', 'required_without:login'],
            'display_name' => ['nullable', 'string', 'max:190'],
            'employee_type' => ['nullable', 'string', 'max:120'],
        ]);

        $login = Str::lower(trim((string) ($data['login'] ?? '')));
        $email = Str::lower(trim((string) ($data['email'] ?? '')));
        $displayName = trim((string) ($data['display_name'] ?? ''));

        $user = User::query()
            ->where(function (Builder $query) use ($login, $email): void {
                if ($login !== '') {
                    $query->whereRaw('LOWER(ad_login) = ?', [$login]);
                }

                if ($email !== '') {
                    $query->orWhereRaw('LOWER(email) = ?', [$email]);
                }
            })
            ->first();

        if (! $user) {
            $name = $displayName !== '' ? $displayName : ($login !== '' ? $login : 'AD User');
            $baseEmail = $email !== ''
                ? $email
                : (($login !== '' ? $login : 'ad-user') . '@ad.local');
            $uniqueEmail = $baseEmail;
            $suffix = 1;

            while (User::query()->whereRaw('LOWER(email) = ?', [Str::lower($uniqueEmail)])->exists()) {
                $uniqueEmail = preg_replace('/@/', '+' . $suffix . '@', $baseEmail, 1) ?: ($baseEmail . '+' . $suffix);
                $suffix++;
            }

            $user = User::query()->create([
                'name' => $name,
                'display_name' => $displayName !== '' ? $displayName : $name,
                'email' => $uniqueEmail,
                'ad_login' => $login !== '' ? $login : null,
                'ad_employee_type' => trim((string) ($data['employee_type'] ?? '')) ?: null,
                'password' => Hash::make('12345678'),
            ]);
        }

        $user->kpiStructuralUnits()->sync($data['division_ids'] ?? []);

        return back()->with('success', 'Подразделения сотрудника обновлены.');
    }

    public function updateRole(Request $request, User $user): RedirectResponse
    {
        $this->abortUnlessAdminRole($request);

        $data = $request->validate([
            'role_id' => ['nullable', 'integer', 'exists:roles,id', 'required_without:role'],
            'role' => ['nullable', 'string', 'required_without:role_id'],
            'structural_access' => ['nullable', 'boolean'],
            'structural_division_id' => ['nullable', 'integer', 'exists:divisions,id', Rule::requiredIf(fn () => $request->boolean('structural_access'))],
        ]);

        $resolved = $this->resolveRoleForUpdate($data['role'] ?? null, $data['role_id'] ?? null);

        if ($resolved === null) {
            return back()->with('error', 'Не удалось определить роль для сохранения.');
        }

        $user->update($resolved);

        if (! empty($data['structural_access'])) {
            $divisionId = (int) ($data['structural_division_id'] ?? 0);
            $this->syncStructuralAccessGrant($user, $divisionId, (int) $request->user()->id);
        }

        return back()->with('success', 'Роль сотрудника обновлена.');
    }

    public function updateRoleByDirectory(Request $request): RedirectResponse
    {
        $this->abortUnlessAdminRole($request);

        $data = $request->validate([
            'role_id' => ['nullable', 'integer', 'exists:roles,id', 'required_without:role'],
            'role' => ['nullable', 'string', 'required_without:role_id'],
            'structural_access' => ['nullable', 'boolean'],
            'structural_division_id' => ['nullable', 'integer', 'exists:divisions,id', Rule::requiredIf(fn () => $request->boolean('structural_access'))],
            'login' => ['nullable', 'string', 'max:255', 'required_without:email'],
            'email' => ['nullable', 'email', 'max:255', 'required_without:login'],
            'display_name' => ['nullable', 'string', 'max:190'],
            'employee_type' => ['nullable', 'string', 'max:120'],
        ]);

        $login = Str::lower(trim((string) ($data['login'] ?? '')));
        $email = Str::lower(trim((string) ($data['email'] ?? '')));
        $displayName = trim((string) ($data['display_name'] ?? ''));

        $user = User::query()
            ->where(function (Builder $query) use ($login, $email): void {
                if ($login !== '') {
                    $query->whereRaw('LOWER(ad_login) = ?', [$login]);
                }

                if ($email !== '') {
                    $query->orWhereRaw('LOWER(email) = ?', [$email]);
                }
            })
            ->first();

        if (! $user) {
            $name = $displayName !== '' ? $displayName : ($login !== '' ? $login : 'AD User');
            $baseEmail = $email !== ''
                ? $email
                : (($login !== '' ? $login : 'ad-user') . '@ad.local');
            $uniqueEmail = $baseEmail;
            $suffix = 1;

            while (User::query()->whereRaw('LOWER(email) = ?', [Str::lower($uniqueEmail)])->exists()) {
                $uniqueEmail = preg_replace('/@/', '+' . $suffix . '@', $baseEmail, 1) ?: ($baseEmail . '+' . $suffix);
                $suffix++;
            }

            $user = User::query()->create([
                'name' => $name,
                'display_name' => $displayName !== '' ? $displayName : $name,
                'email' => $uniqueEmail,
                'ad_login' => $login !== '' ? $login : null,
                'ad_employee_type' => trim((string) ($data['employee_type'] ?? '')) ?: null,
                'password' => Hash::make('12345678'),
            ]);
        }

        $resolved = $this->resolveRoleForUpdate($data['role'] ?? null, $data['role_id'] ?? null);

        if ($resolved === null) {
            return back()->with('error', 'Не удалось определить роль для сохранения.');
        }

        $user->update($resolved);

        if (! empty($data['structural_access'])) {
            $divisionId = (int) ($data['structural_division_id'] ?? 0);
            $this->syncStructuralAccessGrant($user, $divisionId, (int) $request->user()->id);
        }

        return back()->with('success', 'Роль сотрудника обновлена.');
    }

    public function storeManual(Request $request): RedirectResponse
    {
        $allowedRoles = ['teacher', 'student', 'department_head', 'dean', 'structural'];

        $data = $request->validate([
            'name' => ['required', 'string', 'max:190'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'login' => ['nullable', 'string', 'max:255', 'unique:users,ad_login'],
            'directory_type' => ['required', 'in:staff,students'],
            'position_id' => ['nullable', 'integer', 'exists:positions,id'],
            'role' => ['nullable', 'string', 'in:' . implode(',', $allowedRoles)],
            'password' => ['nullable', 'string', 'min:6', 'max:128'],
        ]);

        $directoryType = (string) $data['directory_type'];
        $position = null;

        if (! empty($data['position_id'])) {
            $position = Position::query()->with('division:id,name')->find((int) $data['position_id']);
        }

        $defaultRole = $directoryType === 'students' ? 'student' : 'teacher';
        $roleSlug = (! empty($data['role']) && $directoryType === 'staff')
            ? $data['role']
            : $defaultRole;

        $roleId = Role::query()->where('slug', $roleSlug)->value('id');

        $password = ! empty($data['password'])
            ? Hash::make($data['password'])
            : Hash::make('12345678');

        User::query()->create([
            'name' => trim((string) $data['name']),
            'display_name' => trim((string) $data['name']),
            'email' => Str::lower(trim((string) $data['email'])),
            'ad_login' => ($data['login'] ?? null) !== null
                ? Str::lower(trim((string) $data['login']))
                : null,
            'role' => $roleSlug,
            'role_id' => $roleId,
            'position_id' => $position?->id,
            'ad_employee_type' => $directoryType === 'students' ? 'student' : 'staff',
            'ad_title' => $position?->name,
            'ad_division' => $position?->division?->name,
            'ad_department' => $position?->division?->name,
            'password' => $password,
        ]);

        return back()->with('success', 'Пользователь добавлен вручную.');
    }

    public function updateBinding(Request $request, User $user): RedirectResponse
    {
        $this->abortUnlessAdminRole($request);

        $data = $request->validate([
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'faculty_id' => ['nullable', 'integer', 'exists:faculties,id'],
        ]);

        $user->update([
            'department_id' => $data['department_id'] ?? null,
            'faculty_id' => $data['faculty_id'] ?? null,
        ]);

        return back()->with('success', 'Привязка кафедры/факультета обновлена.');
    }

    private function abortUnlessAdminRole(Request $request): void
    {
        $role = $request->user()?->resolvedRoleSlug();

        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403);
    }

    private function applyCommonFilters(Builder $query, array $filters): void
    {
        if ($filters['q'] !== '') {
            $search = $filters['q'];
            $query->where(function (Builder $nested) use ($search): void {
                $nested
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('display_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('ad_login', 'like', "%{$search}%")
                    ->orWhere('ad_title', 'like', "%{$search}%")
                    ->orWhere('ad_department', 'like', "%{$search}%");
            });
        }

        if ($filters['faculty_id'] !== '') {
            $query->where('faculty_id', (int) $filters['faculty_id']);
        }

        if ($filters['department_id'] !== '') {
            $query->where('department_id', (int) $filters['department_id']);
        }

        if ($filters['synced'] === 'ad') {
            $query->whereNotNull('ad_login')->where('ad_login', '<>', '');
        }

        if ($filters['synced'] === 'local') {
            $query->where(function (Builder $nested): void {
                $nested->whereNull('ad_login')->orWhere('ad_login', '');
            });
        }

        if ($filters['last_login_range'] === '30') {
            $query->where('last_login_at', '>=', now()->subDays(30));
        }

        if ($filters['last_login_range'] === '90') {
            $query->where('last_login_at', '>=', now()->subDays(90));
        }

        if ($filters['last_login_range'] === 'never') {
            $query->whereNull('last_login_at');
        }
    }

    private function applyTabFilter(Builder $query, string $tab): void
    {
        $normalizedTab = Str::lower(trim($tab));

        match ($normalizedTab) {
            'teacher' => $this->applyRoleScope($query, ['teacher']),
            'hod' => $this->applyRoleScope($query, ['hod', 'department_head']),
            'dean' => $this->applyRoleScope($query, ['dean']),
            'structural' => $query->where(function (Builder $nested): void {
                $nested
                    ->whereHas('kpiStructuralUnits')
                    ->orWhereHas('kpiAccessGrants', function (Builder $grantQuery): void {
                        $grantQuery
                            ->where('permission', KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
                            ->where('is_active', true);
                    });
            }),
            'test_users' => $query->whereRaw('LOWER(email) LIKE ?', ['test\\_%']),
            default => null,
        };
    }

    private function countByTab(Builder $query, string $tab): int
    {
        $this->applyTabFilter($query, $tab);

        return $query->count();
    }

    private function applySort(Builder $query, array $filters, string $directoryType): void
    {
        $sortBy = $filters['sort_by'];
        $sortDir = Str::lower($filters['sort_dir']) === 'asc' ? 'asc' : 'desc';

        if ($sortBy !== '') {
            switch ($sortBy) {
                case 'name':
                    $query->orderBy('name', $sortDir);
                    return;
                case 'last_login':
                    $query->orderByRaw('last_login_at IS NULL')
                        ->orderBy('last_login_at', $sortDir)
                        ->orderBy('name');
                    return;
                case 'created_at':
                    $query->orderBy('created_at', $sortDir);
                    return;
                case 'login_count':
                    $query->orderBy('login_count', $sortDir)->orderBy('name');
                    return;
                case 'role':
                    $query->orderBy('role', $sortDir)->orderBy('name');
                    return;
                case 'synced':
                    $query->orderByRaw("CASE WHEN ad_login IS NULL OR ad_login = '' THEN 1 ELSE 0 END {$sortDir}")
                        ->orderBy('name');
                    return;
                default:
                    break;
            }
        }

        if ($directoryType === 'students') {
            $query->orderBy('name');
            return;
        }

        $tab = Str::lower(trim((string) $filters['tab']));

        if ($tab === 'teacher') {
            $query->orderBy('name');
            return;
        }

        if ($tab === 'hod') {
            $query->orderByRaw('department_id IS NULL')->orderBy('department_id')->orderBy('name');
            return;
        }

        if ($tab === 'dean') {
            $query->orderByRaw('faculty_id IS NULL')->orderBy('faculty_id')->orderBy('name');
            return;
        }

        if ($tab === 'structural') {
            $query->orderByRaw('COALESCE(ad_division, ad_department, name)');
            return;
        }

        $query->orderBy('created_at', 'desc');
    }

    private function applyRoleScope(Builder $query, array $slugs): void
    {
        $normalized = collect($slugs)
            ->map(fn ($slug) => Str::lower(trim((string) $slug)))
            ->filter()
            ->values()
            ->all();

        if ($normalized === []) {
            return;
        }

        $query->where(function (Builder $nested) use ($normalized): void {
            $nested
                ->whereIn('role', $normalized)
                ->orWhereHas('roleRef', function (Builder $roleQuery) use ($normalized): void {
                    $roleQuery->whereIn('slug', $normalized);
                });
        });
    }

    /**
     * @param array<string, mixed> $directoryUser
     * @param array<int, array<int, int>> $structuralAccessByUser
     */
    private function mapDirectoryRow(array $directoryUser, ?User $localUser, array $structuralAccessByUser = []): array
    {
        $login = trim((string) ($directoryUser['login'] ?? ''));
        $email = trim((string) ($directoryUser['email'] ?? ''));
        $guid = trim((string) ($directoryUser['guid'] ?? ''));
        $displayName = trim((string) ($directoryUser['display_name'] ?? ''));

        $roleSlug = $localUser
            ? $this->resolveMergedRoleForLocalUser($localUser)
            : ($this->isStudentTitleOrEntry($directoryUser) ? 'student' : null);

        $structuralAccessDivisionIds = $localUser
            ? ($structuralAccessByUser[$localUser->id] ?? [])
            : [];

        return [
            'id' => $localUser?->id ?? ('ad:' . ($login !== '' ? $login : ($email !== '' ? $email : md5($displayName)))),
            'local_user_id' => $localUser?->id,
            'name' => $localUser?->name ?? ($displayName !== '' ? $displayName : ($login !== '' ? $login : 'AD User')),
            'display_name' => $localUser?->display_name
                ?: ($displayName !== '' ? $displayName : ($localUser?->name ?? ($login !== '' ? $login : 'AD User'))),
            'email' => $localUser?->email ?? ($email !== '' ? $email : null),
            'login' => $localUser?->ad_login ?? ($login !== '' ? $login : null),
            'guid' => $localUser?->ad_guid ?? ($guid !== '' ? $guid : null),
            'role_slug' => $roleSlug,
            'role_label' => $this->resolveRoleLabelBySlug($roleSlug),
            'position_id' => $localUser?->position_id,
            'position_name' => $localUser?->position?->name,
            'title' => $localUser?->ad_title ?? ($directoryUser['title'] ?? null),
            'department_id' => $localUser?->department_id,
            'department_name' => $localUser?->department?->name,
            'faculty_id' => $localUser?->faculty_id,
            'faculty_name' => $localUser?->faculty?->name ?? $localUser?->department?->faculty?->name,
            'ad_department' => $localUser?->ad_department ?? ($directoryUser['department'] ?? null),
            'ad_division' => $localUser?->ad_division ?? ($directoryUser['division'] ?? null),
            'divisions' => $localUser
                ? $localUser->kpiStructuralUnits->map(fn (KpiStructuralUnit $division): array => [
                    'id' => $division->id,
                    'name' => $division->name,
                    'code' => $division->code,
                ])->values()->all()
                : [],
            'structural_access_division_ids' => $structuralAccessDivisionIds,
            'has_structural_access' => $structuralAccessDivisionIds !== [],
            'last_login_at' => $localUser?->last_login_at?->toIso8601String(),
            'last_login_exact' => $localUser?->last_login_at?->toIso8601String(),
            'last_login_human' => $this->formatLastLoginLabel($localUser?->last_login_at?->toIso8601String()),
            'login_count' => (int) ($localUser?->login_count ?? 0),
            'created_at' => $localUser?->created_at?->toIso8601String(),
            'is_synced' => $localUser instanceof User,
            'can_edit' => $localUser instanceof User,
            'can_change_role' => $localUser instanceof User,
            'display_faculty' => $localUser?->faculty?->name ?? $localUser?->department?->faculty?->name ?? null,
            'display_department' => $localUser?->department?->name ?? $localUser?->ad_department ?? null,
            'display_divisions' => $localUser
                ? $localUser->kpiStructuralUnits->map(fn (KpiStructuralUnit $division): string => $division->code ?: $division->name)->values()->all()
                : [],
            'binding_status' => $this->resolveBindingStatus($localUser),
            'binding_label' => $this->resolveBindingLabel($localUser),
            'is_binding_missing' => $this->isBindingMissing($localUser),
        ];
    }

    /**
     * @param array<int, array<int, int>> $structuralAccessByUser
     */
    private function mapLocalOnlyRow(User $user, array $structuralAccessByUser = []): array
    {
        $roleSlug = $this->resolveMergedRoleForLocalUser($user);
        $structuralAccessDivisionIds = $structuralAccessByUser[$user->id] ?? [];

        return [
            'id' => $user->id,
            'local_user_id' => $user->id,
            'name' => $user->name,
            'display_name' => $user->display_name ?: $user->name,
            'email' => $user->email,
            'login' => $user->ad_login,
            'guid' => $user->ad_guid,
            'role_slug' => $roleSlug,
            'role_label' => $this->resolveRoleLabelBySlug($roleSlug),
            'position_id' => $user->position_id,
            'position_name' => $user->position?->name,
            'title' => $user->ad_title,
            'department_id' => $user->department_id,
            'department_name' => $user->department?->name,
            'faculty_id' => $user->faculty_id,
            'faculty_name' => $user->faculty?->name ?? $user->department?->faculty?->name,
            'ad_department' => $user->ad_department,
            'ad_division' => $user->ad_division,
            'divisions' => $user->kpiStructuralUnits->map(fn (KpiStructuralUnit $division): array => [
                'id' => $division->id,
                'name' => $division->name,
                'code' => $division->code,
            ])->values()->all(),
            'structural_access_division_ids' => $structuralAccessDivisionIds,
            'has_structural_access' => $structuralAccessDivisionIds !== [],
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'last_login_exact' => $user->last_login_at?->toIso8601String(),
            'last_login_human' => $this->formatLastLoginLabel($user->last_login_at?->toIso8601String()),
            'login_count' => (int) ($user->login_count ?? 0),
            'created_at' => $user->created_at?->toIso8601String(),
            'is_synced' => false,
            'can_edit' => true,
            'can_change_role' => true,
            'display_faculty' => $user->faculty?->name ?? $user->department?->faculty?->name ?? null,
            'display_department' => $user->department?->name ?? $user->ad_department ?? null,
            'display_divisions' => $user->kpiStructuralUnits->map(fn (KpiStructuralUnit $division): string => $division->code ?: $division->name)->values()->all(),
            'binding_status' => $this->resolveBindingStatus($user),
            'binding_label' => $this->resolveBindingLabel($user),
            'is_binding_missing' => $this->isBindingMissing($user),
        ];
    }

    private function applyCommonFiltersToRows(Collection $rows, array $filters): Collection
    {
        return $rows->filter(function (array $row) use ($filters): bool {
            if ($filters['q'] !== '') {
                $search = Str::lower($filters['q']);
                $haystack = Str::lower(implode(' ', array_filter([
                    (string) ($row['name'] ?? ''),
                    (string) ($row['display_name'] ?? ''),
                    (string) ($row['email'] ?? ''),
                    (string) ($row['login'] ?? ''),
                    (string) ($row['title'] ?? ''),
                    (string) ($row['ad_department'] ?? ''),
                    (string) ($row['ad_division'] ?? ''),
                ])));

                if (! Str::contains($haystack, $search)) {
                    return false;
                }
            }

            if ($filters['faculty_id'] !== '' && (int) ($row['faculty_id'] ?? 0) !== (int) $filters['faculty_id']) {
                return false;
            }

            if ($filters['department_id'] !== '' && (int) ($row['department_id'] ?? 0) !== (int) $filters['department_id']) {
                return false;
            }

            if ($filters['synced'] === 'ad' && ! ($row['is_synced'] ?? false)) {
                return false;
            }

            if ($filters['synced'] === 'local' && ($row['is_synced'] ?? false)) {
                return false;
            }

            $lastLogin = $row['last_login_at'] ?? null;

            if ($filters['last_login_range'] === '30') {
                return $lastLogin !== null && strtotime((string) $lastLogin) >= now()->subDays(30)->getTimestamp();
            }

            if ($filters['last_login_range'] === '90') {
                return $lastLogin !== null && strtotime((string) $lastLogin) >= now()->subDays(90)->getTimestamp();
            }

            if ($filters['last_login_range'] === 'never') {
                return $lastLogin === null;
            }

            return true;
        });
    }

    private function resolveRowRoleSlug(array $row, string $directoryType = 'staff'): string
    {
        $role = Str::lower(trim((string) ($row['role_slug'] ?? '')));
        if ($role !== '') {
            return $role;
        }

        return $directoryType === 'students' ? 'student' : 'teacher';
    }

    private function applyTabFilterToRows(Collection $rows, string $tab, string $directoryType = 'staff'): Collection
    {
        $normalizedTab = Str::lower(trim($tab));

        return $rows->filter(function (array $row) use ($normalizedTab, $directoryType): bool {
            if ($directoryType === 'students') {
                $category = $this->resolveStudentCategory($row);

                return match ($normalizedTab) {
                    'bachelor' => $category === 'bachelor',
                    'master' => $category === 'master',
                    default => true,
                };
            }

            $isTestUser = $this->isTestUserRow($row);
            if ($isTestUser) {
                return $normalizedTab === 'test_users';
            }

            $role = $this->resolveRowRoleSlug($row, $directoryType);

            return match ($normalizedTab) {
                'teacher' => $role === 'teacher',
                'hod' => in_array($role, ['hod', 'department_head'], true),
                'dean' => $role === 'dean',
                'structural' => $this->isStructuralRow($row),
                'test_users' => $this->isTestUserRow($row),
                default => true,
            };
        });
    }

    private function countRowsByTab(Collection $rows, string $tab, string $directoryType = 'staff'): int
    {
        return $this->applyTabFilterToRows($rows, $tab, $directoryType)->count();
    }

    private function applySortToRows(Collection $rows, array $filters, string $directoryType): Collection
    {
        $sortBy = $filters['sort_by'];
        $sortDir = Str::lower($filters['sort_dir']) === 'asc' ? 'asc' : 'desc';

        $sorted = $rows->sort(function (array $a, array $b) use ($sortBy, $sortDir, $filters, $directoryType): int {
            $direction = $sortDir === 'asc' ? 1 : -1;

            $cmpText = static function (?string $left, ?string $right) use ($direction): int {
                return $direction * strcmp(Str::lower((string) $left), Str::lower((string) $right));
            };

            $cmpNum = static function ($left, $right) use ($direction): int {
                return $direction * (($left <=> $right));
            };

            if ($sortBy !== '') {
                return match ($sortBy) {
                    'name' => $cmpText((string) ($a['display_name'] ?? $a['name'] ?? ''), (string) ($b['display_name'] ?? $b['name'] ?? '')),
                    'last_login' => $cmpNum(strtotime((string) ($a['last_login_at'] ?? '1970-01-01')), strtotime((string) ($b['last_login_at'] ?? '1970-01-01'))),
                    'created_at' => $cmpNum(strtotime((string) ($a['created_at'] ?? '1970-01-01')), strtotime((string) ($b['created_at'] ?? '1970-01-01'))),
                    'login_count' => $cmpNum((int) ($a['login_count'] ?? 0), (int) ($b['login_count'] ?? 0)),
                    'role' => $cmpText($this->resolveRowRoleSlug($a, $directoryType), $this->resolveRowRoleSlug($b, $directoryType)),
                    'synced' => $cmpNum((int) ($a['is_synced'] ?? false), (int) ($b['is_synced'] ?? false)),
                    default => 0,
                };
            }

            if ($directoryType === 'students') {
                return $cmpText((string) ($a['display_name'] ?? ''), (string) ($b['display_name'] ?? ''));
            }

            $tab = Str::lower(trim((string) $filters['tab']));

            if ($tab === 'teacher') {
                return $cmpText((string) ($a['display_name'] ?? ''), (string) ($b['display_name'] ?? ''));
            }

            if ($tab === 'hod') {
                $depCompare = $cmpText((string) ($a['department_name'] ?? ''), (string) ($b['department_name'] ?? ''));
                if ($depCompare !== 0) {
                    return $depCompare;
                }

                return $cmpText((string) ($a['display_name'] ?? ''), (string) ($b['display_name'] ?? ''));
            }

            if ($tab === 'dean') {
                $facCompare = $cmpText((string) ($a['faculty_name'] ?? ''), (string) ($b['faculty_name'] ?? ''));
                if ($facCompare !== 0) {
                    return $facCompare;
                }

                return $cmpText((string) ($a['display_name'] ?? ''), (string) ($b['display_name'] ?? ''));
            }

            if ($tab === 'structural') {
                $leftDivision = (string) (($a['divisions'][0]['code'] ?? $a['divisions'][0]['name'] ?? $a['ad_division'] ?? $a['ad_department'] ?? ''));
                $rightDivision = (string) (($b['divisions'][0]['code'] ?? $b['divisions'][0]['name'] ?? $b['ad_division'] ?? $b['ad_department'] ?? ''));
                $divCompare = $cmpText($leftDivision, $rightDivision);
                if ($divCompare !== 0) {
                    return $divCompare;
                }

                return $cmpText((string) ($a['display_name'] ?? ''), (string) ($b['display_name'] ?? ''));
            }

            if ($tab === 'test_users') {
                $emailCompare = $cmpText((string) ($a['email'] ?? ''), (string) ($b['email'] ?? ''));
                if ($emailCompare !== 0) {
                    return $emailCompare;
                }

                return $cmpText((string) ($a['display_name'] ?? ''), (string) ($b['display_name'] ?? ''));
            }

            return $cmpNum(strtotime((string) ($b['created_at'] ?? '1970-01-01')), strtotime((string) ($a['created_at'] ?? '1970-01-01')));
        });

        return $sorted->values();
    }

    private function resolveMergedRoleForLocalUser(User $user): ?string
    {
        $normalizeRole = function (?string $value) use ($user): ?string {
            $normalized = Str::lower(trim((string) $value));

            if ($normalized === '') {
                return null;
            }

            return match ($normalized) {
                'department_head' => 'hod',
                'department' => 'teacher',
                'structural' => $this->hasStructuralAccess($user) ? 'structural' : 'teacher',
                default => in_array($normalized, ['hod', 'dean', 'teacher', 'student', 'admin', 'superadmin'], true)
                    ? $normalized
                    : 'teacher',
            };
        };

        $roleFromRelation = $normalizeRole($user->roleRef?->slug ?? null);
        if ($roleFromRelation !== null) {
            return $roleFromRelation;
        }

        $roleFromColumn = $normalizeRole($user->role ?? null);
        if ($roleFromColumn !== null) {
            return $roleFromColumn;
        }

        $roleId = (int) ($user->role_id ?? 0);
        if ($roleId > 0) {
            return match ($roleId) {
                1 => 'admin',
                2 => 'student',
                3 => 'teacher',
                4 => 'hod',
                5 => 'dean',
                6 => $this->hasStructuralAccess($user) ? 'structural' : 'teacher',
                default => 'teacher',
            };
        }

        return 'teacher';
    }

    private function hasStructuralAccess(User $user): bool
    {
        if ($user->relationLoaded('kpiStructuralUnits') && $user->kpiStructuralUnits->isNotEmpty()) {
            return true;
        }

        if ($user->relationLoaded('kpiAccessGrants')) {
            return $user->kpiAccessGrants
                ->contains(fn (KpiAccessGrant $grant): bool => $grant->permission === KpiAccessGrant::PERM_STRUCTURAL_QUEUE && (bool) $grant->is_active);
        }

        return $user->kpiStructuralUnits()->exists()
            || $user->kpiAccessGrants()
                ->where('permission', KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
                ->where('is_active', true)
                ->exists();
    }

    /**
     * @param array<string, mixed> $row
     */
    private function isStructuralRow(array $row): bool
    {
        $divisions = $row['divisions'] ?? [];
        return is_array($divisions) && count($divisions) > 0;
    }

    /**
     * @param array<string, mixed> $row
     */
    private function isTestUserRow(array $row): bool
    {
        $email = Str::lower(trim((string) ($row['email'] ?? '')));

        return $email !== '' && Str::startsWith($email, 'test_');
    }

    private function hasCanonicalStructuralDivision(string $value): bool
    {
        $needle = Str::lower(trim($value));
        if ($needle === '') {
            return false;
        }

        $aliases = [
            'омоиам', 'международного образования', 'академической мобильности',
            'ориа', 'рейтингов и аккредитации',
            'умифк', 'маркетинга и формирование контингента',
            'уоп', 'образовательных программ',
            'унивс', 'науки и внешних связей',
            'цк', 'центр компетенции',
            'центр карьеры',
            'оуп', 'управления персоналом',
            'ор', 'офис регистратора',
            'уокиа', 'обеспечения качества и аккредитации',
            'виср', 'воспитательная и социальная работа',
            'эндаумент',
        ];

        foreach ($aliases as $alias) {
            if (Str::contains($needle, $alias)) {
                return true;
            }
        }

        return false;
    }

    private function resolveRoleLabelBySlug(?string $roleSlug): string
    {
        return match (Str::lower(trim((string) $roleSlug))) {
            'admin', 'superadmin' => 'Администратор',
            'teacher' => 'Преподаватель',
            'hod', 'department_head' => 'Завед. кафедрой',
            'dean' => 'Декан',
            'department', 'structural' => 'Структурное подразделение',
            'student' => 'Студент',
            default => 'Без роли',
        };
    }

    private function resolveBindingStatus(?User $user): string
    {
        if (! $user instanceof User) {
            return 'missing';
        }

        $role = $this->resolveMergedRoleForLocalUser($user);

        if ($role === 'hod') {
            return ($user->department_id || $user->department?->name) ? 'bound' : 'missing';
        }

        if ($role === 'dean') {
            return ($user->faculty_id || $user->faculty?->name) ? 'bound' : 'missing';
        }

        if ($role === 'structural') {
            return ($user->kpiStructuralUnits?->count() ?? 0) > 0 ? 'bound' : 'missing';
        }

        if (($user->kpiStructuralUnits?->count() ?? 0) > 0) {
            return 'bound';
        }

        return ($user->faculty_id || $user->department_id || trim((string) $user->ad_department) !== '') ? 'bound' : 'missing';
    }

    private function resolveBindingLabel(?User $user): string
    {
        return $this->resolveBindingStatus($user) === 'bound' ? 'Привязан' : '⚠ Не привязан';
    }

    private function isBindingMissing(?User $user): bool
    {
        return $this->resolveBindingStatus($user) !== 'bound';
    }

    private function formatLastLoginLabel(?string $value): string
    {
        if (! $value) {
            return 'Никогда';
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return 'Никогда';
        }

        $diffSeconds = now()->timestamp - $timestamp;
        if ($diffSeconds < 0) {
            $diffSeconds = 0;
        }

        if ($diffSeconds < 3600) {
            $minutes = max(1, (int) floor($diffSeconds / 60));
            return $minutes . ' мин назад';
        }

        if ($diffSeconds < 86400) {
            return 'Сегодня, ' . date('H:i', $timestamp);
        }

        if ($diffSeconds < 7 * 86400) {
            $days = max(1, (int) floor($diffSeconds / 86400));
            return $days . ' дн. назад';
        }

        return date('d.m.Y', $timestamp);
    }

    private function isStudentTitleOrEntry(array $row): bool
    {
        $title = Str::lower(trim((string) ($row['title'] ?? '')));
        $employeeType = Str::lower(trim((string) ($row['employee_type'] ?? '')));
        $dn = Str::lower(trim((string) ($row['dn'] ?? '')));

        if (Str::contains($dn, 'ou=student')) {
            return true;
        }

        if (Str::contains($employeeType, 'student') || Str::contains($employeeType, 'студ')) {
            return true;
        }

        return $title === 'бакалавр'
            || Str::startsWith($title, 'бакалавр ')
            || $title === 'магистрант'
            || Str::startsWith($title, 'магистрант ')
            || $title === 'магистр'
            || Str::startsWith($title, 'магистр ')
            || $title === 'магистрант научно-педагогического направления'
            || Str::startsWith($title, 'phd студент')
            || Str::startsWith($title, 'докторант');
    }

    private function resolveStudentCategory(array $row): string
    {
        $title = Str::lower(trim((string) ($row['title'] ?? '')));

        if (Str::contains($title, 'бакалавр')) {
            return 'bachelor';
        }

        if (Str::contains($title, 'магист') || Str::contains($title, 'phd') || Str::contains($title, 'докторант')) {
            return 'master';
        }

        return 'all';
    }

    private function resolveRoleForUpdate(?string $role, mixed $roleId): ?array
    {
        $resolvedRoleId = null;
        $resolvedSlug = null;

        if ($roleId !== null && $roleId !== '') {
            $resolvedRoleId = (int) $roleId;
            $resolvedSlug = Role::query()->where('id', $resolvedRoleId)->value('slug');
        }

        if ($resolvedSlug === null && $role !== null && trim($role) !== '') {
            $resolvedSlug = $this->mapRoleInputToSlug($role);
            $resolvedRoleId = $resolvedSlug !== null ? $this->resolveAssignableRoleId($resolvedSlug) : null;
        }

        if ($resolvedSlug === null) {
            return null;
        }

        return [
            'role' => $resolvedSlug,
            'role_id' => $resolvedRoleId,
        ];
    }

    private function mapRoleInputToSlug(string $input): ?string
    {
        $normalized = Str::lower(trim($input));

        return match ($normalized) {
            'teacher', 'преподаватель' => 'teacher',
            'hod', 'department_head', 'заведующий кафедрой', 'завед. кафедрой', 'завед. кафедра', 'зав. кафедрой' => 'hod',
            'dean', 'декан' => 'dean',
            'structural', 'department', 'структурное подразделение' => 'structural',
            'admin', 'администратор' => 'admin',
            'student', 'студент' => 'student',
            default => null,
        };
    }

    private function resolveAssignableRoleId(string $roleSlug): ?int
    {
        $normalized = Str::lower(trim($roleSlug));

        if ($normalized === 'hod') {
            $id = Role::query()->where('slug', 'hod')->value('id');
            if ($id) {
                return (int) $id;
            }

            $fallback = Role::query()->where('slug', 'department_head')->value('id');
            return $fallback ? (int) $fallback : null;
        }

        if ($normalized === 'structural') {
            $id = Role::query()->where('slug', 'structural')->value('id');
            if ($id) {
                return (int) $id;
            }

            $fallback = Role::query()->where('slug', 'department')->value('id');
            return $fallback ? (int) $fallback : null;
        }

        $id = Role::query()->where('slug', $normalized)->value('id');
        return $id ? (int) $id : null;
    }

    private function syncStructuralAccessGrant(User $user, int $divisionId, int $grantedBy): void
    {
        KpiAccessGrant::query()
            ->where('user_id', $user->id)
            ->where('permission', KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
            ->where('division_id', '!=', $divisionId)
            ->update(['is_active' => false]);

        KpiAccessGrant::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'permission' => KpiAccessGrant::PERM_STRUCTURAL_QUEUE,
                'division_id' => $divisionId,
            ],
            [
                'granted_by' => $grantedBy,
                'granted_at' => now(),
                'is_active' => true,
            ]
        );
    }
}
