<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Delegation extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_REVOKED = 'revoked';
    public const STATUS_SUPERSEDED = 'superseded';

    public const DELEGATION_TYPE_ACTING_DEAN = 'acting_dean';
    public const DELEGATION_TYPE_ACTING_HOD = 'acting_hod';
    public const DELEGATION_TYPE_DELEGATED_REVIEWER = 'delegated_reviewer';
    public const DELEGATION_TYPE_COVERAGE = 'coverage';
    public const DELEGATION_TYPE_CUSTOM = 'custom';

    public const DELEGATION_TYPE_LABELS = [
        self::DELEGATION_TYPE_ACTING_DEAN => 'Acting dean',
        self::DELEGATION_TYPE_ACTING_HOD => 'Acting head of department',
        self::DELEGATION_TYPE_DELEGATED_REVIEWER => 'Delegated reviewer',
        self::DELEGATION_TYPE_COVERAGE => 'Temporary coverage',
        self::DELEGATION_TYPE_CUSTOM => 'Custom delegation',
    ];

    protected $fillable = [
        'grantor_user_id',
        'delegate_user_id',
        'delegation_type',
        'capability',
        'module',
        'scope_type',
        'scope_source_type',
        'scope_source_id',
        'org_unit_id',
        'starts_at',
        'ends_at',
        'status',
        'approved_by',
        'reason',
        'metadata',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'scope_source_id' => 'integer',
            'org_unit_id' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'revoked_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function grantor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'grantor_user_id');
    }

    public function delegate(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delegate_user_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function orgUnit(): BelongsTo
    {
        return $this->belongsTo(OrgUnit::class, 'org_unit_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        $now = now();

        return $query
            ->where('status', self::STATUS_ACTIVE)
            ->where(function (Builder $window): void {
                $window->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function (Builder $window) use ($now): void {
                $window->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->whereNull('revoked_at');
    }

    public function isActiveNow(): bool
    {
        return $this->status === self::STATUS_ACTIVE
            && $this->revoked_at === null
            && ($this->starts_at === null || $this->starts_at <= now())
            && ($this->ends_at === null || $this->ends_at >= now());
    }

    public function delegationTypeLabel(): string
    {
        return self::DELEGATION_TYPE_LABELS[$this->delegation_type] ?? $this->delegation_type;
    }
}
