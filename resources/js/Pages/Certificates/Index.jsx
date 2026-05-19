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
} from '@/components/ui/dialog';
import { Head, Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
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

/**
 * Parse FIO names from a semicolon-delimited CSV (like Книга1.csv).
 * Rules:
 *  - Only rows where column 0 (index 0) contains a number are treated as main entries.
 *  - The FIO is everything in column 2 before the " – " (or " - ") separator.
 *  - A cell may contain multiple authors separated by semicolons (inside quotes).
 *  - If the name part (before the dash) contains a comma between what looks like
 *    two abbreviated names (e.g. "Иванов А.А., Петров Б.Б."), each is emitted separately.
 */
function parseCsvFio(text) {
    const result = [];
    const lines = text.split(/\r?\n/);

    for (const rawLine of lines) {
        if (!rawLine.trim()) continue;

        // Naive semicolon CSV split that respects one level of double-quotes
        const cols = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < rawLine.length; i++) {
            const ch = rawLine[i];
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ';' && !inQ) { cols.push(cur); cur = ''; }
            else { cur += ch; }
        }
        cols.push(cur);

        const col0 = (cols[0] ?? '').trim();
        if (!col0 || !/^\d+$/.test(col0)) continue; // skip header / advisor rows

        // Take the full 3rd column as-is (strip surrounding quotes if present)
        const rawCell = (cols[2] ?? '').replace(/^"(.*)"$/s, '$1').trim();
        if (!rawCell) continue;

        result.push(rawCell);
    }

    return result;
}

export default function CertificatesIndex({ templates = [] }) {
    const [number, setNumber] = useState('');
    const [result, setResult] = useState(null);
    const [verifyLoading, setVerifyLoading] = useState(false);

    const [generateFullName, setGenerateFullName] = useState('');
    const [generateTopic, setGenerateTopic] = useState('');
    const [selectedTemplateVersionId, setSelectedTemplateVersionId] = useState(
        templates[0]?.id ? String(templates[0].id) : '',
    );
    const [generatedInfo, setGeneratedInfo] = useState(null);

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

    // --- Bulk CSV import state ---
    const [csvText, setCsvText] = useState('');
    const [csvParsed, setCsvParsed] = useState(/** @type {string[]} */ ([]));
    const [bulkTopic, setBulkTopic] = useState('');
    const [bulkTemplateVersionId, setBulkTemplateVersionId] = useState(
        templates[0]?.id ? String(templates[0].id) : '',
    );
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);
    const csvFileRef = useRef(null);

    const getCsrfToken = () =>
        decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');

    const loadRegistry = async (page = 1, nextQuery = query, nextStatus = status) => {
        setRegistryLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                per_page: '10',
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

    const verify = async () => {
        const value = number.trim();
        if (value === '') {
            return;
        }

        setVerifyLoading(true);
        setResult(null);

        try {
            const response = await fetch(route('certificates.verify', value), {
                headers: {
                    Accept: 'application/json',
                },
                credentials: 'include',
            });

            const payload = await response.json();
            setResult(payload);
        } catch (error) {
            setResult({
                valid: false,
                status: 'error',
                message: 'Ошибка запроса проверки сертификата.',
            });
        } finally {
            setVerifyLoading(false);
        }
    };

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

    const generateCertificate = async () => {
        if (generateFullName.trim() === '' || generateTopic.trim() === '') {
            toast.error('Заполните ФИО и тему сертификата.');
            return;
        }

        setActionLoading(true);

        const payload = {
            recipient_full_name: generateFullName.trim(),
            topic: generateTopic.trim(),
            template_version_id: selectedTemplateVersionId ? Number(selectedTemplateVersionId) : null,
        };

        const response = await fetch(route('certificates.generate'), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': getCsrfToken(),
            },
            credentials: 'include',
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            toast.error(data.message ?? 'Не удалось сгенерировать сертификат.');
            setActionLoading(false);
            return;
        }

        const data = await response.json();
        setGeneratedInfo(data.certificate ?? null);
        setGenerateFullName('');
        setGenerateTopic('');
        toast.success(data.message ?? 'Сертификат сгенерирован.');
        await loadRegistry(1, query, status);
        setActionLoading(false);
    };

    // --- Bulk CSV helpers ---
    const handleCsvFile = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result ?? '';
            setCsvText(text);
            setCsvParsed([]);
            setBulkResult(null);
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleParseCsv = () => {
        if (!csvText.trim()) {
            toast.error('Вставьте или загрузите CSV-данные.');
            return;
        }
        const names = parseCsvFio(csvText);
        if (names.length === 0) {
            toast.error('Имена не найдены. Проверьте формат CSV.');
            return;
        }
        setCsvParsed(names);
        setBulkResult(null);
        toast.success(`Найдено ${names.length} имён.`);
    };

    const removeParsedName = (index) => {
        setCsvParsed((prev) => prev.filter((_, i) => i !== index));
    };

    const editParsedName = (index, value) => {
        setCsvParsed((prev) => prev.map((n, i) => (i === index ? value : n)));
    };

    const bulkGenerateCertificates = async () => {
        if (csvParsed.length === 0) {
            toast.error('Сначала распознайте имена из CSV.');
            return;
        }
        if (!bulkTopic.trim()) {
            toast.error('Укажите тему сертификата.');
            return;
        }

        setBulkLoading(true);
        setBulkResult(null);

        const payload = {
            recipients: csvParsed.filter((n) => n.trim() !== ''),
            topic: bulkTopic.trim(),
            template_version_id: bulkTemplateVersionId ? Number(bulkTemplateVersionId) : null,
        };

        try {
            const response = await fetch(route('certificates.bulk-generate'), {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                toast.error(data.message ?? 'Ошибка генерации.');
                setBulkLoading(false);
                return;
            }

            setBulkResult(data);
            toast.success(data.message ?? `Сгенерировано: ${data.count}`);
            await loadRegistry(1, query, status);
        } catch {
            toast.error('Ошибка соединения.');
        } finally {
            setBulkLoading(false);
        }
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

    const downloadQrPng = () => {
        if (!generatedInfo?.qr_payload) {
            toast.error('Сначала сгенерируйте сертификат.');
            return;
        }

        const canvas = document.getElementById('generated-qr-canvas');
        if (!(canvas instanceof HTMLCanvasElement)) {
            toast.error('Не удалось подготовить QR для скачивания.');
            return;
        }

        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = `${generatedInfo.certificate_number || 'certificate'}-qr.png`;
        link.click();
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
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                            Сертификаты
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Управление сертификатами
                        </p>
                    </div>
                </div>
            }
        >
            <Head title="Сертификаты" />

            <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Отозвать сертификат</DialogTitle>
                        <DialogDescription>
                            Сертификат станет недействительным. При необходимости укажите причину отзыва.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Причина</label>
                        <textarea
                            className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                            value={revokeReason}
                            onChange={(event) => setRevokeReason(event.target.value)}
                            placeholder="Например: ошибка в данных получателя"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setRevokeDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button type="button" onClick={revokeCertificate} disabled={actionLoading}>
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
                            <div className="mx-auto w-max rounded-md border bg-white p-2">
                                <QRCodeCanvas
                                    id="registry-qr-canvas"
                                    value={qrDialogData.qr_payload}
                                    size={180}
                                    includeMargin
                                />
                            </div>
                            <div className="truncate text-xs text-muted-foreground">{qrDialogData.qr_payload}</div>
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

            <div className="admin-shell-container space-y-6 px-3 pb-5 pt-2 sm:px-4 sm:pb-6 sm:pt-3 lg:px-5">
                <Card>
                    <CardHeader>
                        <CardTitle>Генерация сертификата</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                            <input
                                className="h-10 w-full rounded-md border px-3"
                                placeholder="ФИО получателя"
                                value={generateFullName}
                                onChange={(event) => setGenerateFullName(event.target.value)}
                            />
                            <input
                                className="h-10 w-full rounded-md border px-3"
                                placeholder="Тема сертификата"
                                value={generateTopic}
                                onChange={(event) => setGenerateTopic(event.target.value)}
                            />
                            <select
                                className="h-10 w-full rounded-md border px-3"
                                value={selectedTemplateVersionId}
                                onChange={(event) => setSelectedTemplateVersionId(event.target.value)}
                            >
                                <option value="">Авто (последний опубликованный)</option>
                                {templates.map((template) => (
                                    <option key={template.id} value={template.id}>
                                        {template.template_name} ({template.template_code}) v{template.version}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                                Номер сертификата и ссылка на страницу сертификата формируются автоматически.
                            </p>
                            <Button onClick={generateCertificate} disabled={actionLoading}>
                                {actionLoading ? 'Генерация...' : 'Сгенерировать'}
                            </Button>
                        </div>

                        {generatedInfo && (
                            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                                <div className="mb-2">Номер: {generatedInfo.certificate_number}</div>
                                <div className="mb-3 truncate">
                                    Ссылка на сертификат:{' '}
                                    <a
                                        href={generatedInfo.qr_payload}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium underline underline-offset-2"
                                    >
                                        {generatedInfo.qr_payload}
                                    </a>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="rounded-md bg-white p-2">
                                        <QRCodeCanvas
                                            id="generated-qr-canvas"
                                            value={generatedInfo.qr_payload}
                                            size={140}
                                            includeMargin
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={downloadQrPng}
                                        >
                                            Скачать QR (PNG)
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => window.open(generatedInfo.qr_payload, '_blank', 'noopener,noreferrer')}
                                        >
                                            Открыть ссылку
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                                try {
                                                    await navigator.clipboard.writeText(generatedInfo.qr_payload);
                                                    toast.success('Ссылка скопирована.');
                                                } catch {
                                                    toast.error('Не удалось скопировать ссылку.');
                                                }
                                            }}
                                        >
                                            Копировать ссылку
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Bulk CSV import ────────────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Массовая генерация из CSV</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            Загрузите CSV-файл (разделитель «;») или вставьте его содержимое.
                            Кнопка «Распознать» извлечёт ФИО из 3-го столбца — строки
                            с номером статьи. Проверьте список и нажмите «Сгенерировать».
                        </p>

                        {/* File / paste */}
                        <div className="flex flex-wrap gap-3">
                            <input
                                ref={csvFileRef}
                                type="file"
                                accept=".csv,text/csv,text/plain"
                                className="hidden"
                                onChange={handleCsvFile}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => csvFileRef.current?.click()}
                            >
                                Загрузить CSV-файл
                            </Button>
                            <span className="self-center text-xs text-muted-foreground">или вставьте текст ниже</span>
                        </div>

                        <textarea
                            className="min-h-32 w-full rounded-md border px-3 py-2 font-mono text-xs"
                            placeholder="Вставьте содержимое CSV сюда…"
                            value={csvText}
                            onChange={(e) => { setCsvText(e.target.value); setCsvParsed([]); setBulkResult(null); }}
                        />

                        <Button type="button" onClick={handleParseCsv} variant="outline">
                            Распознать ФИО из CSV
                        </Button>

                        {/* Editable preview */}
                        {csvParsed.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium">
                                    Найдено получателей: {csvParsed.length}
                                </p>
                                <div className="max-h-72 overflow-y-auto rounded-md border">
                                    <table className="min-w-full text-sm">
                                        <thead className="sticky top-0 bg-muted/40">
                                            <tr>
                                                <th className="px-3 py-2 text-left">#</th>
                                                <th className="px-3 py-2 text-left">ФИО получателя</th>
                                                <th className="px-3 py-2" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {csvParsed.map((name, idx) => (
                                                <tr key={idx} className="border-t">
                                                    <td className="px-3 py-1 text-muted-foreground">{idx + 1}</td>
                                                    <td className="px-3 py-1">
                                                        <input
                                                            className="w-full rounded border px-2 py-0.5 text-sm"
                                                            value={name}
                                                            onChange={(e) => editParsedName(idx, e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeParsedName(idx)}
                                                            className="text-xs text-red-500 hover:underline"
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Topic + template + generate */}
                                <div className="grid gap-3 pt-2 md:grid-cols-3">
                                    <input
                                        className="h-10 w-full rounded-md border px-3"
                                        placeholder="Тема сертификата (одна для всех)"
                                        value={bulkTopic}
                                        onChange={(e) => setBulkTopic(e.target.value)}
                                    />
                                    <select
                                        className="h-10 w-full rounded-md border px-3"
                                        value={bulkTemplateVersionId}
                                        onChange={(e) => setBulkTemplateVersionId(e.target.value)}
                                    >
                                        <option value="">Авто (последний опубликованный)</option>
                                        {templates.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.template_name} ({t.template_code}) v{t.version}
                                            </option>
                                        ))}
                                    </select>
                                    <Button
                                        type="button"
                                        disabled={bulkLoading}
                                        onClick={bulkGenerateCertificates}
                                    >
                                        {bulkLoading
                                            ? `Генерация ${csvParsed.length} серт…`
                                            : `Сгенерировать (${csvParsed.length})`}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Result summary */}
                        {bulkResult && (
                            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                                <p className="font-semibold">{bulkResult.message}</p>
                                <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5">
                                    {(bulkResult.certificates ?? []).map((c) => (
                                        <div key={c.id} className="flex gap-2 text-xs">
                                            <span className="font-mono">{c.certificate_number}</span>
                                            <span>—</span>
                                            <span>{c.recipient_full_name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Реестр сертификатов</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-4">
                            <input
                                className="h-10 w-full rounded-md border px-3 md:col-span-2"
                                placeholder="Поиск по номеру, ФИО или теме"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                            <select
                                className="h-10 w-full rounded-md border px-3"
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                            >
                                {statusOptions.map((option) => (
                                    <option key={option.value || 'all'} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <Button onClick={applyFilters} disabled={registryLoading}>
                                {registryLoading ? 'Загрузка...' : 'Применить'}
                            </Button>
                        </div>

                        <div className="flex justify-end">
                            <Button size="sm" variant="outline" onClick={exportCsv}>
                                Экспорт CSV
                            </Button>
                        </div>

                        <div className="overflow-x-auto rounded-md border">
                            <table className="min-w-full text-sm">
                                <thead className="bg-muted/40 text-left">
                                    <tr>
                                        <th className="px-3 py-2">Номер</th>
                                        <th className="px-3 py-2">ФИО</th>
                                        <th className="px-3 py-2">Тема</th>
                                        <th className="px-3 py-2">Шаблон</th>
                                        <th className="px-3 py-2">Статус</th>
                                        <th className="px-3 py-2">Выдан</th>
                                        <th className="px-3 py-2">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {registry.data.length === 0 && (
                                        <tr>
                                            <td className="px-3 py-4 text-muted-foreground" colSpan={7}>
                                                {registryLoading ? 'Загрузка...' : 'Записей пока нет'}
                                            </td>
                                        </tr>
                                    )}

                                    {registry.data.map((certificate) => (
                                        <tr key={certificate.id} className="border-t">
                                            <td className="px-3 py-2 font-medium">{certificate.certificate_number}</td>
                                            <td className="px-3 py-2">{certificate.recipient_full_name}</td>
                                            <td className="px-3 py-2">{certificate.topic}</td>
                                            <td className="px-3 py-2 text-muted-foreground">
                                                {certificate.template_name} {certificate.template_version ? `(v${certificate.template_version})` : ''}
                                            </td>
                                            <td className="px-3 py-2">
                                                <Badge variant="outline">{statusLabel[certificate.status] ?? certificate.status}</Badge>
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground">
                                                {certificate.issued_at_human ?? '-'}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {certificate.status === 'generated' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => issueCertificate(certificate.id)}
                                                            disabled={actionLoading}
                                                        >
                                                            Выдать
                                                        </Button>
                                                    )}
                                                    <Button
                                                        asChild
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        <Link href={route('certificates.show', certificate.id)}>
                                                            Открыть
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openQrDialog(certificate)}
                                                    >
                                                        QR
                                                    </Button>
                                                    {(certificate.status === 'generated' || certificate.status === 'issued') && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
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

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                            <div className="text-muted-foreground">Всего: {registry.meta.total ?? 0}</div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={registryLoading || (registry.meta.current_page ?? 1) <= 1}
                                    onClick={() => loadRegistry((registry.meta.current_page ?? 1) - 1)}
                                >
                                    Назад
                                </Button>
                                <span className="text-muted-foreground">
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

                <Card>
                    <CardHeader>
                        <CardTitle>Проверка по номеру</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <input
                                className="h-10 w-full rounded-md border px-3"
                                placeholder="Например: CERT-2026-0001"
                                value={number}
                                onChange={(event) => setNumber(event.target.value)}
                            />
                            <Button onClick={verify} disabled={verifyLoading}>
                                {verifyLoading ? 'Проверка...' : 'Проверить'}
                            </Button>
                        </div>

                        {result && (
                            <div className="rounded-md border p-3 text-sm">
                                <div className="font-medium">Статус: {statusLabel[result.status] ?? result.status ?? 'unknown'}</div>
                                {result.message && <div className="mt-1 text-muted-foreground">{result.message}</div>}
                                {result.certificate && (
                                    <div className="mt-2 space-y-1 text-muted-foreground">
                                        <div>ФИО: {result.certificate.full_name}</div>
                                        <div>Тема: {result.certificate.topic}</div>
                                        <div>Номер: {result.certificate.number}</div>
                                        <div>Выдан: {result.certificate.issued_at ?? '-'}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
