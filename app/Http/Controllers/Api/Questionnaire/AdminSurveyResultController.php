<?php

namespace App\Http\Controllers\Api\Questionnaire;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Questionnaire\AdminSurveyResultsRequest;
use App\Models\User;
use App\Services\Questionnaire\QuestionnaireResultService;
use Illuminate\Http\JsonResponse;

class AdminSurveyResultController extends Controller
{
    public function index(AdminSurveyResultsRequest $request, QuestionnaireResultService $resultService): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'Не авторизован.',
            ], 401);
        }

        if (! in_array((string) $user->resolvedRoleSlug(), ['admin', 'superadmin'], true)) {
            return response()->json([
                'message' => 'Недостаточно прав для просмотра результатов.',
            ], 403);
        }

        return response()->json([
            'data' => $resultService->getResults($request->validated()),
        ]);
    }
}
