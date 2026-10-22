<?php

use App\Http\Controllers\Hr\HiringController;
use App\Http\Controllers\Hr\HiringDocumentController;
use App\Http\Controllers\Hr\HiringFileController;
use App\Http\Controllers\Hr\HiringLookupController;
use App\Http\Controllers\Hr\HiringSettingsController;
use App\Models\HrDocumentTemplate;
use Illuminate\Support\Facades\Route;

// ── «Приём на работу» (HR и учет): role hr and administrators only ────────────────────────────────
// panel.role.access lets the hr role in for hr.hiring.*; can:hr-hiring checks the module access again.
// Scans and the social status need hr-hiring.sensitive, catalog edits hr-hiring.catalog, rights hr-hiring.rights.
Route::middleware(['auth', 'panel.role.access', 'can:hr-hiring', 'track.last-seen'])
    ->prefix('hr/hiring')
    ->name('hr.hiring.')
    ->group(function () {
        $documentTypes = array_keys(HrDocumentTemplate::TYPE_LABELS);

        Route::get('settings', [HiringSettingsController::class, 'index'])->name('settings.index');
        Route::put('settings/employer', [HiringSettingsController::class, 'updateEmployer'])->name('settings.employer');
        Route::post('settings/templates', [HiringSettingsController::class, 'storeTemplate'])->middleware('throttle:20,1')->name('settings.templates.store');
        Route::post('settings/templates/{template}/activate', [HiringSettingsController::class, 'activateTemplate'])->whereNumber('template')->name('settings.templates.activate');
        Route::get('settings/templates/{template}/download', [HiringSettingsController::class, 'downloadTemplate'])->whereNumber('template')->name('settings.templates.download');
        Route::middleware('can:hr-hiring.catalog')->group(function () {
            Route::put('settings/units/{orgUnit}', [HiringSettingsController::class, 'updateUnit'])->whereNumber('orgUnit')->name('settings.units.update');
            Route::put('settings/positions/{position}', [HiringSettingsController::class, 'updatePosition'])->whereNumber('position')->name('settings.positions.update');
            Route::post('settings/positions', [HiringSettingsController::class, 'storePosition'])->name('settings.positions.store');
        });
        Route::middleware('can:hr-hiring.rights')->group(function () {
            Route::get('settings/users', [HiringSettingsController::class, 'users'])->name('settings.users');
            Route::post('settings/rights', [HiringSettingsController::class, 'grant'])->name('settings.rights.grant');
            Route::delete('settings/rights', [HiringSettingsController::class, 'revoke'])->name('settings.rights.revoke');
        });

        Route::get('lookup/units', [HiringLookupController::class, 'units'])->name('lookup.units');
        Route::get('lookup/positions', [HiringLookupController::class, 'positions'])->name('lookup.positions');
        Route::get('lookup/staff', [HiringLookupController::class, 'staff'])->name('lookup.staff');
        Route::post('lookup/inflect', [HiringLookupController::class, 'inflect'])->name('lookup.inflect');
        Route::get('lookup/numbers', [HiringLookupController::class, 'numbers'])->name('lookup.numbers');

        Route::get('/', [HiringController::class, 'index'])->name('index');
        Route::post('/', [HiringController::class, 'store'])->name('store');

        Route::whereNumber('hiring')->group(function () use ($documentTypes) {
            Route::get('{hiring}', [HiringController::class, 'show'])->name('show');
            Route::get('{hiring}/edit', [HiringController::class, 'edit'])->name('edit');
            Route::put('{hiring}', [HiringController::class, 'update'])->name('update');
            Route::delete('{hiring}', [HiringController::class, 'destroy'])->name('destroy');
            Route::post('{hiring}/rehire', [HiringController::class, 'rehire'])->name('rehire');

            Route::post('{hiring}/photo', [HiringFileController::class, 'storePhoto'])->middleware('throttle:30,1')->name('photo.store');
            Route::get('{hiring}/photo', [HiringFileController::class, 'showPhoto'])->name('photo.show');
            Route::delete('{hiring}/photo', [HiringFileController::class, 'destroyPhoto'])->name('photo.destroy');
            Route::post('{hiring}/attachments', [HiringFileController::class, 'storeAttachment'])->middleware('throttle:60,1')->name('attachments.store');

            Route::post('{hiring}/documents/{type}', [HiringDocumentController::class, 'generate'])->whereIn('type', $documentTypes)->name('documents.generate');
            Route::post('{hiring}/previews/{type}', [HiringDocumentController::class, 'storePreview'])->whereIn('type', $documentTypes)->middleware('throttle:60,1')->name('previews.store');

            // Children of the hiring: another hiring's id in the URL gives 404.
            Route::scopeBindings()->group(function () {
                Route::get('{hiring}/attachments/{attachment}', [HiringFileController::class, 'showAttachment'])->whereNumber('attachment')->middleware('can:hr-hiring.sensitive')->name('attachments.show');
                Route::delete('{hiring}/attachments/{attachment}', [HiringFileController::class, 'destroyAttachment'])->whereNumber('attachment')->middleware('can:hr-hiring.sensitive')->name('attachments.destroy');
                Route::get('{hiring}/documents/{document}/download', [HiringDocumentController::class, 'download'])->whereNumber('document')->name('documents.download');
                Route::post('{hiring}/documents/{document}/sign', [HiringDocumentController::class, 'sign'])->whereNumber('document')->name('documents.sign');
                Route::get('{hiring}/documents/{document}/scan', [HiringDocumentController::class, 'scan'])->whereNumber('document')->middleware('can:hr-hiring.sensitive')->name('documents.scan');
                Route::get('{hiring}/previews/{preview}', [HiringDocumentController::class, 'showPreview'])->whereUuid('preview')->name('previews.show');
                Route::get('{hiring}/previews/{preview}/pdf', [HiringDocumentController::class, 'previewPdf'])->whereUuid('preview')->name('previews.pdf');
            });
        });
    });
