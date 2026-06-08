<?php

namespace App\Http\Requests;

use App\Models\GovernanceAccessRequest;
use App\Models\PositionChangeRequest;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ProfileUpdateRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'string',
                // 'lowercase',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($this->user()->id),
            ],
            'phone' => ['nullable', 'string', 'max:30'],
            'position_title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'position_confirmed' => ['sometimes', 'nullable', 'boolean'],
            'position_id' => ['sometimes', 'nullable', 'integer', 'exists:positions,id'],
            'office_location' => ['nullable', 'string', 'max:255'],
            'telegram' => ['nullable', 'string', 'max:100'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'avatar_url' => ['nullable', 'url', 'max:2048'],
            'profile_visibility' => ['sometimes', 'nullable', Rule::in(['public', 'internal', 'private'])],
            'faculty_id' => ['sometimes', 'nullable', 'integer', 'exists:faculties,id'],
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
            'request_comment' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $positionConfirmed = $this->input('position_confirmed');
            $positionId = $this->input('position_id');
            $user = $this->user();
            $hasPendingPositionRequest = false;

            if ($user instanceof User && Schema::hasTable('governance_access_requests')) {
                $hasPendingPositionRequest = GovernanceAccessRequest::query()
                    ->where('subject_user_id', $user->id)
                    ->where('request_type', GovernanceAccessRequest::TYPE_POSITION)
                    ->where('status', GovernanceAccessRequest::STATUS_PENDING)
                    ->exists();
            } elseif ($user instanceof User && Schema::hasTable('position_change_requests')) {
                $hasPendingPositionRequest = PositionChangeRequest::query()
                    ->where('user_id', $user->id)
                    ->where('status', 'pending')
                    ->exists();
            }

            if (($positionConfirmed === false || $positionConfirmed === 'false' || $positionConfirmed === 0 || $positionConfirmed === '0')
                && ! $hasPendingPositionRequest
                && ($positionId === null || $positionId === '')
            ) {
                $validator->errors()->add('position_id', 'Выберите должность из списка, чтобы отправить заявку.');
            }

            if ($this->filled('department_id') && ! $this->filled('faculty_id')) {
                $validator->errors()->add('faculty_id', 'Для заявки на кафедру необходимо указать факультет.');
            }
        });
    }
}
