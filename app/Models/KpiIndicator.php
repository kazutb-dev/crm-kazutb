<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KpiIndicator extends Model
{
    use HasFactory;

    public const ENTITY_TYPE_TEACHER = 'teacher';
    public const ENTITY_TYPE_DEPARTMENT_HEAD = 'department_head';
    public const ENTITY_TYPE_DEAN = 'dean';
    public const ENTITY_TYPE_STRUCTURAL_DIVISION = 'structural_division';

    public const SECTION_TEACHING = 'teaching';
    public const SECTION_SCIENCE = 'science';
    public const SECTION_SOCIAL = 'social';
    public const SECTION_QUALIFICATION = 'qualification';
    public const SECTION_SURVEY = 'survey';

    public const CALCULATION_TYPE_MANUAL = 'manual';
    public const CALCULATION_TYPE_AUTO = 'auto';
    public const CALCULATION_TYPE_FORMULA = 'formula';

    /**
     * @var string
     */
    protected $table = 'kpi_indicators';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'entity_type',
        'section',
        'code',
        'name',
        'description',
        'unit',
        'base_points',
        'calculation_type',
        'requires_file',
        'is_active',
        'sort_order',
        'checker_division_id',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'base_points' => 'decimal:2',
        'requires_file' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeForEntityType(Builder $query, string $entityType): Builder
    {
        return $query->where('entity_type', $entityType);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query
            ->orderBy('section')
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function requiresFile(): bool
    {
        return (bool) $this->requires_file;
    }

    public function isSurveySection(): bool
    {
        return $this->section === self::SECTION_SURVEY;
    }

    public function checkerDivision()
    {
        return $this->belongsTo(\App\Models\Division::class, 'checker_division_id');
    }
}
