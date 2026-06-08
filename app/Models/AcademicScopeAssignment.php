<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademicScopeAssignment extends Model
{
    public const TYPE_STUDENT = 'student';
    public const TYPE_CURATOR = 'curator';
    public const TYPE_REGISTRAR = 'registrar';
    public const TYPE_ACADEMIC_ADMIN = 'academic_admin';
    public const TYPE_FACULTY_ADMIN = 'faculty_admin';

    public const STATUS_PENDING = 'pending';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_REVOKED = 'revoked';

    public const TYPE_LABELS = [
        self::TYPE_STUDENT => 'Student scope',
        self::TYPE_CURATOR => 'Curator scope',
        self::TYPE_REGISTRAR => 'Registrar scope',
        self::TYPE_ACADEMIC_ADMIN => 'Academic admin scope',
        self::TYPE_FACULTY_ADMIN => 'Faculty admin scope',
    ];

    protected $fillable = [
        'user_id',
        'assignment_type',
        'scope_status',
        'faculty_id',
        'department_id',
        'educational_program_id',
        'group_id',
        'course_number',
        'stream_code',
        'source_system',
        'source_external_id',
        'governance_request_id',
        'approved_by',
        'starts_at',
        'ends_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'faculty_id' => 'integer',
            'department_id' => 'integer',
            'educational_program_id' => 'integer',
            'group_id' => 'integer',
            'course_number' => 'integer',
            'governance_request_id' => 'integer',
            'approved_by' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function educationalProgram(): BelongsTo
    {
        return $this->belongsTo(EducationalProgram::class, 'educational_program_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class, 'group_id');
    }

    public function isActiveNow(): bool
    {
        if ($this->scope_status !== self::STATUS_ACTIVE) {
            return false;
        }

        if ($this->starts_at !== null && $this->starts_at->isFuture()) {
            return false;
        }

        if ($this->ends_at !== null && $this->ends_at->isPast()) {
            return false;
        }

        return true;
    }
}
