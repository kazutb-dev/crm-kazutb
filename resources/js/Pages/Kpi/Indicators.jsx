import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import KpiIndicatorsManager from '@/Pages/Kpi/Partials/KpiIndicatorsManager';
import { Head } from '@inertiajs/react';

export default function Indicators({ indicators, filters = {}, options = {}, permissions = {} }) {
    return (
        <AuthenticatedLayout>
            <Head title="KPI-индикаторы" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
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