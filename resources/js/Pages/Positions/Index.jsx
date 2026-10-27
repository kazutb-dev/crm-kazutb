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
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { BriefcaseBusiness, Layers, Network, Pencil, Plus, Search, Trash2, Unlink } from 'lucide-react';
import { useMemo, useState } from 'react';

/** Side rail: how the shown records split by parent unit and how complete they are. */
function BreakdownRail({ title, groups, missingLabel, missingCount, completeness, totalShown }) {
    const max = Math.max(1, ...groups.map((group) => group.count), missingCount);
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <CardTitle>{title}</CardTitle>
                    <span className="text-xs font-medium leading-none text-slate-500">Среди показанных</span>
                </CardHeader>
                <CardContent>
                    {groups.length === 0 && missingCount === 0 ? (
                        <p className="text-sm text-slate-500">Нет данных для разбивки.</p>
                    ) : (
                        <div className="space-y-2.5">
                            {groups.map((group) => (
                                <div key={group.key} className="space-y-1">
                                    <div className="flex items-center justify-between gap-3 text-sm">
                                        <span className="min-w-0 truncate text-slate-700" title={group.label}>{group.label}</span>
                                        <span className="shrink-0 font-semibold tabular-nums text-[#102945]">{group.count}</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                        <div className="h-full rounded-full bg-teal-600" style={{ width: `${(group.count / max) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                            {missingCount > 0 ? (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-3 text-sm">
                                        <span className="text-amber-700">{missingLabel}</span>
                                        <span className="font-semibold tabular-nums text-amber-700">{missingCount}</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${(missingCount / max) * 100}%` }} />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Заполненность</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                    {completeness.map((row) => {
                        const percent = totalShown > 0 ? Math.round((row.count / totalShown) * 100) : 0;
                        return (
                            <div key={row.label} className="space-y-1">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-slate-700">{row.label}</span>
                                    <span className="tabular-nums text-slate-500"><span className="font-semibold text-[#102945]">{row.count}</span> / {totalShown} · {percent}%</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-[#102945]" style={{ width: `${percent}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}

function Field({ label, error, children }) {
    return (
        <div className="space-y-2">
            <Label className="block">{label}</Label>
            {children}
            {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
    );
}

export default function Index({ positions, divisions }) {
    const items = positions?.data ?? [];
    const links = positions?.links ?? [];
    const total = positions?.total ?? items.length;

    const [tableSearch, setTableSearch] = useState('');
    const visibleItems = useMemo(() => {
        const q = tableSearch.trim().toLowerCase();
        if (!q) {
            return items;
        }
        return items.filter((item) => [item.name, item.code, item.description, item.division?.name]
            .filter(Boolean).join(' ').toLowerCase().includes(q));
    }, [items, tableSearch]);
    const parentGroups = useMemo(() => {
        const counts = new Map();
        items.forEach((item) => {
            if (item.division?.name) {
                counts.set(item.division.name, (counts.get(item.division.name) ?? 0) + 1);
            }
        });
        (divisions ?? []).forEach((parent) => {
            if (parent?.name && !counts.has(parent.name)) {
                counts.set(parent.name, 0);
            }
        });
        return [...counts.entries()]
            .map(([label, count]) => ({ key: label, label, count }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'));
    }, [items]);

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState(null);
    const [createDivisionSearch, setCreateDivisionSearch] = useState('');
    const [editDivisionSearch, setEditDivisionSearch] = useState('');

    const createForm = useForm({
        division_id: divisions?.[0]?.id ? String(divisions[0].id) : '',
        name: '',
        code: '',
        description: '',
    });

    const editForm = useForm({
        division_id: '',
        name: '',
        code: '',
        description: '',
    });

    const withoutDivision = items.filter((position) => !position.division?.name).length;

    const handleDelete = (position) => {
        setConfirmState({
            open: true,
            description: `Удалить должность "${position.name}"?`,
            onConfirm: () => router.delete(route('positions.destroy', position.id)),
        });
    };

    const openEditDialog = (position) => {
        setEditingPosition(position);
        editForm.setData({
            division_id: position.division_id ? String(position.division_id) : '',
            name: position.name ?? '',
            code: position.code ?? '',
            description: position.description ?? '',
        });
        editForm.clearErrors();
        setEditOpen(true);
    };

    const submitCreate = (e) => {
        e.preventDefault();

        createForm.post(route('positions.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset({
                    division_id: divisions?.[0]?.id ? String(divisions[0].id) : '',
                    name: '',
                    code: '',
                    description: '',
                });
                setCreateOpen(false);
            },
        });
    };

    const submitEdit = (e) => {
        e.preventDefault();

        if (!editingPosition) {
            return;
        }

        editForm.patch(route('positions.update', editingPosition.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditOpen(false);
                setEditingPosition(null);
            },
        });
    };

    const filteredCreateDivisions = useMemo(() => {
        const query = createDivisionSearch.trim().toLowerCase();

        if (query === '') {
            return divisions;
        }

        return divisions.filter((division) =>
            String(division.name ?? '').toLowerCase().includes(query)
        );
    }, [divisions, createDivisionSearch]);

    const filteredEditDivisions = useMemo(() => {
        const query = editDivisionSearch.trim().toLowerCase();

        if (query === '') {
            return divisions;
        }

        return divisions.filter((division) =>
            String(division.name ?? '').toLowerCase().includes(query)
        );
    }, [divisions, editDivisionSearch]);

    const divisionPicker = ({ search, setSearch, form, options }) => (
        <div className="space-y-2">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск департамента"
                    className="pl-9"
                />
            </div>
            <select
                className={qdFieldClass}
                value={form.data.division_id}
                onChange={(e) => form.setData('division_id', e.target.value)}
            >
                <option value="">Выберите департамент</option>
                {options.map((division) => (
                    <option key={division.id} value={division.id}>
                        {division.name}
                    </option>
                ))}
            </select>
        </div>
    );

    const openCreate = () => setCreateOpen(true);

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Справочники"
                    title="Должности"
                    description="Справочник должностей с привязкой к департаментам."
                    actions={(
                        <Dialog
                            open={createOpen}
                            onOpenChange={(open) => {
                                setCreateOpen(open);

                                if (!open) {
                                    setCreateDivisionSearch('');
                                }
                            }}
                        >
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus />
                                    Добавить должность
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Новая должность</DialogTitle>
                                    <DialogDescription>
                                        При создании должности выберите департамент и заполните основные данные.
                                    </DialogDescription>
                                </DialogHeader>
                                <form className="space-y-4" onSubmit={submitCreate}>
                                    <Field label="Департамент" error={createForm.errors.division_id}>
                                        {divisionPicker({
                                            search: createDivisionSearch,
                                            setSearch: setCreateDivisionSearch,
                                            form: createForm,
                                            options: filteredCreateDivisions,
                                        })}
                                    </Field>
                                    <Field label="Название" error={createForm.errors.name}>
                                        <Input
                                            value={createForm.data.name}
                                            onChange={(e) => createForm.setData('name', e.target.value)}
                                            placeholder="Например: Руководитель отдела"
                                        />
                                    </Field>
                                    <Field label="Код" error={createForm.errors.code}>
                                        <Input
                                            value={createForm.data.code}
                                            onChange={(e) => createForm.setData('code', e.target.value)}
                                            placeholder="Например: HEAD"
                                        />
                                    </Field>
                                    <Field label="Описание" error={createForm.errors.description}>
                                        <Textarea
                                            value={createForm.data.description}
                                            onChange={(e) => createForm.setData('description', e.target.value)}
                                            placeholder="Краткое описание должности"
                                        />
                                    </Field>
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
            <Head title="Должности" />

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) {
                        setEditingPosition(null);
                        setEditDivisionSearch('');
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактирование должности</DialogTitle>
                        <DialogDescription>
                            Обновите департамент и данные должности.
                        </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={submitEdit}>
                        <Field label="Департамент" error={editForm.errors.division_id}>
                            {divisionPicker({
                                search: editDivisionSearch,
                                setSearch: setEditDivisionSearch,
                                form: editForm,
                                options: filteredEditDivisions,
                            })}
                        </Field>
                        <Field label="Название" error={editForm.errors.name}>
                            <Input
                                value={editForm.data.name}
                                onChange={(e) => editForm.setData('name', e.target.value)}
                            />
                        </Field>
                        <Field label="Код" error={editForm.errors.code}>
                            <Input
                                value={editForm.data.code}
                                onChange={(e) => editForm.setData('code', e.target.value)}
                            />
                        </Field>
                        <Field label="Описание" error={editForm.errors.description}>
                            <Textarea
                                value={editForm.data.description}
                                onChange={(e) => editForm.setData('description', e.target.value)}
                            />
                        </Field>
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
                    <StatTile label="Всего должностей" value={total} icon={BriefcaseBusiness} tone="teal" hint="Во всём справочнике" />
                    <StatTile label="Департаментов" value={(divisions ?? []).length} icon={Network} tone="navy" hint="Доступны для привязки" />
                    <StatTile label="На странице" value={items.length} icon={Layers} tone="info" hint={positions?.last_page > 1 ? `Страница ${positions.current_page} из ${positions.last_page}` : 'Все записи на одной странице'} />
                    <StatTile label="Без департамента" value={withoutDivision} icon={Unlink} tone={withoutDivision > 0 ? 'warning' : 'success'} hint="Среди показанных" />
                </StatGrid>

                {items.length === 0 ? (
                    <EmptyState
                        title="Пока нет должностей"
                        description="Создайте первую запись — должности используются в профилях сотрудников."
                        action={(
                            <Button onClick={openCreate}>
                                <Plus />
                                Добавить должность
                            </Button>
                        )}
                    />
                ) : (
                    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle>Должности · <span className="tabular-nums">{visibleItems.length}</span>{tableSearch ? <> из <span className="tabular-nums">{items.length}</span></> : null}</CardTitle>
                            <label className="relative block w-full max-w-xs">
                                <span className="sr-only">Поиск по таблице</span>
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    placeholder="Название, код, департамент"
                                    className="h-9 bg-white pl-9"
                                />
                            </label>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead>
                                        <tr>
                                            <th className="text-left">Название</th>
                                            <th className="text-left">Департамент</th>
                                            <th className="text-left">Код</th>
                                            <th className="text-left">Описание</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-sm text-slate-500">Ничего не найдено — измените запрос.</td>
                                            </tr>
                                        ) : null}
                                        {visibleItems.map((position) => (
                                            <tr key={position.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                                <td className="font-medium text-slate-900">{position.name}</td>
                                                <td className="text-slate-600">
                                                    {position.division?.name ?? <span className="text-slate-400">—</span>}
                                                </td>
                                                <td>
                                                    {position.code ? (
                                                        <Badge variant="outline">{position.code}</Badge>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="max-w-md text-slate-600"><span className="line-clamp-2">
                                                    {position.description || <span className="text-slate-400">—</span>}</span>
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => openEditDialog(position)}>
                                                            <Pencil />
                                                            Редактировать
                                                        </Button>
                                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(position)}>
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
                                        Показано {positions?.from ?? 0}–{positions?.to ?? 0} из {total}
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
                    <BreakdownRail
                        title="По департаментам"
                        groups={parentGroups}
                        missingLabel="Без департамента"
                        missingCount={items.filter((item) => !item.division?.name).length}
                        totalShown={items.length}
                        completeness={[
                            { label: 'С кодом', count: items.filter((item) => item.code).length },
                            { label: 'С описанием', count: items.filter((item) => item.description).length },
                            { label: 'С привязкой', count: items.filter((item) => item.division?.name).length },
                        ]}
                    />
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
