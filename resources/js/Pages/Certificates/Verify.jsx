import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head } from '@inertiajs/react';
import { QRCodeCanvas } from 'qrcode.react';

const statusLabel = {
    generated: 'Сгенерирован',
    issued: 'Выдан',
    revoked: 'Отозван',
};

export default function CertificateVerify({ valid, status, message, certificate }) {
    const canvasWidth = Number(certificate?.template_canvas_width ?? 1600);
    const canvasHeight = Number(certificate?.template_canvas_height ?? 1131);
    const layout = certificate?.template_layout ?? {};

    const escapeFilenamePart = (value) => String(value ?? 'certificate')
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'certificate';

    const textStyle = (field, defaultAlign = 'center') => ({
        position: 'absolute',
        left: `${(Number(field?.x ?? 0) / canvasWidth) * 100}%`,
        top: `${(Number(field?.y ?? 0) / canvasHeight) * 100}%`,
        width: `${(Number(field?.w ?? 300) / canvasWidth) * 100}%`,
        minHeight: `${(Number(field?.h ?? 40) / canvasHeight) * 100}%`,
        color: field?.color ?? '#000000',
        fontSize: `clamp(10px, ${(Number(field?.font_size ?? 24) / canvasWidth) * 100}cqw, ${Number(field?.font_size ?? 24)}px)`,
        fontFamily: field?.font_family ?? 'Arial, sans-serif',
        fontWeight: field?.font_weight ?? 'normal',
        fontStyle: field?.font_style ?? 'normal',
        textAlign: field?.align ?? defaultAlign,
        lineHeight: 1.2,
        whiteSpace: 'pre-wrap',
        zIndex: 2,
    });

    const qr = layout?.qr ?? {};

    const downloadQrPng = () => {
        const qrCanvas = document.getElementById('verify-qr-canvas');

        if (!(qrCanvas instanceof HTMLCanvasElement)) {
            return;
        }

        const link = document.createElement('a');
        link.href = qrCanvas.toDataURL('image/png');
        link.download = `${escapeFilenamePart(certificate?.certificate_number)}-qr.png`;
        link.click();
    };

    const drawWrappedText = (ctx, text, x, y, maxWidth, lineHeight, align) => {
        const source = String(text ?? '');
        const words = source.split(/\s+/).filter(Boolean);

        if (words.length === 0) {
            return;
        }

        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i += 1) {
            const test = `${currentLine} ${words[i]}`;
            if (ctx.measureText(test).width <= maxWidth) {
                currentLine = test;
            } else {
                lines.push(currentLine);
                currentLine = words[i];
            }
        }

        lines.push(currentLine);

        lines.forEach((line, index) => {
            let drawX = x;
            if (align === 'center') {
                drawX = x + (maxWidth / 2);
            }
            if (align === 'right') {
                drawX = x + maxWidth;
            }

            ctx.fillText(line, drawX, y + (index * lineHeight));
        });
    };

    const loadImage = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

    const downloadCertificatePng = async () => {
        try {
            const output = document.createElement('canvas');
            output.width = canvasWidth;
            output.height = canvasHeight;

            const ctx = output.getContext('2d');
            if (!ctx) {
                return;
            }

            if (certificate?.template_background_url) {
                const bg = await loadImage(certificate.template_background_url);
                ctx.drawImage(bg, 0, 0, canvasWidth, canvasHeight);
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            }

            const drawField = (field, text, defaultAlign = 'center') => {
                if (!field) return;

                const x = Number(field?.x ?? 0);
                const y = Number(field?.y ?? 0);
                const w = Number(field?.w ?? 300);
                const h = Number(field?.h ?? 40);
                const fontSize = Number(field?.font_size ?? 24);
                const fontFamily = field?.font_family ?? 'Arial, sans-serif';
                const fontWeight = field?.font_weight ?? 'normal';
                const fontStyle = field?.font_style ?? 'normal';

                ctx.fillStyle = field?.color ?? '#000000';
                ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
                ctx.textAlign = field?.align ?? defaultAlign;
                ctx.textBaseline = 'top';

                drawWrappedText(
                    ctx,
                    text,
                    x,
                    y,
                    w,
                    Math.max(18, Number((fontSize * 1.25).toFixed(0))),
                    field?.align ?? defaultAlign,
                );

                if (h > 0) {
                    // noop: reserved height from template for visual consistency
                }
            };

            drawField(layout?.fio, certificate?.recipient_full_name);

            const qrCanvas = document.getElementById('verify-qr-canvas');
            if (qrCanvas instanceof HTMLCanvasElement) {
                const qrSize = Number(qr?.size ?? 170);
                const qrX = Number(qr?.x ?? 95);
                const qrY = Number(qr?.y ?? 615);

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12);
                ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
            }

            const link = document.createElement('a');
            link.href = output.toDataURL('image/png');
            link.download = `${escapeFilenamePart(certificate?.certificate_number)}.png`;
            link.click();
        } catch {
            // ignore download errors in UI-only flow
        }
    };

    return (
        <>
            <Head title={certificate?.certificate_number ? `Проверка ${certificate.certificate_number}` : 'Проверка сертификата'} />
            <div className="admin-page-wrap">
                <Card>
                    <CardHeader>
                        <CardTitle>Проверка сертификата</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">Статус проверки:</span>
                            <Badge variant={valid ? 'default' : 'destructive'}>
                                {valid ? 'Действителен' : 'Недействителен'}
                            </Badge>
                            {status && <Badge variant="outline">{statusLabel[status] ?? status}</Badge>}
                        </div>
                        {message && <p className="text-muted-foreground">{message}</p>}

                        {certificate && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                <Button type="button" size="sm" variant="outline" onClick={downloadCertificatePng}>
                                    Скачать сертификат PNG
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={downloadQrPng}>
                                    Скачать QR PNG
                                </Button>
                            </div>
                        )}

                        {certificate && (
                            <div className="grid gap-2 text-sm sm:grid-cols-2">
                                <div><span className="font-medium">Номер:</span> {certificate.certificate_number}</div>
                                <div><span className="font-medium">ФИО:</span> {certificate.recipient_full_name}</div>
                                <div className="sm:col-span-2"><span className="font-medium">Тема:</span> {certificate.topic}</div>
                                <div><span className="font-medium">Выдан:</span> {certificate.issued_at_human ?? '-'}</div>
                                <div><span className="font-medium">Сгенерирован:</span> {certificate.generated_at_human ?? '-'}</div>
                                {certificate.revoked_at_human && (
                                    <div><span className="font-medium">Отозван:</span> {certificate.revoked_at_human}</div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {certificate && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Изображение сертификата</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border bg-white p-3">
                                <div
                                    className="relative mx-auto w-full"
                                    style={{
                                        maxWidth: `${canvasWidth}px`,
                                        aspectRatio: `${canvasWidth} / ${canvasHeight}`,
                                        containerType: 'inline-size',
                                    }}
                                >
                                    {certificate?.template_background_url && (
                                        <img
                                            src={certificate.template_background_url}
                                            alt="Certificate template"
                                            className="absolute inset-0 h-full w-full object-cover"
                                        />
                                    )}

                                    <div style={textStyle(layout?.fio)}>{certificate?.recipient_full_name}</div>

                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: `${(Number(qr?.x ?? 95) / canvasWidth) * 100}%`,
                                            top: `${(Number(qr?.y ?? 615) / canvasHeight) * 100}%`,
                                            zIndex: 2,
                                            background: '#ffffff',
                                            padding: '0.45cqw',
                                            borderRadius: '6px',
                                        }}
                                    >
                                        <QRCodeCanvas
                                            id="verify-qr-canvas"
                                            value={certificate?.qr_payload ?? ''}
                                            size={Number(qr?.size ?? 170)}
                                            style={{
                                                width: `max(72px, ${(Number(qr?.size ?? 170) / canvasWidth) * 100}cqw)`,
                                                height: 'auto',
                                            }}
                                            includeMargin
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}
