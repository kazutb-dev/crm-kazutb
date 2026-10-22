<?php

use App\Services\Hr\HiringPreviewService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('dashboard:refresh-cache')->everySixHours();

Artisan::command('hr:prune-previews', function (HiringPreviewService $previews) {
    $this->info('Deleted HR document previews: ' . $previews->prune());
})->purpose('Delete expired PDF previews of hiring documents (they contain personal data)');

Schedule::command('hr:prune-previews')->hourly();
