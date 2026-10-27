import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, Notice, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
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
import { Layers, Landmark, Network, Pencil, Plus, Search, Trash2, Unlink } from 'lucide-react';
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

export default function Index({ divisions, faculties = [] }) {
    const items = divisions?.data ?? [];
    const links = divisions?.links ?? [];
    const total = divisions?.total ?? items.length;

    const [tableSearch, setTableSearch] = useState('');
    const visibleItems = useMemo(() => {
        const q = tableSearch.trim().toLowerCase();
        if (!q) {
            return items;
        }
        return items.filter((item) => [item.name, item.code, item.description, item.faculty?.name]
            .filter(Boolean).join(' ').toLowerCase().includes(q));
    }, [items, tableSearch]);
    const parentGroups = useMemo(() => {
        const counts = new Map();
        items.forEach((item) => {
            if (item.faculty?.name) {
                counts.set(item.faculty.name, (counts.get(item.faculty.name) ?? 0) + 1);
            }
        });
        faculties.forEach((parent) => {
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
    const [editingDivision, setEditingDivision] = useState(null);

    const createForm = useForm({
        faculty_id: '',
        name: '',
        code: '',
        description: '',
    });

    const editForm = useForm({
        faculty_id: '',
        name: '',
        code: '',
        description: '',
    });

    const withoutFaculty = items.filter((division) => !division.faculty?.name).length;

    const handleDelete = (division) => {
        setConfirmState({
            open: true,
            description: `Удалить департамент "${division.name}"?`,
            onConfirm: () => router.delete(route('divisions.destroy', division.id)),
        });
    };

    const openEditDialog = (division) => {
        setEditingDivision(division);
        editForm.setData({
            faculty_id: division.faculty_id ? String(division.faculty_id) : '',
            name: division.name ?? '',
            code: division.code ?? '',
            description: division.description ?? '',
        });
        editForm.clearErrors();
        setEditOpen(true);
    };

    const submitCreate = (e) => {
        e.preventDefault();

        createForm.post(route('divisions.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                setCreateOpen(false);
            },
        });
    };

    const submitEdit = (e) => {
        e.preventDefault();

        if (!editingDivision) {
            return;
        }

        editForm.patch(route('divisions.update', editingDivision.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditOpen(false);
                setEditingDivision(null);
            },
        });
    };

    const facultySelect = (form) => (
        <select
            className={qdFieldClass}
            value={form.data.faculty_id}
            onChange={(e) => form.setData('faculty_id', e.target.value)}
        >
            <option value="">Выберите факультет</option>
            {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                </option>
            ))}
        </select>
    );

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Справочники"
                    title="Департаменты"
                    description="Департаменты и их привязка к факультетам университета."
                    actions={(
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button disabled={faculties.length === 0}>
                                    <Plus />
                                    Добавить департамент
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Новый департамент</DialogTitle>
                                    <DialogDescription>
                                        {faculties.length === 0
                                            ? 'Сначала создайте хотя бы один факультет в разделе "Факультеты".'
                                            : 'Заполните данные для создания департамента.'}
                                    </DialogDescription>
                                </DialogHeader>
                                <form className="space-y-4" onSubmit={submitCreate}>
                                    <Field label="Факультет" error={createForm.errors.faculty_id}>
                                        {facultySelect(createForm)}
                                    </Field>
                                    <Field label="Название" error={createForm.errors.name}>
                                        <Input
                                            value={createForm.data.name}
                                            onChange={(e) => createForm.setData('name', e.target.value)}
                                            placeholder="Например: Департамент цифровой трансформации"
                                        />
                                    </Field>
                                    <Field label="Код" error={createForm.errors.code}>
                                        <Input
                                            value={createForm.data.code}
                                            onChange={(e) => createForm.setData('code', e.target.value)}
                                            placeholder="Например: DDT"
                                        />
                                    </Field>
                                    <Field label="Описание" error={createForm.errors.description}>
                                        <Textarea
                                            value={createForm.data.description}
                                            onChange={(e) => createForm.setData('description', e.target.value)}
                                            placeholder="Краткое описание департамента"
                                        />
                                    </Field>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
                                        <Button
                                            type="submit"
                                            disabled={createForm.processing || faculties.length === 0}
                                        >
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
            <Head title="Департаменты" />

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) {
                        setEditingDivision(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактирование департамента</DialogTitle>
                        <DialogDescription>
                            Измените данные выбранного департамента.
                        </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={submitEdit}>
                        <Field label="Факультет" error={editForm.errors.faculty_id}>
                            {facultySelect(editForm)}
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
                    <StatTile label="Всего департаментов" value={total} icon={Network} tone="teal" hint="Во всём справочнике" />
                    <StatTile label="Факультетов" value={faculties.length} icon={Landmark} tone="navy" hint="Доступны для привязки" />
                    <StatTile label="На странице" value={items.length} icon={Layers} tone="info" hint={divisions?.last_page > 1 ? `Страница ${divisions.current_page} из ${divisions.last_page}` : 'Все записи на одной странице'} />
                    <StatTile label="Без факультета" value={withoutFaculty} icon={Unlink} tone={withoutFaculty > 0 ? 'warning' : 'success'} hint="Среди показанных" />
                </StatGrid>

                {faculties.length === 0 && (
                    <Notice tone="warning" title="Нет факультетов">
                        Сначала создайте хотя бы один факультет в разделе «Факультеты» — департамент привязывается к факультету.
                    </Notice>
                )}

                {items.length === 0 ? (
                    <EmptyState
                        title="Пока нет департаментов"
                        description="Создайте первую запись и привяжите её к факультету."
                        action={faculties.length > 0 ? (
                            <Button onClick={() => setCreateOpen(true)}>
                                <Plus />
                                Добавить департамент
                            </Button>
                        ) : null}
                    />
                ) : (
                    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle>Департаменты · <span className="tabular-nums">{visibleItems.length}</span>{tableSearch ? <> из <span className="tabular-nums">{items.length}</span></> : null}</CardTitle>
                            <label className="relative block w-full max-w-xs">
                                <span className="sr-only">Поиск по таблице</span>
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    placeholder="Название, код, факультет"
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
                                            <th className="text-left">Факультет</th>
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
                                        {visibleItems.map((division) => (
                                            <tr key={division.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                                <td className="font-medium text-slate-900">
                                                    {division.name}
                                                </td>
                                                <td className="text-slate-600">
                                                    {division.faculty?.name || <span className="text-slate-400">—</span>}
                                                </td>
                                                <td>
                                                    {division.code ? (
                                                        <Badge variant="outline">{division.code}</Badge>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="max-w-md text-slate-600"><span className="line-clamp-2">
                                                    {division.description || <span className="text-slate-400">—</span>}</span>
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => openEditDialog(division)}>
                                                            <Pencil />
                                                            Редактировать
                                                        </Button>
                                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(division)}>
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
                                        Показано {divisions?.from ?? 0}–{divisions?.to ?? 0} из {total}
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
                        title="По факультетам"
                        groups={parentGroups}
                        missingLabel="Без факультета"
                        missingCount={items.filter((item) => !item.faculty?.name).length}
                        totalShown={items.length}
                        completeness={[
                            { label: 'С кодом', count: items.filter((item) => item.code).length },
                            { label: 'С описанием', count: items.filter((item) => item.description).length },
                            { label: 'С привязкой', count: items.filter((item) => item.faculty?.name).length },
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
