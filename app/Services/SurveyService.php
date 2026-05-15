<?php

namespace App\Services;

use App\Models\Discipline;
use App\Models\Group;
use App\Models\Student;
use App\Models\Survey;
use App\Models\SurveyQuestion;
use App\Models\User;

class SurveyService
{
    /**
     * Создать анкету для студента
     */
    public function createSurvey(
        int $studentId,
        int $teacherId,
        int $disciplineId,
        int $groupId
    ): Survey {
        // Проверить, что такая комбинация не существует
        $existing = Survey::where([
            'student_id' => $studentId,
            'teacher_id' => $teacherId,
            'discipline_id' => $disciplineId,
            'group_id' => $groupId,
        ])->first();

        if ($existing) {
            return $existing;
        }

        return Survey::create([
            'student_id' => $studentId,
            'teacher_id' => $teacherId,
            'discipline_id' => $disciplineId,
            'group_id' => $groupId,
            'status' => 'draft',
        ]);
    }

    /**
     * Массовое создание анкет для группы и дисциплины
     */
    public function createBulkSurveys(int $groupId, int $disciplineId): int
    {
        $group = Group::findOrFail($groupId);
        $discipline = Discipline::findOrFail($disciplineId);

        $students = $group->students()->get();
        $createdCount = 0;

        foreach ($students as $student) {
            $survey = $this->createSurvey(
                $student->id,
                $discipline->user_id,
                $discipline->id,
                $group->id
            );

            if ($survey->wasRecentlyCreated) {
                $createdCount++;
            }
        }

        return $createdCount;
    }

    /**
     * Получить доступные для студента дисциплины
     */
    public function getAvailableDisciplinesForStudent(Student $student): \Illuminate\Database\Eloquent\Collection
    {
        return $student->group->disciplines()
            ->with('teacher:id,first_name,last_name')
            ->get();
    }

    /**
     * Получить дисциплины, по которым студент уже заполнил анкету
     */
    public function getCompletedDisciplinesForStudent(Student $student): \Illuminate\Database\Eloquent\Collection
    {
        return $student->surveys()
            ->where('status', 'completed')
            ->with('discipline')
            ->get()
            ->pluck('discipline')
            ->unique('id');
    }

    /**
     * Получить дисциплины, по которым студент еще не заполнил анкету
     */
    public function getPendingDisciplinesForStudent(Student $student): \Illuminate\Database\Eloquent\Collection
    {
        $available = $this->getAvailableDisciplinesForStudent($student);
        $completed = $this->getCompletedDisciplinesForStudent($student)
            ->pluck('id')
            ->toArray();

        return $available->whereNotIn('id', $completed)->values();
    }

    /**
     * Проверить, завершена ли анкета
     */
    public function isSurveyComplete(Survey $survey): bool
    {
        return $survey->areRequiredAnswersComplete();
    }

    /**
     * Получить среднюю оценку анкеты
     */
    public function getSurveyAverageRating(Survey $survey): float
    {
        return $survey->getAverageRating();
    }

    /**
     * Получить статистику по преподавателю
     */
    public function getTeacherStatistics(User $teacher): array
    {
        if (!$teacher->isTeacher()) {
            return [];
        }

        $disciplines = $teacher->disciplines()->get();
        $stats = [];

        foreach ($disciplines as $discipline) {
            $completedSurveys = $discipline->surveys()
                ->where('status', 'completed')
                ->count();

            $averageRating = $discipline->getAverageRating();

            $stats[] = [
                'discipline_id' => $discipline->id,
                'discipline_name' => $discipline->name,
                'completed_surveys' => $completedSurveys,
                'average_rating' => $averageRating,
            ];
        }

        return $stats;
    }

    /**
     * Получить статистику по дисциплине
     */
    public function getDisciplineStatistics(Discipline $discipline): array
    {
        $completedSurveys = $discipline->surveys()
            ->where('status', 'completed')
            ->with('answers')
            ->get();

        if ($completedSurveys->isEmpty()) {
            return [];
        }

        $questions = SurveyQuestion::where('is_active', true)
            ->where('type', 'rating')
            ->orderBy('order')
            ->get();

        $statistics = [];

        foreach ($questions as $question) {
            $ratings = [];
            foreach ($completedSurveys as $survey) {
                $answer = $survey->answers()
                    ->where('question_id', $question->id)
                    ->first();

                if ($answer && $answer->rating_value) {
                    $ratings[] = $answer->rating_value;
                }
            }

            if (!empty($ratings)) {
                $statistics[] = [
                    'question_id' => $question->id,
                    'question_text' => $question->text,
                    'average_rating' => round(array_sum($ratings) / count($ratings), 2),
                    'min_rating' => min($ratings),
                    'max_rating' => max($ratings),
                    'response_count' => count($ratings),
                ];
            }
        }

        return $statistics;
    }

    /**
     * Получить распределение оценок по вопросу
     */
    public function getQuestionDistribution(SurveyQuestion $question): array
    {
        $answers = $question->answers()
            ->whereNotNull('rating_value')
            ->get();

        if ($answers->isEmpty()) {
            return [];
        }

        $distribution = array_fill($question->min_rating, $question->max_rating - $question->min_rating + 1, 0);

        foreach ($answers as $answer) {
            if (isset($distribution[$answer->rating_value])) {
                $distribution[$answer->rating_value]++;
            }
        }

        return $distribution;
    }

    /**
     * Экспортировать результаты в CSV
     */
    public function exportToCsv(Discipline $discipline): string
    {
        $surveys = $discipline->surveys()
            ->where('status', 'completed')
            ->with(['student', 'answers', 'group'])
            ->get();

        $csv = "Дисциплина: {$discipline->name}\n";
        $csv .= "Преподаватель: {$discipline->teacher->first_name} {$discipline->teacher->last_name}\n\n";

        $csv .= "Студент,Группа,Средняя оценка,Статус\n";

        foreach ($surveys as $survey) {
            $avgRating = $survey->getAverageRating();
            $csv .= "{$survey->student->full_name},{$survey->group->name},{$avgRating},{$survey->status}\n";
        }

        return $csv;
    }
}
