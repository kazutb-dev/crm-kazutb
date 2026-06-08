<?php

namespace App\Models;

use Carbon\CarbonInterface;
use DateTimeInterface;
use Illuminate\Support\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use InvalidArgumentException;

class KpiPeriod extends Model
{
    use HasFactory;
    use SoftDeletes;

    public const STAGE_PLAN = 'plan';
    public const STAGE_FACT = 'fact';
    public const STAGE_REVIEW = 'review';

    public const STATUS_DRAFT = 'draft';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_CLOSED = 'closed';

    public const ACCESS_SCOPE_TEACHER = 'teacher';
    public const ACCESS_SCOPE_HOD = 'hod';
    public const ACCESS_SCOPE_DEAN = 'dean';
    public const ACCESS_SCOPE_STRUCTURAL = 'structural';

    public const ACCESS_SCOPES = [
        self::ACCESS_SCOPE_TEACHER,
        self::ACCESS_SCOPE_HOD,
        self::ACCESS_SCOPE_DEAN,
        self::ACCESS_SCOPE_STRUCTURAL,
    ];

    /**
     * @var string
     */
    protected $table = 'kpi_periods';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'academic_year_id',
        'name',
        'stage',
        'start_date',
        'end_date',
        'status',
        'is_teacher_active',
        'is_hod_active',
        'is_dean_active',
        'is_structural_active',
        'description',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'academic_year_id' => 'integer',
        'start_date' => 'date',
        'end_date' => 'date',
        'stage' => 'string',
        'status' => 'string',
        'is_teacher_active' => 'boolean',
        'is_hod_active' => 'boolean',
        'is_dean_active' => 'boolean',
        'is_structural_active' => 'boolean',
        'created_by' => 'integer',
        'updated_by' => 'integer',
    ];

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class, 'academic_year_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeByStage(Builder $query, string $stage): Builder
    {
        return $query->where('stage', $stage);
    }

    public function scopeByAcademicYear(Builder $query, int $academicYearId): Builder
    {
        return $query->where('academic_year_id', $academicYearId);
    }

    public function isCurrentlyOpen(): bool
    {
        if ($this->status !== self::STATUS_ACTIVE) {
            return false;
        }

        return $this->containsDate(now());
    }

    public function containsDate(DateTimeInterface|string $date): bool
    {
        $targetDate = $date instanceof DateTimeInterface
            ? Carbon::instance($date)->startOfDay()
            : Carbon::parse($date)->startOfDay();

        if (!$this->start_date instanceof CarbonInterface || !$this->end_date instanceof CarbonInterface) {
            throw new InvalidArgumentException('KPI period dates are not initialized correctly.');
        }

        return $targetDate->between(
            $this->start_date->copy()->startOfDay(),
            $this->end_date->copy()->endOfDay(),
            true,
        );
    }

    public static function scopeFromRoleSlug(string $roleSlug): ?string
    {
        return match ($roleSlug) {
            'teacher' => self::ACCESS_SCOPE_TEACHER,
            'department_head', 'hod' => self::ACCESS_SCOPE_HOD,
            'dean' => self::ACCESS_SCOPE_DEAN,
            'department', 'structural' => self::ACCESS_SCOPE_STRUCTURAL,
            default => null,
        };
    }

    public static function scopeFromEntityType(string $entityType): ?string
    {
        return match ($entityType) {
            KpiEntry::ENTITY_TYPE_TEACHER => self::ACCESS_SCOPE_TEACHER,
            KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD => self::ACCESS_SCOPE_HOD,
            KpiEntry::ENTITY_TYPE_DEAN => self::ACCESS_SCOPE_DEAN,
            KpiEntry::ENTITY_TYPE_STRUCTURAL_DIVISION => self::ACCESS_SCOPE_STRUCTURAL,
            default => null,
        };
    }

    public function isScopeActive(string $scope): bool
    {
        return match ($scope) {
            self::ACCESS_SCOPE_TEACHER => (bool) $this->is_teacher_active,
            self::ACCESS_SCOPE_HOD => (bool) $this->is_hod_active,
            self::ACCESS_SCOPE_DEAN => (bool) $this->is_dean_active,
            self::ACCESS_SCOPE_STRUCTURAL => (bool) $this->is_structural_active,
            default => false,
        };
    }

    public function isAnyScopeActive(): bool
    {
        return (bool) $this->is_teacher_active
            || (bool) $this->is_hod_active
            || (bool) $this->is_dean_active
            || (bool) $this->is_structural_active;
    }
}
