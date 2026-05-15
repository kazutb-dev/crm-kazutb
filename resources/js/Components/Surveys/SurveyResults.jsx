import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function SurveyResults({ survey, discipline, onBack }) {
    const getAverageRating = () => {
        if (!survey.answers) return 0;
        
        const ratingAnswers = survey.answers.filter(a => a.rating_value);
        if (ratingAnswers.length === 0) return 0;
        
        const sum = ratingAnswers.reduce((acc, a) => acc + (a.rating_value || 0), 0);
        return (sum / ratingAnswers.length).toFixed(2);
    };

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
            </div>

            {/* Статус заполнения */}
            <div className="p-6 bg-green-50 border border-green-200 rounded-lg mb-6 dark:bg-green-900/20 dark:border-green-800">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <div>
                        <h2 className="text-lg font-semibold text-green-900 dark:text-green-200">
                            Спасибо за вашу оценку!
                        </h2>
                        <p className="text-sm text-green-700 dark:text-green-300">
                            Анкета успешно заполнена и отправлена
                        </p>
                    </div>
                </div>
            </div>

            {/* Информация о дисциплине и преподавателе */}
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {discipline?.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                    Преподаватель: {discipline?.teacher?.name || 'Не указан'}
                </p>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Средняя оценка: <span className="font-semibold">{getAverageRating()} / 5</span>
                </p>
            </div>

            {/* Ваши ответы */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ваши ответы:</h3>
                
                {survey.answers && survey.answers.map((answer, index) => (
                    <div
                        key={answer.id}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                            {index + 1}. {answer.question?.text}
                        </p>
                        
                        {answer.rating_value && (
                            <div className="flex gap-1">
                                {Array.from({ length: 5 }, (_, i) => i + 1).map(star => (
                                    <span
                                        key={star}
                                        className={`text-2xl ${
                                            star <= answer.rating_value
                                                ? 'text-yellow-400'
                                                : 'text-gray-300'
                                        }`}
                                    >
                                        ★
                                    </span>
                                ))}
                            </div>
                        )}
                        
                        {answer.text_answer && (
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {answer.text_answer}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {/* Кнопка возврата */}
            <div className="mt-8">
                <button
                    onClick={onBack}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                    Вернуться к списку дисциплин
                </button>
            </div>
        </div>
    );
}
