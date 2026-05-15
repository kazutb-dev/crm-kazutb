import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

const emptyForm = {
    first_name: '',
    last_name: '',
    middle_name: '',
    student_id: '',
    email: '',
    phone: '',
    group_id: '',
};

export default function SurveyStudents({ students = [], groups = [] }) {
    const { flash } = usePage().props;
    const [editingStudent, setEditingStudent] = useState(null);

    const form = useForm(emptyForm);

    const startCreate = () => {
        setEditingStudent(null);
        form.setData(emptyForm);
        form.clearErrors();
    };

    const startEdit = (student) => {
        setEditingStudent(student);
        form.setData({
            first_name: student.first_name || '',
            last_name: student.last_name || '',
            middle_name: student.middle_name || '',
            student_id: student.student_id || '',
            email: student.email || '',
            phone: student.phone || '',
            group_id: student.group_id ? String(student.group_id) : '',
        });
        form.clearErrors();
    };

    const submit = (e) => {
        e.preventDefault();

        if (editingStudent) {
            form.patch(route('admin.surveys.students.update', editingStudent.id), {
                preserveScroll: true,
                onSuccess: () => startCreate(),
            });
            return;
        }

        form.post(route('admin.surveys.students.store'), {
            preserveScroll: true,
            onSuccess: () => startCreate(),
        });
    };

    const destroyStudent = (student) => {
        if (!window.confirm(`Удалить студента "${student.full_name}"?`)) {
            return;
        }

        router.delete(route('admin.surveys.students.destroy', student.id), {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Анкетирование - Студенты" />

            <div className="py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Студенты</h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Полное управление студентами в модуле анкетирования
                        </p>
                    </div>

                    {flash?.success && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            {flash.success}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    {editingStudent ? 'Редактировать студента' : 'Добавить студента'}
                                </h2>

                                <form onSubmit={submit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Имя</label>
                                        <input
                                            type="text"
                                            value={form.data.first_name}
                                            onChange={(e) => form.setData('first_name', e.target.value)}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2"
                                        />
                                        {form.errors.first_name && <p className="text-sm text-red-600 mt-1">{form.errors.first_name}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Фамилия</label>
                                        <input
                                            type="text"
                                            value={form.data.last_name}
                                            onChange={(e) => form.setData('last_name', e.target.value)}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2"
                                        />
                                        {form.errors.last_name && <p className="text-sm text-red-600 mt-1">{form.errors.last_name}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Отчество</label>
                                        <input
                                            type="text"
                                            value={form.data.middle_name}
                                            onChange={(e) => form.setData('middle_name', e.target.value)}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2"
                                        />
                                        {form.errors.middle_name && <p className="text-sm text-red-600 mt-1">{form.errors.middle_name}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student ID</label>
                                        <input
                                            type="text"
                                            value={form.data.student_id}
                                            onChange={(e) => form.setData('student_id', e.target.value)}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2"
                                        />
                                        {form.errors.student_id && <p className="text-sm text-red-600 mt-1">{form.errors.student_id}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={form.data.email}
                                            onChange={(e) => form.setData('email', e.target.value)}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2"
                                        />
                                        {form.errors.email && <p className="text-sm text-red-600 mt-1">{form.errors.email}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Телефон</label>
                                        <input
                                            type="text"
                                            value={form.data.phone}
                                            onChange={(e) => form.setData('phone', e.target.value)}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2"
                                        />
                                        {form.errors.phone && <p className="text-sm text-red-600 mt-1">{form.errors.phone}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Группа</label>
                                        <select
                                            value={form.data.group_id}
                                            onChange={(e) => form.setData('group_id', e.target.value)}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2"
                                        >
                                            <option value="">Выберите группу</option>
                                            {groups.map((group) => (
                                                <option key={group.id} value={group.id}>{group.name}</option>
                                            ))}
                                        </select>
                                        {form.errors.group_id && <p className="text-sm text-red-600 mt-1">{form.errors.group_id}</p>}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="submit"
                                            disabled={form.processing}
                                            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                                        >
                                            {editingStudent ? 'Сохранить' : 'Создать'}
                                        </button>

                                        {editingStudent && (
                                            <button
                                                type="button"
                                                onClick={startCreate}
                                                className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200"
                                            >
                                                Отмена
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>

                        <div className="lg:col-span-2">
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Список студентов ({students.length})</h2>
                                </div>

                                {students.length === 0 ? (
                                    <div className="px-5 py-8 text-sm text-gray-600 dark:text-gray-400">Студенты еще не добавлены.</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-900/40">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">ФИО</th>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Student ID</th>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Группа</th>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Email</th>
                                                    <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map((student) => (
                                                    <tr key={student.id} className="border-t border-gray-200 dark:border-gray-700">
                                                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{student.full_name}</td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{student.student_id}</td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{student.group?.name || '—'}</td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{student.email || '—'}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="inline-flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startEdit(student)}
                                                                    className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200"
                                                                >
                                                                    Редактировать
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => destroyStudent(student)}
                                                                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700"
                                                                >
                                                                    Удалить
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
