
import { AppSidebar } from '@/components/app-sidebar';
import { Badge } from '@/components/ui/badge';
import { PanelDesignProvider } from '@/components/ui/panel-design';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Head, usePage, router } from '@inertiajs/react';
import ReminderProfileModal from '@/components/ReminderProfileModal';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function AuthenticatedLayout({ header, headerRight, children }) {
    const page = usePage();
    const { component, props } = page;
    const user = props?.auth?.user;
    const roleSlug = props?.auth?.roleSlug;
    const profileReminderAfterLogin = Boolean(props?.flash?.profileReminderAfterLogin);
    const flash = props?.flash ?? {};
    const errors = props?.errors ?? {};

    // Profile completeness check
    const facultyId = user?.faculty_id;
    const departmentId = user?.department_id;
    const isProfileIncomplete = user && (!facultyId || !departmentId);
    const [showReminder, setShowReminder] = useState(false);
    const lastToastSignatureRef = useRef('');

    useEffect(() => {
        if (profileReminderAfterLogin && isProfileIncomplete) {
            setShowReminder(true);
        }
    }, [profileReminderAfterLogin, isProfileIncomplete]);

    useEffect(() => {
        const success = typeof flash?.success === 'string' ? flash.success.trim() : '';
        const error = typeof flash?.error === 'string' ? flash.error.trim() : '';
        const warning = typeof flash?.warning === 'string' ? flash.warning.trim() : '';
        const kpiError = typeof errors?.kpi_entry === 'string' ? errors.kpi_entry.trim() : '';

        const signature = JSON.stringify({ component, success, error, warning, kpiError });

        if (!success && !error && !warning && !kpiError) {
            return;
        }

        if (lastToastSignatureRef.current === signature) {
            return;
        }

        lastToastSignatureRef.current = signature;

        if (success) {
            toast.success(success);
        }

        if (warning) {
            toast.warning(warning);
        }

        if (error) {
            toast.error(error);
        }

        if (kpiError) {
            toast.error(kpiError);
        }
    }, [component, flash?.success, flash?.error, flash?.warning, errors?.kpi_entry]);

    const goToProfile = () => {
        setShowReminder(false);
        router.visit(route('profile.edit'));
    };

    const queueScopeTitle = (() => {
        if (!['Kpi/ReviewQueue', 'Kpi/ApprovalQueue', 'Kpi/StructuralQueue'].includes(component)) {
            return null;
        }

        if (roleSlug === 'admin' || roleSlug === 'superadmin') {
            return 'Админ';
        }

        if (component === 'Kpi/ReviewQueue' && props?.reviewScope?.type === 'department') {
            return props?.reviewScope?.label ?? null;
        }

        if (component === 'Kpi/ApprovalQueue' && props?.reviewScope?.type === 'faculty') {
            return props?.reviewScope?.label ?? null;
        }

        if (component === 'Kpi/StructuralQueue') {
            const scope = props?.structuralScope;

            if (scope?.type === 'divisions' && Array.isArray(scope.divisions) && scope.divisions.length > 0) {
                const divisionNames = scope.divisions
                    .map((division) => division?.name ?? division?.code)
                    .filter(Boolean);

                if (divisionNames.length > 0) {
                    return divisionNames.join(', ');
                }
            }

            if (scope?.type === 'info' && user?.ad_division) {
                return user.ad_division;
            }

            if (scope?.type === 'unrestricted') {
                return 'Без ограничений';
            }
        }

        return null;
    })();

    return (
        <SidebarProvider>
            <Head />
            <AppSidebar />
            <SidebarInset className="qd-panel">
                <PanelDesignProvider>
                    {/* Reminder Modal for incomplete profile */}
                    <ReminderProfileModal
                        open={showReminder}
                        onClose={() => setShowReminder(false)}
                        goToProfile={goToProfile}
                    />

                    {/* No topbar: on desktop the sidebar collapses from its edge rail or Ctrl+B; phones get a floating menu button. */}
                    <SidebarTrigger
                        aria-label="Открыть меню"
                        className="fixed bottom-4 left-4 z-30 h-12 w-12 rounded-full border border-slate-200 bg-white text-[#102945] shadow-[0_6px_20px_rgba(8,40,52,0.18)] hover:bg-slate-50 md:hidden"
                    />

                    {(header || headerRight || queueScopeTitle) && (
                        <section className="qd-hero">
                            {queueScopeTitle && <Badge className="mb-3 max-w-full truncate">{queueScopeTitle}</Badge>}
                            <div className="flex flex-wrap items-start gap-4">
                                <div className="min-w-0 flex-1 basis-80">{header}</div>
                                {headerRight && <div className="admin-header-actions shrink-0">{headerRight}</div>}
                            </div>
                        </section>
                    )}

                    <main className="flex-1">{children}</main>
                </PanelDesignProvider>
            </SidebarInset>
        </SidebarProvider>
    );
}
