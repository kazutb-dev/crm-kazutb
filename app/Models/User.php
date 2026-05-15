<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

// Related models
use App\Models\Department;
use App\Models\Division;
use App\Models\Faculty;
use App\Models\KpiStructuralUnit;

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
            'last_login_at' => 'datetime',
            'updated_profile_at' => 'datetime',
            'profile_completed_at' => 'datetime',
        ];
    }

    public function roleRef(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function faculty(): BelongsTo
    {
        return $this->belongsTo(Faculty::class, 'faculty_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class, 'division_id');
    }

    public function divisions(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Division::class, 'user_division');
    }

    public function kpiStructuralUnits(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(KpiStructuralUnit::class, 'kpi_structural_unit_user', 'user_id', 'kpi_structural_unit_id');
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
