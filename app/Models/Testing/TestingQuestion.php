<?php

namespace App\Models\Testing;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestingQuestion extends Model
{
    protected $table = 'testing_questions';

    protected $fillable = [
        'test_id',
        'text',
        'type',
        'options',
        'correct_answers',
        'position',
        'meta',
    ];

    protected $casts = [
        'options' => 'array',
        'correct_answers' => 'array',
        'meta' => 'array',
    ];

    public function test(): BelongsTo
    {
        return $this->belongsTo(TestingTest::class, 'test_id');
    }
}
