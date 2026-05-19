import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link } from '@inertiajs/react';
import { QRCodeCanvas } from 'qrcode.react';

const statusLabel = {
    draft: 'Черновик',
    generated: 'Сгенерирован',
    issued: 'Выдан',
    revoked: 'Отозван',
};

export default function CertificateShow({ certificate }) {
    const canvasWidth = Number(certificate?.template_canvas_width ?? 1600);
    const canvasHeight = Number(certificate?.template_canvas_height ?? 1131);
    const layout = certificate?.template_layout ?? {};

    const textStyle = (field, defaultAlign = 'center') => ({
        position: 'absolute',
        left: `${Number(field?.x ?? 0)}px`,
        top: `${Number(field?.y ?? 0)}px`,
        width: `${Number(field?.w ?? 300)}px`,
        minHeight: `${Number(field?.h ?? 40)}px`,
        color: field?.color ?? '#000000',
        fontSize: `${Number(field?.font_size ?? 24)}px`,
        fontFamily: field?.font_family ?? 'Arial, sans-serif',
        fontWeight: field?.font_weight ?? 'normal',
        fontStyle: field?.font_style ?? 'normal',
        textAlign: field?.align ?? defaultAlign,
        lineHeight: 1.2,
        whiteSpace: 'pre-wrap',
        zIndex: 2,
    });

    const qr = layout?.qr ?? {};

    const openVerify = () => {
        if (!certificate?.qr_payload) {
            return;
        }

        window.open(certificate.qr_payload, '_blank', 'noopener,noreferrer');
    };

    const printCertificate = () => {
        window.print();
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <div>
                        <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                            Сертификат {certificate?.certificate_number}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Просмотр и печать сертификата
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={openVerify}>Проверка</Button>
                        <Button onClick={printCertificate}>Печать</Button>
                        <Button asChild variant="outline">
                            <Link href={route('certificates.index')}>Назад</Link>
                        </Button>
                    </div>
                </div>
            }
        >
            <Head title={`Сертификат ${certificate?.certificate_number ?? ''}`} />

            <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
                <Card className="print:shadow-none print:border-none">
                    <CardHeader className="print:pb-2">
                        <CardTitle>Карточка сертификата</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 print:grid-cols-1">
                        <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Номер:</span> {certificate?.certificate_number}</div>
                            <div><span className="font-medium">ФИО:</span> {certificate?.recipient_full_name}</div>
                            <div><span className="font-medium">Тема:</span> {certificate?.topic}</div>
                            <div>
                                <span className="font-medium">Статус:</span>{' '}
                                <Badge variant="outline">{statusLabel[certificate?.status] ?? certificate?.status}</Badge>
                            </div>
                            <div><span className="font-medium">Выдан:</span> {certificate?.issued_at_human ?? '-'}</div>
                            <div><span className="font-medium">Сгенерирован:</span> {certificate?.generated_at_human ?? '-'}</div>
                            <div><span className="font-medium">Шаблон:</span> {certificate?.template_name} ({certificate?.template_code}) v{certificate?.template_version}</div>
                        </div>

                        <div className="print:hidden flex flex-col items-center justify-center gap-2 rounded-md border bg-white p-4">
                            <QRCodeCanvas value={certificate?.qr_payload ?? ''} size={180} includeMargin />
                            <div className="text-xs text-muted-foreground">QR проверки сертификата</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="print:shadow-none print:border-none">
                    <CardHeader className="print:hidden">
                        <CardTitle>Визуальный сертификат по шаблону</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto rounded-md border bg-muted/10 p-3 print:border-none print:bg-white print:p-0">
                            <div
                                className="relative mx-auto"
                                style={{
                                    width: `${canvasWidth}px`,
                                    height: `${canvasHeight}px`,
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
                                        left: `${Number(qr?.x ?? 95)}px`,
                                        top: `${Number(qr?.y ?? 615)}px`,
                                        zIndex: 2,
                                        background: '#ffffff',
                                        padding: '6px',
                                        borderRadius: '6px',
                                    }}
                                >
                                    <QRCodeCanvas
                                        value={certificate?.qr_payload ?? ''}
                                        size={Number(qr?.size ?? 170)}
                                        includeMargin
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
