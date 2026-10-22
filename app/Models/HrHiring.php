<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One hiring: appointment (unit, position, start, probation, replacement) and the hiring order.
 * Unit and position names with their case forms are a snapshot; the catalog link is optional.
 */
class HrHiring extends Model
{
    use SoftDeletes;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_SIGNED = 'signed';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_LABELS = [
        self::STATUS_DRAFT => 'Черновик',
        self::STATUS_SIGNED => 'Подписан',
        self::STATUS_CANCELLED => 'Отменён',
    ];

    public const STAFF_CATEGORY_NAMES = [
        Position::CATEGORY_PPS => 'Профессорско-преподавательский состав',
        Position::CATEGORY_AUP => 'Административно-управленческий персонал',
        Position::CATEGORY_UVP => 'Учебно-вспомогательный персонал',
    ];

    /** Defaults suggested by the staff category (can be changed in the contract). */
    public const CATEGORY_DEFAULTS = [
        Position::CATEGORY_PPS => ['vacation_days' => 56, 'schedule' => HrEmploymentContract::SCHEDULE_PPS],
        Position::CATEGORY_AUP => ['vacation_days' => 24, 'schedule' => HrEmploymentContract::SCHEDULE_AUP],
        Position::CATEGORY_UVP => ['vacation_days' => 24, 'schedule' => HrEmploymentContract::SCHEDULE_AUP],
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'employee_id',
        'status',
        'staff_category',
        'top_unit_id',
        'top_unit_name_ru',
        'top_unit_name_ru_gen',
        'top_unit_name_kz_gen',
        'sub_unit_id',
        'sub_unit_name_ru',
        'sub_unit_name_ru_gen',
        'sub_unit_name_kz_gen',
        'position_id',
        'position_name_ru',
        'position_name_ru_gen',
        'position_name_kz_poss',
        'start_date',
        'probation_months',
        'replaces_user_id',
        'replaces_employee_id',
        'replaces_full_name',
        'order_number',
        'order_date',
        'fio_accusative',
        'fio_accusative_manual',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'order_date' => 'date',
            'probation_months' => 'integer',
            'fio_accusative_manual' => 'boolean',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(HrEmployee::class, 'employee_id');
    }

    public function contract(): HasOne
    {
        return $this->hasOne(HrEmploymentContract::class, 'hiring_id');
    }

    public function topUnit(): BelongsTo
    {
        return $this->belongsTo(OrgUnit::class, 'top_unit_id');
    }

    public function subUnit(): BelongsTo
    {
        return $this->belongsTo(OrgUnit::class, 'sub_unit_id');
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class, 'position_id');
    }

    public function replacesUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'replaces_user_id');
    }

    public function replacesEmployee(): BelongsTo
    {
        return $this->belongsTo(HrEmployee::class, 'replaces_employee_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(HrDocument::class, 'hiring_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
