<?php

namespace App\Models\Questionnaire;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SurveyAnswer extends Model
{
    use HasFactory;

    protected $table = 'questionnaire_survey_answers';

    protected $fillable = [
        'response_id',
        'question_id',
        'option_id',
        'text_answer',
        'numeric_answer',
    ];

    protected $casts = [
        'numeric_answer' => 'float',
    ];

    public function response(): BelongsTo
    {
        return $this->belongsTo(SurveyResponse::class, 'response_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(SurveyQuestion::class, 'question_id');
    }

    public function option(): BelongsTo
    {
        return $this->belongsTo(SurveyOption::class, 'option_id');
    }
}
