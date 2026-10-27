import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageHeader } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, LayoutDashboard, ShieldAlert } from 'lucide-react';

export default function Error403({ message = 'Доступ запрещен.' }) {
    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Ошибка 403"
                    title="Доступ запрещен"
                    description="У вашей учётной записи нет прав на этот раздел."
                />
            )}
        >
            <Head title="403 — Доступ запрещен" />

            <div className="admin-page-wrap">
                <Card className="border-dashed border-slate-300">
                    <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                                <ShieldAlert className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 space-y-1">
                                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <span className="text-3xl font-bold tabular-nums text-[#102945]">403</span>
                                    <span className="text-base font-bold text-[#102945]">{message}</span>
                                </p>
                                <p className="text-sm leading-relaxed text-slate-600">
                                    Если доступ нужен для работы, обратитесь к администратору платформы — он может выдать нужную роль или право.
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                            <Button variant="outline" type="button" onClick={() => window.history.back()}>
                                <ArrowLeft />
                                Назад
                            </Button>
                            <Button asChild>
                                <Link href={route('dashboard')}>
                                    <LayoutDashboard />
                                    На главную панели
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
