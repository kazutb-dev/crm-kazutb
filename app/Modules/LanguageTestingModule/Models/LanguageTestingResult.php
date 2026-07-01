<?php

namespace App\Modules\LanguageTestingModule\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LanguageTestingResult extends Model
{
    use HasFactory;

    public const STATUS_PASSED = 'passed';

    public const STATUS_FAILED = 'failed';

    protected $table = 'language_testing_results';

    protected $fillable = [
        'language_testing_session_id',
        'language_testing_test_id',
        'student_id',
        'iin',
        'first_name',
        'middle_name',
        'last_name',
        'email',
        'phone',
        'language',
        'test_name',
        'score',
        'percentage',
        'correct_answers',
        'total_questions',
        'status',
        'submitted_at',
    ];

    protected $casts = [
        'score' => 'integer',
        'percentage' => 'decimal:2',
        'correct_answers' => 'integer',
        'total_questions' => 'integer',
        'submitted_at' => 'datetime',
    ];

    public function test(): BelongsTo
    {
        return $this->belongsTo(LanguageTestingTest::class, 'language_testing_test_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(LanguageTestingSession::class, 'language_testing_session_id');
    }
}