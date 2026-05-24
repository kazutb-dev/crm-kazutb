<?php

namespace App\Services\Questionnaire;

use App\Models\Questionnaire\SurveyAnswer;
use App\Models\Questionnaire\SurveyResponse;
use Illuminate\Database\Eloquent\Builder;

class QuestionnaireResultService
{
    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function getResults(array $filters): array
    {
        $query = SurveyResponse::query()
            ->with([
                'survey:id,title,academic_year,semester',
                'student:id,full_name,group_id',
                'group:id,name',
                'teacher:id,name',
                'discipline:id,name',
                'answers.option:id,score,option_text',
                'answers.question:id,question_text,question_type',
            ]);

        $this->applyFilters($query, $filters);

        $responses = $query->latest('submitted_at')->get();

        $answerScores = SurveyAnswer::query()
            ->whereIn('response_id', $responses->pluck('id'))
            ->with('option:id,score')
            ->get()
            ->map(function (SurveyAnswer $answer): ?float {
                if ($answer->option?->score !== null) {
                    return (float) $answer->option->score;
                }

                if ($answer->numeric_answer !== null) {
                    return (float) $answer->numeric_answer;
                }

                return null;
            })
            ->filter(fn (?float $score): bool => $score !== null)
            ->values();

        return [
            'summary' => [
                'total_responses' => $responses->count(),
                'average_score' => $answerScores->isNotEmpty() ? round((float) $answerScores->avg(), 2) : null,
            ],
            'responses' => $responses,
        ];
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        $query->when(isset($filters['survey_id']), fn (Builder $q) => $q->where('survey_id', (int) $filters['survey_id']));
        $query->when(isset($filters['group_id']), fn (Builder $q) => $q->where('group_id', (int) $filters['group_id']));
        $query->when(isset($filters['teacher_id']), fn (Builder $q) => $q->where('teacher_id', (int) $filters['teacher_id']));
        $query->when(isset($filters['discipline_id']), fn (Builder $q) => $q->where('discipline_id', (int) $filters['discipline_id']));
        $query->when(isset($filters['academic_year']), fn (Builder $q) => $q->where('academic_year', (string) $filters['academic_year']));
        $query->when(isset($filters['semester']), fn (Builder $q) => $q->where('semester', (string) $filters['semester']));
    }
}
