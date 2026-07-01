<?php

namespace App\Modules\LanguageTestingModule\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingQuestionFiltersData;
use App\Modules\LanguageTestingModule\Http\Requests\ReorderLanguageTestingQuestionsRequest;
use App\Modules\LanguageTestingModule\Http\Requests\UpsertLanguageTestingQuestionRequest;
use App\Modules\LanguageTestingModule\Models\LanguageTestingQuestion;
use App\Modules\LanguageTestingModule\Models\LanguageTestingTest;
use App\Modules\LanguageTestingModule\Services\LanguageTestingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LanguageTestingQuestionController extends Controller
{
    public function __construct(
        private readonly LanguageTestingService $languageTestingService,
    ) {
    }

    public function index(Request $request, LanguageTestingTest $languageTestingTest): Response
    {
        $this->authorize('viewAny', LanguageTestingQuestion::class);

        $filters = LanguageTestingQuestionFiltersData::fromRequest($request);
        $questions = $this->languageTestingService->paginateQuestions($languageTestingTest, $filters);

        return Inertia::render('LanguageTesting/Questions/Index', [
            'test' => $this->languageTestingService->serializeTest($languageTestingTest->loadCount('questions')),
            'questions' => collect($questions->items())->map(fn (LanguageTestingQuestion $question): array => $this->languageTestingService->serializeQuestion($question))->all(),
            'filters' => [
                'q' => $filters->q,
                'sort' => $filters->sort,
                'direction' => $filters->direction,
                'per_page' => $filters->perPage,
            ],
            'pagination' => [
                'current_page' => $questions->currentPage(),
                'last_page' => $questions->lastPage(),
                'per_page' => $questions->perPage(),
                'total' => $questions->total(),
            ],
            'permissions' => [
                'canManage' => $request->user()?->can('create', LanguageTestingQuestion::class) ?? false,
            ],
        ]);
    }

    public function store(UpsertLanguageTestingQuestionRequest $request, LanguageTestingTest $languageTestingTest): RedirectResponse
    {
        $this->languageTestingService->createQuestion($languageTestingTest, $request->validated());

        return back()->with('success', 'Вопрос добавлен.');
    }

    public function update(UpsertLanguageTestingQuestionRequest $request, LanguageTestingQuestion $languageTestingQuestion): RedirectResponse
    {
        $this->authorize('update', $languageTestingQuestion);
        $this->languageTestingService->updateQuestion($languageTestingQuestion, $request->validated());

        return back()->with('success', 'Вопрос обновлен.');
    }

    public function destroy(LanguageTestingQuestion $languageTestingQuestion): RedirectResponse
    {
        $this->authorize('delete', $languageTestingQuestion);
        $this->languageTestingService->deleteQuestion($languageTestingQuestion);

        return back()->with('success', 'Вопрос удален.');
    }

    public function reorder(ReorderLanguageTestingQuestionsRequest $request, LanguageTestingTest $languageTestingTest): RedirectResponse
    {
        $this->languageTestingService->reorderQuestions($languageTestingTest, $request->validated('question_ids'));

        return back()->with('success', 'Порядок вопросов обновлен.');
    }
}