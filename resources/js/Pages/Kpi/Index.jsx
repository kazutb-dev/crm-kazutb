import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import KpiPeriodsManager from '@/Pages/Kpi/Partials/KpiPeriodsManager';
import { Head } from '@inertiajs/react';

export default function Index({ periods, academicYears = [], filters = {}, statusOptions = ['draft', 'active', 'closed'], permissions = {} }) {
    return (
        <AuthenticatedLayout>
            <Head title="KPI-сезоны" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
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
