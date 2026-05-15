<?php

namespace Database\Factories;

use App\Models\Group;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Group>
 */
class GroupFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->unique()->regexify('[A-Z]{3}-[0-9]{2}-[0-9]'),
            'code' => $this->faker->unique()->regexify('[A-Z0-9]{6}'),
            'description' => $this->faker->sentence(),
        ];
    }
}
