import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Edit({ department }) {
    const { data, setData, patch, processing, errors } = useForm({
        name: department.name ?? '',
        code: department.code ?? '',
        description: department.description ?? '',
    });

    const submit = (e) => {
        e.preventDefault();
        patch(route('departments.update', department.id));
    };

    return (
        <AuthenticatedLayout
            header={<h2 className="text-2xl font-semibold tracking-tight">Редактирование кафедры</h2>}
        >
            <Head title="Редактирование кафедры" />

            <div className="p-4 sm:p-6 lg:p-8">
                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle>{department.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-5" onSubmit={submit}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Название</label>
                                <Input
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                />
                                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Код</label>
                                <Input
                                    value={data.code}
                                    onChange={(e) => setData('code', e.target.value)}
                                />
                                {errors.code && <p className="text-sm text-destructive">{errors.code}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Описание</label>
                                <textarea
                                    className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                />
                                {errors.description && (
                                    <p className="text-sm text-destructive">{errors.description}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <Button type="submit" disabled={processing}>
                                    Сохранить изменения
                                </Button>
                                <Button variant="outline" asChild>
                                    <Link href={route('departments.index')}>Отмена</Link>
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
