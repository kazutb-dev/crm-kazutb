<?php

namespace App\Console\Commands;

use App\Services\ActiveDirectoryAuthenticator;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class RefreshDashboardCache extends Command
{
    protected $signature = 'dashboard:refresh-cache';

    protected $description = 'Refresh dashboard metric cache from local DB';

    public function handle(): int
    {
        $hasIsHidden = Schema::hasColumn('users', 'is_hidden');
        $adService = app(ActiveDirectoryAuthenticator::class);
        $adDirectoryTotals = $adService->countDirectoryUsersByCategory();

        $staffCount = DB::table('users')
            ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
            ->whereNotIn('role', ['student'])
            ->count();

        $studentCount = DB::table('users')
            ->where('role', 'student')
            ->count();

        $hodCount = DB::table('users')
            ->where('role', 'hod')
            ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
            ->count();

        $deanCount = DB::table('users')
            ->where('role', 'dean')
            ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
            ->count();

        $teacherCount = DB::table('users')
            ->where(function ($q) {
                $q->where('role', 'teacher')->orWhereNull('role');
            })
            ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
            ->count();

        $serviceLogins = ['api', 'api-kiosk', 'api-library', 'api-platonus', 'glpi'];

        $adStaffCount = null;
        $adStudentCount = null;

        if (is_array($adDirectoryTotals)) {
            $adStaffCount = max(0, (int) $adDirectoryTotals['staff'] - count($serviceLogins));
            $adStudentCount = (int) ($adDirectoryTotals['students'] ?? 0);
        }

        $loginActivity = DB::table('users')
            ->select(
                DB::raw('DATE(last_login_at) as date'),
                DB::raw('COUNT(*) as logins')
            )
            ->whereNotNull('last_login_at')
            ->where('last_login_at', '>=', now()->subDays(30))
            ->when($hasIsHidden, fn ($q) => $q->where('is_hidden', 0))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $counts = [
            'ad_staff_count' => (int) ($adStaffCount ?? max((int) Cache::get('ad_staff_count', 0), $staffCount)),
            'ad_student_count' => (int) ($adStudentCount ?? max((int) Cache::get('ad_student_count', 0), $studentCount)),
            'ad_hod_count' => max((int) Cache::get('ad_hod_count', 0), $hodCount),
            'ad_dean_count' => max((int) Cache::get('ad_dean_count', 0), $deanCount),
            'ad_teacher_count' => max((int) Cache::get('ad_teacher_count', 0), $teacherCount),
            'db_staff_count' => $staffCount,
            'db_student_count' => $studentCount,
            'db_hod_count' => $hodCount,
            'db_dean_count' => $deanCount,
            'db_teacher_count' => $teacherCount,
            'login_activity_30d' => $loginActivity,
            'metrics_generated_at' => now()->toDateTimeString(),
            'metrics_source' => $adStaffCount !== null ? 'cached' : (Cache::has('ad_staff_count') ? 'cached' : 'database'),
        ];

        foreach ($counts as $key => $value) {
            Cache::put($key, $value, now()->addHours(6));
        }

        $message = 'Dashboard cache refreshed: '.json_encode([
            'ad_staff_count' => $staffCount,
            'ad_student_count' => $studentCount,
            'ad_hod_count' => $hodCount,
            'ad_dean_count' => $deanCount,
            'ad_teacher_count' => $teacherCount,
        ]);

        if ($this->output !== null) {
            $this->info($message);
        } else {
            Log::info($message);
        }

        return self::SUCCESS;
    }
}
