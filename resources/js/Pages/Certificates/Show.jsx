import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link } from '@inertiajs/react';
import { QRCodeCanvas } from 'qrcode.react';
import { InfoField, PageHeader, StatusBadge } from '@/components/platform';
import { ArrowLeft, Award, Eye, Printer, ShieldCheck } from 'lucide-react';

const STATUS_LABELS = {
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
                    <CardContent className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto] print:grid-cols-1">
                        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                            <InfoField label="ФИО" className="sm:col-span-2">{certificate?.recipient_full_name || '—'}</InfoField>
                            <InfoField label="Номер">
                                <span className="font-mono text-sm">{certificate?.certificate_number || '—'}</span>
                            </InfoField>
                            <InfoField label="Статус">
                                <StatusBadge tone={STATUS_TONES[certificate?.status] ?? 'default'}>
                                    {STATUS_LABELS[certificate?.status] ?? certificate?.status ?? '—'}
                                </StatusBadge>
                            </InfoField>
                            <InfoField label="Тема" className="sm:col-span-2">{certificate?.topic || '—'}</InfoField>
                            <InfoField label="Шаблон">
                                {certificate?.template_name || '—'}
                                {certificate?.template_version ? <span className="text-slate-500"> · v{certificate.template_version}</span> : null}
                                {certificate?.template_code ? <span className="block font-mono text-xs font-normal text-slate-500">{certificate.template_code}</span> : null}
                            </InfoField>
                            <InfoField label="Формат">
                                <span className="tabular-nums">{canvasWidth} × {canvasHeight} px</span>
                            </InfoField>
                            <InfoField label="Сгенерирован"><span className="tabular-nums">{certificate?.generated_at_human || '—'}</span></InfoField>
                            <InfoField label="Выдан"><span className="tabular-nums">{certificate?.issued_at_human || '—'}</span></InfoField>
                            <InfoField label="Ссылка проверки" className="sm:col-span-2">
                                <span className="block truncate font-mono text-xs font-normal text-slate-600" title={certificate?.qr_payload ?? ''}>
                                    {certificate?.qr_payload || '—'}
                                </span>
                            </InfoField>
                        </div>

                        <div className="print:hidden flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3">
                            <QRCodeCanvas value={certificate?.qr_payload ?? ''} size={132} includeMargin />
                            <div className="qd-field-label text-slate-500">QR проверки</div>
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
