import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { ClipboardList, GraduationCap, Link2, Plus, Save, Search, Trash2, UsersRound } from 'lucide-react';

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
        <AuthenticatedLayout>
            <Head title="Анкетирование - Назначения" />

            <div className="admin-page-wrap">
                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-[#132844]">Анкетирование - Назначения</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Привязка связки преподаватель + дисциплина к учебной группе.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <ClipboardList className="h-6 w-6 text-[#139AA4]" />
                            <span className="text-sm text-muted-foreground">{items.length} связок</span>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard title="Всего назначений" value={items.length} icon={<Link2 className="h-5 w-5 text-[#139AA4]" />} />
                    <StatCard title="Активные" value={activeAssignments} icon={<ClipboardList className="h-5 w-5 text-emerald-600" />} />
                    <StatCard title="Групп" value={groups.length} icon={<UsersRound className="h-5 w-5 text-[#139AA4]" />} />
                    <StatCard title="Преп.+дисц." value={teacherDisciplines.length} icon={<GraduationCap className="h-5 w-5 text-[#139AA4]" />} />
                </div>

                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[430px_1fr]">
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-[#132844]">{editingId ? 'Редактирование назначения' : 'Новое назначение'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form className="space-y-3" onSubmit={submit}>
                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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

                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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

                                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.academic_year} onChange={(e) => setForm((prev) => ({ ...prev, academic_year: e.target.value }))}>
                                    {academicYearOptions.map((year) => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>

                                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.semester} onChange={(e) => setForm((prev) => ({ ...prev, semester: e.target.value }))}>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                </select>

                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={form.status}
                                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="active">active</option>
                                    <option value="inactive">inactive</option>
                                </select>

                                <div className="flex gap-2">
                                    <Button type="submit" className="gap-2">
                                        {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                        {editingId ? 'Сохранить' : 'Назначить'}
                                    </Button>
                                    {editingId && (
                                        <Button type="button" variant="outline" onClick={resetForm}>Отмена</Button>
                                    )}
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <CardTitle className="text-base text-[#132844]">Текущие назначения</CardTitle>
                                <div className="relative w-full sm:w-72">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                    className="pl-9"
                                    placeholder="Поиск"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>

                            {loading ? (
                                <p className="text-sm text-muted-foreground">Загрузка...</p>
                            ) : filteredItems.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Назначения пока не созданы.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-muted-foreground">
                                                <th className="px-3 py-2 text-left font-medium">Группа</th>
                                                <th className="px-3 py-2 text-left font-medium">Преподаватель</th>
                                                <th className="px-3 py-2 text-left font-medium">Дисциплина</th>
                                                <th className="px-3 py-2 text-left font-medium">Период</th>
                                                <th className="px-3 py-2 text-left font-medium">Статус</th>
                                                <th className="px-3 py-2 text-right font-medium">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.map((item) => (
                                                <tr key={item.id} className="border-b last:border-b-0">
                                                    <td className="px-3 py-2 font-medium text-[#132844]">{item.group?.name || item.group_id}</td>
                                                    <td className="px-3 py-2">
                                                        {item.teacher_discipline?.teacher?.display_name || item.teacher_discipline?.teacher?.name || item.teacher_discipline?.teacher_id}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {item.teacher_discipline?.discipline?.name || item.teacher_discipline?.discipline_id}
                                                    </td>
                                                    <td className="px-3 py-2">{item.academic_year} · {item.semester}</td>
                                                    <td className="px-3 py-2">
                                                        <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className={item.status === 'active' ? 'bg-emerald-600 text-white' : ''}>
                                                            {item.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="inline-flex gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={() => startEdit(item)}>Ред.</Button>
                                                            <Button type="button" variant="outline" size="sm" className="text-red-700" onClick={() => remove(item.id)}>
                                                                <Trash2 className="mr-1 h-3.5 w-3.5" />
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

function StatCard({ title, value, icon }) {
    return (
        <Card className="border-border/80 bg-white/90 shadow-sm">
            <CardContent className="flex items-center justify-between pt-6">
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
                    <p className="text-2xl font-semibold text-[#132844]">{value}</p>
                </div>
                {icon}
            </CardContent>
        </Card>
    );
}
