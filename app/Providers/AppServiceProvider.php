<?php

namespace App\Providers;

use App\Contracts\AcademicContextProvider;
use App\Listeners\LogSuccessfulLogin;
use App\Models\AcademicYear;
use App\Models\Announcement;
use App\Models\Department;
use App\Models\Diploma;
use App\Models\Division;
use App\Models\EducationalProgram;
use App\Models\Faculty;
use App\Models\KpiEntry;
use App\Models\KpiIndicator;
use App\Models\KpiPeriod;
use App\Models\Ticket;
use App\Models\User;
use App\Observers\AuditableModelObserver;
use App\Policies\AnnouncementPolicy;
use App\Policies\KpiEntryPolicy;
use App\Policies\KpiPeriodPolicy;
use App\Services\AcademicScopeResolverService;
use App\Services\KpiEntryService;
use Illuminate\Auth\Events\Login;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\Str;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(\App\Services\KpiEntryService::class, function ($app) {
            return new KpiEntryService(
                $app->make(\App\Services\KpiCalculationService::class)
            );
        });

        $this->app->singleton(AcademicContextProvider::class, AcademicScopeResolverService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->guardDestructiveConsoleCommands();
        $this->configureRateLimiting();

        Gate::policy(Announcement::class, AnnouncementPolicy::class);
        Gate::policy(KpiPeriod::class, KpiPeriodPolicy::class);
        Gate::policy(KpiEntry::class, KpiEntryPolicy::class);

        Gate::define('viewPulse', function (User $user): bool {
            return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin'], true);
        });

        Gate::define('viewTelescope', function (User $user): bool {
            return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin'], true);
        });

        Gate::define('viewApiDocs', function (User $user): bool {
            return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin'], true);
        });

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

    private function configureRateLimiting(): void
    {
        RateLimiter::for('login', function (Request $request): array {
            $identifier = Str::lower(trim((string) ($request->input('email') ?? $request->input('login') ?? '')));
            $routeScope = $request->is('api/admin/login') ? 'admin-login' : 'api-login';
            $clientIp = (string) $request->ip();

            return [
                Limit::perMinute(5)->by($routeScope . '|credential|' . ($identifier !== '' ? $identifier : 'blank') . '|' . $clientIp),
                Limit::perMinute(20)->by($routeScope . '|ip|' . $clientIp),
            ];
        });
    }

    /**
     * Block destructive Artisan commands in production/prod-like environments.
     */
    private function guardDestructiveConsoleCommands(): void
    {
        if (! app()->runningInConsole()) {
            return;
        }

        $command = $_SERVER['argv'][1] ?? null;
        if (! is_string($command)) {
            return;
        }

        $blocked = [
            'test',
            'migrate:fresh',
            'migrate:refresh',
            'db:wipe',
        ];

        if (! in_array($command, $blocked, true)) {
            return;
        }

        $appUrlHost = parse_url((string) config('app.url'), PHP_URL_HOST);
        $isProductionLike = app()->environment('production')
            || app()->environment('prod')
                || $appUrlHost === 'dev-crm.kaztbu.edu.kz';

        if (! $isProductionLike) {
            return;
        }

        throw new \RuntimeException(sprintf(
            'Safety guardrail: command "%s" is blocked in production/prod-like environment.',
            $command
        ));
    }
}
