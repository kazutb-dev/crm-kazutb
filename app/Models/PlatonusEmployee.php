<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatonusEmployee extends Model
{
    protected $table = 'platonus_employees';

    protected $fillable = [
        'user_id',
        'platonus_id',
        'full_name',
        'iin',
        'position',
        'faculty',
        'department',
        'academic_title',
        'academic_degree',
        'workload_rate',
        'employee_type',
        'status',
        'raw_data',
        'synced_at',
    ];

    protected $casts = [
        'workload_rate' => 'decimal:2',
        'raw_data'      => 'array',
        'synced_at'     => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
