<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrgUnitMapping extends Model
{
    use HasFactory;

    public const SOURCE_FACULTY = 'faculty';
    public const SOURCE_DEPARTMENT = 'department';
    public const SOURCE_DIVISION = 'division';
    public const SOURCE_KPI_STRUCTURAL_UNIT = 'kpi_structural_unit';

    public const KIND_EXACT = 'exact';
    public const KIND_TRANSITIONAL = 'transitional';
    public const KIND_APPROXIMATE = 'approximate';
    public const KIND_UNMAPPED = 'unmapped';

    public const SOURCE_LABELS = [
        self::SOURCE_FACULTY => 'Факультет',
        self::SOURCE_DEPARTMENT => 'Кафедра',
        self::SOURCE_DIVISION => 'Департамент / подразделение (legacy division)',
        self::SOURCE_KPI_STRUCTURAL_UNIT => 'KPI структурная единица',
    ];

    public const KIND_LABELS = [
        self::KIND_EXACT => 'Точное сопоставление',
        self::KIND_TRANSITIONAL => 'Переходное сопоставление',
        self::KIND_APPROXIMATE => 'Приблизительное сопоставление',
        self::KIND_UNMAPPED => 'Без сопоставления',
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'source_type',
        'source_id',
        'source_code',
        'source_name',
        'org_unit_id',
        'mapping_kind',
        'confidence',
        'is_active',
        'notes',
        'metadata',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'confidence' => 'integer',
        'is_active' => 'boolean',
        'metadata' => 'array',
    ];

    public function orgUnit(): BelongsTo
    {
        return $this->belongsTo(OrgUnit::class, 'org_unit_id');
    }

    public function sourceLabel(): string
    {
        return self::SOURCE_LABELS[$this->source_type] ?? $this->source_type;
    }

    public function kindLabel(): string
    {
        return self::KIND_LABELS[$this->mapping_kind] ?? $this->mapping_kind;
    }
}
