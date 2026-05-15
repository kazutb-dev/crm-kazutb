<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SurveyQuestion extends Model
{
    /** @use HasFactory<\Database\Factories\SurveyQuestionFactory> */
    use HasFactory;

    protected $table = 'survey_questions';

    protected $fillable = [
        'text',
        'order',
        'type',
        'min_rating',
        'max_rating',
        'is_required',
        'is_active',
    ];

    protected $casts = [
        'is_required' => 'boolean',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Получить ответы на этот вопрос
     */
    public function answers(): HasMany
    {
        return $this->hasMany(SurveyAnswer::class, 'question_id');
    }

    /**
     * Получить все активные вопросы
     */
    public static function active()
    {
        return self::where('is_active', true)->orderBy('order');
    }

    /**
     * Получить среднее значение рейтинга для этого вопроса
     */
    public function getAverageRating(): float
    {
        if ($this->type !== 'rating') {
            return 0;
        }

        $answers = $this->answers()
            ->whereNotNull('rating_value')
            ->get();

        if ($answers->isEmpty()) {
            return 0;
        }

        return round($answers->avg('rating_value'), 2);
    }
}
