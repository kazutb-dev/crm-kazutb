import { useState } from 'react';
import { router } from '@inertiajs/react';
import { ArrowLeft, Loader } from 'lucide-react';

export default function SurveyForm({ survey, discipline, onBack, onComplete }) {
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const handleRatingChange = (questionId, value) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: value
        }));
    };

    const handleTextChange = (questionId, value) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: value
        }));
    };

    const validateAnswers = () => {
        const newErrors = {};
        
        if (!survey.questions) {
            return newErrors;
        }

        survey.questions.forEach(question => {
            if (question.is_required && !answers[question.id]) {
                newErrors[question.id] = 'Это поле обязательно';
            }
        });

        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const newErrors = validateAnswers();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`/surveys/${survey.id}/store-answers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                },
                body: JSON.stringify({
                    answers: answers
                })
            });

            if (response.ok) {
                // Завершить анкету
                const completeResponse = await fetch(`/surveys/${survey.id}/complete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                    }
                });

                if (completeResponse.ok) {
                    onComplete();
                }
            }
        } catch (error) {
            console.error('Error submitting survey:', error);
            setErrors({ form: 'Ошибка при отправке формы' });
        } finally {
            setLoading(false);
        }
    };

    if (!survey.questions) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">Загрузка вопросов...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* Заголовок */}
            <div className="mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Вернуться
                </button>
                
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {discipline?.name}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                    Преподаватель: {discipline?.teacher?.name || 'Не указан'}
                </p>
            </div>

            {/* Ошибка формы */}
            {errors.form && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
                    <p className="text-red-800 dark:text-red-200">{errors.form}</p>
                </div>
            )}

            {/* Форма */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {survey.questions.map((question, index) => (
                    <div
                        key={question.id}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                                {index + 1}. {question.text}
                                {question.is_required && (
                                    <span className="text-red-500 ml-1">*</span>
                                )}
                            </label>
                        </div>

                        {/* Рейтинг вопрос */}
                        {question.type === 'rating' && (
                            <div className="flex gap-2 flex-wrap">
                                {Array.from({ length: 5 }, (_, i) => i + 1).map(value => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => handleRatingChange(question.id, value)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                            answers[question.id] === value
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        {value}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Текстовый вопрос */}
                        {question.type === 'text' && (
                            <textarea
                                value={answers[question.id] || ''}
                                onChange={(e) => handleTextChange(question.id, e.target.value)}
                                placeholder="Введите ваш ответ"
                                rows="4"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        )}

                        {/* Ошибка валидации */}
                        {errors[question.id] && (
                            <p className="text-red-500 text-sm mt-2">{errors[question.id]}</p>
                        )}
                    </div>
                ))}

                {/* Кнопки действий */}
                <div className="flex gap-4 pt-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                    >
                        {loading && <Loader className="w-4 h-4 animate-spin" />}
                        {loading ? 'Отправка...' : 'Отправить'}
                    </button>
                </div>
            </form>
        </div>
    );
}
