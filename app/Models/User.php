<?php

namespace App\Models;


// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

// Related models
use App\Models\Department;
use App\Models\Division;
use App\Models\Faculty;
use App\Models\KpiAccessGrant;
use App\Models\KpiStructuralUnit;
use App\Services\KpiEntryStructureHydrationService;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, HasApiTokens, Notifiable;

    /**
     * Связь: подтверждения СП, где пользователь выступает подтверждающим (confirmer)
     */
    public function structuralConfirmations(): HasMany
    {
        return $this->hasMany(KpiStructuralConfirmation::class, 'confirmed_by');
    }
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
        'position_confirmed',
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
            'last_login_at' => 'datetime',
            'updated_profile_at' => 'datetime',
            'profile_completed_at' => 'datetime',
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
                } elseif ($targetRoleId === null) {
                    $user->role_id = null;
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

        static::updated(function (User $user): void {
            if (! $user->wasChanged(['faculty_id', 'department_id'])) {
                return;
            }

            if ($user->faculty_id === null && $user->department_id === null) {
                return;
            }

            app(KpiEntryStructureHydrationService::class)->hydrateForUser($user, false, true);
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

    public function kpiAccessGrants(): HasMany
    {
        return $this->hasMany(KpiAccessGrant::class, 'user_id');
    }

    public function activitySnapshot(): HasOne
    {
        return $this->hasOne(UserActivitySnapshot::class, 'user_id');
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
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

    public function resolvedRoleSlug(): string
    {
        $legacyRole = strtolower(trim((string) ($this->role ?? '')));

        if ($legacyRole !== '') {
            return match ($legacyRole) {
                'department_head' => 'hod',
                'hod', 'dean', 'teacher', 'student', 'admin', 'superadmin' => $legacyRole,
                'department', 'structural' => $this->hasStructuralAccess() ? 'structural' : 'teacher',
                default => 'teacher',
            };
        }

        $roleFromRelation = $this->roleRef?->slug;

        if (is_string($roleFromRelation) && $roleFromRelation !== '') {
            return match ($roleFromRelation) {
                'department_head' => 'hod',
                'hod', 'dean', 'teacher', 'student', 'admin', 'superadmin' => $roleFromRelation,
                'department', 'structural' => $this->hasStructuralAccess() ? 'structural' : 'teacher',
                default => 'teacher',
            };
        }

        return 'teacher';
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

    private function hasStructuralAccess(): bool
    {
        if ($this->relationLoaded('kpiStructuralUnits') && $this->kpiStructuralUnits->isNotEmpty()) {
            return true;
        }

        if ($this->relationLoaded('kpiAccessGrants')) {
            return $this->kpiAccessGrants
                ->contains(fn (KpiAccessGrant $grant): bool => $grant->permission === KpiAccessGrant::PERM_STRUCTURAL_QUEUE && (bool) $grant->is_active);
        }

        return $this->kpiStructuralUnits()->exists()
            || $this->kpiAccessGrants()
                ->where('permission', KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
                ->where('is_active', true)
                ->exists();
    }
}
