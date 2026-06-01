import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { BookOpenText, GraduationCap, Plus, Save, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const emptyForm = {
    name: '',
    department_id: '',
    sort_order: 0,
    status: 'active',
};

const emptyProgramForm = {
    name: '',
    sort_order: 0,
    status: 'active',
};

export default function Specialities() {
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [specialities, setSpecialities] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [openedSpeciality, setOpenedSpeciality] = useState(null);
    const [programForm, setProgramForm] = useState(emptyProgramForm);
    const [programEditingId, setProgramEditingId] = useState(null);
    const [isSpecialityDialogOpen, setIsSpecialityDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [programSearch, setProgramSearch] = useState('');

    const departmentOptions = useMemo(() => {
        const map = new Map();

        for (const department of departments) {
            if (department?.id && department?.name) {
                map.set(Number(department.id), department.name);
            }
        }

        for (const speciality of specialities) {
            const deptId = Number(speciality?.department?.id ?? speciality?.department_id ?? 0);
            const deptName = speciality?.department?.name;

            if (deptId > 0 && deptName && !map.has(deptId)) {
                map.set(deptId, deptName);
            }
        }

        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [departments, specialities]);

    const getDepartmentName = (speciality) => {
        if (speciality?.department?.name) {
            return speciality.department.name;
        }

        const deptId = Number(speciality?.department_id ?? 0);
        if (deptId <= 0) {
            return '—';
        }

        return departmentOptions.find((item) => item.id === deptId)?.name ?? '—';
    };

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const [specialitiesResponse, programsResponse] = await Promise.all([
                axios.get('/api/questionnaire/admin/specialities'),
                axios.get('/api/questionnaire/admin/educational-programs'),
            ]);

            setSpecialities(specialitiesResponse.data?.data ?? []);
            setDepartments(specialitiesResponse.data?.meta?.departments ?? []);
            setPrograms(programsResponse.data?.data ?? []);
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось загрузить специальности.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const resetForm = () => {
        setForm(emptyForm);
        setEditingId(null);
    };

    const openCreateDialog = () => {
        resetForm();
        setIsSpecialityDialogOpen(true);
    };

    const resetProgramForm = () => {
        setProgramForm(emptyProgramForm);
        setProgramEditingId(null);
    };

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        const payload = {
            ...form,
            department_id: form.department_id ? Number(form.department_id) : null,
            sort_order: Number(form.sort_order) || 0,
        };

        try {
            if (editingId) {
                await axios.patch(`/api/questionnaire/admin/specialities/${editingId}`, payload);
                setSuccess('Специальность обновлена.');
            } else {
                await axios.post('/api/questionnaire/admin/specialities', payload);
                setSuccess('Специальность создана.');
            }

            resetForm();
            setIsSpecialityDialogOpen(false);
            await loadData();
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения специальности.');
        }
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setForm({
            name: item.name || '',
            department_id: item.department_id ? String(item.department_id) : '',
            sort_order: Number(item.sort_order) || 0,
            status: item.status || 'active',
        });
        setIsSpecialityDialogOpen(true);
    };

    const remove = async (id) => {
        setConfirmState({
            open: true,
            description: 'Удалить специальность?',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/specialities/${id}`);
                    if (editingId === id) {
                        resetForm();
                    }
                    setSuccess('Специальность удалена.');
                    await loadData();
                } catch (e) {
                    setError(e?.response?.data?.message || 'Ошибка удаления специальности.');
                }
            },
        });
    };

    const openSpecialityPrograms = (speciality) => {
        setOpenedSpeciality(speciality);
        resetProgramForm();
        setProgramSearch('');
    };

    const specialityPrograms = useMemo(() => {
        if (!openedSpeciality) {
            return [];
        }

        const bySpeciality = programs.filter((program) => Number(program.group_speciality_id) === Number(openedSpeciality.id));
        const term = programSearch.trim().toLowerCase();
        if (!term) {
            return bySpeciality;
        }

        return bySpeciality.filter((program) =>
            [program.name, program.status]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(term),
        );
    }, [programs, openedSpeciality, programSearch]);

    const submitProgram = async (event) => {
        event.preventDefault();

        if (!openedSpeciality) {
            return;
        }

        setError('');
        setSuccess('');

        const payload = {
            name: programForm.name,
            speciality_id: Number(openedSpeciality.id),
            sort_order: Number(programForm.sort_order) || 0,
            status: programForm.status,
        };

        try {
            if (programEditingId) {
                await axios.patch(`/api/questionnaire/admin/educational-programs/${programEditingId}`, payload);
                setSuccess('Образовательная программа обновлена.');
            } else {
                await axios.post('/api/questionnaire/admin/educational-programs', payload);
                setSuccess('Образовательная программа создана.');
            }

            resetProgramForm();
            await loadData();
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения образовательной программы.');
        }
    };

    const startEditProgram = (program) => {
        setProgramEditingId(program.id);
        setProgramForm({
            name: program.name || '',
            sort_order: Number(program.sort_order) || 0,
            status: program.status || 'active',
        });
    };

    const removeProgram = async (programId) => {
        setConfirmState({
            open: true,
            description: 'Удалить образовательную программу?',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/educational-programs/${programId}`);
                    if (programEditingId === programId) {
                        resetProgramForm();
                    }
                    setSuccess('Образовательная программа удалена.');
                    await loadData();
                } catch (e) {
                    setError(e?.response?.data?.message || 'Ошибка удаления образовательной программы.');
                }
            },
        });
    };

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return specialities.filter((item) => {
            const currentDepartmentId = String(item.department?.id ?? item.department_id ?? '');

            if (departmentFilter !== 'all' && currentDepartmentId !== String(departmentFilter)) {
                return false;
            }

            if (!term) {
                return true;
            }

            return [item.name, getDepartmentName(item), item.status]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(term);
        });
    }, [specialities, search, departmentFilter, departmentOptions]);

    return (
        <AuthenticatedLayout>
            <Head title="Анкетирование - Специальности" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardContent className="flex items-center justify-between pt-6">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-[#132844]">Анкетирование - Специальности</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Справочник специальностей для привязки образовательных программ.</p>
                        </div>
                        <GraduationCap className="h-6 w-6 text-[#139AA4]" />
                    </CardContent>
                </Card>

                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <div className="grid grid-cols-1 gap-6">
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <CardTitle className="text-base text-[#132844]">Список специальностей</CardTitle>
                                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                    <Button type="button" className="gap-2" onClick={openCreateDialog}>
                                        <Plus className="h-4 w-4" />
                                        Добавить специальность
                                    </Button>
                                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-56" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                                        <option value="all">Все кафедры</option>
                                        {departmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                    </select>
                                    <div className="relative w-full sm:w-72">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input className="pl-9" placeholder="Поиск специальности" value={search} onChange={(e) => setSearch(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <p className="text-sm text-muted-foreground">Загрузка...</p>
                            ) : filtered.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Специальности еще не добавлены.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-muted-foreground">
                                                <th className="px-3 py-2 text-left font-medium">Название</th>
                                                <th className="px-3 py-2 text-left font-medium">Кафедра</th>
                                                <th className="px-3 py-2 text-left font-medium">ОП</th>
                                                <th className="px-3 py-2 text-left font-medium">Статус</th>
                                                <th className="px-3 py-2 text-right font-medium">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((item) => (
                                                <tr key={item.id} className="border-b last:border-b-0">
                                                    <td className="px-3 py-2 font-medium text-[#132844]">{item.name}</td>
                                                    <td className="px-3 py-2">{getDepartmentName(item)}</td>
                                                    <td className="px-3 py-2">{item.educational_programs_count ?? 0}</td>
                                                    <td className="px-3 py-2">
                                                        <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className={item.status === 'active' ? 'bg-emerald-600 text-white' : ''}>
                                                            {item.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="inline-flex gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={() => openSpecialityPrograms(item)}>
                                                                ОП
                                                            </Button>
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

            <Dialog
                open={isSpecialityDialogOpen}
                onOpenChange={(open) => {
                    setIsSpecialityDialogOpen(open);
                    if (!open) {
                        resetForm();
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Редактирование специальности' : 'Новая специальность'}</DialogTitle>
                        <DialogDescription>
                            Заполните поля специальности и сохраните изменения.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={submit}>
                        <Input placeholder="Название" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.department_id} onChange={(e) => setForm((prev) => ({ ...prev, department_id: e.target.value }))}>
                            <option value="">Кафедра</option>
                            {departmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        <Input type="number" min={0} placeholder="Порядок" value={form.sort_order} onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))} />
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                        </select>

                        <div className="flex gap-2">
                            <Button type="submit" className="gap-2">
                                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {editingId ? 'Сохранить' : 'Создать'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsSpecialityDialogOpen(false)}>
                                Отмена
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Sheet open={Boolean(openedSpeciality)} onOpenChange={(open) => !open && setOpenedSpeciality(null)}>
                <SheetContent side="right" className="w-full sm:max-w-2xl">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <BookOpenText className="h-4 w-4 text-[#139AA4]" />
                            ОП специальности: {openedSpeciality?.name}
                        </SheetTitle>
                        <SheetDescription>
                            Здесь можно создать и редактировать образовательные программы выбранной специальности.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-4 space-y-4">
                        <Card className="border-border/80 bg-white/90 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base text-[#132844]">{programEditingId ? 'Редактирование ОП' : 'Новая ОП'}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form className="space-y-3" onSubmit={submitProgram}>
                                    <Input placeholder="Название образовательной программы" value={programForm.name} onChange={(e) => setProgramForm((prev) => ({ ...prev, name: e.target.value }))} />
                                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={programForm.status} onChange={(e) => setProgramForm((prev) => ({ ...prev, status: e.target.value }))}>
                                        <option value="active">active</option>
                                        <option value="inactive">inactive</option>
                                    </select>

                                    <div className="flex gap-2">
                                        <Button type="submit" className="gap-2">
                                            {programEditingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                            {programEditingId ? 'Сохранить' : 'Создать'}
                                        </Button>
                                        {programEditingId && <Button type="button" variant="outline" onClick={resetProgramForm}>Отмена</Button>}
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="border-border/80 bg-white/90 shadow-sm">
                            <CardHeader className="pb-2">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <CardTitle className="text-base text-[#132844]">Образовательные программы</CardTitle>
                                    <div className="relative w-full sm:w-72">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input className="pl-9" placeholder="Поиск ОП" value={programSearch} onChange={(e) => setProgramSearch(e.target.value)} />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {specialityPrograms.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Для этой специальности ОП пока не добавлены.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="border-b text-muted-foreground">
                                                    <th className="px-3 py-2 text-left font-medium">Название</th>
                                                    <th className="px-3 py-2 text-left font-medium">Статус</th>
                                                    <th className="px-3 py-2 text-right font-medium">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {specialityPrograms.map((program) => (
                                                    <tr key={program.id} className="border-b last:border-b-0">
                                                        <td className="px-3 py-2 font-medium text-[#132844]">{program.name}</td>
                                                        <td className="px-3 py-2">
                                                            <Badge variant={program.status === 'active' ? 'default' : 'secondary'} className={program.status === 'active' ? 'bg-emerald-600 text-white' : ''}>
                                                                {program.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <div className="inline-flex gap-2">
                                                                <Button type="button" variant="outline" size="sm" onClick={() => startEditProgram(program)}>Ред.</Button>
                                                                <Button type="button" variant="outline" size="sm" className="text-red-700" onClick={() => removeProgram(program.id)}>
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
