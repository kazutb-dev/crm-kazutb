<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $query = trim((string) $request->query('q', ''));
        $perPage = min((int) $request->query('per_page', 50), 200);

        $users = User::query()
            ->when($query !== '', function ($q) use ($query): void {
                $q->where(function ($nested) use ($query): void {
                    $nested
                        ->where('name', 'like', "%{$query}%")
                        ->orWhere('display_name', 'like', "%{$query}%")
                        ->orWhere('first_name', 'like', "%{$query}%")
                        ->orWhere('last_name', 'like', "%{$query}%")
                        ->orWhere('email', 'like', "%{$query}%")
                        ->orWhere('room', 'like', "%{$query}%")
                        ->orWhere('ad_login', 'like', "%{$query}%");
                });
            })
            ->orderBy('name')
            ->paginate($perPage);

        return response()->json([
            'data' => $users->map(fn (User $user): array => [
                'id'       => $user->id,
                'name'     => $user->name,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'initials' => $user->initials,
                'display_name' => $user->display_name,
                'description' => $user->ad_description,
                'department' => $user->ad_department,
                'department_number' => $user->ad_department_number,
                'division' => $user->ad_division,
                'employee_type' => $user->ad_employee_type,
                'room' => $user->room,
                'email'    => $user->email,
                'ad_login' => $user->ad_login,
                'role'     => $user->resolvedRoleSlug(),
            ])->values(),
            'meta' => [
                'total'        => $users->total(),
                'current_page' => $users->currentPage(),
                'last_page'    => $users->lastPage(),
                'per_page'     => $users->perPage(),
            ],
        ]);
    }

    private function ensureAdmin(Request $request): void
    {
        $role = $request->user()?->resolvedRoleSlug();

        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403, 'Недостаточно прав.');
    }
}
