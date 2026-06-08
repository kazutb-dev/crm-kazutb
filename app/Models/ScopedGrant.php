<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScopedGrant extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_REVOKED = 'revoked';
    public const STATUS_SUPERSEDED = 'superseded';

    public const GRANT_TYPE_REVIEWER = 'reviewer';
    public const GRANT_TYPE_APPROVER = 'approver';
    public const GRANT_TYPE_STRUCTURAL_REVIEWER = 'structural_reviewer';
    public const GRANT_TYPE_HR = 'hr';
    public const GRANT_TYPE_REGISTRAR = 'registrar';
    public const GRANT_TYPE_CURATOR = 'curator';
    public const GRANT_TYPE_ACADEMIC_ADMIN = 'academic_admin';
    public const GRANT_TYPE_ACTING = 'acting';
    public const GRANT_TYPE_CUSTOM = 'custom';

    public const GRANT_TYPE_LABELS = [
        self::GRANT_TYPE_REVIEWER => 'Reviewer scope',
        self::GRANT_TYPE_APPROVER => 'Approver scope',
        self::GRANT_TYPE_STRUCTURAL_REVIEWER => 'Structural reviewer',
        self::GRANT_TYPE_HR => 'HR authority',
        self::GRANT_TYPE_REGISTRAR => 'Registrar authority',
        self::GRANT_TYPE_CURATOR => 'Curator authority',
        self::GRANT_TYPE_ACADEMIC_ADMIN => 'Academic admin authority',
        self::GRANT_TYPE_ACTING => 'Acting authority',
        self::GRANT_TYPE_CUSTOM => 'Custom scope',
    ];

    protected $fillable = [
        'subject_user_id',
        'grant_type',
        'capability',
        'module',
        'scope_type',
        'scope_source_type',
        'scope_source_id',
        'org_unit_id',
        'starts_at',
        'ends_at',
        'status',
        'granted_by',
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

    public function subjectUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subject_user_id');
    }

    public function grantedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by');
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

    public function grantTypeLabel(): string
    {
        return self::GRANT_TYPE_LABELS[$this->grant_type] ?? $this->grant_type;
    }
}
