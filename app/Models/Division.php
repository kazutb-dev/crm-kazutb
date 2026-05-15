<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Division extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'code',
        'description',
    ];

    /**
     * Get users assigned to this division
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_division', 'division_id', 'user_id');
    }

    /**
     * Get KPI indicators for this division
     */
    public function kpiIndicators(): HasMany
    {
        return $this->hasMany(KpiIndicator::class, 'checker_division_id');
    }
}
