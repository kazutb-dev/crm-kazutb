<?php

namespace Tests\Feature\Hr;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * The hiring module opens new routes to the `hr` role; the phonebook must keep working for it as before.
 */
class HrRoleAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    public function test_hr_role_still_sees_the_phonebook(): void
    {
        $hr = User::factory()->create(['role' => 'hr']);

        $this->actingAs($hr)
            ->get(route('phonebook.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Phonebook/Index'));
    }

    public function test_hr_role_is_still_sent_to_the_phonebook_from_other_panel_pages(): void
    {
        $hr = User::factory()->create(['role' => 'hr']);

        $this->actingAs($hr)->get(route('positions.index'))->assertRedirect(route('phonebook.index'));
        $this->actingAs($hr)->getJson(route('positions.index'))->assertForbidden();
    }
}
