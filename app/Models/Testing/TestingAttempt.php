<?php

namespace App\Models\Testing;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TestingAttempt extends Model
{
    protected $table = 'testing_attempts';

    protected $fillable = [
        'student_id',
        'test_id',
        'teacher_binding_id',
        'subject_id',
        'started_at',
        'finished_at',
        'score',
        'percentage',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'score' => 'decimal:2',
        'percentage' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function test(): BelongsTo
    {
        return $this->belongsTo(TestingTest::class, 'test_id');
    }

    public function teacherBinding(): BelongsTo
    {
        return $this->belongsTo(TestingBinding::class, 'teacher_binding_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(TestingSubject::class, 'subject_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(TestingAttemptAnswer::class, 'attempt_id');
    }
}
