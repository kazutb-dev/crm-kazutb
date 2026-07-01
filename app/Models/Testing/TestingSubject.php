<?php

namespace App\Models\Testing;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TestingSubject extends Model
{
    protected $table = 'disciplines';

    protected $fillable = [
        'name',
        'code',
        'user_id',
        'department_id',
        'description',
        'credit_hours',
    ];

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function bindings(): HasMany
    {
        return $this->hasMany(TestingBinding::class, 'subject_id');
    }
}
