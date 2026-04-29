<?php

namespace App\Http\Controllers;

use App\Models\CalendarAvailabilitySlot;
use App\Models\CalendarEvent;
use App\Models\CalendarHoliday;
use App\Models\CalendarSecretaryAccess;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CalendarMyController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $managedAccess = CalendarSecretaryAccess::query()
            ->with(['manager:id,name,display_name,ad_title'])
            ->where('secretary_id', $user->id)
            ->where('is_active', true)
            ->whereNull('revoked_at')
            ->get();

        $managedCalendarIds = $managedAccess
            ->pluck('manager_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $requestedOwnerId = (int) $request->query('calendar_owner_id', $user->id);
        $allowedOwnerIds = array_values(array_unique(array_merge([(int) $user->id], $managedCalendarIds)));
        $activeOwnerId = in_array($requestedOwnerId, $allowedOwnerIds, true) ? $requestedOwnerId : (int) $user->id;
        $calendarOwner = $activeOwnerId === (int) $user->id
            ? $user
            : User::query()->select('id', 'name', 'display_name', 'ad_title')->find($activeOwnerId);

        if (!$calendarOwner) {
            $activeOwnerId = (int) $user->id;
            $calendarOwner = $user;
        }

        $year = (int) $request->query('year', now()->year);
        $month = (int) $request->query('month', now()->month);
        $now = now();

        $start = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $events = CalendarEvent::with(['organizer:id,name,display_name', 'attendee:id,name,display_name'])
            ->where(function ($q) use ($calendarOwner) {
                $q->where('organizer_id', $calendarOwner->id)
                    ->orWhere('attendee_id', $calendarOwner->id);
            })
            ->where('starts_at', '<=', $end)
            ->where('ends_at', '>=', $start)
            ->whereNotIn('status', ['cancelled', 'declined'])
            ->orderBy('starts_at')
            ->get()
            ->map(function ($e) use ($calendarOwner, $allowedOwnerIds) {
                $isOrganizer = $e->organizer_id === $calendarOwner->id;
                $counterparty = $isOrganizer ? $e->attendee : $e->organizer;
                $canManageOrganizer = in_array((int) $e->organizer_id, $allowedOwnerIds, true);
                $canManageAttendee = in_array((int) $e->attendee_id, $allowedOwnerIds, true);

                return [
                    'id' => $e->id,
                    'title' => $e->title,
                    'type' => $e->type,
                    'color' => $e->color,
                    'starts_at' => $e->starts_at?->format('Y-m-d\\TH:i:s'),
                    'ends_at' => $e->ends_at?->format('Y-m-d\\TH:i:s'),
                    'status' => $e->status,
                    'format' => $e->format,
                    'room' => $e->room,
                    'zoom_join_url' => $e->zoom_join_url,
                    'is_organizer' => $isOrganizer,
                    'is_own' => $canManageOrganizer,
                    'can_confirm' => $e->type === 'meeting' && $e->status === 'pending' && $canManageAttendee,
                    'can_decline' => $e->type === 'meeting' && $e->status === 'pending' && $canManageAttendee,
                    'can_cancel' => $e->status !== 'cancelled' && ($canManageOrganizer || $canManageAttendee),
                    'can_reschedule' => $e->status !== 'cancelled' && ($canManageOrganizer || $canManageAttendee),
                    'description' => $e->description,
                    'with_name' => $counterparty?->display_name ?? $counterparty?->name,
                ];
            });

        $weekStart = $now->copy()->startOfWeek();
        $weekEnd = $now->copy()->endOfWeek();

        $computeMonthDays = function (string $type) use ($calendarOwner, $start, $end): int {
            return CalendarEvent::where('organizer_id', $calendarOwner->id)
                ->where('type', $type)
                ->where('starts_at', '<=', $end)
                ->where('ends_at', '>=', $start)
                ->whereNotIn('status', ['cancelled', 'declined'])
                ->get(['starts_at', 'ends_at'])
                ->sum(function ($e) use ($start, $end) {
                    $s = $e->starts_at->gt($start) ? $e->starts_at->copy()->startOfDay() : $start->copy()->startOfDay();
                    $en = $e->ends_at->lt($end) ? $e->ends_at->copy()->startOfDay() : $end->copy()->startOfDay();
                    return max(0, $s->diffInDays($en) + 1);
                });
        };

        $stats = [
            'vacation_days' => $computeMonthDays('vacation'),
            'business_trip_days' => $computeMonthDays('business_trip'),
            'week_count' => CalendarEvent::where(function ($q) use ($calendarOwner) {
                $q->where('organizer_id', $calendarOwner->id)
                    ->orWhere('attendee_id', $calendarOwner->id);
            })
                ->where('status', 'confirmed')
                ->whereBetween('starts_at', [$weekStart, $weekEnd])
                ->count(),
            'today_count' => CalendarEvent::where(function ($q) use ($calendarOwner) {
                $q->where('organizer_id', $calendarOwner->id)
                    ->orWhere('attendee_id', $calendarOwner->id);
            })
                ->where('status', 'confirmed')
                ->whereDate('starts_at', $now->toDateString())
                ->count(),
            'pending_count' => CalendarEvent::where('attendee_id', $calendarOwner->id)
                ->where('status', 'pending')
                ->count(),
            'conflict_count' => CalendarEvent::where(function ($q) use ($calendarOwner) {
                $q->where('organizer_id', $calendarOwner->id)
                    ->orWhere('attendee_id', $calendarOwner->id);
            })
                ->where('status', 'conflict')
                ->count(),
        ];

        $upcomingEvents = CalendarEvent::with(['organizer:id,name,display_name', 'attendee:id,name,display_name'])
            ->where(function ($q) use ($calendarOwner) {
                $q->where('organizer_id', $calendarOwner->id)
                    ->orWhere('attendee_id', $calendarOwner->id);
            })
            ->where('type', 'meeting')
            ->whereIn('status', ['confirmed', 'pending'])
            ->where('starts_at', '>=', $now)
            ->orderBy('starts_at')
            ->limit(5)
            ->get()
            ->map(function ($e) use ($calendarOwner) {
                $counterparty = $e->organizer_id === $calendarOwner->id ? $e->attendee : $e->organizer;

                return [
                    'id' => $e->id,
                    'title' => $e->title,
                    'starts_at' => $e->starts_at?->format('Y-m-d\\TH:i:s'),
                    'ends_at' => $e->ends_at?->format('Y-m-d\\TH:i:s'),
                    'status' => $e->status,
                    'format' => $e->format,
                    'zoom_join_url' => $e->zoom_join_url,
                    'room' => $e->room,
                    'with' => $counterparty?->display_name ?? $counterparty?->name ?? 'Неизвестный пользователь',
                ];
            });

        $meetingNotifications = CalendarEvent::with(['organizer:id,name,display_name'])
            ->where('attendee_id', $calendarOwner->id)
            ->whereIn('status', ['pending', 'confirmed'])
            ->where('starts_at', '>=', now())
            ->orderBy('starts_at')
            ->limit(5)
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'title' => $e->title,
                'starts_at' => $e->starts_at?->format('Y-m-d\\TH:i:s'),
                'ends_at' => $e->ends_at?->format('Y-m-d\\TH:i:s'),
                'status' => $e->status,
                'room' => $e->room,
                'format' => $e->format,
                'organizer_name' => $e->organizer?->display_name ?? $e->organizer?->name,
            ]);

        $slots = CalendarAvailabilitySlot::where('user_id', $calendarOwner->id)
            ->where('is_active', true)
            ->where(function ($q) use ($start, $end) {
                $q->whereBetween('date', [$start, $end])
                    ->orWhereNull('date');
            })
            ->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'date' => $s->date,
                'starts_at' => $s->starts_at,
                'ends_at' => $s->ends_at,
                'recurrence_type' => $s->recurrence_type,
            ]);

        $holidays = CalendarHoliday::whereYear('date', $year)
            ->where('is_active', true)
            ->get(['date', 'name_ru']);

        $leadershipPatterns = CalendarEmployeesController::LEADERSHIP_PATTERNS;

        $titleOrder = [
            'ректор' => 0,
            'проректор' => 1,
            'директор' => 2,
            'декан' => 3,
            'зам.декан' => 4,
            'заведующ' => 5,
        ];

        $employees = User::query()
            ->select('id', 'name', 'display_name', 'ad_title', 'ad_department', 'room', 'email', 'phone', 'calendar_status')
            ->where('id', '<>', $calendarOwner->id)
            ->where(function ($q) use ($leadershipPatterns) {
                $q->whereNotNull('ad_title')
                    ->where('ad_title', '<>', '')
                    ->where(function ($pat) use ($leadershipPatterns) {
                        foreach ($leadershipPatterns as $pattern) {
                            $pat->orWhereRaw('LOWER(ad_title) LIKE ?', ['%' . $pattern . '%']);
                        }
                    });
            })
            ->orderBy('name')
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->display_name ?? $u->name,
                'title' => $u->ad_title,
                'department' => $u->ad_department,
                'room' => $u->room,
                'email' => $u->email,
                'phone' => $u->phone,
                'calendar_status' => $u->calendar_status ?? 'available',
            ])
            ->sortBy(function ($emp) use ($titleOrder) {
                $title = mb_strtolower(trim($emp['title'] ?? ''));
                foreach ($titleOrder as $keyword => $order) {
                    if (str_contains($title, $keyword)) {
                        return $order;
                    }
                }
                return 99;
            })
            ->values();

        $managedCalendars = $managedAccess
            ->map(fn ($access) => [
                'id' => $access->manager_id,
                'name' => $access->manager?->display_name ?? $access->manager?->name ?? ('ID ' . $access->manager_id),
                'title' => $access->manager?->ad_title,
            ])
            ->values();

        return Inertia::render('Calendar/Index', [
            'events' => $events,
            'stats' => $stats,
            'upcomingEvents' => $upcomingEvents,
            'meetingNotifications' => $meetingNotifications,
            'slots' => $slots,
            'holidays' => $holidays,
            'employees' => $employees,
            'calendarOwner' => [
                'id' => $calendarOwner->id,
                'name' => $calendarOwner->display_name ?? $calendarOwner->name,
                'title' => $calendarOwner->ad_title,
            ],
            'managedCalendars' => $managedCalendars,
            'year' => $year,
            'month' => $month,
        ]);
    }
}
