<?php

use App\Modules\LanguageTestingModule\Http\Controllers\Web\LanguageTestingQuestionController;
use App\Modules\LanguageTestingModule\Http\Controllers\Web\LanguageTestingStatisticsController;
use App\Modules\LanguageTestingModule\Http\Controllers\Web\LanguageTestingTestController;
use App\Modules\LanguageTestingModule\Http\Middleware\EnsureLanguageTestingCrmAccess;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth', 'track.last-seen', EnsureLanguageTestingCrmAccess::class])
    ->prefix('language-testing')
    ->name('language-testing.')
    ->group(function (): void {
        Route::get('tests', [LanguageTestingTestController::class, 'index'])->name('tests.index');
        Route::post('tests', [LanguageTestingTestController::class, 'store'])->name('tests.store');
        Route::patch('tests/{languageTestingTest}', [LanguageTestingTestController::class, 'update'])->name('tests.update');
        Route::delete('tests/{languageTestingTest}', [LanguageTestingTestController::class, 'destroy'])->name('tests.destroy');

        Route::get('tests/{languageTestingTest}/questions', [LanguageTestingQuestionController::class, 'index'])->name('questions.index');
        Route::post('tests/{languageTestingTest}/questions', [LanguageTestingQuestionController::class, 'store'])->name('questions.store');
        Route::patch('questions/{languageTestingQuestion}', [LanguageTestingQuestionController::class, 'update'])->name('questions.update');
        Route::delete('questions/{languageTestingQuestion}', [LanguageTestingQuestionController::class, 'destroy'])->name('questions.destroy');
        Route::patch('tests/{languageTestingTest}/questions/reorder', [LanguageTestingQuestionController::class, 'reorder'])->name('questions.reorder');

        Route::get('statistics', [LanguageTestingStatisticsController::class, 'index'])->name('statistics.index');
        Route::get('statistics/export/csv', [LanguageTestingStatisticsController::class, 'exportCsv'])->name('statistics.export.csv');
        Route::get('statistics/export/excel', [LanguageTestingStatisticsController::class, 'exportExcel'])->name('statistics.export.excel');
    });