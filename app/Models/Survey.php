<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Survey extends Model
{
    /** @use HasFactory<\Database\Factories\SurveyFactory> */
    use HasFactory;

    protected $fillable = [
        'student_id',
        'teacher_id',
        'discipline_id',
        'group_id',
        'status',
        'started_at',
        'completed_at',
        'notes',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Получить студента
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * Получить преподавателя
     */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    /**
     * Получить дисциплину
     */
    public function discipline(): BelongsTo
    {
        return $this->belongsTo(Discipline::class);
    }

    /**
     * Получить группу
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    /**
     * Получить ответы на анкету
     */
    public function answers(): HasMany
    {
        return $this->hasMany(SurveyAnswer::class);
    }

    /**
     * Отметить анкету как начатую
     */
    public function start(): void
    {
        if ($this->status === 'draft') {
            $this->update([
                'status' => 'in_progress',
                'started_at' => now(),
            ]);
        }
    }

    /**
     * Завершить заполнение анкеты
     */
    public function complete(): void
    {
        $this->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);
    }

    /**
     * Отменить анкету
     */
    public function cancel(): void
    {
        $this->update(['status' => 'cancelled']);
    }

    /**
     * Получить среднюю оценку по всем вопросам типа рейтинг
     */
    public function getAverageRating(): float
    {
        $ratingAnswers = $this->answers()
            ->whereHas('question', function ($query) {
                $query->where('type', 'rating');
            })
            ->whereNotNull('rating_value')
            ->get();

        if ($ratingAnswers->isEmpty()) {
            return 0;
        }

        return round($ratingAnswers->avg('rating_value'), 2);
    }

    /**
     * Проверить, заполнены ли все обязательные вопросы
     */
    public function areRequiredAnswersComplete(): bool
    {
        $requiredQuestions = SurveyQuestion::where('is_required', true)
            ->where('is_active', true)
            ->get();

        foreach ($requiredQuestions as $question) {
            $answer = $this->answers()
                ->where('question_id', $question->id)
                ->first();

            if (!$answer || ($question->type === 'rating' && $answer->rating_value === null) ||
                ($question->type === 'text' && empty($answer->text_answer))) {
                return false;
            }
        }

        return true;
    }
}
