import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';

const defaultVersionJson = {
    layout_json: JSON.stringify(
        {
            fio: { x: 320, y: 320, w: 900, h: 90, font_family: 'Arial', font_size: 48, min_font_size: 24, color: '#000000', align: 'center' },
            topic: { x: 300, y: 430, w: 940, h: 150, font_family: 'Arial', font_size: 30, min_font_size: 18, color: '#222222', align: 'center', max_lines: 3 },
            number: { x: 980, y: 700, w: 260, h: 45, font_family: 'Arial', font_size: 22, color: '#000000', align: 'right' },
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

export default function TemplatesIndex({ templates = [] }) {
    const flash = usePage().props.flash ?? {};
    const [openVersionFor, setOpenVersionFor] = useState(null);

    const createTemplateForm = useForm({
        name: '',
        code: '',
        is_active: true,
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
            onSuccess: () => createTemplateForm.reset(),
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

                        <form onSubmit={submitTemplate} className="grid gap-4 md:grid-cols-3">
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
                                            onChange={(event) =>
                                                createVersionForm.setData('background', event.target.files?.[0] ?? null)
                                            }
                                        />
                                    </div>
                                </div>

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
