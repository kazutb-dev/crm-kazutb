<?php

namespace Database\Factories;

use App\Models\SurveyQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\SurveyQuestion>
 */
class SurveyQuestionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'text' => $this->faker->sentence(),
            'order' => $this->faker->numberBetween(0, 10),
            'type' => 'rating',
            'min_rating' => 1,
            'max_rating' => 5,
            'is_required' => true,
            'is_active' => true,
        ];
    }
}
