<?php

namespace App\Http\Requests\Api\Questionnaire;

use Illuminate\Foundation\Http\FormRequest;

class StoreSurveyResponseRequest extends FormRequest
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
            'survey_id' => ['required', 'integer', 'exists:questionnaire_surveys,id'],
            'group_discipline_id' => ['required', 'integer', 'exists:questionnaire_group_disciplines,id'],
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.question_id' => ['required', 'integer', 'exists:questionnaire_survey_questions,id'],
            'answers.*.option_id' => ['nullable', 'integer', 'exists:questionnaire_survey_options,id'],
            'answers.*.text_answer' => ['nullable', 'string'],
            'answers.*.numeric_answer' => ['nullable', 'numeric'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'survey_id.required' => 'Выберите анкету.',
            'group_discipline_id.required' => 'Выберите дисциплину преподавателя.',
            'answers.required' => 'Передайте хотя бы один ответ.',
            'answers.*.question_id.required' => 'Для каждого ответа нужно указать вопрос.',
        ];
    }
}
