<?php

namespace App\Http\Controllers;

use App\Models\CalendarEvent;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CalendarEmployeeProfileController extends Controller
{
    public function __invoke(Request $request, User $employee): Response
    {
        $viewer = $request->user();
        $year = (int) $request->query('year', now()->year);
        $month = (int) $request->query('month', now()->month);

        $start = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $events = CalendarEvent::with(['organizer:id,name,display_name', 'attendee:id,name,display_name'])
            ->where(function ($q) use ($employee) {
                $q->where('organizer_id', $employee->id)
                    ->orWhere('attendee_id', $employee->id);
            })
            ->where('starts_at', '<=', $end)
            ->where(function ($q) use ($start) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', $start);
            })
            ->whereNotIn('status', ['cancelled', 'declined'])
            ->orderBy('starts_at')
            ->get()
            ->map(function ($e) use ($employee) {
                $isOrganizer = $e->organizer_id === $employee->id;
                $counterparty = $isOrganizer ? $e->attendee : $e->organizer;

                return [
                    'id' => $e->id,
                    'title' => $e->title,
                    'type' => $e->type,
                    'starts_at' => $e->starts_at?->format('Y-m-d\\TH:i:s'),
                    'ends_at' => $e->ends_at?->format('Y-m-d\\TH:i:s'),
                    'status' => $e->status,
                    'format' => $e->format,
                    'with_name' => $counterparty?->display_name ?? $counterparty?->name,
                    'with_id'   => $counterparty?->id,
                ];
            });

        return Inertia::render('Calendar/EmployeeProfile', [
            'employee' => [
                'id' => $employee->id,
                'name' => $employee->display_name ?? $employee->name,
                'title' => $employee->ad_title,
                'department' => $employee->ad_department,
                'email' => $employee->email,
                'phone' => $employee->phone,
                'room' => $employee->room,
                'calendar_status' => $employee->calendar_status ?? 'available',
            ],
            'events' => $events,
            'viewer_id' => $viewer->id,
            'year' => $year,
            'month' => $month,
        ]);
    }
}
