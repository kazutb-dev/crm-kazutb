<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
        'position_title',
        'office_location',
        'telegram',
        'bio',
        'avatar_url',
        'profile_visibility',
        'updated_profile_at',
        'profile_completed_at',
        'room',
        'email',
        'phone',
        'ad_guid',
        'ad_login',
        'role',
        'role_id',
        'position_id',
        'department_id',
        'faculty_id',
        'last_login',
        'last_login_at',
        'login_count',
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
            'last_login' => 'datetime',
            'last_login_at' => 'datetime',
            'updated_profile_at' => 'datetime',
            'profile_completed_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (User $user): void {
            $roleValue = strtolower(trim((string) $user->role));

            if ($roleValue !== '') {
                $normalizedRole = match ($roleValue) {
                    'department', 'department_head' => 'hod',
                    default => $roleValue,
                };

                if ($normalizedRole !== $roleValue) {
                    $user->role = $normalizedRole;
                }

                $targetRoleId = Role::query()->where('slug', $normalizedRole)->value('id');

                if ($targetRoleId !== null && (int) $user->role_id !== (int) $targetRoleId) {
                    $user->role_id = (int) $targetRoleId;
                }

                return;
            }

            if (! empty($user->role_id)) {
                $roleSlug = Role::query()->where('id', $user->role_id)->value('slug');

                if (is_string($roleSlug) && $roleSlug !== '') {
                    $user->role = $roleSlug;
                }
            }
        });
    }

    public function divisions(): BelongsToMany
    {
        return $this->belongsToMany(Division::class, 'user_division', 'user_id', 'division_id');
    }

    public function kpiStructuralUnits(): BelongsToMany
    {
        return $this->belongsToMany(KpiStructuralUnit::class, 'kpi_structural_unit_user', 'user_id', 'kpi_structural_unit_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function faculty(): BelongsTo
    {
        return $this->belongsTo(Faculty::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
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

    public function resolveRoleLabel(): string
    {
        return match ($this->resolvedRoleSlug()) {
            'teacher' => 'Преподаватель',
            'hod', 'department_head' => 'Завед. кафедрой',
            'dean' => 'Декан',
            'department', 'structural' => 'Структурное подразделение',
            'admin', 'superadmin' => 'Администратор',
            'student' => 'Студент',
            default => 'Без роли',
        };
    }
}
