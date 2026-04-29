import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { usePage } from '@inertiajs/react';

export default function AuthenticatedLayout({ header, headerRight, children }) {
    const { component } = usePage();

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
        'Kpi/Index': 'KPI-периоды',
        'Kpi/TeacherForm': 'Моя KPI-форма',
        'Kpi/TeacherDashboard': 'Моя KPI-форма',
        'Kpi/ReviewQueue': 'Очередь проверки KPI',
        'Kpi/ApprovalQueue': 'Очередь утверждения KPI',
        'Kpi/EntryShow': 'KPI-запись',
        'Kpi/Indicators': 'KPI-индикаторы',
        'Kpi/Analytics': 'KPI Аналитика',
        'Admin/AuditLogs': 'Журнал действий',
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
        'Calendar/Employees':   'Smart Calendar — Сотрудники',
        'Calendar/Conferences': 'Smart Calendar — Конференции',
        'Calendar/Analytics':   'Smart Calendar — Аналитика',
        'Calendar/Settings':    'Smart Calendar — Настройки',
    };

    const pageTitle =
        pageTitles[component] ?? component.split('/').at(-1) ?? 'Страница';

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
                    <SidebarTrigger />
                    <Separator orientation="vertical" className="h-5" />
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <p className="truncate text-sm text-muted-foreground">
                            {pageTitle}
                        </p>
                        {headerRight && <div className="shrink-0">{headerRight}</div>}
                    </div>
                </header>

                {header && (
                    <header className="border-b bg-background">
                        <div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
                            {header}
                        </div>
                    </header>
                )}

                <main className="flex-1">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    );
}
