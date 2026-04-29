<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class PercoController extends Controller
{
    private const HR_PERCO_DIVISION_VISIBILITY_KEY = 'hr_perco_division_visibility';

    private const DEFAULT_HIDDEN_DIVISION_NEEDLES = [
        'арендатор',
        'колледж',
        'магистрат',
        'бакалавр',
        'студент',
    ];

    public function all(Request $request): Response
    {
        $search = trim((string) $request->input('q', ''));
        $divRaw = $request->input('division', '');
        $divNorm = is_string($divRaw) ? trim($divRaw) : $divRaw;
        $divId = ($divNorm === null || $divNorm === '' || (string) $divNorm === '0') ? '' : (int) $divNorm;

        $divisionRows = $this->activeDivisions();
        $visibility = $this->divisionVisibilitySetting($divisionRows);

        $query = DB::connection('perco')
            ->table('user as u')
            ->leftJoin('user_staff as s', 's.user_id', '=', 'u.id')
            ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
            ->leftJoin('position as p', 'p.id', '=', 'u.position_id')
            ->select([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name as division',
                'p.name as position',
                's.tabel_number',
                's.hiring_date',
                's.dismissed_date',
                's.is_dismissed',
                'u.is_active',
                'u.is_block',
                'u.division_id',
            ])
            ->where('u.is_removed', 0)
            ->where('u.user_type_id', 1)
            ->whereNotNull('s.user_id')
            ->where('s.is_dismissed', 0);

        $this->applyDivisionVisibility($query, $visibility, 'u.division_id');

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('u.last_name', 'like', $like)
                    ->orWhere('u.first_name', 'like', $like)
                    ->orWhere('u.middle_name', 'like', $like)
                    ->orWhere('s.tabel_number', 'like', $like);
            });
        }

        if ($divId !== '') {
            $query->where('u.division_id', $divId);
        }

        $staff = $query
            ->orderBy('d.name')
            ->orderBy('u.last_name')
            ->orderBy('u.first_name')
            ->paginate(50)
            ->withQueryString();

        return Inertia::render('HR/Perco', [
            'staff' => $staff,
            'divisions' => $this->visibleDivisionOptions($divisionRows, $visibility),
            'filters' => [
                'q' => $search,
                'division' => (string) $divId,
            ],
        ]);
    }

    public function late(Request $request): Response
    {
        $search = trim((string) $request->input('q', ''));
        $divRaw = $request->input('division', '');
        $divNorm = is_string($divRaw) ? trim($divRaw) : $divRaw;
        $divId = ($divNorm === null || $divNorm === '' || (string) $divNorm === '0') ? '' : (int) $divNorm;

        $daysRaw = (int) $request->input('days', 1);
        $days = in_array($daysRaw, [-1, 0, 1, 7, 14, 30], true) ? $daysRaw : 1;
        $fromParam = trim((string) $request->input('from', ''));
        $to = Carbon::now('Asia/Almaty')->toDateString();

        if ($fromParam && strtotime($fromParam)) {
            $from = date('Y-m-d', strtotime($fromParam));
            $days = max(1, (int) ceil((strtotime($to) - strtotime($from)) / 86400) + 1);
        } elseif ($days === -1) {
            $yesterday = Carbon::now('Asia/Almaty')->subDay()->toDateString();
            $from = $yesterday;
            $to = $yesterday;
        } elseif ($days === 0) {
            $from = null;
        } else {
            $from = Carbon::now('Asia/Almaty')->subDays($days - 1)->toDateString();
        }

        $divisionRows = $this->activeDivisions();
        $visibility = $this->divisionVisibilitySetting($divisionRows);

        $baseScope = DB::connection('perco')
            ->table('user as u')
            ->leftJoin('user_staff as s', 's.user_id', '=', 'u.id')
            ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
            ->leftJoin('position as p', 'p.id', '=', 'u.position_id')
            ->join('timetracking_result_data as t', 't.user_id', '=', 'u.id')
            ->where('u.is_removed', 0)
            ->where('u.user_type_id', 1)
            ->whereNotNull('s.user_id')
            ->where('s.is_dismissed', 0)
            ->where('t.late_time', '>', 0);

        $this->applyDivisionVisibility($baseScope, $visibility, 'u.division_id');

        if ($search !== '') {
            $like = '%' . $search . '%';
            $baseScope->where(function ($q) use ($like) {
                $q->where('u.last_name', 'like', $like)
                    ->orWhere('u.first_name', 'like', $like)
                    ->orWhere('u.middle_name', 'like', $like)
                    ->orWhere('s.tabel_number', 'like', $like);
            });
        }

        if ($divId !== '') {
            $baseScope->where('u.division_id', $divId);
        }

        $holidays = $this->holidayDates();
            if ($holidays !== []) {
                $baseScope->whereNotIn('t.date', $holidays);
            }

        if ($from === null) {
            $minDate = (clone $baseScope)->min('t.date');
            $from = $minDate ?: $to;
        }

        $isTodayRange = $from === $to && $to === Carbon::now('Asia/Almaty')->toDateString();

        if ($isTodayRange && !in_array($to, $holidays, true)) {
            $todayStart = "{$to} 00:00:00";
            $todayEnd = "{$to} 23:59:59";

            $firstEnterToday = DB::connection('perco')
                ->table('event as e')
                ->leftJoin('work_event_ignore as wei', 'wei.event_access_id', '=', 'e.id')
                ->selectRaw('e.user_id as user_id')
                ->selectRaw('DATE(e.time_label) as event_date')
                ->selectRaw($this->firstEnterExpr('e') . ' as first_enter_at')
                ->whereNotNull('e.user_id')
                ->whereNull('wei.event_access_id')
                ->whereBetween('e.time_label', [$todayStart, $todayEnd])
                ->groupBy(['e.user_id', DB::raw('DATE(e.time_label)')]);

            $realtimeBase = DB::connection('perco')
                ->table('user as u')
                ->leftJoin('user_staff as s', 's.user_id', '=', 'u.id')
                ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
                ->leftJoin('position as p', 'p.id', '=', 'u.position_id')
                ->joinSub($firstEnterToday, 'fe', function ($join) {
                    $join->on('fe.user_id', '=', 'u.id');
                })
                ->where('u.is_removed', 0)
                ->where('u.user_type_id', 1)
                ->whereNotNull('s.user_id')
                ->where('s.is_dismissed', 0)
                ->whereTime('fe.first_enter_at', '>', '08:30:00');

            $this->applyDivisionVisibility($realtimeBase, $visibility, 'u.division_id');

            if ($search !== '') {
                $like = '%' . $search . '%';
                $realtimeBase->where(function ($q) use ($like) {
                    $q->where('u.last_name', 'like', $like)
                        ->orWhere('u.first_name', 'like', $like)
                        ->orWhere('u.middle_name', 'like', $like)
                        ->orWhere('s.tabel_number', 'like', $like);
                });
            }

            if ($divId !== '') {
                $realtimeBase->where('u.division_id', $divId);
            }

            $lateSecondsExpr = "TIMESTAMPDIFF(SECOND, CONCAT(fe.event_date, ' 08:30:00'), fe.first_enter_at)";

            $staff = (clone $realtimeBase)
                ->select([
                    'u.id',
                    'u.last_name',
                    'u.first_name',
                    'u.middle_name',
                    'd.name as division',
                    'p.name as position',
                    's.tabel_number',
                    'u.division_id',
                ])
                ->selectRaw('1 as late_count')
                ->selectRaw($lateSecondsExpr . ' as total_late_time')
                ->selectRaw($lateSecondsExpr . ' as avg_late_time')
                ->selectRaw('fe.event_date as last_late_date')
                ->orderByDesc('total_late_time')
                ->orderBy('u.last_name')
                ->paginate(50)
                ->withQueryString();

            $summary = (clone $realtimeBase)
                ->selectRaw('COUNT(*) as late_events')
                ->selectRaw('COUNT(DISTINCT u.id) as late_people')
                ->selectRaw('COALESCE(SUM(' . $lateSecondsExpr . '), 0) as total_late_time')
                ->selectRaw('COALESCE(AVG(' . $lateSecondsExpr . '), 0) as avg_late_time')
                ->first();

            $divisionStats = (clone $realtimeBase)
                ->selectRaw('COALESCE(d.name, "Без подразделения") as division')
                ->selectRaw('COUNT(*) as late_events')
                ->selectRaw('COUNT(DISTINCT u.id) as late_people')
                ->groupBy(['u.division_id', 'd.name'])
                ->orderByDesc('late_events')
                ->limit(8)
                ->get();

            $latestLateDate = ((int) ($summary->late_events ?? 0)) > 0
                ? $to
                : (clone $baseScope)->max('t.date');
        } else {
            $latestLateDate = (clone $baseScope)->max('t.date');

            $baseQuery = (clone $baseScope)->whereBetween('t.date', [$from, $to]);

            $staff = (clone $baseQuery)
                ->select([
                    'u.id',
                    'u.last_name',
                    'u.first_name',
                    'u.middle_name',
                    'd.name as division',
                    'p.name as position',
                    's.tabel_number',
                    'u.division_id',
                ])
                ->selectRaw('COUNT(*) as late_count')
                ->selectRaw('COALESCE(SUM(t.late_time), 0) as total_late_time')
                ->selectRaw('COALESCE(AVG(t.late_time), 0) as avg_late_time')
                ->selectRaw('MAX(t.date) as last_late_date')
                ->groupBy([
                    'u.id',
                    'u.last_name',
                    'u.first_name',
                    'u.middle_name',
                    'd.name',
                    'p.name',
                    's.tabel_number',
                    'u.division_id',
                ])
                ->orderByDesc('late_count')
                ->orderByDesc('total_late_time')
                ->orderBy('u.last_name')
                ->paginate(50)
                ->withQueryString();

            $summary = (clone $baseQuery)
                ->selectRaw('COUNT(*) as late_events')
                ->selectRaw('COUNT(DISTINCT u.id) as late_people')
                ->selectRaw('COALESCE(SUM(t.late_time), 0) as total_late_time')
                ->selectRaw('COALESCE(AVG(t.late_time), 0) as avg_late_time')
                ->first();

            $divisionStats = (clone $baseQuery)
                ->select('d.name as division')
                ->selectRaw('COUNT(*) as late_events')
                ->selectRaw('COUNT(DISTINCT u.id) as late_people')
                ->groupBy(['u.division_id', 'd.name'])
                ->orderByDesc('late_events')
                ->limit(8)
                ->get();
        }

        return Inertia::render('HR/PercoLate', [
            'staff' => $staff,
            'divisions' => $this->visibleDivisionOptions($divisionRows, $visibility),
            'summary' => $summary,
            'divisionStats' => $divisionStats,
            'latestLateDate' => $latestLateDate,
            'filters' => [
                'q' => $search,
                'division' => (string) $divId,
                'days' => $days,
                'from' => $fromParam,
            ],
            'range' => [
                'from' => $from,
                'to' => $to,
            ],
        ]);
    }

    public function absence(Request $request): Response
    {
        $search = trim((string) $request->input('q', ''));
        $divRaw = $request->input('division', '');
        $divNorm = is_string($divRaw) ? trim($divRaw) : $divRaw;
        $divId = ($divNorm === null || $divNorm === '' || (string) $divNorm === '0') ? '' : (int) $divNorm;

        $daysRaw = (int) $request->input('days', 1);
        $days = in_array($daysRaw, [-1, 0, 1, 7, 14, 30], true) ? $daysRaw : 1;
        $fromParam = trim((string) $request->input('from', ''));
        $to = Carbon::now('Asia/Almaty')->toDateString();

        if ($fromParam && strtotime($fromParam)) {
            $from = date('Y-m-d', strtotime($fromParam));
            $days = max(1, (int) ceil((strtotime($to) - strtotime($from)) / 86400) + 1);
        } elseif ($days === -1) {
            $yesterday = Carbon::now('Asia/Almaty')->subDay()->toDateString();
            $from = $yesterday;
            $to = $yesterday;
        } elseif ($days === 0) {
            $from = null;
        } else {
            $from = Carbon::now('Asia/Almaty')->subDays($days - 1)->toDateString();
        }

        $divisionRows = $this->activeDivisions();
        $visibility = $this->divisionVisibilitySetting($divisionRows);

        // Analog of taReports/absence: users with absent time and no presence for day.
        $baseScope = DB::connection('perco')
            ->table('user as u')
            ->leftJoin('user_staff as s', 's.user_id', '=', 'u.id')
            ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
            ->leftJoin('position as p', 'p.id', '=', 'u.position_id')
            ->join('timetracking_result_data as t', 't.user_id', '=', 'u.id')
            ->where('u.is_removed', 0)
            ->where('u.user_type_id', 1)
            ->whereNotNull('s.user_id')
            ->where('s.is_dismissed', 0)
            ->where('t.absent_time', '>', 0)
            ->where(function ($q) {
                $q->whereNull('t.presence_time')
                    ->orWhere('t.presence_time', '<=', 0);
            });

        $this->applyDivisionVisibility($baseScope, $visibility, 'u.division_id');

        if ($search !== '') {
            $like = '%' . $search . '%';
            $baseScope->where(function ($q) use ($like) {
                $q->where('u.last_name', 'like', $like)
                    ->orWhere('u.first_name', 'like', $like)
                    ->orWhere('u.middle_name', 'like', $like)
                    ->orWhere('s.tabel_number', 'like', $like);
            });
        }

        if ($divId !== '') {
            $baseScope->where('u.division_id', $divId);
        }

        if ($from === null) {
            $minDate = (clone $baseScope)->min('t.date');
            $from = $minDate ?: $to;
        }

        $latestAbsenceDate = (clone $baseScope)->max('t.date');
        $baseQuery = (clone $baseScope)->whereBetween('t.date', [$from, $to]);

        $staff = (clone $baseQuery)
            ->select([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name as division',
                'p.name as position',
                's.tabel_number',
                'u.division_id',
            ])
            ->selectRaw('COUNT(*) as absence_count')
            ->selectRaw('COALESCE(SUM(t.absent_time), 0) as total_absent_time')
            ->selectRaw('COALESCE(AVG(t.absent_time), 0) as avg_absent_time')
            ->selectRaw('MAX(t.date) as last_absence_date')
            ->groupBy([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name',
                'p.name',
                's.tabel_number',
                'u.division_id',
            ])
            ->orderByDesc('absence_count')
            ->orderByDesc('total_absent_time')
            ->orderBy('u.last_name')
            ->paginate(50)
            ->withQueryString();

        $summary = (clone $baseQuery)
            ->selectRaw('COUNT(*) as absence_events')
            ->selectRaw('COUNT(DISTINCT u.id) as absence_people')
            ->selectRaw('COALESCE(SUM(t.absent_time), 0) as total_absent_time')
            ->selectRaw('COALESCE(AVG(t.absent_time), 0) as avg_absent_time')
            ->first();

        $divisionStats = (clone $baseQuery)
            ->select('d.name as division')
            ->selectRaw('COUNT(*) as absence_events')
            ->selectRaw('COUNT(DISTINCT u.id) as absence_people')
            ->groupBy(['u.division_id', 'd.name'])
            ->orderByDesc('absence_events')
            ->limit(8)
            ->get();

        return Inertia::render('HR/PercoAbsence', [
            'staff' => $staff,
            'divisions' => $this->visibleDivisionOptions($divisionRows, $visibility),
            'summary' => $summary,
            'divisionStats' => $divisionStats,
            'latestAbsenceDate' => $latestAbsenceDate,
            'filters' => [
                'q' => $search,
                'division' => (string) $divId,
                'days' => $days,
                'from' => $fromParam,
            ],
            'range' => [
                'from' => $from,
                'to' => $to,
            ],
        ]);
    }

    public function early(Request $request): Response
    {
        $search = trim((string) $request->input('q', ''));
        $divRaw = $request->input('division', '');
        $divNorm = is_string($divRaw) ? trim($divRaw) : $divRaw;
        $divId = ($divNorm === null || $divNorm === '' || (string) $divNorm === '0') ? '' : (int) $divNorm;

        $daysRaw = (int) $request->input('days', 1);
        $days = in_array($daysRaw, [-1, 0, 1, 7, 14, 30], true) ? $daysRaw : 1;
        $fromParam = trim((string) $request->input('from', ''));
        $to = Carbon::now('Asia/Almaty')->toDateString();

        if ($fromParam && strtotime($fromParam)) {
            $from = date('Y-m-d', strtotime($fromParam));
            $days = max(1, (int) ceil((strtotime($to) - strtotime($from)) / 86400) + 1);
        } elseif ($days === -1) {
            $yesterday = Carbon::now('Asia/Almaty')->subDay()->toDateString();
            $from = $yesterday;
            $to = $yesterday;
        } elseif ($days === 0) {
            $from = null;
        } else {
            $from = Carbon::now('Asia/Almaty')->subDays($days - 1)->toDateString();
        }

        $divisionRows = $this->activeDivisions();
        $visibility = $this->divisionVisibilitySetting($divisionRows);

        // Analog of taReports/early: users with early leave time.
        $baseScope = DB::connection('perco')
            ->table('user as u')
            ->leftJoin('user_staff as s', 's.user_id', '=', 'u.id')
            ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
            ->leftJoin('position as p', 'p.id', '=', 'u.position_id')
            ->join('timetracking_result_data as t', 't.user_id', '=', 'u.id')
            ->where('u.is_removed', 0)
            ->where('u.user_type_id', 1)
            ->whereNotNull('s.user_id')
            ->where('s.is_dismissed', 0)
            ->where('t.early_time', '>', 0);

        $this->applyDivisionVisibility($baseScope, $visibility, 'u.division_id');

        if ($search !== '') {
            $like = '%' . $search . '%';
            $baseScope->where(function ($q) use ($like) {
                $q->where('u.last_name', 'like', $like)
                    ->orWhere('u.first_name', 'like', $like)
                    ->orWhere('u.middle_name', 'like', $like)
                    ->orWhere('s.tabel_number', 'like', $like);
            });
        }

        if ($divId !== '') {
            $baseScope->where('u.division_id', $divId);
        }

        $holidays = $this->holidayDates();

        if ($from === null) {
            $minDate = (clone $baseScope)->min('t.date');
            $from = $minDate ?: $to;
        }

        $lastExitByDay = DB::connection('perco')
            ->table('event as e')
            ->leftJoin('work_event_ignore as wei', 'wei.event_access_id', '=', 'e.id')
            ->selectRaw('e.user_id as user_id')
            ->selectRaw('DATE(e.time_label) as event_date')
            ->selectRaw($this->lastExitExpr('e') . ' as last_exit_at')
            ->whereNotNull('e.user_id')
            ->whereNull('wei.event_access_id')
            ->whereBetween('e.time_label', ["{$from} 00:00:00", "{$to} 23:59:59"])
            ->groupBy(['e.user_id', DB::raw('DATE(e.time_label)')]);

        $latestEarlyDate = (clone $baseScope)->max('t.date');
        $baseQuery = (clone $baseScope)->whereBetween('t.date', [$from, $to]);

        $staff = (clone $baseQuery)
            ->leftJoinSub($lastExitByDay, 'le', function ($join) {
                $join->on('le.user_id', '=', 'u.id')
                    ->on('le.event_date', '=', 't.date');
            })
            ->select([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name as division',
                'p.name as position',
                's.tabel_number',
                'u.division_id',
            ])
            ->selectRaw('COUNT(*) as early_count')
            ->selectRaw('COALESCE(SUM(t.early_time), 0) as total_early_time')
            ->selectRaw('COALESCE(AVG(t.early_time), 0) as avg_early_time')
            ->selectRaw('MAX(t.date) as last_early_date')
            ->selectRaw('MAX(TIME(le.last_exit_at)) as leave_time')
            ->groupBy([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name',
                'p.name',
                's.tabel_number',
                'u.division_id',
            ])
            ->orderByDesc('early_count')
            ->orderByDesc('total_early_time')
            ->orderBy('u.last_name')
            ->paginate(50)
            ->withQueryString();

        $summary = (clone $baseQuery)
            ->selectRaw('COUNT(*) as early_events')
            ->selectRaw('COUNT(DISTINCT u.id) as early_people')
            ->selectRaw('COALESCE(SUM(t.early_time), 0) as total_early_time')
            ->selectRaw('COALESCE(AVG(t.early_time), 0) as avg_early_time')
            ->first();

        $divisionStats = (clone $baseQuery)
            ->select('d.name as division')
            ->selectRaw('COUNT(*) as early_events')
            ->selectRaw('COUNT(DISTINCT u.id) as early_people')
            ->groupBy(['u.division_id', 'd.name'])
            ->orderByDesc('early_events')
            ->limit(8)
            ->get();

        return Inertia::render('HR/PercoEarly', [
            'staff' => $staff,
            'divisions' => $this->visibleDivisionOptions($divisionRows, $visibility),
            'summary' => $summary,
            'divisionStats' => $divisionStats,
            'latestEarlyDate' => $latestEarlyDate,
            'filters' => [
                'q' => $search,
                'division' => (string) $divId,
                'days' => $days,
                'from' => $fromParam,
            ],
            'range' => [
                'from' => $from,
                'to' => $to,
            ],
        ]);
    }

    public function lateEmployee(Request $request): Response
    {
        $userId = (int) $request->input('user_id', 0);
        $search = trim((string) $request->input('q', ''));
        $divRaw = $request->input('division', '');
        $divNorm = is_string($divRaw) ? trim($divRaw) : $divRaw;
        $divId = ($divNorm === null || $divNorm === '' || (string) $divNorm === '0') ? '' : (int) $divNorm;

        $fromRaw = (string) $request->input('from', now()->startOfMonth()->toDateString());
        $toRaw = (string) $request->input('to', now()->toDateString());
        $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $fromRaw) ? $fromRaw : now()->startOfMonth()->toDateString();
        $to = preg_match('/^\d{4}-\d{2}-\d{2}$/', $toRaw) ? $toRaw : now()->toDateString();

        if ($from > $to) {
            [$from, $to] = [$to, $from];
        }

        if ($userId <= 0) {
            abort(404);
        }

        $divisionRows = $this->activeDivisions();
        $visibility = $this->divisionVisibilitySetting($divisionRows);

        $baseScope = DB::connection('perco')
            ->table('user as u')
            ->leftJoin('user_staff as s', 's.user_id', '=', 'u.id')
            ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
            ->leftJoin('position as p', 'p.id', '=', 'u.position_id')
            ->join('timetracking_result_data as t', 't.user_id', '=', 'u.id')
            ->where('u.is_removed', 0)
            ->where('u.user_type_id', 1)
            ->whereNotNull('s.user_id')
            ->where('s.is_dismissed', 0)
            ->where('t.late_time', '>', 0);

        $this->applyDivisionVisibility($baseScope, $visibility, 'u.division_id');

        $baseScope->where('u.id', $userId);

        $employee = (clone $baseScope)
            ->whereBetween('t.date', [$from, $to])
            ->select([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name as division',
                'p.name as position',
                's.tabel_number',
            ])
            ->selectRaw('COUNT(*) as late_count')
            ->selectRaw('COALESCE(SUM(t.late_time), 0) as total_late_time')
            ->selectRaw('COALESCE(AVG(t.late_time), 0) as avg_late_time')
            ->selectRaw('MAX(t.date) as last_late_date')
            ->groupBy([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name',
                'p.name',
                's.tabel_number',
            ])
            ->first();

        if (!$employee) {
            abort(404);
        }

        $firstEnterByDay = DB::connection('perco')
            ->table('event as e')
            ->leftJoin('work_event_ignore as wei', 'wei.event_access_id', '=', 'e.id')
            ->selectRaw('e.user_id as user_id')
            ->selectRaw('DATE(e.time_label) as event_date')
            ->selectRaw($this->firstEnterExpr('e') . ' as first_enter_at')
            ->where('e.user_id', $userId)
            ->whereNull('wei.event_access_id')
            ->whereBetween('e.time_label', ["{$from} 00:00:00", "{$to} 23:59:59"])
            ->groupBy(['e.user_id', DB::raw('DATE(e.time_label)')]);

        $events = (clone $baseScope)
            ->whereBetween('t.date', [$from, $to])
            ->leftJoinSub($firstEnterByDay, 'fe', function ($join) {
                $join->on('fe.user_id', '=', 'u.id')
                    ->on('fe.event_date', '=', 't.date');
            })
            ->selectRaw('t.date as late_date')
            ->selectRaw('t.late_time as late_time')
            ->selectRaw('TIME(fe.first_enter_at) as first_enter_time')
            ->orderByDesc('t.date')
            ->get();

        return Inertia::render('HR/PercoLateEmployee', [
            'employee' => $employee,
            'events' => $events,
            'filters' => [
                'q' => $search,
                'division' => (string) $divId,
                'from' => $from,
                'to' => $to,
            ],
        ]);
    }

    public function overtime(Request $request): Response
    {
        $search = trim((string) $request->input('q', ''));
        $divRaw = $request->input('division', '');
        $divNorm = is_string($divRaw) ? trim($divRaw) : $divRaw;
        $divId = ($divNorm === null || $divNorm === '' || (string) $divNorm === '0') ? '' : (int) $divNorm;

        $daysRaw = (int) $request->input('days', 1);
        $days = in_array($daysRaw, [-1, 0, 1, 7, 14, 30], true) ? $daysRaw : 1;
        $fromParam = trim((string) $request->input('from', ''));
        $to = Carbon::now('Asia/Almaty')->toDateString();

        if ($fromParam && strtotime($fromParam)) {
            $from = date('Y-m-d', strtotime($fromParam));
            $days = max(1, (int) ceil((strtotime($to) - strtotime($from)) / 86400) + 1);
        } elseif ($days === -1) {
            $yesterday = Carbon::now('Asia/Almaty')->subDay()->toDateString();
            $from = $yesterday;
            $to = $yesterday;
        } elseif ($days === 0) {
            $from = null;
        } else {
            $from = Carbon::now('Asia/Almaty')->subDays($days - 1)->toDateString();
        }

        $divisionRows = $this->activeDivisions();
        $visibility = $this->divisionVisibilitySetting($divisionRows);

        $baseScope = DB::connection('perco')
            ->table('user as u')
            ->leftJoin('user_staff as s', 's.user_id', '=', 'u.id')
            ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
            ->leftJoin('position as p', 'p.id', '=', 'u.position_id')
            ->join('timetracking_result_data as t', 't.user_id', '=', 'u.id')
            ->where('u.is_removed', 0)
            ->where('u.user_type_id', 1)
            ->whereNotNull('s.user_id')
            ->where('s.is_dismissed', 0)
            ->whereRaw('COALESCE(NULLIF(t.presence_time, 0), t.work_time, 0) > 0');

        $this->applyDivisionVisibility($baseScope, $visibility, 'u.division_id');

        if ($search !== '') {
            $like = '%' . $search . '%';
            $baseScope->where(function ($q) use ($like) {
                $q->where('u.last_name', 'like', $like)
                    ->orWhere('u.first_name', 'like', $like)
                    ->orWhere('u.middle_name', 'like', $like)
                    ->orWhere('s.tabel_number', 'like', $like);
            });
        }

        if ($divId !== '') {
            $baseScope->where('u.division_id', $divId);
        }

        if ($from === null) {
            $minDate = (clone $baseScope)->min('t.date');
            $from = $minDate ?: $to;
        }

        $latestOvertimeDate = (clone $baseScope)->max('t.date');
        $baseQuery = (clone $baseScope)->whereBetween('t.date', [$from, $to]);

        $staff = (clone $baseQuery)
            ->select([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name as division',
                'p.name as position',
                't.date as work_date',
                't.presence_time',
                't.work_time as source_work_time',
            ])
            ->orderByDesc(DB::raw('COALESCE(NULLIF(t.presence_time, 0), t.work_time, 0)'))
            ->orderByDesc('t.date')
            ->simplePaginate(50)
            ->withQueryString();

        $pageRows = collect($staff->items());

        if ($pageRows->isNotEmpty()) {
            $pageUserIds = $pageRows
                ->pluck('id')
                ->map(static fn ($id): int => (int) $id)
                ->unique()
                ->values()
                ->all();

            $pageDates = $pageRows->pluck('work_date')->unique()->values()->all();

            $dailyEvents = DB::connection('perco')
                ->table('event as e')
                ->leftJoin('work_event_ignore as wei', 'wei.event_access_id', '=', 'e.id')
                ->selectRaw('e.user_id as user_id')
                ->selectRaw('DATE(e.time_label) as event_date')
                ->selectRaw($this->firstEnterExpr('e') . ' as first_enter_at')
                ->selectRaw($this->lastEnterExpr('e') . ' as last_enter_at')
                ->selectRaw($this->lastExitExpr('e') . ' as last_exit_at')
                ->selectRaw("GROUP_CONCAT(CASE WHEN " . $this->enterConditionExpr('e') . " THEN DATE_FORMAT(e.time_label, '%H:%i') END ORDER BY e.time_label SEPARATOR ', ') as enter_times")
                ->selectRaw("GROUP_CONCAT(CASE WHEN " . $this->exitConditionExpr('e') . " THEN DATE_FORMAT(e.time_label, '%H:%i') END ORDER BY e.time_label SEPARATOR ', ') as exit_times")
                ->whereNotNull('e.user_id')
                ->whereIn('e.user_id', $pageUserIds)
                ->whereNull('wei.event_access_id')
                ->whereIn(DB::raw('DATE(e.time_label)'), $pageDates)
                ->groupBy(['e.user_id', DB::raw('DATE(e.time_label)')])
                ->get()
                ->keyBy(static fn ($row): string => $row->user_id . '|' . $row->event_date);

            $staff->setCollection($pageRows->map(function ($row) use ($dailyEvents, $holidays) {
                $eventKey = $row->id . '|' . $row->work_date;
                $eventRow = $dailyEvents->get($eventKey);

                $firstEnter = $eventRow?->first_enter_at ? Carbon::parse($eventRow->first_enter_at) : null;
                $lastEnter = $eventRow?->last_enter_at ? Carbon::parse($eventRow->last_enter_at) : null;
                $lastExit = $eventRow?->last_exit_at ? Carbon::parse($eventRow->last_exit_at) : null;
                $workedSeconds = (int) ($row->presence_time ?: $row->source_work_time ?: 0);
                $exitPrevDay = $lastEnter
                    && $lastExit
                    && $lastEnter->gt($lastExit)
                    && $lastExit->format('H:i:s') <= '08:30:00';

                $row->first_enter_time = $firstEnter?->format('H:i:s');
                $row->enter_times = $eventRow?->enter_times !== null && $eventRow->enter_times !== ''
                    ? array_values(array_filter(array_map('trim', explode(',', (string) $eventRow->enter_times))))
                    : [];
                $row->last_exit_time = ($lastEnter && $lastExit && $lastEnter->eq($lastExit))
                    ? null
                    : $lastExit?->format('H:i:s');
                $row->exit_prev_day = (bool) $exitPrevDay;
                $row->exit_times = $eventRow?->exit_times !== null && $eventRow->exit_times !== ''
                    ? array_values(array_filter(array_map('trim', explode(',', (string) $eventRow->exit_times))))
                    : [];

                $row->work_time = $workedSeconds;
                $row->overtime_time = 0;

                return $row;
            }));

            // Mark cross-date overnight transitions for calculations.
            $staff->setCollection($this->movePrevDayExitTimes($staff->getCollection(), 'work_date'));

            // Recalculate by shift windows: 08:30-12:30 and 13:30-17:30.
            $staff->setCollection($staff->getCollection()->map(function ($row) {
                $enterTimes = array_merge(
                    is_array($row->enter_times ?? null) ? $row->enter_times : [],
                    is_array($row->enter_times_from_prev_day ?? null) ? $row->enter_times_from_prev_day : []
                );

                $buckets = $this->calcShiftBucketsSeconds(
                    $enterTimes,
                    $row->exit_times ?? [],
                    $row->exit_times_from_next_day ?? [],
                    (string) ($row->work_date ?? ''),
                );
                $row->work_time = $buckets['worked'];
                $row->overtime_time = $buckets['overtime'];

                return $row;
            }));
        }

        $summary = (clone $baseQuery)
            ->selectRaw('COUNT(*) as overtime_days')
            ->selectRaw('COUNT(DISTINCT u.id) as overtime_people')
            ->selectRaw('COALESCE(SUM(COALESCE(NULLIF(t.presence_time, 0), t.work_time, 0)), 0) as total_work_time')
            ->selectRaw('COALESCE(SUM(t.over_time), 0) as total_overtime_time')
            ->first();

        if ($summary && $staff->getCollection()->isNotEmpty()) {
            $summary->total_work_time = (int) $staff->getCollection()->sum(fn ($row) => (int) ($row->work_time ?? 0));
            $summary->total_overtime_time = (int) $staff->getCollection()->sum(fn ($row) => (int) ($row->overtime_time ?? 0));
        }

        return Inertia::render('HR/PercoOvertime', [
            'staff' => $staff,
            'divisions' => $this->visibleDivisionOptions($divisionRows, $visibility),
            'summary' => $summary,
            'latestOvertimeDate' => $latestOvertimeDate,
            'filters' => [
                'q' => $search,
                'division' => (string) $divId,
                'days' => $days,
                'from' => $fromParam,
            ],
            'range' => [
                'from' => $from,
                'to' => $to,
            ],
        ]);
    }

    public function timetracking(Request $request): Response
    {
        $search = trim((string) $request->input('q', ''));
        $divRaw = $request->input('division', '');
        $divNorm = is_string($divRaw) ? trim($divRaw) : $divRaw;
        $divId = ($divNorm === null || $divNorm === '' || (string) $divNorm === '0') ? '' : (int) $divNorm;

        $daysRaw = (int) $request->input('days', 30);
        $days = in_array($daysRaw, [-1, 0, 1, 7, 14, 30], true) ? $daysRaw : 30;
        $fromParam = trim((string) $request->input('from', ''));
        $toParam = trim((string) $request->input('to', ''));

        $to = ($toParam && strtotime($toParam))
            ? date('Y-m-d', strtotime($toParam))
            : Carbon::now('Asia/Almaty')->toDateString();

        if ($fromParam && strtotime($fromParam)) {
            $from = date('Y-m-d', strtotime($fromParam));
            $days = max(1, (int) ceil((strtotime($to) - strtotime($from)) / 86400) + 1);
        } elseif ($days === -1) {
            $yesterday = Carbon::now('Asia/Almaty')->subDay()->toDateString();
            $from = $yesterday;
            $to = $yesterday;
        } elseif ($days === 0) {
            $from = null;
        } else {
            $from = Carbon::parse($to, 'Asia/Almaty')->subDays($days - 1)->toDateString();
        }

        $divisionRows = $this->activeDivisions();
        $visibility = $this->divisionVisibilitySetting($divisionRows);

        $baseScope = DB::connection('perco')
            ->table('user as u')
            ->leftJoin('user_staff as s', 's.user_id', '=', 'u.id')
            ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
            ->leftJoin('position as p', 'p.id', '=', 'u.position_id')
            ->join('timetracking_result_data as t', 't.user_id', '=', 'u.id')
            ->where('u.is_removed', 0)
            ->where('u.user_type_id', 1)
            ->whereNotNull('s.user_id')
            ->where('s.is_dismissed', 0);

        $this->applyDivisionVisibility($baseScope, $visibility, 'u.division_id');

        if ($search !== '') {
            $like = '%' . $search . '%';
            $baseScope->where(function ($q) use ($like) {
                $q->where('u.last_name', 'like', $like)
                    ->orWhere('u.first_name', 'like', $like)
                    ->orWhere('u.middle_name', 'like', $like)
                    ->orWhere('s.tabel_number', 'like', $like);
            });
        }

        if ($divId !== '') {
            $baseScope->where('u.division_id', $divId);
        }

        $holidays = $this->holidayDates();

        if ($from === null) {
            $minDate = (clone $baseScope)->min('t.date');
            $from = $minDate ?: $to;
        }

        $baseQuery = (clone $baseScope)->whereBetween('t.date', [$from, $to]);

        $staff = (clone $baseQuery)
            ->select([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name as division',
                'p.name as position',
                't.date as work_date',
                't.presence_time',
                't.work_time as source_work_time',
                't.absent_time',
                't.late_time',
                't.early_time',
                't.over_time',
            ])
            ->orderByDesc('t.date')
            ->orderBy('u.last_name')
            ->orderBy('u.first_name')
            ->paginate(50)
            ->withQueryString();

        $pageRows = collect($staff->items());

        if ($pageRows->isNotEmpty()) {
            $pageUserIds = $pageRows
                ->pluck('id')
                ->map(static fn ($id): int => (int) $id)
                ->unique()
                ->values()
                ->all();

            $pageDates = $pageRows->pluck('work_date')->unique()->values()->all();

            $dailyEvents = DB::connection('perco')
                ->table('event as e')
                ->leftJoin('work_event_ignore as wei', 'wei.event_access_id', '=', 'e.id')
                ->selectRaw('e.user_id')
                ->selectRaw('DATE(e.time_label) as event_date')
                ->selectRaw($this->firstEnterExpr('e') . ' as first_enter_at')
                ->selectRaw($this->lastEnterExpr('e') . ' as last_enter_at')
                ->selectRaw($this->lastExitExpr('e') . ' as last_exit_at')
                ->selectRaw("GROUP_CONCAT(CASE WHEN " . $this->enterConditionExpr('e') . " THEN DATE_FORMAT(e.time_label, '%H:%i') END ORDER BY e.time_label SEPARATOR ', ') as enter_times")
                ->selectRaw("GROUP_CONCAT(CASE WHEN " . $this->exitConditionExpr('e') . " THEN DATE_FORMAT(e.time_label, '%H:%i') END ORDER BY e.time_label SEPARATOR ', ') as exit_times")
                ->whereNotNull('e.user_id')
                ->whereNull('wei.event_access_id')
                ->whereIn('e.user_id', $pageUserIds)
                ->whereIn(DB::raw('DATE(e.time_label)'), $pageDates)
                ->groupBy(['e.user_id', DB::raw('DATE(e.time_label)')])
                ->get()
                ->keyBy(static fn ($row): string => $row->user_id . '|' . $row->event_date);

            $staff->setCollection($pageRows->map(function ($row) use ($dailyEvents, $holidays) {
                $eventKey = $row->id . '|' . $row->work_date;
                $eventRow = $dailyEvents->get($eventKey);

                $firstEnter = $eventRow?->first_enter_at ? Carbon::parse($eventRow->first_enter_at) : null;
                $lastEnter = $eventRow?->last_enter_at ? Carbon::parse($eventRow->last_enter_at) : null;
                $lastExit  = $eventRow?->last_exit_at  ? Carbon::parse($eventRow->last_exit_at)  : null;
                $exitPrevDay = $lastEnter
                    && $lastExit
                    && $lastEnter->gt($lastExit)
                    && $lastExit->format('H:i:s') <= '08:30:00';

                $row->first_enter_time = $firstEnter?->format('H:i');
                $row->enter_times = $eventRow?->enter_times !== null && $eventRow->enter_times !== ''
                    ? array_values(array_filter(array_map('trim', explode(',', (string) $eventRow->enter_times))))
                    : [];
                // Equal enter/exit means there is no reliable final exit event.
                $row->last_exit_time = ($lastEnter && $lastExit && $lastEnter->eq($lastExit))
                    ? null
                    : $lastExit?->format('H:i');
                $row->exit_prev_day = (bool) $exitPrevDay;
                $row->exit_times = $eventRow?->exit_times !== null && $eventRow->exit_times !== ''
                    ? array_values(array_filter(array_map('trim', explode(',', (string) $eventRow->exit_times))))
                    : [];

                $row->work_time = (int) ($row->presence_time ?: $row->source_work_time ?: 0);
                $row->is_holiday = in_array((string) ($row->work_date ?? ''), $holidays, true);
                $row->is_weekend = Carbon::parse((string) ($row->work_date ?? 'now'), 'Asia/Almaty')->isWeekend();
                $row->is_non_working_day = $row->is_holiday || $row->is_weekend;

                return $row;
            }));

            // Mark cross-date overnight transitions for calculations.
            $staff->setCollection($this->movePrevDayExitTimes($staff->getCollection(), 'work_date'));

            // Recalculate by shift windows: 08:30-12:30 and 13:30-17:30.
            $staff->setCollection($staff->getCollection()->map(function ($row) {
                $enterTimes = array_merge(
                    is_array($row->enter_times ?? null) ? $row->enter_times : [],
                    is_array($row->enter_times_from_prev_day ?? null) ? $row->enter_times_from_prev_day : []
                );

                $buckets = $this->calcShiftBucketsSeconds(
                    $enterTimes,
                    $row->exit_times ?? [],
                    $row->exit_times_from_next_day ?? [],
                    (string) ($row->work_date ?? ''),
                );
                $expectedShift = $this->calcExpectedShiftSeconds((string) ($row->work_date ?? ''));
                $row->work_time = $buckets['worked'];
                $row->over_time = $buckets['overtime'];
                $row->absent_time = max(0, $expectedShift - $buckets['worked']);

                // Early leave should not be shown for the current day while it is still in progress.
                $todayAlmaty = Carbon::now('Asia/Almaty')->toDateString();
                if ((string) ($row->work_date ?? '') === $todayAlmaty) {
                    $row->early_time = 0;
                }

                return $row;
            }));
        }

        $summary = (clone $baseQuery)
            ->selectRaw('COUNT(DISTINCT u.id) as total_people')
            ->selectRaw('COUNT(t.date) as total_work_days')
            ->selectRaw('SUM(COALESCE(NULLIF(t.presence_time, 0), t.work_time, 0)) as total_presence')
            ->selectRaw('SUM(t.absent_time) as total_absent')
            ->first();

        if ($summary && $staff->getCollection()->isNotEmpty()) {
            $summary->total_presence = (int) $staff->getCollection()->sum(fn ($row) => (int) ($row->work_time ?? 0));
            $summary->total_absent = (int) $staff->getCollection()->sum(fn ($row) => (int) ($row->absent_time ?? 0));
        }

        return Inertia::render('HR/PercoTimetracking', [
            'staff' => $staff,
            'divisions' => $this->visibleDivisionOptions($divisionRows, $visibility),
            'summary' => $summary,
            'filters' => [
                'q' => $search,
                'division' => (string) $divId,
                'days' => $days,
                'from' => $fromParam,
                'to' => $toParam,
            ],
            'range' => [
                'from' => $from,
                'to' => $to,
            ],
        ]);
    }

    public function dayEvents(Request $request): Response
    {
        $userId = (int) $request->input('user_id', 0);
        $date = trim((string) $request->input('date', ''));
        $back = trim((string) $request->input('back', ''));

        if ($userId <= 0 || !$date || !strtotime($date)) {
            abort(404);
        }

        $date = date('Y-m-d', strtotime($date));
        $from = "{$date} 00:00:00";
        $to = "{$date} 23:59:59";

        $employee = DB::connection('perco')
            ->table('user as u')
            ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
            ->leftJoin('position as p', 'p.id', '=', 'u.position_id')
            ->where('u.id', $userId)
            ->select([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name as division',
                'p.name as position',
            ])
            ->first();

        if (!$employee) {
            abort(404);
        }

        $outsideZoneIds = $this->outsideAccessZoneIds();

        $events = DB::connection('perco')
            ->table('event as e')
            ->leftJoin('access_zone as z1', 'z1.id', '=', 'e.access_zone_id1')
            ->leftJoin('access_zone as z2', 'z2.id', '=', 'e.access_zone_id2')
            ->leftJoin('work_event_ignore as wei', 'wei.event_access_id', '=', 'e.id')
            ->where('e.user_id', $userId)
            ->whereBetween('e.time_label', [$from, $to])
            ->orderBy('e.time_label')
            ->get([
                'e.id',
                'e.time_label',
                'e.event_type',
                'e.device_id',
                'e.resource_type',
                'e.resource_number',
                'e.access_zone_id1',
                'e.access_zone_id2',
                'z2.name as zone_exit',
                'z1.name as zone_enter',
                'wei.event_access_id',
            ])
            ->map(function ($row) use ($outsideZoneIds): array {
                $zone1 = $row->access_zone_id1 !== null ? (int) $row->access_zone_id1 : null;
                $zone2 = $row->access_zone_id2 !== null ? (int) $row->access_zone_id2 : null;

                $isOutside1 = $zone1 === null || $zone1 === 0 || in_array($zone1, $outsideZoneIds, true);
                $isOutside2 = $zone2 === null || $zone2 === 0 || in_array($zone2, $outsideZoneIds, true);

                // In this PERCo installation: outside->inside means "exit", inside->outside means "enter".
                $direction = null;
                if ($isOutside1 && !$isOutside2) {
                    $direction = 'exit';
                } elseif (!$isOutside1 && $isOutside2) {
                    $direction = 'enter';
                }

                return [
                    'id' => (int) $row->id,
                    'time_label' => (string) $row->time_label,
                    'event_type' => (int) ($row->event_type ?? 0),
                    'device_id' => (int) ($row->device_id ?? 0),
                    'resource_type' => (int) ($row->resource_type ?? 0),
                    'resource_number' => (int) ($row->resource_number ?? 0),
                    'access_zone_id1' => $zone1,
                    'access_zone_id2' => $zone2,
                    'zone_exit' => (string) ($row->zone_exit ?? '—'),
                    'zone_enter' => (string) ($row->zone_enter ?? '—'),
                    'ignored' => $row->event_access_id !== null,
                    'direction' => $direction,
                ];
            })
            ->values();

        return Inertia::render('HR/PercoDayEvents', [
            'employee' => $employee,
            'events' => $events,
            'date' => $date,
            'back' => $back,
        ]);
    }

    public function dashboard(Request $request): Response
    {
        $divRaw = $request->input('division', '');
        $divNorm = is_string($divRaw) ? trim($divRaw) : $divRaw;
        $divId = ($divNorm === null || $divNorm === '' || (string) $divNorm === '0') ? '' : (int) $divNorm;

        $daysRaw = (int) $request->input('days', 1);
        $days = in_array($daysRaw, [-1, 0, 1, 7, 14, 30], true) ? $daysRaw : 1;

        $fromParam = trim((string) $request->input('from', ''));
        $to = Carbon::now('Asia/Almaty')->toDateString();
        
        if ($fromParam && strtotime($fromParam)) {
            $from = date('Y-m-d', strtotime($fromParam));
            $days = max(1, (int) ceil((strtotime($to) - strtotime($from)) / 86400) + 1);
        } elseif ($days === -1) {
            $yesterday = Carbon::now('Asia/Almaty')->subDay()->toDateString();
            $from = $yesterday;
            $to = $yesterday;
        } elseif ($days === 0) {
            $from = null;
        } else {
            $from = Carbon::now('Asia/Almaty')->subDays($days - 1)->toDateString();
        }

        $divisionRows = $this->activeDivisions();
        $visibility = $this->divisionVisibilitySetting($divisionRows);

        $usersBase = DB::connection('perco')
            ->table('user as u')
            ->join('user_staff as s', 's.user_id', '=', 'u.id')
            ->where('u.is_removed', 0)
            ->where('u.user_type_id', 1)
            ->where('s.is_dismissed', 0);

        $this->applyDivisionVisibility($usersBase, $visibility, 'u.division_id');

        if ($divId !== '') {
            $usersBase->where('u.division_id', $divId);
        }

        $lateBase = DB::connection('perco')
            ->table('timetracking_result_data as t')
            ->join('user as u', 'u.id', '=', 't.user_id')
            ->join('user_staff as s', 's.user_id', '=', 'u.id')
            ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
            ->where('u.is_removed', 0)
            ->where('u.user_type_id', 1)
            ->where('s.is_dismissed', 0)
            ->where('t.late_time', '>', 0);

        $this->applyDivisionVisibility($lateBase, $visibility, 'u.division_id');

        if ($divId !== '') {
            $lateBase->where('u.division_id', $divId);
        }

        if ($from === null) {
            $minDate = (clone $lateBase)->min('t.date');
            $from = $minDate ?: $to;
        }

        $earlyBase = DB::connection('perco')
            ->table('timetracking_result_data as t')
            ->join('user as u', 'u.id', '=', 't.user_id')
            ->join('user_staff as s', 's.user_id', '=', 'u.id')
            ->where('u.is_removed', 0)
            ->where('u.user_type_id', 1)
            ->where('s.is_dismissed', 0)
            ->where('t.early_time', '>', 0);

        $this->applyDivisionVisibility($earlyBase, $visibility, 'u.division_id');

        if ($divId !== '') {
            $earlyBase->where('u.division_id', $divId);
        }

        $holidayDates = $this->holidayDates();
        $isHolidayToday = in_array($to, $holidayDates, true);

        $lateTodayPeople = 0;
        if (!$isHolidayToday) {
            $todayStart = "{$to} 00:00:00";
            $todayEnd = "{$to} 23:59:59";

            $firstEnterToday = DB::connection('perco')
                ->table('event as e')
                ->leftJoin('work_event_ignore as wei', 'wei.event_access_id', '=', 'e.id')
                ->selectRaw('e.user_id as user_id')
                ->selectRaw($this->firstEnterExpr('e') . ' as first_enter_at')
                ->whereNotNull('e.user_id')
                ->whereNull('wei.event_access_id')
                ->whereBetween('e.time_label', [$todayStart, $todayEnd])
                ->groupBy('e.user_id');

            $lateTodayQuery = DB::connection('perco')
                ->table('user as u')
                ->join('user_staff as s', 's.user_id', '=', 'u.id')
                ->joinSub($firstEnterToday, 'fe', function ($join) {
                    $join->on('fe.user_id', '=', 'u.id');
                })
                ->where('u.is_removed', 0)
                ->where('u.user_type_id', 1)
                ->where('s.is_dismissed', 0)
                ->whereTime('fe.first_enter_at', '>', '08:30:00');

            $this->applyDivisionVisibility($lateTodayQuery, $visibility, 'u.division_id');

            if ($divId !== '') {
                $lateTodayQuery->where('u.division_id', $divId);
            }

            $lateTodayPeople = $lateTodayQuery
                ->distinct('u.id')
                ->count('u.id');
        }

        $isTodayRange = $from === $to && $to === Carbon::now('Asia/Almaty')->toDateString();

        $summary = [
            'employees_total' => (clone $usersBase)->count(),
            'employees_active' => (clone $usersBase)
                ->where('u.is_active', 1)
                ->where('u.is_block', 0)
                ->count(),
            'late_today' => $lateTodayPeople,
            'late_today_people' => $lateTodayPeople,
            'late_period_people' => $isTodayRange && !$isHolidayToday
                ? $lateTodayPeople
                : (clone $lateBase)
                    ->whereBetween('t.date', [$from, $to])
                    ->distinct('t.user_id')
                    ->count('t.user_id'),
            'early_today_people' => (clone $earlyBase)
                ->whereDate('t.date', $to)
                ->distinct('t.user_id')
                ->count('t.user_id'),
            'early_period_people' => (clone $earlyBase)
                ->whereBetween('t.date', [$from, $to])
                ->distinct('t.user_id')
                ->count('t.user_id'),
            'latest_late_date' => (clone $lateBase)->max('t.date'),
        ];

        if ($isTodayRange && !$isHolidayToday) {
            $todayStart = "{$to} 00:00:00";
            $todayEnd = "{$to} 23:59:59";

            $firstEnterWithDivision = DB::connection('perco')
                ->table('event as e')
                ->leftJoin('work_event_ignore as wei', 'wei.event_access_id', '=', 'e.id')
                ->join('user as u', 'u.id', '=', 'e.user_id')
                ->join('user_staff as s', 's.user_id', '=', 'u.id')
                ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
                ->whereNotNull('e.user_id')
                ->whereNull('wei.event_access_id')
                ->where('u.is_removed', 0)
                ->where('u.user_type_id', 1)
                ->where('s.is_dismissed', 0)
                ->whereBetween('e.time_label', [$todayStart, $todayEnd])
                ->selectRaw('e.user_id as user_id')
                ->selectRaw('u.division_id as division_id')
                ->selectRaw('COALESCE(d.name, "Без подразделения") as division')
                ->selectRaw($this->firstEnterExpr('e') . ' as first_enter_at')
                ->groupBy(['e.user_id', 'u.division_id', 'd.name']);

            $lateTodayByDivision = DB::connection('perco')
                ->query()
                ->fromSub($firstEnterWithDivision, 'fe')
                ->whereTime('fe.first_enter_at', '>', '08:30:00');

            $this->applyDivisionVisibility($lateTodayByDivision, $visibility, 'fe.division_id');

            if ($divId !== '') {
                $lateTodayByDivision->where('fe.division_id', $divId);
            }

            $topDivisions = (clone $lateTodayByDivision)
                ->selectRaw('fe.division_id as division_id')
                ->selectRaw('fe.division as division')
                ->selectRaw('COUNT(*) as late_events')
                ->selectRaw('COUNT(*) as late_people')
                ->groupBy(['fe.division_id', 'fe.division'])
                ->orderByDesc('late_people')
                ->get();

            $series = [[
                'date' => $to,
                'late_events' => (int) $lateTodayPeople,
                'late_people' => (int) $lateTodayPeople,
            ]];
        } else {
            $seriesRows = (clone $lateBase)
                ->whereBetween('t.date', [$from, $to])
                ->selectRaw('t.date as date')
                ->selectRaw('COUNT(*) as late_events')
                ->selectRaw('COUNT(DISTINCT t.user_id) as late_people')
                ->groupBy('t.date')
                ->orderBy('t.date')
                ->get();

            $byDate = $seriesRows->keyBy('date');
            $series = [];
            $cursor = Carbon::parse($from);
            $end = Carbon::parse($to);

            while ($cursor->lte($end)) {
                $d = $cursor->toDateString();
                $row = $byDate->get($d);
                $series[] = [
                    'date' => $d,
                    'late_events' => (int) ($row->late_events ?? 0),
                    'late_people' => (int) ($row->late_people ?? 0),
                ];
                $cursor->addDay();
            }

            $topDivisions = (clone $lateBase)
                ->whereBetween('t.date', [$from, $to])
                ->selectRaw('u.division_id')
                ->selectRaw('COALESCE(d.name, "Без подразделения") as division')
                ->selectRaw('COUNT(*) as late_events')
                ->selectRaw('COUNT(DISTINCT t.user_id) as late_people')
                ->groupBy(['u.division_id', 'd.name'])
                ->orderByDesc('late_events')
                ->get();
        }

        return Inertia::render('HR/Dashboard', [
            'summary' => $summary,
            'series' => $series,
            'topDivisions' => $topDivisions,
            'divisions' => $this->visibleDivisionOptions($divisionRows, $visibility),
            'filters' => [
                'division' => (string) $divId,
                'days' => $days,
                'from' => $fromParam,
            ],
        ]);
    }

    public function divisionLatePeople(Request $request): Response
    {
        $divisionId = (int) $request->input('division_id');
        $divisionName = trim((string) $request->input('division_name', ''));
        $daysRaw = (int) $request->input('days', 1);
        $days = in_array($daysRaw, [-1, 0, 1, 7, 14, 30], true) ? $daysRaw : 1;

        $fromParam = trim((string) $request->input('from', ''));
        $to = Carbon::now('Asia/Almaty')->toDateString();

        if ($fromParam && strtotime($fromParam)) {
            $from = date('Y-m-d', strtotime($fromParam));
        } elseif ($days === -1) {
            $yesterday = Carbon::now('Asia/Almaty')->subDay()->toDateString();
            $from = $yesterday;
            $to = $yesterday;
        } elseif ($days === 0) {
            $from = null;
        } else {
            $from = Carbon::now('Asia/Almaty')->subDays($days - 1)->toDateString();
        }

        $divisionRows = $this->activeDivisions();
        $visibility = $this->divisionVisibilitySetting($divisionRows);

        if ($from === null) {
            $allTimeBase = DB::connection('perco')
                ->table('timetracking_result_data as t')
                ->join('user as u', 'u.id', '=', 't.user_id')
                ->join('user_staff as s', 's.user_id', '=', 'u.id')
                ->where('u.user_type_id', 1)
                ->where('s.is_dismissed', 0)
                ->where('u.is_removed', 0)
                ->where('u.division_id', $divisionId)
                ->where('t.late_time', '>', 0);

            $this->applyDivisionVisibility($allTimeBase, $visibility, 'u.division_id');
            $minDate = $allTimeBase->min('t.date');
            $from = $minDate ?: $to;
        }

        $firstEnterByDay = DB::connection('perco')
            ->table('event as e')
            ->leftJoin('work_event_ignore as wei', 'wei.event_access_id', '=', 'e.id')
            ->selectRaw('e.user_id as user_id')
            ->selectRaw('DATE(e.time_label) as event_date')
            ->selectRaw($this->firstEnterExpr('e') . ' as first_enter_at')
            ->whereNotNull('e.user_id')
            ->whereNull('wei.event_access_id')
            ->whereBetween('e.time_label', ["{$from} 00:00:00", "{$to} 23:59:59"])
            ->groupBy(['e.user_id', DB::raw('DATE(e.time_label)')]);

        $rowsQuery = DB::connection('perco')
            ->table('user as u')
            ->join('user_staff as s', 's.user_id', '=', 'u.id')
            ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
            ->leftJoin('position as p', 'p.id', '=', 'u.position_id')
            ->join('timetracking_result_data as t', 't.user_id', '=', 'u.id')
            ->leftJoinSub($firstEnterByDay, 'fe', function ($join) {
                $join->on('fe.user_id', '=', 'u.id')
                    ->on('fe.event_date', '=', 't.date');
            })
            ->where('u.user_type_id', 1)
            ->where('s.is_dismissed', 0)
            ->where('u.is_removed', 0)
            ->where('u.division_id', $divisionId)
            ->whereBetween('t.date', [$from, $to])
            ->where('t.late_time', '>', 0);

        $this->applyDivisionVisibility($rowsQuery, $visibility, 'u.division_id');

        $rows = $rowsQuery
            ->select([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name as division',
                'p.name as position',
                's.tabel_number',
                't.date as late_date',
                't.late_time as late_minutes',
            ])
            ->selectRaw('TIME(fe.first_enter_at) as first_enter_time')
            ->orderByDesc('t.date')
            ->orderBy('u.last_name')
            ->orderBy('u.first_name')
            ->get()
            ->map(fn($row) => [
                'id' => $row->id . '_' . $row->late_date,
                'name' => trim("{$row->last_name} {$row->first_name} {$row->middle_name}"),
                'tabel_number' => $row->tabel_number,
                'position' => $row->position,
                'division' => $row->division,
                'late_date' => $row->late_date,
                'first_enter_time' => $row->first_enter_time,
                'late_minutes' => (int) ($row->late_minutes ?? 0),
            ]);

        if ($divisionName === '') {
            $divisionName = (string) ($rows->first()['division'] ?? 'Подразделение');
        }

        return Inertia::render('HR/DivisionLatePeople', [
            'rows' => $rows,
            'divisionId' => $divisionId,
            'divisionName' => $divisionName,
            'from' => $from,
            'to' => $to,
            'filters' => [
                'division' => '',
                'days' => $days,
                'from' => $fromParam,
            ],
        ]);
    }

    public function settings(): Response
    {
        $divisionRows = $this->activeDivisions();

        return Inertia::render('HR/PercoSettings', [
            'divisions' => $divisionRows,
            'setting' => $this->divisionVisibilitySetting($divisionRows),
        ]);
    }

    public function updateSettings(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'visible_division_ids' => ['nullable', 'array'],
            'visible_division_ids.*' => ['integer'],
        ]);

        $divisionRows = $this->activeDivisions();
        $allowedIds = $divisionRows->pluck('id')->map(static fn ($id): int => (int) $id)->values()->all();

        $divisionIds = collect($validated['visible_division_ids'] ?? [])
            ->map(static fn ($id): int => (int) $id)
            ->filter(static fn (int $id): bool => $id > 0)
            ->intersect($allowedIds)
            ->unique()
            ->values()
            ->all();

        AppSetting::query()->updateOrCreate(
            ['key' => self::HR_PERCO_DIVISION_VISIBILITY_KEY],
            ['value' => [
                'visible_division_ids' => $divisionIds,
            ]]
        );

        return redirect()
            ->route('hr.perco.settings')
            ->with('success', 'Настройки HR сохранены.');
    }

    /**
     * @return Collection<int,array{id:int,parent_id:int|null,name:string}>
     */
    private function activeDivisions(): Collection
    {
        return DB::connection('perco')
            ->table('division')
            ->where('is_removed', 0)
            ->orderBy('parent_id')
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name'])
            ->map(static fn ($division): array => [
                'id' => (int) $division->id,
                'parent_id' => $division->parent_id !== null ? (int) $division->parent_id : null,
                'name' => (string) $division->name,
            ]);
    }

    /**
     * @param Collection<int,array{id:int,parent_id:int|null,name:string}> $divisions
     * @return array{visible_division_ids:list<int>}
     */
    private function divisionVisibilitySetting(Collection $divisions): array
    {
        $allDivisionIds = $divisions
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->values()
            ->all();

        $value = AppSetting::query()
            ->where('key', self::HR_PERCO_DIVISION_VISIBILITY_KEY)
            ->value('value');

        if (is_array($value) && array_key_exists('visible_division_ids', $value)) {
            $visibleDivisionIds = collect($value['visible_division_ids'] ?? [])
                ->map(static fn ($id): int => (int) $id)
                ->filter(static fn (int $id): bool => $id > 0)
                ->intersect($allDivisionIds)
                ->unique()
                ->values()
                ->all();

            return [
                'visible_division_ids' => $visibleDivisionIds,
            ];
        }

        if (is_array($value) && isset($value['mode'], $value['division_ids']) && in_array($value['mode'], ['exclude', 'include'], true)) {
            $divisionIds = collect($value['division_ids'] ?? [])
                ->map(static fn ($id): int => (int) $id)
                ->filter(static fn (int $id): bool => $id > 0)
                ->intersect($allDivisionIds)
                ->unique()
                ->values()
                ->all();

            $visibleDivisionIds = $value['mode'] === 'include'
                ? $divisionIds
                : array_values(array_diff($allDivisionIds, $divisionIds));

            return [
                'visible_division_ids' => $visibleDivisionIds,
            ];
        }

        $visibleDivisionIds = $divisions
            ->filter(function (array $division): bool {
                $name = mb_strtolower($division['name']);

                foreach (self::DEFAULT_HIDDEN_DIVISION_NEEDLES as $needle) {
                    if ($needle !== '' && str_contains($name, $needle)) {
                        return false;
                    }
                }

                return true;
            })
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->values()
            ->all();

        return [
            'visible_division_ids' => $visibleDivisionIds,
        ];
    }

    /**
     * @param array{visible_division_ids:list<int>} $visibility
     */
    private function applyDivisionVisibility(QueryBuilder $query, array $visibility, string $column): void
    {
        if ($visibility['visible_division_ids'] === []) {
            $query->whereRaw('1 = 0');
            return;
        }

        $query->whereIn($column, $visibility['visible_division_ids']);
    }

    /**
     * @param Collection<int,array{id:int,parent_id:int|null,name:string}> $divisions
     * @param array{visible_division_ids:list<int>} $visibility
     * @return array<int,array{id:int,name:string}>
     */
    private function visibleDivisionOptions(Collection $divisions, array $visibility): array
    {
        return $divisions
            ->filter(static fn (array $division): bool => in_array($division['id'], $visibility['visible_division_ids'], true))
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->map(static fn (array $division): array => [
                'id' => $division['id'],
                'name' => $division['name'],
            ])
            ->values()
            ->all();
    }

    /**
     * Returns holiday date strings ['Y-m-d', ...] from local holidays table and PERCo work_holiday.
     *
     * @return list<string>
     */
    private function holidayDates(): array
    {
        return Cache::remember('hr_holiday_dates', 3600, function (): array {
            $local = DB::table('holidays')
                ->pluck('date')
                ->map(static fn ($d): string => (string) $d)
                ->all();

            $perco = DB::connection('perco')
                ->table('work_holiday')
                ->where('work_holiday_type_id', 1)
                ->pluck('day')
                ->map(static fn ($d): string => (string) $d)
                ->all();

            return array_values(array_unique(array_merge($local, $perco)));
        });
    }

    /**
     * Returns ids of outside/non-controlled access zones (e.g. "Неконтролируемая территория").
     *
     * @return list<int>
     */
    private function outsideAccessZoneIds(): array
    {
        return Cache::remember('hr_perco_outside_access_zone_ids', 3600, function (): array {
            $zones = DB::connection('perco')
                ->table('access_zone')
                ->where('is_removed', 0)
                ->get(['id', 'name']);

            return $zones
                ->filter(static function ($zone): bool {
                    $name = mb_strtolower((string) ($zone->name ?? ''));
                    return str_contains($name, 'неконтрол')
                        || str_contains($name, 'uncontrolled')
                        || str_contains($name, 'outside')
                        || str_contains($name, 'external');
                })
                ->pluck('id')
                ->map(static fn ($id): int => (int) $id)
                ->filter(static fn (int $id): bool => $id > 0)
                ->unique()
                ->values()
                ->all();
        });
    }

    /**
     * Marks overnight transitions between adjacent dates.
     * Exits from current row can close open sessions of the previous row in calculations only:
     * - previous day receives synthetic 23:59 exit marker,
     * - current day receives synthetic 00:01 enter marker.
     * UI columns are not populated with these synthetic markers.
     *
     * @param Collection<int,mixed> $rows
     */
    private function movePrevDayExitTimes(Collection $rows, string $dateField = 'work_date'): Collection
    {
        $indexByUserDate = [];

        foreach ($rows as $idx => $row) {
            $rowDate = (string) ($row->{$dateField} ?? '');
            if ($rowDate === '') {
                continue;
            }

            $indexByUserDate[(int) $row->id . '|' . $rowDate] = $idx;
        }

        foreach ($rows as $idx => $row) {
            $rowDate = (string) ($row->{$dateField} ?? '');
            if ($rowDate === '') {
                continue;
            }

            $exitTimes = is_array($row->exit_times ?? null) ? $row->exit_times : [];
            if ($exitTimes === []) {
                continue;
            }

            sort($exitTimes, SORT_STRING);
            // Use earliest exits as potential closing points for previous open sessions.
            $carryCandidates = $exitTimes;

            if ($carryCandidates === []) {
                continue;
            }

            $targetDate = Carbon::parse($rowDate)->subDay()->toDateString();
            $targetKey = (int) $row->id . '|' . $targetDate;
            if (!array_key_exists($targetKey, $indexByUserDate)) {
                continue;
            }

            $targetIdx = $indexByUserDate[$targetKey];
            $targetRow = $rows->get($targetIdx);

            $targetEnterTimes = is_array($targetRow->enter_times ?? null) ? $targetRow->enter_times : [];
            $targetExitTimes = is_array($targetRow->exit_times ?? null) ? $targetRow->exit_times : [];
            $openCount = max(count($targetEnterTimes) - count($targetExitTimes), 0);

            if ($openCount <= 0) {
                continue;
            }

            $toCarry = array_slice($carryCandidates, 0, $openCount);
            if ($toCarry === []) {
                continue;
            }

            $targetCarry = is_array($targetRow->exit_times_from_next_day ?? null)
                ? $targetRow->exit_times_from_next_day
                : [];
            $mergedTargetCarry = array_values(array_unique(array_merge($targetCarry, $toCarry)));
            sort($mergedTargetCarry, SORT_STRING);

            $targetRow->exit_times_from_next_day = $mergedTargetCarry;
            $targetRow->exit_prev_day = false;
            $rows->put($targetIdx, $targetRow);

            // Keep real exits in current row (they are needed to close synthetic 00:01 enters).
            $syntheticEnter = is_array($row->enter_times_from_prev_day ?? null)
                ? $row->enter_times_from_prev_day
                : [];
            for ($i = 0; $i < count($toCarry); $i++) {
                $syntheticEnter[] = '00:01';
            }
            $row->enter_times_from_prev_day = $syntheticEnter;
            $row->exit_prev_day = false;
            $rows->put($idx, $row);
        }

        return $rows;
    }

    private function isEarlyMorningTime(string $time): bool
    {
        $normalized = $this->normalizeEventTime($time);

        return $normalized !== null && $normalized <= '08:30:00';
    }

    private function normalizeEventTime(string $time): ?string
    {
        $value = trim($time);
        if ($value === '') {
            return null;
        }

        if (preg_match('/^\d{2}:\d{2}$/', $value) === 1) {
            return $value . ':00';
        }

        if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $value) === 1) {
            return $value;
        }

        return null;
    }

    /**
     * Calculate worked seconds by pairing enter→exit event times.
     * $exitTimesNextDay contains exits that were moved from the next calendar day
     * (overnight sessions): their timestamps are treated as +1 day.
     *
     * @param string[] $enterTimes   e.g. ['10:07', '13:48']
     * @param string[] $exitTimes    exits on the same calendar date
     * @param string[] $exitTimesNextDay  exits physically on the next day (moved)
     * @param string   $date         'Y-m-d'
     */
    private function calcWorkSeconds(
        array $enterTimes,
        array $exitTimes,
        array $exitTimesNextDay,
        string $date,
    ): int {
        $buckets = $this->calcShiftBucketsSeconds($enterTimes, $exitTimes, $exitTimesNextDay, $date);

        return max(0, (int) ($buckets['worked'] + $buckets['overtime']));
    }

    /**
     * Split paired enter/exit duration into shift work and overtime buckets.
    * Shift windows are fixed to 08:30-12:30 and 13:30-17:30.
     *
     * @param string[] $enterTimes
     * @param string[] $exitTimes
     * @param string[] $exitTimesNextDay
     * @return array{worked:int,overtime:int}
     */
    private function calcShiftBucketsSeconds(
        array $enterTimes,
        array $exitTimes,
        array $exitTimesNextDay,
        string $date,
    ): array {
        if ($date === '') {
            return ['worked' => 0, 'overtime' => 0];
        }

        $toTs = function (string $time, int $extra = 0) use ($date): int {
            $normalized = $this->normalizeEventTime($time);
            if ($normalized === null) {
                return 0;
            }

            return (int) (strtotime($date . ' ' . $normalized) ?: 0) + $extra;
        };

        if ($enterTimes === []) {
            return ['worked' => 0, 'overtime' => 0];
        }

        // For today's open sessions (no exit yet), calculate to current local time (UTC+5, Asia/Almaty).
        if ($exitTimes === [] && $exitTimesNextDay === []) {
            $todayAlmaty = Carbon::now('Asia/Almaty')->toDateString();
            if ($date === $todayAlmaty) {
                $exitTimes = [Carbon::now('Asia/Almaty')->format('H:i:s')];
            } else {
                return ['worked' => 0, 'overtime' => 0];
            }
        }

        $normalizedNextDayTimes = collect($exitTimesNextDay)
            ->map(fn ($t) => $this->normalizeEventTime((string) $t))
            ->filter()
            ->values()
            ->all();

        // When a time is explicitly carried from next day, do not count the same clock time as same-day exit too.
        $cleanSameDayExitTimes = array_values(array_filter(
            $exitTimes,
            fn ($t) => !in_array($this->normalizeEventTime((string) $t), $normalizedNextDayTimes, true)
        ));

        $enterTs = array_values(array_unique(array_filter(array_map(fn ($t) => $toTs((string) $t), $enterTimes))));
        $exitTs = array_values(array_unique(array_filter(array_map(fn ($t) => $toTs((string) $t), $cleanSameDayExitTimes))));
        // For previous day calculations, next-day exits are treated as synthetic 23:59 exits.
        $syntheticDayEnd = $toTs('23:59:00');
        $exitNextDayTs = $syntheticDayEnd > 0
            ? array_fill(0, count($exitTimesNextDay), $syntheticDayEnd)
            : [];

        if ($enterTs === [] || ($exitTs === [] && $exitNextDayTs === [])) {
            return ['worked' => 0, 'overtime' => 0];
        }

        $isHoliday = in_array($date, $this->holidayDates(), true);
        $isWeekend = Carbon::parse($date, 'Asia/Almaty')->isWeekend();

        sort($enterTs);
        $allExitTs = array_merge($exitTs, $exitNextDayTs);

        // If there is an open session today (e.g. enter-enter without final exit),
        // use current local time as a temporary closing point for calculations.
        $todayAlmaty = Carbon::now('Asia/Almaty')->toDateString();
        if ($date === $todayAlmaty && count($enterTs) > count($allExitTs)) {
            $nowTs = (int) (strtotime($date . ' ' . Carbon::now('Asia/Almaty')->format('H:i:s')) ?: 0);
            if ($nowTs > 0) {
                $allExitTs[] = $nowTs;
            }
        }

        sort($allExitTs);

        $morningStart = (int) (strtotime($date . ' 08:30:00') ?: 0);
        $morningEnd = (int) (strtotime($date . ' 12:30:00') ?: 0);
        $lunchStart = (int) (strtotime($date . ' 12:30:00') ?: 0);
        $lunchEnd = (int) (strtotime($date . ' 13:30:00') ?: 0);
        $afternoonStart = (int) (strtotime($date . ' 13:30:00') ?: 0);
        $afternoonEnd = (int) (strtotime($date . ' 17:30:00') ?: 0);

        $usedExits = array_fill(0, count($allExitTs), false);
        $intervals = [];

        foreach ($enterTs as $et) {
            foreach ($allExitTs as $xi => $xt) {
                if ($usedExits[$xi]) {
                    continue;
                }
                if ($xt < $et) {
                    continue;
                }

                $intervals[] = [$et, $xt];

                $usedExits[$xi] = true;
                break;
            }
        }

        if ($intervals === []) {
            return ['worked' => 0, 'overtime' => 0];
        }

        // Merge overlapping/adjacent intervals to avoid counting duplicated events twice.
        usort($intervals, static fn (array $a, array $b): int => $a[0] <=> $b[0]);
        $merged = [];
        foreach ($intervals as [$start, $end]) {
            if ($merged === []) {
                $merged[] = [$start, $end];
                continue;
            }

            $lastIdx = count($merged) - 1;
            [$lastStart, $lastEnd] = $merged[$lastIdx];

            if ($start <= $lastEnd) {
                $merged[$lastIdx] = [$lastStart, max($lastEnd, $end)];
                continue;
            }

            $merged[] = [$start, $end];
        }

        $total = 0;
        $worked = 0;

        foreach ($merged as [$start, $end]) {
            $lunchOverlap = max(0, min($end, $lunchEnd) - max($start, $lunchStart));
            $duration = max(0, $end - $start) - $lunchOverlap;
            $total += $duration;

            $morningOverlap = max(0, min($end, $morningEnd) - max($start, $morningStart));
            $afternoonOverlap = max(0, min($end, $afternoonEnd) - max($start, $afternoonStart));
            $worked += $morningOverlap + $afternoonOverlap;
        }

        if ($isHoliday || $isWeekend) {
            return ['worked' => 0, 'overtime' => $total];
        }

        $overtime = max(0, $total - $worked);

        return ['worked' => $worked, 'overtime' => $overtime];
    }

    /**
     * Expected shift duration for absence calculations.
    * For past days: full shift 08:30-17:30 minus lunch 12:30-13:30 (8h).
     * For today: only elapsed part of the shift up to now (Asia/Almaty).
     * For future dates: 0.
     */
    private function calcExpectedShiftSeconds(string $date): int
    {
        if ($date === '') {
            return 0;
        }

        $tz = 'Asia/Almaty';
        $now = Carbon::now($tz);
        $today = $now->toDateString();

        $morningStart = Carbon::parse($date . ' 08:30:00', $tz);
        $morningEnd = Carbon::parse($date . ' 12:30:00', $tz);
        $afternoonStart = Carbon::parse($date . ' 13:30:00', $tz);
        $afternoonEnd = Carbon::parse($date . ' 17:30:00', $tz);

        $fullMorning = max(0, $morningEnd->diffInSeconds($morningStart, false));
        $fullAfternoon = max(0, $afternoonEnd->diffInSeconds($afternoonStart, false));
        $fullShift = $fullMorning + $fullAfternoon;

        if ($date > $today) {
            return 0;
        }

        if ($date < $today) {
            return $fullShift;
        }

        if ($now->lte($morningStart)) {
            return 0;
        }

        if ($now->gte($afternoonEnd)) {
            return $fullShift;
        }

        // Today: count only elapsed part of morning + elapsed part of afternoon, lunch is excluded.
        $elapsedMorning = 0;
        if ($now->gt($morningStart)) {
            $morningEdge = $now->lt($morningEnd) ? $now : $morningEnd;
            $elapsedMorning = max(0, $morningEdge->diffInSeconds($morningStart, false));
        }

        $elapsedAfternoon = 0;
        if ($now->gt($afternoonStart)) {
            $afternoonEdge = $now->lt($afternoonEnd) ? $now : $afternoonEnd;
            $elapsedAfternoon = max(0, $afternoonEdge->diffInSeconds($afternoonStart, false));
        }

        return $elapsedMorning + $elapsedAfternoon;
    }

    private function firstEnterExpr(string $eventAlias = 'e'): string
    {
        $enterConditionExpr = $this->enterConditionExpr($eventAlias);

        return "MIN(CASE WHEN {$enterConditionExpr} THEN {$eventAlias}.time_label END)";
    }

    private function lastEnterExpr(string $eventAlias = 'e'): string
    {
        $enterConditionExpr = $this->enterConditionExpr($eventAlias);

        return "MAX(CASE WHEN {$enterConditionExpr} THEN {$eventAlias}.time_label END)";
    }

    private function lastExitExpr(string $eventAlias = 'e'): string
    {
        $exitConditionExpr = $this->exitConditionExpr($eventAlias);

        return "MAX(CASE WHEN {$exitConditionExpr} THEN {$eventAlias}.time_label END)";
    }

    private function enterConditionExpr(string $eventAlias = 'e'): string
    {
        [$fromInsideExpr, $toOutsideExpr] = $this->entryDirectionExprParts($eventAlias);

        return "{$fromInsideExpr} AND {$toOutsideExpr}";
    }

    private function exitConditionExpr(string $eventAlias = 'e'): string
    {
        [$fromOutsideExpr, $toInsideExpr] = $this->exitDirectionExprParts($eventAlias);

        return "{$fromOutsideExpr} AND {$toInsideExpr}";
    }

    /**
     * @return array{0:string,1:string}
     */
    private function entryDirectionExprParts(string $eventAlias): array
    {
        $outsideZoneIds = $this->outsideAccessZoneIds();

        if ($outsideZoneIds === []) {
            $fromInsideExpr = "({$eventAlias}.access_zone_id1 IS NOT NULL AND {$eventAlias}.access_zone_id1 <> 0)";
            $toOutsideExpr = "({$eventAlias}.access_zone_id2 IS NULL OR {$eventAlias}.access_zone_id2 = 0)";

            return [$fromInsideExpr, $toOutsideExpr];
        }

        $outsideZoneList = implode(',', array_map(static fn (int $id): int => $id, $outsideZoneIds));
        $fromInsideExpr = "({$eventAlias}.access_zone_id1 NOT IN ({$outsideZoneList}) AND {$eventAlias}.access_zone_id1 IS NOT NULL AND {$eventAlias}.access_zone_id1 <> 0)";
        $toOutsideExpr = "({$eventAlias}.access_zone_id2 IN ({$outsideZoneList}) OR {$eventAlias}.access_zone_id2 IS NULL OR {$eventAlias}.access_zone_id2 = 0)";

        return [$fromInsideExpr, $toOutsideExpr];
    }

    /**
     * @return array{0:string,1:string}
     */
    private function exitDirectionExprParts(string $eventAlias): array
    {
        $outsideZoneIds = $this->outsideAccessZoneIds();

        if ($outsideZoneIds === []) {
            $fromOutsideExpr = "({$eventAlias}.access_zone_id1 IS NULL OR {$eventAlias}.access_zone_id1 = 0)";
            $toInsideExpr = "({$eventAlias}.access_zone_id2 IS NOT NULL AND {$eventAlias}.access_zone_id2 <> 0)";

            return [$fromOutsideExpr, $toInsideExpr];
        }

        $outsideZoneList = implode(',', array_map(static fn (int $id): int => $id, $outsideZoneIds));
        $fromOutsideExpr = "({$eventAlias}.access_zone_id1 IN ({$outsideZoneList}) OR {$eventAlias}.access_zone_id1 IS NULL OR {$eventAlias}.access_zone_id1 = 0)";
        $toInsideExpr = "({$eventAlias}.access_zone_id2 NOT IN ({$outsideZoneList}) AND {$eventAlias}.access_zone_id2 IS NOT NULL AND {$eventAlias}.access_zone_id2 <> 0)";

        return [$fromOutsideExpr, $toInsideExpr];
    }

}

