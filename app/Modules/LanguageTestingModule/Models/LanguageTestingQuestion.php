<?php

namespace App\Modules\LanguageTestingModule\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LanguageTestingQuestion extends Model
{
    use HasFactory;

    protected $table = 'language_testing_questions';

    protected $fillable = [
        'language_testing_test_id',
        'question',
        'question_type',
        'points',
        'sort_order',
    ];

    protected $casts = [
        'points' => 'integer',
        'sort_order' => 'integer',
    ];

    public function test(): BelongsTo
    {
        return $this->belongsTo(LanguageTestingTest::class, 'language_testing_test_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(LanguageTestingAnswer::class, 'language_testing_question_id')->orderBy('sort_order')->orderBy('id');
    }
}