<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, HasApiTokens, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'first_name',
        'last_name',
        'initials',
        'display_name',
        'ad_description',
        'ad_department',
        'ad_department_number',
        'ad_division',
        'ad_employee_type',
        'ad_title',
        'room',
        'email',
        'phone',
        'ad_guid',
        'ad_login',
        'role',
        'role_id',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function roleRef(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function resolvedRoleSlug(): string
    {
        $roleFromRelation = $this->roleRef?->slug;

        if (is_string($roleFromRelation) && $roleFromRelation !== '') {
            return $roleFromRelation;
        }

        $legacyRole = strtolower(trim((string) ($this->role ?? '')));

        if ($legacyRole !== '') {
            return $legacyRole;
        }


        return 'student';
    }
}
