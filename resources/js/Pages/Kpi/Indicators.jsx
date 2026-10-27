import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageHeader, StatusBadge } from '@/components/platform';
import KpiIndicatorsManager from '@/Pages/Kpi/Partials/KpiIndicatorsManager';
import { Head } from '@inertiajs/react';

export default function Indicators({ indicators, filters = {}, options = {}, permissions = {} }) {
    const total = indicators?.meta?.total ?? indicators?.total ?? null;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="KPI · Справочник"
                    title="KPI-индикаторы"
                    description="Справочник показателей KPI по уровням: баллы, единицы измерения, правила подтверждения и активность индикаторов."
                    meta={total !== null ? <StatusBadge tone="info">Всего: {total}</StatusBadge> : null}
                />
            )}
        >
            <Head title="KPI-индикаторы" />

            <div className="admin-page-wrap space-y-6">
                <KpiIndicatorsManager
                    indicators={indicators}
                    filters={filters}
                    options={options}
                    permissions={permissions}
                    filterRouteName="kpi.indicators.index"
                />
            </div>
        </AuthenticatedLayout>
    );
}
