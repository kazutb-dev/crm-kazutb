import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function Error403({ message = 'Доступ запрещен.' }) {
    return (
        <AuthenticatedLayout>
            <Head title="403 — Доступ запрещен" />
            <div className="p-6">
                <h1 className="text-2xl font-semibold">403 — Доступ запрещен</h1>
                <p className="mt-4 text-muted-foreground">{message}</p>
            </div>
        </AuthenticatedLayout>
    );
}
