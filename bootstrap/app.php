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
            'testing.access' => \App\Http\Middleware\EnsureTestingAccess::class,
            'calendar.access' => \App\Http\Middleware\EnsureCalendarLeadershipAccess::class,
            'track.last-seen' => \App\Http\Middleware\TrackLastSeen::class,
            'block.in.production' => \App\Http\Middleware\BlockInProduction::class,
            'testing.api.key' => \App\Http\Middleware\VerifyTestingApiKey::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $formatLanguageTestingApiError = static function (\Illuminate\Http\Request $request, string $message, int $status, array $errors = []) {
            if (! $request->is('api/v1/*')) {
                return null;
            }

            $payload = ['message' => $message];

            if ($errors !== []) {
                $payload['errors'] = $errors;
            }

            $requestId = $request->attributes->get('language_testing_request_id');
            if (is_string($requestId) && $requestId !== '') {
                $payload['request_id'] = $requestId;
            }

            return response()->json($payload, $status);
        };

        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                if ($request->is('api/v1/*')) {
                    return response()->json([
                        'message' => 'Unauthorized.',
                        'request_id' => $request->attributes->get('language_testing_request_id'),
                    ], 401);
                }

                return response()->json(['message' => 'Unauthorized'], 401);
            }
        });

        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, \Illuminate\Http\Request $request) use ($formatLanguageTestingApiError) {
            return $formatLanguageTestingApiError(
                $request,
                'The given data was invalid.',
                422,
                $e->errors(),
            );
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException $e, \Illuminate\Http\Request $request) use ($formatLanguageTestingApiError) {
            return $formatLanguageTestingApiError(
                $request,
                'Too many requests.',
                429,
            );
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e, \Illuminate\Http\Request $request) use ($formatLanguageTestingApiError) {
            $status = $e->getStatusCode();

            return $formatLanguageTestingApiError(
                $request,
                $e->getMessage() !== '' ? $e->getMessage() : match ($status) {
                    403 => 'Forbidden.',
                    404 => 'Not found.',
                    503 => 'Service unavailable.',
                    default => 'Request failed.',
                },
                $status,
            );
        });

        $exceptions->render(function (\Throwable $e, \Illuminate\Http\Request $request) use ($formatLanguageTestingApiError) {
            if (! $request->is('api/v1/*')) {
                return null;
            }

            return $formatLanguageTestingApiError($request, 'Internal server error.', 500);
        });
    })->create();
