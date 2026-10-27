import { ConfirmDialog } from '@/components/ConfirmDialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Notice, PageHeader, Segmented, StatGrid, StatTile, qdFieldClass } from '@/components/platform';
import { CheckCircle2, ExternalLink, FilePlus2, Image as ImageIcon, Layers, LayoutTemplate, Plus } from 'lucide-react';

// Chrome classes for raw fields around the editor (the editor stage itself keeps its own styling).
const fieldClass = qdFieldClass;
const fileFieldClass = `${qdFieldClass} py-1.5 file:mr-3 file:rounded-[8px] file:border-0 file:bg-teal-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-teal-700`;
const jsonFieldClass = 'w-full rounded-[10px] border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 transition-colors hover:border-slate-400 focus:border-teal-600 focus:outline-none focus:ring-[3px] focus:ring-teal-600/20';
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
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [pointerState, setPointerState] = useState(null);
    const [selectedKey, setSelectedKey] = useState('fio');
    const stageRef = useRef(null);

    if (!backgroundUrl) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                <ImageIcon className="h-5 w-5 shrink-0 text-teal-700" />
                Загрузите фон шаблона, чтобы перетаскивать поля на макете.
            </div>
        );
    }

    if (!parsedLayout) {
        return (
            <Notice tone="danger">
                Невалидный layout_json. Исправьте JSON, чтобы включить drag-and-drop.
            </Notice>
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
            <div className="text-xs text-slate-500">
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

            <div className="rounded-[14px] border border-slate-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="qd-field-label text-[#102945]">Настройки поля</div>
                    <Segmented
                        items={Object.entries(layoutLabels).map(([key, label]) => ({ key, label }))}
                        value={selectedKey}
                        onChange={setSelectedKey}
                    />
                </div>

                {!isSelectedTextField && (
                    <div className="text-xs text-slate-500">
                        Для QR изменяются размер и позиция на макете. Размер текста и цвет доступны для текстовых полей.
                    </div>
                )}

                {isSelectedTextField && (
                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <label className="qd-field-label mb-2 block">Размер шрифта</label>
                            <input
                                type="number"
                                min="8"
                                max="200"
                                className={fieldClass}
                                value={Number(selectedNode.font_size ?? 24)}
                                onChange={(event) =>
                                    updateNode(selectedKey, {
                                        font_size: Number(event.target.value || 24),
                                    })
                                }
                            />
                        </div>

                        <div>
                            <label className="qd-field-label mb-2 block">Шрифт</label>
                            <select
                                className={fieldClass}
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
                            <label className="qd-field-label mb-2 block">Цвет текста</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    className="h-10 w-12 shrink-0 rounded-[10px] border border-slate-300 p-1"
                                    value={String(selectedNode.color ?? '#000000')}
                                    onChange={(event) =>
                                        updateNode(selectedKey, {
                                            color: event.target.value,
                                        })
                                    }
                                />
                                <input
                                    type="text"
                                    className={fieldClass}
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
                            <label className="qd-field-label mb-2 block">Стиль</label>
                            <div className="flex items-center gap-2">
                                <label className="inline-flex h-10 items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 accent-teal-700"
                                        checked={String(selectedNode.font_weight ?? 'normal') === 'bold'}
                                        onChange={(event) =>
                                            updateNode(selectedKey, {
                                                font_weight: event.target.checked ? 'bold' : 'normal',
                                            })
                                        }
                                    />
                                    Жирный
                                </label>
                                <label className="inline-flex h-10 items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 accent-teal-700"
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
                            <label className="qd-field-label mb-2 block">Выравнивание</label>
                            <select
                                className={fieldClass}
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
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });

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
        setConfirmState({
            open: true,
            description: 'Опубликовать эту версию? Текущая опубликованная версия будет снята.',
            onConfirm: () => router.post(route('certificate-template-versions.publish', versionId), {}, { preserveScroll: true }),
        });
    };

    const activeCount = templates.filter((template) => template.is_active).length;
    const versionsCount = templates.reduce((sum, template) => sum + (template.versions?.length ?? 0), 0);
    const publishedCount = templates.filter((template) => (template.versions ?? []).some((version) => version.is_published)).length;

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    eyebrow="Сертификаты"
                    title="Шаблоны сертификатов"
                    description="Конструктор и версионность шаблонов для генерации сертификатов."
                />
            }
        >
            <Head title="Шаблоны сертификатов" />

            <div className="admin-page-wrap space-y-6">
                {flash.success && (
                    <Notice tone="success">{flash.success}</Notice>
                )}

                <StatGrid>
                    <StatTile label="Шаблонов" value={templates.length} tone="teal" icon={LayoutTemplate} />
                    <StatTile label="Активных" value={activeCount} tone="success" icon={CheckCircle2} />
                    <StatTile label="Версий" value={versionsCount} tone="navy" icon={Layers} />
                    <StatTile label="С опубликованной версией" value={publishedCount} tone="gold" icon={FilePlus2} />
                </StatGrid>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Новый шаблон
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <p className="text-sm text-slate-600">
                            Если загрузить фон при создании, система автоматически создаст версию шаблона v1.
                        </p>

                        <form onSubmit={submitTemplate} className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-2">
                                <label className="qd-field-label block">Название</label>
                                <input
                                    className={fieldClass}
                                    value={createTemplateForm.data.name}
                                    onChange={(event) => createTemplateForm.setData('name', event.target.value)}
                                    placeholder="Например: Сертификат курса"
                                />
                                {createTemplateForm.errors.name && (
                                    <div className="text-xs text-red-700">{createTemplateForm.errors.name}</div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Код</label>
                                <input
                                    className={fieldClass}
                                    value={createTemplateForm.data.code}
                                    onChange={(event) => createTemplateForm.setData('code', event.target.value)}
                                    placeholder="CERT_BASIC"
                                />
                                {createTemplateForm.errors.code && (
                                    <div className="text-xs text-red-700">{createTemplateForm.errors.code}</div>
                                )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="qd-field-label block">Фон шаблона</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className={fileFieldClass}
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null;
                                        createTemplateForm.setData('background', file);
                                        setTemplateBackgroundPreview(file ? URL.createObjectURL(file) : null);
                                    }}
                                />
                                {createTemplateForm.errors.background && (
                                    <div className="text-xs text-red-700">{createTemplateForm.errors.background}</div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-3 md:col-span-2">
                                <div className="space-y-2">
                                    <label className="qd-field-label block">Ширина</label>
                                    <input
                                        type="number"
                                        className={fieldClass}
                                        value={createTemplateForm.data.canvas_width}
                                        onChange={(event) =>
                                            createTemplateForm.setData('canvas_width', event.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="qd-field-label block">Высота</label>
                                    <input
                                        type="number"
                                        className={fieldClass}
                                        value={createTemplateForm.data.canvas_height}
                                        onChange={(event) =>
                                            createTemplateForm.setData('canvas_height', event.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="qd-field-label block">DPI</label>
                                    <input
                                        type="number"
                                        className={fieldClass}
                                        value={createTemplateForm.data.dpi}
                                        onChange={(event) => createTemplateForm.setData('dpi', event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-end justify-end gap-3 md:col-span-2">
                                <label className="inline-flex h-10 items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 accent-teal-700"
                                        checked={Boolean(createTemplateForm.data.is_active)}
                                        onChange={(event) =>
                                            createTemplateForm.setData('is_active', event.target.checked)
                                        }
                                    />
                                    Активен
                                </label>
                                <Button type="submit" disabled={createTemplateForm.processing} className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Создать
                                </Button>
                            </div>
                        </form>

                        <div className="space-y-4 border-t border-slate-200 pt-5">
                            <TemplateLayoutEditor
                                backgroundUrl={templateBackgroundPreview}
                                canvasWidth={createTemplateForm.data.canvas_width}
                                canvasHeight={createTemplateForm.data.canvas_height}
                                layoutJson={createTemplateForm.data.layout_json}
                                onLayoutJsonChange={(value) => createTemplateForm.setData('layout_json', value)}
                            />

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="qd-field-label block">text_rules_json (v1)</label>
                                    <textarea
                                        className={`${jsonFieldClass} min-h-24`}
                                        value={createTemplateForm.data.text_rules_json}
                                        onChange={(event) =>
                                            createTemplateForm.setData('text_rules_json', event.target.value)
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="qd-field-label block">qr_rules_json (v1)</label>
                                    <textarea
                                        className={`${jsonFieldClass} min-h-24`}
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
                        <CardTitle className="flex items-center gap-2">
                            <LayoutTemplate className="h-4 w-4" />
                            Список шаблонов
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {templates.length === 0 && (
                            <div className="rounded-[14px] border border-dashed border-slate-300 px-4 py-10 text-center">
                                <p className="font-display text-base font-bold text-[#102945]">Шаблонов пока нет</p>
                                <p className="mt-1 text-sm text-slate-600">Создайте первый шаблон в форме выше.</p>
                            </div>
                        )}

                        {templates.map((template) => (
                            <div key={template.id} className="rounded-[14px] border border-slate-200 bg-white">
                                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-display text-lg font-bold text-[#102945]">{template.name}</h3>
                                            <Badge variant="outline" className="font-mono">{template.code}</Badge>
                                            <Badge variant={template.is_active ? 'success' : 'secondary'}>
                                                {template.is_active ? 'Активен' : 'Неактивен'}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Создан: {template.created_at_human ?? '-'}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button size="sm" variant="ghost" onClick={() => editTemplate(template)}>
                                            Редактировать
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => toggleTemplate(template)}>
                                            {template.is_active ? 'Отключить' : 'Включить'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={openVersionFor === template.id ? 'secondary' : 'default'}
                                            onClick={() => {
                                                setOpenVersionFor((prev) => (prev === template.id ? null : template.id));
                                            }}
                                        >
                                            {openVersionFor === template.id ? 'Скрыть версию' : 'Добавить версию'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="border-t border-slate-200">
                                    {template.versions.length === 0 && (
                                        <p className="px-4 py-3 text-sm text-slate-500">Версий еще нет.</p>
                                    )}

                                    {template.versions.length > 0 && (
                                        <div className="divide-y divide-slate-200">
                                            {template.versions.map((version) => (
                                                <div
                                                    key={version.id}
                                                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                                                >
                                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                                        <span className="font-semibold tabular-nums text-[#102945]">v{version.version}</span>
                                                        <span className="tabular-nums text-slate-500">
                                                            {version.canvas_width}x{version.canvas_height}, {version.dpi} DPI
                                                        </span>
                                                        {version.is_published && (
                                                            <Badge variant="success">Опубликовано</Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {version.background_url && (
                                                            <Button asChild size="sm" variant="ghost" className="gap-1.5">
                                                                <a
                                                                    href={version.background_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                >
                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                    Фон
                                                                </a>
                                                            </Button>
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
                                    )}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {openTemplate && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FilePlus2 className="h-4 w-4" />
                                Новая версия для: {openTemplate.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitVersion} className="grid gap-5">
                                <div className="grid gap-4 md:grid-cols-4">
                                    <div className="space-y-2">
                                        <label className="qd-field-label block">Ширина</label>
                                        <input
                                            type="number"
                                            className={fieldClass}
                                            value={createVersionForm.data.canvas_width}
                                            onChange={(event) =>
                                                createVersionForm.setData('canvas_width', event.target.value)
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="qd-field-label block">Высота</label>
                                        <input
                                            type="number"
                                            className={fieldClass}
                                            value={createVersionForm.data.canvas_height}
                                            onChange={(event) =>
                                                createVersionForm.setData('canvas_height', event.target.value)
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="qd-field-label block">DPI</label>
                                        <input
                                            type="number"
                                            className={fieldClass}
                                            value={createVersionForm.data.dpi}
                                            onChange={(event) => createVersionForm.setData('dpi', event.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="qd-field-label block">Фон</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className={fileFieldClass}
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

                                <div className="space-y-2">
                                    <label className="qd-field-label block">layout_json</label>
                                    <textarea
                                        className={`${jsonFieldClass} min-h-48`}
                                        value={createVersionForm.data.layout_json}
                                        onChange={(event) =>
                                            createVersionForm.setData('layout_json', event.target.value)
                                        }
                                    />
                                    {createVersionForm.errors.layout_json && (
                                        <div className="text-xs text-red-700">
                                            {createVersionForm.errors.layout_json}
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="qd-field-label block">text_rules_json</label>
                                        <textarea
                                            className={`${jsonFieldClass} min-h-36`}
                                            value={createVersionForm.data.text_rules_json}
                                            onChange={(event) =>
                                                createVersionForm.setData('text_rules_json', event.target.value)
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="qd-field-label block">qr_rules_json</label>
                                        <textarea
                                            className={`${jsonFieldClass} min-h-36`}
                                            value={createVersionForm.data.qr_rules_json}
                                            onChange={(event) =>
                                                createVersionForm.setData('qr_rules_json', event.target.value)
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setOpenVersionFor(null)}
                                    >
                                        Отмена
                                    </Button>
                                    <Button type="submit" disabled={createVersionForm.processing}>
                                        Сохранить версию
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
                description={confirmState.description}
                confirmLabel="Опубликовать"
                onConfirm={() => {
                    confirmState.onConfirm?.();
                    setConfirmState({ open: false, description: '', onConfirm: null });
                }}
            />
        </AuthenticatedLayout>
    );
}
