<?php

namespace App\Http\Controllers;

use App\Http\Controllers\CalendarEmployeesController;
use App\Models\CalendarEmployeeExclusion;
use App\Models\CalendarEmployeeGrant;
use App\Models\CalendarEvent;
use App\Models\User;
use App\Services\GreenApiWhatsAppNotifier;
use App\Services\ZoomMeetingService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CalendarConferencesController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $weekStart = now()->startOfWeek();
        $weekEnd   = now()->endOfWeek();

        $conferences = CalendarEvent::with(['organizer:id,name,display_name,ad_title', 'attendee:id,name,display_name,ad_title'])
            ->where(function ($q) use ($user) {
                $q->where('organizer_id', $user->id)
                  ->orWhere('attendee_id', $user->id);
            })
            ->where('format', 'online')
            ->whereBetween('starts_at', [$weekStart, $weekEnd])
            ->whereNotIn('status', ['cancelled', 'declined'])
            ->orderBy('starts_at')
            ->get()
            ->map(fn ($e) => [
                'id'           => $e->id,
                'title'        => $e->title,
                'starts_at'    => $e->starts_at,
                'ends_at'      => $e->ends_at,
                'status'       => $e->status,
                'zoom_join_url'=> $e->zoom_join_url,
                'organizer'    => $e->organizer->display_name ?? $e->organizer->name,
                'organizer_title' => $e->organizer->ad_title,
                'can_cancel' => (int) $e->organizer_id === (int) $user->id,
            ]);

        $excludedIds = CalendarEmployeeExclusion::pluck('user_id')->all();
        $grantedIds = CalendarEmployeeGrant::pluck('user_id')->all();
        $patterns = CalendarEmployeesController::LEADERSHIP_PATTERNS;

        $employees = User::query()
            ->select('id', 'name', 'display_name', 'ad_title', 'email')
            ->where('id', '<>', $user->id)
            ->whereNotIn('id', $excludedIds)
            ->where(function ($q) use ($grantedIds, $patterns) {
                $q->where(function ($inner) use ($patterns) {
                    foreach ($patterns as $pattern) {
                        $inner->orWhereRaw('LOWER(ad_title) LIKE ?', ['%'.$pattern.'%']);
                    }
                });

                if (! empty($grantedIds)) {
                    $q->orWhereIn('id', $grantedIds);
                }
            })
            ->orderBy('name')
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->display_name ?? $u->name,
                'title' => $u->ad_title,
                'email' => $u->email,
            ])
            ->values();

        return Inertia::render('Calendar/Conferences', [
            'conferences' => $conferences,
            'employees' => $employees,
        ]);
    }

    public function store(
        Request $request,
        ZoomMeetingService $zoomMeetingService,
        GreenApiWhatsAppNotifier $whatsAppNotifier
    ): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'starts_at' => ['required', 'date', 'after_or_equal:now'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'attendee_ids' => ['required', 'array', 'min:1'],
            'attendee_ids.*' => ['integer', 'exists:users,id', 'different:'.(string) $user->id],
        ]);

        $startsAt = Carbon::parse($data['starts_at'], config('app.timezone'));
        $endsAt = Carbon::parse($data['ends_at'], config('app.timezone'));
        $attendeeIds = collect($data['attendee_ids'])->map(fn ($id) => (int) $id)->unique()->values();
        $attendees = User::query()
            ->whereIn('id', $attendeeIds->all())
            ->get(['id', 'name', 'display_name', 'phone'])
            ->keyBy('id');

        $zoomMeeting = $zoomMeetingService->createMeeting(
            $data['title'],
            $startsAt,
            $endsAt,
            $data['description'] ?? null,
        );

        if (! $zoomMeeting || empty($zoomMeeting['join_url'])) {
            return back()->with('error', $zoomMeetingService->getLastError() ?? 'Не удалось создать Zoom конференцию.');
        }

        $failedWhatsAppRecipients = [];

        foreach ($attendeeIds as $attendeeId) {
            $attendee = $attendees->get((int) $attendeeId);

            $hasConflict = CalendarEvent::query()
                ->whereNotIn('status', ['cancelled', 'declined'])
                ->where('starts_at', '<', $endsAt)
                ->where('ends_at', '>', $startsAt)
                ->where(function ($q) use ($user, $attendeeId) {
                    $q->where('organizer_id', $user->id)
                        ->orWhere('attendee_id', $user->id)
                        ->orWhere('organizer_id', $attendeeId)
                        ->orWhere('attendee_id', $attendeeId);
                })
                ->exists();

            $event = CalendarEvent::create([
                'organizer_id' => $user->id,
                'attendee_id' => $attendeeId,
                'title' => $data['title'],
                'type' => 'meeting',
                'color' => '#3b82f6',
                'description' => $data['description'] ?? null,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'status' => $hasConflict ? 'conflict' : 'confirmed',
                'format' => 'online',
                'zoom_meeting_id' => (string) ($zoomMeeting['meeting_id'] ?? null),
                'zoom_join_url' => (string) ($zoomMeeting['join_url'] ?? null),
            ]);

            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.conference.created', $event, [
                'status' => $event->status,
                'zoom_meeting_id' => $event->zoom_meeting_id,
            ]);

            if ($attendee) {
                $organizerName = $user->display_name ?? $user->name;
                $whenText = sprintf(
                    '%s - %s',
                    $startsAt->format('d.m.Y H:i'),
                    $endsAt->format('d.m.Y H:i')
                );

                $message = "Вам назначена Zoom-конференция\n"
                    . "Тема: {$data['title']}\n"
                    . "Организатор: {$organizerName}\n"
                    . "Когда: {$whenText}\n"
                    . "Ссылка: {$zoomMeeting['join_url']}";

                if (!empty($data['description'])) {
                    $message .= "\nОписание: {$data['description']}";
                }

                $sent = $whatsAppNotifier->sendMessageToUser($attendee, $message, [
                    'notification_event_id' => $event->id,
                    'notification_type' => 'new_request',
                ]);

                if (! $sent) {
                    $failedWhatsAppRecipients[] = $attendee->display_name ?? $attendee->name;
                }
            }
        }

        $response = back()->with('success', 'Zoom конференция создана и приглашения отправлены в календарь выбранных сотрудников.');

        if (! empty($failedWhatsAppRecipients)) {
            $failedList = implode(', ', array_unique($failedWhatsAppRecipients));
            $response->with('warning', 'Для части сотрудников не удалось отправить WhatsApp уведомление: '.$failedList);
        }

        return $response;
    }
}
