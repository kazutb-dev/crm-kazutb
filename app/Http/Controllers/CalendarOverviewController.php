<?php

namespace App\Http\Controllers;

use App\Models\CalendarEvent;
use App\Models\CalendarHoliday;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CalendarOverviewController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        $now = now();
        $weekStart = $now->copy()->startOfWeek();
        $weekEnd   = $now->copy()->endOfWeek();

        $weekCount = CalendarEvent::where(function ($q) use ($user) {
                $q->where('organizer_id', $user->id)
                  ->orWhere('attendee_id', $user->id);
            })
            ->where('status', 'confirmed')
            ->whereBetween('starts_at', [$weekStart, $weekEnd])
            ->count();

        $todayCount = CalendarEvent::where(function ($q) use ($user) {
                $q->where('organizer_id', $user->id)
                  ->orWhere('attendee_id', $user->id);
            })
            ->where('status', 'confirmed')
            ->whereDate('starts_at', $now->toDateString())
            ->count();

        $pendingCount = CalendarEvent::where('attendee_id', $user->id)
            ->where('status', 'pending')
            ->count();

        $conflictCount = CalendarEvent::where(function ($q) use ($user) {
                $q->where('organizer_id', $user->id)
                  ->orWhere('attendee_id', $user->id);
            })
            ->where('status', 'conflict')
            ->count();

        $upcomingEvents = CalendarEvent::with(['organizer:id,name,display_name,ad_title', 'attendee:id,name,display_name,ad_title'])
            ->where(function ($q) use ($user) {
                $q->where('organizer_id', $user->id)
                  ->orWhere('attendee_id', $user->id);
            })
            ->whereIn('status', ['confirmed', 'pending'])
            ->where('starts_at', '>=', $now)
            ->orderBy('starts_at')
            ->limit(5)
            ->get()
            ->map(function ($e) use ($user) {
                $counterparty = $e->organizer_id === $user->id
                    ? $e->attendee
                    : $e->organizer;

                return [
                    'id'         => $e->id,
                    'title'      => $e->title,
                    'starts_at'  => $e->starts_at,
                    'ends_at'    => $e->ends_at,
                    'status'     => $e->status,
                    'format'     => $e->format,
                    'zoom_join_url' => $e->zoom_join_url,
                    'with'       => $counterparty?->display_name
                        ?? $counterparty?->name
                        ?? 'Неизвестный пользователь',
                ];
            });

        $holidays = CalendarHoliday::whereYear('date', $now->year)
            ->where('is_active', true)
            ->get(['date', 'name_ru'])
            ->keyBy('date');

        return Inertia::render('Calendar/Overview', [
            'stats' => [
                'week_count'    => $weekCount,
                'today_count'   => $todayCount,
                'pending_count' => $pendingCount,
                'conflict_count'=> $conflictCount,
            ],
            'upcomingEvents' => $upcomingEvents,
            'holidays'       => $holidays,
            'userStatus'     => $user->calendar_status ?? 'available',
        ]);
    }
}
