<?php

namespace App\Modules\LanguageTestingModule\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'session_id' => ['required', 'uuid'],
            'student_id' => ['nullable', 'string', 'max:190'],
            'iin' => ['nullable', 'digits:12'],
            'first_name' => ['required', 'string', 'max:190'],
            'middle_name' => ['nullable', 'string', 'max:190'],
            'last_name' => ['required', 'string', 'max:190'],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:50', 'regex:/^\+?[0-9][0-9\-\(\)\s]{6,24}$/'],
            'answers' => ['required', 'array', 'min:1', 'max:500'],
            'answers.*.question_id' => ['required', 'integer'],
            'answers.*.answer_id' => ['nullable', 'integer'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $answers = collect($this->input('answers', []));
            $questionIds = $answers->pluck('question_id')->filter(fn ($value): bool => $value !== null)->map(fn ($value): int => (int) $value);

            if ($questionIds->count() !== $questionIds->unique()->count()) {
                $validator->errors()->add('answers', 'Each question may be submitted only once.');
            }
        });
    }
}
