<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrgUnit extends Model
{
    use HasFactory;

    public const TYPE_UNIVERSITY = 'university';
    public const TYPE_GOVERNANCE = 'governance';
    public const TYPE_RECTORATE = 'rectorate';
    public const TYPE_VICE_RECTORATE = 'vice_rectorate';
    public const TYPE_DEPARTMENT = 'department';
    public const TYPE_DIVISION = 'division';
    public const TYPE_ADMINISTRATION = 'administration';
    public const TYPE_OFFICE = 'office';
    public const TYPE_CENTER = 'center';
    public const TYPE_COMMITTEE = 'committee';
    public const TYPE_FACULTY = 'faculty';
    public const TYPE_ACADEMIC_CHAIR = 'academic_chair';
    public const TYPE_LABORATORY = 'laboratory';
    public const TYPE_LIBRARY = 'library';
    public const TYPE_ENDOWMENT = 'endowment';
    public const TYPE_PROJECT_OFFICE = 'project_office';
    public const TYPE_COLLEGE = 'college';
    public const TYPE_MILITARY = 'military_department';
    public const TYPE_SERVICE = 'service';
    public const TYPE_OTHER = 'other';

    public const TYPE_LABELS = [
        self::TYPE_UNIVERSITY => 'Университет',
        self::TYPE_GOVERNANCE => 'Орган управления',
        self::TYPE_RECTORATE => 'Ректорат / ветка проректора',
        self::TYPE_VICE_RECTORATE => 'Проректорский блок',
        self::TYPE_DEPARTMENT => 'Департамент',
        self::TYPE_DIVISION => 'Подразделение',
        self::TYPE_ADMINISTRATION => 'Управление / администрация',
        self::TYPE_OFFICE => 'Отдел / офис',
        self::TYPE_CENTER => 'Центр',
        self::TYPE_COMMITTEE => 'Комитет',
        self::TYPE_FACULTY => 'Факультет',
        self::TYPE_ACADEMIC_CHAIR => 'Кафедра',
        self::TYPE_LABORATORY => 'Лаборатория',
        self::TYPE_LIBRARY => 'Библиотека',
        self::TYPE_ENDOWMENT => 'Эндаумент',
        self::TYPE_PROJECT_OFFICE => 'Проектный офис',
        self::TYPE_COLLEGE => 'Колледж',
        self::TYPE_MILITARY => 'Военная кафедра',
        self::TYPE_SERVICE => 'Служба',
        self::TYPE_OTHER => 'Иное',
    ];

    public const TARGET_CATALOG_TYPES = [
        self::TYPE_UNIVERSITY,
        self::TYPE_FACULTY,
        self::TYPE_DEPARTMENT,
        self::TYPE_DIVISION,
        self::TYPE_VICE_RECTORATE,
        self::TYPE_CENTER,
        self::TYPE_OFFICE,
        self::TYPE_COLLEGE,
        self::TYPE_MILITARY,
        self::TYPE_RECTORATE,
        self::TYPE_COMMITTEE,
        self::TYPE_LABORATORY,
        self::TYPE_LIBRARY,
        self::TYPE_ENDOWMENT,
        self::TYPE_PROJECT_OFFICE,
        self::TYPE_OTHER,
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'code',
        'name',
        'unit_type',
        'parent_id',
        'leader_name',
        'leader_title',
        'sort_order',
        'is_active',
        'source',
        'metadata',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'metadata' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }

    public function unitTypeLabel(): string
    {
        return self::TYPE_LABELS[$this->unit_type] ?? self::TYPE_LABELS[self::TYPE_OTHER];
    }
}
