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
    const [yearFilter, setYearFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
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

    const yearOptions = Array.from(new Set(items.map((item) => item.academic_year).filter(Boolean))).sort();

    const filteredItems = items.filter((item) => {
        if (yearFilter !== 'all' && item.academic_year !== yearFilter) {
            return false;
        }

        if (statusFilter !== 'all' && (statusFilter === 'active' ? item.status !== 'active' : item.status === 'active')) {
            return false;
        }

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
    const coveredGroupIds = new Set(items.map((item) => Number(item.group_id)));
    const usedPairIds = new Set(items.map((item) => Number(item.teacher_discipline_id)));
    const teacherIds = new Set(items.map((item) => item.teacher_discipline?.teacher_id ?? item.teacher_discipline?.teacher?.id).filter(Boolean));
    const assignmentsByGroup = groups
        .map((group) => {
            const groupItems = items.filter((item) => Number(item.group_id) === Number(group.id));
            return {
                id: group.id,
                name: group.name,
                total: groupItems.length,
                active: groupItems.filter((item) => item.status === 'active').length,
            };
        })
        .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name), 'ru'));

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Назначения"
                    description="Привязка связки преподаватель + дисциплина к учебной группе."
                />
            )}
        >
            <Head title="Анкетирование - Назначения" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего назначений" value={items.length} tone="teal" icon={Link2} hint={`Неактивных: ${items.length - activeAssignments}`} />
                    <StatTile label="Активные" value={activeAssignments} tone="success" icon={ClipboardList} hint={items.length ? `${Math.round((activeAssignments / items.length) * 100)}% от всех` : null} />
                    <StatTile label="Групп охвачено" value={`${coveredGroupIds.size} / ${groups.length}`} tone="navy" icon={UsersRound} hint={`Без назначений: ${Math.max(groups.length - coveredGroupIds.size, 0)}`} />
                    <StatTile label="Преп.+дисц." value={teacherDisciplines.length} tone="gold" icon={GraduationCap} hint={`Используется в назначениях: ${usedPairIds.size}`} />
                    <StatTile label="Преподавателей" value={teacherIds.size} tone="info" hint="С хотя бы одним назначением" />
                </StatGrid>

                {error && <Notice tone="danger" title="Ошибка">{error}</Notice>}
                {success && <Notice tone="success">{success}</Notice>}

                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
                    <div className="space-y-4 xl:sticky xl:top-5">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {editingId ? <Save /> : <Plus />}
                                    {editingId ? 'Редактирование назначения' : 'Новое назначение'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form className="space-y-3" onSubmit={submit}>
                                    <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
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
                                    </div>

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

                                    <div className="grid grid-cols-2 gap-3">
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

                                    <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
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
                            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                                <CardTitle className="flex items-center gap-2">
                                    <UsersRound />
                                    По группам
                                </CardTitle>
                                <span className="text-xs tabular-nums text-slate-500">{groups.length} групп</span>
                            </CardHeader>
                            <CardContent className="p-0">
                                {assignmentsByGroup.length === 0 ? (
                                    <p className="px-5 py-4 text-sm text-slate-500 sm:px-6">Группы не загружены.</p>
                                ) : (
                                    <ul className="max-h-80 divide-y divide-slate-200 overflow-y-auto">
                                        {assignmentsByGroup.map((group) => (
                                            <li key={group.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm sm:px-6">
                                                <button type="button" className="truncate text-left font-medium text-slate-900 hover:text-teal-700 hover:underline" onClick={() => setSearch(group.name || '')}>
                                                    {group.name}
                                                </button>
                                                {group.total === 0 ? (
                                                    <StatusBadge tone="warning">нет назначений</StatusBadge>
                                                ) : (
                                                    <span className="shrink-0 tabular-nums text-slate-600">
                                                        <span className="font-semibold text-[#102945]">{group.active}</span> / {group.total}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardList />
                                Текущие назначения
                            </CardTitle>
                            <span className="text-sm tabular-nums text-slate-500">Показано: {filteredItems.length} из {items.length}</span>
                        </CardHeader>
                        <div className="grid gap-3 border-b border-slate-200 px-5 py-3 sm:px-6 md:grid-cols-[minmax(0,1fr)_11rem_11rem]">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    className="pl-9"
                                    placeholder="Группа, преподаватель, дисциплина, период"
                                    aria-label="Поиск"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <select className={qdFieldClass} aria-label="Учебный год" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                                <option value="all">Все учебные годы</option>
                                {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                            </select>
                            <select className={qdFieldClass} aria-label="Статус" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                <option value="all">Все статусы</option>
                                <option value="active">active</option>
                                <option value="inactive">inactive</option>
                            </select>
                        </div>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="px-5 py-4 sm:px-6"><LoadingState /></div>
                            ) : filteredItems.length === 0 ? (
                                <div className="px-5 py-8 text-center sm:px-6">
                                    <p className="font-semibold text-[#102945]">{items.length === 0 ? 'Назначения пока не созданы' : 'Ничего не найдено'}</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {items.length === 0 ? 'Заполните форму «Новое назначение», чтобы привязать преподавателя и дисциплину к группе.' : 'Измените поиск или фильтры.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="whitespace-nowrap text-left">Группа</th>
                                                <th className="whitespace-nowrap text-left">Преподаватель</th>
                                                <th className="whitespace-nowrap text-left">Дисциплина</th>
                                                <th className="whitespace-nowrap text-left">Учебный год</th>
                                                <th className="whitespace-nowrap text-right">Сем.</th>
                                                <th className="whitespace-nowrap text-left">Статус</th>
                                                <th className="whitespace-nowrap text-right">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.map((item) => {
                                                const teacher = item.teacher_discipline?.teacher;
                                                const discipline = item.teacher_discipline?.discipline;
                                                return (
                                                    <tr key={item.id} className={`border-b border-slate-200 last:border-b-0 hover:bg-slate-50 ${editingId === item.id ? 'bg-teal-50' : ''}`}>
                                                        <td className="whitespace-nowrap font-medium text-slate-900">{item.group?.name || item.group_id}</td>
                                                        <td className="text-slate-700">
                                                            <span className="block">{teacher?.display_name || teacher?.name || item.teacher_discipline?.teacher_id}</span>
                                                            {(teacher?.email || teacher?.ad_login) && <span className="block text-xs text-slate-500">{teacher.email || teacher.ad_login}</span>}
                                                        </td>
                                                        <td className="text-slate-700">
                                                            <span className="block">{discipline?.name || item.teacher_discipline?.discipline_id}</span>
                                                            {discipline?.code && <span className="block font-mono text-xs text-slate-500">{discipline.code}</span>}
                                                        </td>
                                                        <td className="whitespace-nowrap tabular-nums text-slate-700">{item.academic_year || '—'}</td>
                                                        <td className="text-right tabular-nums text-slate-700">{item.semester || '—'}</td>
                                                        <td>
                                                            <StatusBadge tone={item.status === 'active' ? 'success' : 'default'}>
                                                                {item.status}
                                                            </StatusBadge>
                                                        </td>
                                                        <td className="text-right">
                                                            <div className="flex justify-end gap-2">
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
                                                );
                                            })}
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
