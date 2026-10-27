import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, FilterBar, FormField, FormGrid, PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import { Building2, Edit2, ListChecks, Plus, Search, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

export default function Divisions({ divisions }) {
    const [search, setSearch] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ code: '', name: '' });

    const filteredDivisions = divisions.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.code && d.code.toLowerCase().includes(search.toLowerCase()))
    );

    const handleCreate = () => {
        setEditingId(null);
        setFormData({ code: '', name: '' });
        setFormOpen(true);
    };

    const handleEdit = (division) => {
        setEditingId(division.id);
        setFormData({ code: division.code || '', name: division.name });
        setFormOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('Введите название подразделения');
            return;
        }

        if (editingId) {
            router.put(`/kpi/divisions/${editingId}`, formData, {
                onSuccess: () => {
                    setFormOpen(false);
                    setFormData({ code: '', name: '' });
                }
            });
        } else {
            router.post('/kpi/divisions', formData, {
                onSuccess: () => {
                    setFormOpen(false);
                    setFormData({ code: '', name: '' });
                }
            });
        }
    };

    const handleDelete = (id) => {
        if (!confirm('Вы уверены? Это подразделение может быть привязано к индикаторам.')) {
            return;
        }
        router.delete(`/kpi/divisions/${id}`);
    };

    const indicatorsTotal = divisions.reduce((sum, d) => sum + (Number(d.indicators_count) || 0), 0);
    const usersTotal = divisions.reduce((sum, d) => sum + (Number(d.users_count) || 0), 0);

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Структура"
                    title="Подразделения"
                    description="Справочник структурных подразделений, их индикаторов и сотрудников."
                    actions={(
                        <>
                            <Button variant="outline" onClick={() => router.get(route('kpi.divisions.tables'))}>
                                Таблицы привязок
                            </Button>
                            <Button onClick={handleCreate}>
                                <Plus className="h-4 w-4" />
                                Новое подразделение
                            </Button>
                        </>
                    )}
                />
            )}
        >
            <Head title="Управление подразделениями" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Подразделений" value={divisions.length} tone="teal" icon={Building2} />
                    <StatTile label="Привязано индикаторов" value={indicatorsTotal} tone="info" icon={ListChecks} />
                    <StatTile label="Сотрудников" value={usersTotal} tone="gold" icon={Users} />
                </StatGrid>

                {formOpen && (
                    <Card className="border-teal-200">
                        <CardHeader>
                            <CardTitle>
                                {editingId ? 'Редактировать подразделение' : 'Новое подразделение'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <FormGrid>
                                    <FormField label="Код (опционально)">
                                        <Input
                                            type="text"
                                            placeholder="Код подразделения"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        />
                                    </FormField>
                                    <FormField label="Название *">
                                        <Input
                                            type="text"
                                            placeholder="Название подразделения"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </FormField>
                                </FormGrid>
                                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setFormOpen(false)}
                                    >
                                        Отмена
                                    </Button>
                                    <Button type="submit">
                                        {editingId ? 'Сохранить' : 'Создать'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <FilterBar>
                    <label className="block space-y-2">
                        <span className="qd-field-label block">Поиск</span>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="Поиск по названию или коду..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </label>
                </FilterBar>

                <DataTable>
                    <table className="w-full text-sm">
                        <thead className="border-b border-slate-200">
                            <tr>
                                <th className="text-left">Название</th>
                                <th className="text-left">Код</th>
                                <th className="text-center">Индикаторов</th>
                                <th className="text-center">Сотрудников</th>
                                <th className="text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDivisions.length === 0 ? (
                                <tr className="hover:bg-transparent">
                                    <td colSpan="5">
                                        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                                <Building2 className="h-6 w-6" />
                                            </div>
                                            <div className="max-w-md space-y-1">
                                                <p className="font-display text-base font-bold text-[#102945]">Подразделения не найдены</p>
                                                <p className="text-sm text-slate-600">Измените запрос поиска или создайте новое подразделение.</p>
                                            </div>
                                            <Button onClick={handleCreate}>
                                                <Plus className="h-4 w-4" />
                                                Новое подразделение
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredDivisions.map((division) => (
                                    <tr key={division.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                        <td className="font-medium text-slate-900">{division.name}</td>
                                        <td className="text-slate-500">
                                            {division.code ? (
                                                <Badge variant="outline">{division.code}</Badge>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="text-center">
                                            <Badge variant="secondary" className="tabular-nums">
                                                {division.indicators_count ?? 0}
                                            </Badge>
                                        </td>
                                        <td className="text-center">
                                            <Badge variant="outline" className="tabular-nums">
                                                {division.users_count ?? 0}
                                            </Badge>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleEdit(division)}
                                                    title="Редактировать"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    href={`/kpi/divisions/${division.id}/employees`}
                                                    title="Управлять сотрудниками"
                                                >
                                                    <Users className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDelete(division.id)}
                                                    title="Удалить"
                                                    className="text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </DataTable>
            </div>
        </AuthenticatedLayout>
    );
}
