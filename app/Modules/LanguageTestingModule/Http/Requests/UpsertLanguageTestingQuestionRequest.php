<?php

namespace App\Modules\LanguageTestingModule\Http\Requests;

use App\Modules\LanguageTestingModule\Support\LanguageTestingAccess;
use Illuminate\Foundation\Http\FormRequest;

class UpsertLanguageTestingQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return LanguageTestingAccess::canManage($this->user());
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'question' => ['required', 'string'],
            'points' => ['required', 'integer', 'min:1', 'max:100'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'options' => ['required', 'array', 'min:2', 'max:10'],
            'options.*.text' => ['required', 'string', 'max:1000'],
            'options.*.is_correct' => ['required', 'boolean'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $options = collect($this->input('options', []));
            $correctCount = $options->filter(fn ($option): bool => (bool) ($option['is_correct'] ?? false))->count();

            if ($correctCount !== 1) {
                $validator->errors()->add('options', 'Для вопроса должен быть выбран ровно один правильный ответ.');
            }
        });
    }
}