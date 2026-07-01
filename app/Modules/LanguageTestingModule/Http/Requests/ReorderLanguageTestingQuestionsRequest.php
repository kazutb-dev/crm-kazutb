<?php

namespace App\Modules\LanguageTestingModule\Http\Requests;

use App\Modules\LanguageTestingModule\Support\LanguageTestingAccess;
use Illuminate\Foundation\Http\FormRequest;

class ReorderLanguageTestingQuestionsRequest extends FormRequest
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
            'question_ids' => ['required', 'array', 'min:1'],
            'question_ids.*' => ['required', 'integer', 'distinct'],
        ];
    }
}