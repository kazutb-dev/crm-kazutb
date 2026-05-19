<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class KpiStructuralConfirmation extends Model
{
    protected $table = 'kpi_structural_confirmations';

    protected $fillable = [
        'kpi_record_id',
        'structural_unit_id',
        'confirmed_by',
        'status',
        'comment',
        'confirmed_at',
    ];

    protected $casts = [
        'kpi_record_id' => 'integer',
        'structural_unit_id' => 'integer',
        'confirmed_by' => 'integer',
        'confirmed_at' => 'datetime',
    ];

    public function kpiEntry(): BelongsTo
    {
        return $this->belongsTo(KpiEntry::class, 'kpi_record_id');
    }

    public function structuralUnit(): BelongsTo
    {
        return $this->belongsTo(KpiStructuralUnit::class, 'structural_unit_id');
    }

    public function confirmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }
}
