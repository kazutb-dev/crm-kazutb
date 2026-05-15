<?php

namespace App\Policies;

use App\Models\SurveyQuestion;
use App\Models\User;

class SurveyQuestionPolicy
{
    /**
     * Determine whether the user can view any question.
     */
    public function viewAny(User $user): bool
    {
        return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin']);
    }

    /**
     * Determine whether the user can view the question.
     */
    public function view(User $user, SurveyQuestion $question): bool
    {
        return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin']);
    }

    /**
     * Determine whether the user can create questions.
     */
    public function create(User $user): bool
    {
        return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin']);
    }

    /**
     * Determine whether the user can update the question.
     */
    public function update(User $user, SurveyQuestion $question): bool
    {
        return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin']);
    }

    /**
     * Determine whether the user can delete the question.
     */
    public function delete(User $user, SurveyQuestion $question): bool
    {
        return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin']);
    }
}
