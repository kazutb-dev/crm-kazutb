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
                <Card className="mx-auto max-w-2xl border-dashed border-slate-300">
                    <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-700">
                            <ShieldAlert className="h-7 w-7" />
                        </div>
                        <div className="max-w-md space-y-2">
                            <p className="font-display text-5xl font-bold tabular-nums text-[#102945]">403</p>
                            <p className="font-display text-lg font-bold text-[#102945]">{message}</p>
                            <p className="text-sm leading-relaxed text-slate-600">
                                Если доступ нужен для работы, обратитесь к администратору платформы — он может выдать нужную роль или право.
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 border-t border-slate-200 pt-5">
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
