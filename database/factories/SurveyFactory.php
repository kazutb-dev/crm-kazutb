<?php

namespace Database\Factories;

use App\Models\Survey;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Survey>
 */
class SurveyFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'student_id' => \App\Models\Student::factory(),
            'teacher_id' => \App\Models\User::factory(),
            'discipline_id' => \App\Models\Discipline::factory(),
            'group_id' => \App\Models\Group::factory(),
            'status' => $this->faker->randomElement(['draft', 'in_progress', 'completed']),
            'started_at' => $this->faker->dateTimeThisMonth(),
            'completed_at' => $this->faker->dateTimeThisMonth(),
            'notes' => $this->faker->paragraph(),
        ];
    }
}
