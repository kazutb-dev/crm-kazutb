<?php

namespace App\Services;

use App\Models\Discipline;
use App\Models\Survey;
use App\Models\SurveyQuestion;
use App\Models\User;
use Illuminate\Support\Collection;

class SurveyAnalyticsService
{
    /**
     * Получить рейтинг преподавателя по дисциплине
     */
    public function getTeacherDisciplineRating(User $teacher, Discipline $discipline): float
    {
        return $discipline->getAverageRating();
    }

    /**
     * Получить общий рейтинг преподавателя
     */
    public function getTeacherOverallRating(User $teacher): float
    {
        return $teacher->getOverallAverageRating();
    }

    /**
     * Получить рейтинги преподавателя по всем дисциплинам
     */
    public function getTeacherRatings(User $teacher): Collection
    {
        return $teacher->disciplines()
            ->get()
            ->map(function (Discipline $discipline) {
                return [
                    'discipline_id' => $discipline->id,
                    'discipline_name' => $discipline->name,
                    'rating' => $discipline->getAverageRating(),
                    'completed_surveys' => $discipline->surveys()
                        ->where('status', 'completed')
                        ->count(),
                ];
            });
    }

    /**
     * Получить рейтинги всех преподавателей (топ)
     */
    public function getTopTeachers(int $limit = 10): Collection
    {
        return User::where('role', 'teacher')
            ->get()
            ->map(function (User $teacher) {
                return [
                    'teacher_id' => $teacher->id,
                    'teacher_name' => "{$teacher->first_name} {$teacher->last_name}",
                    'overall_rating' => $teacher->getOverallAverageRating(),
                    'disciplines_count' => $teacher->disciplines()->count(),
                ];
            })
            ->sortByDesc('overall_rating')
            ->take($limit)
            ->values();
    }

    /**
     * Получить рейтинги всех дисциплин (топ)
     */
    public function getTopDisciplines(int $limit = 10): Collection
    {
        return Discipline::all()
            ->map(function (Discipline $discipline) {
                return [
                    'discipline_id' => $discipline->id,
                    'discipline_name' => $discipline->name,
                    'teacher_name' => "{$discipline->teacher->first_name} {$discipline->teacher->last_name}",
                    'rating' => $discipline->getAverageRating(),
                    'surveys_completed' => $discipline->surveys()
                        ->where('status', 'completed')
                        ->count(),
                ];
            })
            ->sortByDesc('rating')
            ->take($limit)
            ->values();
    }

    /**
     * Получить статистику по вопросам для дисциплины
     */
    public function getDisciplineQuestionStatistics(Discipline $discipline): Collection
    {
        $questions = SurveyQuestion::where('is_active', true)
            ->where('type', 'rating')
            ->orderBy('order')
            ->get();

        $completedSurveys = $discipline->surveys()
            ->where('status', 'completed')
            ->get();

        if ($completedSurveys->isEmpty()) {
            return collect([]);
        }

        return $questions->map(function (SurveyQuestion $question) use ($completedSurveys) {
            $ratings = [];

            foreach ($completedSurveys as $survey) {
                $answer = $survey->answers()
                    ->where('question_id', $question->id)
                    ->first();

                if ($answer && $answer->rating_value) {
                    $ratings[] = $answer->rating_value;
                }
            }

            if (empty($ratings)) {
                return null;
            }

            return [
                'question_id' => $question->id,
                'question_text' => $question->text,
                'average_rating' => round(array_sum($ratings) / count($ratings), 2),
                'median_rating' => $this->calculateMedian($ratings),
                'min_rating' => min($ratings),
                'max_rating' => max($ratings),
                'std_deviation' => $this->calculateStdDeviation($ratings),
                'response_count' => count($ratings),
            ];
        })->filter()->values();
    }

    /**
     * Получить прогресс заполнения анкет
     */
    public function getSurveyCompletionProgress(Discipline $discipline): array
    {
        $totalSurveys = $discipline->surveys()->count();
        $completedSurveys = $discipline->surveys()
            ->where('status', 'completed')
            ->count();
        $inProgressSurveys = $discipline->surveys()
            ->where('status', 'in_progress')
            ->count();
        $draftSurveys = $discipline->surveys()
            ->where('status', 'draft')
            ->count();

        return [
            'total' => $totalSurveys,
            'completed' => $completedSurveys,
            'in_progress' => $inProgressSurveys,
            'draft' => $draftSurveys,
            'completion_percentage' => $totalSurveys > 0 ? round(($completedSurveys / $totalSurveys) * 100, 2) : 0,
        ];
    }

    /**
     * Получить тренд оценок за период
     */
    public function getDisciplineRatingTrend(Discipline $discipline, \DateTimeInterface $from, \DateTimeInterface $to): Collection
    {
        $surveys = $discipline->surveys()
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$from, $to])
            ->with('answers')
            ->get();

        if ($surveys->isEmpty()) {
            return collect([]);
        }

        $groupedByDate = $surveys->groupBy(function ($survey) {
            return $survey->completed_at->format('Y-m-d');
        });

        return $groupedByDate->map(function ($daySurveys) {
            $ratings = [];
            foreach ($daySurveys as $survey) {
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

            return [
                'date' => $daySurveys->first()->completed_at->format('Y-m-d'),
                'average_rating' => !empty($ratings) ? round(array_sum($ratings) / count($ratings), 2) : 0,
                'surveys_count' => $daySurveys->count(),
            ];
        })->values();
    }

    /**
     * Рассчитать медиану
     */
    private function calculateMedian(array $values): float
    {
        sort($values);
        $count = count($values);

        if ($count % 2 === 0) {
            $median = ($values[$count / 2 - 1] + $values[$count / 2]) / 2;
        } else {
            $median = $values[($count - 1) / 2];
        }

        return round($median, 2);
    }

    /**
     * Рассчитать стандартное отклонение
     */
    private function calculateStdDeviation(array $values): float
    {
        if (count($values) < 2) {
            return 0;
        }

        $mean = array_sum($values) / count($values);
        $variance = array_sum(array_map(function ($value) use ($mean) {
            return pow($value - $mean, 2);
        }, $values)) / (count($values) - 1);

        return round(sqrt($variance), 2);
    }
}
