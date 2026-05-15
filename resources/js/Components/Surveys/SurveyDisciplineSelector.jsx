import { CheckCircle2, Clock, AlertCircle, ChevronRight } from 'lucide-react';

export default function SurveyDisciplineSelector({ disciplines = [], surveys = [], onSelectDiscipline }) {
    const getDisciplineStatus = (discipline) => {
        const survey = surveys.find(s => s.discipline_id === discipline.id);
        
        if (!survey) {
            return { status: 'pending', label: 'Не начинала' };
        }
        
        if (survey.status === 'completed') {
            return { status: 'completed', label: 'Заполнена' };
        }
        
        if (survey.status === 'in_progress') {
            return { status: 'in_progress', label: 'В процессе' };
        }
        
        return { status: 'draft', label: 'Черновик' };
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 className="w-5 h-5 text-green-500" />;
            case 'in_progress':
                return <Clock className="w-5 h-5 text-blue-500" />;
            case 'draft':
                return <AlertCircle className="w-5 h-5 text-yellow-500" />;
            default:
                return <AlertCircle className="w-5 h-5 text-gray-500" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800';
            case 'in_progress':
                return 'bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800';
            case 'draft':
                return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:border-yellow-800';
            default:
                return 'bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-900/20 dark:border-gray-800';
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {disciplines.map((discipline) => {
                    const statusInfo = getDisciplineStatus(discipline);
                    
                    return (
                        <button
                            key={discipline.id}
                            onClick={() => onSelectDiscipline(discipline)}
                            className={`p-4 border rounded-lg text-left transition-all cursor-pointer ${getStatusColor(statusInfo.status)}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                                        {discipline.name}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                        Преподаватель: {discipline.teacher?.name || 'Не указан'}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(statusInfo.status)}
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-600 mt-1" />
                            </div>
                        </button>
                    );
                })}
            </div>

            {disciplines.length === 0 && (
                <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                        Нет доступных дисциплин для оценивания
                    </p>
                </div>
            )}
        </div>
    );
}
