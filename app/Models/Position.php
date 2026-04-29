<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Position extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'division_id',
        'name',
        'code',
        'description',
    ];

    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class);
    }
}