<?php

namespace Database\Factories;

use App\Models\Student;
use App\Models\Group;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Student>
 */
class StudentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'first_name' => $this->faker->firstName('ru_RU'),
            'last_name' => $this->faker->lastName('ru_RU'),
            'middle_name' => $this->faker->firstName('ru_RU'),
            'student_id' => $this->faker->unique()->numerify('STU-######'),
            'email' => $this->faker->unique()->safeEmail(),
            'phone' => $this->faker->phoneNumber(),
            'group_id' => Group::factory(),
        ];
    }
}
