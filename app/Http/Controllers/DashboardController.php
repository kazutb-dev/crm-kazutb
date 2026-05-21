<?php

namespace App\Http\Controllers;

use App\Models\UserActivitySnapshot;
use App\Support\AdminEventCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class DashboardController extends Controller
{
    public function index(Request $request): Response|RedirectResponse
    {
        $role = $request->user()?->resolvedRoleSlug();
        if (!in_array($role, ['admin', 'superadmin'], true)) {
            return redirect()->route('profile.edit');
        }

        $hasIsHidden = Schema::hasColumn('users', 'is_hidden');
        $hasAdLogin = Schema::hasColumn('users', 'ad_login');
        $hasLastLoginAt = Schema::hasColumn('users', 'last_login_at');
        $hasPeriodIdOnEntries = Schema::hasColumn('kpi_entries', 'period_id');
        $entryPeriodColumn = $hasPeriodIdOnEntries ? 'period_id' : 'kpi_period_id';

        $staffQuery = DB::table('users')
            ->when($hasIsHidden, static fn ($q) => $q->where('is_hidden', 0))
            ->whereNotIn('role', ['student']);

        $studentQuery = DB::table('users')
            ->when($hasIsHidden, static fn ($q) => $q->where('is_hidden', 0))
            ->where('role', 'student');

        $staffCount = (clone $staffQuery)->count();
        $studentsCount = (clone $studentQuery)->count();

        $employeesSynced = $hasAdLogin
            ? (clone $staffQuery)->whereNotNull('ad_login')->count()
            : 0;

        $ticketsTotal = Schema::hasTable('tickets') ? DB::table('tickets')->count() : 0;
        $ticketsNew = Schema::hasTable('tickets') ? DB::table('tickets')->where('status', 'new')->count() : 0;
        $ticketsInWork = Schema::hasTable('tickets')
            ? DB::table('tickets')->whereIn('status', ['in_progress', 'processing', 'assigned'])->count()
            : 0;

        $positionRequestsPending = Schema::hasTable('position_change_requests')
            ? DB::table('position_change_requests')->where('status', 'pending')->count()
            : 0;

        $announcementsActive = Schema::hasTable('announcements')
            ? DB::table('announcements')->where('is_active', 1)->count()
            : 0;

        $navigationRoutesActive = Schema::hasTable('navigation_routes')
            ? DB::table('navigation_routes')->where('is_active', 1)->count()
            : 0;

        $calendarUpcoming = Schema::hasTable('calendar_events')
            ? DB::table('calendar_events')
                ->where('starts_at', '>=', now())
                ->where('starts_at', '<=', now()->addDays(7))
                ->count()
            : 0;

        $calendarConflicts = Schema::hasTable('calendar_events')
            ? DB::table('calendar_events')->where('status', 'conflict')->count()
            : 0;

        $libraryReservationsPending = Schema::hasTable('library_reservations')
            ? DB::table('library_reservations')->where('status', 'pending')->count()
            : 0;

        $libraryLoansActive = Schema::hasTable('library_loans')
            ? DB::table('library_loans')->whereDate('issued_at', '>=', now()->subDays(30))->count()
            : 0;

        $certificatesIssuedMonth = Schema::hasTable('certificates')
            ? DB::table('certificates')->whereDate('created_at', '>=', now()->startOfMonth())->count()
            : 0;

        $kpiTotal = Schema::hasTable('kpi_entries') ? DB::table('kpi_entries')->whereNull('deleted_at')->count() : 0;
        $kpiPending = Schema::hasTable('kpi_entries')
            ? DB::table('kpi_entries')
                ->whereNull('deleted_at')
                ->whereIn('status', ['submitted', 'pending_dean', 'pending_structural', 'reviewed'])
                ->count()
            : 0;
        $kpiApproved = Schema::hasTable('kpi_entries')
            ? DB::table('kpi_entries')->whereNull('deleted_at')->where('status', 'approved')->count()
            : 0;

        $onlineUsers = Schema::hasTable('user_activity_snapshots')
            ? UserActivitySnapshot::query()->where('last_seen_at', '>=', now()->subMinutes(5))->count()
            : 0;

        $recentUsers = Schema::hasTable('user_activity_snapshots')
            ? UserActivitySnapshot::query()->where('last_seen_at', '>=', now()->subMinutes(30))->count()
            : 0;

        $auditToday = Schema::hasTable('audit_logs')
            ? DB::table('audit_logs')->whereDate('created_at', today())->count()
            : 0;

        $activityToday = Schema::hasTable('activity_log')
            ? DB::table('activity_log')->whereDate('created_at', today())->count()
            : 0;

        $overviewCards = [
            [
                'key' => 'staff',
                'title' => 'Сотрудники',
                'value' => $staffCount,
                'hint' => $employeesSynced > 0 ? 'Синхронизировано с AD: ' . $employeesSynced : 'Работники CRM без студентов',
                'accent' => 'navy',
                'route' => route('users.index'),
            ],
            [
                'key' => 'students',
                'title' => 'Студенты',
                'value' => $studentsCount,
                'hint' => 'Профили студентов в системе',
                'accent' => 'sky',
                'route' => route('users.students'),
            ],
            [
                'key' => 'tickets',
                'title' => 'Тикеты',
                'value' => $ticketsTotal,
                'hint' => $ticketsNew . ' новых · ' . $ticketsInWork . ' в работе',
                'accent' => 'amber',
                'route' => route('tickets.admin'),
            ],
            [
                'key' => 'position_requests',
                'title' => 'Заявки на должность',
                'value' => $positionRequestsPending,
                'hint' => 'Ожидают решения администратора',
                'accent' => 'rose',
                'route' => route('position-requests.index'),
            ],
            [
                'key' => 'calendar',
                'title' => 'Календарь',
                'value' => $calendarUpcoming,
                'hint' => $calendarConflicts > 0
                    ? $calendarConflicts . ' конфликтов расписания'
                    : 'Событий в ближайшие 7 дней',
                'accent' => 'teal',
                'route' => route('calendar.index'),
            ],
            [
                'key' => 'observability',
                'title' => 'Онлайн сейчас',
                'value' => $onlineUsers,
                'hint' => $recentUsers . ' активны за последние 30 мин',
                'accent' => 'violet',
                'route' => route('admin.monitoring.index'),
            ],
        ];

        $modules = [
            [
                'key' => 'kpi',
                'title' => 'KPI-модуль',
                'total' => $kpiTotal,
                'pending' => $kpiPending,
                'secondary' => 'Одобрено: ' . $kpiApproved,
                'route' => route('kpi.index'),
            ],
            [
                'key' => 'tickets',
                'title' => 'Тикеты и заявки',
                'total' => $ticketsTotal,
                'pending' => $ticketsNew,
                'secondary' => 'В работе: ' . $ticketsInWork,
                'route' => route('tickets.admin'),
            ],
            [
                'key' => 'announcements',
                'title' => 'Объявления',
                'total' => $announcementsActive,
                'pending' => 0,
                'secondary' => 'Активные публикации',
                'route' => route('announcements.index'),
            ],
            [
                'key' => 'library',
                'title' => 'Библиотека',
                'total' => $libraryLoansActive,
                'pending' => $libraryReservationsPending,
                'secondary' => 'Брони ожидают: ' . $libraryReservationsPending,
                'route' => route('library.dashboard'),
            ],
            [
                'key' => 'calendar',
                'title' => 'Smart Calendar',
                'total' => $calendarUpcoming,
                'pending' => $calendarConflicts,
                'secondary' => 'Конфликты: ' . $calendarConflicts,
                'route' => route('calendar.index'),
            ],
            [
                'key' => 'certificates',
                'title' => 'Сертификаты',
                'total' => $certificatesIssuedMonth,
                'pending' => 0,
                'secondary' => 'Выдано в текущем месяце',
                'route' => route('certificates.index'),
            ],
            [
                'key' => 'navigation',
                'title' => 'Маршруты навигации',
                'total' => $navigationRoutesActive,
                'pending' => 0,
                'secondary' => 'Активные маршруты',
                'route' => route('nav.routes.admin'),
            ],
            [
                'key' => 'monitoring',
                'title' => 'Мониторинг и аудит',
                'total' => $activityToday + $auditToday,
                'pending' => 0,
                'secondary' => 'События за сегодня: ' . ($activityToday + $auditToday),
                'route' => route('admin.monitoring.index'),
            ],
        ];

        $usersByRole = DB::table('users')
            ->select('role', DB::raw('COUNT(*) as count'))
            ->when($hasIsHidden, static fn ($q) => $q->where('is_hidden', 0))
            ->whereNotNull('role')
            ->groupBy('role')
            ->orderBy('role')
            ->get()
            ->map(static fn ($row): array => [
                'role' => (string) $row->role,
                'label' => AdminEventCatalog::subjectLabel((string) $row->role),
                'count' => (int) $row->count,
            ])
            ->values();

        $kpiByStatus = Schema::hasTable('kpi_entries')
            ? DB::table('kpi_entries')
                ->select('status', DB::raw('COUNT(*) as count'))
                ->whereNull('deleted_at')
                ->groupBy('status')
                ->orderBy('status')
                ->get()
                ->map(static fn ($row): array => [
                    'status' => (string) $row->status,
                    'count' => (int) $row->count,
                ])
                ->values()
            : collect();

        $ticketsByStatus = Schema::hasTable('tickets')
            ? DB::table('tickets')
                ->select('status', DB::raw('COUNT(*) as count'))
                ->groupBy('status')
                ->orderBy('status')
                ->get()
                ->map(static fn ($row): array => [
                    'status' => (string) $row->status,
                    'count' => (int) $row->count,
                ])
                ->values()
            : collect();

        $calendarByStatus = Schema::hasTable('calendar_events')
            ? DB::table('calendar_events')
                ->select('status', DB::raw('COUNT(*) as count'))
                ->groupBy('status')
                ->orderBy('status')
                ->get()
                ->map(static fn ($row): array => [
                    'status' => (string) $row->status,
                    'count' => (int) $row->count,
                ])
                ->values()
            : collect();

        $trendStart = now()->subDays(13)->startOfDay();

        $auditTrendRaw = Schema::hasTable('audit_logs')
            ? DB::table('audit_logs')
                ->selectRaw('DATE(created_at) as day, COUNT(*) as count')
                ->where('created_at', '>=', $trendStart)
                ->groupBy('day')
                ->orderBy('day')
                ->get()
                ->keyBy('day')
            : collect();

        $activityTrendRaw = Schema::hasTable('activity_log')
            ? DB::table('activity_log')
                ->selectRaw('DATE(created_at) as day, COUNT(*) as count')
                ->where('created_at', '>=', $trendStart)
                ->groupBy('day')
                ->orderBy('day')
                ->get()
                ->keyBy('day')
            : collect();

        $ticketsTrendRaw = Schema::hasTable('tickets')
            ? DB::table('tickets')
                ->selectRaw('DATE(created_at) as day, COUNT(*) as count')
                ->where('created_at', '>=', $trendStart)
                ->groupBy('day')
                ->orderBy('day')
                ->get()
                ->keyBy('day')
            : collect();

        $trend = collect(range(13, 0))
            ->map(static function (int $offset) use ($auditTrendRaw, $activityTrendRaw, $ticketsTrendRaw): array {
                $day = now()->subDays($offset)->format('Y-m-d');

                return [
                    'day' => $day,
                    'audit' => (int) ($auditTrendRaw->get($day)->count ?? 0),
                    'activity' => (int) ($activityTrendRaw->get($day)->count ?? 0),
                    'tickets' => (int) ($ticketsTrendRaw->get($day)->count ?? 0),
                ];
            })
            ->values();

        $recentAudit = Schema::hasTable('audit_logs')
            ? DB::table('audit_logs')
                ->select('id', 'created_at', 'actor_name', 'actor_email', 'event_type', 'subject_type', 'subject_label', 'description', 'ip_address')
                ->latest('id')
                ->limit(25)
                ->get()
                ->map(static fn ($row): array => [
                    'id' => 'audit-' . $row->id,
                    'source' => 'audit',
                    'created_at' => $row->created_at,
                    'actor_name' => $row->actor_name ?: 'Неизвестно',
                    'actor_email' => $row->actor_email,
                    'event_label' => AdminEventCatalog::eventLabel($row->event_type),
                    'module' => AdminEventCatalog::eventModule($row->event_type),
                    'module_label' => AdminEventCatalog::eventModuleLabel($row->event_type),
                    'severity' => AdminEventCatalog::eventSeverity($row->event_type),
                    'severity_label' => AdminEventCatalog::eventSeverityLabel($row->event_type),
                    'subject_name' => AdminEventCatalog::subjectLabel($row->subject_type),
                    'subject_label' => $row->subject_label,
                    'description' => $row->description,
                    'ip_address' => $row->ip_address,
                ])
                ->values()
            : collect();

        $recentActivity = Schema::hasTable('activity_log')
            ? Activity::query()
                ->with('causer:id,name,email')
                ->latest('id')
                ->limit(25)
                ->get()
                ->map(static function ($row): array {
                    $props = $row->properties?->toArray() ?? [];

                    return [
                        'id' => 'activity-' . $row->id,
                        'source' => 'activity',
                        'created_at' => $row->created_at?->toIso8601String(),
                        'actor_name' => $row->causer?->name ?: 'Система',
                        'actor_email' => $row->causer?->email,
                        'event_label' => AdminEventCatalog::eventLabel($row->event),
                        'module' => AdminEventCatalog::eventModule($row->event),
                        'module_label' => AdminEventCatalog::eventModuleLabel($row->event),
                        'severity' => AdminEventCatalog::eventSeverity($row->event),
                        'severity_label' => AdminEventCatalog::eventSeverityLabel($row->event),
                        'subject_name' => AdminEventCatalog::subjectLabel($row->subject_type),
                        'subject_label' => $row->subject_id ? ('#' . $row->subject_id) : null,
                        'description' => $row->description,
                        'ip_address' => data_get($props, 'ip'),
                    ];
                })
                ->values()
            : collect();

        $activityFeed = $recentAudit
            ->concat($recentActivity)
            ->sortByDesc(static fn (array $row): int => strtotime((string) ($row['created_at'] ?? '1970-01-01 00:00:00')))
            ->values()
            ->take(30)
            ->values();

        $attention = collect([
            [
                'key' => 'tickets_new',
                'title' => 'Новые тикеты',
                'value' => $ticketsNew,
                'severity' => $ticketsNew > 20 ? 'high' : ($ticketsNew > 0 ? 'medium' : 'ok'),
                'hint' => 'Проверьте очередь тикетов',
                'route' => route('tickets.admin'),
            ],
            [
                'key' => 'position_pending',
                'title' => 'Заявки на должность в ожидании',
                'value' => $positionRequestsPending,
                'severity' => $positionRequestsPending > 10 ? 'high' : ($positionRequestsPending > 0 ? 'medium' : 'ok'),
                'hint' => 'Требуется решение администратора',
                'route' => route('position-requests.index'),
            ],
            [
                'key' => 'calendar_conflicts',
                'title' => 'Конфликты в календаре',
                'value' => $calendarConflicts,
                'severity' => $calendarConflicts > 0 ? 'medium' : 'ok',
                'hint' => 'Проверьте расписание встреч',
                'route' => route('calendar.analytics'),
            ],
            [
                'key' => 'kpi_pending',
                'title' => 'KPI на согласовании',
                'value' => $kpiPending,
                'severity' => $kpiPending > 100 ? 'high' : ($kpiPending > 0 ? 'medium' : 'ok'),
                'hint' => 'Очередь проверки KPI',
                'route' => route('kpi.review-queue'),
            ],
        ])->values();

        $stats = [
            'staff_total' => $staffCount,
            'students_total' => $studentsCount,
            'employees_synced' => $employeesSynced,
            'faculties' => DB::table('faculties')->count(),
            'departments' => DB::table('departments')->count(),
            'divisions' => DB::table('divisions')->count(),
            'positions' => DB::table('positions')->count(),
            'online_users' => $onlineUsers,
            'recent_users' => $recentUsers,
            'audit_today' => $auditToday,
            'activity_today' => $activityToday,
            'metrics_generated_at' => now()->toIso8601String(),
            'metrics_source' => Cache::get('metrics_source', 'database'),
            'kpi_total' => $kpiTotal,
            'kpi_pending' => $kpiPending,
            'kpi_approved' => $kpiApproved,
        ];

        return Inertia::render('Dashboard', [
            'stats' => $stats,
            'overviewCards' => $overviewCards,
            'modules' => $modules,
            'usersByRole' => $usersByRole,
            'kpiByStatus' => $kpiByStatus,
            'ticketsByStatus' => $ticketsByStatus,
            'calendarByStatus' => $calendarByStatus,
            'trend' => $trend,
            'activityFeed' => $activityFeed,
            'attention' => $attention,
            'quickLinks' => [
                ['title' => 'Мониторинг', 'href' => route('admin.monitoring.index'), 'icon' => 'monitor'],
                ['title' => 'Журнал действий', 'href' => route('admin.audit-logs.index'), 'icon' => 'scroll'],
                ['title' => 'Pulse', 'href' => url('/' . ltrim((string) config('pulse.path', 'pulse'), '/')), 'icon' => 'activity'],
                ['title' => 'Telescope', 'href' => url('/telescope'), 'icon' => 'telescope'],
            ],
        ]);
    }

    public function __invoke(Request $request): Response|RedirectResponse
    {
        return $this->index($request);
    }
}
