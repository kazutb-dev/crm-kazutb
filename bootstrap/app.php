<?php

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('activitylog:clean')->dailyAt('03:15');

        $schedule->call(function (): void {
            \App\Models\UserActivitySnapshot::query()
                ->where('last_seen_at', '<', now()->subDays(30))
                ->delete();
        })->dailyAt('03:30');
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            \App\Http\Middleware\TrustProxies::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->api(prepend: [
            \App\Http\Middleware\TrustProxies::class,
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        ]);

        $middleware->statefulApi();

        $middleware->alias([
            'auth' => \App\Http\Middleware\Authenticate::class,
            'panel.role.access' => \App\Http\Middleware\EnsurePanelRoleAccess::class,
            'calendar.access' => \App\Http\Middleware\EnsureCalendarLeadershipAccess::class,
            'track.last-seen' => \App\Http\Middleware\TrackLastSeen::class,
            'block.in.production' => \App\Http\Middleware\BlockInProduction::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }
        });
    })->create();
