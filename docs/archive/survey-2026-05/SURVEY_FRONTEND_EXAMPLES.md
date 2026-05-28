# Примеры кода для разработки фронтенда

## React компоненты для заполнения анкеты

### Компонент формы анкеты

```jsx
// resources/js/Pages/Survey/SurveyForm.jsx
import React, { useState } from 'react';
import { useForm } from '@inertiajs/react';
import Button from '@/Components/Button';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';

export default function SurveyForm({ survey, questions }) {
    const { data, setData, post, processing, errors } = useForm({
        survey_id: survey.id,
        answers: questions.map(q => ({
            question_id: q.id,
            rating_value: null,
            text_answer: null,
        })),
        notes: '',
    });

    const handleRatingChange = (questionIndex, value) => {
        const newAnswers = [...data.answers];
        newAnswers[questionIndex].rating_value = parseInt(value);
        setData('answers', newAnswers);
    };

    const handleTextChange = (questionIndex, value) => {
        const newAnswers = [...data.answers];
        newAnswers[questionIndex].text_answer = value;
        setData('answers', newAnswers);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('surveys.store-answers'));
    };

    const handleComplete = () => {
        post(route('surveys.complete'));
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white shadow-md rounded-lg p-8">
                <h1 className="text-2xl font-bold mb-2">Оценка качества преподавания</h1>
                <p className="text-gray-600 mb-6">
                    Дисциплина: {survey.discipline.name}
                    <br />
                    Преподаватель: {survey.teacher.first_name} {survey.teacher.last_name}
                </p>

                <form onSubmit={handleSubmit}>
                    {questions.map((question, index) => (
                        <div key={question.id} className="mb-8 pb-6 border-b">
                            <label className="block text-lg font-semibold mb-4">
                                {index + 1}. {question.text}
                                {question.is_required && <span className="text-red-500">*</span>}
                            </label>

                            {question.type === 'rating' && (
                                <div className="flex gap-2">
                                    {[...Array(5)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            type="button"
                                            onClick={() => handleRatingChange(index, i + 1)}
                                            className={`w-12 h-12 rounded border-2 font-semibold transition ${
                                                data.answers[index].rating_value === i + 1
                                                    ? 'bg-blue-500 text-white border-blue-500'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                                            }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {question.type === 'text' && (
                                <textarea
                                    value={data.answers[index].text_answer || ''}
                                    onChange={(e) => handleTextChange(index, e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows="4"
                                    placeholder="Введите ваш ответ..."
                                />
                            )}
                        </div>
                    ))}

                    <div className="mb-6">
                        <InputLabel htmlFor="notes" value="Общие комментарии" />
                        <textarea
                            id="notes"
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows="4"
                            placeholder="Ваши замечания и пожелания (опционально)"
                        />
                    </div>

                    <div className="flex gap-4">
                        <Button
                            type="submit"
                            disabled={processing}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {processing ? 'Сохранение...' : 'Сохранить ответы'}
                        </Button>
                        <Button
                            onClick={handleComplete}
                            disabled={processing}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {processing ? 'Завершение...' : 'Завершить анкету'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
```

### Список анкет студента

```jsx
// resources/js/Pages/Survey/StudentSurveys.jsx
import React from 'react';
import { Link } from '@inertiajs/react';
import PrimaryButton from '@/Components/PrimaryButton';

export default function StudentSurveys({ surveys, availableDisciplines }) {
    return (
        <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6">Мои анкеты</h1>

            {/* Доступные дисциплины */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Доступные для оценки дисциплины</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableDisciplines.map((discipline) => (
                        <div
                            key={discipline.id}
                            className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:shadow-lg transition"
                        >
                            <h3 className="font-semibold text-lg">{discipline.name}</h3>
                            <p className="text-gray-600">
                                {discipline.teacher.first_name} {discipline.teacher.last_name}
                            </p>
                            <Link href={route('surveys.start', { survey_id: null })}>
                                <PrimaryButton className="mt-4">
                                    Начать оценку
                                </PrimaryButton>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>

            {/* Заполненные анкеты */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Мои оценки</h2>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border px-4 py-2 text-left">Дисциплина</th>
                                <th className="border px-4 py-2 text-left">Преподаватель</th>
                                <th className="border px-4 py-2 text-center">Статус</th>
                                <th className="border px-4 py-2 text-center">Дата</th>
                                <th className="border px-4 py-2 text-center">Действие</th>
                            </tr>
                        </thead>
                        <tbody>
                            {surveys.data.map((survey) => (
                                <tr key={survey.id} className="hover:bg-gray-50">
                                    <td className="border px-4 py-2">{survey.discipline.name}</td>
                                    <td className="border px-4 py-2">
                                        {survey.teacher.first_name} {survey.teacher.last_name}
                                    </td>
                                    <td className="border px-4 py-2 text-center">
                                        <span
                                            className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                                survey.status === 'completed'
                                                    ? 'bg-green-100 text-green-800'
                                                    : survey.status === 'in_progress'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-gray-100 text-gray-800'
                                            }`}
                                        >
                                            {survey.status === 'completed'
                                                ? 'Выполнена'
                                                : survey.status === 'in_progress'
                                                ? 'В процессе'
                                                : 'Черновик'}
                                        </span>
                                    </td>
                                    <td className="border px-4 py-2 text-center">
                                        {new Date(survey.completed_at).toLocaleDateString('ru-RU')}
                                    </td>
                                    <td className="border px-4 py-2 text-center">
                                        {survey.status !== 'completed' ? (
                                            <Link href={route('surveys.start', { survey_id: survey.id })}>
                                                <PrimaryButton size="sm">Продолжить</PrimaryButton>
                                            </Link>
                                        ) : (
                                            <Link href={route('surveys.show', { survey_id: survey.id })}>
                                                <PrimaryButton size="sm">Просмотр</PrimaryButton>
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
```

### Dashboard аналитики

```jsx
// resources/js/Pages/Survey/DisciplineAnalytics.jsx
import React from 'react';
import Chart from 'chart.js/auto';
import { useEffect, useRef } from 'react';

export default function DisciplineAnalytics({
    discipline,
    completed_surveys_count,
    average_rating,
    question_analytics,
    group_analytics,
}) {
    const chartRef = useRef(null);
    const chart = useRef(null);

    useEffect(() => {
        if (chartRef.current && question_analytics.length > 0) {
            const ctx = chartRef.current.getContext('2d');
            if (chart.current) {
                chart.current.destroy();
            }
            chart.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: question_analytics.map((q) => q.question_text.substring(0, 30) + '...'),
                    datasets: [
                        {
                            label: 'Средняя оценка',
                            data: question_analytics.map((q) => q.average_rating),
                            backgroundColor: 'rgba(59, 130, 246, 0.5)',
                            borderColor: 'rgb(59, 130, 246)',
                            borderWidth: 1,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: `Статистика по дисциплине "${discipline.name}"`,
                        },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 5,
                        },
                    },
                },
            });
        }

        return () => {
            if (chart.current) {
                chart.current.destroy();
            }
        };
    }, [question_analytics]);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-2">{discipline.name}</h1>
            <p className="text-gray-600 mb-6">
                Преподаватель: {discipline.teacher.first_name} {discipline.teacher.last_name}
            </p>

            {/* Карточки статистики */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <p className="text-gray-600 text-sm">Выполненных анкет</p>
                    <p className="text-3xl font-bold text-blue-600">{completed_surveys_count}</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6">
                    <p className="text-gray-600 text-sm">Средняя оценка</p>
                    <p className="text-3xl font-bold text-green-600">{average_rating.toFixed(2)}/5</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6">
                    <p className="text-gray-600 text-sm">Кол-во групп</p>
                    <p className="text-3xl font-bold text-purple-600">{group_analytics.length}</p>
                </div>
            </div>

            {/* График */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <canvas ref={chartRef}></canvas>
            </div>

            {/* Таблица результатов */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Результаты по вопросам</h2>
                <table className="w-full">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left py-2">Вопрос</th>
                            <th className="text-center py-2">Средняя оценка</th>
                            <th className="text-center py-2">Мин</th>
                            <th className="text-center py-2">Макс</th>
                            <th className="text-center py-2">Ответов</th>
                        </tr>
                    </thead>
                    <tbody>
                        {question_analytics.map((q) => (
                            <tr key={q.question_id} className="border-b hover:bg-gray-50">
                                <td className="py-2">{q.question_text}</td>
                                <td className="text-center font-semibold">
                                    <span
                                        className={`px-3 py-1 rounded ${
                                            q.average_rating >= 4
                                                ? 'bg-green-100 text-green-800'
                                                : q.average_rating >= 3
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-red-100 text-red-800'
                                        }`}
                                    >
                                        {q.average_rating.toFixed(2)}
                                    </span>
                                </td>
                                <td className="text-center">{q.min_rating}</td>
                                <td className="text-center">{q.max_rating}</td>
                                <td className="text-center">{q.response_count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
```

## API интеграция

### Хук для работы с анкетами

```javascript
// resources/js/hooks/useSurvey.js
import { useState, useCallback } from 'react';
import axios from 'axios';

export function useSurvey() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const startSurvey = useCallback(async (surveyId, studentId) => {
        setLoading(true);
        try {
            const response = await axios.get(
                `/surveys/${surveyId}/start?student_id=${studentId}`
            );
            return response.data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const saveAnswers = useCallback(async (answers) => {
        setLoading(true);
        try {
            const response = await axios.post(
                `/surveys/${answers.survey_id}/store-answers`,
                answers
            );
            return response.data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const completeSurvey = useCallback(async (surveyId, studentId) => {
        setLoading(true);
        try {
            const response = await axios.post(
                `/surveys/${surveyId}/complete?student_id=${studentId}`
            );
            return response.data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        startSurvey,
        saveAnswers,
        completeSurvey,
    };
}
```

### Компонент рейтинга

```jsx
// resources/js/Components/RatingInput.jsx
export default function RatingInput({ value, onChange, max = 5 }) {
    return (
        <div className="flex gap-2">
            {[...Array(max)].map((_, i) => (
                <button
                    key={i + 1}
                    type="button"
                    onClick={() => onChange(i + 1)}
                    className={`w-10 h-10 rounded-full font-bold transition ${
                        value === i + 1
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    {i + 1}
                </button>
            ))}
        </div>
    );
}
```

## Инструкции по использованию

### Интеграция с проектом

1. **Создать новые страницы в `resources/js/Pages/Survey/`**
2. **Добавить маршруты в React Router**
3. **Импортировать компоненты в Layout**

### Пример структуры проекта

```
resources/js/
├── Pages/
│   └── Survey/
│       ├── SurveyForm.jsx
│       ├── StudentSurveys.jsx
│       ├── DisciplineAnalytics.jsx
│       └── TeacherAnalytics.jsx
├── Components/
│   └── RatingInput.jsx
└── hooks/
    └── useSurvey.js
```

### Внедрение в существующий Layout

```jsx
// resources/js/Layouts/AppLayout.jsx
import { Link } from '@inertiajs/react';

export default function AppLayout() {
    return (
        <nav>
            <Link href={route('surveys.index')}>Анкеты</Link>
            <Link href={route('admin.surveys.index')}>Управление</Link>
            <Link href={route('admin.surveys.analytics.system-report')}>Аналитика</Link>
        </nav>
    );
}
```

## Стили (Tailwind CSS)

Все компоненты используют **Tailwind CSS**, который уже интегрирован в проект.

### Цветовая схема

- **Синий**: информация, основные действия
- **Зеленый**: успех, завершение
- **Желтый**: в процессе, предупреждение
- **Красный**: ошибки, низкие оценки

## Дополнительные библиотеки

Рекомендуемые зависимости для фронтенда:

```json
{
    "dependencies": {
        "chart.js": "^4.0.0",
        "react-chartjs-2": "^5.0.0",
        "date-fns": "^2.30.0",
        "react-icons": "^4.11.0"
    }
}
```

## Тестирование компонентов

```javascript
// resources/js/Pages/Survey/__tests__/SurveyForm.test.jsx
import { render, screen, userEvent } from '@testing-library/react';
import SurveyForm from '../SurveyForm';

describe('SurveyForm', () => {
    it('renders survey questions', () => {
        const survey = { id: 1, discipline: { name: 'Math' }, teacher: {} };
        const questions = [{ id: 1, text: 'Question?', type: 'rating' }];
        
        render(<SurveyForm survey={survey} questions={questions} />);
        
        expect(screen.getByText('Question?')).toBeInTheDocument();
    });
});
```

## Поддержка браузеров

Компоненты поддерживают:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Все компоненты адаптивны для мобильных устройств.
