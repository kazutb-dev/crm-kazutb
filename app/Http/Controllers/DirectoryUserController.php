<?php

namespace App\Http\Controllers;

use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use App\Services\ActiveDirectoryAuthenticator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class DirectoryUserController extends Controller
{
    public function index(Request $request, ActiveDirectoryAuthenticator $adAuthenticator): Response
    {
        $directoryType = $request->routeIs('users.students') ? 'students' : 'staff';
        $search = trim((string) $request->query('q', ''));
        $users = $adAuthenticator->listDirectoryUsers($search);

        $localDirectoryUsers = User::query()
            ->with('roleRef:id,name,slug')
            ->select([
                'id',
                'name',
                'display_name',
                'ad_login',
                'email',
                'role_id',
                'ad_department',
                'ad_department_number',
                'ad_division',
                'ad_employee_type',
                'ad_title',
            ])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($nested) use ($search): void {
                    $nested
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('display_name', 'like', "%{$search}%")
                        ->orWhere('ad_login', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->get();

        $localUsersByLogin = $localDirectoryUsers
            ->filter(fn (User $user) => trim((string) $user->ad_login) !== '')
            ->keyBy(fn (User $user) => Str::lower(trim((string) $user->ad_login)));

        $localUsersByEmail = $localDirectoryUsers
            ->filter(fn (User $user) => trim((string) $user->email) !== '')
            ->keyBy(fn (User $user) => Str::lower(trim((string) $user->email)));

        $syncedLogins = $localDirectoryUsers
            ->pluck('ad_login')
            ->filter()
            ->map(fn ($value) => Str::lower(trim((string) $value)))
            ->unique();

        $syncedEmails = $localDirectoryUsers
            ->pluck('email')
            ->filter()
            ->map(fn ($value) => Str::lower(trim((string) $value)))
            ->unique();

        $adUsers = collect();

        if (is_array($users) && $users !== []) {
            $adUsers = collect($users)
                ->map(function (array $user) use ($syncedLogins, $syncedEmails, $localUsersByLogin, $localUsersByEmail, $directoryType): array {
                    $login = Str::lower(trim((string) ($user['login'] ?? '')));
                    $email = Str::lower(trim((string) ($user['email'] ?? '')));

                    /** @var User|null $localUser */
                    $localUser = null;

                    if ($login !== '') {
                        $localUser = $localUsersByLogin->get($login);
                    }

                    if (!$localUser && $email !== '') {
                        $localUser = $localUsersByEmail->get($email);
                    }

                    $user['is_synced'] =
                        ($login !== '' && $syncedLogins->contains($login))
                        || ($email !== '' && $syncedEmails->contains($email));

                    $resolvedTitle = $localUser?->ad_title
                        ?? $user['title']
                        ?? null;
                    $normalizedTitle = Str::lower(trim((string) $resolvedTitle));
                    $isDeanTitle = Str::contains($normalizedTitle, 'декан')
                        || Str::contains($normalizedTitle, 'dean');

                    $user['ad_status'] = $user['status'] ?? null;
                    $user['status'] = $directoryType === 'staff'
                        ? ($isDeanTitle ? 'dean' : 'teacher')
                        : 'student';
                    $user['role_slug'] = $localUser?->roleRef?->slug;
                    $user['local_user_id'] = $localUser?->id;
                    $user['department'] = $localUser?->ad_department
                        ?? $user['department']
                        ?? null;
                    $user['department_number'] = $user['department_number']
                        ?? $localUser?->ad_department_number
                        ?? null;
                    $user['division'] = $localUser?->ad_division
                        ?? $user['division']
                        ?? null;
                    $user['employee_type'] = $user['employee_type']
                        ?? $localUser?->ad_employee_type
                        ?? null;
                    $user['title'] = $resolvedTitle;

                    if (! isset($user['display_name'])) {
                        $user['display_name'] = $localUser?->display_name
                            ?? $localUser?->name
                            ?? null;
                    }

                    return $user;
                })
                ->filter(function (array $user) use ($directoryType): bool {
                    $roleSlug = Str::lower(trim((string) ($user['role_slug'] ?? '')));
                    $employeeType = Str::lower(trim((string) ($user['employee_type'] ?? '')));
                    $adStatus = Str::lower(trim((string) ($user['ad_status'] ?? '')));
                    $dn = Str::lower(trim((string) ($user['dn'] ?? '')));

                    $isStudent = $roleSlug === 'student'
                        || Str::contains($employeeType, 'student')
                        || Str::contains($employeeType, 'студ')
                        || Str::contains($adStatus, 'student')
                        || Str::contains($adStatus, 'студ')
                        || Str::contains($dn, 'ou=students')
                        || Str::contains($dn, 'ou=student');

                    return $directoryType === 'students' ? $isStudent : ! $isStudent;
                })
                ->values();
        }

        $adIdentityKeys = $adUsers
            ->map(function (array $user): string {
                $login = Str::lower(trim((string) ($user['login'] ?? '')));

                if ($login !== '') {
                    return 'login:' . $login;
                }

                $email = Str::lower(trim((string) ($user['email'] ?? '')));

                return $email !== '' ? 'email:' . $email : '';
            })
            ->filter()
            ->values();

        $localOnlyUsers = $localDirectoryUsers
            ->map(function (User $user) use ($directoryType): array {
                $resolvedTitle = $user->ad_title;
                $normalizedTitle = Str::lower(trim((string) $resolvedTitle));
                $isDeanTitle = Str::contains($normalizedTitle, 'декан')
                    || Str::contains($normalizedTitle, 'dean');

                return [
                    'display_name' => $user->display_name ?: $user->name,
                    'login' => $user->ad_login,
                    'email' => $user->email,
                    'department' => $user->ad_department,
                    'department_number' => $user->ad_department_number,
                    'division' => $user->ad_division,
                    'employee_type' => $user->ad_employee_type,
                    'title' => $resolvedTitle,
                    'status' => $directoryType === 'staff'
                        ? ($isDeanTitle ? 'dean' : 'teacher')
                        : 'student',
                    'ad_status' => null,
                    'role_slug' => $user->roleRef?->slug,
                    'local_user_id' => $user->id,
                    'is_synced' => true,
                ];
            })
            ->filter(function (array $user) use ($directoryType): bool {
                $roleSlug = Str::lower(trim((string) ($user['role_slug'] ?? '')));
                $employeeType = Str::lower(trim((string) ($user['employee_type'] ?? '')));
                $adStatus = Str::lower(trim((string) ($user['ad_status'] ?? '')));
                $dn = Str::lower(trim((string) ($user['dn'] ?? '')));

                $isStudent = $roleSlug === 'student'
                    || Str::contains($employeeType, 'student')
                    || Str::contains($employeeType, 'студ')
                    || Str::contains($adStatus, 'student')
                    || Str::contains($adStatus, 'студ')
                    || Str::contains($dn, 'ou=students')
                    || Str::contains($dn, 'ou=student');

                return $directoryType === 'students' ? $isStudent : ! $isStudent;
            })
            ->filter(function (array $user) use ($adIdentityKeys): bool {
                $login = Str::lower(trim((string) ($user['login'] ?? '')));
                $key = $login !== ''
                    ? 'login:' . $login
                    : 'email:' . Str::lower(trim((string) ($user['email'] ?? '')));

                return $key !== '' && ! $adIdentityKeys->contains($key);
            })
            ->values();

        $users = $adUsers
            ->concat($localOnlyUsers)
            ->values()
            ->all();

        $pageTitle = $directoryType === 'students' ? 'Студенты' : 'Сотрудники';
        $searchRouteName = $directoryType === 'students' ? 'users.students' : 'users.index';

        return Inertia::render('Users/Index', [
            'users' => $users ?? [],
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
            'search' => $search,
            'adAvailable' => $users !== null,
            'pageTitle' => $pageTitle,
            'searchRouteName' => $searchRouteName,
            'directoryType' => $directoryType,
        ]);
    }

    public function updatePosition(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'position_id' => ['required', 'integer', 'exists:positions,id'],
        ]);

        $position = Position::query()
            ->with('division:id,name')
            ->findOrFail((int) $data['position_id']);

        $user->update([
            'ad_title' => $position->name,
            'ad_division' => $position->division?->name,
            'ad_department' => $position->division?->name,
        ]);

        return back()->with('success', 'Должность и отдел пользователя обновлены.');
    }

    public function updatePositionByDirectory(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'position_id' => ['required', 'integer', 'exists:positions,id'],
            'login' => ['nullable', 'string', 'max:255', 'required_without:email'],
            'email' => ['nullable', 'email', 'max:255', 'required_without:login'],
            'display_name' => ['nullable', 'string', 'max:190'],
            'employee_type' => ['nullable', 'string', 'max:120'],
        ]);

        $login = Str::lower(trim((string) ($data['login'] ?? '')));
        $email = Str::lower(trim((string) ($data['email'] ?? '')));
        $displayName = trim((string) ($data['display_name'] ?? ''));

        $user = User::query()
            ->where(function ($query) use ($login, $email): void {
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

        $position = Position::query()
            ->with('division:id,name')
            ->findOrFail((int) $data['position_id']);

        $user->update([
            'ad_title' => $position->name,
            'ad_division' => $position->division?->name,
            'ad_department' => $position->division?->name,
        ]);

        return back()->with('success', 'Должность и отдел пользователя обновлены.');
    }

    public function storeManual(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:190'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'login' => ['nullable', 'string', 'max:255', 'unique:users,ad_login'],
            'directory_type' => ['required', 'in:staff,students'],
            'position_id' => ['nullable', 'integer', 'exists:positions,id'],
        ]);

        $directoryType = (string) $data['directory_type'];
        $position = null;

        if (! empty($data['position_id'])) {
            $position = Position::query()
                ->with('division:id,name')
                ->find((int) $data['position_id']);
        }

        $roleSlug = $directoryType === 'students' ? 'student' : 'teacher';
        $roleId = Role::query()->where('slug', $roleSlug)->value('id');

        User::query()->create([
            'name' => trim((string) $data['name']),
            'display_name' => trim((string) $data['name']),
            'email' => Str::lower(trim((string) $data['email'])),
            'ad_login' => ($data['login'] ?? null) !== null
                ? Str::lower(trim((string) $data['login']))
                : null,
            'role' => $roleSlug,
            'role_id' => $roleId,
            'ad_employee_type' => $directoryType === 'students' ? 'student' : 'staff',
            'ad_title' => $position?->name,
            'ad_division' => $position?->division?->name,
            'ad_department' => $position?->division?->name,
            'password' => Hash::make('12345678'),
        ]);

        return back()->with('success', 'Пользователь добавлен вручную.');
    }
}
