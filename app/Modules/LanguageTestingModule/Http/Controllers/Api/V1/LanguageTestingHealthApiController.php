<?php

namespace App\Modules\LanguageTestingModule\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\LanguageTestingModule\Http\Controllers\Api\V1\Concerns\InteractsWithLanguageTestingApi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class LanguageTestingHealthApiController extends Controller
{
    use InteractsWithLanguageTestingApi;

    public function show(Request $request): JsonResponse
    {
        $integrationApiKeyConfigured = trim((string) config('language_testing_module.integration.api_key', '')) !== ''
            || trim((string) config('language_testing.api_key', '')) !== '';
        $integrationBearerConfigured = trim((string) config('language_testing_module.integration.bearer_token', '')) !== '';

        $database = 'down';
        try {
            DB::connection()->select('select 1');
            $database = 'up';
        } catch (Throwable) {
            $database = 'down';
        }

        $storage = 'down';
        try {
            $storage = Storage::disk(config('filesystems.default'))->exists('') ? 'up' : 'up';
        } catch (Throwable) {
            $storage = 'down';
        }

        $queue = config('queue.default') ? 'configured' : 'not_configured';
        $module = class_exists(\App\Modules\LanguageTestingModule\Providers\LanguageTestingServiceProvider::class) ? 'enabled' : 'disabled';
        $configuration = ($integrationApiKeyConfigured || $integrationBearerConfigured) ? 'configured' : 'missing_credentials';

        return $this->success([
            'data' => [
                'status' => $database === 'up' && $storage === 'up' && $configuration === 'configured' ? 'ok' : 'degraded',
                'api_version' => '1.0.0',
                'database' => $database,
                'queue' => $queue,
                'storage' => $storage,
                'configuration' => $configuration,
                'language_testing_module' => $module,
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }
}
