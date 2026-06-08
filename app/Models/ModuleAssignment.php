<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ModuleAssignment extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_REVOKED = 'revoked';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_SUPERSEDED = 'superseded';

    public const ROLE_ADMIN = 'admin';
    public const ROLE_REVIEWER = 'reviewer';
    public const ROLE_OPERATOR = 'operator';
    public const ROLE_VIEWER = 'viewer';

    public const KIND_STANDARD = 'standard';
    public const KIND_TEMPORARY = 'temporary';
    public const KIND_DELEGATION = 'delegation';
    public const KIND_OVERRIDE = 'override';

    public const MODULE_ROLE_LABELS = [
        self::ROLE_ADMIN => 'Module Admin',
        self::ROLE_REVIEWER => 'Module Reviewer',
        self::ROLE_OPERATOR => 'Module Operator',
        self::ROLE_VIEWER => 'Module Viewer',
    ];

    public const ASSIGNMENT_KIND_LABELS = [
        self::KIND_STANDARD => 'Standard assignment',
        self::KIND_TEMPORARY => 'Temporary assignment',
        self::KIND_DELEGATION => 'Delegation',
        self::KIND_OVERRIDE => 'Override',
    ];

    protected $fillable = [
        'user_id',
        'role_id',
        'module_key',
        'module_role',
        'assignment_kind',
        'scope_type',
        'scope_source_type',
        'scope_source_id',
        'org_unit_id',
        'starts_at',
        'ends_at',
        'status',
        'granted_by',
        'reason',
        'metadata',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'role_id' => 'integer',
            'scope_source_id' => 'integer',
            'org_unit_id' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'revoked_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function grantedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by');
    }

    public function orgUnit(): BelongsTo
    {
        return $this->belongsTo(OrgUnit::class, 'org_unit_id');
    }

    public function isActiveNow(): bool
    {
        return $this->status === self::STATUS_ACTIVE
            && $this->revoked_at === null
            && ($this->starts_at === null || $this->starts_at <= now())
            && ($this->ends_at === null || $this->ends_at >= now());
    }

    public function moduleRoleLabel(): string
    {
        return self::MODULE_ROLE_LABELS[$this->module_role] ?? $this->module_role;
    }

    public function assignmentKindLabel(): string
    {
        return self::ASSIGNMENT_KIND_LABELS[$this->assignment_kind] ?? $this->assignment_kind;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function supportedModules(): array
    {
        return [
            [
                'module_key' => 'dormitory',
                'module' => 'Dormitory Module',
                'roles' => [
                    self::ROLE_ADMIN,
                    self::ROLE_REVIEWER,
                    self::ROLE_OPERATOR,
                    self::ROLE_VIEWER,
                ],
            ],
            [
                'module_key' => 'strategic_development',
                'module' => 'Strategic Development Module',
                'roles' => [
                    self::ROLE_ADMIN,
                    self::ROLE_REVIEWER,
                    self::ROLE_OPERATOR,
                    self::ROLE_VIEWER,
                ],
            ],
            [
                'module_key' => 'kpi',
                'module' => 'KPI Module',
                'roles' => [
                    self::ROLE_ADMIN,
                    self::ROLE_REVIEWER,
                    self::ROLE_OPERATOR,
                    self::ROLE_VIEWER,
                ],
            ],
        ];
    }
}
