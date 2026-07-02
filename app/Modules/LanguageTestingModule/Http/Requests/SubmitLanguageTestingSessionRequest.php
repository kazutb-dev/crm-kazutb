<?php

namespace App\Modules\LanguageTestingModule\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitLanguageTestingSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $payload = $this->all();

        if (! isset($payload['student_id'])) {
            $payload['student_id'] = $payload['applicant_id']
                ?? $payload['applicantId']
                ?? $payload['studentId']
                ?? null;
        }

        if (isset($payload['iin'])) {
            $payload['iin'] = preg_replace('/\D+/', '', (string) $payload['iin']);
        }

        if (! isset($payload['first_name']) || ! isset($payload['last_name'])) {
            $name = trim((string) ($payload['full_name'] ?? $payload['fullName'] ?? $payload['name'] ?? ''));
            $parts = preg_split('/\s+/', $name, -1, PREG_SPLIT_NO_EMPTY) ?: [];

            if (count($parts) >= 2) {
                $payload['last_name'] ??= (string) array_shift($parts);
                $payload['first_name'] ??= (string) array_shift($parts);
                $payload['middle_name'] ??= count($parts) > 0 ? implode(' ', $parts) : null;
            }
        }

        if (isset($payload['answers']) && is_array($payload['answers'])) {
            $payload['answers'] = array_map(static function (mixed $answer): mixed {
                if (! is_array($answer)) {
                    return $answer;
                }

                if (! array_key_exists('question_id', $answer)) {
                    $answer['question_id'] = $answer['questionId'] ?? $answer['question'] ?? null;
                }

                if (! array_key_exists('answer_id', $answer)) {
                    $answer['answer_id'] = $answer['answerId'] ?? $answer['selected_answer_id'] ?? $answer['selectedAnswerId'] ?? null;
                }

                return $answer;
            }, $payload['answers']);
        }

        $this->replace($payload);
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
