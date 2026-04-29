<?php

namespace Tests\Feature\Calendar;

use App\Models\CalendarAuditLog;
use App\Models\CalendarEvent;
use App\Models\CalendarNotificationLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class CalendarWorkflowTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.green_api.enabled' => false]);
    }

    public function test_meeting_request_to_another_employee_is_pending_and_logged(): void
    {
        $organizer = $this->calendarUser('director@example.test', 'Директор департамента');
        $attendee = $this->calendarUser('dean@example.test', 'Декан факультета');

        $response = $this->actingAs($organizer)->post(route('calendar.events.store'), [
            'title' => 'Производственное совещание',
            'type' => 'meeting',
            'attendee_id' => $attendee->id,
            'starts_at' => now()->addDay()->setTime(10, 0)->format('Y-m-d\TH:i'),
            'ends_at' => now()->addDay()->setTime(11, 0)->format('Y-m-d\TH:i'),
            'format' => 'offline',
            'room' => '305',
        ]);

        $response->assertRedirect();

        $event = CalendarEvent::query()->where('title', 'Производственное совещание')->firstOrFail();

        $this->assertSame('pending', $event->status);
        $this->assertSame('offline', $event->format);
        $this->assertSame('305', $event->room);
        $this->assertDatabaseHas('calendar_audit_log', [
            'action' => 'calendar.event.created',
            'subject_id' => $event->id,
        ]);
        $this->assertDatabaseHas('calendar_notifications_log', [
            'event_id' => $event->id,
            'user_id' => $attendee->id,
            'type' => 'new_request',
            'status' => 'failed',
        ]);
    }

    public function test_attendee_can_confirm_pending_meeting(): void
    {
        $organizer = $this->calendarUser('rector@example.test', 'Ректор');
        $attendee = $this->calendarUser('head@example.test', 'Заведующий кафедрой');
        $event = $this->meeting($organizer, $attendee, 'pending');

        $response = $this->actingAs($attendee)->patch(route('calendar.events.confirm', $event));

        $response->assertRedirect();
        $this->assertSame('confirmed', $event->refresh()->status);
        $this->assertDatabaseHas('calendar_audit_log', [
            'action' => 'calendar.event.confirmed',
            'subject_id' => $event->id,
        ]);
    }

    public function test_attendee_can_decline_pending_meeting_with_reason(): void
    {
        $organizer = $this->calendarUser('rector2@example.test', 'Ректор');
        $attendee = $this->calendarUser('dean2@example.test', 'Декан');
        $event = $this->meeting($organizer, $attendee, 'pending');

        $response = $this->actingAs($attendee)->patch(route('calendar.events.decline', $event), [
            'reason' => 'Занят в это время',
        ]);

        $response->assertRedirect();
        $event->refresh();

        $this->assertSame('declined', $event->status);
        $this->assertSame($attendee->id, $event->cancelled_by);
        $this->assertSame('Занят в это время', $event->cancellation_reason);
        $this->assertDatabaseHas('calendar_audit_log', [
            'action' => 'calendar.event.declined',
            'subject_id' => $event->id,
        ]);
    }

    public function test_organizer_can_cancel_meeting_with_audit_trail(): void
    {
        $organizer = $this->calendarUser('director2@example.test', 'Директор');
        $attendee = $this->calendarUser('dean3@example.test', 'Декан');
        $event = $this->meeting($organizer, $attendee, 'confirmed');

        $response = $this->actingAs($organizer)->patch(route('calendar.events.cancel', $event), [
            'reason' => 'Перенесено руководством',
        ]);

        $response->assertRedirect();
        $event->refresh();

        $this->assertSame('cancelled', $event->status);
        $this->assertSame($organizer->id, $event->cancelled_by);
        $this->assertNotNull($event->cancelled_at);
        $this->assertSame('Перенесено руководством', $event->cancellation_reason);
        $this->assertDatabaseHas('calendar_audit_log', [
            'action' => 'calendar.event.cancelled',
            'subject_id' => $event->id,
        ]);
    }

    private function calendarUser(string $email, string $title): User
    {
        return User::factory()->create([
            'email' => $email,
            'ad_title' => $title,
            'phone' => '+77000000000',
        ]);
    }

    private function meeting(User $organizer, User $attendee, string $status): CalendarEvent
    {
        return CalendarEvent::create([
            'organizer_id' => $organizer->id,
            'attendee_id' => $attendee->id,
            'title' => 'Тестовая встреча',
            'type' => 'meeting',
            'starts_at' => now()->addDay()->setTime(10, 0),
            'ends_at' => now()->addDay()->setTime(11, 0),
            'status' => $status,
            'format' => 'offline',
        ]);
    }
}
