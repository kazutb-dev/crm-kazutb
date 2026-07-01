<?php

namespace App\Modules\LanguageTestingModule\Http\Requests;

use App\Modules\LanguageTestingModule\Support\LanguageTestingAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertLanguageTestingTestRequest extends FormRequest
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
        $testId = $this->route('languageTestingTest')?->id ?? $this->route('languageTestingTest');

        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('language_testing_tests', 'name')->ignore($testId)],
            'language' => ['required', 'string', Rule::in(array_keys(config('language_testing_module.languages', [])))],
            'description' => ['nullable', 'string'],
            'passing_score' => ['required', 'integer', 'min:1', 'max:100'],
            'total_questions' => ['required', 'integer', 'min:1', 'max:500'],
            'status' => ['required', 'string', Rule::in(['active', 'inactive'])],
        ];
    }
}