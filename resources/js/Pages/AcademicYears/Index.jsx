import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader, StatGrid, StatTile } from '@/components/platform';
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
import { CalendarCheck, CalendarDays, CalendarRange, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

const PHASE_LABEL = { past: 'Прошедший', current: 'Текущий', future: 'Будущий', unknown: 'Период' };

// The academic year starts in September: before it, the current year is the previous one.
const today = new Date();
const currentStart = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;

function yearPhase(item) {
    const start = Number(item.start_year ?? String(item.name ?? '').slice(0, 4));
    if (!Number.isFinite(start) || start === 0) {
        return 'unknown';
    }
    if (start === currentStart) {
        return 'current';
    }
    return start < currentStart ? 'past' : 'future';
}

export default function Index({ academicYears }) {
    const items = academicYears?.data ?? [];
    const links = academicYears?.links ?? [];
    const total = academicYears?.total ?? items.length;
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [createOpen, setCreateOpen] = useState(false);

    const activeYear = items.find((item) => item.is_active) ?? null;
    const phaseCounts = items.reduce((acc, item) => {
        const phase = yearPhase(item);
        acc[phase] = (acc[phase] ?? 0) + 1;
        return acc;
    }, { past: 0, current: 0, future: 0 });

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

            <div className="admin-page-wrap space-y-4">
                <StatGrid>
                    <StatTile label="Учебных годов" value={total} icon={CalendarDays} tone="teal" hint="Во всём справочнике" />
                    <StatTile
                        label="Активный год"
                        value={activeYear ? activeYear.name : '—'}
                        icon={CalendarCheck}
                        tone={activeYear ? 'success' : 'warning'}
                        hint={activeYear ? 'Используется по умолчанию' : 'Среди показанных нет активного'}
                    />
                    <StatTile label="Неактивных" value={items.filter((item) => !item.is_active).length} icon={CalendarRange} tone="neutral" hint="Среди показанных" />
                    <StatTile
                        label="Текущий по календарю"
                        value={`${currentStart}/${currentStart + 1}`}
                        icon={CalendarDays}
                        tone="info"
                        hint={items.some((item) => yearPhase(item) === 'current') ? 'Есть в справочнике' : 'Не найден среди показанных'}
                    />
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
                    <Card className="overflow-hidden">
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle>Периоды · <span className="tabular-nums">{items.length}</span></CardTitle>
                            <span className="text-xs font-medium leading-none text-slate-500">
                                Сейчас идёт {currentStart}/{currentStart + 1} · прошедших {phaseCounts.past} · текущий {phaseCounts.current} · будущих {phaseCounts.future}
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                                {items.map((item) => {
                                    const phase = yearPhase(item);
                                    return (
                                        <div
                                            key={item.id}
                                            className={`flex flex-col gap-2 rounded-xl border px-3.5 py-3 ${item.is_active ? 'border-emerald-300 bg-emerald-50/60' : phase === 'current' ? 'border-teal-300 bg-white' : 'border-slate-200 bg-white'}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-lg font-bold tabular-nums leading-none text-[#102945]">{item.name}</span>
                                                {item.is_active ? (
                                                    <Badge variant="success">Активный</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Неактивный</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`text-xs ${phase === 'current' ? 'font-semibold text-teal-700' : 'text-slate-500'}`}>
                                                    {PHASE_LABEL[phase]}
                                                </span>
                                                <Button variant="ghost" size="sm" className="h-7 px-2 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => handleDelete(item)}>
                                                    <Trash2 />
                                                    Удалить
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                        <CardContent className="p-0">
                            {links.length > 3 && (
                                <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-3 sm:px-6 justify-end">
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
                        </CardContent>
                    </Card>
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
