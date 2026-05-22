<?php

namespace App\Http\Requests\Api\Questionnaire;

use Illuminate\Foundation\Http\FormRequest;

class AdminSurveyResultsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'survey_id' => ['nullable', 'integer', 'exists:questionnaire_surveys,id'],
            'group_id' => ['nullable', 'integer', 'exists:questionnaire_groups,id'],
            'teacher_id' => ['nullable', 'integer', 'exists:users,id'],
            'discipline_id' => ['nullable', 'integer', 'exists:questionnaire_disciplines,id'],
            'academic_year' => ['nullable', 'string', 'max:20'],
            'semester' => ['nullable', 'string', 'max:20'],
        ];
    }
}
