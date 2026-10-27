import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FormField, PageHeader } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Pencil } from 'lucide-react';

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
            header={(
                <PageHeader
                    eyebrow="Справочники · Кафедры"
                    title="Редактирование кафедры"
                    description={department.name}
                    meta={department.code ? <Badge variant="outline">{department.code}</Badge> : null}
                    actions={(
                        <Button variant="outline" asChild>
                            <Link href={route('departments.index')}>
                                <ArrowLeft />
                                К списку кафедр
                            </Link>
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Редактирование кафедры" />

            <div className="admin-page-wrap">
                <Card className="max-w-3xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Pencil className="shrink-0" />
                            {department.name}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={submit}>
                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
                                <div>
                                    <FormField label="Название">
                                        <Input
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                        />
                                    </FormField>
                                    {errors.name && <p className="mt-1.5 text-sm text-red-700">{errors.name}</p>}
                                </div>
                                <div>
                                    <FormField label="Код">
                                        <Input
                                            value={data.code}
                                            onChange={(e) => setData('code', e.target.value)}
                                        />
                                    </FormField>
                                    {errors.code && <p className="mt-1.5 text-sm text-red-700">{errors.code}</p>}
                                </div>
                            </div>

                            <div>
                                <FormField label="Описание">
                                    <Textarea
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                    />
                                </FormField>
                                {errors.description && <p className="mt-1.5 text-sm text-red-700">{errors.description}</p>}
                            </div>

                            <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                                <Button variant="outline" asChild>
                                    <Link href={route('departments.index')}>Отмена</Link>
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    Сохранить изменения
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
