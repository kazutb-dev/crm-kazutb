<?php

namespace App\Http\Controllers;

use App\Models\Discipline;
use App\Models\Group;
use App\Models\Survey;
use App\Models\SurveyQuestion;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SurveyAnalyticsController extends Controller
{
    /**
     * Аналитика по преподавателю
     */
    public function teacherAnalytics(Request $request, User $teacher)
    {
        // Проверка, что это преподаватель
        if (!$teacher->isTeacher()) {
            return response()->json(['message' => 'User is not a teacher'], 403);
        }

        // Получить все дисциплины преподавателя
        $disciplines = $teacher->disciplines()->with('groups')->get();

        $analytics = [];

        foreach ($disciplines as $discipline) {
            $completedSurveys = $discipline->surveys()
                ->where('status', 'completed')
                ->with('answers')
                ->get();

            if ($completedSurveys->isEmpty()) {
                continue;
            }

            // Рассчитать среднюю оценку по каждому вопросу
            $questionAnalytics = [];
            $questionIds = SurveyQuestion::where('is_active', true)->where('type', 'rating')->pluck('id');

            foreach ($questionIds as $questionId) {
                $ratings = [];
                foreach ($completedSurveys as $survey) {
                    $answer = $survey->answers()->where('question_id', $questionId)->first();
                    if ($answer && $answer->rating_value) {
                        $ratings[] = $answer->rating_value;
                    }
                }

                if (!empty($ratings)) {
                    $questionAnalytics[] = [
                        'question_id' => $questionId,
                        'question_text' => SurveyQuestion::find($questionId)->text,
                        'average_rating' => round(array_sum($ratings) / count($ratings), 2),
                        'response_count' => count($ratings),
                    ];
                }
            }

            // Средняя оценка по дисциплине
            $averageRating = $discipline->getAverageRating();

            $analytics[] = [
                'discipline' => $discipline,
                'completed_surveys_count' => $completedSurveys->count(),
                'average_rating' => $averageRating,
                'question_analytics' => $questionAnalytics,
                'response_rate' => round(($completedSurveys->count() / $discipline->groups()->count()) * 100, 2),
            ];
        }

        // Общая средняя оценка
        $overallAverage = $teacher->getOverallAverageRating();

        return Inertia::render('Survey/TeacherAnalytics', [
            'teacher' => $teacher,
            'analytics' => $analytics,
            'overall_average' => $overallAverage,
        ]);
    }

    /**
     * Аналитика по дисциплине
     */
    public function disciplineAnalytics(Request $request, Discipline $discipline)
    {
        $completedSurveys = $discipline->surveys()
            ->where('status', 'completed')
            ->with(['student', 'answers', 'group'])
            ->get();

        if ($completedSurveys->isEmpty()) {
            return Inertia::render('Survey/DisciplineAnalytics', [
                'discipline' => $discipline,
                'analytics' => null,
                'message' => 'No completed surveys for this discipline',
            ]);
        }

        // Рассчитать статистику по каждому вопросу
        $questions = SurveyQuestion::where('is_active', true)->orderBy('order')->get();
        $questionAnalytics = [];

        foreach ($questions as $question) {
            $answers = [];
            foreach ($completedSurveys as $survey) {
                $answer = $survey->answers()->where('question_id', $question->id)->first();
                if ($answer) {
                    if ($question->type === 'rating' && $answer->rating_value) {
                        $answers[] = $answer->rating_value;
                    }
                }
            }

            if (!empty($answers)) {
                $questionAnalytics[] = [
                    'question' => $question,
                    'average_rating' => round(array_sum($answers) / count($answers), 2),
                    'min_rating' => min($answers),
                    'max_rating' => max($answers),
                    'response_count' => count($answers),
                    'distribution' => $this->calculateDistribution($answers, $question->max_rating),
                ];
            }
        }

        // Статистика по группам
        $groupAnalytics = [];
        foreach ($completedSurveys->groupBy('group_id') as $groupId => $groupSurveys) {
            $group = Group::find($groupId);
            $ratings = [];
            foreach ($groupSurveys as $survey) {
                $ratingAnswers = $survey->answers()
                    ->whereHas('question', function ($q) {
                        $q->where('type', 'rating');
                    })
                    ->whereNotNull('rating_value')
                    ->get();
                foreach ($ratingAnswers as $answer) {
                    $ratings[] = $answer->rating_value;
                }
            }

            $groupAnalytics[] = [
                'group' => $group,
                'survey_count' => $groupSurveys->count(),
                'average_rating' => !empty($ratings) ? round(array_sum($ratings) / count($ratings), 2) : 0,
            ];
        }

        $averageRating = $discipline->getAverageRating();

        return Inertia::render('Survey/DisciplineAnalytics', [
            'discipline' => $discipline->load('teacher:id,first_name,last_name'),
            'completed_surveys_count' => $completedSurveys->count(),
            'average_rating' => $averageRating,
            'question_analytics' => $questionAnalytics,
            'group_analytics' => $groupAnalytics,
        ]);
    }

    /**
     * Общие отчеты системы
     */
    public function systemReport(Request $request)
    {
        $completedSurveys = Survey::where('status', 'completed')->with('answers')->get();

        if ($completedSurveys->isEmpty()) {
            return Inertia::render('Survey/SystemReport', [
                'report' => null,
                'message' => 'No completed surveys in system',
            ]);
        }

        // Общая статистика
        $totalSurveys = Survey::count();
        $completedCount = $completedSurveys->count();
        $completionRate = round(($completedCount / max($totalSurveys, 1)) * 100, 2);

        // Средняя оценка по системе
        $allRatings = [];
        foreach ($completedSurveys as $survey) {
            $ratings = $survey->answers()
                ->whereHas('question', function ($q) {
                    $q->where('type', 'rating');
                })
                ->whereNotNull('rating_value')
                ->pluck('rating_value')
                ->toArray();
            $allRatings = array_merge($allRatings, $ratings);
        }
        $systemAverageRating = !empty($allRatings) ? round(array_sum($allRatings) / count($allRatings), 2) : 0;

        // Топ преподавателей
        $topTeachers = User::where('role', 'teacher')
            ->with('surveys')
            ->get()
            ->map(function ($teacher) {
                return [
                    'teacher' => $teacher,
                    'average_rating' => $teacher->getOverallAverageRating(),
                ];
            })
            ->sortByDesc('average_rating')
            ->take(10)
            ->values();

        // Топ дисциплин
        $topDisciplines = Discipline::with('surveys')
            ->get()
            ->map(function ($discipline) {
                return [
                    'discipline' => $discipline,
                    'average_rating' => $discipline->getAverageRating(),
                ];
            })
            ->sortByDesc('average_rating')
            ->take(10)
            ->values();

        return Inertia::render('Survey/SystemReport', [
            'report' => [
                'total_surveys' => $totalSurveys,
                'completed_surveys' => $completedCount,
                'completion_rate' => $completionRate,
                'system_average_rating' => $systemAverageRating,
            ],
            'top_teachers' => $topTeachers,
            'top_disciplines' => $topDisciplines,
        ]);
    }

    /**
     * Рассчитать распределение оценок
     */
    private function calculateDistribution(array $ratings, int $maxRating): array
    {
        $distribution = array_fill(1, $maxRating, 0);

        foreach ($ratings as $rating) {
            if (isset($distribution[$rating])) {
                $distribution[$rating]++;
            }
        }

        return $distribution;
    }
}
