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
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function Index({ academicYears }) {
    const items = academicYears?.data ?? [];
    const links = academicYears?.links ?? [];
    const [createOpen, setCreateOpen] = useState(false);

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
        if (!window.confirm(`Удалить учебный год ${item.name}?`)) {
            return;
        }

        router.delete(route('academic-years.destroy', item.id));
    };

    return (
        <AuthenticatedLayout
            headerRight={
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
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
                                    <label className="text-sm font-medium">Начальный год</label>
                                    <Input
                                        type="number"
                                        value={form.data.start_year}
                                        onChange={(e) =>
                                            form.setData('start_year', e.target.value)
                                        }
                                        placeholder="2025"
                                    />
                                    {form.errors.start_year && (
                                        <p className="text-sm text-destructive">
                                            {form.errors.start_year}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Конечный год</label>
                                    <Input
                                        type="number"
                                        value={form.data.end_year}
                                        onChange={(e) =>
                                            form.setData('end_year', e.target.value)
                                        }
                                        placeholder="2026"
                                    />
                                    {form.errors.end_year && (
                                        <p className="text-sm text-destructive">
                                            {form.errors.end_year}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.data.is_active}
                                    onChange={(e) =>
                                        form.setData('is_active', e.target.checked)
                                    }
                                />
                                Сделать активным учебным годом
                            </label>
                            <DialogFooter>
                                <Button type="submit" disabled={form.processing}>
                                    Сохранить
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            }
        >
            <Head title="Учебные годы" />

            <div className="admin-page-wrap">
                <Card className="admin-surface">
                    <CardHeader>
                        <CardTitle>Список учебных годов</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <div className="admin-empty-state">
                                Пока нет учебных годов.
                            </div>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-data-table min-w-[560px]">
                                    <thead>
                                        <tr>
                                            <th>Период</th>
                                            <th>Статус</th>
                                            <th className="text-right">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.id}>
                                                <td className="py-3 pe-3 font-medium">{item.name}</td>
                                                <td className="py-3 pe-3">
                                                    {item.is_active ? (
                                                        <Badge>Активный</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Неактивный</Badge>
                                                    )}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDelete(item)}
                                                    >
                                                        <Trash2 />
                                                        Удалить
                                                    </Button>
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
        </AuthenticatedLayout>
    );
}
