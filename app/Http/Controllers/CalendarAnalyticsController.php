<?php

namespace App\Http\Controllers;

use App\Models\CalendarEmployeeExclusion;
use App\Models\CalendarEmployeeGrant;
use App\Models\CalendarEvent;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CalendarAnalyticsController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $isAdmin = $user->resolvedRoleSlug() === 'admin';
        $period = $request->query('period', 'month');
        [$start, $end] = match ($period) {
            'week'  => [now()->startOfWeek(), now()->endOfWeek()],
            'quarter' => [now()->startOfQuarter(), now()->endOfQuarter()],
            'year'  => [now()->startOfYear(), now()->endOfYear()],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };

        $countDaysByType = function (string $type, int $userId = null) use ($start, $end): int {
            $query = CalendarEvent::query()
                ->where('type', $type)
                ->whereNotIn('status', ['cancelled', 'declined'])
                ->where('starts_at', '<=', $end)
                ->where('ends_at', '>=', $start);

            if ($userId) {
                $query->where('organizer_id', $userId);
            }

            return $query->get(['starts_at', 'ends_at'])
                ->sum(function ($event) use ($start, $end) {
                    $rangeStart = $event->starts_at->lt($start)
                        ? $start->copy()->startOfDay()
                        : $event->starts_at->copy()->startOfDay();
                    $rangeEnd = $event->ends_at->gt($end)
                        ? $end->copy()->startOfDay()
                        : $event->ends_at->copy()->startOfDay();

                    return max(0, $rangeStart->diffInDays($rangeEnd) + 1);
                });
        };

        // Personal stats
        $baseQuery = CalendarEvent::query()
            ->where(function ($q) use ($user) {
                $q->where('organizer_id', $user->id)
                    ->orWhere('attendee_id', $user->id);
            })
            ->where('starts_at', '<=', $end)
            ->where('ends_at', '>=', $start);

        $total = (clone $baseQuery)->count();
        $completed = (clone $baseQuery)->where('status', 'completed')->count();
        $cancelled = (clone $baseQuery)->where('status', 'cancelled')->count();
        $pending = (clone $baseQuery)->where('status', 'pending')->count();
        $vacationDays = $countDaysByType('vacation', $user->id);
        $businessTripDays = $countDaysByType('business_trip', $user->id);

        $stats = compact('total', 'completed', 'cancelled', 'pending', 'vacationDays', 'businessTripDays');

        // Admin stats
        $adminStats = null;
        if ($isAdmin) {
            $excludedIds = CalendarEmployeeExclusion::pluck('user_id')->all();
            $grantedIds  = CalendarEmployeeGrant::pluck('user_id')->all();
            $patterns = CalendarEmployeesController::LEADERSHIP_PATTERNS;

            // Only calendar-visible employees (same filter as CalendarEmployeesController)
            $calendarUserIds = User::query()
                ->select('id')
                ->whereNotIn('id', $excludedIds)
                ->where(function ($q) use ($patterns, $grantedIds) {
                    $q->where(function ($inner) use ($patterns) {
                        $inner->whereNotNull('ad_title')
                            ->where('ad_title', '<>', '')
                            ->where(function ($pat) use ($patterns) {
                                foreach ($patterns as $pattern) {
                                    $pat->orWhereRaw('LOWER(ad_title) LIKE ?', ['%' . $pattern . '%']);
                                }
                            });
                    });
                    if (!empty($grantedIds)) {
                        $q->orWhereIn('id', $grantedIds);
                    }
                })
                ->pluck('id')
                ->all();

            $allEvents = CalendarEvent::query()
                ->whereIn('organizer_id', $calendarUserIds)
                ->where('starts_at', '<=', $end)
                ->where('ends_at', '>=', $start);

            $adminStats = [
                'total'           => (clone $allEvents)->count(),
                'completed'       => (clone $allEvents)->where('status', 'completed')->count(),
                'cancelled'       => (clone $allEvents)->where('status', 'cancelled')->count(),
                'pending'         => (clone $allEvents)->where('status', 'pending')->count(),
                'vacationDays'    => $countDaysByType('vacation'),
                'businessTripDays'=> $countDaysByType('business_trip'),
                'employeeCount'   => count($calendarUserIds),
                'userStats'       => User::query()
                    ->select('id', 'name', 'display_name')
                    ->whereIn('id', $calendarUserIds)
                    ->orderBy('name')
                    ->get()
                    ->map(function ($u) use ($start, $end) {
                        $q = CalendarEvent::query()
                            ->where('organizer_id', $u->id)
                            ->where('starts_at', '<=', $end)
                            ->where('ends_at', '>=', $start);

                        $calcDays = function (string $type) use ($u, $start, $end): int {
                            return CalendarEvent::query()
                                ->where('organizer_id', $u->id)
                                ->where('type', $type)
                                ->whereNotIn('status', ['cancelled', 'declined'])
                                ->where('starts_at', '<=', $end)
                                ->where('ends_at', '>=', $start)
                                ->get(['starts_at', 'ends_at'])
                                ->sum(function ($event) use ($start, $end) {
                                    $s = $event->starts_at->lt($start) ? $start->copy()->startOfDay() : $event->starts_at->copy()->startOfDay();
                                    $e = $event->ends_at->gt($end) ? $end->copy()->startOfDay() : $event->ends_at->copy()->startOfDay();
                                    return max(0, $s->diffInDays($e) + 1);
                                });
                        };

                        return [
                            'name'             => $u->display_name ?? $u->name,
                            'total'            => (clone $q)->count(),
                            'completed'        => (clone $q)->where('status', 'completed')->count(),
                            'vacationDays'     => $calcDays('vacation'),
                            'businessTripDays' => $calcDays('business_trip'),
                        ];
                    })
                    ->toArray(),
            ];
        }

        return Inertia::render('Calendar/Analytics', [
            'period'     => $period,
            'stats'      => $stats,
            'adminStats' => $adminStats,
            'isAdmin'    => $isAdmin,
        ]);
    }
}
