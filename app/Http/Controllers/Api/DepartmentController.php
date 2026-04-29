<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'Не авторизован.',
            ], 401);
        }

        $role = $user->resolvedRoleSlug();
        $isAdmin = in_array($role, ['admin', 'superadmin'], true);

        if ($isAdmin) {
            $departments = User::query()
                ->whereNotNull('ad_department')
                ->where('ad_department', '!=', '')
                ->orderBy('ad_department')
                ->distinct()
                ->pluck('ad_department')
                ->values();
        } else {
            $department = trim((string) ($user->ad_department ?? ''));
            $departments = collect($department !== '' ? [$department] : []);
        }

        return response()->json([
            'data' => $departments->map(fn (string $name): array => [
                'value' => $name,
                'label' => $name,
            ])->values(),
        ]);
    }
}
