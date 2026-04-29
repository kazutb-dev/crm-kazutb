<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActiveDirectoryAuthenticator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request, ActiveDirectoryAuthenticator $adAuthenticator): JsonResponse
    {
        $data = $request->validate([
            'email' => ['nullable', 'string', 'max:190'],
            'login' => ['nullable', 'string', 'max:190'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $identifier = trim((string) ($data['email'] ?? $data['login'] ?? ''));

        if ($identifier === '') {
            return response()->json([
                'message' => 'Укажите email или login.',
            ], 422);
        }

        $password = (string) $data['password'];

        // 1) Primary path: AD auth with local DB sync.
        $user = $adAuthenticator->authenticateAndSync($identifier, $password);

        // 2) Fallback: local user credentials.
        if ($user === null) {
            $user = User::query()
                ->where('email', $identifier)
                ->orWhere('ad_login', $identifier)
                ->first();

            if (! $user || ! Hash::check($password, (string) $user->password)) {
                return response()->json([
                    'message' => 'Неверные учетные данные.',
                ], 401);
            }
        }

        $token = $user->createToken((string) ($data['device_name'] ?? 'mobile-user'))->plainTextToken;

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->serializeUser($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'Не авторизован.',
            ], 401);
        }

        return response()->json([
            'data' => $this->serializeUser($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()?->currentAccessToken();

        if ($token) {
            $token->delete();
        }

        return response()->json([
            'message' => 'Выход выполнен.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
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
            'email' => $user->email,
            'ad_login' => $user->ad_login,
            'role' => $user->resolvedRoleSlug(),
        ];
    }
}
