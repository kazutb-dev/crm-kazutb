<?php

namespace App\Models\Testing;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestingResult extends Model
{
    protected $table = 'testing_results';

    protected $fillable = [
        'test_id',
        'user_id',
        'correct_answers_count',
        'score',
        'passed',
        'completed_at',
        'details',
    ];

    protected $casts = [
        'score' => 'decimal:2',
        'passed' => 'boolean',
        'completed_at' => 'datetime',
        'details' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function test(): BelongsTo
    {
        return $this->belongsTo(TestingTest::class, 'test_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
