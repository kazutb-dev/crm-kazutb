<?php

namespace Tests\Feature\Api;

use App\Models\Announcement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AnnouncementAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_user_cannot_create_announcement(): void
    {
        $this->postJson('/api/announcements', $this->payload())
            ->assertUnauthorized();

        $this->assertDatabaseMissing('announcements', [
            'title' => 'Security update',
        ]);
    }

    #[DataProvider('unauthorizedRoles')]
    public function test_non_admin_users_cannot_mutate_announcements(?string $role): void
    {
        $user = User::factory()->create(['role' => $role]);
        $announcement = Announcement::query()->create([
            'title' => 'Original',
            'content' => 'Original content',
            'is_active' => true,
            'is_important' => false,
            'created_by' => $user->id,
        ]);

        Sanctum::actingAs($user);

        $this->postJson('/api/announcements', $this->payload())
            ->assertForbidden();

        $this->patchJson('/api/announcements/'.$announcement->id, [
            'title' => 'Updated',
        ])->assertForbidden();

        $this->deleteJson('/api/announcements/'.$announcement->id)
            ->assertForbidden();

        $this->assertDatabaseMissing('announcements', [
            'title' => 'Security update',
        ]);
        $this->assertDatabaseHas('announcements', [
            'id' => $announcement->id,
            'title' => 'Original',
        ]);
    }

    #[DataProvider('authorizedRoles')]
    public function test_admin_users_can_mutate_announcements(string $role): void
    {
        $user = User::factory()->create(['role' => $role]);
        $announcement = Announcement::query()->create([
            'title' => 'Original',
            'content' => 'Original content',
            'is_active' => true,
            'is_important' => false,
            'created_by' => $user->id,
        ]);

        Sanctum::actingAs($user);

        $this->postJson('/api/announcements', $this->payload())
            ->assertCreated()
            ->assertJsonPath('message', 'Объявление создано.');

        $this->patchJson('/api/announcements/'.$announcement->id, [
            'title' => 'Updated',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Объявление обновлено.')
            ->assertJsonPath('data.title', 'Updated');

        $this->deleteJson('/api/announcements/'.$announcement->id)
            ->assertOk()
            ->assertJsonPath('message', 'Объявление удалено.');

        $this->assertDatabaseHas('announcements', [
            'title' => 'Security update',
            'created_by' => $user->id,
        ]);
        $this->assertDatabaseMissing('announcements', [
            'id' => $announcement->id,
        ]);
    }

    /**
     * @return array<string, array{0: string|null}>
     */
    public static function unauthorizedRoles(): array
    {
        return [
            'ordinary default role' => [null],
            'teacher' => ['teacher'],
            'student' => ['student'],
            'certificates' => ['certificates'],
        ];
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function authorizedRoles(): array
    {
        return [
            'admin' => ['admin'],
            'superadmin' => ['superadmin'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return [
            'title' => 'Security update',
            'content' => 'Authorized announcement content.',
            'is_active' => true,
            'is_important' => false,
            'event_date' => now()->addDay()->toIso8601String(),
        ];
    }
}
