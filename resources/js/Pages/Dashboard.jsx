import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Head } from '@inertiajs/react';

export default function Dashboard({ dashboard }) {
    const kpis = dashboard?.kpis ?? [];
    const monthlySeries = dashboard?.monthlySeries ?? [];
    const monthlyLabels = dashboard?.monthlyLabels ?? [];
    const activity = dashboard?.activity ?? [];
    const health = dashboard?.health ?? [];
    const highlights = dashboard?.highlights ?? [];

    const maxValue = Math.max(...monthlySeries, 1);

    const totalYear = monthlySeries.reduce((sum, item) => sum + item, 0);
    const averageMonth = monthlySeries.length
        ? Math.round(totalYear / monthlySeries.length)
        : 0;
    const peakMonth = Math.max(...monthlySeries, 0);

    const trendVariant = (trend) => {
        if (trend === 'up') {
            return 'default';
        }

        if (trend === 'down') {
            return 'secondary';
        }

        return 'outline';
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                            Панель управления
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Актуальные метрики пользователей и доступов из Платформы
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                            Последние 12 месяцев
                        </Button>
                    </div>
                </div>
            }
        >
            <Head title="Панель управления" />

            <div className="py-8">
                <div className="mx-auto sm:px-6 lg:px-8">
                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {kpis.map((item) => {
                            return (
                                <Card
                                    key={item.title}
                                    className="border-border/80 shadow-sm"
                                >
                                    <CardHeader className="pb-2">
                                        <CardDescription>{item.title}</CardDescription>
                                        <CardTitle className="text-3xl tracking-tight">
                                            {item.value}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Badge variant={trendVariant(item.trend)}>
                                            {item.delta}
                                        </Badge>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </section>

                    <section className="mt-5 grid gap-5 lg:grid-cols-3">
                        <Card className="border-border/80 shadow-sm lg:col-span-2">
                            <CardHeader>
                                <div className="flex items-center justify-between gap-2">
                                    <CardTitle>Регистрации пользователей</CardTitle>
                                    <Badge variant="outline">По месяцам</Badge>
                                </div>
                                <CardDescription>
                                    Регистрации из локальной таблицы пользователей за год.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex h-64 items-end gap-2 rounded-xl bg-muted/30 p-4">
                                    {monthlySeries.map((value, index) => (
                                        <div
                                            key={`${monthlyLabels[index]}-${index}`}
                                            className="flex flex-1 flex-col items-center justify-end"
                                        >
                                            <div
                                                className="w-full rounded-t-md bg-primary/85 transition hover:bg-primary"
                                                style={{
                                                    height: `${(value / maxValue) * 100}%`,
                                                }}
                                                title={`${monthlyLabels[index]}: ${value}`}
                                            />
                                            <span className="mt-2 text-[10px] text-muted-foreground">
                                                {monthlyLabels[index]}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg bg-muted/40 p-4">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                            Всего за год
                                        </p>
                                        <p className="mt-2 text-xl font-semibold text-foreground">
                                            {totalYear}
                                        </p>
                                    </div>
                                    <div className="rounded-lg bg-muted/40 p-4">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                            Среднее в месяц
                                        </p>
                                        <p className="mt-2 text-xl font-semibold text-foreground">
                                            {averageMonth}
                                        </p>
                                    </div>
                                    <div className="rounded-lg bg-muted/40 p-4">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                            Пик за месяц
                                        </p>
                                        <p className="mt-2 text-xl font-semibold text-foreground">
                                            {peakMonth}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/80 shadow-sm">
                            <CardHeader>
                                <CardTitle>Лента активности</CardTitle>
                                <CardDescription>Последние события по локальным аккаунтам.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {activity.map((event, index) => (
                                    <div key={`${event.title}-${index}`} className="space-y-1">
                                        <p className="text-sm font-medium text-foreground">
                                            {event.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {event.subtitle}
                                        </p>
                                        <p className="text-xs text-muted-foreground/80">
                                            {event.time}
                                        </p>
                                        {index < activity.length - 1 && <Separator className="mt-3" />}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </section>

                    <section className="mt-5 grid gap-5 lg:grid-cols-2">
                        <Card className="border-border/80 shadow-sm">
                            <CardHeader>
                                <CardTitle>Качество данных</CardTitle>
                                <CardDescription>
                                    Покрытие и консистентность локальных данных пользователей.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {health.map((item) => (
                                    <div key={item.name}>
                                        <div className="mb-1 flex items-center justify-between">
                                            <p className="text-sm font-medium text-foreground">
                                                {item.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {item.owner}
                                            </p>
                                        </div>
                                        <Progress
                                            value={Math.min(item.progress, 100)}
                                            className="h-2"
                                        />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="border-border/80 shadow-sm">
                            <CardHeader>
                                <CardTitle>Ключевые показатели</CardTitle>
                                <CardDescription>
                                    Краткая сводка по пользователям и интеграции с AD.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {highlights.map((item) => (
                                    <div
                                        key={item.title}
                                        className="rounded-lg border border-border bg-muted/20 p-4"
                                    >
                                        <p className="text-sm font-semibold text-foreground">
                                            {item.title}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {item.meta}
                                        </p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
