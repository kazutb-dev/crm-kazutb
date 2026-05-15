<?php

namespace App\Policies;

use App\Models\Survey;
use App\Models\User;

class SurveyPolicy
{
    public function view(User $user, Survey $survey)
    {
        if ($user->role === 'admin' || $user->role === 'superadmin') {
            return true;
        }
        if ($user->role === 'teacher' && $survey->teacher_id === $user->id) {
            return true;
        }
        if ($user->role === 'student' && $survey->student && $survey->student->user_id === $user->id) {
            return true;
        }
        return false;
    }

    public function viewAny(User $user)
    {
        return in_array($user->role, ['admin', 'superadmin', 'teacher', 'student']);
    }

    public function create(User $user)
    {
        return in_array($user->role, ['admin', 'superadmin']);
    }

    public function update(User $user, Survey $survey)
    {
        return in_array($user->role, ['admin', 'superadmin']);
    }

    public function delete(User $user, Survey $survey)
    {
        return in_array($user->role, ['admin', 'superadmin']);
    }

    public function complete(User $user, Survey $survey)
    {
        return $user->role === 'student' && $survey->student && $survey->student->user_id === $user->id;
    }
}
