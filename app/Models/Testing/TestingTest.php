<?php

namespace App\Models\Testing;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TestingTest extends Model
{
    protected $table = 'testing_tests';

    protected $fillable = [
        'binding_id',
        'title',
        'description',
        'status',
        'question_count',
        'shuffle_questions',
        'passing_score',
        'time_limit_minutes',
        'max_attempts',
        'settings',
    ];

    protected $casts = [
        'shuffle_questions' => 'boolean',
        'passing_score' => 'decimal:2',
        'time_limit_minutes' => 'integer',
        'max_attempts' => 'integer',
        'settings' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function binding(): BelongsTo
    {
        return $this->belongsTo(TestingBinding::class, 'binding_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(TestingQuestion::class, 'test_id')->orderBy('position');
    }

    public function results(): HasMany
    {
        return $this->hasMany(TestingResult::class, 'test_id');
    }
}
