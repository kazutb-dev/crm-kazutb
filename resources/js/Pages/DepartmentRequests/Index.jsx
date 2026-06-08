import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowUpRight, Building2, ClipboardList, Info, PlusCircle, Send } from 'lucide-react';
import { useState } from 'react';

const statusMeta = {
    new: {
        label: 'Новая',
        className: 'border-sky-200 bg-sky-50 text-sky-800',
        dotClass: 'bg-sky-500',
    },
    in_progress: {
        label: 'В работе',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        dotClass: 'bg-amber-500',
    },
    resolved: {
        label: 'Решена',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        dotClass: 'bg-emerald-500',
    },
    rejected: {
        label: 'Отклонена',
        className: 'border-rose-200 bg-rose-50 text-rose-800',
        dotClass: 'bg-rose-500',
    },
};

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
            header={
                <div>
                    <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                        Заявки
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Отслеживание ваших обращений и их статусов
                    </p>
                </div>
            }
        >
            <Head title="Заявки" />

            <div className="admin-page-wrap space-y-6">

                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <CardContent className="space-y-4 p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="max-w-2xl">
                                <h3 className="text-lg font-semibold text-slate-900">Лента ваших заявок</h3>
                                <p className="mt-1 text-sm text-slate-600">
                                    Здесь отображаются только ваши обращения и их текущий статус.
                                </p>
                            </div>
                            <Button className="rounded-xl bg-slate-900 hover:bg-slate-800" onClick={() => setIsCreateOpen(true)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Отправить заявку
                            </Button>
                        </div>

                        <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="font-semibold">Зачем нужны заявки</p>
                                <p>Чтобы быстрее получать данные о проблемах, сразу направлять их в нужный отдел и оперативно устранять.</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="font-semibold">Как создать новую заявку</p>
                                <p>Нажмите «Отправить заявку» и заполните форму.</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-semibold text-slate-900">Как это работает</p>
                            <div className="mt-2 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                                <div className="rounded-md bg-slate-50 px-3 py-2">
                                    <span className="font-semibold">1.</span> Создайте заявку через кнопку «Отправить заявку».
                                </div>
                                <div className="rounded-md bg-slate-50 px-3 py-2">
                                    <span className="font-semibold">2.</span> Отслеживайте статус: Новая, В работе, Решена, Отклонена.
                                </div>
                                <div className="rounded-md bg-slate-50 px-3 py-2">
                                    <span className="font-semibold">3.</span> Читайте ответ исполнителя в карточке вашей заявки.
                                </div>
                            </div>
                        </div>

                        {flash.success && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                {flash.success}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── My requests ── */}
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5" />
                            Мои заявки
                        </CardTitle>
                        <p className="text-sm text-slate-500">
                            Таблица обращений с датой отправки, датой решения, статусом и ответом.
                        </p>
                    </CardHeader>
                    <CardContent>
                        {myRequests.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                                <p className="text-sm font-medium text-slate-700">У вас пока нет заявок</p>
                                <p className="mt-1 text-xs text-slate-500">Создайте первую заявку, чтобы отслеживать её статус и ответ в этом разделе.</p>
                                <Button className="mt-4 rounded-xl bg-slate-900 hover:bg-slate-800" onClick={() => setIsCreateOpen(true)}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Создать первую заявку
                                </Button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                        <tr>
                                            <th className="px-4 py-3">Тема</th>
                                            <th className="px-4 py-3">Отдел</th>
                                            <th className="px-4 py-3">Дата отправки</th>
                                            <th className="px-4 py-3">Дата решения</th>
                                            <th className="px-4 py-3">Статус</th>
                                            <th className="px-4 py-3">Ответ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {myRequests.map((req) => {
                                            const meta = statusMeta[req.status] ?? {
                                                label: req.status,
                                                className: 'border-slate-200 bg-slate-50 text-slate-700',
                                                dotClass: 'bg-slate-400',
                                            };

                                            return (
                                                <tr key={req.id} className="align-top">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-slate-900">{req.title}</p>
                                                        {req.room && (
                                                            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                                                <Building2 className="h-3.5 w-3.5" />
                                                                Кабинет: {req.room}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700">{req.department ?? '—'}</td>
                                                    <td className="px-4 py-3 text-slate-700">{req.created_at ?? '—'}</td>
                                                    <td className="px-4 py-3 text-slate-700">{req.closed_at ?? '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${meta.className}`}>
                                                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
                                                            {meta.label}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700">
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
                        )}
                    </CardContent>
                </Card>

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
                                <Send className="h-4 w-4" />
                                Новая заявка
                            </DialogTitle>
                            <DialogDescription>
                                Заполните форму, чтобы обращение сразу попало в нужный отдел. Чем точнее описание, тем быстрее обработка.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium">
                                    Тема <span className="text-red-500">*</span>
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                                    placeholder="Например: Не работает принтер на 3 этаже"
                                    value={form.data.title}
                                    onChange={(e) => form.setData('title', e.target.value)}
                                />
                                <p className="mt-1 text-xs text-slate-500">Короткий заголовок, чтобы специалист сразу понял суть.</p>
                                {form.errors.title && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.title}</p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">
                                    Отдел <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
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
                                <p className="mt-1 text-xs text-slate-500">Выберите команду, которая должна обработать запрос.</p>
                                {form.errors.department_id && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.department_id}</p>
                                )}
                                <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                                    <p className="font-medium">Подсказка по отделам:</p>
                                    <p>1) ЦИТ: рабочие места, техника, сеть, принтеры, доступ к инфраструктуре.</p>
                                    <p>2) Центр ИИ и аналитики: баги, доработки и вопросы по цифровым сервисам.</p>
                                    <Link
                                        href={route('dept-requests.departments')}
                                        className="mt-1 inline-flex items-center gap-1 font-medium text-sky-700 underline"
                                    >
                                        <Info className="h-3.5 w-3.5" />
                                        Полный список и описание отделов
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            </div>

                            {isCitSelected && (
                                <div>
                                    <label className="mb-1 block text-sm font-medium">
                                        Кабинет (необязательно)
                                    </label>
                                    <input
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                                        placeholder="Например: 315"
                                        value={form.data.room}
                                        onChange={(e) => form.setData('room', e.target.value)}
                                    />
                                    <p className="mt-1 text-xs text-slate-500">Поле доступно только для заявок в ЦИТ.</p>
                                    {form.errors.room && (
                                        <p className="mt-1 text-xs text-red-600">{form.errors.room}</p>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="mb-1 block text-sm font-medium">
                                    Описание <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                                    placeholder="Что произошло, когда началось, как повторить проблему, что уже пробовали сделать"
                                    value={form.data.description}
                                    onChange={(e) => form.setData('description', e.target.value)}
                                />
                                <p className="mt-1 text-xs text-slate-500">Детали помогают сократить время на уточнения и ускоряют решение.</p>
                                {form.errors.description && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.description}</p>
                                )}
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                                    Отмена
                                </Button>
                                <Button type="submit" disabled={form.processing} className="rounded-xl bg-slate-900 hover:bg-slate-800">
                                    <Send className="mr-2 h-4 w-4" />
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
