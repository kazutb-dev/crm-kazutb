import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, EmptyState, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Building2, CalendarDays, GraduationCap, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

function Field({ label, error, children }) {
    return (
        <div className="space-y-2">
            <Label className="block">{label}</Label>
            {children}
            {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
    );
}

export default function Index({ programs, departments, academicYears, degreeOptions }) {
    const items = programs?.data ?? [];
    const links = programs?.links ?? [];
    const total = programs?.total ?? items.length;

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

    const degreeSummary = useMemo(() => degreeOptions
        .map((option) => ({ label: option.label, count: items.filter((program) => program.degree === option.value).length }))
        .filter((entry) => entry.count > 0)
        .map((entry) => `${entry.label}: ${entry.count}`)
        .join(' · '), [degreeOptions, items]);

    const renderFields = (form) => (
        <>
            <Field label="Название" error={form.errors.name}>
                <Input
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    placeholder={form === createForm ? 'Например: Информационные системы' : undefined}
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Код" error={form.errors.code}>
                    <Input
                        value={form.data.code}
                        onChange={(e) => form.setData('code', e.target.value)}
                        placeholder={form === createForm ? 'IS-01' : undefined}
                    />
                </Field>
                <Field label="Степень" error={form.errors.degree}>
                    <select
                        className={qdFieldClass}
                        value={form.data.degree}
                        onChange={(e) => form.setData('degree', e.target.value)}
                    >
                        {degreeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Кафедра" error={form.errors.department_id}>
                    <select
                        className={qdFieldClass}
                        value={form.data.department_id}
                        onChange={(e) => form.setData('department_id', e.target.value)}
                    >
                        <option value="">Выберите кафедру</option>
                        {departments.map((department) => (
                            <option key={department.id} value={department.id}>
                                {department.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Учебный год" error={form.errors.academic_year_id}>
                    <select
                        className={qdFieldClass}
                        value={form.data.academic_year_id}
                        onChange={(e) => form.setData('academic_year_id', e.target.value)}
                    >
                        <option value="">Выберите учебный год</option>
                        {academicYears.map((year) => (
                            <option key={year.id} value={year.id}>
                                {year.name}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>
        </>
    );

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Справочники"
                    title="Образовательные программы"
                    description="Программы бакалавриата и магистратуры с привязкой к кафедре и учебному году."
                    actions={(
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
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
                                    {renderFields(createForm)}
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
                                        <Button type="submit" disabled={createForm.processing}>
                                            Сохранить
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                />
            )}
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
                        {renderFields(editForm)}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={editForm.processing}>
                                Сохранить изменения
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего программ" value={total} icon={GraduationCap} tone="teal" hint="Во всём справочнике" />
                    <StatTile label="На странице" value={items.length} icon={Layers} tone="navy" hint={degreeSummary || 'По степеням — нет данных'} />
                    <StatTile label="Кафедр" value={(departments ?? []).length} icon={Building2} tone="info" hint="Доступны для привязки" />
                    <StatTile label="Учебных лет" value={(academicYears ?? []).length} icon={CalendarDays} tone="gold" hint="Доступны для привязки" />
                </StatGrid>

                {items.length === 0 ? (
                    <EmptyState
                        title="Пока нет образовательных программ"
                        description="Добавьте первую программу и привяжите её к кафедре и учебному году."
                        action={(
                            <Button onClick={() => setCreateOpen(true)}>
                                <Plus />
                                Добавить программу
                            </Button>
                        )}
                    />
                ) : (
                    <DataTable>
                        <table className="w-full min-w-[900px] text-sm">
                            <thead>
                                <tr>
                                    <th className="px-5 text-left">Название</th>
                                    <th className="px-5 text-left">Код</th>
                                    <th className="px-5 text-left">Степень</th>
                                    <th className="px-5 text-left">Кафедра</th>
                                    <th className="px-5 text-left">Учебный год</th>
                                    <th className="px-5 text-right">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((program) => (
                                    <tr key={program.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                        <td className="px-5 py-3.5 font-medium text-slate-900">{program.name}</td>
                                        <td className="px-5 py-3.5">
                                            <Badge variant="outline">{program.code}</Badge>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <Badge variant={program.degree === 'master' ? 'info' : 'default'}>
                                                {degreeLabel(program.degree)}
                                            </Badge>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">
                                            {program.department?.name ?? '—'}
                                        </td>
                                        <td className="px-5 py-3.5 tabular-nums text-slate-600">
                                            {program.academic_year?.name ?? '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => openEditDialog(program)}>
                                                    <Pencil />
                                                    Редактировать
                                                </Button>
                                                <Button variant="destructive" size="sm" onClick={() => handleDelete(program)}>
                                                    <Trash2 />
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

                {links.length > 3 && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-medium text-slate-500">
                            Показано {programs?.from ?? 0}–{programs?.to ?? 0} из {total}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {links.map((link, index) => (
                                <Button
                                    key={`${link.label}-${index}`}
                                    variant={link.active ? 'default' : 'outline'}
                                    size="sm"
                                    disabled={!link.url}
                                    asChild={Boolean(link.url)}
                                >
                                    {link.url ? (
                                        <Link href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} />
                                    ) : (
                                        <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                    )}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
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
