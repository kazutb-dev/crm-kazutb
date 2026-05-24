<?php

namespace App\Http\Controllers\Questionnaire;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QuestionnaireStudentWebController extends Controller
{
    public function index(): Response
    {
        $this->ensureStudentRole();

        return Inertia::render('Questionnaire/Student/Index', [
            'selectedSurveyId' => null,
        ]);
    }

    public function take(int $surveyId): Response
    {
        $this->ensureStudentRole();

        return Inertia::render('Questionnaire/Student/Index', [
            'selectedSurveyId' => $surveyId,
        ]);
    }

    public function submit(Request $request)
    {
        $this->ensureStudentRole();

        return redirect()
            ->route('questionnaire.student.index')
            ->with('error', 'Используйте новый API: POST /api/questionnaire/student/surveys/submit');
    }

    private function ensureStudentRole(): void
    {
        $user = request()->user();

        abort_if(! $user || $user->resolvedRoleSlug() !== 'student', 403, 'Раздел доступен только студентам.');
    }
}
