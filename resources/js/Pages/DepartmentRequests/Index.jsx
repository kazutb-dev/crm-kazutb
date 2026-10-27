import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Notice, PageHeader, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    ArrowUpRight, Building2, CircleCheck, CircleX, ClipboardList, Inbox, Info, Loader, PlusCircle, Send,
} from 'lucide-react';
import { useState } from 'react';

const statusMeta = {
    new: { label: 'Новая', variant: 'info' },
    in_progress: { label: 'В работе', variant: 'warning' },
    resolved: { label: 'Решена', variant: 'success' },
    rejected: { label: 'Отклонена', variant: 'destructive' },
};

const HOW_IT_WORKS = [
    'Создайте заявку через кнопку «Отправить заявку».',
    'Отслеживайте статус: Новая, В работе, Решена, Отклонена.',
    'Читайте ответ исполнителя в карточке вашей заявки.',
];

const isCitDepartment = (department) => {
    if (!department) {
        return false;
    }

    const code = String(department.code ?? '').trim().toUpperCase();
    const name = String(department.name ?? '').trim().toLowerCase();

    return code === 'CIT' || name.includes('центр информационных технологий') || name.includes('цит');
};

export default function DepartmentRequestsIndex({ myRequests = [], departments = [] }) {
    const flash = usePage().props.flash ?? {};
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const form = useForm({
        title: '',
        description: '',
        room: '',
        department_id: '',
    });

    const selectedDepartment = departments.find((d) => String(d.id) === String(form.data.department_id));
    const isCitSelected = isCitDepartment(selectedDepartment);

    const countBy = (status) => myRequests.filter((req) => req.status === status).length;

    const submit = (e) => {
        e.preventDefault();
        form.post(route('dept-requests.store'), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setIsCreateOpen(false);
            },
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Обращения"
                    title="Заявки"
                    description="Ваши обращения и их статусы. Заявка сразу попадает в нужный отдел — так проблемы устраняются быстрее."
                    actions={(
                        <>
                            <Button variant="outline" asChild>
                                <Link href={route('dept-requests.departments')}>
                                    <Info />
                                    Отделы
                                </Link>
                            </Button>
                            <Button onClick={() => setIsCreateOpen(true)}>
                                <PlusCircle />
                                Отправить заявку
                            </Button>
                        </>
                    )}
                />
            )}
        >
            <Head title="Заявки" />

            <div className="admin-page-wrap space-y-6">
                {flash.success && <Notice tone="success">{flash.success}</Notice>}

                <StatGrid>
                    <StatTile label="Новые" value={countBy('new')} icon={Inbox} tone="info" hint="Ждут исполнителя" />
                    <StatTile label="В работе" value={countBy('in_progress')} icon={Loader} tone="warning" hint="Исполнитель взял заявку" />
                    <StatTile label="Решены" value={countBy('resolved')} icon={CircleCheck} tone="success" hint="Ответ — в таблице ниже" />
                    <StatTile label="Отклонены" value={countBy('rejected')} icon={CircleX} tone="danger" hint="С пояснением исполнителя" />
                </StatGrid>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <Card className="flex min-w-0 flex-col">
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardList className="shrink-0" />
                                Мои заявки
                            </CardTitle>
                            <span className="text-xs font-medium tabular-nums text-slate-500">
                                Всего: {myRequests.length}
                            </span>
                        </CardHeader>
                        {myRequests.length === 0 ? (
                            <CardContent className="flex flex-1 items-center justify-center">
                                <div className="flex flex-col items-center gap-2 py-8 text-center">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                        <Inbox className="h-5 w-5" />
                                    </span>
                                    <p className="font-semibold text-[#102945]">У вас пока нет заявок</p>
                                    <p className="max-w-md text-sm text-slate-600">
                                        Создайте первую заявку, чтобы отслеживать её статус и ответ в этом разделе.
                                    </p>
                                    <Button className="mt-2" onClick={() => setIsCreateOpen(true)}>
                                        <PlusCircle />
                                        Создать первую заявку
                                    </Button>
                                </div>
                            </CardContent>
                        ) : (
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr>
                                                <th className="text-left">Тема</th>
                                                <th className="text-left">Отдел</th>
                                                <th className="text-left">Дата отправки</th>
                                                <th className="text-left">Дата решения</th>
                                                <th className="text-left">Статус</th>
                                                <th className="text-left">Ответ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {myRequests.map((req) => {
                                                const meta = statusMeta[req.status] ?? { label: req.status, variant: 'secondary' };

                                                return (
                                                    <tr key={req.id} className="border-b border-slate-200 align-top last:border-0 hover:bg-slate-50">
                                                        <td>
                                                            <p className="font-medium text-slate-900">{req.title}</p>
                                                            {req.room && (
                                                                <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600">
                                                                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                                    Кабинет: {req.room}
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="text-slate-700">{req.department ?? '—'}</td>
                                                        <td className="whitespace-nowrap tabular-nums text-slate-700">{req.created_at ?? '—'}</td>
                                                        <td className="whitespace-nowrap tabular-nums text-slate-700">{req.closed_at ?? '—'}</td>
                                                        <td>
                                                            <Badge variant={meta.variant}>{meta.label}</Badge>
                                                        </td>
                                                        <td className="text-slate-700">
                                                            {req.note ? (
                                                                <div>
                                                                    <p>{req.note}</p>
                                                                    {req.closed_by && (
                                                                        <p className="mt-1 text-xs text-slate-500">Обработал: {req.closed_by}</p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Info className="shrink-0" />
                                    Как это работает
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <ol className="space-y-2.5">
                                    {HOW_IT_WORKS.map((step, index) => (
                                        <li key={step} className="flex items-start gap-3">
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                                                {index + 1}
                                            </span>
                                            <span className="text-sm leading-snug text-slate-700">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                                <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
                                    <p>
                                        <span className="qd-field-label block text-slate-500">Зачем нужны заявки</span>
                                        <span className="text-slate-700">Чтобы быстрее получать данные о проблемах, сразу направлять их в нужный отдел и оперативно устранять.</span>
                                    </p>
                                    <p>
                                        <span className="qd-field-label block text-slate-500">Как создать новую заявку</span>
                                        <span className="text-slate-700">Нажмите «Отправить заявку» и заполните форму.</span>
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="shrink-0" />
                                    Отделы
                                </CardTitle>
                                <span className="text-xs font-medium tabular-nums text-slate-500">{departments.length}</span>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {departments.length === 0 ? (
                                    <p className="text-sm text-slate-500">Отделы-получатели пока не настроены.</p>
                                ) : (
                                    <ul className="divide-y divide-slate-200 text-sm">
                                        {departments.map((d) => {
                                            const sent = myRequests.filter((req) => req.department === d.name).length;

                                            return (
                                                <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                                                    <span className="min-w-0 truncate text-slate-800">{d.name}</span>
                                                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                                                        {sent > 0 ? `заявок: ${sent}` : (d.code ?? '')}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                <Link
                                    href={route('dept-requests.departments')}
                                    className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 underline underline-offset-2 hover:text-[#102945]"
                                >
                                    Описание отделов
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Dialog
                    open={isCreateOpen}
                    onOpenChange={(open) => {
                        setIsCreateOpen(open);
                        if (!open) {
                            form.clearErrors();
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Send className="h-4 w-4 text-teal-700" />
                                Новая заявка
                            </DialogTitle>
                            <DialogDescription>
                                Заполните форму, чтобы обращение сразу попало в нужный отдел. Чем точнее описание, тем быстрее обработка.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={submit} className="space-y-5">
                            <div className="space-y-2">
                                <Label className="block">
                                    Тема <span className="text-red-600">*</span>
                                </Label>
                                <Input
                                    placeholder="Например: Не работает принтер на 3 этаже"
                                    value={form.data.title}
                                    onChange={(e) => form.setData('title', e.target.value)}
                                />
                                <p className="text-xs text-slate-500">Короткий заголовок, чтобы специалист сразу понял суть.</p>
                                {form.errors.title && (
                                    <p className="text-xs text-red-700">{form.errors.title}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="block">
                                    Отдел <span className="text-red-600">*</span>
                                </Label>
                                <select
                                    className={qdFieldClass}
                                    value={form.data.department_id}
                                    onChange={(e) => {
                                        const departmentId = e.target.value;
                                        form.setData('department_id', departmentId);

                                        const nextDepartment = departments.find((d) => String(d.id) === String(departmentId));
                                        if (!isCitDepartment(nextDepartment)) {
                                            form.setData('room', '');
                                        }
                                    }}
                                >
                                    <option value="">— Выберите отдел —</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500">Выберите команду, которая должна обработать запрос.</p>
                                {form.errors.department_id && (
                                    <p className="text-xs text-red-700">{form.errors.department_id}</p>
                                )}
                                <Notice tone="info" title="Подсказка по отделам">
                                    <p>1) ЦИТ: рабочие места, техника, сеть, принтеры, доступ к инфраструктуре.</p>
                                    <p>2) Центр ИИ и аналитики: баги, доработки и вопросы по цифровым сервисам.</p>
                                    <Link
                                        href={route('dept-requests.departments')}
                                        className="mt-1 inline-flex items-center gap-1 font-semibold text-teal-700 underline underline-offset-2 hover:text-[#102945]"
                                    >
                                        Полный список и описание отделов
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Link>
                                </Notice>
                            </div>

                            {isCitSelected && (
                                <div className="space-y-2">
                                    <Label className="block">
                                        Кабинет <span className="font-medium normal-case tracking-normal text-slate-400">(необязательно)</span>
                                    </Label>
                                    <Input
                                        placeholder="Например: 315"
                                        value={form.data.room}
                                        onChange={(e) => form.setData('room', e.target.value)}
                                    />
                                    <p className="text-xs text-slate-500">Поле доступно только для заявок в ЦИТ.</p>
                                    {form.errors.room && (
                                        <p className="text-xs text-red-700">{form.errors.room}</p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="block">
                                    Описание <span className="text-red-600">*</span>
                                </Label>
                                <Textarea
                                    className="min-h-28"
                                    placeholder="Что произошло, когда началось, как повторить проблему, что уже пробовали сделать"
                                    value={form.data.description}
                                    onChange={(e) => form.setData('description', e.target.value)}
                                />
                                <p className="text-xs text-slate-500">Детали помогают сократить время на уточнения и ускоряют решение.</p>
                                {form.errors.description && (
                                    <p className="text-xs text-red-700">{form.errors.description}</p>
                                )}
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                                    Отмена
                                </Button>
                                <Button type="submit" disabled={form.processing}>
                                    <Send />
                                    Отправить заявку
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AuthenticatedLayout>
    );
}
