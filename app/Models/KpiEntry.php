<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class KpiEntry extends Model
{
    use HasFactory;
    use SoftDeletes;

    public const ENTITY_TYPE_TEACHER = 'teacher';
    public const ENTITY_TYPE_DEPARTMENT_HEAD = 'department_head';
    public const ENTITY_TYPE_DEAN = 'dean';
    public const ENTITY_TYPE_STRUCTURAL_DIVISION = 'structural_division';

    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_RETURNED = 'returned';
    public const STATUS_REVIEWED = 'reviewed';
    // Approval chain: dept head → dean → structural division
    public const STATUS_PENDING_DEAN = 'pending_dean';
    public const STATUS_PENDING_STRUCTURAL = 'pending_structural';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_LOCKED = 'locked';

    /**
     * @var string
     */
    protected $table = 'kpi_entries';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'kpi_period_id',
        'academic_year_id',
        'entity_type',
        'user_id',
        'faculty_id',
        'department_id',
        'indicator_id',
        'plan_value',
        'fact_value',
        'calculated_points',
        'manual_points',
        'calculation_details',
        'comment',
        'external_source_url',
        'status',
        'submitted_at',
        'reviewed_at',
        'approved_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'kpi_period_id' => 'integer',
        'academic_year_id' => 'integer',
        'user_id' => 'integer',
        'faculty_id' => 'integer',
        'department_id' => 'integer',
        'indicator_id' => 'integer',
        'plan_value' => 'decimal:2',
        'fact_value' => 'decimal:2',
        'calculated_points' => 'decimal:2',
        'manual_points' => 'decimal:2',
        'calculation_details' => 'array',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    /**
     * @var list<string>
     */
    protected $appends = [
        'points_for_display',
    ];

    public function period(): BelongsTo
    {
        return $this->belongsTo(KpiPeriod::class, 'kpi_period_id');
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class, 'academic_year_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function faculty(): BelongsTo
    {
        return $this->belongsTo(Faculty::class, 'faculty_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function indicator(): BelongsTo
    {
        return $this->belongsTo(KpiIndicator::class, 'indicator_id');
    }


    public function files(): HasMany
    {
        return $this->hasMany(KpiEntryFile::class, 'kpi_entry_id');
    }

    /**
     * Связь: подтверждения СП для этой записи KPI
     */
    public function structuralConfirmations(): HasMany
    {
        return $this->hasMany(KpiStructuralConfirmation::class, 'kpi_record_id');
    }

    public function statusLogs(): HasMany
    {
        return $this->hasMany(KpiStatusLog::class, 'kpi_entry_id');
    }

    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    public function scopeForEntityType(Builder $query, string $entityType): Builder
    {
        return $query->where('entity_type', $entityType);
    }

    public function scopeForPeriod(Builder $query, int $periodId): Builder
    {
        return $query->where('kpi_period_id', $periodId);
    }

    public function scopeApproved(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_APPROVED);
    }

    public function scopeSubmitted(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_SUBMITTED);
    }

    public function canBeEdited(): bool
    {
        return !in_array($this->status, [
            self::STATUS_APPROVED,
            self::STATUS_LOCKED,
            self::STATUS_PENDING_DEAN,
            self::STATUS_PENDING_STRUCTURAL,
        ], true);
    }

    public function canBeSubmitted(): bool
    {
        if ($this->isLocked() || in_array($this->status, [self::STATUS_PENDING_DEAN, self::STATUS_PENDING_STRUCTURAL], true)) {
            return false;
        }

        return in_array($this->status, [self::STATUS_DRAFT, self::STATUS_RETURNED, self::STATUS_REJECTED], true);
    }

    public function canBeApproved(): bool
    {
        if ($this->isLocked()) {
            return false;
        }

        return in_array($this->status, [
            self::STATUS_SUBMITTED,
            self::STATUS_REVIEWED,
            self::STATUS_PENDING_DEAN,
            self::STATUS_PENDING_STRUCTURAL,
        ], true);
    }

    public function isLocked(): bool
    {
        return $this->status === self::STATUS_LOCKED;
    }

    public function getPointsForDisplayAttribute(): string
    {
        $details = is_array($this->calculation_details) ? $this->calculation_details : [];
        $ruleKind = trim((string) ($details['rule_kind'] ?? ''));

        if ($this->manual_points !== null && $ruleKind !== '') {
            return number_format((float) $this->manual_points, 2, '.', '');
        }

        if ($this->calculated_points !== null && (float) $this->calculated_points !== 0.0) {
            return number_format((float) $this->calculated_points, 2, '.', '');
        }

        $value = $this->fact_value ?? $this->plan_value;
        $basePoints = null;
        if ($this->relationLoaded('indicator')) {
            $basePoints = (float) ($this->indicator?->base_points ?? 0);
        } else {
            $basePoints = (float) ($this->indicator()->value('base_points') ?? 0);
        }

        if ($value !== null) {
            return number_format($basePoints * (float) $value, 2, '.', '');
        }

        if ($this->manual_points !== null) {
            return number_format((float) $this->manual_points, 2, '.', '');
        }

        if ($this->calculated_points !== null) {
            return number_format((float) $this->calculated_points, 2, '.', '');
        }

        return '0.00';
    }
}
