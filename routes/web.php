<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\FacultyController;
use App\Http\Controllers\AcademicYearController;
use App\Http\Controllers\AnnouncementController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\EducationalProgramController;
use App\Http\Controllers\DirectoryUserController;
use App\Http\Controllers\DivisionController;
use App\Http\Controllers\DiplomaController;
use App\Http\Controllers\KpiEntryController;
use App\Http\Controllers\KpiIndicatorController;
use App\Http\Controllers\KpiPeriodController;
use App\Http\Controllers\KpiDivisionController;
use App\Http\Controllers\KpiStructuralUnitController;
use App\Http\Controllers\KpiSettingsController;
use App\Http\Controllers\KpiSummaryController;
use App\Http\Controllers\LibraryLoanController;
use App\Http\Controllers\LibraryReservationAdminController;
use App\Http\Controllers\PercoController;
use App\Http\Controllers\CalendarMyController;
use App\Http\Controllers\CalendarEmployeesController;
use App\Http\Controllers\CalendarEmployeeProfileController;
use App\Http\Controllers\CalendarConferencesController;
use App\Http\Controllers\CalendarAnalyticsController;
use App\Http\Controllers\NavigationRouteController;
use App\Http\Controllers\PositionController;
use App\Http\Controllers\CertificateRegistryController;
use App\Http\Controllers\CertificateTemplateController;
use App\Http\Controllers\TicketController;
use Illuminate\Http\Request;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/nav', function () {
    return Inertia::render('Nav/Index');
})->name('nav.index');

Route::get('/catalog', function () {
    return Inertia::render('Catalog');
})->name('catalog.index');

Route::get('/tickets', [TicketController::class, 'index'])->name('tickets.index');
Route::post('/tickets', [TicketController::class, 'store'])->name('tickets.store');

Route::get('/dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

Route::middleware(['auth', 'panel.role.access'])->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::resource('departments', DepartmentController::class)
        ->except(['show']);

    Route::get('faculties', [FacultyController::class, 'index'])
        ->name('faculties.index');
    Route::post('faculties', [FacultyController::class, 'store'])
        ->name('faculties.store');
    Route::patch('faculties/{faculty}', [FacultyController::class, 'update'])
        ->name('faculties.update');
    Route::delete('faculties/{faculty}', [FacultyController::class, 'destroy'])
        ->name('faculties.destroy');

    Route::get('academic-years', [AcademicYearController::class, 'index'])
        ->name('academic-years.index');
    Route::post('academic-years', [AcademicYearController::class, 'store'])
        ->name('academic-years.store');
    Route::delete('academic-years/{academicYear}', [AcademicYearController::class, 'destroy'])
        ->name('academic-years.destroy');

    Route::get('educational-programs', [EducationalProgramController::class, 'index'])
        ->name('educational-programs.index');
    Route::post('educational-programs', [EducationalProgramController::class, 'store'])
        ->name('educational-programs.store');
    Route::patch('educational-programs/{educationalProgram}', [EducationalProgramController::class, 'update'])
        ->name('educational-programs.update');
    Route::delete('educational-programs/{educationalProgram}', [EducationalProgramController::class, 'destroy'])
        ->name('educational-programs.destroy');

    Route::get('users', [DirectoryUserController::class, 'index'])
        ->name('users.index');
    Route::get('students', [DirectoryUserController::class, 'index'])
        ->name('users.students');
    Route::post('users/manual', [DirectoryUserController::class, 'storeManual'])
        ->name('users.manual.store');
    Route::post('users/create-from-ad', [DirectoryUserController::class, 'createFromAd'])
        ->name('users.create-from-ad');
    Route::patch('users/{user}/position', [DirectoryUserController::class, 'updatePosition'])
        ->name('users.position.update');
    Route::patch('users/{user}/role', [DirectoryUserController::class, 'updateRole'])
        ->name('users.role.update');
    Route::patch('users/{user}/binding', [DirectoryUserController::class, 'updateBinding'])
        ->name('users.binding.update');
    Route::patch('users/{user}/divisions', [DirectoryUserController::class, 'updateDivisions'])
        ->name('users.divisions.update');
    Route::patch('users/position', [DirectoryUserController::class, 'updatePositionByDirectory'])
        ->name('users.position.update-directory');
    Route::patch('users/divisions', [DirectoryUserController::class, 'updateDivisionsByDirectory'])
        ->name('users.divisions.update-directory');
    Route::patch('users/role', [DirectoryUserController::class, 'updateRoleByDirectory'])
        ->name('users.role.update-directory');
    Route::get('users/admin-access', [DirectoryUserController::class, 'adminAccess'])
        ->name('users.admin-access');
    Route::post('users/admin-access/grant', [DirectoryUserController::class, 'grantAdmin'])
        ->name('users.admin-access.grant');
    Route::post('users/admin-access/revoke', [DirectoryUserController::class, 'revokeAdmin'])
        ->name('users.admin-access.revoke');

    Route::get('announcements', [AnnouncementController::class, 'index'])
        ->name('announcements.index');
    Route::post('announcements', [AnnouncementController::class, 'store'])
        ->name('announcements.store');
    Route::patch('announcements/{announcement}', [AnnouncementController::class, 'update'])
        ->name('announcements.update');
    Route::delete('announcements/{announcement}', [AnnouncementController::class, 'destroy'])
        ->name('announcements.destroy');

    Route::get('admin/audit-logs', [AuditLogController::class, 'index'])
        ->name('admin.audit-logs.index');

    Route::get('divisions', [DivisionController::class, 'index'])
        ->name('divisions.index');
    Route::post('divisions', [DivisionController::class, 'store'])
        ->name('divisions.store');
    Route::patch('divisions/{division}', [DivisionController::class, 'update'])
        ->name('divisions.update');
    Route::delete('divisions/{division}', [DivisionController::class, 'destroy'])
        ->name('divisions.destroy');

    Route::get('positions', [PositionController::class, 'index'])
        ->name('positions.index');
    Route::post('positions', [PositionController::class, 'store'])
        ->name('positions.store');
    Route::patch('positions/{position}', [PositionController::class, 'update'])
        ->name('positions.update');
    Route::delete('positions/{position}', [PositionController::class, 'destroy'])
        ->name('positions.destroy');

    Route::get('kpi', [KpiPeriodController::class, 'index'])
        ->name('kpi.index');
    Route::get('kpi/indicators', [KpiIndicatorController::class, 'index'])
        ->name('kpi.indicators.index');
    Route::post('kpi/indicators', [KpiIndicatorController::class, 'store'])
        ->name('kpi.indicators.store');
    Route::post('kpi/indicators/{indicator}/update', [KpiIndicatorController::class, 'update'])
        ->name('kpi.indicators.update.post');
    Route::patch('kpi/indicators/{indicator}', [KpiIndicatorController::class, 'update'])
        ->name('kpi.indicators.update');
    Route::delete('kpi/indicators/{indicator}', [KpiIndicatorController::class, 'destroy'])
        ->name('kpi.indicators.destroy');
    Route::get('kpi/summary', [KpiSummaryController::class, 'index'])
        ->name('kpi.summary');
    Route::match(['get', 'post'], 'kpi/summary/export-excel', [KpiSummaryController::class, 'exportExcel'])
        ->name('kpi.summary.export-excel');
    Route::match(['get', 'post'], 'kpi/summary/export-pdf', [KpiSummaryController::class, 'exportPdf'])
        ->name('kpi.summary.export-pdf');
    Route::get('kpi/summary/export-rating-pdf', [KpiSummaryController::class, 'exportRatingPdf'])
        ->name('kpi.summary.export-rating-pdf');
    Route::get('kpi/summary/export-rating-excel', [KpiSummaryController::class, 'exportRatingExcel'])
        ->name('kpi.summary.export-rating-excel');
    Route::get('kpi/settings', [KpiSettingsController::class, 'index'])
        ->name('kpi.settings');
    Route::post('kpi/settings', [KpiSettingsController::class, 'update'])
        ->name('kpi.settings.update');
    Route::post('kpi/settings/accesses', [KpiSettingsController::class, 'storeAccess'])
        ->name('kpi.settings.accesses.store');
    Route::delete('kpi/settings/accesses/{grant}', [KpiSettingsController::class, 'revokeAccess'])
        ->name('kpi.settings.accesses.destroy');
    Route::get('kpi/summary/teacher/{userId}', [KpiSummaryController::class, 'showTeacher'])
        ->name('kpi.summary.teacher')
        ->whereNumber('userId');
    Route::get('kpi/my-form', [KpiEntryController::class, 'myForm'])
        ->name('kpi.my-form');
    Route::post('kpi/my-entries', [KpiEntryController::class, 'storeMyEntry'])
        ->name('kpi.my-entries.store');
    Route::patch('kpi/my-entries/{entry}', [KpiEntryController::class, 'updateMyEntry'])
        ->name('kpi.my-entries.update');
    Route::post('kpi/my-entries/{entry}/submit', [KpiEntryController::class, 'submitMyEntry'])
        ->name('kpi.my-entries.submit');
    Route::delete('kpi/my-entries/{entry}', [KpiEntryController::class, 'destroyMyEntry'])
        ->name('kpi.my-entries.destroy');
    Route::get('kpi/review-queue', [KpiEntryController::class, 'reviewQueue'])
        ->name('kpi.review-queue');
    Route::get('kpi/approval-queue', [KpiEntryController::class, 'approvalQueue'])
        ->name('kpi.approval-queue');
    Route::get('kpi/structural-queue', [KpiEntryController::class, 'structuralQueue'])
        ->name('kpi.structural-queue');
    Route::post('kpi', [KpiPeriodController::class, 'store'])
        ->name('kpi.store');
    Route::post('kpi/{period}/entries/plan', [KpiEntryController::class, 'savePlan'])
        ->whereNumber('period')
        ->name('kpi.entries.save-plan');
    Route::post('kpi/{period}/entries/fact', [KpiEntryController::class, 'saveFact'])
        ->whereNumber('period')
        ->name('kpi.entries.save-fact');
    Route::post('kpi/{period}/entries/submit', [KpiEntryController::class, 'submit'])
        ->whereNumber('period')
        ->name('kpi.entries.submit');
    Route::post('kpi/entries/{entry}/files', [KpiEntryController::class, 'uploadFile'])
        ->name('kpi.entries.files.store');
    Route::get('kpi/entries/{entry}', [KpiEntryController::class, 'show'])
        ->name('kpi.entries.show');
    Route::post('kpi/entries/{entry}/return', [KpiEntryController::class, 'returnEntry'])
        ->name('kpi.entries.return');
    Route::post('kpi/entries/{entry}/review', [KpiEntryController::class, 'review'])
        ->name('kpi.entries.review');
    Route::post('kpi/entries/{entry}/approve', [KpiEntryController::class, 'approve'])
        ->name('kpi.entries.approve');
    Route::post('kpi/entries/{entry}/reject', [KpiEntryController::class, 'reject'])
        ->name('kpi.entries.reject');
    Route::get('kpi/{period}', [KpiPeriodController::class, 'show'])
        ->whereNumber('period')
        ->name('kpi.show');
    Route::patch('kpi/{period}', [KpiPeriodController::class, 'update'])
        ->whereNumber('period')
        ->name('kpi.update');
    Route::post('kpi/{period}/activate', [KpiPeriodController::class, 'activate'])
        ->whereNumber('period')
        ->name('kpi.activate');
    Route::post('kpi/{period}/deactivate', [KpiPeriodController::class, 'deactivate'])
        ->whereNumber('period')
        ->name('kpi.deactivate');
    Route::post('kpi/{period}/close', [KpiPeriodController::class, 'close'])
        ->whereNumber('period')
        ->name('kpi.close');
    Route::delete('kpi/{period}', [KpiPeriodController::class, 'destroy'])
        ->whereNumber('period')
        ->name('kpi.destroy');

    // KPI Divisions management
    Route::get('kpi/divisions', [KpiDivisionController::class, 'index'])
        ->name('kpi.divisions.index');
    Route::get('kpi/divisions/tables', [KpiDivisionController::class, 'tables'])
        ->name('kpi.divisions.tables');
    Route::post('kpi/divisions', [KpiDivisionController::class, 'store'])
        ->name('kpi.divisions.store');
    Route::put('kpi/divisions/{division}', [KpiDivisionController::class, 'update'])
        ->name('kpi.divisions.update');
    Route::delete('kpi/divisions/{division}', [KpiDivisionController::class, 'destroy'])
        ->name('kpi.divisions.destroy');
    Route::get('kpi/divisions/{division}/employees', [KpiDivisionController::class, 'showEmployees'])
        ->name('kpi.divisions.employees');
    Route::post('kpi/divisions/{division}/employees', [KpiDivisionController::class, 'addEmployee'])
        ->name('kpi.divisions.employees.add');
    Route::delete('kpi/divisions/{division}/employees/{userId}', [KpiDivisionController::class, 'removeEmployee'])
        ->name('kpi.divisions.employees.remove');

    // KPI Structural Units management
    Route::get('kpi/structural-units', [KpiStructuralUnitController::class, 'index'])
        ->name('kpi.structural-units.index');
    Route::get('kpi/structural-units/{unit}', [KpiStructuralUnitController::class, 'show'])
        ->name('kpi.structural-units.show');
    Route::post('kpi/structural-units/{unit}/users', [KpiStructuralUnitController::class, 'attachUser'])
        ->name('kpi.structural-units.users.attach');
    Route::delete('kpi/structural-units/{unit}/users/{user}', [KpiStructuralUnitController::class, 'detachUser'])
        ->name('kpi.structural-units.users.detach');
    Route::post('kpi/structural-units', [KpiStructuralUnitController::class, 'store'])
        ->name('kpi.structural-units.store');
    Route::put('kpi/structural-units/{unit}', [KpiStructuralUnitController::class, 'update'])
        ->name('kpi.structural-units.update');
    Route::delete('kpi/structural-units/{unit}', [KpiStructuralUnitController::class, 'destroy'])
        ->name('kpi.structural-units.destroy');

    Route::get('diplomas', [DiplomaController::class, 'index'])
        ->name('diplomas.index');
    Route::post('diplomas', [DiplomaController::class, 'store'])
        ->name('diplomas.store');
    Route::post('diplomas/{diploma}/submit', [DiplomaController::class, 'submit'])
        ->name('diplomas.submit');
    Route::post('diplomas/{diploma}/in-review', [DiplomaController::class, 'markInReview'])
        ->name('diplomas.in-review');
    Route::post('diplomas/{diploma}/approve', [DiplomaController::class, 'approve'])
        ->name('diplomas.approve');
    Route::post('diplomas/{diploma}/reject', [DiplomaController::class, 'reject'])
        ->name('diplomas.reject');
    Route::post('diplomas/{diploma}/check', [DiplomaController::class, 'runCheck'])
        ->name('diplomas.check');
    Route::post('diplomas/import', [DiplomaController::class, 'import'])
        ->name('diplomas.import');

    Route::get('admin/tickets', [TicketController::class, 'adminIndex'])
        ->name('tickets.admin');
    Route::post('admin/tickets/{ticket}/status', [TicketController::class, 'updateStatus'])
        ->name('tickets.update-status.post');
    Route::patch('admin/tickets/{ticket}/status', [TicketController::class, 'updateStatus'])
        ->name('tickets.update-status');

    Route::get('admin/nav-routes', [NavigationRouteController::class, 'index'])
        ->name('nav.routes.admin');
    Route::post('admin/nav-routes', [NavigationRouteController::class, 'store'])
        ->name('nav.routes.store');
    Route::patch('admin/nav-routes/{navigationRoute}', [NavigationRouteController::class, 'update'])
        ->name('nav.routes.update');
    Route::delete('admin/nav-routes/{navigationRoute}', [NavigationRouteController::class, 'destroy'])
        ->name('nav.routes.destroy');

    Route::get('admin/users/search', function (Request $request): \Illuminate\Http\JsonResponse {
        $role = $request->user()?->resolvedRoleSlug();
        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403);

        $query = trim((string) $request->query('q', ''));
        $perPage = min((int) $request->query('per_page', 50), 200);

        $users = \App\Models\User::query()
            ->when($query !== '', function ($q) use ($query): void {
                $q->where(function ($nested) use ($query): void {
                    $nested
                        ->where('name', 'like', "%{$query}%")
                        ->orWhere('display_name', 'like', "%{$query}%")
                        ->orWhere('first_name', 'like', "%{$query}%")
                        ->orWhere('last_name', 'like', "%{$query}%")
                        ->orWhere('email', 'like', "%{$query}%")
                        ->orWhere('room', 'like', "%{$query}%")
                        ->orWhere('ad_login', 'like', "%{$query}%");
                });
            })
            ->orderBy('name')
            ->paginate($perPage);

        return response()->json([
            'data' => $users->map(fn (\App\Models\User $user): array => [
                'id'       => $user->id,
                'name'     => $user->name,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'initials' => $user->initials,
                'display_name' => $user->display_name,
                'description' => $user->ad_description,
                'department' => $user->ad_department,
                'department_number' => $user->ad_department_number,
                'room' => $user->room,
                'email'    => $user->email,
                'ad_login' => $user->ad_login,
                'role'     => $user->resolvedRoleSlug(),
            ])->values(),
        ]);
    })->name('admin.users.search');

    Route::get('library/catalog', function (Request $request): \Illuminate\Http\JsonResponse {
        $endpoint = (string) config('services.library_catalog.endpoint', 'http://10.0.1.8:5173/api/v1/catalog');
        $timeout = (int) config('services.library_catalog.timeout', 15);

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->get($endpoint, $request->query());

            $payload = $response->json();
            $items = collect($payload['data'] ?? []);

            if ($items->isNotEmpty()) {
                $loanCounts = \App\Models\LibraryLoan::query()
                    ->selectRaw('book_id, COUNT(*) as aggregate')
                    ->whereIn('book_id', $items->pluck('id')->filter()->all())
                    ->groupBy('book_id')
                    ->pluck('aggregate', 'book_id');

                $payload['data'] = $items
                    ->map(function (array $item) use ($loanCounts): array {
                        $bookId = (string) ($item['id'] ?? '');
                        $loaned = (int) ($loanCounts[$bookId] ?? 0);
                        $copies = is_array($item['copies'] ?? null) ? $item['copies'] : [];
                        $remoteAvailable = (int) ($copies['available'] ?? 0);

                        $item['copies'] = [
                            ...$copies,
                            'available_remote' => $remoteAvailable,
                            'loaned' => $loaned,
                            'available' => max(0, $remoteAvailable - $loaned),
                        ];

                        return $item;
                    })
                    ->values()
                    ->all();
            }

            return response()->json($payload, $response->status());
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'Не удалось загрузить каталог библиотеки.',
                'error' => $exception->getMessage(),
            ], 502);
        }
    })->name('library.catalog');

    Route::get('library/dashboard', function () {
        return Inertia::render('Library/Dashboard');
    })->name('library.dashboard');

    Route::get('library/users/search', [LibraryLoanController::class, 'searchUsers'])
        ->name('library.users.search');
    Route::get('library/issue-book', [LibraryLoanController::class, 'index'])
        ->name('library.issue-book');
    Route::post('library/issue-book', [LibraryLoanController::class, 'store'])
        ->name('library.issue-book.store');
    Route::get('admin/library/reservations', [LibraryReservationAdminController::class, 'index'])
        ->name('library.reservations.admin');
    Route::get('admin/library/reservations/data', [LibraryReservationAdminController::class, 'data'])
        ->name('library.reservations.data');
    Route::post('admin/library/reservations/{reservation}/approve', [LibraryReservationAdminController::class, 'approve'])
        ->name('library.reservations.approve');
    Route::post('admin/library/reservations/{reservation}/reject', [LibraryReservationAdminController::class, 'reject'])
        ->name('library.reservations.reject');

    Route::get('hr/perco', [PercoController::class, 'all'])
        ->name('hr.perco.index');

    Route::get('hr/perco-late', [PercoController::class, 'late'])
        ->name('hr.perco.late');

    Route::get('hr/perco-absence', [PercoController::class, 'absence'])
        ->name('hr.perco.absence');

    Route::get('hr/perco-early', [PercoController::class, 'early'])
        ->name('hr.perco.early');

    Route::get('hr/perco-overtime', [PercoController::class, 'overtime'])
        ->name('hr.perco.overtime');

    Route::get('hr/perco-timetracking', [PercoController::class, 'timetracking'])
        ->name('hr.perco.timetracking');

    Route::get('hr/perco-day-events', [PercoController::class, 'dayEvents'])
        ->name('hr.perco.day.events');

    Route::get('hr/perco-late-employee', [PercoController::class, 'lateEmployee'])
        ->name('hr.perco.late.employee');

    Route::get('hr/dashboard', [PercoController::class, 'dashboard'])
        ->name('hr.dashboard');

    Route::get('hr/division-late-people', [PercoController::class, 'divisionLatePeople'])
        ->name('hr.division.late.people');

    Route::get('hr/perco-settings', [PercoController::class, 'settings'])
        ->name('hr.perco.settings');
    Route::post('hr/perco-settings', [PercoController::class, 'updateSettings'])
        ->name('hr.perco.settings.update');

    Route::middleware(['calendar.access'])->group(function () {
        $canManageCalendar = function (int $actorId, int $ownerId): bool {
            if ($actorId === $ownerId) {
                return true;
            }

            return \App\Models\CalendarSecretaryAccess::query()
                ->where('manager_id', $ownerId)
                ->where('secretary_id', $actorId)
                ->where('is_active', true)
                ->whereNull('revoked_at')
                ->exists();
        };

        $slotAppliesToDay = function ($slot, \Carbon\Carbon $day): bool {
            $slotDate = $slot->date ? \Carbon\Carbon::parse($slot->date)->startOfDay() : null;

            if ($slot->recurrence_until) {
                $until = \Carbon\Carbon::parse($slot->recurrence_until)->endOfDay();
                if ($day->gt($until)) {
                    return false;
                }
            }

            if ($slot->recurrence_type === 'once') {
                return $slotDate && $day->isSameDay($slotDate);
            }

            if ($slotDate && $day->lt($slotDate)) {
                return false;
            }

            if ($slot->recurrence_type === 'daily') {
                return true;
            }

            if ($slot->recurrence_type === 'weekly') {
                $days = collect((array) ($slot->recurrence_days ?? []))
                    ->map(fn ($d) => (int) $d)
                    ->filter(fn ($d) => $d >= 1 && $d <= 7)
                    ->values()
                    ->all();

                if (empty($days) && $slotDate) {
                    $days = [$slotDate->dayOfWeekIso];
                }

                return in_array($day->dayOfWeekIso, $days, true);
            }

            return false;
        };

        $hasSlotOverlap = function (int $userId, \Carbon\Carbon $startsAt, \Carbon\Carbon $endsAt, string $timezone) use ($slotAppliesToDay): bool {
            $windowStart = $startsAt->copy()->startOfDay();
            $windowEnd = $endsAt->copy()->endOfDay();

            $slots = \App\Models\CalendarAvailabilitySlot::query()
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->where(function ($q) use ($windowStart, $windowEnd) {
                    $q->whereNull('date')
                        ->orWhereBetween('date', [$windowStart->toDateString(), $windowEnd->toDateString()]);
                })
                ->get(['id', 'date', 'starts_at', 'ends_at', 'buffer_minutes', 'recurrence_type', 'recurrence_days', 'recurrence_until']);

            for ($day = $windowStart->copy(); $day->lte($windowEnd); $day->addDay()) {
                $dayStart = $day->copy()->startOfDay();
                $dayEnd = $day->copy()->endOfDay();
                $rangeStart = $startsAt->gt($dayStart) ? $startsAt : $dayStart;
                $rangeEnd = $endsAt->lt($dayEnd) ? $endsAt : $dayEnd;

                foreach ($slots as $slot) {
                    if (!$slotAppliesToDay($slot, $day)) {
                        continue;
                    }

                    $slotStart = \Carbon\Carbon::parse($day->toDateString() . ' ' . $slot->starts_at, $timezone);
                    $slotEnd = \Carbon\Carbon::parse($day->toDateString() . ' ' . $slot->ends_at, $timezone);
                    if ($slotEnd->lte($slotStart)) {
                        $slotEnd->addDay();
                    }
                    $bufferMinutes = max(0, (int) ($slot->buffer_minutes ?? 0));
                    $slotStart->subMinutes($bufferMinutes);
                    $slotEnd->addMinutes($bufferMinutes);

                    if ($slotStart->lt($rangeEnd) && $slotEnd->gt($rangeStart)) {
                        return true;
                    }
                }
            }

            return false;
        };

        $findSlotOverlaps = function (int $userId, \Carbon\Carbon $startsAt, \Carbon\Carbon $endsAt, string $timezone) use ($slotAppliesToDay): array {
            $windowStart = $startsAt->copy()->startOfDay();
            $windowEnd = $endsAt->copy()->endOfDay();

            $slots = \App\Models\CalendarAvailabilitySlot::query()
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->where(function ($q) use ($windowStart, $windowEnd) {
                    $q->whereNull('date')
                        ->orWhereBetween('date', [$windowStart->toDateString(), $windowEnd->toDateString()]);
                })
                ->get(['id', 'date', 'starts_at', 'ends_at', 'buffer_minutes', 'recurrence_type', 'recurrence_days', 'recurrence_until', 'note']);

            $overlaps = [];

            for ($day = $windowStart->copy(); $day->lte($windowEnd); $day->addDay()) {
                $dayStart = $day->copy()->startOfDay();
                $dayEnd = $day->copy()->endOfDay();
                $rangeStart = $startsAt->gt($dayStart) ? $startsAt : $dayStart;
                $rangeEnd = $endsAt->lt($dayEnd) ? $endsAt : $dayEnd;

                foreach ($slots as $slot) {
                    if (! $slotAppliesToDay($slot, $day)) {
                        continue;
                    }

                    $slotStart = \Carbon\Carbon::parse($day->toDateString() . ' ' . $slot->starts_at, $timezone);
                    $slotEnd = \Carbon\Carbon::parse($day->toDateString() . ' ' . $slot->ends_at, $timezone);
                    if ($slotEnd->lte($slotStart)) {
                        $slotEnd->addDay();
                    }
                    $bufferMinutes = max(0, (int) ($slot->buffer_minutes ?? 0));
                    $slotStart->subMinutes($bufferMinutes);
                    $slotEnd->addMinutes($bufferMinutes);

                    if ($slotStart->lt($rangeEnd) && $slotEnd->gt($rangeStart)) {
                        $overlaps[] = [
                            'slot_id' => (int) $slot->id,
                            'note' => $slot->note ?: 'Занято',
                            'starts_at' => $slotStart,
                            'ends_at' => $slotEnd,
                        ];
                    }
                }
            }

            return $overlaps;
        };

        $expandSlotsForMonth = function (int $userId, \Carbon\Carbon $monthStart, \Carbon\Carbon $monthEnd, string $timezone) use ($slotAppliesToDay) {
            $slots = \App\Models\CalendarAvailabilitySlot::query()
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->where(function ($q) use ($monthStart, $monthEnd) {
                    $q->whereNull('date')
                        ->orWhereBetween('date', [$monthStart->toDateString(), $monthEnd->toDateString()]);
                })
                ->get(['id', 'date', 'starts_at', 'ends_at', 'buffer_minutes', 'recurrence_type', 'recurrence_days', 'recurrence_until', 'note']);

            $events = collect();

            for ($day = $monthStart->copy(); $day->lte($monthEnd); $day->addDay()) {
                foreach ($slots as $slot) {
                    if (!$slotAppliesToDay($slot, $day)) {
                        continue;
                    }

                    $slotStart = \Carbon\Carbon::parse($day->toDateString() . ' ' . $slot->starts_at, $timezone);
                    $slotEnd = \Carbon\Carbon::parse($day->toDateString() . ' ' . $slot->ends_at, $timezone);
                    if ($slotEnd->lte($slotStart)) {
                        $slotEnd->addDay();
                    }
                    $bufferMinutes = max(0, (int) ($slot->buffer_minutes ?? 0));
                    $slotStart->subMinutes($bufferMinutes);
                    $slotEnd->addMinutes($bufferMinutes);

                    $events->push([
                        'id' => 'slot-' . $slot->id . '-' . $day->format('Ymd'),
                        'title' => $slot->note ?: 'Занято',
                        'type' => 'other',
                        'status' => 'confirmed',
                        'starts_at' => $slotStart->format('Y-m-d\\TH:i:s'),
                        'ends_at' => $slotEnd->format('Y-m-d\\TH:i:s'),
                    ]);
                }
            }

            return $events;
        };

        Route::get('calendar', CalendarMyController::class)->name('calendar.index');
        Route::get('calendar/shared', function (\Illuminate\Http\Request $request) {
            $user = $request->user();
            $managedCalendars = \App\Models\CalendarSecretaryAccess::query()
                ->with(['manager:id,name,display_name,ad_title'])
                ->where('secretary_id', $user->id)
                ->where('is_active', true)
                ->whereNull('revoked_at')
                ->orderByDesc('granted_at')
                ->get()
                ->map(fn ($access) => [
                    'id' => $access->manager_id,
                    'name' => $access->manager?->display_name ?? $access->manager?->name,
                    'title' => $access->manager?->ad_title,
                ])
                ->values();

            if ($managedCalendars->isEmpty()) {
                return redirect()->route('calendar.index');
            }

            $selectedOwnerId = (int) $request->query('calendar_owner_id', $managedCalendars->first()['id']);

            return Inertia::render('Calendar/Shared', [
                'managedCalendars' => $managedCalendars,
                'selectedOwnerId' => $selectedOwnerId,
            ]);
        })->name('calendar.shared');
        Route::get('calendar/settings', function (\Illuminate\Http\Request $request) {
            $user = $request->user();
            $isAdmin = $user->resolvedRoleSlug() === 'admin';

            $employees = \App\Models\User::query()
                ->select('id', 'name', 'display_name', 'ad_title', 'email', 'phone')
                ->where('id', '<>', $user->id)
                ->orderBy('name')
                ->get()
                ->map(fn ($u) => [
                    'id' => $u->id,
                    'name' => $u->display_name ?? $u->name,
                    'title' => $u->ad_title,
                    'email' => $u->email,
                    'phone' => $u->phone,
                ])
                ->values();

            $calendarEmployees = [];
            $excludedUsers = [];
            $grantedUsers = [];
            $availableForGrant = [];
            if ($isAdmin) {
                $patterns   = \App\Http\Controllers\CalendarEmployeesController::LEADERSHIP_PATTERNS;
                $excludedIds = \App\Models\CalendarEmployeeExclusion::pluck('user_id')->all();
                $grantedIds  = \App\Models\CalendarEmployeeGrant::pluck('user_id')->all();

                $calendarEmployees = \App\Models\User::query()
                    ->select('id', 'name', 'display_name', 'ad_title', 'email', 'phone')
                    ->whereNotIn('id', $excludedIds)
                    ->whereNotIn('id', $grantedIds)
                    ->where(function ($q) use ($patterns) {
                        foreach ($patterns as $pattern) {
                            $q->orWhereRaw('LOWER(ad_title) LIKE ?', ['%' . $pattern . '%']);
                        }
                    })
                    ->orderBy('name')
                    ->get()
                    ->map(fn ($u) => [
                        'id'    => $u->id,
                        'name'  => $u->display_name ?? $u->name,
                        'title' => $u->ad_title,
                        'email' => $u->email,
                        'phone' => $u->phone,
                    ])
                    ->values();

                $grantsMap = \App\Models\CalendarEmployeeGrant::query()
                    ->whereIn('user_id', $grantedIds)
                    ->pluck('id', 'user_id')
                    ->all();

                $grantedUsers = \App\Models\User::query()
                    ->select('id', 'name', 'display_name', 'ad_title', 'email', 'phone')
                    ->whereIn('id', $grantedIds)
                    ->whereNotIn('id', $excludedIds)
                    ->orderBy('name')
                    ->get()
                    ->map(fn ($u) => [
                        'id'      => $u->id,
                        'grantId' => $grantsMap[$u->id] ?? null,
                        'name'    => $u->display_name ?? $u->name,
                        'title'   => $u->ad_title,
                        'email'   => $u->email,
                        'phone'   => $u->phone,
                    ])
                    ->values();

                $exclusionsMap = \App\Models\CalendarEmployeeExclusion::query()
                    ->whereIn('user_id', $excludedIds)
                    ->pluck('id', 'user_id')
                    ->all();

                $excludedUsers = \App\Models\User::query()
                    ->select('id', 'name', 'display_name', 'ad_title', 'email', 'phone')
                    ->whereIn('id', $excludedIds)
                    ->orderBy('name')
                    ->get()
                    ->map(fn ($u) => [
                        'id'          => $u->id,
                        'exclusionId' => $exclusionsMap[$u->id] ?? null,
                        'name'        => $u->display_name ?? $u->name,
                        'title'       => $u->ad_title,
                        'email'       => $u->email,
                        'phone'       => $u->phone,
                    ])
                    ->values();

                $alreadyVisibleIds = $calendarEmployees->pluck('id')->all();
                $availableForGrant = \App\Models\User::query()
                    ->select('id', 'name', 'display_name', 'ad_title', 'email', 'phone')
                    ->whereNotIn('id', $excludedIds)
                    ->whereNotIn('id', $grantedIds)
                    ->whereNotIn('id', $alreadyVisibleIds)
                    ->orderBy('name')
                    ->get()
                    ->map(fn ($u) => [
                        'id'    => $u->id,
                        'name'  => $u->display_name ?? $u->name,
                        'title' => $u->ad_title,
                        'email' => $u->email,
                        'phone' => $u->phone,
                    ])
                    ->values();
            }

            $secretaryAccesses = \App\Models\CalendarSecretaryAccess::query()
                ->with(['secretary:id,name,display_name,ad_title,email,phone'])
                ->where('manager_id', $user->id)
                ->where('is_active', true)
                ->whereNull('revoked_at')
                ->orderByDesc('granted_at')
                ->get()
                ->map(fn ($access) => [
                    'id' => $access->id,
                    'secretary_id' => $access->secretary_id,
                    'secretary_name' => $access->secretary?->display_name ?? $access->secretary?->name,
                    'secretary_title' => $access->secretary?->ad_title,
                    'secretary_email' => $access->secretary?->email,
                    'secretary_phone' => $access->secretary?->phone,
                    'granted_at' => $access->granted_at?->format('Y-m-d H:i:s'),
                ])
                ->values();

            $slots = \App\Models\CalendarAvailabilitySlot::query()
                ->where('user_id', $user->id)
                ->where('is_active', true)
                ->orderBy('recurrence_type')
                ->orderBy('starts_at')
                ->get(['id', 'date', 'starts_at', 'ends_at', 'slot_duration_minutes', 'buffer_minutes', 'access_type', 'min_rank_level', 'recurrence_type', 'recurrence_days', 'note'])
                ->map(fn ($slot) => [
                    'id' => $slot->id,
                    'date' => $slot->date?->toDateString(),
                    'starts_at' => $slot->starts_at,
                    'ends_at' => $slot->ends_at,
                    'slot_duration_minutes' => $slot->slot_duration_minutes,
                    'buffer_minutes' => $slot->buffer_minutes,
                    'access_type' => $slot->access_type,
                    'min_rank_level' => $slot->min_rank_level,
                    'recurrence_type' => $slot->recurrence_type,
                    'recurrence_days' => $slot->recurrence_days ?? [],
                    'note' => $slot->note,
                ])
                ->values();

            return Inertia::render('Calendar/Settings', [
                'employees'          => $employees,
                'secretaryAccesses'  => $secretaryAccesses,
                'slots'              => $slots,
                'isAdmin'            => $isAdmin,
                'calendarEmployees'  => $calendarEmployees,
                'grantedUsers'       => $grantedUsers,
                'excludedUsers'      => $excludedUsers,
                'availableForGrant'  => $availableForGrant,
            ]);
        })->name('calendar.settings');
        Route::post('calendar/employee-exclusions', function (\Illuminate\Http\Request $request) {
            abort_unless($request->user()->resolvedRoleSlug() === 'admin', 403);
            $data = $request->validate(['user_id' => 'required|integer|exists:users,id']);
            $exclusion = \App\Models\CalendarEmployeeExclusion::firstOrCreate(['user_id' => $data['user_id']]);
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.employee_exclusion.created', $exclusion, [
                'user_id' => (int) $data['user_id'],
            ]);
            return back()->with('success', 'Пользователь исключён из каталога сотрудников.');
        })->middleware('throttle:60,1')->name('calendar.employee-exclusions.store');
        Route::delete('calendar/employee-exclusions/{exclusion}', function (\App\Models\CalendarEmployeeExclusion $exclusion, \Illuminate\Http\Request $request) {
            abort_unless($request->user()->resolvedRoleSlug() === 'admin', 403);
            $changes = ['user_id' => $exclusion->user_id];
            $exclusion->delete();
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.employee_exclusion.deleted', $exclusion, $changes);
            return back()->with('success', 'Пользователь возвращён в каталог сотрудников.');
        })->middleware('throttle:60,1')->name('calendar.employee-exclusions.destroy');
        Route::post('calendar/employee-grants', function (\Illuminate\Http\Request $request) {
            abort_unless($request->user()->resolvedRoleSlug() === 'admin', 403);
            $data = $request->validate(['user_id' => 'required|integer|exists:users,id']);
            $grant = \App\Models\CalendarEmployeeGrant::firstOrCreate(['user_id' => $data['user_id']]);
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.employee_grant.created', $grant, [
                'user_id' => (int) $data['user_id'],
            ]);
            return back()->with('success', 'Пользователю выдан доступ к каталогу сотрудников.');
        })->middleware('throttle:60,1')->name('calendar.employee-grants.store');
        Route::delete('calendar/employee-grants/{grant}', function (\App\Models\CalendarEmployeeGrant $grant, \Illuminate\Http\Request $request) {
            abort_unless($request->user()->resolvedRoleSlug() === 'admin', 403);
            $changes = ['user_id' => $grant->user_id];
            $grant->delete();
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.employee_grant.deleted', $grant, $changes);
            return back()->with('success', 'Доступ пользователя отозван.');
        })->middleware('throttle:60,1')->name('calendar.employee-grants.destroy');
        Route::post('calendar/secretary-access', function (\Illuminate\Http\Request $request) {
            $data = $request->validate([
                'secretary_id' => 'required|integer|exists:users,id',
            ]);

            $user = $request->user();
            if ((int) $data['secretary_id'] === (int) $user->id) {
                return back()->with('error', 'Нельзя назначить самого себя секретарём.');
            }

            $access = \App\Models\CalendarSecretaryAccess::query()->updateOrCreate(
                [
                    'manager_id' => $user->id,
                    'secretary_id' => (int) $data['secretary_id'],
                ],
                [
                    'granted_at' => now(),
                    'revoked_at' => null,
                    'is_active' => true,
                ]
            );
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.secretary_access.granted', $access, [
                'manager_id' => $user->id,
                'secretary_id' => (int) $data['secretary_id'],
            ]);

            return back()->with('success', 'Секретарь назначен для совместного управления календарем.');
        })->middleware('throttle:60,1')->name('calendar.secretary-access.store');
        Route::delete('calendar/secretary-access/{access}', function (\App\Models\CalendarSecretaryAccess $access, \Illuminate\Http\Request $request) {
            abort_unless((int) $access->manager_id === (int) $request->user()->id, 403);

            $access->update([
                'is_active' => false,
                'revoked_at' => now(),
            ]);
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.secretary_access.revoked', $access, [
                'manager_id' => $access->manager_id,
                'secretary_id' => $access->secretary_id,
            ]);

            return back()->with('success', 'Доступ секретаря отозван.');
        })->middleware('throttle:60,1')->name('calendar.secretary-access.destroy');
        Route::post('calendar/events', function (\Illuminate\Http\Request $request) use ($canManageCalendar, $hasSlotOverlap, $findSlotOverlaps) {
            $data = $request->validate([
                'title'       => 'required|string|max:255',
                'type'        => 'required|in:meeting,vacation,business_trip,sick_leave,personal,remote,other',
                'attendee_id' => 'nullable|integer|exists:users,id|required_if:type,meeting',
                'owner_id'    => 'nullable|integer|exists:users,id',
                'starts_at'   => 'required|date|after_or_equal:now',
                'ends_at'     => 'required|date|after:starts_at',
                'description' => 'nullable|string|max:1000',
                'format'      => 'nullable|in:offline,online',
                'room'        => 'nullable|string|max:100',
            ]);
            $user = $request->user();
            $ownerId = (int) ($data['owner_id'] ?? $user->id);
            abort_unless($canManageCalendar($user->id, $ownerId), 403);

            $timezone = config('app.timezone');
            $startsAt = \Carbon\Carbon::parse($data['starts_at'], $timezone);
            $endsAt = \Carbon\Carbon::parse($data['ends_at'], $timezone);
            $owner = \App\Models\User::find($ownerId);
            $attendee = !empty($data['attendee_id'])
                ? \App\Models\User::find((int) $data['attendee_id'])
                : null;

            $displayName = function (?\App\Models\User $person): string {
                if (! $person) {
                    return 'Неизвестный пользователь';
                }

                return (string) ($person->display_name ?: $person->name ?: ('ID ' . $person->id));
            };

            $formatRange = function (\Carbon\Carbon $start, \Carbon\Carbon $end): string {
                $sameDay = $start->format('d.m.Y') === $end->format('d.m.Y');

                return $sameDay
                    ? sprintf('%s %s-%s', $start->format('d.m.Y'), $start->format('H:i'), $end->format('H:i'))
                    : sprintf('%s - %s', $start->format('d.m.Y H:i'), $end->format('d.m.Y H:i'));
            };

            $buildEventConflictDetails = function ($events, int $subjectUserId, string $subjectLabel) use ($displayName, $formatRange): array {
                return $events
                    ->map(function ($event) use ($subjectUserId, $subjectLabel, $displayName, $formatRange) {
                        $counterparty = null;

                        if ((int) $event->organizer_id === $subjectUserId) {
                            $counterparty = $event->attendee;
                        } elseif ((int) $event->attendee_id === $subjectUserId) {
                            $counterparty = $event->organizer;
                        }

                        $counterpartyText = $counterparty
                            ? $displayName($counterparty)
                            : 'не указан';

                        $roomText = !empty($event->room) ? (', где: ' . $event->room) : '';

                        return sprintf(
                            '• %s: "%s" (%s), с кем: %s%s',
                            $subjectLabel,
                            (string) ($event->title ?: 'Без названия'),
                            $formatRange($event->starts_at, $event->ends_at),
                            $counterpartyText,
                            $roomText
                        );
                    })
                    ->values()
                    ->all();
            };

            $buildSlotConflictDetails = function (array $slotOverlaps, string $subjectLabel) use ($formatRange): array {
                return collect($slotOverlaps)
                    ->map(fn ($slot) => sprintf(
                        '• %s: "%s" (%s), с кем: личная занятость',
                        $subjectLabel,
                        (string) ($slot['note'] ?? 'Занято'),
                        $formatRange($slot['starts_at'], $slot['ends_at'])
                    ))
                    ->values()
                    ->all();
            };

            $ownerLabel = 'В вашем календаре';
            $attendeeLabel = 'В календаре сотрудника ' . $displayName($attendee);
            $typeColors = [
                'meeting' => '#3b82f6',
                'vacation' => '#10b981',
                'business_trip' => '#8b5cf6',
                'sick_leave' => '#f97316',
                'personal' => '#ec4899',
                'remote' => '#14b8a6',
                'other' => '#6b7280',
            ];

            if ($data['type'] === 'meeting' && !empty($data['attendee_id'])) {
                $attendeeBlockingEvents = \App\Models\CalendarEvent::query()
                    ->with(['organizer:id,name,display_name', 'attendee:id,name,display_name'])
                    ->whereNotIn('status', ['cancelled', 'declined'])
                    ->where('type', '<>', 'meeting')
                    ->where('starts_at', '<', $endsAt)
                    ->where('ends_at', '>', $startsAt)
                    ->where(function ($q) use ($data) {
                        $q->where('organizer_id', $data['attendee_id'])
                            ->orWhere('attendee_id', $data['attendee_id']);
                    })
                    ->get(['id', 'title', 'type', 'organizer_id', 'attendee_id', 'starts_at', 'ends_at', 'room']);

                $attendeeSlotOverlaps = $findSlotOverlaps((int) $data['attendee_id'], $startsAt, $endsAt, $timezone);

                if ($attendeeBlockingEvents->isNotEmpty() || !empty($attendeeSlotOverlaps)) {
                    $details = [
                        ...$buildEventConflictDetails($attendeeBlockingEvents, (int) $data['attendee_id'], $attendeeLabel),
                        ...$buildSlotConflictDetails($attendeeSlotOverlaps, $attendeeLabel),
                    ];
                    $details = array_values(array_unique($details));
                    $detailsPreview = implode("\n", array_slice($details, 0, 3));
                    $hasMore = count($details) > 3;

                    return back()->with(
                        'error',
                        "Нельзя назначить встречу: у выбранного сотрудника есть конфликт в этот период.\n"
                        . $detailsPreview
                        . ($hasMore ? "\n• ...и другие пересечения" : '')
                    );
                }
            }

            $blockingTypes = ['vacation', 'sick_leave', 'business_trip', 'personal', 'remote', 'other'];

            $ownerConflictEvents = \App\Models\CalendarEvent::query()
                ->with(['organizer:id,name,display_name', 'attendee:id,name,display_name'])
                ->whereNotIn('status', ['cancelled', 'declined'])
                ->whereIn('type', $blockingTypes)
                ->where('starts_at', '<', $endsAt)
                ->where('ends_at', '>', $startsAt)
                ->where(function ($q) use ($ownerId) {
                    $q->where('organizer_id', $ownerId)
                        ->orWhere('attendee_id', $ownerId);
                })
                ->get(['id', 'title', 'type', 'organizer_id', 'attendee_id', 'starts_at', 'ends_at', 'room']);

            $attendeeConflictEvents = !empty($data['attendee_id'])
                ? \App\Models\CalendarEvent::query()
                    ->with(['organizer:id,name,display_name', 'attendee:id,name,display_name'])
                    ->whereNotIn('status', ['cancelled', 'declined'])
                    ->whereIn('type', $blockingTypes)
                    ->where('starts_at', '<', $endsAt)
                    ->where('ends_at', '>', $startsAt)
                    ->where(function ($q) use ($data) {
                        $q->where('organizer_id', $data['attendee_id'])
                            ->orWhere('attendee_id', $data['attendee_id']);
                    })
                    ->get(['id', 'title', 'type', 'organizer_id', 'attendee_id', 'starts_at', 'ends_at', 'room'])
                : collect();

            $ownerSlotOverlaps = $findSlotOverlaps($ownerId, $startsAt, $endsAt, $timezone);
            $attendeeSlotOverlaps = !empty($data['attendee_id'])
                ? $findSlotOverlaps((int) $data['attendee_id'], $startsAt, $endsAt, $timezone)
                : [];

            $conflictDetails = [
                ...$buildEventConflictDetails($ownerConflictEvents, $ownerId, $ownerLabel),
                ...$buildSlotConflictDetails($ownerSlotOverlaps, $ownerLabel),
                ...(!empty($data['attendee_id']) ? $buildEventConflictDetails($attendeeConflictEvents, (int) $data['attendee_id'], $attendeeLabel) : []),
                ...(!empty($data['attendee_id']) ? $buildSlotConflictDetails($attendeeSlotOverlaps, $attendeeLabel) : []),
            ];

            $conflictDetails = array_values(array_unique($conflictDetails));
            $conflictExists = !empty($conflictDetails)
                || $hasSlotOverlap($ownerId, $startsAt, $endsAt, $timezone)
                || (!empty($data['attendee_id']) && $hasSlotOverlap((int) $data['attendee_id'], $startsAt, $endsAt, $timezone));

            $isMeetingRequest = $data['type'] === 'meeting' && !empty($data['attendee_id']) && (int) $data['attendee_id'] !== $ownerId;
            $createdEvent = \App\Models\CalendarEvent::create([
                'organizer_id' => $ownerId,
                'attendee_id'  => $data['attendee_id'] ?? null,
                'starts_at'    => $startsAt,
                'ends_at'      => $endsAt,
                'status'       => $conflictExists ? 'conflict' : ($isMeetingRequest ? 'pending' : 'confirmed'),
                'format'       => $data['format'] ?? 'offline',
                'room'         => $data['room'] ?? null,
                'title'        => $data['title'],
                'type'         => $data['type'],
                'color'        => $typeColors[$data['type']] ?? '#6b7280',
                'description'  => $data['description'] ?? null,
            ]);

            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.event.created', $createdEvent, [
                'status' => $createdEvent->status,
                'type' => $createdEvent->type,
                'format' => $createdEvent->format,
                'starts_at' => $createdEvent->starts_at?->toDateTimeString(),
                'ends_at' => $createdEvent->ends_at?->toDateTimeString(),
            ], $ownerId !== (int) $user->id ? $ownerId : null);

            if ($data['type'] === 'meeting' && !empty($data['attendee_id'])) {
                $attendee = \App\Models\User::find($data['attendee_id']);

                if ($attendee) {
                    $owner = \App\Models\User::find($ownerId);
                    $organizerName = $owner?->display_name ?? $owner?->name ?? $user->display_name ?? $user->name;

                    $sameDay = $startsAt->format('d.m.Y') === $endsAt->format('d.m.Y');
                    $whenStr = $sameDay
                        ? sprintf('%s %s - %s', $startsAt->format('d.m.Y'), $startsAt->format('H:i'), $endsAt->format('H:i'))
                        : sprintf('%s - %s', $startsAt->format('d.m.Y H:i'), $endsAt->format('d.m.Y H:i'));

                    $message = sprintf(
                        "Поступила новая заявка на встречу\nОт: %s\nТема: %s\nКогда: %s",
                        $organizerName,
                        $createdEvent->title,
                        $whenStr
                    );

                    if (!empty($createdEvent->description)) {
                        $message .= "\nОписание: " . $createdEvent->description;
                    }

                    app(\App\Services\GreenApiWhatsAppNotifier::class)
                        ->sendMessageToUser($attendee, $message, [
                            'notification_event_id' => $createdEvent->id,
                            'notification_type' => 'new_request',
                        ]);
                }
            }

            if ($conflictExists) {
                $detailsPreview = implode("\n", array_slice($conflictDetails, 0, 4));
                $hasMore = count($conflictDetails) > 4;

                return back()->with(
                    'warning',
                    "Обнаружено пересечение по времени. Событие сохранено со статусом \"Конфликт\".\n"
                    . $detailsPreview
                    . ($hasMore ? "\n• ...и другие пересечения" : '')
                );
            }

            return back()->with('success', $createdEvent->status === 'pending' ? 'Заявка на встречу отправлена и ожидает подтверждения.' : 'Событие успешно добавлено.');
        })->middleware('throttle:60,1')->name('calendar.events.store');
        Route::post('calendar/slots', function (\Illuminate\Http\Request $request) use ($canManageCalendar) {
            $data = $request->validate([
                'owner_id' => 'nullable|integer|exists:users,id',
                'starts_at' => 'required|date_format:H:i',
                'ends_at' => 'required|date_format:H:i|different:starts_at',
                'recurrence_type' => 'required|in:daily,weekly,once',
                'date' => 'nullable|date|required_if:recurrence_type,once',
                'recurrence_days' => 'nullable|array',
                'recurrence_days.*' => 'integer|min:1|max:7',
                'note' => 'nullable|string|max:255',
                'slot_duration_minutes' => 'nullable|integer|min:15|max:240',
                'buffer_minutes' => 'nullable|integer|min:0|max:120',
                'access_type' => 'nullable|in:open,invitation,rank',
                'min_rank_level' => 'nullable|integer|min:1|max:10|required_if:access_type,rank',
            ]);

            $user = $request->user();
            $ownerId = (int) ($data['owner_id'] ?? $user->id);
            abort_unless($canManageCalendar($user->id, $ownerId), 403);

            $slot = \App\Models\CalendarAvailabilitySlot::create([
                'user_id' => $ownerId,
                'created_by' => $user->id,
                'date' => $data['recurrence_type'] === 'once' ? $data['date'] : null,
                'starts_at' => $data['starts_at'],
                'ends_at' => $data['ends_at'],
                'slot_duration_minutes' => (int) ($data['slot_duration_minutes'] ?? 30),
                'buffer_minutes' => (int) ($data['buffer_minutes'] ?? 0),
                'access_type' => $data['access_type'] ?? 'open',
                'min_rank_level' => ($data['access_type'] ?? 'open') === 'rank' ? (int) ($data['min_rank_level'] ?? 1) : null,
                'recurrence_type' => $data['recurrence_type'],
                'recurrence_days' => $data['recurrence_type'] === 'weekly'
                    ? ($data['recurrence_days'] ?? [now()->dayOfWeekIso])
                    : null,
                'is_active' => true,
                'note' => $data['note'] ?? 'Занято',
            ]);

            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.slot.created', $slot, [
                'starts_at' => $slot->starts_at,
                'ends_at' => $slot->ends_at,
                'recurrence_type' => $slot->recurrence_type,
                'slot_duration_minutes' => $slot->slot_duration_minutes,
                'buffer_minutes' => $slot->buffer_minutes,
                'access_type' => $slot->access_type,
                'min_rank_level' => $slot->min_rank_level,
            ], $ownerId !== (int) $user->id ? $ownerId : null);

            return back()->with('success', 'Постоянная занятость добавлена в календарь.');
        })->middleware('throttle:60,1')->name('calendar.slots.store');
        Route::delete('calendar/slots/{slot}', function (\App\Models\CalendarAvailabilitySlot $slot, \Illuminate\Http\Request $request) use ($canManageCalendar) {
            $user = $request->user();
            abort_unless($canManageCalendar($user->id, (int) $slot->user_id), 403);

            $slot->update(['is_active' => false]);
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.slot.deactivated', $slot, [
                'is_active' => false,
            ], (int) $slot->user_id !== (int) $user->id ? (int) $slot->user_id : null);

            return back()->with('success', 'Слот постоянной занятости удалён.');
        })->middleware('throttle:60,1')->name('calendar.slots.destroy');
        Route::get('calendar/employees/{employee}/availability', function (\App\Models\User $employee, \Illuminate\Http\Request $request) use ($expandSlotsForMonth) {
            $year = (int) $request->query('year', now()->year);
            $month = (int) $request->query('month', now()->month);
            $start = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
            $end = $start->copy()->endOfMonth();
            $timezone = config('app.timezone');

            $events = \App\Models\CalendarEvent::query()
                ->where(function ($q) use ($employee) {
                    $q->where('organizer_id', $employee->id)
                        ->orWhere('attendee_id', $employee->id);
                })
                ->whereNotIn('status', ['cancelled', 'declined'])
                ->where('starts_at', '<=', $end)
                ->where('ends_at', '>=', $start)
                ->orderBy('starts_at')
                ->get(['id', 'title', 'type', 'status', 'starts_at', 'ends_at']);

            $busyDays = [];
            $absenceDays = [];
            $mappedEvents = $events->map(function ($event) use (&$busyDays, &$absenceDays, $start, $end) {
                $rangeStart = $event->starts_at->lt($start) ? $start->copy()->startOfDay() : $event->starts_at->copy()->startOfDay();
                $rangeEnd = $event->ends_at->gt($end) ? $end->copy()->startOfDay() : $event->ends_at->copy()->startOfDay();
                $isAbsence = in_array($event->type, ['vacation', 'business_trip', 'sick_leave', 'personal', 'remote', 'other'], true);

                for ($d = $rangeStart->copy(); $d->lte($rangeEnd); $d->addDay()) {
                    $key = $d->toDateString();
                    $busyDays[$key] = true;
                    if ($isAbsence) {
                        $absenceDays[$key] = true;
                    }
                }

                return [
                    'id' => $event->id,
                    'title' => $event->title,
                    'type' => $event->type,
                    'status' => $event->status,
                    'starts_at' => $event->starts_at?->format('Y-m-d\\TH:i:s'),
                    'ends_at' => $event->ends_at?->format('Y-m-d\\TH:i:s'),
                ];
            })->values();

            $expandSlotsForMonth($employee->id, $start, $end, $timezone)
                ->map(function ($slotEvent) use (&$busyDays) {
                    $rangeStart = \Carbon\Carbon::parse($slotEvent['starts_at'])->startOfDay();
                    $rangeEnd = \Carbon\Carbon::parse($slotEvent['ends_at'])->startOfDay();

                    for ($d = $rangeStart->copy(); $d->lte($rangeEnd); $d->addDay()) {
                        $busyDays[$d->toDateString()] = true;
                    }
                })
                ->values();

            return response()->json([
                'year' => $year,
                'month' => $month,
                'events' => $mappedEvents,
                'busy_days' => array_keys($busyDays),
                'absence_days' => array_keys($absenceDays),
            ]);
        })->name('calendar.employees.availability');
        Route::patch('calendar/events/{event}', function (\App\Models\CalendarEvent $event, \Illuminate\Http\Request $request) use ($canManageCalendar) {
            $user = $request->user();
            abort_unless($canManageCalendar($user->id, (int) $event->organizer_id), 403);
            $timezone = config('app.timezone');
            $data = $request->validate([
                'title'       => 'required|string|max:255',
                'type'        => 'required|in:meeting,vacation,business_trip,sick_leave,personal,remote,other',
                'starts_at'   => 'required|date',
                'ends_at'     => 'required|date|after:starts_at',
                'description' => 'nullable|string|max:1000',
                'color'       => 'nullable|string|max:7|regex:/^#[0-9a-fA-F]{6}$/',
                'format'      => 'nullable|in:offline,online',
                'room'        => 'nullable|string|max:100',
            ]);
            $before = $event->only(['title', 'type', 'starts_at', 'ends_at', 'description', 'color', 'format', 'room']);
            $event->update([
                'title'       => $data['title'],
                'type'        => $data['type'],
                'color'       => $data['color'] ?? null,
                'starts_at'   => \Carbon\Carbon::parse($data['starts_at'], $timezone),
                'ends_at'     => \Carbon\Carbon::parse($data['ends_at'], $timezone),
                'description' => $data['description'] ?? null,
                'format'      => $data['format'] ?? $event->format,
                'room'        => $data['room'] ?? null,
            ]);
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.event.updated', $event, [
                'before' => $before,
                'after' => $event->only(['title', 'type', 'starts_at', 'ends_at', 'description', 'color', 'format', 'room']),
            ], (int) $event->organizer_id !== (int) $user->id ? (int) $event->organizer_id : null);
            return back()->with('success', 'Событие обновлено.');
        })->middleware('throttle:60,1')->name('calendar.events.update');
        Route::patch('calendar/events/{event}/confirm', function (\App\Models\CalendarEvent $event, \Illuminate\Http\Request $request) use ($canManageCalendar) {
            $user = $request->user();
            abort_unless($event->type === 'meeting', 404);
            abort_unless($event->status === 'pending', 422);
            abort_unless($canManageCalendar($user->id, (int) $event->attendee_id), 403);

            $event->update(['status' => 'confirmed']);
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.event.confirmed', $event, [
                'status' => 'confirmed',
            ], (int) $event->attendee_id !== (int) $user->id ? (int) $event->attendee_id : null);

            if ($event->organizer) {
                $attendeeName = $event->attendee?->display_name ?? $event->attendee?->name ?? 'Сотрудник';
                app(\App\Services\GreenApiWhatsAppNotifier::class)->sendMessageToUser(
                    $event->organizer,
                    "Встреча подтверждена\nКем: {$attendeeName}\nТема: {$event->title}\nКогда: {$event->starts_at?->format('d.m.Y H:i')} - {$event->ends_at?->format('H:i')}",
                    [
                        'notification_event_id' => $event->id,
                        'notification_type' => 'confirmed',
                    ]
                );
            }

            return back()->with('success', 'Встреча подтверждена.');
        })->middleware('throttle:60,1')->name('calendar.events.confirm');
        Route::patch('calendar/events/{event}/decline', function (\App\Models\CalendarEvent $event, \Illuminate\Http\Request $request) use ($canManageCalendar) {
            $data = $request->validate([
                'reason' => 'nullable|string|max:1000',
            ]);
            $user = $request->user();
            abort_unless($event->type === 'meeting', 404);
            abort_unless(in_array($event->status, ['pending', 'confirmed'], true), 422);
            abort_unless($canManageCalendar($user->id, (int) $event->attendee_id), 403);

            $event->update([
                'status' => 'declined',
                'cancelled_by' => $user->id,
                'cancelled_at' => now(),
                'cancellation_reason' => $data['reason'] ?? null,
            ]);
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.event.declined', $event, [
                'status' => 'declined',
                'reason' => $data['reason'] ?? null,
            ], (int) $event->attendee_id !== (int) $user->id ? (int) $event->attendee_id : null);

            if ($event->organizer) {
                $attendeeName = $event->attendee?->display_name ?? $event->attendee?->name ?? 'Сотрудник';
                $message = "Встреча отклонена\nКем: {$attendeeName}\nТема: {$event->title}";
                if (!empty($data['reason'])) {
                    $message .= "\nПричина: {$data['reason']}";
                }
                app(\App\Services\GreenApiWhatsAppNotifier::class)->sendMessageToUser($event->organizer, $message, [
                    'notification_event_id' => $event->id,
                    'notification_type' => 'declined',
                ]);
            }

            return back()->with('success', 'Встреча отклонена.');
        })->middleware('throttle:60,1')->name('calendar.events.decline');
        Route::patch('calendar/events/{event}/cancel', function (\App\Models\CalendarEvent $event, \Illuminate\Http\Request $request) use ($canManageCalendar) {
            $data = $request->validate([
                'reason' => 'required|string|max:1000',
            ]);
            $user = $request->user();
            $canCancel = $canManageCalendar($user->id, (int) $event->organizer_id)
                || $canManageCalendar($user->id, (int) $event->attendee_id);
            abort_unless($canCancel, 403);

            $event->update([
                'status' => 'cancelled',
                'cancelled_by' => $user->id,
                'cancelled_at' => now(),
                'cancellation_reason' => $data['reason'],
            ]);

            $zoomWarning = null;
            if ($event->zoom_meeting_id) {
                $zoom = app(\App\Services\ZoomMeetingService::class);
                if (! $zoom->cancelMeeting((string) $event->zoom_meeting_id)) {
                    $zoomWarning = $zoom->getLastError() ?: 'Не удалось отменить Zoom конференцию.';
                }
            }

            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.event.cancelled', $event, [
                'status' => 'cancelled',
                'reason' => $data['reason'],
                'zoom_warning' => $zoomWarning,
            ], (int) $event->organizer_id !== (int) $user->id ? (int) $event->organizer_id : null);

            $recipients = collect([$event->organizer, $event->attendee])
                ->filter(fn ($recipient) => $recipient && (int) $recipient->id !== (int) $user->id)
                ->unique('id');

            foreach ($recipients as $recipient) {
                app(\App\Services\GreenApiWhatsAppNotifier::class)->sendMessageToUser($recipient, "Встреча отменена\nТема: {$event->title}\nПричина: {$data['reason']}", [
                    'notification_event_id' => $event->id,
                    'notification_type' => 'cancelled',
                ]);
            }

            $response = back()->with('success', 'Встреча отменена.');
            if ($zoomWarning) {
                $response->with('warning', $zoomWarning);
            }
            return $response;
        })->middleware('throttle:60,1')->name('calendar.events.cancel');
        Route::patch('calendar/events/{event}/reschedule', function (\App\Models\CalendarEvent $event, \Illuminate\Http\Request $request) use ($canManageCalendar, $hasSlotOverlap) {
            $data = $request->validate([
                'starts_at' => 'required|date|after_or_equal:now',
                'ends_at' => 'required|date|after:starts_at',
                'reason' => 'nullable|string|max:1000',
            ]);
            $user = $request->user();
            abort_unless($event->type === 'meeting' && $event->attendee_id, 404);
            $canReschedule = $canManageCalendar($user->id, (int) $event->organizer_id)
                || $canManageCalendar($user->id, (int) $event->attendee_id);
            abort_unless($canReschedule, 403);

            $timezone = config('app.timezone');
            $startsAt = \Carbon\Carbon::parse($data['starts_at'], $timezone);
            $endsAt = \Carbon\Carbon::parse($data['ends_at'], $timezone);

            $blockingConflict = \App\Models\CalendarEvent::query()
                ->where('id', '<>', $event->id)
                ->whereNotIn('status', ['cancelled', 'declined'])
                ->where('type', '<>', 'meeting')
                ->where('starts_at', '<', $endsAt)
                ->where('ends_at', '>', $startsAt)
                ->where(function ($q) use ($event) {
                    $q->where('organizer_id', $event->organizer_id)
                        ->orWhere('attendee_id', $event->organizer_id)
                        ->orWhere('organizer_id', $event->attendee_id)
                        ->orWhere('attendee_id', $event->attendee_id);
                })
                ->exists();

            if ($blockingConflict || $hasSlotOverlap((int) $event->organizer_id, $startsAt, $endsAt, $timezone) || $hasSlotOverlap((int) $event->attendee_id, $startsAt, $endsAt, $timezone)) {
                return back()->with('error', 'Нельзя перенести встречу: выбранное время пересекается с занятостью участника.');
            }

            $before = $event->only(['starts_at', 'ends_at', 'status']);
            $event->update([
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'status' => 'pending',
            ]);

            $zoomWarning = null;
            if ($event->zoom_meeting_id) {
                $zoom = app(\App\Services\ZoomMeetingService::class);
                if (! $zoom->updateMeeting((string) $event->zoom_meeting_id, $event->title, $startsAt, $endsAt, $event->description)) {
                    $zoomWarning = $zoom->getLastError() ?: 'Не удалось обновить Zoom конференцию.';
                }
            }

            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.event.rescheduled', $event, [
                'before' => $before,
                'after' => $event->only(['starts_at', 'ends_at', 'status']),
                'reason' => $data['reason'] ?? null,
                'zoom_warning' => $zoomWarning,
            ], (int) $event->organizer_id !== (int) $user->id ? (int) $event->organizer_id : null);

            $recipient = (int) $user->id === (int) $event->attendee_id ? $event->organizer : $event->attendee;
            if ($recipient) {
                app(\App\Services\GreenApiWhatsAppNotifier::class)->sendMessageToUser($recipient, "Встреча перенесена и ожидает подтверждения\nТема: {$event->title}\nНовое время: {$event->starts_at?->format('d.m.Y H:i')} - {$event->ends_at?->format('H:i')}", [
                    'notification_event_id' => $event->id,
                    'notification_type' => 'rescheduled',
                ]);
            }

            $response = back()->with('success', 'Встреча перенесена и ожидает подтверждения.');
            if ($zoomWarning) {
                $response->with('warning', $zoomWarning);
            }
            return $response;
        })->middleware('throttle:60,1')->name('calendar.events.reschedule');
        Route::get('calendar/events/suggest-slot', function (\Illuminate\Http\Request $request) use ($canManageCalendar, $hasSlotOverlap) {
            $data = $request->validate([
                'attendee_id' => 'required|integer|exists:users,id',
                'owner_id'    => 'nullable|integer|exists:users,id',
                'starts_at'   => 'nullable|date',
                'ends_at'     => 'nullable|date|after:starts_at',
            ]);

            $timezone = config('app.timezone');
            $user = $request->user();
            $ownerId = (int) ($data['owner_id'] ?? $user->id);
            abort_unless($canManageCalendar($user->id, $ownerId), 403);

            $baseStart = !empty($data['starts_at'])
                ? \Carbon\Carbon::parse($data['starts_at'], $timezone)
                : now($timezone);
            $baseEnd = !empty($data['ends_at'])
                ? \Carbon\Carbon::parse($data['ends_at'], $timezone)
                : $baseStart->copy()->addHour();

            $durationMinutes = max(15, min(240, $baseStart->diffInMinutes($baseEnd)));

            $windowStart = $baseStart->copy()->startOfDay()->setHour(8)->setMinute(30);
            if ($windowStart->lt(now($timezone))) {
                $nowSlot = now($timezone)->copy()->second(0);
                $minute = (int) $nowSlot->format('i');
                $delta = (30 - ($minute % 30)) % 30;
                if ($delta > 0) {
                    $nowSlot->addMinutes($delta);
                }
                $windowStart = $nowSlot;
            }
            $windowEnd = $baseStart->copy()->startOfDay()->setHour(17)->setMinute(30);

            if ($windowStart->gte($windowEnd)) {
                return response()->json([
                    'found' => false,
                    'message' => 'Сегодня не осталось свободных слотов.',
                ]);
            }

            $events = \App\Models\CalendarEvent::query()
                ->whereNotIn('status', ['cancelled', 'declined'])
                ->where('starts_at', '<', $windowEnd)
                ->where('ends_at', '>', $windowStart)
                ->where(function ($q) use ($ownerId, $data) {
                    $q->where('organizer_id', $ownerId)
                        ->orWhere('attendee_id', $ownerId)
                        ->orWhere('organizer_id', $data['attendee_id'])
                        ->orWhere('attendee_id', $data['attendee_id']);
                })
                ->orderBy('starts_at')
                ->get(['starts_at', 'ends_at']);

            $cursor = $windowStart->copy();
            while ($cursor->copy()->addMinutes($durationMinutes)->lte($windowEnd)) {
                $candidateStart = $cursor->copy();
                $candidateEnd = $cursor->copy()->addMinutes($durationMinutes);

                $overlap = $events->contains(function ($e) use ($candidateStart, $candidateEnd) {
                    return $e->starts_at < $candidateEnd && $e->ends_at > $candidateStart;
                });

                $slotOverlap = $hasSlotOverlap($ownerId, $candidateStart, $candidateEnd, $timezone)
                    || $hasSlotOverlap((int) $data['attendee_id'], $candidateStart, $candidateEnd, $timezone);

                if (!$overlap && !$slotOverlap) {
                    return response()->json([
                        'found' => true,
                        'starts_at' => $candidateStart->format('Y-m-d\\TH:i'),
                        'ends_at' => $candidateEnd->format('Y-m-d\\TH:i'),
                    ]);
                }

                $cursor->addMinutes(30);
            }

            return response()->json([
                'found' => false,
                'message' => 'Свободный слот не найден в рабочее время (08:30-17:30).',
            ]);
        })->name('calendar.events.suggest-slot');
        Route::delete('calendar/events/{event}', function (\App\Models\CalendarEvent $event, \Illuminate\Http\Request $request) use ($canManageCalendar) {
            $user = $request->user();
            abort_unless($canManageCalendar($user->id, (int) $event->organizer_id), 403);
            $event->update([
                'status' => 'cancelled',
                'cancelled_by' => $user->id,
                'cancelled_at' => now(),
                'cancellation_reason' => 'Отменено через старое действие удаления.',
            ]);
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.event.cancelled.legacy_delete', $event, [
                'status' => 'cancelled',
            ], (int) $event->organizer_id !== (int) $user->id ? (int) $event->organizer_id : null);
            return back()->with('success', 'Событие отменено.');
        })->middleware('throttle:60,1')->name('calendar.events.destroy');
        Route::get('calendar/employees', CalendarEmployeesController::class)->name('calendar.employees');
        Route::get('calendar/employees/{employee}', CalendarEmployeeProfileController::class)->name('calendar.employees.profile');
        Route::get('calendar/conferences', [CalendarConferencesController::class, 'index'])->name('calendar.conferences');
        Route::post('calendar/conferences', [CalendarConferencesController::class, 'store'])->middleware('throttle:20,1')->name('calendar.conferences.store');
        Route::get('calendar/analytics', CalendarAnalyticsController::class)->name('calendar.analytics');
        Route::patch('calendar/status', function (\Illuminate\Http\Request $request) {
            $data = $request->validate([
                'status' => 'required|in:available,busy,soon,dnd',
            ]);
            $user = $request->user();
            $before = $user->calendar_status;
            $user->update(['calendar_status' => $data['status']]);
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.status.updated', $user, [
                'before' => $before,
                'after' => $data['status'],
            ]);
            return back();
        })->middleware('throttle:60,1')->name('calendar.status.update');
        Route::post('calendar/holidays', function (\Illuminate\Http\Request $request) {
            $data = $request->validate([
                'date' => 'required|date',
                'name_ru' => 'required|string|max:255',
                'name_kk' => 'nullable|string|max:255',
            ]);
            $holiday = \App\Models\CalendarHoliday::create([
                'date'    => $data['date'],
                'name_ru' => $data['name_ru'],
                'name_kk' => $data['name_kk'] ?? null,
                'year'    => (int) date('Y', strtotime($data['date'])),
                'is_active' => true,
            ]);
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.holiday.created', $holiday, $holiday->only(['date', 'name_ru', 'name_kk']));
            return back();
        })->middleware('throttle:60,1')->name('calendar.holidays.store');
        Route::delete('calendar/holidays/{holiday}', function (\App\Models\CalendarHoliday $holiday, \Illuminate\Http\Request $request) {
            $before = $holiday->only(['date', 'name_ru', 'name_kk']);
            $holiday->delete();
            app(\App\Services\CalendarAuditLogger::class)->log($request, 'calendar.holiday.deleted', $holiday, $before);
            return back();
        })->middleware('throttle:60,1')->name('calendar.holidays.destroy');
    });

    Route::get('templates', [CertificateTemplateController::class, 'index'])
        ->name('templates.index');
    Route::post('admin/certificate-templates', [CertificateTemplateController::class, 'store'])
        ->name('certificate-templates.store');
    Route::patch('admin/certificate-templates/{template}', [CertificateTemplateController::class, 'update'])
        ->name('certificate-templates.update');
    Route::post('admin/certificate-templates/{template}/toggle-active', [CertificateTemplateController::class, 'toggleActive'])
        ->name('certificate-templates.toggle-active');
    Route::post('admin/certificate-templates/{template}/versions', [CertificateTemplateController::class, 'storeVersion'])
        ->name('certificate-templates.versions.store');
    Route::post('admin/certificate-template-versions/{version}/publish', [CertificateTemplateController::class, 'publishVersion'])
        ->name('certificate-template-versions.publish');

    Route::get('certificates', [CertificateRegistryController::class, 'page'])
        ->name('certificates.index');
    Route::get('certificates/{certificate}', [CertificateRegistryController::class, 'show'])
        ->name('certificates.show');

    Route::get('admin/certificates/registry', [CertificateRegistryController::class, 'index'])
        ->name('certificates.registry.index');
    Route::post('admin/certificates/generate', [CertificateRegistryController::class, 'generate'])
        ->name('certificates.generate');
    Route::get('admin/certificates/registry/export', [CertificateRegistryController::class, 'exportCsv'])
        ->name('certificates.registry.export');
    Route::post('admin/certificates/{certificate}/issue', [CertificateRegistryController::class, 'issue'])
        ->name('certificates.issue');
    Route::post('admin/certificates/{certificate}/revoke', [CertificateRegistryController::class, 'revoke'])
        ->name('certificates.revoke');

    // Survey Module Routes
    // Student Surveys
    Route::get('surveys', [\App\Http\Controllers\SurveyStudentController::class, 'index'])
        ->name('surveys.index');
    Route::get('surveys/{survey}/start', [\App\Http\Controllers\SurveyStudentController::class, 'start'])
        ->name('surveys.start');
    Route::post('surveys/{survey}/store-answers', [\App\Http\Controllers\SurveyStudentController::class, 'store'])
        ->name('surveys.store-answers');
    Route::post('surveys/{survey}/complete', [\App\Http\Controllers\SurveyStudentController::class, 'complete'])
        ->name('surveys.complete');
    Route::get('surveys/{survey}/show', [\App\Http\Controllers\SurveyStudentController::class, 'show'])
        ->name('surveys.show');

    // Admin Surveys Management
    Route::get('admin/surveys', [\App\Http\Controllers\SurveyAdminController::class, 'index'])
        ->name('admin.surveys.index');
    Route::get('admin/surveys/create', [\App\Http\Controllers\SurveyAdminController::class, 'create'])
        ->name('admin.surveys.create');
    Route::post('admin/surveys/bulk-create', [\App\Http\Controllers\SurveyAdminController::class, 'storeBulk'])
        ->name('admin.surveys.store-bulk');
    Route::get('admin/surveys/{survey}', [\App\Http\Controllers\SurveyAdminController::class, 'show'])
        ->name('admin.surveys.show');
    Route::post('admin/surveys/{survey}/cancel', [\App\Http\Controllers\SurveyAdminController::class, 'cancel'])
        ->name('admin.surveys.cancel');
    Route::delete('admin/surveys/{survey}', [\App\Http\Controllers\SurveyAdminController::class, 'destroy'])
        ->name('admin.surveys.destroy');

    // Survey Questions Management
    Route::get('admin/survey-questions', [\App\Http\Controllers\SurveyQuestionController::class, 'index'])
        ->name('admin.survey-questions.index');
    Route::get('admin/survey-questions/create', [\App\Http\Controllers\SurveyQuestionController::class, 'create'])
        ->name('admin.survey-questions.create');
    Route::post('admin/survey-questions', [\App\Http\Controllers\SurveyQuestionController::class, 'store'])
        ->name('admin.survey-questions.store');
    Route::get('admin/survey-questions/{question}/edit', [\App\Http\Controllers\SurveyQuestionController::class, 'edit'])
        ->name('admin.survey-questions.edit');
    Route::patch('admin/survey-questions/{question}', [\App\Http\Controllers\SurveyQuestionController::class, 'update'])
        ->name('admin.survey-questions.update');
    Route::delete('admin/survey-questions/{question}', [\App\Http\Controllers\SurveyQuestionController::class, 'destroy'])
        ->name('admin.survey-questions.destroy');

    // Survey Analytics
    Route::get('admin/surveys/analytics/teacher/{teacher}', [\App\Http\Controllers\SurveyAnalyticsController::class, 'teacherAnalytics'])
        ->name('admin.surveys.analytics.teacher');
    Route::get('admin/surveys/analytics/discipline/{discipline}', [\App\Http\Controllers\SurveyAnalyticsController::class, 'disciplineAnalytics'])
        ->name('admin.surveys.analytics.discipline');
    Route::get('admin/surveys/analytics/system-report', [\App\Http\Controllers\SurveyAnalyticsController::class, 'systemReport'])
        ->name('admin.surveys.analytics.system-report');

    // API endpoint for survey questions
    Route::get('api/survey-questions/active', [\App\Http\Controllers\SurveyQuestionController::class, 'getActive'])
        ->name('api.survey-questions.active');
});

Route::get('certificate/verify/{certificateNumber}', [CertificateRegistryController::class, 'verify'])
    ->name('certificates.verify');

require __DIR__.'/auth.php';
