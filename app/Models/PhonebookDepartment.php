<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PhonebookDepartment extends Model
{
    use HasFactory;

    protected $table = 'phonebook_departments';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'legacy_id',
        'name',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(PhonebookUser::class, 'department_id');
    }
}
