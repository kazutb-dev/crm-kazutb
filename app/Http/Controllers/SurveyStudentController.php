<?php

namespace App\Http\Controllers;

use App\Models\Survey;
use App\Models\SurveyAnswer;
use App\Models\SurveyQuestion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SurveyStudentController extends Controller
{
    public function index(Request $request)
    {
        $student = $request->user()->student;
        $surveys = Survey::where('student_id', $student->id)->with(['discipline', 'teacher'])->get();
        return view('surveys.student.index', compact('surveys'));
    }

    public function start(Survey $survey)
    {
        Gate::authorize('complete', $survey);
        if ($survey->status !== 'draft') {
            return redirect()->route('surveys.show', $survey)->with('error', 'Анкета уже начата или завершена');
        }
        $survey->start();
        $survey->save();
        $questions = SurveyQuestion::active()->get();

        return view('surveys.student.start', compact('survey', 'questions'));
    }

    public function store(Request $request, Survey $survey)
    {
        Gate::authorize('complete', $survey);
        $data = $request->validate([
            'answers' => 'required|array',
            'answers.*.question_id' => 'required|integer|exists:survey_questions,id',
            'answers.*.rating_value' => 'nullable|integer',
            'answers.*.text_answer' => 'nullable|string',
            'answers.*.selected_option' => 'nullable|string',
        ]);
        foreach ($data['answers'] as $answerData) {
            SurveyAnswer::updateOrCreate(
                [
                    'survey_id' => $survey->id,
                    'question_id' => $answerData['question_id'],
                ],
                [
                    'rating_value' => $answerData['rating_value'] ?? null,
                    'text_answer' => $answerData['text_answer'] ?? null,
                    'selected_option' => $answerData['selected_option'] ?? null,
                ]
            );
        }
        return back()->with('success', 'Ответы сохранены');
    }

    public function complete(Survey $survey)
    {
        Gate::authorize('complete', $survey);
        if (!$survey->areRequiredAnswersComplete()) {
            return back()->with('error', 'Не все обязательные вопросы заполнены');
        }
        $survey->complete();
        $survey->save();
        return redirect()->route('surveys.show', $survey)->with('success', 'Анкета завершена');
    }

    public function show(Survey $survey)
    {
        Gate::authorize('view', $survey);
        $survey->load(['answers.question', 'discipline', 'teacher']);
        return view('surveys.student.show', compact('survey'));
    }
}
