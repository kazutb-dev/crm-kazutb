<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class KpiStructuralUnit extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'code',
        'name',
    ];


    public function indicators(): HasMany
    {
        return $this->hasMany(KpiIndicator::class, 'checker_structural_unit_id');
    }

    /**
     * Связь: подтверждения СП для этой структурной единицы
     */
    public function structuralConfirmations(): HasMany
    {
        return $this->hasMany(KpiStructuralConfirmation::class, 'structural_unit_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'kpi_structural_unit_user', 'kpi_structural_unit_id', 'user_id');
    }

    /**
     * Many-to-many relationship: structural units can have multiple indicators
     */
    public function boundIndicators(): BelongsToMany
    {
        return $this->belongsToMany(
            KpiIndicator::class,
            'kpi_indicator_structural_unit',
            'kpi_structural_unit_id',
            'kpi_indicator_id'
        )->withTimestamps();
    }
}