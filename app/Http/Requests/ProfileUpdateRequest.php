<?php

namespace App\Http\Requests;

use App\Models\Department;
use App\Models\PositionChangeRequest;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
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
        $canEditAcademicBindings = $this->canEditAcademicBindings();

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
            'position_title' => ['prohibited'],
            'position_confirmed' => ['nullable', 'boolean'],
            'position_id' => ['nullable', 'integer', 'exists:positions,id'],
            'office_location' => ['nullable', 'string', 'max:255'],
            'telegram' => ['nullable', 'string', 'max:100'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'avatar_url' => ['nullable', 'url', 'max:2048'],
            'profile_visibility' => ['nullable', Rule::in(['public', 'internal', 'private'])],
            'faculty_id' => $canEditAcademicBindings
                ? ['nullable', 'integer', 'exists:faculties,id']
                : ['prohibited'],
            'department_id' => $canEditAcademicBindings
                ? ['nullable', 'integer', 'exists:departments,id']
                : ['prohibited'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $positionConfirmed = $this->input('position_confirmed');
            $positionId = $this->input('position_id');
            $user = $this->user();
            $hasPendingPositionRequest = $user instanceof User
                ? PositionChangeRequest::query()
                    ->where('user_id', $user->id)
                    ->where('status', 'pending')
                    ->exists()
                : false;

            if (($positionConfirmed === false || $positionConfirmed === 'false' || $positionConfirmed === 0 || $positionConfirmed === '0')
                && ! $hasPendingPositionRequest
                && ($positionId === null || $positionId === '')) {
                $validator->errors()->add('position_id', 'Выберите должность из списка, чтобы отправить заявку.');
            }

            if (! $this->canEditAcademicBindings()) {
                return;
            }

            $facultyId = $this->input('faculty_id');
            $departmentId = $this->input('department_id');

            if ($departmentId === null || $departmentId === '') {
                return;
            }

            $department = Department::query()->find((int) $departmentId, ['id', 'faculty_id']);

            if (! $department) {
                return;
            }

            if ($facultyId !== null && $facultyId !== '' && (int) $department->faculty_id !== (int) $facultyId) {
                $validator->errors()->add('department_id', 'Кафедра не относится к выбранному факультету.');
            }
        });
    }

    private function canEditAcademicBindings(): bool
    {
        $user = $this->user();

        if (! $user instanceof User) {
            return false;
        }

        $user->loadMissing('roleRef');

        $rawRole = strtolower(trim((string) ($user->role ?? '')));
        $relationRole = strtolower(trim((string) ($user->roleRef?->slug ?? '')));

        return $user->resolvedRoleSlug() === 'teacher'
            || ($rawRole === '' && $relationRole === '');
    }
}
