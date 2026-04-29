<?php

namespace App\Services;

use App\Models\AcademicYear;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Diploma;
use App\Models\Division;
use App\Models\EducationalProgram;
use App\Models\Faculty;
use App\Models\KpiEntry;
use App\Models\KpiIndicator;
use App\Models\KpiPeriod;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class AuditLogService
{
    public function logLogin(User $user, ?Request $request = null): void
    {
        $request ??= request();

        $this->create([
            'user_id' => $user->id,
            'actor_name' => $user->name,
            'actor_email' => $user->email,
            'event_type' => 'login',
            'subject_type' => 'auth',
            'subject_id' => $user->id,
            'subject_label' => $user->name,
            'description' => 'Вход в систему',
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'metadata' => [
                'role' => $user->resolvedRoleSlug(),
            ],
        ]);
    }

    public function logCreated(Model $model, ?User $actor = null, ?Request $request = null): void
    {
        $request ??= request();

        if (!$this->supports($model)) {
            return;
        }

        $actor ??= $request?->user();

        $this->create([
            'user_id' => $actor?->id,
            'actor_name' => $actor?->name ?? 'Гость',
            'actor_email' => $actor?->email,
            'event_type' => 'created',
            'subject_type' => class_basename($model),
            'subject_id' => (int) $model->getKey(),
            'subject_label' => $this->resolveSubjectLabel($model),
            'description' => 'Создана запись: ' . $this->resolveEntityName($model),
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'metadata' => $this->resolveMetadata($model),
        ]);
    }

    public function supports(Model $model): bool
    {
        return in_array($model::class, [
            AcademicYear::class,
            Department::class,
            Diploma::class,
            Division::class,
            EducationalProgram::class,
            Faculty::class,
            KpiEntry::class,
            KpiIndicator::class,
            KpiPeriod::class,
            Ticket::class,
        ], true);
    }

    /**
     * @param array<string, mixed> $attributes
     */
    private function create(array $attributes): void
    {
        if (!Schema::hasTable('audit_logs')) {
            return;
        }

        AuditLog::query()->create($attributes);
    }

    private function resolveEntityName(Model $model): string
    {
        return match ($model::class) {
            AcademicYear::class => 'Учебный год',
            Department::class => 'Кафедра',
            Diploma::class => 'Дипломная работа',
            Division::class => 'Департамент',
            EducationalProgram::class => 'Образовательная программа',
            Faculty::class => 'Факультет',
            KpiEntry::class => 'KPI-запись',
            KpiIndicator::class => 'KPI-индикатор',
            KpiPeriod::class => 'KPI-период',
            Ticket::class => 'Заявка',
            default => class_basename($model),
        };
    }

    private function resolveSubjectLabel(Model $model): string
    {
        return match ($model::class) {
            AcademicYear::class => (string) ($model->name ?? $model->year ?? ('#' . $model->getKey())),
            Department::class => (string) ($model->name ?? ('#' . $model->getKey())),
            Diploma::class => (string) ($model->title_ru ?? $model->title_en ?? ('#' . $model->getKey())),
            Division::class => (string) ($model->name ?? ('#' . $model->getKey())),
            EducationalProgram::class => (string) ($model->name ?? ('#' . $model->getKey())),
            Faculty::class => (string) ($model->name ?? ('#' . $model->getKey())),
            KpiEntry::class => (string) ($model->indicator?->code ?? ('#' . $model->getKey())),
            KpiIndicator::class => trim((string) (($model->code ?? '#') . ' ' . ($model->name ?? $model->getKey()))),
            KpiPeriod::class => (string) ($model->name ?? ('#' . $model->getKey())),
            Ticket::class => 'Заявка #' . $model->getKey(),
            default => '#' . $model->getKey(),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveMetadata(Model $model): array
    {
        if ($model instanceof KpiEntry) {
            $model->loadMissing('indicator:id,code,name');

            return [
                'indicator_code' => $model->indicator?->code,
                'indicator_name' => $model->indicator?->name,
                'status' => $model->status,
                'entity_type' => $model->entity_type,
            ];
        }

        if ($model instanceof Ticket) {
            return [
                'type' => $model->type,
                'status' => $model->status,
            ];
        }

        if ($model instanceof Diploma) {
            return [
                'type' => $model->type,
                'status' => $model->status,
            ];
        }

        return [];
    }
}