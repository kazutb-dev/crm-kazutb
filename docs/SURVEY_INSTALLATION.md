# Модуль "Анкетирование студентов" - Инструкция по развертыванию

## 📋 Обзор

Модуль предназначен для оценки качества преподавания по дисциплинам. Включает:
- Независимую базу студентов и групп
- Систему анкетирования со статистикой
- Детальные отчеты по преподавателям и дисциплинам
- API для интеграции

## 📁 Созданные файлы

### Миграции (database/migrations/)
```
2026_05_15_000001_create_students_table.php       # Студенты
2026_05_15_000002_create_groups_table.php         # Группы
2026_05_15_000003_create_disciplines_table.php    # Дисциплины
2026_05_15_000004_create_discipline_group_table.php # Связь дисциплина-группа
2026_05_15_000005_create_survey_questions_table.php # Вопросы анкеты
2026_05_15_000006_create_surveys_table.php        # Анкеты
2026_05_15_000007_create_survey_answers_table.php # Ответы
```

### Модели (app/Models/)
```
Student.php               # Модель студента
Group.php                # Модель группы
Discipline.php           # Модель дисциплины
Survey.php               # Модель анкеты
SurveyQuestion.php       # Модель вопроса
SurveyAnswer.php         # Модель ответа
User.php (обновлена)     # Добавлены методы для преподавателей
```

### Контроллеры (app/Http/Controllers/)
```
SurveyStudentController.php        # Для студентов (заполнение анкет)
SurveyAdminController.php          # Для администраторов (управление)
SurveyAnalyticsController.php      # Для аналитики и отчетов
SurveyQuestionController.php       # Для управления вопросами
```

### Сервисы (app/Services/)
```
SurveyService.php                  # Основной сервис
SurveyAnalyticsService.php         # Аналитика и статистика
```

### Фабрики (database/factories/)
```
StudentFactory.php
GroupFactory.php
DisciplineFactory.php
SurveyFactory.php
SurveyQuestionFactory.php
SurveyAnswerFactory.php
```

### Сиды (database/seeders/)
```
SurveyQuestionsSeeder.php          # Стандартные вопросы
SurveyTestDataSeeder.php           # Тестовые данные
```

### Команды (app/Console/Commands/)
```
CreateSurveysCommand.php           # Создание анкет
GenerateSurveyReportCommand.php    # Генерация отчетов
```

### Политики (app/Policies/)
```
SurveyPolicy.php
SurveyQuestionPolicy.php
```

### Документация (docs/)
```
SURVEY_MODULE.md                   # Полная документация модуля
INSTALLATION.md                    # Этот файл
```

## 🚀 Установка

### 1. Запустить миграции
```bash
php artisan migrate
```

### 2. Инициализировать стандартные вопросы
```bash
php artisan db:seed --class=SurveyQuestionsSeeder
```

### 3. (Опционально) Создать тестовые данные
```bash
php artisan db:seed --class=SurveyTestDataSeeder
```

## 📊 Быстрый старт

### Создание группы и студентов

```bash
# Через tinker
php artisan tinker

# Создать группу
$group = App\Models\Group::create([
    'name' => 'БПМ-20-1',
    'code' => 'БПМ-20-1'
]);

# Создать студентов
App\Models\Student::factory(30)->create(['group_id' => $group->id]);
```

### Создание дисциплин

```bash
# Получить преподавателя
$teacher = App\Models\User::where('role', 'teacher')->first();

# Создать дисциплину
$discipline = App\Models\Discipline::create([
    'name' => 'Математика',
    'code' => 'MATH101',
    'user_id' => $teacher->id,
    'credit_hours' => 60
]);

# Привязать к группе
$discipline->groups()->attach($group->id);
```

### Создание анкет

```bash
# Команда для массового создания
php artisan survey:create-bulk {group_id} {discipline_id}

# Пример
php artisan survey:create-bulk 1 1
```

### Генерация отчетов

```bash
# Таблица (по умолчанию)
php artisan survey:generate-report 1

# JSON формат
php artisan survey:generate-report 1 --format=json

# CSV формат
php artisan survey:generate-report 1 --format=csv
```

## 🔗 API Маршруты

### Студент
- `GET /surveys?student_id={id}` - Список анкет
- `GET /surveys/{id}/start` - Начать анкету
- `POST /surveys/{id}/store-answers` - Сохранить ответы
- `POST /surveys/{id}/complete` - Завершить анкету
- `GET /surveys/{id}/show` - Результаты

### Администратор
- `GET /admin/surveys` - Все анкеты
- `GET /admin/surveys/create` - Создание
- `POST /admin/surveys/bulk-create` - Массовое создание
- `GET /admin/surveys/{id}` - Просмотр
- `DELETE /admin/surveys/{id}` - Удаление

### Вопросы
- `GET /admin/survey-questions` - Список
- `POST /admin/survey-questions` - Создание
- `PATCH /admin/survey-questions/{id}` - Редактирование
- `DELETE /admin/survey-questions/{id}` - Удаление
- `GET /api/survey-questions/active` - Активные (API)

### Аналитика
- `GET /admin/surveys/analytics/teacher/{id}` - По преподавателю
- `GET /admin/surveys/analytics/discipline/{id}` - По дисциплине
- `GET /admin/surveys/analytics/system-report` - Системный отчет

## 📝 Примеры использования

### Использование сервиса для создания анкет

```php
use App\Services\SurveyService;

$surveyService = app(SurveyService::class);

// Создать одну анкету
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
```

### Использование аналитики

```php
use App\Services\SurveyAnalyticsService;

$analytics = app(SurveyAnalyticsService::class);

// Рейтинг преподавателя
$rating = $analytics->getTeacherOverallRating($teacher);

// Статистика по дисциплине
$stats = $analytics->getDisciplineQuestionStatistics($discipline);

// Топ преподавателей
$topTeachers = $analytics->getTopTeachers(limit: 10);
```

### Работа с анкетой

```php
use App\Models\Survey;

$survey = Survey::find(1);

// Начать
$survey->start();

// Добавить ответ
$survey->answers()->create([
    'question_id' => 1,
    'rating_value' => 5
]);

// Завершить
$survey->complete();

// Получить оценку
$rating = $survey->getAverageRating();
```

## 🧪 Тестирование

```bash
# Запустить тесты модуля
php artisan test tests/Feature/SurveyTest.php
php artisan test tests/Feature/SurveyAnalyticsTest.php

# С покрытием
php artisan test --coverage
```

## 🔐 Безопасность

### Политики доступа (Policies)
- Студент видит только свои анкеты
- Преподаватель видит анкеты по своим дисциплинам
- Администратор имеет полный доступ

### Валидация
- Проверка уникальности: (student_id, teacher_id, discipline_id, group_id)
- Проверка обязательных вопросов перед завершением
- Проверка доступа на все эндпоинты

## 🐛 Отладка

### Tinker
```bash
php artisan tinker

# Создать тестовые данные
App\Models\Student::factory(10)->create();
App\Models\Survey::factory(5)->create();

# Получить статистику
$teacher = App\Models\User::where('role', 'teacher')->first();
$teacher->getOverallAverageRating();
```

### Логирование
Все операции логируются в `storage/logs/`. Для детального логирования добавьте в контроллеры:

```php
Log::info('Survey completed', [
    'survey_id' => $survey->id,
    'rating' => $survey->getAverageRating(),
]);
```

## 📚 Структура данных

### Связи

```
User (role='teacher')
├── hasMany: Discipline
└── hasMany: Survey (teacher_id)

Group
├── hasMany: Student
├── belongsToMany: Discipline (через discipline_group)
└── hasMany: Survey

Student
├── belongsTo: Group
└── hasMany: Survey

Discipline
├── belongsTo: User (teacher)
├── belongsToMany: Group (через discipline_group)
└── hasMany: Survey

Survey
├── belongsTo: Student
├── belongsTo: User (teacher)
├── belongsTo: Discipline
├── belongsTo: Group
└── hasMany: SurveyAnswer

SurveyQuestion
└── hasMany: SurveyAnswer

SurveyAnswer
├── belongsTo: Survey
└── belongsTo: SurveyQuestion
```

## 🎯 Бизнес-логика

### Статусы анкеты
- `draft` - Создана, но не начата
- `in_progress` - Студент начал заполнять
- `completed` - Полностью заполнена
- `cancelled` - Отменена

### Типы вопросов
- `rating` - Рейтинговая оценка (1-5)
- `text` - Текстовый ответ
- `multiple_choice` - Выбор из вариантов

### Вычисление оценок
- **Средняя оценка анкеты**: среднее всех рейтинговых вопросов
- **Средняя оценка дисциплины**: среднее всех завершенных анкет по дисциплине
- **Общая оценка преподавателя**: среднее рейтингов по всем его дисциплинам

## 📋 Чек-лист развертывания

- [ ] Выполнены все миграции (`php artisan migrate`)
- [ ] Инициализированы вопросы (`php artisan db:seed --class=SurveyQuestionsSeeder`)
- [ ] Созданы группы и студенты
- [ ] Созданы или синхронизированы преподаватели (User с role='teacher')
- [ ] Созданы дисциплины и привязаны к группам
- [ ] Созданы анкеты (`php artisan survey:create-bulk`)
- [ ] Протестированы маршруты API
- [ ] Настроены политики доступа в AuthServiceProvider
- [ ] Созданы представления Inertia (для фронтенда)

## 🔧 Настройка

### Кастомизация вопросов

```bash
php artisan tinker

# Добавить новый вопрос
App\Models\SurveyQuestion::create([
    'text' => 'Мой вопрос',
    'order' => 10,
    'type' => 'rating',
    'min_rating' => 1,
    'max_rating' => 5,
    'is_required' => true,
    'is_active' => true
]);

# Деактивировать вопрос
$question = App\Models\SurveyQuestion::find(1);
$question->update(['is_active' => false]);
```

### Экспорт данных

```php
use App\Services\SurveyService;

$surveyService = app(SurveyService::class);
$csv = $surveyService->exportToCsv($discipline);
```

## 📖 Дополнительная документация

Полная документация доступна в `docs/SURVEY_MODULE.md`

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `storage/logs/`
2. Убедитесь в выполнении миграций: `php artisan migrate:status`
3. Запустите тесты: `php artisan test`
4. Проверьте права доступа в базе данных

## 📄 Лицензия

MIT
