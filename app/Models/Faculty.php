<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Faculty extends Model
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

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    public function divisions(): HasMany
    {
        return $this->hasMany(Division::class);
    }
}
