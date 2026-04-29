import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';

const defaultVersionJson = {
    layout_json: JSON.stringify(
        {
            fio: { x: 320, y: 320, w: 900, h: 90, font_family: 'Arial', font_size: 48, font_weight: 'normal', font_style: 'normal', min_font_size: 24, color: '#000000', align: 'center' },
            topic: { x: 300, y: 430, w: 940, h: 150, font_family: 'Arial', font_size: 30, font_weight: 'normal', font_style: 'normal', min_font_size: 18, color: '#222222', align: 'center', max_lines: 3 },
            number: { x: 980, y: 700, w: 260, h: 45, font_family: 'Arial', font_size: 22, font_weight: 'normal', font_style: 'normal', color: '#000000', align: 'right' },
            qr: { x: 95, y: 615, size: 170, margin: 2, ec_level: 'M' },
        },
        null,
        2,
    ),
    text_rules_json: JSON.stringify(
        {
            fio: { auto_shrink: true, min_font_size: 24 },
            topic: { wrap: true, max_lines: 3 },
        },
        null,
        2,
    ),
    qr_rules_json: JSON.stringify({ format: 'verify_url' }, null, 2),
};

const layoutLabels = {
    fio: 'ФИО',
    topic: 'Тема',
    number: 'Номер',
    qr: 'QR',
};

const previewTexts = {
    fio: 'Иван Петров',
    topic: 'Курс JavaScript',
    number: 'CERT-2026-0042',
    qr: '',
};

const fontFamilyOptions = [
    'Arial',
    'Times New Roman',
    'Georgia',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Courier New',
];

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function parseLayout(layoutJson, fallback = null) {
    try {
        const parsed = JSON.parse(layoutJson);
        if (!parsed || typeof parsed !== 'object') {
            return fallback;
        }

        return parsed;
    } catch {
        return fallback;
    }
}

function TemplateLayoutEditor({
    backgroundUrl,
    canvasWidth,
    canvasHeight,
    layoutJson,
    onLayoutJsonChange,
}) {
    const previewWidth = 980;
    const parsedLayout = useMemo(() => parseLayout(layoutJson, null), [layoutJson]);
    const [pointerState, setPointerState] = useState(null);
    const [selectedKey, setSelectedKey] = useState('fio');
    const stageRef = useRef(null);

    if (!backgroundUrl) {
        return (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Загрузите фон шаблона, чтобы перетаскивать поля на макете.
            </div>
        );
    }

    if (!parsedLayout) {
        return (
            <div className="rounded-lg border border-dashed p-4 text-sm text-red-600">
                Невалидный layout_json. Исправьте JSON, чтобы включить drag-and-drop.
            </div>
        );
    }

    const width = Number(canvasWidth) || 1600;
    const height = Number(canvasHeight) || 1131;
    const scale = previewWidth / width;
    const previewHeight = Math.round(height * scale);

    const updateNode = (key, patch) => {
        const next = {
            ...parsedLayout,
            [key]: {
                ...(parsedLayout[key] ?? {}),
                ...patch,
            },
        };

        onLayoutJsonChange(JSON.stringify(next, null, 2));
    };

    const startDrag = (event, key) => {
        if (!stageRef.current || !parsedLayout[key]) {
            return;
        }

        event.preventDefault();

        const rect = stageRef.current.getBoundingClientRect();
        const node = parsedLayout[key];
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const nodeX = Number(node.x) * scale;
        const nodeY = Number(node.y) * scale;

        setPointerState({
            mode: 'move',
            key,
            dx: pointerX - nodeX,
            dy: pointerY - nodeY,
        });
    };

    const startResize = (event, key) => {
        if (!stageRef.current || !parsedLayout[key]) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const rect = stageRef.current.getBoundingClientRect();
        const node = parsedLayout[key];
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;

        setPointerState({
            mode: 'resize',
            key,
            startPointerX: pointerX,
            startPointerY: pointerY,
            startW: Number(node.w || 200),
            startH: Number(node.h || 60),
            startSize: Number(node.size || 170),
        });
    };

    const onMove = (event) => {
        if (!pointerState || !stageRef.current) {
            return;
        }

        const rect = stageRef.current.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const current = parsedLayout[pointerState.key];

        if (!current) {
            return;
        }

        if (pointerState.mode === 'move') {
            const previewNodeWidth = pointerState.key === 'qr'
                ? Number(current.size || 170) * scale
                : Number(current.w || 200) * scale;
            const previewNodeHeight = pointerState.key === 'qr'
                ? Number(current.size || 170) * scale
                : Number(current.h || 60) * scale;

            const nextPreviewX = clamp(pointerX - pointerState.dx, 0, previewWidth - previewNodeWidth);
            const nextPreviewY = clamp(pointerY - pointerState.dy, 0, previewHeight - previewNodeHeight);

            updateNode(pointerState.key, {
                x: Math.round(nextPreviewX / scale),
                y: Math.round(nextPreviewY / scale),
            });

            return;
        }

        const deltaCanvasX = Math.round((pointerX - pointerState.startPointerX) / scale);
        const deltaCanvasY = Math.round((pointerY - pointerState.startPointerY) / scale);
        const nodeX = Number(current.x || 0);
        const nodeY = Number(current.y || 0);

        if (pointerState.key === 'qr') {
            const maxSize = Math.max(40, Math.min(width - nodeX, height - nodeY));
            const nextSize = clamp(
                pointerState.startSize + Math.max(deltaCanvasX, deltaCanvasY),
                40,
                maxSize,
            );

            updateNode(pointerState.key, {
                size: Math.round(nextSize),
            });

            return;
        }

        const nextW = clamp(pointerState.startW + deltaCanvasX, 80, Math.max(80, width - nodeX));
        const nextH = clamp(pointerState.startH + deltaCanvasY, 32, Math.max(32, height - nodeY));

        updateNode(pointerState.key, {
            w: Math.round(nextW),
            h: Math.round(nextH),
        });
    };

    const stopDrag = () => {
        setPointerState(null);
    };

    const selectedNode = parsedLayout[selectedKey] ?? null;
    const isSelectedTextField = selectedKey !== 'qr' && selectedNode;

    return (
        <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
                Перетащите блоки мышкой. Координаты сохраняются в `layout_json`.
            </div>

            <div className="overflow-auto rounded-lg border bg-slate-50 p-2">
                <div
                    ref={stageRef}
                    className="relative select-none overflow-hidden rounded-md border bg-white"
                    style={{ width: previewWidth, height: previewHeight }}
                    onMouseMove={onMove}
                    onMouseUp={stopDrag}
                    onMouseLeave={stopDrag}
                >
                    <img
                        src={backgroundUrl}
                        alt="Фон шаблона"
                        className="absolute inset-0 h-full w-full object-cover"
                        draggable={false}
                    />

                    {Object.entries(layoutLabels).map(([key, label]) => {
                        const node = parsedLayout[key];
                        if (!node) {
                            return null;
                        }

                        const x = Number(node.x || 0) * scale;
                        const y = Number(node.y || 0) * scale;
                        const w = key === 'qr' ? Number(node.size || 170) * scale : Number(node.w || 200) * scale;
                        const h = key === 'qr' ? Number(node.size || 170) * scale : Number(node.h || 60) * scale;

                        return (
                            <button
                                key={key}
                                type="button"
                                className={`absolute flex cursor-move items-center justify-center rounded-md border-2 overflow-hidden ${
                                    selectedKey === key
                                        ? 'border-emerald-500 bg-emerald-100/75 text-emerald-900'
                                        : 'border-blue-500/90 bg-blue-100/70 text-blue-800'
                                }`}
                                style={{ left: x, top: y, width: w, height: h }}
                                onMouseDown={(event) => {
                                    setSelectedKey(key);
                                    startDrag(event, key);
                                }}
                            >
                                {key === 'qr' ? (
                                    <div className="flex items-center justify-center text-xs font-semibold">QR</div>
                                ) : (
                                    <div
                                        style={{
                                            color: node.color ?? '#000000',
                                            fontSize: `${Math.max(8, (Number(node.font_size ?? 24) * scale) / 2)}px`,
                                            fontFamily: node.font_family ?? 'Arial, sans-serif',
                                            fontWeight: node.font_weight ?? 'normal',
                                            fontStyle: node.font_style ?? 'normal',
                                            textAlign: node.align ?? 'center',
                                            lineHeight: 1.2,
                                            whiteSpace: 'pre-wrap',
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '4px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {previewTexts[key]}
                                    </div>
                                )}

                                <span
                                    className="absolute -bottom-1 -right-1 h-3 w-3 rounded-sm border border-blue-700 bg-blue-600"
                                    onMouseDown={(event) => startResize(event, key)}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-lg border bg-white p-3">
                <div className="mb-2 text-sm font-medium">Настройки поля</div>

                <div className="mb-3 flex flex-wrap gap-2">
                    {Object.entries(layoutLabels).map(([key, label]) => (
                        <Button
                            key={key}
                            type="button"
                            size="sm"
                            variant={selectedKey === key ? 'default' : 'outline'}
                            onClick={() => setSelectedKey(key)}
                        >
                            {label}
                        </Button>
                    ))}
                </div>

                {!isSelectedTextField && (
                    <div className="text-xs text-muted-foreground">
                        Для QR изменяются размер и позиция на макете. Размер текста и цвет доступны для текстовых полей.
                    </div>
                )}

                {isSelectedTextField && (
                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium">Размер шрифта</label>
                            <input
                                type="number"
                                min="8"
                                max="200"
                                className="w-full rounded-md border px-2 py-2 text-sm"
                                value={Number(selectedNode.font_size ?? 24)}
                                onChange={(event) =>
                                    updateNode(selectedKey, {
                                        font_size: Number(event.target.value || 24),
                                    })
                                }
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium">Шрифт</label>
                            <select
                                className="w-full rounded-md border px-2 py-2 text-sm"
                                value={String(selectedNode.font_family ?? 'Arial')}
                                onChange={(event) =>
                                    updateNode(selectedKey, {
                                        font_family: event.target.value,
                                    })
                                }
                            >
                                {fontFamilyOptions.map((font) => (
                                    <option key={font} value={font}>{font}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium">Цвет текста</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    className="h-9 w-12 rounded border p-1"
                                    value={String(selectedNode.color ?? '#000000')}
                                    onChange={(event) =>
                                        updateNode(selectedKey, {
                                            color: event.target.value,
                                        })
                                    }
                                />
                                <input
                                    type="text"
                                    className="w-full rounded-md border px-2 py-2 text-sm"
                                    value={String(selectedNode.color ?? '#000000')}
                                    onChange={(event) =>
                                        updateNode(selectedKey, {
                                            color: event.target.value,
                                        })
                                    }
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium">Стиль</label>
                            <div className="flex items-center gap-2">
                                <label className="inline-flex items-center gap-2 text-xs">
                                    <input
                                        type="checkbox"
                                        checked={String(selectedNode.font_weight ?? 'normal') === 'bold'}
                                        onChange={(event) =>
                                            updateNode(selectedKey, {
                                                font_weight: event.target.checked ? 'bold' : 'normal',
                                            })
                                        }
                                    />
                                    Жирный
                                </label>
                                <label className="inline-flex items-center gap-2 text-xs">
                                    <input
                                        type="checkbox"
                                        checked={String(selectedNode.font_style ?? 'normal') === 'italic'}
                                        onChange={(event) =>
                                            updateNode(selectedKey, {
                                                font_style: event.target.checked ? 'italic' : 'normal',
                                            })
                                        }
                                    />
                                    Курсив
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium">Выравнивание</label>
                            <select
                                className="w-full rounded-md border px-2 py-2 text-sm"
                                value={String(selectedNode.align ?? 'left')}
                                onChange={(event) =>
                                    updateNode(selectedKey, {
                                        align: event.target.value,
                                    })
                                }
                            >
                                <option value="left">left</option>
                                <option value="center">center</option>
                                <option value="right">right</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TemplatesIndex({ templates = [] }) {
    const flash = usePage().props.flash ?? {};
    const [openVersionFor, setOpenVersionFor] = useState(null);
    const [templateBackgroundPreview, setTemplateBackgroundPreview] = useState(null);
    const [versionBackgroundPreview, setVersionBackgroundPreview] = useState(null);

    useEffect(() => {
        return () => {
            if (templateBackgroundPreview) {
                URL.revokeObjectURL(templateBackgroundPreview);
            }
        };
    }, [templateBackgroundPreview]);

    useEffect(() => {
        return () => {
            if (versionBackgroundPreview) {
                URL.revokeObjectURL(versionBackgroundPreview);
            }
        };
    }, [versionBackgroundPreview]);

    const createTemplateForm = useForm({
        name: '',
        code: '',
        is_active: true,
        background: null,
        canvas_width: 1600,
        canvas_height: 1131,
        dpi: 300,
        ...defaultVersionJson,
    });

    const createVersionForm = useForm({
        background: null,
        canvas_width: 1600,
        canvas_height: 1131,
        dpi: 300,
        ...defaultVersionJson,
    });

    const openTemplate = useMemo(
        () => templates.find((template) => template.id === openVersionFor) ?? null,
        [templates, openVersionFor],
    );

    const submitTemplate = (event) => {
        event.preventDefault();
        createTemplateForm.post(route('certificate-templates.store'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () =>
                createTemplateForm.setData({
                    name: '',
                    code: '',
                    is_active: true,
                    background: null,
                    canvas_width: 1600,
                    canvas_height: 1131,
                    dpi: 300,
                    ...defaultVersionJson,
                }),
            onFinish: () => setTemplateBackgroundPreview(null),
        });
    };

    const submitVersion = (event) => {
        event.preventDefault();

        if (!openTemplate) {
            return;
        }

        createVersionForm.post(route('certificate-templates.versions.store', openTemplate.id), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                createVersionForm.reset();
                createVersionForm.setData({
                    background: null,
                    canvas_width: 1600,
                    canvas_height: 1131,
                    dpi: 300,
                    ...defaultVersionJson,
                });
                setVersionBackgroundPreview(null);
                setOpenVersionFor(null);
            },
        });
    };

    const toggleTemplate = (template) => {
        router.post(route('certificate-templates.toggle-active', template.id), {}, { preserveScroll: true });
    };

    const editTemplate = (template) => {
        const name = window.prompt('Название шаблона', template.name);
        if (name === null) {
            return;
        }

        const code = window.prompt('Код шаблона (латиница, цифры, дефис)', template.code);
        if (code === null) {
            return;
        }

        router.patch(
            route('certificate-templates.update', template.id),
            { name, code, is_active: template.is_active },
            { preserveScroll: true },
        );
    };

    const publishVersion = (versionId) => {
        if (!window.confirm('Опубликовать эту версию? Текущая опубликованная версия будет снята.')) {
            return;
        }

        router.post(route('certificate-template-versions.publish', versionId), {}, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                            Шаблоны сертификатов
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Конструктор и версионность шаблонов для генерации сертификатов
                        </p>
                    </div>
                </div>
            }
        >
            <Head title="Шаблоны сертификатов" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Новый шаблон</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {flash.success && (
                            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                {flash.success}
                            </div>
                        )}

                        <p className="mb-3 text-xs text-muted-foreground">
                            Если загрузить фон при создании, система автоматически создаст версию шаблона v1.
                        </p>

                        <form onSubmit={submitTemplate} className="grid gap-4 md:grid-cols-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium">Название</label>
                                <input
                                    className="w-full rounded-md border px-3 py-2"
                                    value={createTemplateForm.data.name}
                                    onChange={(event) => createTemplateForm.setData('name', event.target.value)}
                                    placeholder="Например: Сертификат курса"
                                />
                                {createTemplateForm.errors.name && (
                                    <div className="mt-1 text-xs text-red-600">{createTemplateForm.errors.name}</div>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Код</label>
                                <input
                                    className="w-full rounded-md border px-3 py-2"
                                    value={createTemplateForm.data.code}
                                    onChange={(event) => createTemplateForm.setData('code', event.target.value)}
                                    placeholder="CERT_BASIC"
                                />
                                {createTemplateForm.errors.code && (
                                    <div className="mt-1 text-xs text-red-600">{createTemplateForm.errors.code}</div>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Фон шаблона</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="w-full rounded-md border px-3 py-2"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null;
                                        createTemplateForm.setData('background', file);
                                        setTemplateBackgroundPreview(file ? URL.createObjectURL(file) : null);
                                    }}
                                />
                                {createTemplateForm.errors.background && (
                                    <div className="mt-1 text-xs text-red-600">{createTemplateForm.errors.background}</div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                <div>
                                    <label className="mb-1 block text-xs font-medium">Ширина</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-md border px-2 py-2 text-sm"
                                        value={createTemplateForm.data.canvas_width}
                                        onChange={(event) =>
                                            createTemplateForm.setData('canvas_width', event.target.value)
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium">Высота</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-md border px-2 py-2 text-sm"
                                        value={createTemplateForm.data.canvas_height}
                                        onChange={(event) =>
                                            createTemplateForm.setData('canvas_height', event.target.value)
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium">DPI</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-md border px-2 py-2 text-sm"
                                        value={createTemplateForm.data.dpi}
                                        onChange={(event) => createTemplateForm.setData('dpi', event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-end gap-3">
                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(createTemplateForm.data.is_active)}
                                        onChange={(event) =>
                                            createTemplateForm.setData('is_active', event.target.checked)
                                        }
                                    />
                                    Активен
                                </label>
                                <Button type="submit" disabled={createTemplateForm.processing}>
                                    Создать
                                </Button>
                            </div>
                        </form>

                        <div className="mt-4 space-y-4">
                            <TemplateLayoutEditor
                                backgroundUrl={templateBackgroundPreview}
                                canvasWidth={createTemplateForm.data.canvas_width}
                                canvasHeight={createTemplateForm.data.canvas_height}
                                layoutJson={createTemplateForm.data.layout_json}
                                onLayoutJsonChange={(value) => createTemplateForm.setData('layout_json', value)}
                            />

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium">text_rules_json (v1)</label>
                                    <textarea
                                        className="min-h-24 w-full rounded-md border px-3 py-2 font-mono text-xs"
                                        value={createTemplateForm.data.text_rules_json}
                                        onChange={(event) =>
                                            createTemplateForm.setData('text_rules_json', event.target.value)
                                        }
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium">qr_rules_json (v1)</label>
                                    <textarea
                                        className="min-h-24 w-full rounded-md border px-3 py-2 font-mono text-xs"
                                        value={createTemplateForm.data.qr_rules_json}
                                        onChange={(event) =>
                                            createTemplateForm.setData('qr_rules_json', event.target.value)
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Список шаблонов</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {templates.length === 0 && (
                            <p className="text-sm text-muted-foreground">Шаблонов пока нет.</p>
                        )}

                        {templates.map((template) => (
                            <div key={template.id} className="rounded-lg border p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold">{template.name}</h3>
                                            <Badge variant="outline">{template.code}</Badge>
                                            <Badge variant={template.is_active ? 'default' : 'secondary'}>
                                                {template.is_active ? 'Активен' : 'Неактивен'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Создан: {template.created_at_human ?? '-'}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={() => editTemplate(template)}>
                                            Редактировать
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => toggleTemplate(template)}>
                                            {template.is_active ? 'Отключить' : 'Включить'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                setOpenVersionFor((prev) => (prev === template.id ? null : template.id));
                                            }}
                                        >
                                            {openVersionFor === template.id ? 'Скрыть версию' : 'Добавить версию'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-4 space-y-2">
                                    {template.versions.length === 0 && (
                                        <p className="text-sm text-muted-foreground">Версий еще нет.</p>
                                    )}

                                    {template.versions.map((version) => (
                                        <div
                                            key={version.id}
                                            className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
                                        >
                                            <div className="text-sm">
                                                <span className="font-medium">v{version.version}</span>
                                                <span className="ml-2 text-muted-foreground">
                                                    {version.canvas_width}x{version.canvas_height}, {version.dpi} DPI
                                                </span>
                                                {version.is_published && (
                                                    <Badge className="ml-2">Опубликовано</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {version.background_url && (
                                                    <a
                                                        href={version.background_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs text-primary underline"
                                                    >
                                                        Фон
                                                    </a>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={version.is_published}
                                                    onClick={() => publishVersion(version.id)}
                                                >
                                                    Опубликовать
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {openTemplate && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Новая версия для: {openTemplate.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitVersion} className="grid gap-4">
                                <div className="grid gap-4 md:grid-cols-4">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Ширина</label>
                                        <input
                                            type="number"
                                            className="w-full rounded-md border px-3 py-2"
                                            value={createVersionForm.data.canvas_width}
                                            onChange={(event) =>
                                                createVersionForm.setData('canvas_width', event.target.value)
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Высота</label>
                                        <input
                                            type="number"
                                            className="w-full rounded-md border px-3 py-2"
                                            value={createVersionForm.data.canvas_height}
                                            onChange={(event) =>
                                                createVersionForm.setData('canvas_height', event.target.value)
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">DPI</label>
                                        <input
                                            type="number"
                                            className="w-full rounded-md border px-3 py-2"
                                            value={createVersionForm.data.dpi}
                                            onChange={(event) => createVersionForm.setData('dpi', event.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Фон</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="w-full rounded-md border px-3 py-2"
                                            onChange={(event) => {
                                                const file = event.target.files?.[0] ?? null;
                                                createVersionForm.setData('background', file);
                                                setVersionBackgroundPreview(file ? URL.createObjectURL(file) : null);
                                            }}
                                        />
                                    </div>
                                </div>

                                <TemplateLayoutEditor
                                    backgroundUrl={versionBackgroundPreview}
                                    canvasWidth={createVersionForm.data.canvas_width}
                                    canvasHeight={createVersionForm.data.canvas_height}
                                    layoutJson={createVersionForm.data.layout_json}
                                    onLayoutJsonChange={(value) => createVersionForm.setData('layout_json', value)}
                                />

                                <div>
                                    <label className="mb-1 block text-sm font-medium">layout_json</label>
                                    <textarea
                                        className="min-h-48 w-full rounded-md border px-3 py-2 font-mono text-xs"
                                        value={createVersionForm.data.layout_json}
                                        onChange={(event) =>
                                            createVersionForm.setData('layout_json', event.target.value)
                                        }
                                    />
                                    {createVersionForm.errors.layout_json && (
                                        <div className="mt-1 text-xs text-red-600">
                                            {createVersionForm.errors.layout_json}
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">text_rules_json</label>
                                        <textarea
                                            className="min-h-36 w-full rounded-md border px-3 py-2 font-mono text-xs"
                                            value={createVersionForm.data.text_rules_json}
                                            onChange={(event) =>
                                                createVersionForm.setData('text_rules_json', event.target.value)
                                            }
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium">qr_rules_json</label>
                                        <textarea
                                            className="min-h-36 w-full rounded-md border px-3 py-2 font-mono text-xs"
                                            value={createVersionForm.data.qr_rules_json}
                                            onChange={(event) =>
                                                createVersionForm.setData('qr_rules_json', event.target.value)
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button type="submit" disabled={createVersionForm.processing}>
                                        Сохранить версию
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setOpenVersionFor(null)}
                                    >
                                        Отмена
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
