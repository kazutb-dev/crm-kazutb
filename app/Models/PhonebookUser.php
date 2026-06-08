<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PhonebookUser extends Model
{
    use HasFactory;

    protected $table = 'phonebook_users';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'legacy_id',
        'department_id',
        'legacy_department_id',
        'full_name',
        'email',
        'phone',
        'inner_phone',
        'job_title',
        'status',
        'avatar_url',
        'office',
        'sort_order',
        'created_at',
        'updated_at',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(PhonebookDepartment::class, 'department_id');
    }
}
