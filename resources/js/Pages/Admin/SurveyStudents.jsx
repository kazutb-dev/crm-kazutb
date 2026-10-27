import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Pencil, Trash2, UserPlus, Users } from 'lucide-react';
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
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
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
        setConfirmState({
            open: true,
            description: `Удалить студента "${student.full_name}"?`,
            onConfirm: () => router.delete(route('admin.surveys.students.destroy', student.id), { preserveScroll: true }),
        });
    };

    const textFields = [
        { key: 'first_name', label: 'Имя', type: 'text' },
        { key: 'last_name', label: 'Фамилия', type: 'text' },
        { key: 'middle_name', label: 'Отчество', type: 'text' },
        { key: 'student_id', label: 'Student ID', type: 'text' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Телефон', type: 'text' },
    ];

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Студенты"
                    description="Полное управление студентами в модуле анкетирования"
                    meta={<StatusBadge tone="default">Всего: {students.length}</StatusBadge>}
                />
            )}
        >
            <Head title="Анкетирование - Студенты" />

            <div className="admin-page-wrap space-y-6">
                {flash?.success && <Notice tone="success">{flash.success}</Notice>}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {editingStudent ? <Pencil /> : <UserPlus />}
                                    {editingStudent ? 'Редактировать студента' : 'Добавить студента'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={submit} className="space-y-4">
                                    {textFields.map((field) => (
                                        <div key={field.key} className="space-y-2">
                                            <Label htmlFor={`survey-student-${field.key}`}>{field.label}</Label>
                                            <Input
                                                id={`survey-student-${field.key}`}
                                                type={field.type}
                                                value={form.data[field.key]}
                                                onChange={(e) => form.setData(field.key, e.target.value)}
                                            />
                                            {form.errors[field.key] && <p className="text-sm text-red-600">{form.errors[field.key]}</p>}
                                        </div>
                                    ))}

                                    <div className="space-y-2">
                                        <Label htmlFor="survey-student-group_id">Группа</Label>
                                        <select
                                            id="survey-student-group_id"
                                            value={form.data.group_id}
                                            onChange={(e) => form.setData('group_id', e.target.value)}
                                            className={qdFieldClass}
                                        >
                                            <option value="">Выберите группу</option>
                                            {groups.map((group) => (
                                                <option key={group.id} value={group.id}>{group.name}</option>
                                            ))}
                                        </select>
                                        {form.errors.group_id && <p className="text-sm text-red-600">{form.errors.group_id}</p>}
                                    </div>

                                    <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                                        {editingStudent && (
                                            <Button type="button" variant="outline" onClick={startCreate}>
                                                Отмена
                                            </Button>
                                        )}
                                        <Button type="submit" disabled={form.processing}>
                                            {editingStudent ? 'Сохранить' : 'Создать'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users />
                                    Список студентов ({students.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {students.length === 0 ? (
                                    <div className="px-5 py-12 text-center">
                                        <p className="font-display text-lg font-bold text-[#102945]">Студенты еще не добавлены</p>
                                        <p className="mt-1 text-sm text-slate-600">Заполните форму «Добавить студента», чтобы создать первую запись.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200">
                                                    <th className="px-5 py-3 text-left">ФИО</th>
                                                    <th className="px-5 py-3 text-left">Student ID</th>
                                                    <th className="px-5 py-3 text-left">Группа</th>
                                                    <th className="px-5 py-3 text-left">Email</th>
                                                    <th className="px-5 py-3 text-right">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map((student) => (
                                                    <tr key={student.id} className={`border-b border-slate-200 last:border-b-0 hover:bg-slate-50 ${editingStudent?.id === student.id ? 'bg-teal-50' : ''}`}>
                                                        <td className="px-5 py-3 font-medium text-slate-900">{student.full_name}</td>
                                                        <td className="px-5 py-3 font-mono text-xs text-slate-600">{student.student_id}</td>
                                                        <td className="px-5 py-3 text-slate-700">{student.group?.name || '—'}</td>
                                                        <td className="px-5 py-3 text-slate-600">{student.email || '—'}</td>
                                                        <td className="px-5 py-3 text-right">
                                                            <div className="inline-flex items-center gap-2">
                                                                <Button type="button" variant="outline" size="sm" onClick={() => startEdit(student)}>
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                    Редактировать
                                                                </Button>
                                                                <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => destroyStudent(student)}>
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                    Удалить
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
                description={confirmState.description}
                onConfirm={() => {
                    confirmState.onConfirm?.();
                    setConfirmState({ open: false, description: '', onConfirm: null });
                }}
            />
        </AuthenticatedLayout>
    );
}
