<?php

namespace App\Modules\LanguageTestingModule\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class LanguageTestingSession extends Model
{
    use HasFactory;

    public const STATUS_STARTED = 'started';

    public const STATUS_SUBMITTED = 'submitted';

    protected $table = 'language_testing_sessions';

    protected $fillable = [
        'public_session_id',
        'language_testing_test_id',
        'student_id',
        'iin',
        'first_name',
        'middle_name',
        'last_name',
        'email',
        'phone',
        'question_payload',
        'submitted_answers',
        'score',
        'percentage',
        'correct_answers',
        'total_questions',
        'status',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'question_payload' => 'array',
        'submitted_answers' => 'array',
        'score' => 'integer',
        'percentage' => 'decimal:2',
        'correct_answers' => 'integer',
        'total_questions' => 'integer',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function test(): BelongsTo
    {
        return $this->belongsTo(LanguageTestingTest::class, 'language_testing_test_id');
    }

    public function result(): HasOne
    {
        return $this->hasOne(LanguageTestingResult::class, 'language_testing_session_id');
    }
}