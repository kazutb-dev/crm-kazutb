import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField, LoadingState, Notice, PageHeader, Segmented, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { BookOpenCheck, Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('ru-RU') : '—');

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
    const [statusFilter, setStatusFilter] = useState('all');

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

    const activeCount = disciplines.filter((discipline) => discipline.status === 'active').length;
    const inactiveCount = disciplines.length - activeCount;
    const withCodeCount = disciplines.filter((discipline) => discipline.code).length;
    const lastUpdated = disciplines.reduce((latest, discipline) => {
        const value = discipline.updated_at || discipline.created_at;
        return value && (!latest || new Date(value) > new Date(latest)) ? value : latest;
    }, null);
    const visibleDisciplines = filteredDisciplines.filter((discipline) => statusFilter === 'all' || (statusFilter === 'active' ? discipline.status === 'active' : discipline.status !== 'active'));

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Анкетирование"
                    title="Дисциплины"
                    description="Справочник дисциплин, используемых в привязках и опросах."
                    actions={(
                        <Button type="button" onClick={openCreateDialog}>
                            <Plus className="h-4 w-4" />
                            Добавить дисциплину
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Анкетирование - Дисциплины" />

            <div className="admin-page-wrap space-y-6">
                {error && <Notice tone="danger" title="Ошибка">{error}</Notice>}
                {success && <Notice tone="success">{success}</Notice>}

                <StatGrid>
                    <StatTile label="Всего дисциплин" value={loading ? '…' : disciplines.length} tone="teal" icon={BookOpenCheck} />
                    <StatTile label="Активные" value={loading ? '…' : activeCount} tone="success" hint={disciplines.length ? `${Math.round((activeCount / disciplines.length) * 100)}% справочника` : null} />
                    <StatTile label="Неактивные" value={loading ? '…' : inactiveCount} tone="neutral" />
                    <StatTile label="С кодом" value={loading ? '…' : withCodeCount} tone="navy" hint={disciplines.length ? `Без кода: ${disciplines.length - withCodeCount}` : null} />
                    <StatTile label="Последнее изменение" value={<span className="text-xl">{formatDate(lastUpdated)}</span>} tone="gold" />
                </StatGrid>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                        <CardTitle className="flex items-center gap-2">
                            <BookOpenCheck />
                            Список дисциплин
                        </CardTitle>
                        <span className="text-sm tabular-nums text-slate-500">Показано: {visibleDisciplines.length} из {disciplines.length}</span>
                    </CardHeader>
                    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3 sm:px-6">
                        <div className="relative w-full sm:w-96">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input className="pl-9" placeholder="Название или код дисциплины" aria-label="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <Segmented
                            items={[
                                { key: 'all', label: `Все · ${disciplines.length}` },
                                { key: 'active', label: `Активные · ${activeCount}` },
                                { key: 'inactive', label: `Неактивные · ${inactiveCount}` },
                            ]}
                            value={statusFilter}
                            onChange={setStatusFilter}
                        />
                    </div>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="px-5 py-4 sm:px-6"><LoadingState /></div>
                        ) : visibleDisciplines.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center sm:px-6">
                                <p className="font-semibold text-[#102945]">{disciplines.length === 0 ? 'Дисциплины еще не добавлены' : 'Ничего не найдено'}</p>
                                <p className="text-sm text-slate-600">{disciplines.length === 0 ? 'Добавьте первую дисциплину, чтобы использовать её в привязках и опросах.' : 'Измените поисковый запрос или фильтр статуса.'}</p>
                                {disciplines.length === 0 && (
                                    <Button type="button" size="sm" className="mt-1" onClick={openCreateDialog}>
                                        <Plus className="h-4 w-4" />
                                        Добавить дисциплину
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="w-12 whitespace-nowrap text-right">№</th>
                                            <th className="whitespace-nowrap text-left">Название</th>
                                            <th className="whitespace-nowrap text-left">Код</th>
                                            <th className="whitespace-nowrap text-left">Статус</th>
                                            <th className="whitespace-nowrap text-right">Создано</th>
                                            <th className="whitespace-nowrap text-right">Обновлено</th>
                                            <th className="whitespace-nowrap text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleDisciplines.map((discipline, index) => (
                                            <tr key={discipline.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                                <td className="text-right tabular-nums text-slate-400">{index + 1}</td>
                                                <td className="font-medium text-slate-900">{discipline.name}</td>
                                                <td className="whitespace-nowrap font-mono text-xs text-slate-600">{discipline.code || '—'}</td>
                                                <td>
                                                    <StatusBadge tone={discipline.status === 'active' ? 'success' : 'default'}>
                                                        {discipline.status}
                                                    </StatusBadge>
                                                </td>
                                                <td className="whitespace-nowrap text-right tabular-nums text-slate-600">{formatDate(discipline.created_at)}</td>
                                                <td className="whitespace-nowrap text-right tabular-nums text-slate-600">{formatDate(discipline.updated_at)}</td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(discipline)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                            Ред.
                                                        </Button>
                                                        <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => remove(discipline.id)}>
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

                    <form className="space-y-4" onSubmit={submit}>
                        <FormField label="Название">
                            <Input placeholder="Название" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                        </FormField>
                        <FormField label="Код">
                            <Input placeholder="Код" value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} />
                        </FormField>
                        <FormField label="Статус">
                            <select className={qdFieldClass} value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                                <option value="active">active</option>
                                <option value="inactive">inactive</option>
                            </select>
                        </FormField>

                        <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
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
