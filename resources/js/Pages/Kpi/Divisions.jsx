import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FormField, PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, router } from '@inertiajs/react';
import { Building2, Edit2, ListChecks, Plus, Search, Trash2, UserX, Users } from 'lucide-react';
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
    const withoutUsers = divisions.filter((d) => !(Number(d.users_count) > 0)).length;
    const withoutIndicators = divisions.filter((d) => !(Number(d.indicators_count) > 0)).length;

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

            <div className="admin-page-wrap space-y-4">
                <StatGrid>
                    <StatTile label="Подразделений" value={divisions.length} tone="teal" icon={Building2} hint={`С кодом: ${divisions.filter((d) => d.code).length}`} />
                    <StatTile label="Привязано индикаторов" value={indicatorsTotal} tone="info" icon={ListChecks} hint={`Без индикаторов: ${withoutIndicators}`} />
                    <StatTile label="Сотрудников" value={usersTotal} tone="gold" icon={Users} />
                    <StatTile label="Без сотрудников" value={withoutUsers} tone={withoutUsers > 0 ? 'warning' : 'neutral'} icon={UserX} hint="Подразделения без назначенных сотрудников" />
                </StatGrid>

                {formOpen && (
                    <Card className="border-teal-200">
                        <CardHeader>
                            <CardTitle>
                                {editingId ? 'Редактировать подразделение' : 'Новое подразделение'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end">
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
                                <div className="flex justify-end gap-2">
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

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <Building2 />
                            Справочник подразделений
                            <Badge variant="outline" className="tabular-nums">{filteredDivisions.length} из {divisions.length}</Badge>
                        </CardTitle>
                        <div className="relative w-full sm:w-80">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="Поиск по названию или коду..."
                                aria-label="Поиск"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 pl-9"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-slate-200">
                            <tr>
                                <th className="text-left">Название</th>
                                <th className="text-left">Код</th>
                                <th className="text-right">Индикаторов</th>
                                <th className="text-right">Сотрудников</th>
                                <th className="text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDivisions.length === 0 ? (
                                <tr className="hover:bg-transparent">
                                    <td colSpan="5">
                                        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                                <Building2 className="h-4 w-4" />
                                            </div>
                                            <div className="max-w-md space-y-1">
                                                <p className="text-sm font-semibold text-[#102945]">Подразделения не найдены</p>
                                                <p className="text-sm text-slate-600">Измените запрос поиска или создайте новое подразделение.</p>
                                            </div>
                                            <Button size="sm" onClick={handleCreate}>
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
                                        <td className="text-right">
                                            <Badge variant="secondary" className="tabular-nums">
                                                {division.indicators_count ?? 0}
                                            </Badge>
                                        </td>
                                        <td className="text-right">
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
                                                    asChild
                                                    size="sm"
                                                    variant="ghost"
                                                    title="Управлять сотрудниками"
                                                >
                                                    <Link href={`/kpi/divisions/${division.id}/employees`}>
                                                        <Users className="h-4 w-4" />
                                                    </Link>
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
                    </div>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
