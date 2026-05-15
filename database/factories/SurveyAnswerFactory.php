<?php

namespace Database\Factories;

use App\Models\SurveyAnswer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\SurveyAnswer>
 */
class SurveyAnswerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'survey_id' => \App\Models\Survey::factory(),
            'question_id' => \App\Models\SurveyQuestion::factory(),
            'rating_value' => $this->faker->numberBetween(1, 5),
            'text_answer' => $this->faker->paragraph(),
            'selected_option' => null,
        ];
    }
}
