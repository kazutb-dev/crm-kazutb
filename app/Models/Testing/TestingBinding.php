<?php

namespace App\Models\Testing;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class TestingBinding extends Model
{
    protected $table = 'testing_bindings';

    protected $fillable = [
        'teacher_id',
        'subject_id',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(TestingSubject::class, 'subject_id');
    }

    public function tests(): HasMany
    {
        return $this->hasMany(TestingTest::class, 'binding_id');
    }

    public function results(): HasManyThrough
    {
        return $this->hasManyThrough(
            TestingResult::class,
            TestingTest::class,
            'binding_id',
            'test_id',
            'id',
            'id',
        );
    }
}
