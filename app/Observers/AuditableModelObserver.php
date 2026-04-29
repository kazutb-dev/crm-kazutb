<?php

namespace App\Observers;

use App\Services\AuditLogService;
use Illuminate\Database\Eloquent\Model;

class AuditableModelObserver
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    public function created(Model $model): void
    {
        if (!app()->bound('request')) {
            return;
        }

        $this->auditLogService->logCreated($model);
    }
}