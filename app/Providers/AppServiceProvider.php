<?php

namespace App\Providers;

use App\Listeners\LogSuccessfulLogin;
use App\Models\AcademicYear;
use App\Models\Department;
use App\Models\Diploma;
use App\Models\Division;
use App\Models\EducationalProgram;
use App\Models\Faculty;
use App\Models\KpiEntry;
use App\Models\KpiIndicator;
use App\Models\KpiPeriod;
use App\Models\Ticket;
use App\Observers\AuditableModelObserver;
use App\Policies\KpiEntryPolicy;
use App\Policies\KpiPeriodPolicy;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(KpiPeriod::class, KpiPeriodPolicy::class);
        Gate::policy(KpiEntry::class, KpiEntryPolicy::class);

        Event::listen(Login::class, LogSuccessfulLogin::class);

        AcademicYear::observe(AuditableModelObserver::class);
        Department::observe(AuditableModelObserver::class);
        Diploma::observe(AuditableModelObserver::class);
        Division::observe(AuditableModelObserver::class);
        EducationalProgram::observe(AuditableModelObserver::class);
        Faculty::observe(AuditableModelObserver::class);
        KpiEntry::observe(AuditableModelObserver::class);
        KpiIndicator::observe(AuditableModelObserver::class);
        KpiPeriod::observe(AuditableModelObserver::class);
        Ticket::observe(AuditableModelObserver::class);

        Vite::prefetch(concurrency: 3);
    }
}
