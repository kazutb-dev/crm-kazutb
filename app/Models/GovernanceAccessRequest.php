<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GovernanceAccessRequest extends Model
{
    public const TYPE_POSITION = 'position';
    public const TYPE_ACADEMIC = 'academic_affiliation';
    public const TYPE_ACADEMIC_SCOPE = 'academic_scope_assignment';
    public const TYPE_STRUCTURAL = 'structural_binding';
    public const TYPE_POSITION_CHANGE = 'position_change';
    public const TYPE_FACULTY_CHANGE = 'faculty_change';
    public const TYPE_DEPARTMENT_CHANGE = 'department_change';
    public const TYPE_DIVISION_CHANGE = 'division_change';
    public const TYPE_DEGREE_CHANGE = 'degree_change';
    public const TYPE_TITLE_CHANGE = 'title_change';

    public const ROUTE_HR = 'hr';
    public const ROUTE_ACADEMIC = 'academic';
    public const ROUTE_STRUCTURAL = 'structural';

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    public const TYPE_LABELS = [
        self::TYPE_POSITION => 'Должность',
        self::TYPE_ACADEMIC => 'Академическая привязка',
        self::TYPE_ACADEMIC_SCOPE => 'Academic scope assignment',
        self::TYPE_STRUCTURAL => 'Структурная привязка',
        self::TYPE_POSITION_CHANGE => 'Изменение должности',
        self::TYPE_FACULTY_CHANGE => 'Изменение факультета',
        self::TYPE_DEPARTMENT_CHANGE => 'Изменение кафедры',
        self::TYPE_DIVISION_CHANGE => 'Изменение подразделения',
        self::TYPE_DEGREE_CHANGE => 'Изменение степени',
        self::TYPE_TITLE_CHANGE => 'Изменение title',
    ];

    public const SELF_EDITABLE_FIELDS = [
        'phone',
        'telegram',
        'bio',
        'avatar_url',
        'office_location',
        'preferences',
    ];

    public const ADMIN_EDITABLE_FIELDS = [
        'role',
        'role_id',
        'kpi_participation_override',
    ];

    public const SYNC_ONLY_FIELDS = [
        'ad_guid',
        'ad_login',
        'ad_description',
        'ad_department',
        'ad_department_number',
        'ad_division',
        'ad_employee_type',
        'ad_title',
        'source_system',
        'source_external_id',
        'platonus_person_uid',
    ];

    public const APPROVAL_REQUIRED_FIELDS = [
        'position_id',
        'position_title',
        'faculty_id',
        'department_id',
        'division_ids',
        'structural_unit_ids',
        'educational_program_id',
        'group_id',
        'course_number',
        'stream_code',
        'assignment_type',
        'scope_status',
    ];

    public const ROUTE_LABELS = [
        self::ROUTE_HR => 'HR / KPI admin',
        self::ROUTE_ACADEMIC => 'Dean / academic head',
        self::ROUTE_STRUCTURAL => 'Structural head',
    ];

    public const STATUS_LABELS = [
        self::STATUS_PENDING => 'На рассмотрении',
        self::STATUS_APPROVED => 'Одобрено',
        self::STATUS_REJECTED => 'Отклонено',
    ];

    protected $fillable = [
        'request_type',
        'subject_user_id',
        'requested_by',
        'origin',
        'authority_route',
        'authority_scope',
        'current_value',
        'requested_value',
        'approved_value',
        'effective_value',
        'request_comment',
        'status',
        'approver_id',
        'review_comment',
        'rejection_reason',
        'override_reason',
        'approved_at',
        'rejected_at',
        'effective_applied_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'authority_scope' => 'array',
            'current_value' => 'array',
            'requested_value' => 'array',
            'approved_value' => 'array',
            'effective_value' => 'array',
            'metadata' => 'array',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'effective_applied_at' => 'datetime',
        ];
    }

    public function subjectUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subject_user_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function typeLabel(): string
    {
        return self::TYPE_LABELS[$this->request_type] ?? $this->request_type;
    }

    public function routeLabel(): string
    {
        return self::ROUTE_LABELS[$this->authority_route] ?? $this->authority_route;
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? $this->status;
    }
}
