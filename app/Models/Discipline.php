<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Discipline extends Model
{
    /** @use HasFactory<\Database\Factories\DisciplineFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'user_id',
        'department_id',
        'description',
        'credit_hours',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Получить преподавателя дисциплины
     */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Получить факультет/кафедру дисциплины
     */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    /**
     * Получить группы, которым преподается дисциплина
     */
    public function groups(): BelongsToMany
    {
        return $this->belongsToMany(Group::class, 'discipline_group');
    }

    /**
     * Получить анкеты по этой дисциплине
     */
    public function surveys(): HasMany
    {
        return $this->hasMany(Survey::class);
    }

    /**
     * Получить среднюю оценку по дисциплине
     */
    public function getAverageRating(): float
    {
        $surveys = $this->surveys()->where('status', 'completed')->get();
        
        if ($surveys->isEmpty()) {
            return 0;
        }

        $totalRating = 0;
        $ratingCount = 0;

        foreach ($surveys as $survey) {
            $answers = $survey->answers()
                ->whereHas('question', function ($query) {
                    $query->where('type', 'rating');
                })
                ->get();

            foreach ($answers as $answer) {
                if ($answer->rating_value !== null) {
                    $totalRating += $answer->rating_value;
                    $ratingCount++;
                }
            }
        }

        return $ratingCount > 0 ? round($totalRating / $ratingCount, 2) : 0;
    }
}
