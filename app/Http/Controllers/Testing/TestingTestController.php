<?php

namespace App\Http\Controllers\Testing;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Testing\Concerns\AuthorizesTestingAccess;
use App\Models\Testing\TestingBinding;
use App\Models\Testing\TestingQuestion;
use App\Models\Testing\TestingTest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TestingTestController extends Controller
{
    use AuthorizesTestingAccess;

    public function create(Request $request, TestingBinding $binding): Response
    {
        $user = $request->user();
        $this->ensureBindingAccess($user, $binding);

        $binding->load('subject:id,name,code');

        return Inertia::render('Testing/TestForm', [
            'binding' => [
                'id' => $binding->id,
                'subject' => [
                    'id' => $binding->subject?->id,
                    'name' => $binding->subject?->name,
                    'code' => $binding->subject?->code,
                ],
            ],
            'test' => null,
        ]);
    }

    public function store(Request $request, TestingBinding $binding): RedirectResponse
    {
        $user = $request->user();
        $this->ensureBindingAccess($user, $binding);

        $payload = $this->validatePayload($request);

        DB::transaction(function () use ($binding, $payload): void {
            $test = TestingTest::query()->create([
                'binding_id' => $binding->id,
                'title' => $payload['title'],
                'description' => $payload['description'] ?? null,
                'status' => $payload['status'],
                'question_count' => $payload['question_count'],
                'shuffle_questions' => $payload['shuffle_questions'] ?? false,
                'passing_score' => $payload['passing_score'] ?? 70,
                'time_limit_minutes' => null,
                'max_attempts' => null,
                'settings' => [
                    'allow_reordering' => $payload['allow_reordering'] ?? true,
                ],
            ]);

            $this->syncQuestions($test, $payload['questions']);
        });

        return redirect()
            ->route('testing.bindings.show', $binding)
            ->with('success', 'Тест создан.');
    }

    public function edit(Request $request, TestingTest $test): Response
    {
        $test->load(['binding.subject:id,name,code', 'questions']);

        $user = $request->user();
        $this->ensureTestAccess($user, $test);

        return Inertia::render('Testing/TestForm', [
            'binding' => [
                'id' => $test->binding->id,
                'subject' => [
                    'id' => $test->binding->subject?->id,
                    'name' => $test->binding->subject?->name,
                    'code' => $test->binding->subject?->code,
                ],
            ],
            'test' => [
                'id' => $test->id,
                'title' => $test->title,
                'description' => $test->description,
                'status' => $test->status,
                'question_count' => (int) $test->question_count,
                'shuffle_questions' => (bool) $test->shuffle_questions,
                'passing_score' => (float) $test->passing_score,
                'allow_reordering' => (bool) data_get($test->settings, 'allow_reordering', true),
                'questions' => $test->questions
                    ->sortBy('position')
                    ->values()
                    ->map(fn (TestingQuestion $question): array => [
                        'id' => $question->id,
                        'text' => $question->text,
                        'type' => $question->type,
                        'options' => array_values(array_filter($question->options ?? [], fn ($value) => trim((string) $value) !== '')),
                        'correct_answers' => array_values(array_filter($question->correct_answers ?? [], fn ($value) => trim((string) $value) !== '')),
                        'position' => (int) $question->position,
                    ]),
            ],
        ]);
    }

    public function update(Request $request, TestingTest $test): RedirectResponse
    {
        $test->load('binding');
        $user = $request->user();
        $this->ensureTestAccess($user, $test);

        $payload = $this->validatePayload($request);

        DB::transaction(function () use ($test, $payload): void {
            $test->update([
                'title' => $payload['title'],
                'description' => $payload['description'] ?? null,
                'status' => $payload['status'],
                'question_count' => $payload['question_count'],
                'shuffle_questions' => $payload['shuffle_questions'] ?? false,
                'passing_score' => $payload['passing_score'] ?? 70,
                'settings' => [
                    'allow_reordering' => $payload['allow_reordering'] ?? true,
                ],
            ]);

            TestingQuestion::query()->where('test_id', $test->id)->delete();
            $this->syncQuestions($test, $payload['questions']);
        });

        return redirect()
            ->route('testing.bindings.show', $test->binding)
            ->with('success', 'Тест обновлен.');
    }

    public function destroy(Request $request, TestingTest $test): RedirectResponse
    {
        $test->load('binding');
        $user = $request->user();
        $this->ensureTestAccess($user, $test);

        $binding = $test->binding;
        $test->delete();

        return redirect()
            ->route('testing.bindings.show', $binding)
            ->with('success', 'Тест удален.');
    }

    private function validatePayload(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['required', 'in:draft,published'],
            'question_count' => ['required', 'integer', 'min:1'],
            'shuffle_questions' => ['nullable', 'boolean'],
            'allow_reordering' => ['nullable', 'boolean'],
            'passing_score' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.text' => ['required', 'string', 'max:5000'],
            'questions.*.type' => ['required', 'in:single_choice,multiple_choice,short_text'],
            'questions.*.options' => ['nullable', 'array'],
            'questions.*.options.*' => ['nullable', 'string', 'max:1000'],
            'questions.*.correct_answers' => ['required', 'array', 'min:1'],
            'questions.*.correct_answers.*' => ['required', 'string', 'max:1000'],
        ]);

        $questions = collect($data['questions'])
            ->values()
            ->map(function (array $question, int $index): array {
                $type = $question['type'];
                $options = collect($question['options'] ?? [])
                    ->map(fn ($option) => trim((string) $option))
                    ->filter()
                    ->values();

                $correctAnswers = collect($question['correct_answers'] ?? [])
                    ->map(fn ($answer) => trim((string) $answer))
                    ->filter()
                    ->values();

                if ($type !== 'short_text' && $options->count() < 2) {
                    throw ValidationException::withMessages([
                        "questions.$index.options" => 'Для вопросов с вариантами ответа требуется минимум два варианта.',
                    ]);
                }

                if ($type === 'single_choice' && $correctAnswers->count() !== 1) {
                    throw ValidationException::withMessages([
                        "questions.$index.correct_answers" => 'Для вопроса с одним правильным ответом нужно указать ровно один правильный вариант.',
                    ]);
                }

                if ($type !== 'short_text') {
                    foreach ($correctAnswers as $answer) {
                        if (! $options->contains($answer)) {
                            throw ValidationException::withMessages([
                                "questions.$index.correct_answers" => 'Правильный ответ должен присутствовать среди вариантов ответа.',
                            ]);
                        }
                    }
                }

                return [
                    'text' => trim((string) $question['text']),
                    'type' => $type,
                    'options' => $type === 'short_text' ? [] : $options->all(),
                    'correct_answers' => $correctAnswers->all(),
                    'position' => $index + 1,
                ];
        });

        if ((int) $data['question_count'] > $questions->count()) {
            throw ValidationException::withMessages([
                'question_count' => 'Количество вопросов в тесте не может превышать число подготовленных вопросов.',
            ]);
        }

        $data['questions'] = $questions->all();
        $data['shuffle_questions'] = (bool) ($data['shuffle_questions'] ?? false);
        $data['allow_reordering'] = (bool) ($data['allow_reordering'] ?? true);

        return $data;
    }

    private function syncQuestions(TestingTest $test, array $questions): void
    {
        foreach ($questions as $question) {
            TestingQuestion::query()->create([
                'test_id' => $test->id,
                'text' => $question['text'],
                'type' => $question['type'],
                'options' => $question['options'],
                'correct_answers' => $question['correct_answers'],
                'position' => $question['position'],
                'meta' => [],
            ]);
        }
    }
}
