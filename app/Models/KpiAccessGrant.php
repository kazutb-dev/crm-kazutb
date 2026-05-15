<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KpiAccessGrant extends Model
{
    public $timestamps = false;

    protected $table = 'kpi_access_grants';

    // Доступные разрешения
    public const PERM_KPI_ADMIN       = 'kpi_admin';
    public const PERM_REVIEW_QUEUE     = 'review_queue';
    public const PERM_APPROVAL_QUEUE   = 'approval_queue';
    public const PERM_STRUCTURAL_QUEUE = 'structural_queue';
    public const PERM_INDICATORS       = 'indicators';
    public const PERM_ANALYTICS        = 'analytics';
    public const PERM_PERIODS          = 'periods';

    public const ALL_PERMISSIONS = [
        self::PERM_KPI_ADMIN,
        self::PERM_REVIEW_QUEUE,
        self::PERM_APPROVAL_QUEUE,
        self::PERM_STRUCTURAL_QUEUE,
        self::PERM_INDICATORS,
        self::PERM_ANALYTICS,
        self::PERM_PERIODS,
    ];

    public const PERMISSION_LABELS = [
        self::PERM_KPI_ADMIN       => 'KPI админ',
        self::PERM_REVIEW_QUEUE     => 'Очередь проверки',
        self::PERM_APPROVAL_QUEUE   => 'Утверждение (Декан)',
        self::PERM_STRUCTURAL_QUEUE => 'Структурное подразделение',
        self::PERM_INDICATORS       => 'KPI-индикаторы (справочник)',
        self::PERM_ANALYTICS        => 'Аналитика',
        self::PERM_PERIODS          => 'Управление периодами',
    ];

    protected $fillable = [
        'user_id',
        'permission',
        'division_id',
        'granted_by',
        'granted_at',
        'is_active',
    ];

    protected $casts = [
        'granted_at' => 'datetime',
        'is_active'  => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function grantedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by');
    }

    public function division(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Division::class, 'division_id');
    }

    /**
     * Проверяет, есть ли у пользователя активный доступ к указанному разрешению KPI.
     */
    public static function userHas(int $userId, string $permission): bool
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('permission', $permission)
            ->where('is_active', true)
            ->exists();
    }

    public static function userHasKpiAdmin(int $userId): bool
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('permission', self::PERM_KPI_ADMIN)
            ->where('is_active', true)
            ->exists();
    }
}
