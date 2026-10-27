import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, EmptyState, FilterBar, FormField, LoadingState, Notice, PageHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { BookOpenText, GraduationCap, Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
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

    const activeSpecialities = specialities.filter((item) => item.status === 'active').length;
    const filtersActive = search.trim() !== '' || departmentFilter !== 'all';

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Специальности"
                    description="Справочник специальностей для привязки образовательных программ."
                    actions={(
                        <Button type="button" onClick={openCreateDialog}>
                            <Plus className="h-4 w-4" />
                            Добавить специальность
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Анкетирование - Специальности" />

            <div className="admin-page-wrap space-y-6">
                {!loading && (
                    <StatGrid>
                        <StatTile label="Специальностей" value={specialities.length} tone="teal" icon={GraduationCap} />
                        <StatTile label="Активные" value={activeSpecialities} tone="success" />
                        <StatTile label="Образовательных программ" value={programs.length} tone="navy" icon={BookOpenText} />
                        <StatTile label="Кафедр" value={departmentOptions.length} tone="gold" />
                    </StatGrid>
                )}

                {error && <Notice tone="danger" title="Ошибка">{error}</Notice>}
                {success && <Notice tone="success">{success}</Notice>}

                <FilterBar>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
                        <FormField label="Поиск">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input className="pl-9" placeholder="Поиск специальности" value={search} onChange={(e) => setSearch(e.target.value)} />
                            </div>
                        </FormField>
                        <FormField label="Кафедра">
                            <select className={qdFieldClass} value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                                <option value="all">Все кафедры</option>
                                {departmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </FormField>
                    </div>
                    {filtersActive && (
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                            <p className="text-sm tabular-nums text-slate-500">Найдено: {filtered.length} из {specialities.length}</p>
                            <Button type="button" variant="outline" size="sm" onClick={() => { setSearch(''); setDepartmentFilter('all'); }}>
                                Сбросить
                            </Button>
                        </div>
                    )}
                </FilterBar>

                {loading ? (
                    <LoadingState />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        title={specialities.length === 0 ? 'Специальности еще не добавлены' : 'Ничего не найдено'}
                        description={specialities.length === 0 ? 'Добавьте первую специальность, затем привяжите к ней образовательные программы.' : 'Измените поиск или выберите другую кафедру.'}
                        action={specialities.length === 0 ? (
                            <Button type="button" onClick={openCreateDialog}>
                                <Plus className="h-4 w-4" />
                                Добавить специальность
                            </Button>
                        ) : null}
                    />
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <GraduationCap />
                                Список специальностей
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="whitespace-nowrap text-left">Название</th>
                                            <th className="whitespace-nowrap text-left">Кафедра</th>
                                            <th className="whitespace-nowrap text-right">ОП</th>
                                            <th className="whitespace-nowrap text-left">Статус</th>
                                            <th className="whitespace-nowrap text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((item) => (
                                            <tr key={item.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                                <td className="font-medium text-slate-900">{item.name}</td>
                                                <td className="text-slate-700">{getDepartmentName(item)}</td>
                                                <td className="text-right tabular-nums text-slate-700">{item.educational_programs_count ?? 0}</td>
                                                <td>
                                                    <StatusBadge tone={item.status === 'active' ? 'success' : 'default'}>
                                                        {item.status}
                                                    </StatusBadge>
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button type="button" variant="secondary" size="sm" onClick={() => openSpecialityPrograms(item)}>
                                                            <BookOpenText className="h-3.5 w-3.5" />
                                                            ОП
                                                        </Button>
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
                        </CardContent>
                    </Card>
                )}
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

                    <form className="space-y-4" onSubmit={submit}>
                        <FormField label="Название">
                            <Input placeholder="Название" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                        </FormField>
                        <FormField label="Кафедра">
                            <select className={qdFieldClass} value={form.department_id} onChange={(e) => setForm((prev) => ({ ...prev, department_id: e.target.value }))}>
                                <option value="">Кафедра</option>
                                {departmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </FormField>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Порядок">
                                <Input type="number" min={0} placeholder="Порядок" value={form.sort_order} onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))} />
                            </FormField>
                            <FormField label="Статус">
                                <select className={qdFieldClass} value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                                    <option value="active">active</option>
                                    <option value="inactive">inactive</option>
                                </select>
                            </FormField>
                        </div>

                        <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsSpecialityDialogOpen(false)}>
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

            <Sheet open={Boolean(openedSpeciality)} onOpenChange={(open) => !open && setOpenedSpeciality(null)}>
                <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
                    <SheetHeader className="border-b border-slate-200 pb-4">
                        <p className="qd-kicker">Образовательные программы</p>
                        <SheetTitle className="flex items-center gap-2">
                            <BookOpenText className="h-4 w-4 text-teal-700" />
                            ОП специальности: {openedSpeciality?.name}
                        </SheetTitle>
                        <SheetDescription>
                            Здесь можно создать и редактировать образовательные программы выбранной специальности.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-5 space-y-5">
                        <section className="rounded-[14px] border border-slate-200 bg-white p-4">
                            <p className="qd-field-label mb-3 text-slate-500">{programEditingId ? 'Редактирование ОП' : 'Новая ОП'}</p>
                            <form className="space-y-4" onSubmit={submitProgram}>
                                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                                    <FormField label="Название">
                                        <Input placeholder="Название образовательной программы" value={programForm.name} onChange={(e) => setProgramForm((prev) => ({ ...prev, name: e.target.value }))} />
                                    </FormField>
                                    <FormField label="Статус">
                                        <select className={qdFieldClass} value={programForm.status} onChange={(e) => setProgramForm((prev) => ({ ...prev, status: e.target.value }))}>
                                            <option value="active">active</option>
                                            <option value="inactive">inactive</option>
                                        </select>
                                    </FormField>
                                </div>

                                <div className="flex justify-end gap-2">
                                    {programEditingId && <Button type="button" variant="outline" size="sm" onClick={resetProgramForm}>Отмена</Button>}
                                    <Button type="submit" size="sm">
                                        {programEditingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                        {programEditingId ? 'Сохранить' : 'Создать'}
                                    </Button>
                                </div>
                            </form>
                        </section>

                        <section className="space-y-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="font-display text-lg font-bold text-[#102945]">Образовательные программы</h3>
                                <div className="relative w-full sm:w-64">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input className="pl-9" placeholder="Поиск ОП" value={programSearch} onChange={(e) => setProgramSearch(e.target.value)} />
                                </div>
                            </div>
                            {specialityPrograms.length === 0 ? (
                                <Notice tone="info">Для этой специальности ОП пока не добавлены.</Notice>
                            ) : (
                                <DataTable>
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="whitespace-nowrap text-left">Название</th>
                                                <th className="whitespace-nowrap text-left">Статус</th>
                                                <th className="whitespace-nowrap text-right">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {specialityPrograms.map((program) => (
                                                <tr key={program.id} className={`border-b border-slate-200 last:border-b-0 ${programEditingId === program.id ? 'bg-teal-50' : ''}`}>
                                                    <td className="font-medium text-slate-900">{program.name}</td>
                                                    <td>
                                                        <StatusBadge tone={program.status === 'active' ? 'success' : 'default'}>
                                                            {program.status}
                                                        </StatusBadge>
                                                    </td>
                                                    <td className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={() => startEditProgram(program)}>Ред.</Button>
                                                            <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => removeProgram(program.id)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                Удалить
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </DataTable>
                            )}
                        </section>
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
