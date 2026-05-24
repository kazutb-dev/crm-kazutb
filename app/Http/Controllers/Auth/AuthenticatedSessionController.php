<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\Role;
use App\Services\BusinessActivityLogger;
use App\Services\UserPresenceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        $alreadyTracked = (bool) $request->session()->pull('login_tracked', false);
        $user = Auth::user();

        if ($user && empty($user->role_id)) {
            $defaultRoleId = Role::query()->where('slug', 'teacher')->value('id');

            if ($defaultRoleId) {
                $user->role_id = (int) $defaultRoleId;
                $user->save();
            }
        }

        $shouldShowProfileReminder = $user
            && (empty($user->faculty_id) || empty($user->department_id));

        if ($user && ! $alreadyTracked) {
            $hasLastLogin = Schema::hasColumn('users', 'last_login');
            $hasLastLoginAt = Schema::hasColumn('users', 'last_login_at');
            $hasLoginCount = Schema::hasColumn('users', 'login_count');

            if ($hasLastLogin || $hasLastLoginAt || $hasLoginCount) {
                if ($hasLastLogin) {
                    $user->last_login = now();
                }

                if ($hasLastLoginAt) {
                    $user->last_login_at = now();
                }

                if ($hasLoginCount) {
                    $user->login_count = (int) ($user->login_count ?? 0) + 1;
                }

                $user->save();
            }
        }

        if ($user !== null) {
            app(UserPresenceService::class)->record($user, $request, true);
        }

        try {
            Artisan::call('dashboard:refresh-cache');
        } catch (\Throwable $e) {
            report($e);
        }

        if (
            $user !== null
            && (int) $user->id === 66
            && (string) ($user->ad_login ?? '') === 'a.ulykpan'
        ) {
            return redirect()
                ->route('special.login-image')
                ->with('profileReminderAfterLogin', $shouldShowProfileReminder);
        }

        return redirect()
            ->intended(route('profile.edit'))
            ->with('profileReminderAfterLogin', $shouldShowProfileReminder);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        Auth::guard('web')->logout();

        if ($user !== null) {
            app(BusinessActivityLogger::class)->log(
                'logout',
                'Пользователь вышел из системы',
                $user,
                [
                    'reason' => 'manual_logout',
                ],
                $user,
                $request,
            );
        }

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
