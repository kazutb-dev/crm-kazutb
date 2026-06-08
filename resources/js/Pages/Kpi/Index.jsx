import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageHeader } from '@/components/platform';
import KpiPeriodsManager from '@/Pages/Kpi/Partials/KpiPeriodsManager';
import { Head } from '@inertiajs/react';

export default function Index({ periods, academicYears = [], filters = {}, statusOptions = ['draft', 'active', 'closed'], permissions = {} }) {
    return (
        <AuthenticatedLayout>
            <Head title="KPI-сезоны" />

            <div className="admin-page-wrap space-y-4">
                <PageHeader
                    eyebrow="KPI"
                    title="KPI-сезоны"
                    description="Управление периодами KPI и календарным циклом оценки."
                />
                <KpiPeriodsManager
                    periods={periods}
                    academicYears={academicYears}
                    filters={filters}
                    statusOptions={statusOptions}
                    permissions={permissions}
                    filterRouteName="kpi.index"
                />
            </div>
        </AuthenticatedLayout>
    );
}
