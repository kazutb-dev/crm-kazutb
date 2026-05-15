# Модуль «Анкетирование студентов»

## Описание

Модуль предназначен для оценки качества преподавания по дисциплинам. Студенты проходят анкетирование по конкретным дисциплинам и преподавателям, а система собирает результаты отдельно по каждой дисциплине преподавателя.

## Основные возможности

- **Независимая модель студентов** - отдельная база студентов, не связанная с Platonus
- **Группы студентов** - студенты организованы по группам, один студент - одна группа
- **Дисциплины** - привязаны к преподавателям, один преподаватель может вести несколько дисциплин
- **Гибкая анкета** - кастомизируемые вопросы с поддержкой разных типов (рейтинг, текст, выбор)
- **Детальная аналитика** - отчеты по преподавателям, дисциплинам и системе в целом
- **Раздельная оценка** - преподаватель может иметь разные рейтинги по разным дисциплинам

## Структура базы данных

### Таблицы

#### `groups`
Группы студентов

```sql
- id
- name (уникально) - название группы
- code (уникально) - код группы
- department_id (nullable) - кафедра
- description
- timestamps
```

#### `students`
Студенты (независимо от Platonus)

```sql
- id
- first_name
- last_name
- middle_name (nullable)
- student_id (уникально) - номер студенческого билета
- email (nullable, уникально)
- phone (nullable)
- group_id - группа студента
- timestamps
```

#### `disciplines`
Дисциплины

```sql
- id
- name - название дисциплины
- code (уникально) - код
- user_id - преподаватель (User с role='teacher')
- department_id (nullable)
- description (nullable)
- credit_hours - кредиты (часы)
- timestamps
```

#### `discipline_group`
Связь между дисциплинами и группами (many-to-many)

```sql
- id
- discipline_id
- group_id
- unique: (discipline_id, group_id)
- timestamps
```

#### `survey_questions`
Вопросы анкеты

```sql
- id
- text - текст вопроса
- order - порядок вопроса
- type (rating|text|multiple_choice)
- min_rating - минимальная оценка
- max_rating - максимальная оценка
- is_required - обязательный вопрос
- is_active - активен ли вопрос
- timestamps
```

#### `surveys`
Анкеты

```sql
- id
- student_id - студент
- teacher_id - преподаватель (User с role='teacher')
- discipline_id - дисциплина
- group_id - группа
- status (draft|in_progress|completed|cancelled)
- started_at (nullable)
- completed_at (nullable)
- notes (nullable) - общие комментарии
- timestamps
```

#### `survey_answers`
Ответы на вопросы анкеты

```sql
- id
- survey_id
- question_id
- rating_value (nullable) - числовая оценка
- text_answer (nullable) - текстовый ответ
- selected_option (nullable) - выбранный вариант
- unique: (survey_id, question_id)
- timestamps
```

## Модели и связи

### Student
```php
- belongsTo: Group
- hasMany: Survey
```

### Group
```php
- belongsTo: Department (optional)
- hasMany: Student
- belongsToMany: Discipline (through discipline_group)
- hasMany: Survey
```

### Discipline
```php
- belongsTo: User (teacher)
- belongsTo: Department (optional)
- belongsToMany: Group (through discipline_group)
- hasMany: Survey
```

### Survey
```php
- belongsTo: Student
- belongsTo: User (teacher)
- belongsTo: Discipline
- belongsTo: Group
- hasMany: SurveyAnswer
```

### SurveyQuestion
```php
- hasMany: SurveyAnswer
```

### SurveyAnswer
```php
- belongsTo: Survey
- belongsTo: SurveyQuestion
```

### User
```php
- hasMany: Discipline (when role='teacher')
- hasMany: Survey (teacher_id)
```

## API

### Маршруты для студентов

```php
// Список анкет студента
GET /surveys?student_id={studentId}

// Начать заполнение анкеты
GET /surveys/{survey}/start?student_id={studentId}

// Сохранить ответы
POST /surveys/{survey}/store-answers
Body: {
    "answers": [
        {
            "question_id": 1,
            "rating_value": 5,
            "text_answer": null
        },
        ...
    ],
    "notes": "Общие комментарии"
}

// Завершить анкету
POST /surveys/{survey}/complete?student_id={studentId}

// Просмотреть результаты
GET /surveys/{survey}/show?student_id={studentId}
```

### Маршруты администратора

```php
// Список всех анкет
GET /admin/surveys

// Создание новой анкеты
GET /admin/surveys/create

// Массовое создание анкет
POST /admin/surveys/bulk-create
Body: {
    "group_id": 1,
    "discipline_id": 1
}

// Просмотр анкеты
GET /admin/surveys/{survey}

// Отмена анкеты
POST /admin/surveys/{survey}/cancel

// Удаление анкеты
DELETE /admin/surveys/{survey}
```

### Управление вопросами

```php
// Список вопросов
GET /admin/survey-questions

// Создание вопроса
POST /admin/survey-questions
Body: {
    "text": "Насколько понятно преподаватель объясняет материал?",
    "order": 1,
    "type": "rating",
    "min_rating": 1,
    "max_rating": 5,
    "is_required": true,
    "is_active": true
}

// Редактирование вопроса
PATCH /admin/survey-questions/{question}

// Удаление вопроса
DELETE /admin/survey-questions/{question}

// Получить активные вопросы (API)
GET /api/survey-questions/active
```

### Аналитика

```php
// Аналитика по преподавателю
GET /admin/surveys/analytics/teacher/{teacherId}

// Аналитика по дисциплине
GET /admin/surveys/analytics/discipline/{disciplineId}

// Системный отчет
GET /admin/surveys/analytics/system-report
```

## Сервисы

### SurveyService

```php
use App\Services\SurveyService;

$surveyService = app(SurveyService::class);

// Создать анкету
$survey = $surveyService->createSurvey(
    studentId: 1,
    teacherId: 5,
    disciplineId: 10,
    groupId: 1
);

// Массовое создание
$count = $surveyService->createBulkSurveys(
    groupId: 1,
    disciplineId: 10
);

// Получить доступные дисциплины для студента
$disciplines = $surveyService->getAvailableDisciplinesForStudent($student);

// Получить выполненные дисциплины
$completed = $surveyService->getCompletedDisciplinesForStudent($student);

// Получить ожидающие дисциплины
$pending = $surveyService->getPendingDisciplinesForStudent($student);

// Получить статистику по преподавателю
$stats = $surveyService->getTeacherStatistics($teacher);

// Получить статистику по дисциплине
$stats = $surveyService->getDisciplineStatistics($discipline);
```

### SurveyAnalyticsService

```php
use App\Services\SurveyAnalyticsService;

$analyticsService = app(SurveyAnalyticsService::class);

// Получить рейтинг преподавателя по дисциплине
$rating = $analyticsService->getTeacherDisciplineRating($teacher, $discipline);

// Получить общий рейтинг преподавателя
$rating = $analyticsService->getTeacherOverallRating($teacher);

// Получить рейтинги по всем дисциплинам
$ratings = $analyticsService->getTeacherRatings($teacher);

// Топ преподавателей
$topTeachers = $analyticsService->getTopTeachers(limit: 10);

// Топ дисциплин
$topDisciplines = $analyticsService->getTopDisciplines(limit: 10);

// Статистика по вопросам
$stats = $analyticsService->getDisciplineQuestionStatistics($discipline);

// Прогресс заполнения
$progress = $analyticsService->getSurveyCompletionProgress($discipline);

// Тренд оценок
$trend = $analyticsService->getDisciplineRatingTrend($discipline, $from, $to);
```

## Примеры использования

### Создание группы и студентов

```php
use App\Models\Group, App\Models\Student;

// Создать группу
$group = Group::create([
    'name' => 'БПМ-20-1',
    'code' => 'БПМ-20-1',
    'department_id' => 1,
]);

// Создать студентов
foreach (range(1, 30) as $i) {
    Student::create([
        'first_name' => "Иван$i",
        'last_name' => "Иванов",
        'student_id' => "STU" . str_pad($i, 6, '0', STR_PAD_LEFT),
        'email' => "student$i@example.com",
        'group_id' => $group->id,
    ]);
}
```

### Создание дисциплин

```php
use App\Models\Discipline, App\Models\User;

$teacher = User::where('role', 'teacher')->first();

$discipline = Discipline::create([
    'name' => 'Математика',
    'code' => 'MATH101',
    'user_id' => $teacher->id,
    'credit_hours' => 60,
]);

// Привязать дисциплину к группе
$discipline->groups()->attach($group->id);
```

### Создание анкет

```php
use App\Services\SurveyService;

$surveyService = app(SurveyService::class);

// Массовое создание для всех студентов группы
$created = $surveyService->createBulkSurveys(
    groupId: $group->id,
    disciplineId: $discipline->id
);

echo "Создано анкет: $created";
```

### Заполнение анкеты

```php
use App\Models\Survey, App\Models\SurveyAnswer;

$survey = Survey::where('student_id', $studentId)
    ->where('discipline_id', $disciplineId)
    ->first();

// Начать заполнение
$survey->start();

// Сохранить ответы
$questions = SurveyQuestion::where('is_active', true)->get();
foreach ($questions as $question) {
    SurveyAnswer::create([
        'survey_id' => $survey->id,
        'question_id' => $question->id,
        'rating_value' => 5, // или другой рейтинг
        'text_answer' => 'Комментарий',
    ]);
}

// Завершить анкету
$survey->complete();
```

### Получение отчетов

```php
use App\Services\SurveyAnalyticsService;

$analyticsService = app(SurveyAnalyticsService::class);

// Рейтинг преподавателя
$rating = $analyticsService->getTeacherDisciplineRating($teacher, $discipline);
echo "Рейтинг: $rating";

// Статистика по вопросам
$stats = $analyticsService->getDisciplineQuestionStatistics($discipline);
foreach ($stats as $stat) {
    echo "{$stat['question_text']}: {$stat['average_rating']}/5";
}

// Прогресс
$progress = $analyticsService->getSurveyCompletionProgress($discipline);
echo "Выполнено: {$progress['completion_percentage']}%";
```

## Инициализация

### Запуск миграций

```bash
php artisan migrate
```

### Инициализация вопросов по умолчанию

```bash
php artisan db:seed --class=SurveyQuestionsSeeder
```

### Создание тестовых данных (опционально)

```bash
php artisan db:seed --class=SurveyTestDataSeeder
```

## Методы моделей

### Survey

```php
$survey->start() // Начать заполнение
$survey->complete() // Завершить
$survey->cancel() // Отменить
$survey->areRequiredAnswersComplete() // Проверить обязательные вопросы
$survey->getAverageRating() // Средняя оценка
```

### Discipline

```php
$discipline->getAverageRating() // Средняя оценка
```

### User (Teacher)

```php
$teacher->disciplines() // Дисциплины преподавателя
$teacher->surveys() // Анкеты преподавателя
$teacher->isTeacher() // Проверка, преподаватель ли
$teacher->getAverageRatingByDiscipline($discipline) // Рейтинг по дисциплине
$teacher->getOverallAverageRating() // Общий рейтинг
```

### SurveyQuestion

```php
$question->answers() // Ответы на вопрос
SurveyQuestion::active() // Все активные вопросы
$question->getAverageRating() // Средний рейтинг на вопрос
```

## Безопасность

- Студент может видеть только свои анкеты
- Преподаватель может видеть анкеты по своим дисциплинам
- Администратор имеет полный доступ
- Анкеты уникальны по комбинации: (student_id, teacher_id, discipline_id, group_id)

## Тестирование

```bash
# Запустить тесты
php artisan test

# С покрытием
php artisan test --coverage
```

## Лицензия

MIT
