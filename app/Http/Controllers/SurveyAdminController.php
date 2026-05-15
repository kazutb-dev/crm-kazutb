<?php

namespace App\Http\Controllers;

use App\Models\Survey;
use App\Services\SurveyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SurveyAdminController extends Controller
{
    public function index()
    {
        Gate::authorize('viewAny', Survey::class);
        $surveys = Survey::with(['student', 'teacher', 'discipline', 'group'])->get();
        return view('surveys.admin.index', compact('surveys'));
    }

    public function create()
    {
        Gate::authorize('create', Survey::class);
        return view('surveys.admin.create');
    }

    public function storeBulk(Request $request, SurveyService $service)
    {
        Gate::authorize('create', Survey::class);
        $data = $request->validate([
            'group_id' => 'required|integer|exists:groups,id',
            'discipline_id' => 'required|integer|exists:disciplines,id',
        ]);
        $service->createBulkSurveys($data['group_id'], $data['discipline_id']);
        return redirect()->route('admin.surveys.index')->with('success', 'Анкеты созданы для всех студентов группы');
    }

    public function show(Survey $survey)
    {
        Gate::authorize('view', $survey);
        $survey->load(['student', 'teacher', 'discipline', 'group', 'answers.question']);
        return view('surveys.admin.show', compact('survey'));
    }

    public function cancel(Survey $survey)
    {
        Gate::authorize('update', $survey);
        $survey->cancel();
        $survey->save();
        return back()->with('success', 'Анкета отменена');
    }

    public function destroy(Survey $survey)
    {
        Gate::authorize('delete', $survey);
        $survey->delete();
        return redirect()->route('admin.surveys.index')->with('success', 'Анкета удалена');
    }
}
