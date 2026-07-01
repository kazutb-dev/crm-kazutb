<?php

namespace App\Modules\LanguageTestingModule\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingListFiltersData;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingQuestionFiltersData;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingSubmissionData;
use App\Modules\LanguageTestingModule\Http\Controllers\Api\V1\Concerns\InteractsWithLanguageTestingApi;
use App\Modules\LanguageTestingModule\Http\Requests\SubmitLanguageTestingSessionRequest;
use App\Modules\LanguageTestingModule\Http\Requests\UpsertLanguageTestingQuestionRequest;
use App\Modules\LanguageTestingModule\Http\Requests\UpsertLanguageTestingTestRequest;
use App\Modules\LanguageTestingModule\Models\LanguageTestingQuestion;
use App\Modules\LanguageTestingModule\Models\LanguageTestingTest;
use App\Modules\LanguageTestingModule\Services\LanguageTestingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LanguageTestingApiController extends Controller
{
    use InteractsWithLanguageTestingApi;

    public function __construct(
        private readonly LanguageTestingService $languageTestingService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $filters = LanguageTestingListFiltersData::fromRequest($request);

        $tests = $this->consumer($request) === 'integration'
            ? $this->languageTestingService->paginateActiveTests($filters)
            : $this->languageTestingService->paginateTests($filters);

        return $this->success([
            'data' => collect($tests->items())->map(fn (LanguageTestingTest $test): array => $this->languageTestingService->serializeTest($test))->all(),
            'meta' => [
                'current_page' => $tests->currentPage(),
                'last_page' => $tests->lastPage(),
                'per_page' => $tests->perPage(),
                'total' => $tests->total(),
            ],
        ]);
    }

    public function show(Request $request, LanguageTestingTest $languageTestingTest): JsonResponse
    {
        $languageTestingTest->refresh();

        if ($this->consumer($request) === 'integration' && $languageTestingTest->status !== LanguageTestingTest::STATUS_ACTIVE) {
            abort(404);
        }

        return $this->success([
            'data' => $this->languageTestingService->serializeTest($languageTestingTest->loadCount('questions')),
        ]);
    }

    public function store(UpsertLanguageTestingTestRequest $request): JsonResponse
    {
        $this->ensureCrmConsumer($request);

        $test = $this->languageTestingService->createTest($request->validated());

        return $this->success([
            'data' => $this->languageTestingService->serializeTest($test),
        ], 201);
    }

    public function update(UpsertLanguageTestingTestRequest $request, LanguageTestingTest $languageTestingTest): JsonResponse
    {
        $this->ensureCrmConsumer($request);

        $test = $this->languageTestingService->updateTest($languageTestingTest, $request->validated());

        return $this->success([
            'data' => $this->languageTestingService->serializeTest($test),
        ]);
    }

    public function destroy(Request $request, LanguageTestingTest $languageTestingTest): JsonResponse
    {
        $this->ensureCrmConsumer($request);
        $this->languageTestingService->deleteTest($languageTestingTest);

        return response()->json([], 204);
    }

    public function questions(Request $request, LanguageTestingTest $languageTestingTest): JsonResponse
    {
        $this->ensureCrmConsumer($request);

        $filters = LanguageTestingQuestionFiltersData::fromRequest($request);
        $questions = $this->languageTestingService->paginateQuestions($languageTestingTest, $filters);

        return $this->success([
            'data' => collect($questions->items())->map(fn (LanguageTestingQuestion $question): array => $this->languageTestingService->serializeQuestion($question))->all(),
            'meta' => [
                'current_page' => $questions->currentPage(),
                'last_page' => $questions->lastPage(),
                'per_page' => $questions->perPage(),
                'total' => $questions->total(),
            ],
        ]);
    }

    public function storeQuestion(UpsertLanguageTestingQuestionRequest $request, LanguageTestingTest $languageTestingTest): JsonResponse
    {
        $this->ensureCrmConsumer($request);

        $question = $this->languageTestingService->createQuestion($languageTestingTest, $request->validated());

        return $this->success([
            'data' => $this->languageTestingService->serializeQuestion($question),
        ], 201);
    }

    public function updateQuestion(UpsertLanguageTestingQuestionRequest $request, LanguageTestingQuestion $languageTestingQuestion): JsonResponse
    {
        $this->ensureCrmConsumer($request);

        $question = $this->languageTestingService->updateQuestion($languageTestingQuestion, $request->validated());

        return $this->success([
            'data' => $this->languageTestingService->serializeQuestion($question),
        ]);
    }

    public function destroyQuestion(Request $request, LanguageTestingQuestion $languageTestingQuestion): JsonResponse
    {
        $this->ensureCrmConsumer($request);
        $this->languageTestingService->deleteQuestion($languageTestingQuestion);

        return response()->json([], 204);
    }

    public function start(Request $request, LanguageTestingTest $languageTestingTest): JsonResponse
    {
        $this->ensureIntegrationConsumer($request);

        $languageTestingTest->refresh();

        return $this->success($this->languageTestingService->startSession($languageTestingTest));
    }

    public function submit(SubmitLanguageTestingSessionRequest $request, LanguageTestingTest $languageTestingTest): JsonResponse
    {
        $this->ensureIntegrationConsumer($request);

        return $this->success($this->languageTestingService->submitSession(
            $languageTestingTest,
            LanguageTestingSubmissionData::fromValidated($request->validated()),
        ));
    }
}