import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, PageHeader, StatusBadge, qdFieldClass } from '@/components/platform';
import { Award, Download, QrCode, Search } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';

const statusOptions = [
    { value: '', label: 'Все статусы' },
    { value: 'draft', label: 'Черновик' },
    { value: 'generated', label: 'Сгенерирован' },
    { value: 'issued', label: 'Выдан' },
    { value: 'revoked', label: 'Отозван' },
];

const statusLabel = {
    draft: 'Черновик',
    generated: 'Сгенерирован',
    issued: 'Выдан',
    revoked: 'Отозван',
};

const STATUS_TONES = {
    draft: 'default',
    generated: 'info',
    issued: 'success',
    revoked: 'danger',
};

export default function CertificatesRegistryPage() {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [registryLoading, setRegistryLoading] = useState(false);
    const [registry, setRegistry] = useState({
        data: [],
        meta: { current_page: 1, last_page: 1, total: 0 },
    });
    const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
    const [revokeTargetId, setRevokeTargetId] = useState(null);
    const [revokeReason, setRevokeReason] = useState('');
    const [qrDialogOpen, setQrDialogOpen] = useState(false);
    const [qrDialogData, setQrDialogData] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const pageCounts = registry.data.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
    }, {});

    const getCsrfToken = () =>
        decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');

    const loadRegistry = async (page = 1, nextQuery = query, nextStatus = status) => {
        setRegistryLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                per_page: '20',
            });

            if (nextQuery.trim() !== '') {
                params.set('q', nextQuery.trim());
            }

            if (nextStatus !== '') {
                params.set('status', nextStatus);
            }

            const response = await fetch(`${route('certificates.registry.index')}?${params.toString()}`, {
                headers: { Accept: 'application/json' },
                credentials: 'include',
            });

            const payload = await response.json();
            setRegistry({
                data: payload.data ?? [],
                meta: payload.meta ?? { current_page: 1, last_page: 1, total: 0 },
            });
        } finally {
            setRegistryLoading(false);
        }
    };

    useEffect(() => {
        loadRegistry(1, '', '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyFilters = () => {
        loadRegistry(1, query, status);
    };

    const exportCsv = () => {
        const params = new URLSearchParams();
        if (query.trim() !== '') {
            params.set('q', query.trim());
        }
        if (status !== '') {
            params.set('status', status);
        }

        const url = `${route('certificates.registry.export')}${params.toString() ? `?${params.toString()}` : ''}`;
        window.open(url, '_blank');
    };

    const issueCertificate = async (id) => {
        setActionLoading(true);

        const response = await fetch(route('certificates.issue', id), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'X-XSRF-TOKEN': getCsrfToken(),
            },
            credentials: 'include',
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            toast.error(payload.message ?? 'Не удалось обновить статус.');
            setActionLoading(false);
            return;
        }

        const payload = await response.json().catch(() => ({}));
        toast.success(payload.message ?? 'Статус обновлен.');
        await loadRegistry(registry.meta.current_page ?? 1);
        setActionLoading(false);
    };

    const openRevokeDialog = (id) => {
        setRevokeTargetId(id);
        setRevokeReason('');
        setRevokeDialogOpen(true);
    };

    const revokeCertificate = async () => {
        if (!revokeTargetId) {
            return;
        }

        setActionLoading(true);

        const response = await fetch(route('certificates.revoke', revokeTargetId), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': getCsrfToken(),
            },
            credentials: 'include',
            body: JSON.stringify({ reason: revokeReason }),
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            toast.error(payload.message ?? 'Не удалось отозвать сертификат.');
            setActionLoading(false);
            return;
        }

        const payload = await response.json().catch(() => ({}));
        toast.success(payload.message ?? 'Сертификат отозван.');
        setRevokeDialogOpen(false);
        setRevokeTargetId(null);
        setRevokeReason('');
        await loadRegistry(registry.meta.current_page ?? 1);
        setActionLoading(false);
    };

    const openQrDialog = (certificate) => {
        if (!certificate?.qr_payload) {
            toast.error('Для этого сертификата QR-ссылка отсутствует.');
            return;
        }

        setQrDialogData(certificate);
        setQrDialogOpen(true);
    };

    const downloadDialogQrPng = () => {
        if (!qrDialogData?.certificate_number) {
            return;
        }

        const canvas = document.getElementById('registry-qr-canvas');
        if (!(canvas instanceof HTMLCanvasElement)) {
            toast.error('Не удалось подготовить QR для скачивания.');
            return;
        }

        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = `${qrDialogData.certificate_number}-qr.png`;
        link.click();
    };

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    eyebrow="Сертификаты"
                    title="Реестр сертификатов"
                    description="Поиск, экспорт, выдача и отзыв сертификатов."
                    meta={<StatusBadge tone="info">Всего: {registry.meta.total ?? 0}</StatusBadge>}
                    actions={(
                        <>
                            <Button variant="outline" onClick={exportCsv} className="gap-2">
                                <Download className="h-4 w-4" />
                                Экспорт CSV
                            </Button>
                            <Button asChild className="gap-2">
                                <Link href={route('certificates.index')}>
                                    <Award className="h-4 w-4" />
                                    К генерации
                                </Link>
                            </Button>
                        </>
                    )}
                />
            }
        >
            <Head title="Реестр сертификатов" />

            <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Отозвать сертификат</DialogTitle>
                        <DialogDescription>
                            Сертификат станет недействительным. При необходимости укажите причину отзыва.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <label className="qd-field-label block">Причина</label>
                        <Textarea
                            className="min-h-24"
                            value={revokeReason}
                            onChange={(event) => setRevokeReason(event.target.value)}
                            placeholder="Например: ошибка в данных получателя"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setRevokeDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button type="button" variant="destructive" onClick={revokeCertificate} disabled={actionLoading}>
                            {actionLoading ? 'Сохранение...' : 'Отозвать'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>QR сертификата</DialogTitle>
                        <DialogDescription>
                            Номер: {qrDialogData?.certificate_number ?? '-'}
                        </DialogDescription>
                    </DialogHeader>

                    {qrDialogData?.qr_payload && (
                        <div className="space-y-3">
                            <div className="mx-auto w-max rounded-xl border border-slate-200 bg-white p-2">
                                <QRCodeCanvas
                                    id="registry-qr-canvas"
                                    value={qrDialogData.qr_payload}
                                    size={180}
                                    includeMargin
                                />
                            </div>
                            <div className="truncate rounded-[10px] bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">{qrDialogData.qr_payload}</div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={downloadDialogQrPng}>
                            Скачать PNG
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                                if (!qrDialogData?.qr_payload) {
                                    return;
                                }

                                try {
                                    await navigator.clipboard.writeText(qrDialogData.qr_payload);
                                    toast.success('QR-ссылка скопирована.');
                                } catch {
                                    toast.error('Не удалось скопировать ссылку.');
                                }
                            }}
                        >
                            Копировать ссылку
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="admin-page-wrap space-y-6">
                <Card className="overflow-hidden">
                    <form
                        className="grid items-end gap-3 border-b border-slate-200 px-5 py-4 sm:px-6 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_minmax(0,1fr)]"
                        onSubmit={(event) => {
                            event.preventDefault();
                            applyFilters();
                        }}
                    >
                        <label className="block space-y-2">
                            <span className="qd-field-label block">Поиск</span>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    className={cn(qdFieldClass, 'pl-9')}
                                    placeholder="Поиск по номеру, ФИО или теме"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                />
                            </div>
                        </label>
                        <label className="block space-y-2">
                            <span className="qd-field-label block">Статус</span>
                            <select
                                className={qdFieldClass}
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                            >
                                {statusOptions.map((option) => (
                                    <option key={option.value || 'all'} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="flex items-center gap-2">
                            <Button type="submit" disabled={registryLoading}>
                                {registryLoading ? 'Загрузка...' : 'Применить'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={registryLoading}
                                onClick={() => {
                                    setQuery('');
                                    setStatus('');
                                    loadRegistry(1, '', '');
                                }}
                            >
                                Сбросить
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 xl:h-10 xl:justify-end">
                            {Object.keys(pageCounts).length === 0 ? (
                                <span>На странице нет записей</span>
                            ) : (
                                Object.entries(pageCounts).map(([key, count]) => (
                                    <StatusBadge key={key} tone={STATUS_TONES[key] ?? 'default'}>
                                        {statusLabel[key] ?? key}: {count}
                                    </StatusBadge>
                                ))
                            )}
                        </div>
                    </form>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-left">
                                    <tr>
                                        <th>Номер</th>
                                        <th>ФИО</th>
                                        <th>Тема</th>
                                        <th>Шаблон</th>
                                        <th>Статус</th>
                                        <th>Сгенерирован</th>
                                        <th>Выдан</th>
                                        <th className="text-right">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {registry.data.length === 0 && (
                                        <tr>
                                            <td className="py-8 text-center text-slate-500" colSpan={8}>
                                                {registryLoading ? 'Загрузка...' : 'Записей пока нет'}
                                            </td>
                                        </tr>
                                    )}

                                    {registry.data.map((certificate) => (
                                        <tr key={certificate.id} className="hover:bg-slate-50">
                                            <td className="font-mono text-[0.8125rem] font-medium text-slate-900">{certificate.certificate_number}</td>
                                            <td className="font-medium text-slate-900">{certificate.recipient_full_name}</td>
                                            <td className="text-slate-700">{certificate.topic}</td>
                                            <td className="text-slate-500">
                                                <div>{certificate.template_name} {certificate.template_version ? `(v${certificate.template_version})` : ''}</div>
                                                {certificate.template_code ? <div className="font-mono text-xs text-slate-400">{certificate.template_code}</div> : null}
                                            </td>
                                            <td>
                                                <StatusBadge tone={STATUS_TONES[certificate.status] ?? 'default'}>
                                                    {statusLabel[certificate.status] ?? certificate.status}
                                                </StatusBadge>
                                            </td>
                                            <td className="tabular-nums text-slate-500">
                                                <div>{certificate.generated_at_human ?? '-'}</div>
                                                {certificate.creator_name ? <div className="text-xs text-slate-400">{certificate.creator_name}</div> : null}
                                            </td>
                                            <td className="tabular-nums text-slate-500">
                                                {certificate.issued_at_human ?? '-'}
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    {certificate.status === 'generated' && (
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() => issueCertificate(certificate.id)}
                                                            disabled={actionLoading}
                                                        >
                                                            Выдать
                                                        </Button>
                                                    )}
                                                    <Button asChild size="sm" variant="outline">
                                                        <Link href={route('certificates.show', certificate.id)}>
                                                            Открыть
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="gap-1.5"
                                                        onClick={() => openQrDialog(certificate)}
                                                    >
                                                        <QrCode className="h-3.5 w-3.5" />
                                                        QR
                                                    </Button>
                                                    {(certificate.status === 'generated' || certificate.status === 'issued') && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-red-700 hover:bg-red-50 hover:text-red-800"
                                                            onClick={() => openRevokeDialog(certificate.id)}
                                                            disabled={actionLoading}
                                                        >
                                                            Отозвать
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm sm:px-6">
                            <div className="tabular-nums text-slate-600">Всего: {registry.meta.total ?? 0}</div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={registryLoading || (registry.meta.current_page ?? 1) <= 1}
                                    onClick={() => loadRegistry((registry.meta.current_page ?? 1) - 1)}
                                >
                                    Назад
                                </Button>
                                <span className="tabular-nums text-slate-600">
                                    Стр. {registry.meta.current_page ?? 1} из {registry.meta.last_page ?? 1}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                        registryLoading ||
                                        (registry.meta.current_page ?? 1) >= (registry.meta.last_page ?? 1)
                                    }
                                    onClick={() => loadRegistry((registry.meta.current_page ?? 1) + 1)}
                                >
                                    Вперед
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
