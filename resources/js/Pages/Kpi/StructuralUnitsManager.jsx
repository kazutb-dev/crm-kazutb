import React, { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage, useForm, router } from '@inertiajs/react';
import { PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatStructuralUnitLabel } from '@/utils/kpi-structure-label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Building2, Eye, Inbox, ListChecks, PencilIcon, Plus, Search, Trash2, Unlink, Users } from 'lucide-react';

// Empty state for use inside a card (the platform EmptyState is itself a card).
function InlineEmpty({ title, description = null, action = null }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <Inbox className="h-4 w-4" />
            </div>
            <div className="max-w-md space-y-1">
                <p className="text-sm font-semibold text-[#102945]">{title}</p>
                {description ? <p className="text-sm leading-relaxed text-slate-600">{description}</p> : null}
            </div>
            {action}
        </div>
    );
}

export default function StructuralUnitsManager() {
    const { units } = usePage().props;
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [search, setSearch] = useState('');

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

    const recordsTotal = units.reduce((sum, unit) => sum + (Number(unit.records_count) || 0), 0);
    const usersTotal = units.reduce((sum, unit) => sum + (Number(unit.users_count) || 0), 0);
    const unusedUnits = units.filter((unit) => !(Number(unit.records_count) > 0) && !(Number(unit.users_count) > 0)).length;
    const searchQuery = search.trim().toLowerCase();
    const visibleUnits = searchQuery === ''
        ? units
        : units.filter((unit) => [unit.code, unit.name, unit.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(searchQuery));

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Структура"
                    title="Структурные подразделения"
                    description={`Всего структур: ${units.length}`}
                    actions={(
                        <Button onClick={() => setOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Добавить
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Управление структурами" />

            <div className="admin-page-wrap space-y-4">
                <StatGrid>
                    <StatTile label="Структур" value={units.length} tone="teal" icon={Building2} />
                    <StatTile label="Индикаторов" value={recordsTotal} tone="info" icon={ListChecks} hint="Привязано ко всем структурам" />
                    <StatTile label="Пользователей" value={usersTotal} tone="gold" icon={Users} hint="Ответственных сотрудников" />
                    <StatTile label="Без привязок" value={unusedUnits} tone={unusedUnits > 0 ? 'warning' : 'neutral'} icon={Unlink} hint="Нет индикаторов и пользователей — можно удалить" />
                </StatGrid>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <Building2 />
                            Список структур
                            <Badge variant="outline" className="tabular-nums">{visibleUnits.length} из {units.length}</Badge>
                        </CardTitle>
                        {units.length > 0 && (
                            <div className="relative w-full sm:w-80">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Поиск по коду, названию, описанию"
                                    aria-label="Поиск по структурам"
                                    className="h-9 pl-9"
                                />
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="p-0">
                        {units.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-slate-200">
                                        <tr>
                                            <th className="text-left">Код</th>
                                            <th className="text-left">Название</th>
                                            <th className="text-left">Описание</th>
                                            <th className="text-right">Индикаторы</th>
                                            <th className="text-right">Пользователи</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleUnits.length === 0 && (
                                            <tr className="hover:bg-transparent">
                                                <td colSpan={6} className="py-6 text-center text-sm text-slate-500">По запросу ничего не найдено.</td>
                                            </tr>
                                        )}
                                        {visibleUnits.map((unit) => (
                                            <tr key={unit.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                                <td>
                                                    <Badge variant="outline" className="font-mono">{unit.code}</Badge>
                                                </td>
                                                <td className="font-medium text-slate-900">
                                                    {formatStructuralUnitLabel(unit)}
                                                </td>
                                                <td className="text-slate-500">
                                                    {unit.description || '—'}
                                                </td>
                                                <td className="text-right">
                                                    <Badge variant="secondary" className="tabular-nums">{unit.records_count || 0}</Badge>
                                                </td>
                                                <td className="text-right">
                                                    <Badge variant="outline" className="tabular-nums">{unit.users_count || 0}</Badge>
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleOpenDetails(unit)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                            Открыть
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEdit(unit)}
                                                            title="Редактировать"
                                                        >
                                                            <PencilIcon className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(unit)}
                                                            title="Удалить"
                                                            className="text-red-700 hover:bg-red-50"
                                                            disabled={
                                                                unit.records_count > 0 ||
                                                                unit.users_count > 0
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <InlineEmpty
                                title="Структурные подразделения не найдены"
                                description="Добавьте первое структурное подразделение, чтобы привязывать к нему индикаторы и пользователей."
                                action={(
                                    <Button onClick={() => setOpen(true)}>
                                        <Plus className="h-4 w-4" />
                                        Добавить
                                    </Button>
                                )}
                            />
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
                        <div className="space-y-2">
                            <span className="qd-field-label block">
                                Код <span className="text-red-600">*</span>
                            </span>
                            <Input
                                value={data.code}
                                onChange={(e) => setData('code', e.target.value)}
                                placeholder="Например: УНиВС"
                                disabled={editingId !== null}
                            />
                            {errors.code && (
                                <p className="text-sm text-red-700">{errors.code}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <span className="qd-field-label block">
                                Название <span className="text-red-600">*</span>
                            </span>
                            <Input
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Например: Управление науки и высшей школы"
                            />
                            {errors.name && (
                                <p className="text-sm text-red-700">{errors.name}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <span className="qd-field-label block">Описание</span>
                            <Textarea
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                placeholder="Описание структурного подразделения"
                                rows={3}
                            />
                            {errors.description && (
                                <p className="text-sm text-red-700">
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

            <Dialog open={Boolean(deleteId)} onOpenChange={(value) => { if (!value) setDeleteId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Удалить структурное подразделение?</DialogTitle>
                        <DialogDescription>Это действие необратимо.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Отмена
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            Удалить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
