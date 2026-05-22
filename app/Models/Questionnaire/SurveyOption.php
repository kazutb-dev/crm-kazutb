<?php

namespace App\Models\Questionnaire;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SurveyOption extends Model
{
    use HasFactory;

    protected $table = 'questionnaire_survey_options';

    protected $fillable = [
        'question_id',
        'option_text',
        'score',
        'sort_order',
    ];

    protected $casts = [
        'score' => 'float',
    ];

    public function question(): BelongsTo
    {
        return $this->belongsTo(SurveyQuestion::class, 'question_id');
    }
}
