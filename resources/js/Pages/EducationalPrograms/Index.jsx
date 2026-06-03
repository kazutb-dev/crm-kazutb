import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function Index({ programs, departments, academicYears, degreeOptions }) {
    const items = programs?.data ?? [];
    const links = programs?.links ?? [];

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingProgram, setEditingProgram] = useState(null);

    const createForm = useForm({
        name: '',
        code: '',
        degree: 'bachelor',
        department_id: departments?.[0]?.id ? String(departments[0].id) : '',
        academic_year_id: academicYears?.[0]?.id ? String(academicYears[0].id) : '',
    });

    const editForm = useForm({
        name: '',
        code: '',
        degree: 'bachelor',
        department_id: '',
        academic_year_id: '',
    });

    const handleDelete = (program) => {
        setConfirmState({
            open: true,
            description: `Удалить программу "${program.name}"?`,
            onConfirm: () => router.delete(route('educational-programs.destroy', program.id)),
        });
    };

    const openEditDialog = (program) => {
        setEditingProgram(program);
        editForm.setData({
            name: program.name ?? '',
            code: program.code ?? '',
            degree: program.degree ?? 'bachelor',
            department_id: program.department_id ? String(program.department_id) : '',
            academic_year_id: program.academic_year_id ? String(program.academic_year_id) : '',
        });
        editForm.clearErrors();
        setEditOpen(true);
    };

    const submitCreate = (e) => {
        e.preventDefault();

        createForm.post(route('educational-programs.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset({
                    name: '',
                    code: '',
                    degree: 'bachelor',
                    department_id: departments?.[0]?.id ? String(departments[0].id) : '',
                    academic_year_id: academicYears?.[0]?.id ? String(academicYears[0].id) : '',
                });
                setCreateOpen(false);
            },
        });
    };

    const submitEdit = (e) => {
        e.preventDefault();

        if (!editingProgram) {
            return;
        }

        editForm.patch(route('educational-programs.update', editingProgram.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditOpen(false);
                setEditingProgram(null);
            },
        });
    };

    const degreeLabel = (value) => {
        const option = degreeOptions.find((item) => item.value === value);

        return option?.label ?? value;
    };

    return (
        <AuthenticatedLayout
            headerRight={
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus />
                            Добавить программу
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Новая образовательная программа</DialogTitle>
                            <DialogDescription>
                                Укажите основные данные программы.
                            </DialogDescription>
                        </DialogHeader>
                        <form className="space-y-4" onSubmit={submitCreate}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Название</label>
                                <Input
                                    value={createForm.data.name}
                                    onChange={(e) =>
                                        createForm.setData('name', e.target.value)
                                    }
                                    placeholder="Например: Информационные системы"
                                />
                                {createForm.errors.name && (
                                    <p className="text-sm text-destructive">
                                        {createForm.errors.name}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Код</label>
                                    <Input
                                        value={createForm.data.code}
                                        onChange={(e) =>
                                            createForm.setData('code', e.target.value)
                                        }
                                        placeholder="IS-01"
                                    />
                                    {createForm.errors.code && (
                                        <p className="text-sm text-destructive">
                                            {createForm.errors.code}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Степень</label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-input bg-background/70 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={createForm.data.degree}
                                        onChange={(e) =>
                                            createForm.setData('degree', e.target.value)
                                        }
                                    >
                                        {degreeOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    {createForm.errors.degree && (
                                        <p className="text-sm text-destructive">
                                            {createForm.errors.degree}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Кафедра</label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-input bg-background/70 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={createForm.data.department_id}
                                        onChange={(e) =>
                                            createForm.setData('department_id', e.target.value)
                                        }
                                    >
                                        <option value="">Выберите кафедру</option>
                                        {departments.map((department) => (
                                            <option key={department.id} value={department.id}>
                                                {department.name}
                                            </option>
                                        ))}
                                    </select>
                                    {createForm.errors.department_id && (
                                        <p className="text-sm text-destructive">
                                            {createForm.errors.department_id}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Учебный год</label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-input bg-background/70 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={createForm.data.academic_year_id}
                                        onChange={(e) =>
                                            createForm.setData('academic_year_id', e.target.value)
                                        }
                                    >
                                        <option value="">Выберите учебный год</option>
                                        {academicYears.map((year) => (
                                            <option key={year.id} value={year.id}>
                                                {year.name}
                                            </option>
                                        ))}
                                    </select>
                                    {createForm.errors.academic_year_id && (
                                        <p className="text-sm text-destructive">
                                            {createForm.errors.academic_year_id}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={createForm.processing}>
                                    Сохранить
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            }
        >
            <Head title="Образовательные программы" />

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) {
                        setEditingProgram(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактирование программы</DialogTitle>
                        <DialogDescription>
                            Обновите данные образовательной программы.
                        </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={submitEdit}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Название</label>
                            <Input
                                value={editForm.data.name}
                                onChange={(e) => editForm.setData('name', e.target.value)}
                            />
                            {editForm.errors.name && (
                                <p className="text-sm text-destructive">{editForm.errors.name}</p>
                            )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Код</label>
                                <Input
                                    value={editForm.data.code}
                                    onChange={(e) => editForm.setData('code', e.target.value)}
                                />
                                {editForm.errors.code && (
                                    <p className="text-sm text-destructive">{editForm.errors.code}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Степень</label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background/70 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={editForm.data.degree}
                                    onChange={(e) => editForm.setData('degree', e.target.value)}
                                >
                                    {degreeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                {editForm.errors.degree && (
                                    <p className="text-sm text-destructive">{editForm.errors.degree}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Кафедра</label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background/70 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={editForm.data.department_id}
                                    onChange={(e) =>
                                        editForm.setData('department_id', e.target.value)
                                    }
                                >
                                    <option value="">Выберите кафедру</option>
                                    {departments.map((department) => (
                                        <option key={department.id} value={department.id}>
                                            {department.name}
                                        </option>
                                    ))}
                                </select>
                                {editForm.errors.department_id && (
                                    <p className="text-sm text-destructive">
                                        {editForm.errors.department_id}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Учебный год</label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background/70 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={editForm.data.academic_year_id}
                                    onChange={(e) =>
                                        editForm.setData('academic_year_id', e.target.value)
                                    }
                                >
                                    <option value="">Выберите учебный год</option>
                                    {academicYears.map((year) => (
                                        <option key={year.id} value={year.id}>
                                            {year.name}
                                        </option>
                                    ))}
                                </select>
                                {editForm.errors.academic_year_id && (
                                    <p className="text-sm text-destructive">
                                        {editForm.errors.academic_year_id}
                                    </p>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={editForm.processing}>
                                Сохранить изменения
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="admin-page-wrap">
                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle>Список образовательных программ</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <div className="admin-empty-state">
                                Пока нет образовательных программ.
                            </div>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-data-table min-w-[900px]">
                                    <thead>
                                        <tr>
                                            <th>Название</th>
                                            <th>Код</th>
                                            <th>Степень</th>
                                            <th>Кафедра</th>
                                            <th>Учебный год</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((program) => (
                                            <tr key={program.id}>
                                                <td className="py-3 pe-3 font-medium">{program.name}</td>
                                                <td className="py-3 pe-3">
                                                    <Badge variant="outline">{program.code}</Badge>
                                                </td>
                                                <td className="py-3 pe-3">
                                                    {degreeLabel(program.degree)}
                                                </td>
                                                <td className="py-3 pe-3 text-muted-foreground">
                                                    {program.department?.name ?? '-'}
                                                </td>
                                                <td className="py-3 pe-3 text-muted-foreground">
                                                    {program.academic_year?.name ?? '-'}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="admin-row-actions">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openEditDialog(program)}
                                                        >
                                                            <Pencil />
                                                            Редактировать
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleDelete(program)}
                                                        >
                                                            <Trash2 />
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

                        {links.length > 3 && (
                            <div className="admin-pagination">
                                {links.map((link, index) => (
                                    <Button
                                        key={`${link.label}-${index}`}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                        asChild={Boolean(link.url)}
                                    >
                                        {link.url ? (
                                            <Link
                                                href={link.url}
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        ) : (
                                            <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                        )}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
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
