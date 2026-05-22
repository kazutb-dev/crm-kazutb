<?php

namespace App\Http\Controllers\Api\Questionnaire;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Questionnaire\StoreSurveyResponseRequest;
use App\Models\User;
use App\Services\Questionnaire\QuestionnaireSurveyService;
use Illuminate\Http\JsonResponse;
use Throwable;

class StudentSurveyController extends Controller
{
    public function index(QuestionnaireSurveyService $surveyService): JsonResponse
    {
        $user = request()->user();

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'Не авторизован.',
            ], 401);
        }

        if ($user->resolvedRoleSlug() !== 'student') {
            return response()->json([
                'message' => 'Раздел доступен только студентам.',
            ], 403);
        }

        try {
            return response()->json([
                'data' => $surveyService->getAvailableSurveysForStudent($user),
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    public function store(StoreSurveyResponseRequest $request, QuestionnaireSurveyService $surveyService): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'Не авторизован.',
            ], 401);
        }

        if ($user->resolvedRoleSlug() !== 'student') {
            return response()->json([
                'message' => 'Раздел доступен только студентам.',
            ], 403);
        }

        $response = $surveyService->submitSurvey($user, $request->validated());

        return response()->json([
            'message' => 'Ответы успешно сохранены.',
            'data' => [
                'response_id' => $response->id,
                'submitted_at' => optional($response->submitted_at)->toDateTimeString(),
            ],
        ], 201);
    }
}
