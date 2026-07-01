<?php

use App\Modules\LanguageTestingModule\Http\Controllers\Api\V1\LanguageTestingApiController;
use App\Modules\LanguageTestingModule\Http\Controllers\Api\V1\LanguageTestingStatisticsApiController;
use App\Modules\LanguageTestingModule\Http\Middleware\EnsureLanguageTestingApiConsumer;
use App\Modules\LanguageTestingModule\Http\Middleware\LogLanguageTestingApiRequests;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1')
    ->middleware(['api', LogLanguageTestingApiRequests::class, EnsureLanguageTestingApiConsumer::class])
    ->group(function (): void {
        Route::get('tests', [LanguageTestingApiController::class, 'index']);
        Route::get('tests/{languageTestingTest}', [LanguageTestingApiController::class, 'show']);

        Route::get('tests/{languageTestingTest}/start', [LanguageTestingApiController::class, 'start']);
        Route::post('tests/{languageTestingTest}/submit', [LanguageTestingApiController::class, 'submit']);

        Route::middleware('auth:sanctum')->group(function (): void {
            Route::post('tests', [LanguageTestingApiController::class, 'store']);
            Route::put('tests/{languageTestingTest}', [LanguageTestingApiController::class, 'update']);
            Route::delete('tests/{languageTestingTest}', [LanguageTestingApiController::class, 'destroy']);

            Route::get('tests/{languageTestingTest}/questions', [LanguageTestingApiController::class, 'questions']);
            Route::post('tests/{languageTestingTest}/questions', [LanguageTestingApiController::class, 'storeQuestion']);
            Route::put('questions/{languageTestingQuestion}', [LanguageTestingApiController::class, 'updateQuestion']);
            Route::delete('questions/{languageTestingQuestion}', [LanguageTestingApiController::class, 'destroyQuestion']);

            Route::get('statistics', [LanguageTestingStatisticsApiController::class, 'index']);
            Route::get('statistics/{languageTestingResult}', [LanguageTestingStatisticsApiController::class, 'show']);
            Route::get('statistics/export/excel', [LanguageTestingStatisticsApiController::class, 'exportExcel']);
            Route::get('statistics/export/csv', [LanguageTestingStatisticsApiController::class, 'exportCsv']);
        });
    });