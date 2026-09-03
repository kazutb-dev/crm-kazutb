<?php

namespace App\Http\Controllers;

use App\Models\PhonebookDepartment;
use App\Models\PhonebookUser;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class PhonebookDirectoryController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = [
            'search' => trim((string) $request->string('search', '')->value()),
            'department_id' => trim((string) $request->string('department_id', '')->value()),
        ];

        $query = PhonebookUser::query()
            ->with('department')
            ->when($filters['search'] !== '', function ($builder) use ($filters): void {
                $search = $filters['search'];

                $builder->where(function ($where) use ($search): void {
                    $where->where('full_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('inner_phone', 'like', "%{$search}%")
                        ->orWhere('job_title', 'like', "%{$search}%")
                        ->orWhereHas('department', fn ($departmentQuery) => $departmentQuery->where('name', 'like', "%{$search}%"));
                });
            })
            ->when($filters['department_id'] !== '', function ($builder) use ($filters): void {
                $builder->where('department_id', (int) $filters['department_id']);
            })
            ->orderByRaw('CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END')
            ->orderBy('sort_order')
            ->orderBy('full_name');

        $rows = $query
            ->get()
            ->map(fn (PhonebookUser $user): array => [
                'id' => $user->id,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'inner_phone' => $user->inner_phone,
                'job_title' => $user->job_title,
                'status' => $user->status,
                'avatar_url' => $user->avatar_url,
                'office' => $user->office,
                'sort_order' => $user->sort_order,
                'department' => $user->department ? [
                    'id' => $user->department->id,
                    'name' => $user->department->name,
                ] : null,
            ]);

        $sectionsByKey = [];
        $sectionOrder = [];

        foreach ($rows as $row) {
            $departmentName = trim((string) ($row['department']['name'] ?? ''));
            $sectionName = $departmentName !== '' ? $departmentName : 'Без департамента';
            $sectionDepartmentId = $row['department']['id'] ?? null;
            $sectionKey = $sectionDepartmentId === null
                ? 'without-department'
                : 'department-' . (string) $sectionDepartmentId;

            if (! isset($sectionsByKey[$sectionKey])) {
                $sectionsByKey[$sectionKey] = [
                    'name' => $sectionName,
                    'department_id' => $sectionDepartmentId,
                    'items' => [],
                ];
                $sectionOrder[] = $sectionKey;
            }

            $sectionsByKey[$sectionKey]['items'][] = $row;
        }

        $sections = collect($sectionOrder)
            ->map(fn (string $key): array => $sectionsByKey[$key])
            ->values();

        $departments = PhonebookDepartment::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Phonebook/Index', [
            'sections' => $sections,
            'totalUsers' => $rows->count(),
            'departments' => $departments,
            'filters' => $filters,
        ]);
    }

    public function updateAvatar(Request $request, PhonebookUser $phonebookUser): RedirectResponse
    {
        $this->authorizeManage($request);

        $data = $request->validate([
            'avatar_url' => ['nullable', 'string', 'max:2000'],
        ]);

        $newAvatarUrl = $data['avatar_url'] !== null ? trim((string) $data['avatar_url']) : null;

        if ($newAvatarUrl !== $phonebookUser->avatar_url) {
            $this->deleteLocalAvatar($phonebookUser->avatar_url);
        }

        $phonebookUser->update([
            'avatar_url' => $newAvatarUrl,
        ]);

        return back()->with('success', 'Фото сотрудника обновлено.');
    }

    public function uploadAvatar(Request $request, PhonebookUser $phonebookUser): RedirectResponse
    {
        $this->authorizeManage($request);

        $data = $request->validate([
            'avatar' => ['required', 'image', 'max:4096'],
        ]);

        $this->deleteLocalAvatar($phonebookUser->avatar_url);

        $path = $data['avatar']->store('phonebook/avatars', 'public');

        $phonebookUser->update([
            'avatar_url' => Storage::url($path),
        ]);

        return back()->with('success', 'Фото сотрудника загружено.');
    }

    public function move(Request $request, PhonebookUser $phonebookUser): RedirectResponse
    {
        $this->authorizeManage($request);

        $data = $request->validate([
            'target_user_id' => ['nullable', 'integer', 'exists:phonebook_users,id'],
            'target_department_id' => ['nullable', 'integer', 'exists:phonebook_departments,id'],
        ]);

        $targetDepartmentId = array_key_exists('target_department_id', $data)
            ? $data['target_department_id']
            : $phonebookUser->department_id;

        $targetUser = null;

        if (array_key_exists('target_user_id', $data) && $data['target_user_id'] !== null) {
            $targetUser = PhonebookUser::query()->findOrFail((int) $data['target_user_id']);

            if (($targetUser->department_id ?? null) !== $targetDepartmentId) {
                return back()->withErrors([
                    'move' => 'Нельзя вставить сотрудника в другой департамент без корректной цели.',
                ]);
            }
        }

        DB::transaction(function () use ($phonebookUser, $targetDepartmentId, $targetUser): void {
            $sourceDepartmentId = $phonebookUser->department_id;
            $sourceBaseOrder = $this->resolveDepartmentBaseOrder($sourceDepartmentId, false);
            $targetBaseOrder = $sourceDepartmentId === $targetDepartmentId
                ? $sourceBaseOrder
                : $this->resolveDepartmentBaseOrder($targetDepartmentId, true);

            if ($sourceDepartmentId !== $targetDepartmentId) {
                $phonebookUser->update([
                    'department_id' => $targetDepartmentId,
                ]);
            }

            $movedUser = $phonebookUser->fresh();

            $targetUsers = $this->orderedDepartmentUsers($targetDepartmentId)
                ->reject(fn (PhonebookUser $user): bool => $user->id === $movedUser->id)
                ->values();

            $insertIndex = $targetUsers->count();

            if ($targetUser !== null) {
                $foundIndex = $targetUsers->search(
                    fn (PhonebookUser $user): bool => $user->id === $targetUser->id
                );

                if ($foundIndex !== false) {
                    $insertIndex = (int) $foundIndex;
                }
            }

            $targetUsers->splice($insertIndex, 0, [$movedUser]);
            $this->applyDepartmentOrder($targetUsers, $targetBaseOrder);

            if ($sourceDepartmentId !== $targetDepartmentId) {
                $sourceUsers = $this->orderedDepartmentUsers($sourceDepartmentId)
                    ->reject(fn (PhonebookUser $user): bool => $user->id === $movedUser->id)
                    ->values();

                $this->applyDepartmentOrder($sourceUsers, $sourceBaseOrder);
            }
        });

        return back()->with('success', 'Порядок сотрудников обновлен.');
    }

    public function destroy(Request $request, PhonebookUser $phonebookUser): RedirectResponse
    {
        $this->authorizeManage($request);

        $this->deleteLocalAvatar($phonebookUser->avatar_url);
        $phonebookUser->delete();

        return back()->with('success', 'Сотрудник удален.');
    }

    public function update(Request $request, PhonebookUser $phonebookUser): RedirectResponse
    {
        $this->authorizeManage($request);

        $data = $request->validate([
            'department_id' => ['nullable', 'integer', 'exists:phonebook_departments,id'],
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:100'],
            'inner_phone' => ['nullable', 'string', 'max:100'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'office' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:1000000'],
        ]);

        $normalizeNullableString = static fn ($value): ?string => ($value === null || trim((string) $value) === '')
            ? null
            : trim((string) $value);

        $phonebookUser->update([
            'department_id' => $data['department_id'] ?? null,
            'full_name' => trim((string) $data['full_name']),
            'email' => $normalizeNullableString($data['email'] ?? null),
            'phone' => $normalizeNullableString($data['phone'] ?? null),
            'inner_phone' => $normalizeNullableString($data['inner_phone'] ?? null),
            'job_title' => $normalizeNullableString($data['job_title'] ?? null),
            'office' => $normalizeNullableString($data['office'] ?? null),
            'sort_order' => isset($data['sort_order']) && $data['sort_order'] !== ''
                ? (int) $data['sort_order']
                : null,
        ]);

        return back()->with('success', 'Данные сотрудника обновлены.');
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeManage($request);

        $data = $request->validate([
            'department_id' => ['nullable', 'integer', 'exists:phonebook_departments,id'],
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:100'],
            'inner_phone' => ['nullable', 'string', 'max:100'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'office' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:1000000'],
        ]);

        $normalizeNullableString = static fn ($value): ?string => ($value === null || trim((string) $value) === '')
            ? null
            : trim((string) $value);

        PhonebookUser::query()->create([
            'department_id' => $data['department_id'] ?? null,
            'legacy_department_id' => null,
            'legacy_id' => null,
            'full_name' => trim((string) $data['full_name']),
            'email' => $normalizeNullableString($data['email'] ?? null),
            'phone' => $normalizeNullableString($data['phone'] ?? null),
            'inner_phone' => $normalizeNullableString($data['inner_phone'] ?? null),
            'job_title' => $normalizeNullableString($data['job_title'] ?? null),
            'office' => $normalizeNullableString($data['office'] ?? null),
            'sort_order' => isset($data['sort_order']) && $data['sort_order'] !== ''
                ? (int) $data['sort_order']
                : null,
            'avatar_url' => null,
        ]);

        return back()->with('success', 'Сотрудник добавлен.');
    }

    public function storeDepartment(Request $request): RedirectResponse
    {
        $this->authorizeManage($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:phonebook_departments,name'],
        ]);

        PhonebookDepartment::query()->create([
            'name' => trim((string) $data['name']),
            'legacy_id' => null,
        ]);

        return back()->with('success', 'Отдел добавлен в справочник.');
    }

    private function authorizeManage(Request $request): void
    {
        $actor = $request->user();
        $role = method_exists($actor, 'resolvedRoleSlug') ? $actor->resolvedRoleSlug() : null;

        if (! in_array($role, ['admin', 'superadmin', 'hr'], true)) {
            abort(403, 'Недостаточно прав для изменения справочника.');
        }
    }

    private function orderedDepartmentUsers(?int $departmentId): Collection
    {
        return PhonebookUser::query()
            ->when($departmentId === null, fn ($query) => $query->whereNull('department_id'))
            ->when($departmentId !== null, fn ($query) => $query->where('department_id', $departmentId))
            ->orderByRaw('CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END')
            ->orderBy('sort_order')
            ->orderBy('full_name')
            ->get();
    }

    private function applyDepartmentOrder(Collection $users, ?int $baseOrder): void
    {
        if ($users->isEmpty() || $baseOrder === null) {
            return;
        }

        foreach ($users->values() as $index => $user) {
            $orderValue = $baseOrder + $index;

            if ((int) ($user->sort_order ?? 0) === $orderValue) {
                continue;
            }

            PhonebookUser::query()
                ->where('id', $user->id)
                ->update(['sort_order' => $orderValue]);
        }
    }

    private function resolveDepartmentBaseOrder(?int $departmentId, bool $allowFallback): ?int
    {
        $minSortOrder = PhonebookUser::query()
            ->when($departmentId === null, fn ($query) => $query->whereNull('department_id'))
            ->when($departmentId !== null, fn ($query) => $query->where('department_id', $departmentId))
            ->whereNotNull('sort_order')
            ->min('sort_order');

        if ($minSortOrder !== null) {
            return (int) $minSortOrder;
        }

        if (! $allowFallback) {
            return null;
        }

        $maxSortOrder = PhonebookUser::query()->max('sort_order');

        return ((int) ($maxSortOrder ?? 0)) + 10;
    }

    private function deleteLocalAvatar(?string $avatarUrl): void
    {
        if ($avatarUrl === null || trim($avatarUrl) === '') {
            return;
        }

        $path = trim((string) parse_url($avatarUrl, PHP_URL_PATH));

        if (! Str::startsWith($path, '/storage/')) {
            return;
        }

        $relativePath = ltrim(Str::after($path, '/storage/'), '/');

        if ($relativePath === '') {
            return;
        }

        if (Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }
    }
}
