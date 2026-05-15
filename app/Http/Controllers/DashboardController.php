<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response|RedirectResponse
    {
        $role = $request->user()?->resolvedRoleSlug();
        if (! in_array($role, ['admin', 'superadmin'], true)) {
            return redirect()->route('profile.edit');
        }

        $hasIsHidden = Schema::hasColumn('users', 'is_hidden');
        $hasAdLogin = Schema::hasColumn('users', 'ad_login');
        $hasFacultyIdOnDepartments = Schema::hasColumn('departments', 'faculty_id');
        $hasLoginCount = Schema::hasColumn('users', 'login_count');
        $hasLastLoginAt = Schema::hasColumn('users', 'last_login_at');
        $hasPeriodIdOnEntries = Schema::hasColumn('kpi_entries', 'period_id');
        $hasPeriodActiveFlag = Schema::hasColumn('kpi_periods', 'is_active');
        $entryPeriodColumn = $hasPeriodIdOnEntries ? 'period_id' : 'kpi_period_id';
        $serviceAdLogins = ['api', 'api-kiosk', 'api-library', 'api-platonus', 'glpi'];

        $usersByRole = DB::table('users')
            ->select('role', DB::raw('COUNT(*) as count'))
            ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
            ->whereNotNull('role')
            ->groupBy('role')
            ->orderBy('role')
            ->get();

        $usersByFaculty = DB::table('users as u')
            ->join('faculties as f', 'f.id', '=', 'u.faculty_id')
            ->select('f.name as faculty', DB::raw('COUNT(*) as count'))
            ->when($hasIsHidden, fn ($q) => $q->where('u.is_hidden', 0))
            ->groupBy('f.id', 'f.name')
            ->orderBy('count', 'desc')
            ->get();

        $kpiByStatus = DB::table('kpi_entries')
            ->select('status', DB::raw('COUNT(*) as count'))
            ->whereNull('deleted_at')
            ->groupBy('status')
            ->orderBy('status')
            ->get();

        $kpiByMonthRaw = DB::table('kpi_entries')
            ->select(
                DB::raw('DATE_FORMAT(created_at, "%Y-%m") as month'),
                DB::raw('COUNT(*) as count')
            )
            ->whereNull('deleted_at')
            ->where('created_at', '>=', now()->subMonths(12))
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $kpiByMonth = collect(range(11, 0))
            ->map(function (int $offset) use ($kpiByMonthRaw) {
                $month = now()->subMonths($offset)->format('Y-m');
                $row = $kpiByMonthRaw->get($month);

                return [
                    'month' => $month,
                    'count' => (int) ($row->count ?? 0),
                ];
            })
            ->values();

        $usersByDept = DB::table('users as u')
            ->join('departments as d', 'd.id', '=', 'u.department_id')
            ->select('d.name as department', DB::raw('COUNT(*) as count'))
            ->where('u.role', 'teacher')
            ->when($hasIsHidden, fn ($q) => $q->where('u.is_hidden', 0))
            ->groupBy('d.id', 'd.name')
            ->orderBy('count', 'desc')
            ->get();

        $loginActivity = $hasLastLoginAt
            ? Cache::get('login_activity_30d', collect())
            : collect();

        if ($hasLastLoginAt && $loginActivity->isEmpty()) {
            $loginActivity = DB::table('users')
                ->select(
                    DB::raw('DATE(last_login_at) as date'),
                    DB::raw('COUNT(*) as logins')
                )
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->whereNotNull('last_login_at')
                ->where('last_login_at', '>=', now()->subDays(30))
                ->groupBy('date')
                ->orderBy('date')
                ->get();
        }

        $localVisibleStaffCount = DB::table('users')
            ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
            ->whereNotIn('role', ['student'])
            ->when($hasAdLogin, function ($q) use ($serviceAdLogins) {
                $q->where(function ($sub) use ($serviceAdLogins) {
                    $sub->whereNull('ad_login')
                        ->orWhereNotIn('ad_login', $serviceAdLogins);
                });
            })
            ->count();

        $cachedAdStaffCount = (int) Cache::get('ad_staff_count', $localVisibleStaffCount);
        $cachedDbStaffCount = (int) Cache::get('db_staff_count', $localVisibleStaffCount);
        $metricsSource = Cache::get('metrics_source', Cache::has('ad_staff_count') ? 'cached' : 'database');
        $metricsGeneratedAt = Cache::get('metrics_generated_at', now()->toDateTimeString());

        $stats = [
            'total_users' => Cache::get('ad_staff_count', DB::table('users')
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->whereNotIn('role', ['student'])
                ->count()),
            'total_staff_ad' => DB::table('users')
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->when($hasAdLogin, fn ($q) => $q->whereNotNull('ad_login'))
                ->whereNotIn('role', ['student'])
                ->count(),
            'total_students' => Cache::get('ad_student_count', DB::table('users')->where('role', 'student')->count()),
            'total_teachers' => Cache::get('ad_teacher_count', DB::table('users')
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->where(function ($q) {
                    $q->where('role', 'teacher')->orWhereNull('role');
                })
                ->count()),
            'total_hod' => Cache::get('ad_hod_count', DB::table('users')
                ->where('role', 'hod')
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->count()),
            'total_dean' => Cache::get('ad_dean_count', DB::table('users')
                ->where('role', 'dean')
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->count()),
            'total_structural' => DB::table('users')
                ->where('role', 'department')
                ->whereExists(fn ($q) => $q->select(DB::raw(1))
                    ->from('user_division')
                    ->whereColumn('user_division.user_id', 'users.id'))
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->count(),
            'kpi_total' => DB::table('kpi_entries')->whereNull('deleted_at')->count(),
            'kpi_approved' => DB::table('kpi_entries')->whereNull('deleted_at')
                ->where('status', 'approved')->count(),
            'kpi_pending' => DB::table('kpi_entries')->whereNull('deleted_at')
                ->whereIn('status', ['submitted', 'pending_dean', 'pending_structural', 'reviewed'])
                ->count(),
            'kpi_draft' => DB::table('kpi_entries')->whereNull('deleted_at')
                ->where('status', 'draft')->count(),
            'faculties' => DB::table('faculties')->count(),
            'departments' => DB::table('departments')
                ->when($hasFacultyIdOnDepartments, fn ($q) => $q->whereNotNull('faculty_id'))
                ->count(),
            'metrics_generated_at' => $metricsGeneratedAt,
            'metrics_source' => $metricsSource,
        ];

        $kpiByEntityType = DB::table('kpi_entries')
            ->select('entity_type', DB::raw('COUNT(*) as count'))
            ->whereNull('deleted_at')
            ->groupBy('entity_type')
            ->orderBy('entity_type')
            ->get();

        $topUsers = DB::table('users')
            ->select(
                'name',
                'role',
                $hasLoginCount ? 'login_count' : DB::raw('0 as login_count'),
                $hasLastLoginAt ? 'last_login_at' : DB::raw('NULL as last_login_at')
            )
            ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
            ->when($hasLoginCount, fn ($q) => $q->where('login_count', '>', 0))
            ->orderByDesc($hasLoginCount ? 'login_count' : 'created_at')
            ->limit(10)
            ->get();

        $syncStats = [
            'synced' => DB::table('users')->whereNotNull('ad_login')
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->count(),
            'not_synced' => DB::table('users')->whereNull('ad_login')
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->count(),
        ];

        $kpiByFaculty = DB::table('kpi_entries as ke')
            ->join('users as u', 'u.id', '=', 'ke.user_id')
            ->join('faculties as f', 'f.id', '=', 'u.faculty_id')
            ->select(
                'f.name as faculty',
                DB::raw('COUNT(*) as total'),
                DB::raw('SUM(CASE WHEN ke.status="approved" THEN 1 ELSE 0 END) as approved'),
                DB::raw('SUM(CASE WHEN ke.status="draft" THEN 1 ELSE 0 END) as draft'),
                DB::raw('SUM(CASE WHEN ke.status IN ("submitted","pending_dean","pending_structural","reviewed") THEN 1 ELSE 0 END) as pending')
            )
            ->whereNull('ke.deleted_at')
            ->when($hasIsHidden, fn ($q) => $q->where('u.is_hidden', 0))
            ->groupBy('f.id', 'f.name')
            ->get();

        $kpiByDepartment = DB::table('kpi_entries as ke')
            ->join('users as u', 'u.id', '=', 'ke.user_id')
            ->join('departments as d', 'd.id', '=', 'u.department_id')
            ->select(
                DB::raw('SUBSTRING(d.name, 1, 25) as dept'),
                DB::raw('COUNT(*) as total'),
                DB::raw('SUM(CASE WHEN ke.status="approved" THEN 1 ELSE 0 END) as approved')
            )
            ->whereNull('ke.deleted_at')
            ->when($hasIsHidden, fn ($q) => $q->where('u.is_hidden', 0))
            ->groupBy('d.id', 'd.name')
            ->orderBy('total', 'desc')
            ->limit(10)
            ->get();

        $userGrowthRaw = DB::table('users')
            ->select(
                DB::raw('DATE_FORMAT(created_at, "%Y-%m") as month'),
                DB::raw('COUNT(*) as count')
            )
            ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
            ->whereNotNull('created_at')
            ->where('created_at', '>=', now()->subMonths(12))
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $userGrowth = collect(range(11, 0))
            ->map(function (int $offset) use ($userGrowthRaw) {
                $month = now()->subMonths($offset)->format('Y-m');
                $row = $userGrowthRaw->get($month);

                return [
                    'month' => $month,
                    'count' => (int) ($row->count ?? 0),
                ];
            })
            ->values();

        $kpiPeriods = DB::table('kpi_periods')
            ->select('id', 'name', 'start_date', 'end_date', 'status')
            ->orderBy('start_date', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($p) use ($entryPeriodColumn, $hasPeriodActiveFlag) {
                $total = DB::table('kpi_entries')
                    ->where($entryPeriodColumn, $p->id)
                    ->whereNull('deleted_at')
                    ->count();

                $approved = DB::table('kpi_entries')
                    ->where($entryPeriodColumn, $p->id)
                    ->where('status', 'approved')
                    ->whereNull('deleted_at')
                    ->count();

                $pending = DB::table('kpi_entries')
                    ->where($entryPeriodColumn, $p->id)
                    ->whereIn('status', ['submitted', 'pending_dean', 'pending_structural', 'reviewed'])
                    ->whereNull('deleted_at')
                    ->count();

                return [
                    'name' => $p->name,
                    'is_active' => $hasPeriodActiveFlag
                        ? (bool) ($p->is_active ?? false)
                        : ($p->status === 'active'),
                    'start' => $p->start_date,
                    'end' => $p->end_date,
                    'total' => $total,
                    'approved' => $approved,
                    'pending' => $pending,
                    'rate' => $total > 0 ? (int) round(($approved / $total) * 100) : 0,
                ];
            })
            ->values();

        $studentsByFaculty = DB::table('users as u')
            ->join('faculties as f', 'f.id', '=', 'u.faculty_id')
            ->select('f.name as faculty', DB::raw('COUNT(*) as count'))
            ->where('u.role', 'student')
            ->when($hasIsHidden, fn ($q) => $q->where('u.is_hidden', 0))
            ->groupBy('f.id', 'f.name')
            ->get();

        $loginHeatmap = $hasLastLoginAt
            ? DB::table('users')
                ->select(
                    DB::raw('DAYOFWEEK(last_login_at) as dow'),
                    DB::raw('WEEK(last_login_at) as week'),
                    DB::raw('COUNT(*) as count')
                )
                ->whereNotNull('last_login_at')
                ->where('last_login_at', '>=', now()->subWeeks(12))
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->groupBy('dow', 'week')
                ->get()
            : collect();

        $warnings = [
            'hod_no_dept' => DB::table('users')
                ->where('role', 'hod')
                ->whereNull('department_id')
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->count(),
            'dean_no_faculty' => DB::table('users')
                ->where('role', 'dean')
                ->whereNull('faculty_id')
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->count(),
            'structural_no_div' => DB::table('users')
                ->where('role', 'department')
                ->whereNotExists(fn ($q) => $q->select(DB::raw(1))
                    ->from('user_division')
                    ->whereColumn('user_division.user_id', 'users.id'))
                ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
                ->count(),
        ];

        return Inertia::render('Dashboard', [
            'stats' => $stats,
            'metrics_generated_at' => $metricsGeneratedAt,
            'metrics_source' => $metricsSource,
            'usersByRole' => $usersByRole,
            'usersByFaculty' => $usersByFaculty,
            'kpiByStatus' => $kpiByStatus,
            'kpiByMonth' => $kpiByMonth,
            'usersByDept' => $usersByDept,
            'loginActivity' => $loginActivity,
            'kpiByEntityType' => $kpiByEntityType,
            'topUsers' => $topUsers,
            'syncStats' => $syncStats,
            'kpiByFaculty' => $kpiByFaculty,
            'kpiByDepartment' => $kpiByDepartment,
            'userGrowth' => $userGrowth,
            'kpiPeriods' => $kpiPeriods,
            'studentsByFaculty' => $studentsByFaculty,
            'loginHeatmap' => $loginHeatmap,
            'warnings' => $warnings,
        ]);
    }

    public function __invoke(Request $request): Response|RedirectResponse
    {
        return $this->index($request);
    }
}
