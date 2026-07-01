<?php

namespace App\Modules\LanguageTestingModule\Providers;

use App\Modules\LanguageTestingModule\Models\LanguageTestingQuestion;
use App\Modules\LanguageTestingModule\Models\LanguageTestingResult;
use App\Modules\LanguageTestingModule\Models\LanguageTestingTest;
use App\Modules\LanguageTestingModule\Policies\LanguageTestingPolicy;
use App\Modules\LanguageTestingModule\Repositories\LanguageTestingRepository;
use App\Modules\LanguageTestingModule\Services\LanguageTestingExportService;
use App\Modules\LanguageTestingModule\Services\LanguageTestingService;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class LanguageTestingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(LanguageTestingRepository::class);
        $this->app->singleton(LanguageTestingService::class);
        $this->app->singleton(LanguageTestingExportService::class);
    }

    public function boot(): void
    {
        Gate::policy(LanguageTestingTest::class, LanguageTestingPolicy::class);
        Gate::policy(LanguageTestingQuestion::class, LanguageTestingPolicy::class);
        Gate::policy(LanguageTestingResult::class, LanguageTestingPolicy::class);

        $this->loadRoutesFrom(__DIR__ . '/../routes/web.php');
        $this->loadRoutesFrom(__DIR__ . '/../routes/api.php');
    }
}