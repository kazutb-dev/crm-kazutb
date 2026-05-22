
import { AppSidebar } from '@/components/app-sidebar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Head, usePage, router } from '@inertiajs/react';
import { Home } from 'lucide-react';
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

    const pageTitles = {
        Dashboard: 'Панель управления',
        'Profile/Edit': 'Профиль',
        'Faculties/Index': 'Факультеты',
        'Departments/Index': 'Кафедры',
        'Divisions/Index': 'Департаменты',
        'Departments/Create': 'Новая кафедра',
        'Departments/Edit': 'Редактирование кафедры',
        'AcademicYears/Index': 'Учебные годы',
        'EducationalPrograms/Index': 'Образовательные программы',
        'Users/Index': 'Пользователи',
        'Users/AdminAccess': 'Права администратора',
        'Kpi/Index': 'KPI-сезоны',
        'Kpi/TeacherForm': 'KPI — Мои показатели',
        'Kpi/TeacherDashboard': 'KPI — Мои показатели',
        'Kpi/ReviewQueue': 'KPI — Проверка Завкафедрой',
        'Kpi/ApprovalQueue': 'KPI — Проверка Деканом',
        'Kpi/StructuralQueue': 'KPI — Проверка Структурным подразделением',
        'Kpi/EntryShow': 'KPI-запись',
        'Kpi/Indicators': 'KPI-индикаторы',
        'Kpi/Summary': 'KPI — Сводка',
        'Kpi/StructuralUnitsManager': 'KPI — Структурные подразделения',
        'Kpi/StructuralUnitShow': 'KPI — Структурное подразделение',
        'Kpi/Divisions': 'KPI — Департаменты',
        'Admin/AuditLogs': 'Журнал действий',
        'Admin/Monitoring': 'Мониторинг системы',
        'HR/Dashboard': 'HR / Dashboard',
        'HR/Perco': 'HR / Сотрудники',
        'HR/PercoLate': 'HR / Опоздавшие',
        'HR/PercoAbsence': 'HR / Отсутствующие',
        'HR/PercoEarly': 'HR / Ушедшие раньше',
        'HR/PercoOvertime': 'HR / Переработка',
        'HR/PercoSettings': 'HR / Настройки Perco',
        'Library/Dashboard': 'Библиотека / Dashboard',
        'Library/IssueBook': 'Библиотека / Выдать книгу',
        'Library/ReservationsAdmin': 'Библиотека / Брони',
        'Diplomas/Index': 'Дипломные работы',
        'Tickets/AdminIndex': 'Заявки',
        'Templates/Index': 'Шаблоны сертификатов',
        'Certificates/Index': 'Сертификаты',
        'Certificates/Show': 'Сертификат',
        'Calendar/Index': 'Smart Calendar — Календарь',
        'Calendar/Employees': 'Smart Calendar — Сотрудники',
        'Calendar/Conferences': 'Smart Calendar — Конференции',
        'Calendar/Analytics': 'Smart Calendar — Аналитика',
        'Calendar/Settings': 'Smart Calendar — Настройки',
        'Questionnaire/Student/Index': 'Анкетирование — Студент',
        'Questionnaire/Admin/Specialities': 'Анкетирование — Специальности',
    };

    const pageTitleBase =
        pageTitles[component] ?? component.split('/').at(-1) ?? 'Страница';

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

    const pageTitle = queueScopeTitle ? `${pageTitleBase} — ${queueScopeTitle}` : pageTitleBase;
    const [section = 'Раздел', sectionPage = 'Страница'] = component.split('/');

    return (
        <SidebarProvider>
            <Head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,500..900&family=Manrope:wght@400..800&display=swap" rel="stylesheet" />
            </Head>
            <AppSidebar />
            <SidebarInset>
                <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                    <div className="absolute left-[-120px] top-[-180px] h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl" />
                    <div className="absolute right-[-140px] top-[-140px] h-96 w-96 rounded-full bg-amber-300/20 blur-3xl" />
                </div>

                {/* Reminder Modal for incomplete profile */}
                <ReminderProfileModal
                    open={showReminder}
                    onClose={() => setShowReminder(false)}
                    goToProfile={goToProfile}
                />

                <header className="admin-shell-topbar">
                    <div className="admin-shell-topbar-row">
                        <SidebarTrigger className="h-9 w-9 rounded-md border border-border/80 bg-white/90" />
                        <Separator orientation="vertical" className="h-5" />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-cyan-200 bg-cyan-50/70 text-cyan-900">{section}</Badge>
                                <p className="truncate text-sm font-medium text-muted-foreground/90">{sectionPage}</p>
                            </div>
                            <h1 className="mt-0.5 truncate text-[1.1rem] font-semibold text-[#132844]">{pageTitle}</h1>
                        </div>

                        <a
                            href="http://10.0.1.47/"
                            className="hidden h-9 items-center gap-2 rounded-lg border border-border/80 bg-white/90 px-3 text-sm font-medium text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-accent/30 sm:inline-flex"
                        >
                            <Home className="h-4 w-4" />
                            Главная
                        </a>

                        {headerRight && <div className="admin-header-actions shrink-0">{headerRight}</div>}
                    </div>
                </header>

                {header && (
                    <div className="px-4 pt-4 sm:px-6 sm:pt-6">
                        <div className="admin-surface p-5 sm:p-6">
                            {header}
                        </div>
                    </div>
                )}

                <main className="flex-1">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    );
}
