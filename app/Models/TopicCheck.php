<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TopicCheck extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'diploma_id',
        'checked_by',
        'checked_at',
        'input_title',
        'normalized_title',
    ];

    protected $casts = [
        'checked_at' => 'datetime',
    ];

    public function diploma(): BelongsTo
    {
        return $this->belongsTo(Diploma::class);
    }

    public function checker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(TopicCheckItem::class);
    }
}
