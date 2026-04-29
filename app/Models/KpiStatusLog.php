<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KpiStatusLog extends Model
{
    use HasFactory;

    public const ACTION_SUBMIT = 'submit';
    public const ACTION_RETURN = 'return';
    public const ACTION_REVIEW = 'review';
    public const ACTION_APPROVE = 'approve';
    public const ACTION_REJECT = 'reject';
    public const ACTION_LOCK = 'lock';

    /**
     * @var string
     */
    protected $table = 'kpi_status_logs';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'kpi_entry_id',
        'from_status',
        'to_status',
        'action',
        'comment',
        'acted_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'kpi_entry_id' => 'integer',
        'acted_by' => 'integer',
    ];

    public function entry(): BelongsTo
    {
        return $this->belongsTo(KpiEntry::class, 'kpi_entry_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acted_by');
    }

    public function scopeForEntry(Builder $query, int $entryId): Builder
    {
        return $query->where('kpi_entry_id', $entryId);
    }
}
