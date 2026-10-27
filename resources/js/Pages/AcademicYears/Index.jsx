import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, EmptyState, PageHeader, StatGrid, StatTile } from '@/components/platform';
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
import { CalendarCheck, CalendarDays, CalendarRange, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function Index({ academicYears }) {
    const items = academicYears?.data ?? [];
    const links = academicYears?.links ?? [];
    const total = academicYears?.total ?? items.length;
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [createOpen, setCreateOpen] = useState(false);

    const activeYear = items.find((item) => item.is_active) ?? null;

    const form = useForm({
        start_year: '',
        end_year: '',
        is_active: false,
    });

    const submit = (e) => {
        e.preventDefault();

        form.post(route('academic-years.store'), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setCreateOpen(false);
            },
        });
    };

    const handleDelete = (item) => {
        setConfirmState({
            open: true,
            description: `Удалить учебный год ${item.name}?`,
            onConfirm: () => router.delete(route('academic-years.destroy', item.id)),
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Справочники"
                    title="Учебные годы"
                    description="Периоды обучения, к которым привязываются планы, отчёты и показатели. Активный год используется по умолчанию."
                    meta={activeYear ? <Badge variant="success">Активный: {activeYear.name}</Badge> : null}
                    actions={(
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus />
                                    Добавить учебный год
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Новый учебный год</DialogTitle>
                                    <DialogDescription>
                                        Укажите начальный и конечный год.
                                    </DialogDescription>
                                </DialogHeader>
                                <form className="space-y-4" onSubmit={submit}>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="block">Начальный год</Label>
                                            <Input
                                                type="number"
                                                value={form.data.start_year}
                                                onChange={(e) => form.setData('start_year', e.target.value)}
                                                placeholder="2025"
                                            />
                                            {form.errors.start_year && (
                                                <p className="text-sm text-red-700">{form.errors.start_year}</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="block">Конечный год</Label>
                                            <Input
                                                type="number"
                                                value={form.data.end_year}
                                                onChange={(e) => form.setData('end_year', e.target.value)}
                                                placeholder="2026"
                                            />
                                            {form.errors.end_year && (
                                                <p className="text-sm text-red-700">{form.errors.end_year}</p>
                                            )}
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2.5 border-t border-slate-200 pt-4 text-sm text-slate-700">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                                            checked={form.data.is_active}
                                            onChange={(e) => form.setData('is_active', e.target.checked)}
                                        />
                                        Сделать активным учебным годом
                                    </label>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
                                        <Button type="submit" disabled={form.processing}>
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
            <Head title="Учебные годы" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid className="xl:grid-cols-3">
                    <StatTile label="Учебных годов" value={total} icon={CalendarDays} tone="teal" hint="Во всём справочнике" />
                    <StatTile
                        label="Активный год"
                        value={activeYear ? activeYear.name : '—'}
                        icon={CalendarCheck}
                        tone={activeYear ? 'success' : 'warning'}
                        hint={activeYear ? 'Используется по умолчанию' : 'Среди показанных нет активного'}
                    />
                    <StatTile label="Неактивных" value={items.filter((item) => !item.is_active).length} icon={CalendarRange} tone="neutral" hint="Среди показанных" />
                </StatGrid>

                {items.length === 0 ? (
                    <EmptyState
                        title="Пока нет учебных годов"
                        description="Добавьте первый учебный год и отметьте его активным — он будет подставляться по умолчанию."
                        action={(
                            <Button onClick={() => setCreateOpen(true)}>
                                <Plus />
                                Добавить учебный год
                            </Button>
                        )}
                    />
                ) : (
                    <DataTable>
                        <table className="w-full min-w-[560px] text-sm">
                            <thead>
                                <tr>
                                    <th className="px-5 text-left">Период</th>
                                    <th className="px-5 text-left">Статус</th>
                                    <th className="px-5 text-right">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                        <td className="px-5 py-3.5 font-medium tabular-nums text-slate-900">{item.name}</td>
                                        <td className="px-5 py-3.5">
                                            {item.is_active ? (
                                                <Badge variant="success">Активный</Badge>
                                            ) : (
                                                <Badge variant="secondary">Неактивный</Badge>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <Button variant="destructive" size="sm" onClick={() => handleDelete(item)}>
                                                <Trash2 />
                                                Удалить
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </DataTable>
                )}

                {links.length > 3 && (
                    <div className="flex flex-wrap justify-end gap-1.5">
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
