import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FilterBar, FormField, LoadingState, Notice, PageHeader, StatGrid, StatTile, StatusBadge, UnderlineTabs, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import { ChevronDown, GraduationCap, Layers3, Pencil, Plus, Save, Search, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePersistedState } from '../shared/usePersistedState';

const emptyForm = {
    name: '',
    course_id: '',
    speciality_id: '',
    educational_program_id: '',
    status: 'active',
};

const defaultFilters = {
    course: 'all',
    specialityIds: [],
    programId: 'all',
    departmentId: 'all',
    sizeRange: 'all',
    quickChip: 'all',
    search: '',
};

function courseLevelFromName(value) {
    const source = String(value || '');
    const match = source.match(/([1-4])/);
    return match ? match[1] : '';
}

function inSizeRange(count, sizeRange) {
    if (sizeRange === 'all') return true;
    if (sizeRange === '0') return count === 0;
    if (sizeRange === '1-10') return count >= 1 && count <= 10;
    if (sizeRange === '11-20') return count >= 11 && count <= 20;
    if (sizeRange === '21-30') return count >= 21 && count <= 30;
    if (sizeRange === '30+') return count >= 30;
    return true;
}

function applyQuickChip(group, studentCount, chip) {
    if (chip === 'all') return true;
    if (chip === 'active') return group.status === 'active';
    if (chip === 'without_students') return studentCount === 0;
    if (chip === 'less_than_10') return studentCount < 10;
    if (chip === 'full') return studentCount >= 30;
    if (chip === 'archived') return group.status === 'inactive';
    return true;
}

function getSpecialityRef(group) {
    return group?.specialityRef ?? group?.speciality_ref ?? null;
}

function getSpecialityDepartment(group) {
    const specialityRef = getSpecialityRef(group);
    return specialityRef?.department ?? specialityRef?.department_ref ?? null;
}

export default function Groups() {
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [groups, setGroups] = useState([]);
    const [courses, setCourses] = useState([]);
    const [specialities, setSpecialities] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [students, setStudents] = useState([]);

    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formDialogOpen, setFormDialogOpen] = useState(false);

    const [filters, setFilters] = usePersistedState('questionnaire.groups.filters', defaultFilters);
    const [specialityDropdownOpen, setSpecialityDropdownOpen] = useState(false);
    const [specialitySearch, setSpecialitySearch] = useState('');

    const [studentsSheetGroup, setStudentsSheetGroup] = useState(null);

    const loadGroups = async () => {
        setLoading(true);
        setError('');

        try {
            const [groupsResponse, studentsResponse] = await Promise.all([
                axios.get('/api/questionnaire/admin/groups'),
                axios.get('/api/questionnaire/admin/students'),
            ]);

            setGroups(groupsResponse.data?.data ?? []);
            setCourses(groupsResponse.data?.meta?.courses ?? []);
            setSpecialities(groupsResponse.data?.meta?.specialities ?? []);
            setPrograms(groupsResponse.data?.meta?.educational_programs ?? []);
            setStudents(studentsResponse.data?.data ?? []);
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось загрузить группы.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGroups();
    }, []);

    const studentsByGroup = useMemo(() => {
        const grouped = {};

        for (const student of students) {
            const groupId = student.group_id;
            if (!grouped[groupId]) {
                grouped[groupId] = [];
            }
            grouped[groupId].push(student);
        }

        return grouped;
    }, [students]);

    const filteredSpecialitiesForDropdown = useMemo(() => {
        const term = specialitySearch.trim().toLowerCase();
        if (!term) {
            return specialities;
        }

        return specialities.filter((item) => String(item.name || '').toLowerCase().includes(term));
    }, [specialities, specialitySearch]);

    const availablePrograms = useMemo(() => {
        if (!filters.specialityIds.length) {
            return programs;
        }

        const specialitySet = new Set(filters.specialityIds.map(Number));
        return programs.filter((program) => specialitySet.has(Number(program.group_speciality_id)));
    }, [programs, filters.specialityIds]);

    const formPrograms = useMemo(() => {
        if (!form.speciality_id) {
            return programs;
        }

        return programs.filter((program) => String(program.group_speciality_id || '') === String(form.speciality_id));
    }, [programs, form.speciality_id]);

    useEffect(() => {
        if (filters.programId === 'all') {
            return;
        }

        const exists = availablePrograms.some((program) => String(program.id) === String(filters.programId));
        if (!exists) {
            setFilters((prev) => ({ ...prev, programId: 'all' }));
        }
    }, [availablePrograms, filters.programId, setFilters]);

    useEffect(() => {
        if (!form.educational_program_id) {
            return;
        }

        const exists = formPrograms.some((program) => String(program.id) === String(form.educational_program_id));
        if (!exists) {
            setForm((prev) => ({ ...prev, educational_program_id: '' }));
        }
    }, [formPrograms, form.educational_program_id]);

    const resetForm = () => {
        setForm(emptyForm);
        setEditingId(null);
    };

    const openCreateModal = () => {
        resetForm();
        setFormDialogOpen(true);
    };

    const resetFilters = () => {
        setFilters(defaultFilters);
        setSpecialitySearch('');
    };

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        const payload = {
            name: form.name,
            course_id: form.course_id ? Number(form.course_id) : null,
            speciality_id: form.speciality_id ? Number(form.speciality_id) : null,
            educational_program_id: form.educational_program_id ? Number(form.educational_program_id) : null,
            status: form.status,
        };

        try {
            if (editingId) {
                await axios.patch(`/api/questionnaire/admin/groups/${editingId}`, payload);
                setSuccess('Группа обновлена.');
            } else {
                await axios.post('/api/questionnaire/admin/groups', payload);
                setSuccess('Группа создана.');
            }

            resetForm();
            setFormDialogOpen(false);
            await loadGroups();
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения группы.');
        }
    };

    const startEdit = (group) => {
        setEditingId(group.id);
        setForm({
            name: group.name || '',
            course_id: group.group_course_id ? String(group.group_course_id) : '',
            speciality_id: group.group_speciality_id ? String(group.group_speciality_id) : '',
            educational_program_id: group.group_educational_program_id ? String(group.group_educational_program_id) : '',
            status: group.status || 'active',
        });
        setFormDialogOpen(true);
    };

    const remove = async (groupId) => {
        setConfirmState({
            open: true,
            description: 'Удалить группу?',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/groups/${groupId}`);
                    if (editingId === groupId) {
                        resetForm();
                    }
                    setSuccess('Группа удалена.');
                    await loadGroups();
                } catch (e) {
                    setError(e?.response?.data?.message || 'Ошибка удаления группы.');
                }
            },
        });
    };

    const toggleSpeciality = (id) => {
        setFilters((prev) => {
            const exists = prev.specialityIds.includes(id);
            return {
                ...prev,
                specialityIds: exists
                    ? prev.specialityIds.filter((item) => item !== id)
                    : [...prev.specialityIds, id],
            };
        });
    };

    const filteredGroups = useMemo(() => {
        return groups.filter((group) => {
            const groupStudents = studentsByGroup[group.id] || [];
            const studentCount = groupStudents.length;

            const groupCourseLevel = courseLevelFromName(group.courseRef?.name || group.course);
            if (filters.course !== 'all' && groupCourseLevel !== filters.course) {
                return false;
            }

            if (filters.specialityIds.length > 0 && !filters.specialityIds.includes(Number(group.group_speciality_id))) {
                return false;
            }

            if (filters.programId !== 'all' && String(group.group_educational_program_id || '') !== String(filters.programId)) {
                return false;
            }

            const department = getSpecialityDepartment(group);

            if ((filters.departmentId ?? 'all') !== 'all' && String(department?.id || '') !== String(filters.departmentId)) {
                return false;
            }

            if (!inSizeRange(studentCount, filters.sizeRange)) {
                return false;
            }

            if (!applyQuickChip(group, studentCount, filters.quickChip)) {
                return false;
            }

            const term = filters.search.trim().toLowerCase();
            if (!term) {
                return true;
            }

            return [
                group.name,
                group.courseRef?.name || group.course,
                getSpecialityRef(group)?.name || group.speciality,
                group.educationalProgramRef?.name || group.educational_program,
                department?.name,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(term);
        });
    }, [groups, studentsByGroup, filters]);

    const foundGroupsCount = filteredGroups.length;
    const totalStudentsInFilteredGroups = filteredGroups.reduce((sum, group) => sum + (studentsByGroup[group.id] || []).length, 0);

    const activeCount = groups.filter((item) => item.status === 'active').length;

    const selectedSpecialitiesLabel = filters.specialityIds.length
        ? `Выбрано специальностей: ${filters.specialityIds.length}`
        : 'Все специальности';

    const departmentOptions = useMemo(() => {
        const map = new Map();

        for (const group of groups) {
            const department = getSpecialityDepartment(group);
            if (department?.id && department?.name && !map.has(Number(department.id))) {
                map.set(Number(department.id), department.name);
            }
        }

        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [groups]);

    const studentsInOpenedGroup = studentsSheetGroup ? (studentsByGroup[studentsSheetGroup.id] || []) : [];

    const quickChipItems = [
        { key: 'all', label: 'Все группы' },
        { key: 'active', label: 'Активные' },
        { key: 'without_students', label: 'Без студентов' },
        { key: 'less_than_10', label: 'Меньше 10 студентов' },
        { key: 'full', label: 'Полные группы' },
        { key: 'archived', label: 'Архивные' },
    ];

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Группы"
                    description="Управление академическими группами для опросов и назначений."
                    meta={<Badge variant="secondary">Questionnaire</Badge>}
                    actions={(
                        <Button type="button" onClick={openCreateModal}>
                            <Plus className="h-4 w-4" />
                            Добавить группу
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Анкетирование - Группы" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего групп" value={groups.length} tone="teal" icon={Layers3} />
                    <StatTile label="Активные" value={activeCount} tone="success" hint="Статус active" />
                    <StatTile label="Специальностей" value={specialities.length} tone="navy" icon={GraduationCap} />
                    <StatTile label="Курсов · ОП" value={`${courses.length} · ${programs.length}`} tone="gold" hint={`Курсов: ${courses.length}, образовательных программ: ${programs.length}`} />
                </StatGrid>

                {error && <Notice tone="danger" title="Ошибка">{error}</Notice>}
                {success && <Notice tone="success">{success}</Notice>}

                <FilterBar>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        <div className="sm:col-span-2 lg:col-span-3 xl:col-span-1">
                            <FormField label="Поиск">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        className="pl-9"
                                        placeholder="Поиск группы"
                                        value={filters.search}
                                        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                                    />
                                </div>
                            </FormField>
                        </div>

                        <FormField label="Курс">
                            <select
                                className={qdFieldClass}
                                value={filters.course}
                                onChange={(e) => setFilters((prev) => ({ ...prev, course: e.target.value }))}
                            >
                                <option value="all">Все курсы</option>
                                <option value="1">1 курс</option>
                                <option value="2">2 курс</option>
                                <option value="3">3 курс</option>
                                <option value="4">4 курс</option>
                            </select>
                        </FormField>

                        <div className="space-y-2">
                            <span className="qd-field-label block">Специальность</span>
                            <div className="relative">
                                <button
                                    type="button"
                                    className={`${qdFieldClass} flex items-center justify-between text-left`}
                                    onClick={() => setSpecialityDropdownOpen((prev) => !prev)}
                                >
                                    <span className="truncate">{selectedSpecialitiesLabel}</span>
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                                </button>
                                {specialityDropdownOpen && (
                                    <div className="absolute z-20 mt-2 w-full min-w-[16rem] rounded-[12px] border border-slate-200 bg-white p-2 shadow-[0_8px_24px_0_rgba(25,28,29,0.08)]">
                                        <Input
                                            placeholder="Поиск специальности"
                                            value={specialitySearch}
                                            onChange={(e) => setSpecialitySearch(e.target.value)}
                                        />
                                        <div className="mt-2 max-h-44 space-y-0.5 overflow-y-auto">
                                            {filteredSpecialitiesForDropdown.length === 0 ? (
                                                <p className="px-2 py-1 text-xs text-slate-500">Ничего не найдено</p>
                                            ) : (
                                                filteredSpecialitiesForDropdown.map((item) => (
                                                    <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                                                        <input
                                                            type="checkbox"
                                                            className="accent-teal-700"
                                                            checked={filters.specialityIds.includes(item.id)}
                                                            onChange={() => toggleSpeciality(item.id)}
                                                        />
                                                        {item.name}
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <FormField label="Образовательная программа">
                            <select
                                className={qdFieldClass}
                                value={filters.programId}
                                onChange={(e) => setFilters((prev) => ({ ...prev, programId: e.target.value }))}
                            >
                                <option value="all">Все ОП</option>
                                {availablePrograms.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Кафедра">
                            <select
                                className={qdFieldClass}
                                value={filters.departmentId ?? 'all'}
                                onChange={(e) => setFilters((prev) => ({ ...prev, departmentId: e.target.value }))}
                            >
                                <option value="all">Все кафедры</option>
                                {departmentOptions.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Размер группы">
                            <select
                                className={qdFieldClass}
                                value={filters.sizeRange}
                                onChange={(e) => setFilters((prev) => ({ ...prev, sizeRange: e.target.value }))}
                            >
                                <option value="all">Любое кол-во</option>
                                <option value="0">0 студентов</option>
                                <option value="1-10">1-10 студентов</option>
                                <option value="11-20">11-20 студентов</option>
                                <option value="21-30">21-30 студентов</option>
                                <option value="30+">30+ студентов</option>
                            </select>
                        </FormField>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-600">
                            Найдено: <span className="font-semibold tabular-nums text-[#102945]">{foundGroupsCount}</span> групп · Всего студентов в выбранных группах: <span className="font-semibold tabular-nums text-[#102945]">{totalStudentsInFilteredGroups}</span>
                        </p>
                        <Button variant="outline" onClick={resetFilters}>Сбросить фильтры</Button>
                    </div>
                </FilterBar>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <GraduationCap />
                            Список групп
                        </CardTitle>
                    </CardHeader>
                    <div className="border-b border-slate-200 px-5 pt-2 sm:px-6">
                        <UnderlineTabs
                            className="border-b-0"
                            items={quickChipItems}
                            value={filters.quickChip}
                            onChange={(key) => setFilters((prev) => ({ ...prev, quickChip: key }))}
                        />
                    </div>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-5 sm:p-6"><LoadingState /></div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="px-5 py-12 text-center sm:px-6">
                                <p className="font-display text-lg font-bold text-[#102945]">Группы не найдены</p>
                                <p className="mt-1 text-sm text-slate-600">Группы по выбранным фильтрам не найдены. Сбросьте фильтры или добавьте группу.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="whitespace-nowrap text-left">Группа</th>
                                            <th className="whitespace-nowrap text-left">Курс</th>
                                            <th className="whitespace-nowrap text-left">Специальность</th>
                                            <th className="whitespace-nowrap text-left">ОП</th>
                                            <th className="whitespace-nowrap text-left">Кафедра</th>
                                            <th className="whitespace-nowrap text-right">Студентов</th>
                                            <th className="whitespace-nowrap text-left">Статус</th>
                                            <th className="whitespace-nowrap text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGroups.map((group) => {
                                            const groupStudents = studentsByGroup[group.id] || [];
                                            return (
                                                <tr key={group.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                                    <td className="whitespace-nowrap font-medium text-slate-900">
                                                        <Link href={route('questionnaire.admin.groups.details', group.id)} className="text-[#102945] hover:text-teal-700 hover:underline">
                                                            {group.name}
                                                        </Link>
                                                    </td>
                                                    <td className="whitespace-nowrap text-slate-700">{group.courseRef?.name || group.course || '—'}</td>
                                                    <td className="text-slate-700">{getSpecialityRef(group)?.name || group.speciality || '—'}</td>
                                                    <td className="text-slate-700">{group.educationalProgramRef?.name || group.educational_program || '—'}</td>
                                                    <td className="text-slate-700">{getSpecialityDepartment(group)?.name || '—'}</td>
                                                    <td className="text-right">
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center gap-1 font-semibold tabular-nums text-teal-700 hover:underline"
                                                            onClick={() => setStudentsSheetGroup(group)}
                                                            title="Показать студентов группы"
                                                        >
                                                            <Users className="h-3.5 w-3.5" />
                                                            {groupStudents.length}
                                                        </button>
                                                    </td>
                                                    <td>
                                                        <StatusBadge tone={group.status === 'active' ? 'success' : 'default'}>
                                                            {group.status}
                                                        </StatusBadge>
                                                    </td>
                                                    <td className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={() => startEdit(group)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                                Ред.
                                                            </Button>
                                                            <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => remove(group.id)}>
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

            <Dialog
                open={formDialogOpen}
                onOpenChange={(open) => {
                    setFormDialogOpen(open);
                    if (!open) {
                        resetForm();
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Редактирование группы' : 'Новая группа'}</DialogTitle>
                        <DialogDescription>
                            Заполните параметры группы и сохраните изменения.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={submit}>
                        <FormField label="Название группы">
                            <Input placeholder="Название группы" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                        </FormField>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Курс">
                                <select className={qdFieldClass} value={form.course_id} onChange={(e) => setForm((prev) => ({ ...prev, course_id: e.target.value }))}>
                                    <option value="">Курс</option>
                                    {courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </select>
                            </FormField>
                            <FormField label="Статус">
                                <select className={qdFieldClass} value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                                    <option value="active">active</option>
                                    <option value="inactive">inactive</option>
                                </select>
                            </FormField>
                        </div>
                        <FormField label="Специальность">
                            <select className={qdFieldClass} value={form.speciality_id} onChange={(e) => setForm((prev) => ({ ...prev, speciality_id: e.target.value }))}>
                                <option value="">Специальность</option>
                                {specialities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </FormField>
                        <FormField label="Образовательная программа">
                            <select className={qdFieldClass} value={form.educational_program_id} onChange={(e) => setForm((prev) => ({ ...prev, educational_program_id: e.target.value }))}>
                                <option value="">Образовательная программа</option>
                                {formPrograms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </FormField>

                        <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setFormDialogOpen(false);
                                    resetForm();
                                }}
                            >
                                Отмена
                            </Button>
                            <Button type="submit">
                                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {editingId ? 'Сохранить' : 'Создать'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Sheet open={Boolean(studentsSheetGroup)} onOpenChange={(open) => !open && setStudentsSheetGroup(null)}>
                <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
                    <SheetHeader className="border-b border-slate-200 pb-4">
                        <p className="qd-kicker">Состав группы</p>
                        <SheetTitle>Студенты группы {studentsSheetGroup?.name}</SheetTitle>
                        <SheetDescription>
                            Всего студентов: {studentsInOpenedGroup.length}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-4">
                        {studentsInOpenedGroup.length === 0 ? (
                            <Notice tone="info">В группе пока нет студентов.</Notice>
                        ) : (
                            <ol className="divide-y divide-slate-200">
                                {studentsInOpenedGroup.map((student, index) => (
                                    <li key={student.id} className="flex items-center gap-3 py-3">
                                        <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-400">{index + 1}</span>
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-slate-900">{student.full_name}</p>
                                            <p className="font-mono text-xs text-slate-500">{student.login || student.user?.ad_login || 'Без логина'}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
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
