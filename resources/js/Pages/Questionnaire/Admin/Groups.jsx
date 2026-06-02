import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import { ChevronDown, GraduationCap, Layers3, Plus, Save, Search, Trash2, Users } from 'lucide-react';
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

    return (
        <AuthenticatedLayout>
            <Head title="Анкетирование - Группы" />

            <div className="admin-page-wrap">
                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-[#132844]">Анкетирование - Группы</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Управление академическими группами для опросов и назначений.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="w-fit">Questionnaire</Badge>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardContent className="flex items-center justify-between pt-6">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Всего групп</p>
                                <p className="text-2xl font-semibold text-[#132844]">{groups.length}</p>
                            </div>
                            <Layers3 className="h-5 w-5 text-[#139AA4]" />
                        </CardContent>
                    </Card>
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardContent className="flex items-center justify-between pt-6">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Активные</p>
                                <p className="text-2xl font-semibold text-[#132844]">{activeCount}</p>
                            </div>
                            <Badge className="bg-emerald-600 text-white">active</Badge>
                        </CardContent>
                    </Card>
                    <Card className="border-border/80 bg-white/90 shadow-sm md:col-span-2">
                        <CardContent className="pt-6">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border border-border/70 px-3 py-2 text-sm">Курсов: <span className="font-semibold">{courses.length}</span></div>
                                <div className="rounded-lg border border-border/70 px-3 py-2 text-sm">Специальностей: <span className="font-semibold">{specialities.length}</span></div>
                                <div className="rounded-lg border border-border/70 px-3 py-2 text-sm">ОП: <span className="font-semibold">{programs.length}</span></div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <div className="grid grid-cols-1 gap-6">
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <CardTitle className="flex items-center gap-2 text-base text-[#132844]">
                                    <GraduationCap className="h-4 w-4 text-[#139AA4]" />
                                    Список групп
                                </CardTitle>
                                <Button type="button" className="gap-2" onClick={openCreateModal}>
                                    <Plus className="h-4 w-4" />
                                    Добавить группу
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={filters.course}
                                    onChange={(e) => setFilters((prev) => ({ ...prev, course: e.target.value }))}
                                >
                                    <option value="all">Все курсы</option>
                                    <option value="1">1 курс</option>
                                    <option value="2">2 курс</option>
                                    <option value="3">3 курс</option>
                                    <option value="4">4 курс</option>
                                </select>

                                <div className="relative">
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        onClick={() => setSpecialityDropdownOpen((prev) => !prev)}
                                    >
                                        <span className="truncate">{selectedSpecialitiesLabel}</span>
                                        <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
                                    </button>
                                    {specialityDropdownOpen && (
                                        <div className="absolute z-20 mt-2 w-full rounded-md border border-border bg-white p-2 shadow-lg">
                                            <Input
                                                placeholder="Поиск специальности"
                                                value={specialitySearch}
                                                onChange={(e) => setSpecialitySearch(e.target.value)}
                                            />
                                            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                                                {filteredSpecialitiesForDropdown.length === 0 ? (
                                                    <p className="px-2 py-1 text-xs text-muted-foreground">Ничего не найдено</p>
                                                ) : (
                                                    filteredSpecialitiesForDropdown.map((item) => (
                                                        <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40">
                                                            <input
                                                                type="checkbox"
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

                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={filters.programId}
                                    onChange={(e) => setFilters((prev) => ({ ...prev, programId: e.target.value }))}
                                >
                                    <option value="all">Все ОП</option>
                                    {availablePrograms.map((item) => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>

                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={filters.departmentId ?? 'all'}
                                    onChange={(e) => setFilters((prev) => ({ ...prev, departmentId: e.target.value }))}
                                >
                                    <option value="all">Все кафедры</option>
                                    {departmentOptions.map((item) => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>

                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <ChipButton active={filters.quickChip === 'all'} onClick={() => setFilters((prev) => ({ ...prev, quickChip: 'all' }))}>Все группы</ChipButton>
                                <ChipButton active={filters.quickChip === 'active'} onClick={() => setFilters((prev) => ({ ...prev, quickChip: 'active' }))}>Активные</ChipButton>
                                <ChipButton active={filters.quickChip === 'without_students'} onClick={() => setFilters((prev) => ({ ...prev, quickChip: 'without_students' }))}>Без студентов</ChipButton>
                                <ChipButton active={filters.quickChip === 'less_than_10'} onClick={() => setFilters((prev) => ({ ...prev, quickChip: 'less_than_10' }))}>Меньше 10 студентов</ChipButton>
                                <ChipButton active={filters.quickChip === 'full'} onClick={() => setFilters((prev) => ({ ...prev, quickChip: 'full' }))}>Полные группы</ChipButton>
                                <ChipButton active={filters.quickChip === 'archived'} onClick={() => setFilters((prev) => ({ ...prev, quickChip: 'archived' }))}>Архивные</ChipButton>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        placeholder="Поиск группы"
                                        value={filters.search}
                                        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                                    />
                                </div>
                                <Button variant="outline" onClick={resetFilters}>Сбросить фильтры</Button>
                            </div>

                            <div className="rounded-lg border border-border/70 px-3 py-2 text-sm text-muted-foreground">
                                Найдено: <span className="font-semibold text-[#132844]">{foundGroupsCount}</span> групп · Всего студентов в выбранных группах: <span className="font-semibold text-[#132844]">{totalStudentsInFilteredGroups}</span>
                            </div>

                            {loading ? (
                                <p className="text-sm text-muted-foreground">Загрузка...</p>
                            ) : filteredGroups.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Группы по выбранным фильтрам не найдены.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-muted-foreground">
                                                <th className="px-3 py-2 text-left font-medium">Группа</th>
                                                <th className="px-3 py-2 text-left font-medium">Курс</th>
                                                <th className="px-3 py-2 text-left font-medium">Специальность</th>
                                                <th className="px-3 py-2 text-left font-medium">ОП</th>
                                                <th className="px-3 py-2 text-left font-medium">Кафедра</th>
                                                <th className="px-3 py-2 text-left font-medium">Кол-во студентов</th>
                                                <th className="px-3 py-2 text-left font-medium">Статус</th>
                                                <th className="px-3 py-2 text-right font-medium">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredGroups.map((group) => {
                                                const groupStudents = studentsByGroup[group.id] || [];
                                                return (
                                                    <tr key={group.id} className="border-b last:border-b-0">
                                                        <td className="px-3 py-2 font-medium text-[#132844]">
                                                            <Link href={route('questionnaire.admin.groups.details', group.id)} className="hover:underline">
                                                                {group.name}
                                                            </Link>
                                                        </td>
                                                        <td className="px-3 py-2">{group.courseRef?.name || group.course || '—'}</td>
                                                        <td className="px-3 py-2">{getSpecialityRef(group)?.name || group.speciality || '—'}</td>
                                                        <td className="px-3 py-2">{group.educationalProgramRef?.name || group.educational_program || '—'}</td>
                                                        <td className="px-3 py-2">{getSpecialityDepartment(group)?.name || '—'}</td>
                                                        <td className="px-3 py-2">
                                                            <button
                                                                type="button"
                                                                className="font-semibold text-[#139AA4] hover:underline"
                                                                onClick={() => setStudentsSheetGroup(group)}
                                                            >
                                                                {groupStudents.length}
                                                            </button>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Badge variant={group.status === 'active' ? 'default' : 'secondary'} className={group.status === 'active' ? 'bg-emerald-600 text-white' : ''}>
                                                                {group.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <div className="inline-flex gap-2">
                                                                <Button type="button" variant="outline" size="sm" onClick={() => startEdit(group)}>Ред.</Button>
                                                                <Button type="button" variant="outline" size="sm" className="text-red-700" onClick={() => remove(group.id)}>
                                                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
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

                    <form className="space-y-3" onSubmit={submit}>
                        <Input placeholder="Название группы" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.course_id} onChange={(e) => setForm((prev) => ({ ...prev, course_id: e.target.value }))}>
                            <option value="">Курс</option>
                            {courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.speciality_id} onChange={(e) => setForm((prev) => ({ ...prev, speciality_id: e.target.value }))}>
                            <option value="">Специальность</option>
                            {specialities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.educational_program_id} onChange={(e) => setForm((prev) => ({ ...prev, educational_program_id: e.target.value }))}>
                            <option value="">Образовательная программа</option>
                            {formPrograms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                        </select>

                        <div className="flex gap-2 pt-1">
                            <Button type="submit" className="gap-2">
                                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {editingId ? 'Сохранить' : 'Создать'}
                            </Button>
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
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Sheet open={Boolean(studentsSheetGroup)} onOpenChange={(open) => !open && setStudentsSheetGroup(null)}>
                <SheetContent side="right" className="w-full sm:max-w-xl">
                    <SheetHeader>
                        <SheetTitle>Студенты группы {studentsSheetGroup?.name}</SheetTitle>
                        <SheetDescription>
                            Всего студентов: {studentsInOpenedGroup.length}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-4">
                        {studentsInOpenedGroup.length === 0 ? (
                            <p className="text-sm text-muted-foreground">В группе пока нет студентов.</p>
                        ) : (
                            <div className="space-y-2">
                                {studentsInOpenedGroup.map((student) => (
                                    <div key={student.id} className="rounded-md border border-border/70 px-3 py-2">
                                        <p className="font-medium text-[#132844]">{student.full_name}</p>
                                        <p className="text-xs text-muted-foreground">{student.login || student.user?.ad_login || 'Без логина'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </AuthenticatedLayout>
        <ConfirmDialog
            open={confirmState.open}
            onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
            description={confirmState.description}
            onConfirm={() => {
                confirmState.onConfirm?.();
                setConfirmState({ open: false, description: '', onConfirm: null });
            }}
        />
    );
}

function ChipButton({ active, children, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${active ? 'border-[#139AA4] bg-[#e9fbfc] text-[#0f6f76]' : 'border-border bg-white text-muted-foreground hover:bg-muted/40'}`}
        >
            {children}
        </button>
    );
}
