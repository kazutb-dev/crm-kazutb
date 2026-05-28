# Isolated Questionnaire Module

## Goal
Build a fully isolated questionnaire domain that does not break existing authentication, users, roles, and legacy survey flows.

## Data Model
The module uses dedicated `questionnaire_*` tables:

- `questionnaire_groups`
- `questionnaire_students`
- `questionnaire_disciplines`
- `questionnaire_teacher_disciplines`
- `questionnaire_group_disciplines`
- `questionnaire_surveys`
- `questionnaire_survey_questions`
- `questionnaire_survey_options`
- `questionnaire_survey_responses`
- `questionnaire_survey_answers`

### Duplicate Protection
`questionnaire_survey_responses` includes a composite unique key:

- `survey_id`
- `student_id`
- `teacher_id`
- `discipline_id`
- `group_id`
- `teacher_discipline_id`
- `group_discipline_id`
- `academic_year`
- `semester`

This prevents repeated submissions for the same student + survey + teacher + discipline + group + period tuple.

## Business Rules
The submit flow validates:

- authenticated user is mapped to an active `questionnaire_student`
- student has an active group
- selected `group_discipline_id` belongs to the same student group
- selected group-discipline period matches survey period
- survey is active and within date window
- no duplicate response exists for the unique tuple
- each answer question belongs to selected survey
- selected option belongs to selected question
- required questions are present

## API Endpoints
All endpoints are under `auth:sanctum`.

### 1) Student: available surveys
`GET /api/questionnaire/student/surveys`

Response includes survey metadata, linked teacher/discipline/group, and question list.

### 2) Student: submit answers
`POST /api/questionnaire/student/surveys/submit`

Example request:

```json
{
  "survey_id": 1,
  "group_discipline_id": 5,
  "answers": [
    {
      "question_id": 10,
      "option_id": 42
    },
    {
      "question_id": 11,
      "text_answer": "Все понятно"
    }
  ]
}
```

Successful response:

```json
{
  "message": "Ответы успешно сохранены.",
  "data": {
    "response_id": 123,
    "submitted_at": "2026-05-22 12:34:56"
  }
}
```

### 3) Admin: results
`GET /api/questionnaire/admin/results`

Optional filters:

- `survey_id`
- `group_id`
- `teacher_id`
- `discipline_id`
- `academic_year`
- `semester`

Access: `admin` or `superadmin` role.

## Integration Notes
- Domain models are in `App\Models\Questionnaire\*`.
- Services are in `App\Services\Questionnaire\*`.
- API controllers are in `App\Http\Controllers\Api\Questionnaire\*`.
- Existing `Survey` module remains untouched and can run in parallel during migration period.

## Tests Added
`tests/Feature/Questionnaire/QuestionnaireApiTest.php`

Covered scenarios:

- student receives available surveys
- duplicate submission is rejected
- admin can view aggregated results

## Recommended Next Steps
1. Add admin CRUD endpoints for groups/disciplines/surveys/questions.
2. Add pagination and export for results.
3. Add front-end binding for new API while keeping old pages as fallback.
4. Add policy classes if fine-grained permissions are required.
