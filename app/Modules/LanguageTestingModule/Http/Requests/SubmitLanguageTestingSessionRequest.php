<?php

namespace App\Modules\LanguageTestingModule\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitLanguageTestingSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'session_id' => ['required', 'string', 'max:100'],
            'student_id' => ['nullable', 'string', 'max:190'],
            'iin' => ['nullable', 'string', 'max:20'],
            'first_name' => ['required', 'string', 'max:190'],
            'middle_name' => ['nullable', 'string', 'max:190'],
            'last_name' => ['required', 'string', 'max:190'],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:50'],
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.question_id' => ['required', 'integer'],
            'answers.*.answer_id' => ['nullable', 'integer'],
        ];
    }
}