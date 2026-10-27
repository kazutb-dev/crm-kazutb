import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FormField, PageHeader } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Building2 } from 'lucide-react';

export default function Create() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        code: '',
        description: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('departments.store'));
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Справочники · Кафедры"
                    title="Новая кафедра"
                    description="Заполните название, код и краткое описание — кафедра появится в справочнике."
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
            <Head title="Новая кафедра" />

            <div className="admin-page-wrap">
                <Card className="max-w-3xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="shrink-0" />
                            Создание кафедры
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-5" onSubmit={submit}>
                            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_200px]">
                                <div>
                                    <FormField label="Название">
                                        <Input
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            placeholder="Например: Кафедра информатики"
                                        />
                                    </FormField>
                                    {errors.name && <p className="mt-1.5 text-sm text-red-700">{errors.name}</p>}
                                </div>
                                <div>
                                    <FormField label="Код">
                                        <Input
                                            value={data.code}
                                            onChange={(e) => setData('code', e.target.value)}
                                            placeholder="Например: CS"
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
                                        placeholder="Краткое описание кафедры"
                                    />
                                </FormField>
                                {errors.description && <p className="mt-1.5 text-sm text-red-700">{errors.description}</p>}
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-5">
                                <Button variant="outline" asChild>
                                    <Link href={route('departments.index')}>Отмена</Link>
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    Сохранить
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
