import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

const statusMap = {
    new: { label: 'Новая', variant: 'default' },
    in_progress: { label: 'В работе', variant: 'secondary' },
    closed: { label: 'Закрыта', variant: 'outline' },
};

const getCsrfToken = () =>
    decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');

function StatusSelect({ ticketId, current }) {
    const [value, setValue] = useState(current);
    const [saving, setSaving] = useState(false);

    const handleChange = async (event) => {
        const newStatus = event.target.value;
        setSaving(true);
        try {
            const res = await fetch(`/admin/tickets/${ticketId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                setValue(newStatus);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <select
            className="rounded-md border px-2 py-1 text-xs"
            value={value}
            onChange={handleChange}
            disabled={saving}
        >
            <option value="new">Новая</option>
            <option value="in_progress">В работе</option>
            <option value="closed">Закрыта</option>
        </select>
    );
}

export default function AdminIndex({ tickets, departments = [], filters = {}, canFilterByDepartment = false }) {
    const items = tickets?.data ?? [];
    const links = tickets?.links ?? [];
    const selectedDepartment = filters?.department ?? '';

    const handleDepartmentChange = (event) => {
        router.get(route('tickets.admin'), {
            department: event.target.value,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Заявки" />

            <div className="p-4 sm:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Поступившие заявки</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {canFilterByDepartment && (
                            <div className="mb-4 flex items-center gap-3">
                                <label className="text-sm text-muted-foreground" htmlFor="department-filter">Подразделение</label>
                                <select
                                    id="department-filter"
                                    className="rounded-md border px-3 py-2 text-sm"
                                    value={selectedDepartment}
                                    onChange={handleDepartmentChange}
                                >
                                    <option value="">Все</option>
                                    {departments.map((department) => (
                                        <option key={department} value={department}>{department}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Пока нет поступивших заявок.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-3 pe-3 font-medium">ID</th>
                                            <th className="py-3 pe-3 font-medium">Тип</th>
                                            <th className="py-3 pe-3 font-medium">Локация</th>
                                            <th className="py-3 pe-3 font-medium">Контакт</th>
                                            <th className="py-3 pe-3 font-medium">Описание</th>
                                            <th className="py-3 pe-3 font-medium">Отправитель</th>
                                            <th className="py-3 pe-3 font-medium">Подразделение</th>
                                            <th className="py-3 pe-3 font-medium">Кто принял</th>
                                            <th className="py-3 pe-3 font-medium">Статус</th>
                                            <th className="py-3 pe-3 font-medium">Дата</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((ticket) => {
                                            return (
                                                <tr key={ticket.id} className="border-b last:border-0 align-top">
                                                    <td className="py-3 pe-3 font-medium">#{ticket.id}</td>
                                                    <td className="py-3 pe-3">{ticket.type}</td>
                                                    <td className="py-3 pe-3 text-muted-foreground">
                                                        {ticket.building}
                                                        {ticket.room ? `, каб. ${ticket.room}` : ''}
                                                    </td>
                                                    <td className="py-3 pe-3">{ticket.contact}</td>
                                                    <td className="max-w-md py-3 pe-3 text-muted-foreground">
                                                        {ticket.description}
                                                    </td>
                                                    <td className="py-3 pe-3 text-muted-foreground">
                                                        {ticket.submitted_by
                                                            ? `${ticket.submitted_by.full_name || ticket.submitted_by.name}${ticket.submitted_by.email ? ` (${ticket.submitted_by.email})` : ''}`
                                                            : 'Гость'}
                                                    </td>
                                                    <td className="py-3 pe-3 text-muted-foreground">
                                                        {ticket.submitted_by?.ad_department ?? '-'}
                                                    </td>
                                                    <td className="py-3 pe-3 text-muted-foreground">
                                                        {ticket.accepted_by
                                                            ? (ticket.accepted_by.display_name
                                                                || `${ticket.accepted_by.last_name ?? ''} ${ticket.accepted_by.first_name ?? ''}`.trim()
                                                                || ticket.accepted_by.name)
                                                            : '-'}
                                                    </td>
                                                    <td className="py-3 pe-3">
                                                        <StatusSelect ticketId={ticket.id} current={ticket.status} />
                                                    </td>
                                                    <td className="py-3 pe-3 text-muted-foreground">
                                                        {new Date(ticket.created_at).toLocaleString('ru-RU')}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {links.length > 3 && (
                            <div className="mt-6 flex flex-wrap gap-2">
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
            </div>
        </AuthenticatedLayout>
    );
}
