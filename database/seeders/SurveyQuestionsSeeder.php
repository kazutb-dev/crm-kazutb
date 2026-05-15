<?php

namespace Database\Seeders;

use App\Models\SurveyQuestion;
use Illuminate\Database\Seeder;

class SurveyQuestionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $questions = [
            [
                'text' => 'Насколько понятно преподаватель объясняет материал?',
                'order' => 1,
                'type' => 'rating',
                'min_rating' => 1,
                'max_rating' => 5,
                'is_required' => true,
                'is_active' => true,
            ],
            [
                'text' => 'Насколько преподаватель подготовлен к занятиям?',
                'order' => 2,
                'type' => 'rating',
                'min_rating' => 1,
                'max_rating' => 5,
                'is_required' => true,
                'is_active' => true,
            ],
            [
                'text' => 'Насколько полезны занятия для развития компетенций?',
                'order' => 3,
                'type' => 'rating',
                'min_rating' => 1,
                'max_rating' => 5,
                'is_required' => true,
                'is_active' => true,
            ],
            [
                'text' => 'Насколько преподаватель вовлечен в процесс обучения?',
                'order' => 4,
                'type' => 'rating',
                'min_rating' => 1,
                'max_rating' => 5,
                'is_required' => true,
                'is_active' => true,
            ],
            [
                'text' => 'Общая оценка преподавателя по данной дисциплине',
                'order' => 5,
                'type' => 'rating',
                'min_rating' => 1,
                'max_rating' => 5,
                'is_required' => true,
                'is_active' => true,
            ],
            [
                'text' => 'Замечания и пожелания преподавателю',
                'order' => 6,
                'type' => 'text',
                'is_required' => false,
                'is_active' => true,
            ],
        ];

        foreach ($questions as $question) {
            SurveyQuestion::firstOrCreate(
                ['text' => $question['text']],
                $question
            );
        }
    }
}
