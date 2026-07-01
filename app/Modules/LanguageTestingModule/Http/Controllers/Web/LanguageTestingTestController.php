<?php

namespace App\Modules\LanguageTestingModule\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingListFiltersData;
use App\Modules\LanguageTestingModule\Http\Requests\UpsertLanguageTestingTestRequest;
use App\Modules\LanguageTestingModule\Models\LanguageTestingTest;
use App\Modules\LanguageTestingModule\Services\LanguageTestingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LanguageTestingTestController extends Controller
{
    public function __construct(
        private readonly LanguageTestingService $languageTestingService,
    ) {
    }

    public function index(Request $request): Response
    {
        $this->authorize('viewAny', LanguageTestingTest::class);

        $filters = LanguageTestingListFiltersData::fromRequest($request);
        $tests = $this->languageTestingService->paginateTests($filters);

        return Inertia::render('LanguageTesting/Tests/Index', [
            'tests' => collect($tests->items())->map(fn (LanguageTestingTest $test): array => $this->languageTestingService->serializeTest($test))->all(),
            'filters' => [
                'q' => $filters->q,
                'status' => $filters->status,
                'language' => $filters->language,
                'sort' => $filters->sort,
                'direction' => $filters->direction,
                'per_page' => $filters->perPage,
            ],
            'pagination' => [
                'current_page' => $tests->currentPage(),
                'last_page' => $tests->lastPage(),
                'per_page' => $tests->perPage(),
                'total' => $tests->total(),
            ],
            'options' => $this->languageTestingService->testOptions(),
            'permissions' => [
                'canManage' => $request->user()?->can('create', LanguageTestingTest::class) ?? false,
            ],
        ]);
    }

    public function store(UpsertLanguageTestingTestRequest $request): RedirectResponse
    {
        $this->languageTestingService->createTest($request->validated());

        return back()->with('success', 'Тест создан.');
    }

    public function update(UpsertLanguageTestingTestRequest $request, LanguageTestingTest $languageTestingTest): RedirectResponse
    {
        $this->authorize('update', $languageTestingTest);
        $this->languageTestingService->updateTest($languageTestingTest, $request->validated());

        return back()->with('success', 'Тест обновлен.');
    }

    public function destroy(LanguageTestingTest $languageTestingTest): RedirectResponse
    {
        $this->authorize('delete', $languageTestingTest);
        $this->languageTestingService->deleteTest($languageTestingTest);

        return back()->with('success', 'Тест удален.');
    }
}