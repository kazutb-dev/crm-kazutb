import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link } from '@inertiajs/react';
import { QRCodeCanvas } from 'qrcode.react';
import { InfoField, PageHeader } from '@/components/platform';
import { ArrowLeft, Award, Eye, Printer, ShieldCheck } from 'lucide-react';

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
                <div className="print:hidden">
                    <PageHeader
                        eyebrow="Сертификаты"
                        title="Сертификат"
                        description="Просмотр и печать сертификата"
                        actions={(
                            <>
                                <Button asChild variant="ghost" className="gap-2">
                                    <Link href={route('certificates.registry.page')}>
                                        <ArrowLeft className="h-4 w-4" />
                                        Назад
                                    </Link>
                                </Button>
                                <Button variant="outline" onClick={openVerify} className="gap-2">
                                    <ShieldCheck className="h-4 w-4" />
                                    Проверка
                                </Button>
                                <Button onClick={printCertificate} className="gap-2">
                                    <Printer className="h-4 w-4" />
                                    Печать
                                </Button>
                            </>
                        )}
                    />
                </div>
            }
        >
            <Head title="Сертификат" />

            <div className="admin-page-wrap space-y-6">
                <Card className="print:shadow-none print:border-none">
                    <CardHeader className="print:pb-2">
                        <CardTitle className="flex items-center gap-2">
                            <Award className="h-4 w-4" />
                            Карточка сертификата
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto] print:grid-cols-1">
                        <InfoField label="ФИО">{certificate?.recipient_full_name}</InfoField>

                        <div className="print:hidden flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
                            <QRCodeCanvas value={certificate?.qr_payload ?? ''} size={180} includeMargin />
                            <div className="qd-field-label text-slate-500">QR проверки сертификата</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="print:shadow-none print:border-none">
                    <CardHeader className="print:hidden">
                        <CardTitle className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Визуальный сертификат по шаблону
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-3 print:border-none print:bg-white print:p-0">
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
