<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['nullable', 'string', 'max:190'],
            'login' => ['nullable', 'string', 'max:190'],
            'password' => ['required', 'string'],
        ]);

        $identifier = trim((string) ($data['email'] ?? $data['login'] ?? ''));

        if ($identifier === '') {
            return response()->json([
                'message' => 'Укажите email или login.',
            ], 422);
        }

        $user = User::query()
            ->where('email', $identifier)
            ->orWhere('ad_login', $identifier)
            ->first();

        if (! $user || ! Hash::check($data['password'], (string) $user->password)) {
            return response()->json([
                'message' => 'Неверные учетные данные.',
            ], 401);
        }

        $role = $user->resolvedRoleSlug();
        if (! in_array($role, ['admin', 'superadmin'], true)) {
            return response()->json([
                'message' => 'Недостаточно прав.',
            ], 403);
        }

        $token = $user->createToken('mobile-admin')->plainTextToken;

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'ad_login' => $user->ad_login,
                'role' => $role,
            ],
        ]);
    }
}
