<?php

namespace App\Modules\LanguageTestingModule\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LanguageTestingAnswer extends Model
{
    use HasFactory;

    protected $table = 'language_testing_answers';

    protected $fillable = [
        'language_testing_question_id',
        'answer',
        'is_correct',
        'sort_order',
    ];

    protected $casts = [
        'is_correct' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function question(): BelongsTo
    {
        return $this->belongsTo(LanguageTestingQuestion::class, 'language_testing_question_id');
    }
}