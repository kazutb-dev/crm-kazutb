<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KpiResult extends Model
{
    use HasFactory;

    public const RESULT_TYPE_USER = 'user';
    public const RESULT_TYPE_DEPARTMENT = 'department';
    public const RESULT_TYPE_FACULTY = 'faculty';

    public const FORMULA_RPPS_V1 = 'rpps_v1';

    /**
     * @var string
     */
    protected $table = 'kpi_results';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'kpi_period_id',
        'academic_year_id',
        'result_type',
        'entity_type',
        'user_id',
        'faculty_id',
        'department_id',
        'approved_entries_count',
        'section_scores',
        'k1_score',
        'k2_score',
        'k3_score',
        'k4_score',
        'k5_score',
        'k6_score',
        'formula_name',
        'rank_score',
        'metadata',
        'calculated_at',
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
        'approved_entries_count' => 'integer',
        'section_scores' => 'array',
        'k1_score' => 'decimal:2',
        'k2_score' => 'decimal:2',
        'k3_score' => 'decimal:2',
        'k4_score' => 'decimal:2',
        'k5_score' => 'decimal:2',
        'k6_score' => 'decimal:2',
        'rank_score' => 'decimal:2',
        'metadata' => 'array',
        'calculated_at' => 'datetime',
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
}