import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { formatStructuralUnitLabel } from '@/utils/kpi-structure-label';

const entityLabels = {
    teacher: 'ППС',
    department_head: 'Зав. кафедрой',
    dean: 'Декан',
    structural_division: 'Структурное подразделение',
};

export default function StructuralUnitShow() {
    const { unit, staffOptions = [] } = usePage().props;
    const addForm = useForm({ user_id: '' });

    const submitAddEmployee = (event) => {
        event.preventDefault();

        addForm.post(route('kpi.structural-units.users.attach', unit.id), {
            preserveScroll: true,
            onSuccess: () => addForm.reset(),
        });
    };

    const removeEmployee = (userId) => {
        router.delete(route('kpi.structural-units.users.detach', [unit.id, userId]), {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Структура ${formatStructuralUnitLabel(unit)}`} />

            <div className="space-y-4 p-4 sm:p-6 lg:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold">{formatStructuralUnitLabel(unit)}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Код: {unit.code}
                        </p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href={route('kpi.structural-units.index')}>Назад к списку</Link>
                    </Button>
                </div>

                <Card className="border-border/80 bg-white/90 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-[#132844]">Информация о подразделении</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            {unit.description || 'Описание отсутствует'}
                        </p>
                    </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between text-base text-[#132844]">
                                <span>Ответственные сотрудники</span>
                                <Badge variant="outline">{unit.users?.length || 0}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form className="mb-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitAddEmployee}>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                    value={addForm.data.user_id}
                                    onChange={(event) => addForm.setData('user_id', event.target.value)}
                                >
                                    <option value="">Выберите сотрудника</option>
                                    {staffOptions.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.name}{user.email ? ` (${user.email})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <Button type="submit" disabled={addForm.processing || !addForm.data.user_id}>
                                    Добавить
                                </Button>
                            </form>
                            {addForm.errors.user_id && (
                                <p className="mb-3 text-sm text-destructive">{addForm.errors.user_id}</p>
                            )}

                            {Array.isArray(unit.users) && unit.users.length > 0 ? (
                                <div className="space-y-2">
                                    {unit.users.map((user) => (
                                        <div
                                            key={user.id}
                                            className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background p-3"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{user.name}</p>
                                                <p className="text-xs text-muted-foreground">{user.role_label || 'Без роли'}</p>
                                                <p className="text-xs text-muted-foreground">{user.email || 'Email не указан'}</p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeEmployee(user.id)}
                                            >
                                                Убрать
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Сотрудники не привязаны к этому подразделению.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-white/90 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between text-base text-[#132844]">
                                <span>Привязанные записи</span>
                                <Badge variant="secondary">{unit.records?.length || 0}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {Array.isArray(unit.records) && unit.records.length > 0 ? (
                                <div className="space-y-2">
                                    {unit.records.map((record) => (
                                        <div
                                            key={record.id}
                                            className="rounded-md border border-border/60 bg-background p-3"
                                        >
                                            <p className="text-sm font-semibold text-foreground">
                                                {formatStructuralUnitLabel(record)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Тип: {entityLabels[record.entity_type] || record.entity_type || 'Не указан'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Записи не привязаны к этому подразделению.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
