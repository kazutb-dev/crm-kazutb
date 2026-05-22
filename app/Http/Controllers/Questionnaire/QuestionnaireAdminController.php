<?php

namespace App\Http\Controllers\Questionnaire;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QuestionnaireAdminController extends Controller
{
    public function groupsPage(): Response
    {
        return Inertia::render('Questionnaire/Admin/Groups');
    }

    public function settings(): Response
    {
        return Inertia::render('Questionnaire/Admin/Groups');
    }

    public function studentsPage(): Response
    {
        return Inertia::render('Questionnaire/Admin/Students');
    }

    public function groupDetailsPage(int $groupId): Response
    {
        return Inertia::render('Questionnaire/Admin/GroupDetails', [
            'groupId' => $groupId,
        ]);
    }

    public function disciplinesPage(): Response
    {
        return Inertia::render('Questionnaire/Admin/Disciplines');
    }

    public function specialitiesPage(): Response
    {
        return Inertia::render('Questionnaire/Admin/Specialities');
    }

    public function teacherDisciplinesPage(): Response
    {
        return Inertia::render('Questionnaire/Admin/TeacherDisciplines');
    }

    public function groupAssignmentsPage(): Response
    {
        return Inertia::render('Questionnaire/Admin/GroupAssignments');
    }

    public function surveysPage(): Response
    {
        return Inertia::render('Questionnaire/Admin/Questions');
    }

    public function questionsPage(): Response
    {
        return Inertia::render('Questionnaire/Admin/Questions');
    }

    public function reports(): Response
    {
        return Inertia::render('Questionnaire/Admin/Reports');
    }

    public function __call(string $name, array $arguments)
    {
        $request = collect($arguments)->first(fn ($arg) => $arg instanceof Request);

        return ($request ? back() : redirect()->route('questionnaire.admin.groups'))
            ->with('error', 'Функция раздела "Анкетирование" пока не реализована в новом questionnaire модуле.');
    }
}
