<?php

namespace App\Services\Questionnaire;

use App\Models\Questionnaire\GroupDiscipline;
use App\Models\Questionnaire\Student;
use App\Models\Questionnaire\Survey;
use App\Models\Questionnaire\SurveyAnswer;
use App\Models\Questionnaire\SurveyOption;
use App\Models\Questionnaire\SurveyQuestion;
use App\Models\Questionnaire\SurveyResponse;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuestionnaireSurveyService
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function getAvailableSurveysForStudent(User $user): array
    {
        $student = $this->resolveStudent($user);

        $today = Carbon::today();

        $groupDisciplines = GroupDiscipline::query()
            ->with(['group', 'teacherDiscipline.teacher', 'teacherDiscipline.discipline'])
            ->where('group_id', $student->group_id)
            ->where('status', 'active')
            ->whereHas('teacherDiscipline', function ($query): void {
                $query->where('status', 'active');
            })
            ->get();

        if ($groupDisciplines->isEmpty()) {
            return [];
        }

        $surveys = Survey::query()
            ->with(['questions.options'])
            ->where(function ($query) use ($groupDisciplines): void {
                foreach ($groupDisciplines->groupBy(fn (GroupDiscipline $item) => $item->academic_year.'|'.$item->semester) as $grouped) {
                    $first = $grouped->first();
                    if (! $first) {
                        continue;
                    }

                    $query->orWhere(function ($subQuery) use ($first): void {
                        $subQuery->where('academic_year', $first->academic_year)
                            ->where('semester', $first->semester);
                    });
                }
            })
            ->orderByDesc('start_date')
            ->get();

        $surveysByPeriod = $surveys->groupBy(fn (Survey $survey) => $survey->academic_year.'|'.$survey->semester);

        $responses = SurveyResponse::query()
            ->where('student_id', $student->id)
            ->where('group_id', $student->group_id)
            ->whereIn('group_discipline_id', $groupDisciplines->pluck('id')->all())
            ->whereIn('survey_id', $surveys->pluck('id')->all())
            ->get(['survey_id', 'group_discipline_id']);

        $responseLookup = $responses
            ->mapWithKeys(fn (SurveyResponse $response) => [
                $response->survey_id.'|'.$response->group_discipline_id => true,
            ])
            ->all();

        $results = [];

        foreach ($groupDisciplines as $groupDiscipline) {
            $teacherDiscipline = $groupDiscipline->teacherDiscipline;

            if (! $teacherDiscipline) {
                continue;
            }

            $periodKey = $groupDiscipline->academic_year.'|'.$groupDiscipline->semester;
            $periodSurveys = $surveysByPeriod->get($periodKey, collect())
                ->filter(function (Survey $candidate) use ($student): bool {
                    if (($candidate->target_scope ?? 'global') === 'global') {
                        return true;
                    }

                    return ($candidate->target_scope ?? 'global') === 'group'
                        && (int) ($candidate->target_group_id ?? 0) === (int) $student->group_id;
                })
                ->values();

            $survey = $periodSurveys
                ->first(function (Survey $candidate) use ($groupDiscipline, $responseLookup, $today): bool {
                    $alreadySubmitted = isset($responseLookup[$candidate->id.'|'.$groupDiscipline->id]);

                    if ($alreadySubmitted) {
                        return false;
                    }

                    if ($candidate->status !== 'active') {
                        return false;
                    }

                    if ($candidate->start_date && $today->lt($candidate->start_date)) {
                        return false;
                    }

                    if ($candidate->end_date && $today->gt($candidate->end_date)) {
                        return false;
                    }

                    return true;
                })
                ?? $periodSurveys->first();

            $alreadySubmitted = false;
            if ($survey) {
                $alreadySubmitted = isset($responseLookup[$survey->id.'|'.$groupDiscipline->id]);
            }

            $surveyState = 'no_survey';
            $surveyStateLabel = 'Анкетирование не назначено';
            $canSubmit = false;

            if ($survey) {
                if ($alreadySubmitted) {
                    $surveyState = 'completed';
                    $surveyStateLabel = 'Анкетирование пройдено';
                } elseif ($survey->status !== 'active') {
                    $surveyState = 'inactive';
                    $surveyStateLabel = 'Анкетирование неактивно';
                } elseif ($survey->start_date && $today->lt($survey->start_date)) {
                    $surveyState = 'scheduled';
                    $surveyStateLabel = 'Анкетирование еще не началось';
                } elseif ($survey->end_date && $today->gt($survey->end_date)) {
                    $surveyState = 'closed';
                    $surveyStateLabel = 'Срок анкетирования завершен';
                } else {
                    $surveyState = 'available';
                    $surveyStateLabel = 'Анкетирование доступно';
                    $canSubmit = true;
                }
            }

            $results[] = [
                'survey_id' => $survey?->id,
                'survey_title' => $survey?->title,
                'survey_description' => $survey?->description,
                'course' => $groupDiscipline->group?->course,
                'academic_year' => $groupDiscipline->academic_year,
                'semester' => $groupDiscipline->semester,
                'start_date' => optional($survey?->start_date)->toDateString(),
                'end_date' => optional($survey?->end_date)->toDateString(),
                'group_discipline_id' => $groupDiscipline->id,
                'teacher_discipline_id' => $teacherDiscipline->id,
                'survey_state' => $surveyState,
                'survey_state_label' => $surveyStateLabel,
                'survey_available' => $canSubmit,
                'can_submit' => $canSubmit,
                'group' => [
                    'id' => $groupDiscipline->group?->id,
                    'name' => $groupDiscipline->group?->name,
                    'course' => $groupDiscipline->group?->course,
                ],
                'teacher' => [
                    'id' => $teacherDiscipline->teacher?->id,
                    'name' => $teacherDiscipline->teacher?->name,
                ],
                'discipline' => [
                    'id' => $teacherDiscipline->discipline?->id,
                    'name' => $teacherDiscipline->discipline?->name,
                ],
                'questions' => $canSubmit && $survey
                    ? $survey->questions->map(function (SurveyQuestion $question): array {
                        return [
                            'id' => $question->id,
                            'question_text' => $question->question_text,
                            'question_type' => $question->question_type,
                            'is_required' => $question->is_required,
                            'options' => $question->options->map(function (SurveyOption $option): array {
                                return [
                                    'id' => $option->id,
                                    'option_text' => $option->option_text,
                                    'score' => $option->score,
                                ];
                            })->values()->all(),
                        ];
                    })->values()->all()
                    : [],
            ];
        }

        return $results;
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function submitSurvey(User $user, array $payload): SurveyResponse
    {
        $student = $this->resolveStudent($user);
        $survey = Survey::query()->findOrFail((int) $payload['survey_id']);
        $groupDiscipline = GroupDiscipline::query()->with('teacherDiscipline')->findOrFail((int) $payload['group_discipline_id']);

        $this->validateSurveyWindow($survey);

        if ((int) $groupDiscipline->group_id !== (int) $student->group_id) {
            throw ValidationException::withMessages([
                'group_discipline_id' => 'Дисциплина не привязана к группе текущего студента.',
            ]);
        }

        if ($groupDiscipline->academic_year !== $survey->academic_year || $groupDiscipline->semester !== $survey->semester) {
            throw ValidationException::withMessages([
                'group_discipline_id' => 'Период дисциплины не совпадает с периодом анкетирования.',
            ]);
        }

        if (($survey->target_scope ?? 'global') === 'group' && (int) ($survey->target_group_id ?? 0) !== (int) $student->group_id) {
            throw ValidationException::withMessages([
                'survey_id' => 'Опрос предназначен для другой группы.',
            ]);
        }

        $teacherDiscipline = $groupDiscipline->teacherDiscipline;

        if (! $teacherDiscipline || $teacherDiscipline->status !== 'active' || $groupDiscipline->status !== 'active') {
            throw ValidationException::withMessages([
                'group_discipline_id' => 'Связка преподавателя и дисциплины неактивна.',
            ]);
        }

        $alreadySubmitted = SurveyResponse::query()
            ->where('survey_id', $survey->id)
            ->where('student_id', $student->id)
            ->where('teacher_id', $teacherDiscipline->teacher_id)
            ->where('discipline_id', $teacherDiscipline->discipline_id)
            ->where('group_id', $student->group_id)
            ->where('teacher_discipline_id', $teacherDiscipline->id)
            ->where('group_discipline_id', $groupDiscipline->id)
            ->where('academic_year', $survey->academic_year)
            ->where('semester', $survey->semester)
            ->exists();

        if ($alreadySubmitted) {
            throw ValidationException::withMessages([
                'survey_id' => 'Анкета уже была заполнена по этой дисциплине и преподавателю.',
            ]);
        }

        $answers = Arr::get($payload, 'answers', []);

        if (! is_array($answers) || $answers === []) {
            throw ValidationException::withMessages([
                'answers' => 'Передайте ответы на вопросы анкеты.',
            ]);
        }

        $questions = SurveyQuestion::query()
            ->with('options')
            ->where('survey_id', $survey->id)
            ->get()
            ->keyBy('id');

        return DB::transaction(function () use ($answers, $groupDiscipline, $questions, $student, $survey, $teacherDiscipline): SurveyResponse {
            $response = SurveyResponse::query()->create([
                'survey_id' => $survey->id,
                'student_id' => $student->id,
                'group_id' => $student->group_id,
                'teacher_id' => $teacherDiscipline->teacher_id,
                'discipline_id' => $teacherDiscipline->discipline_id,
                'teacher_discipline_id' => $teacherDiscipline->id,
                'group_discipline_id' => $groupDiscipline->id,
                'academic_year' => $survey->academic_year,
                'semester' => $survey->semester,
                'status' => 'submitted',
                'submitted_at' => now(),
            ]);

            foreach ($answers as $idx => $answerPayload) {
                $questionId = (int) Arr::get($answerPayload, 'question_id');
                $question = $questions->get($questionId);

                if (! $question) {
                    throw ValidationException::withMessages([
                        "answers.$idx.question_id" => 'Вопрос не относится к выбранной анкете.',
                    ]);
                }

                $optionId = Arr::get($answerPayload, 'option_id');
                $textAnswer = Arr::get($answerPayload, 'text_answer');
                $numericAnswer = Arr::get($answerPayload, 'numeric_answer');

                $this->validateQuestionAnswer($question, $optionId, $textAnswer, $numericAnswer, $idx);

                SurveyAnswer::query()->create([
                    'response_id' => $response->id,
                    'question_id' => $question->id,
                    'option_id' => $optionId,
                    'text_answer' => $textAnswer,
                    'numeric_answer' => $numericAnswer,
                ]);
            }

            $requiredQuestionIds = $questions->where('is_required', true)->keys()->all();
            $answeredRequiredIds = collect($answers)->pluck('question_id')->map(fn ($id) => (int) $id)->unique()->all();
            $missingRequired = array_values(array_diff($requiredQuestionIds, $answeredRequiredIds));

            if ($missingRequired !== []) {
                throw ValidationException::withMessages([
                    'answers' => 'Не заполнены обязательные вопросы: '.implode(', ', $missingRequired),
                ]);
            }

            return $response->load('answers');
        });
    }

    private function resolveStudent(User $user): Student
    {
        $student = Student::query()
            ->with('group')
            ->where('status', 'active')
            ->where(function ($query) use ($user): void {
                $query->where('user_id', $user->id);

                if (! empty($user->ad_login)) {
                    $query->orWhere('login', $user->ad_login);
                }

                if (! empty($user->email)) {
                    $query->orWhere('login', $user->email);
                }
            })
            ->first();

        if (! $student) {
            throw ValidationException::withMessages([
                'student' => 'Профиль студента не найден. Обратитесь к администратору.',
            ]);
        }

        if (! $student->group || $student->group->status !== 'active') {
            throw ValidationException::withMessages([
                'group' => 'Группа студента неактивна или не назначена.',
            ]);
        }

        return $student;
    }

    private function validateSurveyWindow(Survey $survey): void
    {
        if ($survey->status !== 'active') {
            throw ValidationException::withMessages([
                'survey_id' => 'Анкета неактивна.',
            ]);
        }

        $today = Carbon::today();

        if ($survey->start_date && $today->lt($survey->start_date)) {
            throw ValidationException::withMessages([
                'survey_id' => 'Анкетирование еще не началось.',
            ]);
        }

        if ($survey->end_date && $today->gt($survey->end_date)) {
            throw ValidationException::withMessages([
                'survey_id' => 'Срок анкетирования завершен.',
            ]);
        }
    }

    /**
     * @param mixed $optionId
     * @param mixed $textAnswer
     * @param mixed $numericAnswer
     */
    private function validateQuestionAnswer(SurveyQuestion $question, $optionId, $textAnswer, $numericAnswer, int $idx): void
    {
        if (in_array($question->question_type, ['single_choice', 'multiple_choice'], true)) {
            if ($optionId === null) {
                throw ValidationException::withMessages([
                    "answers.$idx.option_id" => 'Для вопроса с вариантами ответа необходимо выбрать опцию.',
                ]);
            }

            $exists = $question->options->contains('id', (int) $optionId);
            if (! $exists) {
                throw ValidationException::withMessages([
                    "answers.$idx.option_id" => 'Опция не принадлежит выбранному вопросу.',
                ]);
            }
        }

        if ($question->question_type === 'text' && $question->is_required && trim((string) $textAnswer) === '') {
            throw ValidationException::withMessages([
                "answers.$idx.text_answer" => 'Для текстового вопроса требуется ответ.',
            ]);
        }

        if ($question->question_type === 'numeric' && $question->is_required && $numericAnswer === null) {
            throw ValidationException::withMessages([
                "answers.$idx.numeric_answer" => 'Для числового вопроса требуется значение.',
            ]);
        }
    }
}
