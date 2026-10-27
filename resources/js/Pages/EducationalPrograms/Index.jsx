import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
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

    const departmentBreakdown = useMemo(() => {
        const counts = new Map();
        (departments ?? []).forEach((department) => counts.set(String(department.id), { key: String(department.id), label: department.name, count: 0 }));
        items.forEach((program) => {
            const id = String(program.department?.id ?? program.department_id ?? '');
            if (!id) {
                return;
            }
            const row = counts.get(id) ?? { key: id, label: program.department?.name ?? '—', count: 0 };
            row.count += 1;
            counts.set(id, row);
        });
        return [...counts.values()].sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label), 'ru'));
    }, [departments, items]);

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

            <div className="admin-page-wrap space-y-4">
                <StatGrid>
                    <StatTile label="Всего программ" value={total} icon={GraduationCap} tone="teal" hint="Во всём справочнике" />
                    <StatTile label="На странице" value={items.length} icon={Layers} tone="navy" hint={degreeSummary || 'По степеням — нет данных'} />
                    <StatTile label="Кафедр" value={(departments ?? []).length} icon={Building2} tone="info" hint="Доступны для привязки" />
                    <StatTile label="Учебных лет" value={(academicYears ?? []).length} icon={CalendarDays} tone="gold" hint="Доступны для привязки" />
                </StatGrid>

                <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0">
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
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead>
                                        <tr>
                                            <th className="text-left">Название</th>
                                            <th className="text-left">Код</th>
                                            <th className="text-left">Степень</th>
                                            <th className="text-left">Кафедра</th>
                                            <th className="text-left">Учебный год</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((program) => (
                                            <tr key={program.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                                <td className="font-medium text-slate-900">{program.name}</td>
                                                <td>
                                                    <Badge variant="outline">{program.code}</Badge>
                                                </td>
                                                <td>
                                                    <Badge variant={program.degree === 'master' ? 'info' : 'default'}>
                                                        {degreeLabel(program.degree)}
                                                    </Badge>
                                                </td>
                                                <td className="text-slate-600">
                                                    {program.department?.name ?? '—'}
                                                </td>
                                                <td className="tabular-nums text-slate-600">
                                                    {program.academic_year?.name ?? '—'}
                                                </td>
                                                <td className="text-right">
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
                            </div>
                            {links.length > 3 && (
                                <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-3 sm:px-6 justify-between">
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
                        </CardContent>
                    </Card>
                )}
                </div>

                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle>По кафедрам</CardTitle>
                            <span className="text-xs font-medium leading-none text-slate-500">Программ на странице</span>
                        </CardHeader>
                        <CardContent>
                            {departmentBreakdown.length === 0 ? (
                                <p className="text-sm text-slate-500">Кафедры не заведены.</p>
                            ) : (
                                <div className="divide-y divide-slate-200">
                                    {departmentBreakdown.map((row) => (
                                        <div key={row.key} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                                            <span className="min-w-0 truncate text-slate-700" title={row.label}>{row.label}</span>
                                            <span className={`shrink-0 tabular-nums ${row.count > 0 ? 'font-semibold text-[#102945]' : 'text-slate-400'}`}>{row.count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle>Учебные годы</CardTitle>
                            <span className="text-xs font-medium leading-none text-slate-500">Доступны для привязки</span>
                        </CardHeader>
                        <CardContent>
                            {(academicYears ?? []).length === 0 ? (
                                <p className="text-sm text-slate-500">Учебные годы не заведены.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {(academicYears ?? []).map((year) => {
                                        const count = items.filter((program) => String(program.academic_year?.id ?? program.academic_year_id ?? '') === String(year.id)).length;
                                        return (
                                            <span key={year.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs tabular-nums text-slate-700">
                                                {year.name}
                                                {count > 0 ? <span className="font-semibold text-teal-700">{count}</span> : null}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
                </div>
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
