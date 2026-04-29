<?php

namespace App\Http\Middleware;

use App\Http\Controllers\CalendarEmployeesController;
use App\Models\CalendarEmployeeExclusion;
use App\Models\CalendarEmployeeGrant;
use App\Models\CalendarEvent;
use App\Models\CalendarSecretaryAccess;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
                'roleSlug' => $request->user()?->resolvedRoleSlug(),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
            ],
            'calendar' => [
                'incoming_count' => fn () => $request->user()
                    ? CalendarEvent::where('attendee_id', $request->user()->id)
                        ->whereIn('status', ['pending', 'confirmed'])
                        ->where('starts_at', '>=', now())
                        ->count()
                    : 0,
                'shared_access_count' => fn () => $request->user()
                    ? CalendarSecretaryAccess::query()
                        ->where('secretary_id', $request->user()->id)
                        ->where('is_active', true)
                        ->whereNull('revoked_at')
                        ->count()
                    : 0,
                'can_access' => fn () => $this->canAccessCalendar($request->user()),
            ],
        ];
    }

    private function canAccessCalendar(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        $userId = (int) $user->id;

        if (CalendarEmployeeExclusion::query()->where('user_id', $userId)->exists()) {
            return false;
        }

        if (CalendarEmployeeGrant::query()->where('user_id', $userId)->exists()) {
            return true;
        }

        $title = mb_strtolower(trim((string) ($user->ad_title ?? '')));

        foreach (CalendarEmployeesController::LEADERSHIP_PATTERNS as $pattern) {
            if ($title !== '' && str_contains($title, $pattern)) {
                return true;
            }
        }

        return false;
    }
}
