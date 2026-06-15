import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import {
    createPreviewTextStyle,
    downloadCanvasAsPdf,
    escapeFilenamePart,
    renderCertificateCanvas,
} from './rendering';

const inputClassName = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200';
const panelClassName = 'rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4';
const waitForPaint = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
});
const layoutFieldLabels = {
    fio: 'ФИО',
};

function parseCsvFio(text) {
    const result = [];
    const lines = text.split(/\r?\n/);

    for (const rawLine of lines) {
        if (!rawLine.trim()) continue;

        const cols = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < rawLine.length; i++) {
            const ch = rawLine[i];
            if (ch === '"') {
                inQ = !inQ;
            } else if (ch === ';' && !inQ) {
                cols.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }
        cols.push(cur);

        const col0 = (cols[0] ?? '').trim();
        if (!col0 || !/^\d+$/.test(col0)) continue;

        const rawCell = (cols[2] ?? '').replace(/^"(.*)"$/s, '$1').trim();
        if (!rawCell) continue;

        result.push(rawCell);
    }

    return result;
}

const cloneLayout = (layout) => JSON.parse(JSON.stringify(layout ?? {}));

export default function CertificatesGenerate({ templates = [] }) {
    const [generateFullName, setGenerateFullName] = useState('');
    const [selectedTemplateVersionId, setSelectedTemplateVersionId] = useState('');
    const [layoutOverride, setLayoutOverride] = useState(null);
    const [generatedInfo, setGeneratedInfo] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const [csvText, setCsvText] = useState('');
    const [csvParsed, setCsvParsed] = useState(/** @type {string[]} */ ([]));
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const csvFileRef = useRef(null);

    const selectedTemplate = templates.find((template) => String(template.id) === selectedTemplateVersionId) ?? null;
    const selectedTopic = selectedTemplate?.auto_topic?.trim() || '';
    const previewLayout = layoutOverride ?? selectedTemplate?.layout_json ?? {};
    const previewQr = previewLayout?.qr ?? {};
    const previewCanvasWidth = Number(selectedTemplate?.canvas_width ?? 1600);
    const previewCanvasHeight = Number(selectedTemplate?.canvas_height ?? 1131);
    const previewName = generateFullName.trim() || 'Иванов Иван Иванович';

    const getCsrfToken = () =>
        decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');

    useEffect(() => {
        if (!selectedTemplate) {
            setLayoutOverride(null);
            return;
        }

        setLayoutOverride(cloneLayout(selectedTemplate.layout_json));
    }, [selectedTemplateVersionId, selectedTemplate]);

    const ensureTemplateSelection = () => {
        if (!selectedTemplate || !selectedTopic) {
            toast.error('Сначала выберите опубликованный шаблон сертификата.');
            return false;
        }

        return true;
    };

    const previewTextStyle = (field, defaultAlign = 'center') =>
        createPreviewTextStyle(field, previewCanvasWidth, previewCanvasHeight, defaultAlign);

    const downloadCertificatePdf = async (certificateData) => {
        if (!selectedTemplate) {
            return false;
        }

        try {
            const qrCanvas = document.getElementById('generated-qr-canvas');
            const output = await renderCertificateCanvas({
                backgroundUrl: selectedTemplate.background_url,
                canvasWidth: previewCanvasWidth,
                canvasHeight: previewCanvasHeight,
                layout: previewLayout,
                certificate: certificateData,
                qrCanvas,
            });
            if (!output) {
                return false;
            }

            downloadCanvasAsPdf(output, `${escapeFilenamePart(certificateData?.recipient_full_name)}.pdf`);
            return true;
        } catch {
            return false;
        }
    };

    const generateCertificate = async () => {
        if (!ensureTemplateSelection()) {
            return;
        }

        if (generateFullName.trim() === '') {
            toast.error('Заполните ФИО получателя.');
            return;
        }

        setActionLoading(true);

        const response = await fetch(route('certificates.generate'), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': getCsrfToken(),
            },
            credentials: 'include',
            body: JSON.stringify({
                recipient_full_name: generateFullName.trim(),
                topic: selectedTopic,
                template_version_id: Number(selectedTemplate.id),
                layout_override: previewLayout,
            }),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            toast.error(data.message ?? 'Не удалось сгенерировать сертификат.');
            setActionLoading(false);
            return;
        }

        const data = await response.json();
        const generatedCertificate = {
            ...(data.certificate ?? {}),
            recipient_full_name: generateFullName.trim(),
            topic: selectedTopic,
        };

        setGeneratedInfo(generatedCertificate);
        setGenerateFullName('');
        toast.success(data.message ?? 'Сертификат сгенерирован.');
        await waitForPaint();
        const downloaded = await downloadCertificatePdf(generatedCertificate);
        if (!downloaded) {
            toast.error('Сертификат создан, но автоматически скачать PDF не удалось.');
        }
        setActionLoading(false);
    };

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
        if (!ensureTemplateSelection()) {
            return;
        }

        if (csvParsed.length === 0) {
            toast.error('Сначала распознайте имена из CSV.');
            return;
        }

        setBulkLoading(true);
        setBulkResult(null);

        try {
            const response = await fetch(route('certificates.bulk-generate'), {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({
                    recipients: csvParsed.filter((n) => n.trim() !== ''),
                    topic: selectedTopic,
                    template_version_id: Number(selectedTemplate.id),
                    layout_override: previewLayout,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                toast.error(data.message ?? 'Ошибка генерации.');
                setBulkLoading(false);
                return;
            }

            setBulkResult(data);
            toast.success(data.message ?? `Сгенерировано: ${data.count}`);
        } catch {
            toast.error('Ошибка соединения.');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleTemplateSelect = (templateId) => {
        setSelectedTemplateVersionId(templateId ? String(templateId) : '');
        setGeneratedInfo(null);
        setBulkResult(null);
    };

    const updateLayoutField = (fieldKey, property, value) => {
        setLayoutOverride((current) => {
            if (!current?.[fieldKey]) {
                return current;
            }

            const nextValue = ['align', 'font_family', 'font_weight', 'font_style', 'color'].includes(property)
                ? value
                : Number(value);

            return {
                ...current,
                [fieldKey]: {
                    ...current[fieldKey],
                    [property]: Number.isNaN(nextValue) ? current[fieldKey][property] : nextValue,
                },
            };
        });
    };

    const resetLayoutOverrides = () => {
        if (!selectedTemplate) {
            return;
        }

        setLayoutOverride(cloneLayout(selectedTemplate.layout_json));
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
                            Страница генерации сертификатов. Реестр вынесен отдельно.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                            <DialogTrigger asChild>
                                <Button type="button" variant="outline">
                                    Массовая генерация
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                                <DialogHeader>
                                    <DialogTitle>Массовая генерация из CSV</DialogTitle>
                                    <DialogDescription>
                                        Загрузите CSV-файл с разделителем `;` или вставьте его содержимое. Список получателей можно отредактировать перед запуском.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                        {selectedTemplate ? (
                                            <span>
                                                Выбран шаблон: <span className="font-medium text-slate-900">{selectedTemplate.template_name}</span>
                                            </span>
                                        ) : (
                                            <span>Сначала выберите шаблон на основной странице, затем запускайте массовую генерацию.</span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <input
                                            ref={csvFileRef}
                                            type="file"
                                            accept=".csv,text/csv,text/plain"
                                            className="hidden"
                                            onChange={handleCsvFile}
                                        />
                                        <Button type="button" variant="outline" onClick={() => csvFileRef.current?.click()}>
                                            Загрузить CSV-файл
                                        </Button>
                                        <span className="self-center text-xs text-muted-foreground">или вставьте текст ниже</span>
                                    </div>

                                    <Textarea
                                        className="min-h-40 font-mono text-xs"
                                        placeholder="Вставьте содержимое CSV сюда…"
                                        value={csvText}
                                        onChange={(e) => {
                                            setCsvText(e.target.value);
                                            setCsvParsed([]);
                                            setBulkResult(null);
                                        }}
                                    />

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <Button type="button" onClick={handleParseCsv} variant="outline">
                                            Распознать ФИО из CSV
                                        </Button>

                                        {csvParsed.length > 0 && (
                                            <Button
                                                type="button"
                                                disabled={bulkLoading || !selectedTemplate}
                                                onClick={bulkGenerateCertificates}
                                            >
                                                {bulkLoading ? `Генерация ${csvParsed.length} серт...` : `Сгенерировать (${csvParsed.length})`}
                                            </Button>
                                        )}
                                    </div>

                                    {csvParsed.length > 0 && (
                                        <div className="space-y-3">
                                            <p className="text-sm font-medium">Найдено получателей: {csvParsed.length}</p>

                                            <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200">
                                                <table className="min-w-full text-sm">
                                                    <thead className="sticky top-0 bg-slate-50/95 backdrop-blur">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">#</th>
                                                            <th className="px-3 py-2 text-left">ФИО получателя</th>
                                                            <th className="px-3 py-2" />
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {csvParsed.map((name, idx) => (
                                                            <tr key={idx} className="border-t border-slate-200">
                                                                <td className="px-3 py-1 text-muted-foreground">{idx + 1}</td>
                                                                <td className="px-3 py-1">
                                                                    <input
                                                                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                                                                        value={name}
                                                                        onChange={(e) => editParsedName(idx, e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-1 text-right">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeParsedName(idx)}
                                                                        className="text-xs font-medium text-red-500 hover:underline"
                                                                    >
                                                                        Удалить
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {bulkResult && (
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                                            <p className="font-semibold">{bulkResult.message}</p>
                                            <p className="mt-1 text-xs text-emerald-700">
                                                Тема у сгенерированных сертификатов: {selectedTopic}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Button asChild variant="outline">
                            <Link href={route('certificates.registry.page')}>Открыть реестр</Link>
                        </Button>
                    </div>
                </div>
            }
        >
            <Head title="Сертификаты" />

            <div className="admin-shell-container space-y-6 px-3 pb-5 pt-2 sm:px-4 sm:pb-6 sm:pt-3 lg:px-5">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.95fr)] xl:items-start">
                    <Card className="overflow-hidden border-slate-200/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.96))]">
                        <CardHeader className="border-b border-slate-200/70 bg-white/70">
                            <CardTitle>1. Выбор шаблона</CardTitle>
                            <CardDescription>
                                Выберите опубликованный шаблон. Тема сертификата будет подставлена автоматически из названия выбранного шаблона.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {templates.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                    Нет опубликованных шаблонов. Сначала опубликуйте хотя бы одну версию в разделе шаблонов.
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="max-w-2xl space-y-2">
                                        <label className="text-sm font-medium text-slate-800">Шаблон сертификата</label>
                                        <select
                                            className={inputClassName}
                                            value={selectedTemplateVersionId}
                                            onChange={(event) => handleTemplateSelect(event.target.value)}
                                        >
                                            <option value="">Выберите шаблон</option>
                                            {templates.map((template) => (
                                                <option key={template.id} value={template.id}>
                                                    {template.template_name} ({template.template_code}) v{template.version}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500">
                                            После выбора шаблона появится его предпросмотр и автоматически определится тема сертификата.
                                        </p>
                                    </div>

                                    {selectedTemplate ? (
                                        <div className="grid gap-4 2xl:grid-cols-[minmax(0,560px)_300px] xl:grid-cols-[minmax(0,1fr)_290px] xl:items-start">
                                            <div
                                                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm"
                                                style={{
                                                    aspectRatio: `${selectedTemplate.canvas_width || 1600} / ${selectedTemplate.canvas_height || 1131}`,
                                                }}
                                            >
                                                <div className="relative h-full w-full" style={{ containerType: 'inline-size' }}>
                                                    {selectedTemplate.background_url ? (
                                                        <img
                                                            src={selectedTemplate.background_url}
                                                            alt={selectedTemplate.template_name}
                                                            className="absolute inset-0 h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-slate-500">
                                                            У выбранного шаблона нет фонового изображения.
                                                        </div>
                                                    )}

                                                    <div style={previewTextStyle(previewLayout?.fio)}>{previewName}</div>

                                                    {generatedInfo?.qr_payload ? (
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                left: `${(Number(previewQr?.x ?? 95) / previewCanvasWidth) * 100}%`,
                                                                top: `${(Number(previewQr?.y ?? 615) / previewCanvasHeight) * 100}%`,
                                                                zIndex: 2,
                                                                background: '#ffffff',
                                                                padding: '0.45cqw',
                                                                borderRadius: '6px',
                                                            }}
                                                        >
                                                            <QRCodeCanvas
                                                                value={generatedInfo.qr_payload}
                                                                size={Number(previewQr?.size ?? 170)}
                                                                style={{
                                                                    width: `max(42px, ${(Number(previewQr?.size ?? 170) / previewCanvasWidth) * 100}cqw)`,
                                                                    height: 'auto',
                                                                }}
                                                                includeMargin
                                                            />
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                                                        Предпросмотр
                                                    </p>
                                                    <h3 className="mt-2 text-xl font-semibold text-slate-950">
                                                        {selectedTemplate.template_name}
                                                    </h3>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        {selectedTemplate.template_code} · версия {selectedTemplate.version}
                                                    </p>
                                                </div>

                                                <div className={panelClassName}>
                                                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                                                        Автоматическая тема
                                                    </div>
                                                    <div className="mt-2 text-base font-semibold text-slate-900">
                                                        {selectedTopic}
                                                    </div>
                                                </div>

                                                <div className={panelClassName}>
                                                    <div className="text-xs text-slate-400">Размер холста</div>
                                                    <div className="mt-1 font-medium text-slate-900">
                                                        {selectedTemplate.canvas_width} × {selectedTemplate.canvas_height}
                                                    </div>
                                                </div>

                                                <div className={panelClassName}>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                                                                Правка текста
                                                            </div>
                                                            <div className="mt-1 text-xs text-slate-500">
                                                                Если текст не помещается, уменьшите размер или поправьте позицию.
                                                            </div>
                                                        </div>
                                                        <Button type="button" size="sm" variant="outline" onClick={resetLayoutOverrides}>
                                                            Сбросить
                                                        </Button>
                                                    </div>

                                                    <div className="mt-4 space-y-4">
                                                        {Object.entries(layoutFieldLabels).map(([fieldKey, fieldLabel]) => {
                                                            const field = previewLayout?.[fieldKey];
                                                            if (!field) {
                                                                return null;
                                                            }

                                                            return (
                                                                <div key={fieldKey} className="rounded-xl border border-slate-200 bg-white p-3">
                                                                    <div className="mb-3 text-sm font-medium text-slate-900">{fieldLabel}</div>
                                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                                        <label className="text-xs text-slate-500">
                                                                            Размер шрифта
                                                                            <input
                                                                                type="number"
                                                                                className={cn(inputClassName, 'mt-1 h-9')}
                                                                                value={field.font_size ?? 24}
                                                                                onChange={(event) => updateLayoutField(fieldKey, 'font_size', event.target.value)}
                                                                            />
                                                                        </label>
                                                                        <label className="text-xs text-slate-500">
                                                                            Выравнивание
                                                                            <select
                                                                                className={cn(inputClassName, 'mt-1 h-9')}
                                                                                value={field.align ?? 'center'}
                                                                                onChange={(event) => updateLayoutField(fieldKey, 'align', event.target.value)}
                                                                            >
                                                                                <option value="left">Слева</option>
                                                                                <option value="center">По центру</option>
                                                                                <option value="right">Справа</option>
                                                                            </select>
                                                                        </label>
                                                                        <label className="text-xs text-slate-500">
                                                                            X
                                                                            <input
                                                                                type="number"
                                                                                className={cn(inputClassName, 'mt-1 h-9')}
                                                                                value={field.x ?? 0}
                                                                                onChange={(event) => updateLayoutField(fieldKey, 'x', event.target.value)}
                                                                            />
                                                                        </label>
                                                                        <label className="text-xs text-slate-500">
                                                                            Y
                                                                            <input
                                                                                type="number"
                                                                                className={cn(inputClassName, 'mt-1 h-9')}
                                                                                value={field.y ?? 0}
                                                                                onChange={(event) => updateLayoutField(fieldKey, 'y', event.target.value)}
                                                                            />
                                                                        </label>
                                                                        <label className="text-xs text-slate-500">
                                                                            Ширина
                                                                            <input
                                                                                type="number"
                                                                                className={cn(inputClassName, 'mt-1 h-9')}
                                                                                value={field.w ?? 300}
                                                                                onChange={(event) => updateLayoutField(fieldKey, 'w', event.target.value)}
                                                                            />
                                                                        </label>
                                                                        <label className="text-xs text-slate-500">
                                                                            Высота
                                                                            <input
                                                                                type="number"
                                                                                className={cn(inputClassName, 'mt-1 h-9')}
                                                                                value={field.h ?? 40}
                                                                                onChange={(event) => updateLayoutField(fieldKey, 'h', event.target.value)}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>2. Одиночная генерация</CardTitle>
                            <CardDescription>
                                Для одного получателя. Тема и шаблон уже закреплены выбором выше.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-800">ФИО получателя</label>
                                <input
                                    className={inputClassName}
                                    placeholder="Например: Иванов Иван Иванович"
                                    value={generateFullName}
                                    onChange={(event) => setGenerateFullName(event.target.value)}
                                />
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs text-muted-foreground">
                                    Номер сертификата, тема и ссылка верификации сформируются автоматически.
                                </p>
                                <Button onClick={generateCertificate} disabled={actionLoading || !selectedTemplate}>
                                    {actionLoading ? 'Генерация...' : 'Сгенерировать'}
                                </Button>
                            </div>

                            {generatedInfo && (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                                    <div className="mb-1 font-semibold">Сертификат создан</div>
                                    <div>Номер: {generatedInfo.certificate_number}</div>
                                    <div className="hidden">
                                        <QRCodeCanvas
                                            id="generated-qr-canvas"
                                            value={generatedInfo.qr_payload}
                                            size={140}
                                            includeMargin
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
