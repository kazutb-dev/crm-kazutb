<?php

namespace App\Http\Controllers;

use App\Models\SurveyQuestion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SurveyQuestionController extends Controller
{
    public function index()
    {
        Gate::authorize('viewAny', SurveyQuestion::class);
        $questions = SurveyQuestion::orderBy('order')->get();
        return view('survey_questions.index', compact('questions'));
    }

    public function create()
    {
        Gate::authorize('create', SurveyQuestion::class);
        return view('survey_questions.create');
    }

    public function store(Request $request)
    {
        Gate::authorize('create', SurveyQuestion::class);
        $data = $request->validate([
            'text' => 'required|string|max:255',
            'type' => 'required|in:rating,text,multiple_choice',
            'order' => 'required|integer',
            'min_rating' => 'nullable|integer',
            'max_rating' => 'nullable|integer',
            'is_required' => 'boolean',
            'is_active' => 'boolean',
        ]);
        SurveyQuestion::create($data);
        return redirect()->route('admin.survey-questions.index')->with('success', 'Вопрос добавлен');
    }

    public function edit(SurveyQuestion $question)
    {
        Gate::authorize('update', $question);
        return view('survey_questions.edit', compact('question'));
    }

    public function update(Request $request, SurveyQuestion $question)
    {
        Gate::authorize('update', $question);
        $data = $request->validate([
            'text' => 'required|string|max:255',
            'type' => 'required|in:rating,text,multiple_choice',
            'order' => 'required|integer',
            'min_rating' => 'nullable|integer',
            'max_rating' => 'nullable|integer',
            'is_required' => 'boolean',
            'is_active' => 'boolean',
        ]);
        $question->update($data);
        return redirect()->route('admin.survey-questions.index')->with('success', 'Вопрос обновлен');
    }

    public function destroy(SurveyQuestion $question)
    {
        Gate::authorize('delete', $question);
        $question->delete();
        return redirect()->route('admin.survey-questions.index')->with('success', 'Вопрос удален');
    }

    public function getActive()
    {
        $questions = SurveyQuestion::active()->orderBy('order')->get();
        return response()->json($questions);
    }
}
