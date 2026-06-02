import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import { Edit2, Plus, Trash2, Users } from 'lucide-react';
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

    return (
        <AuthenticatedLayout>
            <Head title="Управление подразделениями" />

            <div className="admin-page-wrap">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Подразделения</h1>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => router.get(route('kpi.divisions.tables'))}>
                            Таблицы привязок
                        </Button>
                        <Button onClick={handleCreate} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Новое подразделение
                        </Button>
                    </div>
                </div>

                {/* Форма создания/редактирования */}
                {formOpen && (
                    <Card className="border-blue-200 bg-blue-50">
                        <CardHeader>
                            <CardTitle>
                                {editingId ? 'Редактировать подразделение' : 'Новое подразделение'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Код (опционально)</label>
                                        <Input
                                            type="text"
                                            placeholder="Код подразделения"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Название *</label>
                                        <Input
                                            type="text"
                                            placeholder="Название подразделения"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button type="submit">
                                        {editingId ? 'Сохранить' : 'Создать'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setFormOpen(false)}
                                    >
                                        Отмена
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Поиск */}
                <div className="flex gap-2">
                    <Input
                        placeholder="Поиск по названию или коду..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1"
                    />
                </div>

                {/* Таблица подразделений */}
                <div className="overflow-hidden rounded-lg border">
                    <table className="w-full">
                        <thead className="border-b bg-muted">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Название</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Код</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold">Индикаторов</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold">Сотрудников</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDivisions.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-6 text-center text-muted-foreground">
                                        Подразделения не найдены
                                    </td>
                                </tr>
                            ) : (
                                filteredDivisions.map((division) => (
                                    <tr key={division.id} className="border-b hover:bg-muted/50">
                                        <td className="px-4 py-3 font-medium">{division.name}</td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">
                                            {division.code ? (
                                                <Badge variant="outline">{division.code}</Badge>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge variant="secondary">
                                                {division.indicators_count ?? 0}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge variant="outline">
                                                {division.users_count ?? 0}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
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
            </div>
        </AuthenticatedLayout>
    );
}
