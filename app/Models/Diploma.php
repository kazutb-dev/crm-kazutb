<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Diploma extends Model
{
    use HasFactory;

    public const TYPE_DIPLOMA = 'diploma';
    public const TYPE_THESIS = 'thesis';
    public const TYPE_PROJECT = 'project';

    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_IN_REVIEW = 'in_review';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_ARCHIVED = 'archived';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'year',
        'semester',
        'faculty_id',
        'department_id',
        'program_id',
        'student_id',
        'external_student_code',
        'supervisor_id',
        'title_ru',
        'title_kz',
        'title_en',
        'abstract',
        'keywords',
        'normalized_title',
        'type',
        'status',
        'file_path',
        'is_reference',
    ];

    protected $casts = [
        'keywords' => 'array',
        'is_reference' => 'boolean',
        'year' => 'integer',
    ];

    public static function types(): array
    {
        return [
            self::TYPE_DIPLOMA,
            self::TYPE_THESIS,
            self::TYPE_PROJECT,
        ];
    }

    public static function statuses(): array
    {
        return [
            self::STATUS_DRAFT,
            self::STATUS_SUBMITTED,
            self::STATUS_IN_REVIEW,
            self::STATUS_APPROVED,
            self::STATUS_REJECTED,
            self::STATUS_ARCHIVED,
        ];
    }

    public function faculty(): BelongsTo
    {
        return $this->belongsTo(Faculty::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(EducationalProgram::class, 'program_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function topicChecks(): HasMany
    {
        return $this->hasMany(TopicCheck::class);
    }
}
