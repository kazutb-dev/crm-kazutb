<?php

namespace App\Listeners;

use App\Services\AuditLogService;
use Illuminate\Auth\Events\Login;

class LogSuccessfulLogin
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    public function handle(Login $event): void
    {
        $this->auditLogService->logLogin($event->user, request());
    }
}