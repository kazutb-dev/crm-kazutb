import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField, LoadingState, Notice, PageHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { ClipboardList, GraduationCap, Link2, Pencil, Plus, Save, Search, Trash2, UsersRound } from 'lucide-react';

const getAcademicYearOptions = () => {
    const currentYear = new Date().getFullYear();

    return Array.from({ length: 6 }, (_, index) => {
        const start = currentYear - 2 + index;

        return `${start}/${start + 1}`;
    });
};

export default function GroupAssignments() {
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [items, setItems] = useState([]);
    const [groups, setGroups] = useState([]);
    const [teacherDisciplines, setTeacherDisciplines] = useState([]);
    const [loading, setLoading] = useState(true);

    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const academicYearOptions = getAcademicYearOptions();

    const [form, setForm] = useState({
        group_id: '',
        teacher_discipline_id: '',
        academic_year: academicYearOptions[2] || '',
        semester: '1',
        status: 'active',
    });

    const load = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await axios.get('/api/questionnaire/admin/group-disciplines');

            setItems(response.data?.data ?? []);
            setGroups(response.data?.meta?.groups ?? []);
            setTeacherDisciplines(response.data?.meta?.teacher_disciplines ?? []);
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось загрузить назначения.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const resetForm = () => {
        setForm({
            group_id: '',
            teacher_discipline_id: '',
            academic_year: academicYearOptions[2] || '',
            semester: '1',
            status: 'active',
        });
        setEditingId(null);
    };

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        const payload = {
            group_id: Number(form.group_id),
            teacher_discipline_id: Number(form.teacher_discipline_id),
            academic_year: form.academic_year,
            semester: form.semester,
            status: form.status,
        };

        try {
            if (editingId) {
                await axios.patch(`/api/questionnaire/admin/group-disciplines/${editingId}`, payload);
                setSuccess('Назначение обновлено.');
            } else {
                await axios.post('/api/questionnaire/admin/group-disciplines', payload);
                setSuccess('Назначение создано.');
            }

            resetForm();
            await load();
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения назначения.');
        }
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setForm({
            group_id: item.group_id ? String(item.group_id) : '',
            teacher_discipline_id: item.teacher_discipline_id ? String(item.teacher_discipline_id) : '',
            academic_year: item.academic_year || '',
            semester: item.semester || '',
            status: item.status || 'active',
        });
    };

    const remove = async (id) => {
        setConfirmState({
            open: true,
            description: 'Удалить это назначение?',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/group-disciplines/${id}`);
                    if (editingId === id) {
                        resetForm();
                    }
                    setSuccess('Назначение удалено.');
                    await load();
                } catch (e) {
                    setError(e?.response?.data?.message || 'Ошибка удаления назначения.');
                }
            },
        });
    };

    const renderTeacherDisciplineLabel = (item) => {
        const teacherName = item?.teacher?.display_name || item?.teacher?.name || `ID ${item?.teacher_id}`;
        const disciplineName = item?.discipline?.name || `ID ${item?.discipline_id}`;

        return `${teacherName} • ${disciplineName}`;
    };

    const filteredItems = items.filter((item) => {
        const term = search.trim().toLowerCase();
        if (term === '') {
            return true;
        }

        return [
            item.group?.name,
            item.teacher_discipline?.teacher?.display_name,
            item.teacher_discipline?.teacher?.name,
            item.teacher_discipline?.discipline?.name,
            item.academic_year,
            item.semester,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(term);
    });

    const activeAssignments = items.filter((item) => item.status === 'active').length;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Назначения"
                    description="Привязка связки преподаватель + дисциплина к учебной группе."
                    meta={<StatusBadge tone="default">{items.length} связок</StatusBadge>}
                />
            )}
        >
            <Head title="Анкетирование - Назначения" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего назначений" value={items.length} tone="teal" icon={Link2} />
                    <StatTile label="Активные" value={activeAssignments} tone="success" icon={ClipboardList} />
                    <StatTile label="Групп" value={groups.length} tone="navy" icon={UsersRound} />
                    <StatTile label="Преп.+дисц." value={teacherDisciplines.length} tone="gold" icon={GraduationCap} hint="Связки преподаватель + дисциплина" />
                </StatGrid>

                {error && <Notice tone="danger" title="Ошибка">{error}</Notice>}
                {success && <Notice tone="success">{success}</Notice>}

                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[400px_1fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {editingId ? <Save /> : <Plus />}
                                {editingId ? 'Редактирование назначения' : 'Новое назначение'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form className="space-y-4" onSubmit={submit}>
                                <FormField label="Группа">
                                    <select
                                        className={qdFieldClass}
                                        value={form.group_id}
                                        onChange={(e) => setForm((prev) => ({ ...prev, group_id: e.target.value }))}
                                    >
                                        <option value="">Выберите группу</option>
                                        {groups.map((group) => (
                                            <option key={group.id} value={group.id}>
                                                {group.name}
                                            </option>
                                        ))}
                                    </select>
                                </FormField>

                                <FormField label="Преподаватель + дисциплина">
                                    <select
                                        className={qdFieldClass}
                                        value={form.teacher_discipline_id}
                                        onChange={(e) => setForm((prev) => ({ ...prev, teacher_discipline_id: e.target.value }))}
                                    >
                                        <option value="">Выберите связку преподаватель + дисциплина</option>
                                        {teacherDisciplines.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {renderTeacherDisciplineLabel(item)}
                                            </option>
                                        ))}
                                    </select>
                                </FormField>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="Учебный год">
                                        <select className={qdFieldClass} value={form.academic_year} onChange={(e) => setForm((prev) => ({ ...prev, academic_year: e.target.value }))}>
                                            {academicYearOptions.map((year) => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                    </FormField>

                                    <FormField label="Семестр">
                                        <select className={qdFieldClass} value={form.semester} onChange={(e) => setForm((prev) => ({ ...prev, semester: e.target.value }))}>
                                            <option value="1">1</option>
                                            <option value="2">2</option>
                                        </select>
                                    </FormField>
                                </div>

                                <FormField label="Статус">
                                    <select
                                        className={qdFieldClass}
                                        value={form.status}
                                        onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                                    >
                                        <option value="active">active</option>
                                        <option value="inactive">inactive</option>
                                    </select>
                                </FormField>

                                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                                    {editingId && (
                                        <Button type="button" variant="outline" onClick={resetForm}>Отмена</Button>
                                    )}
                                    <Button type="submit">
                                        {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                        {editingId ? 'Сохранить' : 'Назначить'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardList />
                                Текущие назначения
                            </CardTitle>
                        </CardHeader>
                        <div className="border-b border-slate-200 px-5 py-4">
                            <FormField label="Поиск">
                                <div className="relative w-full sm:max-w-sm">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        className="pl-9"
                                        placeholder="Группа, преподаватель, дисциплина, период"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </FormField>
                        </div>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-5"><LoadingState /></div>
                            ) : filteredItems.length === 0 ? (
                                <div className="px-5 py-12 text-center">
                                    <p className="font-display text-lg font-bold text-[#102945]">Назначения пока не созданы</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {items.length === 0 ? 'Заполните форму «Новое назначение», чтобы привязать преподавателя и дисциплину к группе.' : 'По запросу ничего не найдено — измените поиск.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="px-5 py-3 text-left">Группа</th>
                                                <th className="px-5 py-3 text-left">Преподаватель</th>
                                                <th className="px-5 py-3 text-left">Дисциплина</th>
                                                <th className="px-5 py-3 text-left">Период</th>
                                                <th className="px-5 py-3 text-left">Статус</th>
                                                <th className="px-5 py-3 text-right">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.map((item) => (
                                                <tr key={item.id} className={`border-b border-slate-200 last:border-b-0 hover:bg-slate-50 ${editingId === item.id ? 'bg-teal-50' : ''}`}>
                                                    <td className="px-5 py-3 font-medium text-slate-900">{item.group?.name || item.group_id}</td>
                                                    <td className="px-5 py-3 text-slate-700">
                                                        {item.teacher_discipline?.teacher?.display_name || item.teacher_discipline?.teacher?.name || item.teacher_discipline?.teacher_id}
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-700">
                                                        {item.teacher_discipline?.discipline?.name || item.teacher_discipline?.discipline_id}
                                                    </td>
                                                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-700">{item.academic_year} · {item.semester}</td>
                                                    <td className="px-5 py-3">
                                                        <StatusBadge tone={item.status === 'active' ? 'success' : 'default'}>
                                                            {item.status}
                                                        </StatusBadge>
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <div className="inline-flex gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={() => startEdit(item)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                                Ред.
                                                            </Button>
                                                            <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => remove(item.id)}>
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
