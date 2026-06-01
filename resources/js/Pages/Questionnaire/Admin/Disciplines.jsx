import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { BookOpenCheck, Plus, Save, Search, Trash2 } from 'lucide-react';

const emptyForm = {
    name: '',
    code: '',
    status: 'active',
};

export default function Disciplines() {
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [disciplines, setDisciplines] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');

    const loadDisciplines = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await axios.get('/api/questionnaire/admin/disciplines');
            setDisciplines(response.data?.data ?? []);
        } catch (e) {
            setError(e?.response?.data?.message || 'Не удалось загрузить дисциплины.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDisciplines();
    }, []);

    const resetForm = () => {
        setForm(emptyForm);
        setEditingId(null);
    };

    const openCreateDialog = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingId) {
                await axios.patch(`/api/questionnaire/admin/disciplines/${editingId}`, form);
                setSuccess('Дисциплина обновлена.');
            } else {
                await axios.post('/api/questionnaire/admin/disciplines', form);
                setSuccess('Дисциплина создана.');
            }

            resetForm();
            setIsDialogOpen(false);
            await loadDisciplines();
        } catch (e) {
            setError(e?.response?.data?.message || 'Ошибка сохранения дисциплины.');
        }
    };

    const startEdit = (discipline) => {
        setEditingId(discipline.id);
        setForm({
            name: discipline.name || '',
            code: discipline.code || '',
            status: discipline.status || 'active',
        });
        setIsDialogOpen(true);
    };

    const remove = async (disciplineId) => {
        setConfirmState({
            open: true,
            description: 'Удалить дисциплину?',
            onConfirm: async () => {
                setError('');
                setSuccess('');
                try {
                    await axios.delete(`/api/questionnaire/admin/disciplines/${disciplineId}`);
                    if (editingId === disciplineId) {
                        resetForm();
                    }
                    setSuccess('Дисциплина удалена.');
                    await loadDisciplines();
                } catch (e) {
                    setError(e?.response?.data?.message || 'Ошибка удаления дисциплины.');
                }
            },
        });
    };

    const filteredDisciplines = disciplines.filter((discipline) => {
        const term = search.trim().toLowerCase();
        if (term === '') {
            return true;
        }

        return [discipline.name, discipline.code]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(term);
    });

    return (
        <AuthenticatedLayout>
            <Head title="Анкетирование - Дисциплины" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardContent className="flex items-center justify-between pt-6">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-[#132844]">Анкетирование - Дисциплины</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Справочник дисциплин, используемых в привязках и опросах.</p>
                        </div>
                        <BookOpenCheck className="h-6 w-6 text-[#139AA4]" />
                    </CardContent>
                </Card>

                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

                <div className="grid grid-cols-1 gap-6">
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <CardTitle className="text-base text-[#132844]">Список дисциплин</CardTitle>
                                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                    <Button type="button" className="gap-2" onClick={openCreateDialog}>
                                        <Plus className="h-4 w-4" />
                                        Добавить дисциплину
                                    </Button>
                                    <div className="relative w-full sm:w-72">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input className="pl-9" placeholder="Поиск дисциплины" value={search} onChange={(e) => setSearch(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <p className="text-sm text-muted-foreground">Загрузка...</p>
                            ) : filteredDisciplines.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Дисциплины еще не добавлены.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-muted-foreground">
                                                <th className="px-3 py-2 text-left font-medium">Название</th>
                                                <th className="px-3 py-2 text-left font-medium">Код</th>
                                                <th className="px-3 py-2 text-left font-medium">Статус</th>
                                                <th className="px-3 py-2 text-right font-medium">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredDisciplines.map((discipline) => (
                                                <tr key={discipline.id} className="border-b last:border-b-0">
                                                    <td className="px-3 py-2 font-medium text-[#132844]">{discipline.name}</td>
                                                    <td className="px-3 py-2">{discipline.code || '—'}</td>
                                                    <td className="px-3 py-2">
                                                        <Badge variant={discipline.status === 'active' ? 'default' : 'secondary'} className={discipline.status === 'active' ? 'bg-emerald-600 text-white' : ''}>
                                                            {discipline.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="inline-flex gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={() => startEdit(discipline)}>Ред.</Button>
                                                            <Button type="button" variant="outline" size="sm" className="text-red-700" onClick={() => remove(discipline.id)}>
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
                open={isDialogOpen}
                onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        resetForm();
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Редактирование дисциплины' : 'Новая дисциплина'}</DialogTitle>
                        <DialogDescription>
                            Заполните данные дисциплины и сохраните изменения.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={submit}>
                        <Input placeholder="Название" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                        <Input placeholder="Код" value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} />
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                        </select>

                        <div className="flex gap-2">
                            <Button type="submit" className="gap-2">
                                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {editingId ? 'Сохранить' : 'Создать'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Отмена
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
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
