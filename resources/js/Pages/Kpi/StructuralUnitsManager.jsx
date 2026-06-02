import React, { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage, useForm, router } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatStructuralUnitLabel } from '@/utils/kpi-structure-label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, Plus, PencilIcon, Eye } from 'lucide-react';

export default function StructuralUnitsManager() {
    const { units } = usePage().props;
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);

    const { data, setData, post, put, reset, errors, processing } = useForm({
        code: '',
        name: '',
        description: '',
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        if (editingId) {
            put(route('kpi.structural-units.update', editingId), {
                onSuccess: () => {
                    handleClose();
                },
            });
        } else {
            post(route('kpi.structural-units.store'), {
                onSuccess: () => {
                    handleClose();
                },
            });
        }
    };

    const handleEdit = (unit) => {
        setEditingId(unit.id);
        setData({
            code: unit.code,
            name: unit.name,
            description: unit.description || '',
        });
        setOpen(true);
    };

    const handleDelete = (unit) => {
        setDeleteId(unit.id);
    };

    const handleOpenDetails = (unit) => {
        router.visit(route('kpi.structural-units.show', unit.id));
    };

    const confirmDelete = () => {
        router.delete(route('kpi.structural-units.destroy', deleteId), {
            onSuccess: () => {
                setDeleteId(null);
            },
        });
    };

    const handleClose = () => {
        setOpen(false);
        setEditingId(null);
        reset();
    };

    return (
        <AuthenticatedLayout>
            <Head title="Управление структурами" />

            <div className="admin-page-wrap">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Структурные подразделения</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Всего структур: {units.length}
                        </p>
                    </div>
                    <Button
                        onClick={() => setOpen(true)}
                        className="gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Добавить
                    </Button>
                </div>

                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-[#132844]">Список структур</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {units.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b bg-muted/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-sm font-semibold">Код</th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold">Название</th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold">Описание</th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold">Индикаторы</th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold">Пользователи</th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold">Открыть</th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {units.map((unit) => (
                                            <tr key={unit.id} className="border-b hover:bg-muted/30">
                                                <td className="px-6 py-3 font-mono font-semibold text-sm">
                                                    <Badge variant="outline">{unit.code}</Badge>
                                                </td>
                                                <td className="px-6 py-3 text-sm">
                                                    {formatStructuralUnitLabel(unit)}
                                                </td>
                                                <td className="px-6 py-3 text-sm text-muted-foreground">
                                                    {unit.description || '—'}
                                                </td>
                                                <td className="px-6 py-3 text-right text-sm font-medium">
                                                    <Badge variant="secondary">{unit.records_count || 0}</Badge>
                                                </td>
                                                <td className="px-6 py-3 text-right text-sm font-medium">
                                                    <Badge variant="outline">{unit.users_count || 0}</Badge>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleOpenDetails(unit)}
                                                        className="gap-2"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        Открыть
                                                    </Button>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEdit(unit)}
                                                        >
                                                            <PencilIcon className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(unit)}
                                                            disabled={
                                                                unit.records_count > 0 ||
                                                                unit.users_count > 0
                                                            }
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-muted-foreground">Структурные подразделения не найдены</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingId
                                ? 'Редактировать структурное подразделение'
                                : 'Добавить структурное подразделение'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Код <span className="text-red-500">*</span>
                            </label>
                            <Input
                                value={data.code}
                                onChange={(e) => setData('code', e.target.value)}
                                placeholder="Например: УНиВС"
                                disabled={editingId !== null}
                            />
                            {errors.code && (
                                <p className="text-sm text-red-500 mt-1">{errors.code}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Название <span className="text-red-500">*</span>
                            </label>
                            <Input
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Например: Управление науки и высшей школы"
                            />
                            {errors.name && (
                                <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Описание
                            </label>
                            <Textarea
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                placeholder="Описание структурного подразделения"
                                rows={3}
                            />
                            {errors.description && (
                                <p className="text-sm text-red-500 mt-1">
                                    {errors.description}
                                </p>
                            )}
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                                disabled={processing}
                            >
                                Отмена
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {editingId ? 'Обновить' : 'Добавить'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {deleteId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-sm">
                        <h2 className="text-lg font-semibold mb-2">Удалить структурное подразделение?</h2>
                        <p className="text-gray-600 mb-6">Это действие необратимо.</p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setDeleteId(null)}
                            >
                                Отмена
                            </Button>
                            <Button
                                onClick={confirmDelete}
                                className="bg-red-500 hover:bg-red-600 text-white"
                            >
                                Удалить
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
