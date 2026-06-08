<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

class KpiParticipantEligibilityService
{
    private ?bool $hasHardCheckColumns = null;
    private ?bool $hasEligibilitySeedData = null;

    /**
     * @return array<string, mixed>
     */
    private function settings(): array
    {
        return (array) config('kpi.hard_check', []);
    }

    public function isEnabled(): bool
    {
        return (bool) ($this->settings()['enabled'] ?? true)
            && $this->hardCheckColumnsExist()
            && $this->hardCheckDataInitialized();
    }

    /**
     * @return array{eligible: bool, reasons: array<int, string>, metrics: array<string, float|bool|null>}
     */
    public function evaluateUser(User $user): array
    {
        $settings = $this->settings();

        $workloadRate = $user->kpi_workload_rate !== null ? (float) $user->kpi_workload_rate : null;
        $experienceYears = $user->kpi_experience_years !== null ? (float) $user->kpi_experience_years : null;
        $individualPlanPercent = $user->kpi_individual_plan_completion_percent !== null
            ? (float) $user->kpi_individual_plan_completion_percent
            : null;

        $metrics = [
            'workload_rate' => $workloadRate,
            'experience_years' => $experienceYears,
            'individual_plan_completion_percent' => $individualPlanPercent,
            'override' => (bool) ($user->kpi_participation_override ?? false),
        ];

        if (! $this->isEnabled()) {
            return [
                'eligible' => true,
                'reasons' => [],
                'metrics' => $metrics,
            ];
        }

        if ((bool) ($settings['allow_override'] ?? true) && (bool) ($user->kpi_participation_override ?? false)) {
            return [
                'eligible' => true,
                'reasons' => ['manual_override'],
                'metrics' => $metrics,
            ];
        }

        $reasons = [];

        $minRate = (float) ($settings['min_workload_rate'] ?? 1.0);
        if ($workloadRate === null || $workloadRate < $minRate) {
            $reasons[] = 'workload_rate';
        }

        $minExperienceYears = (float) ($settings['min_experience_years'] ?? 1.0);
        if ($experienceYears === null || $experienceYears < $minExperienceYears) {
            $reasons[] = 'experience_years';
        }

        $requiredPlanPercent = (float) ($settings['required_individual_plan_completion_percent'] ?? 100.0);
        if ($individualPlanPercent === null || $individualPlanPercent < $requiredPlanPercent) {
            $reasons[] = 'individual_plan_completion_percent';
        }

        return [
            'eligible' => empty($reasons),
            'reasons' => $reasons,
            'metrics' => $metrics,
        ];
    }

    public function applyEligibilityConstraints(Builder $query, string $userTable = 'users'): Builder
    {
        if (! $this->isEnabled()) {
            return $query;
        }

        $settings = $this->settings();
        $allowOverride = (bool) ($settings['allow_override'] ?? true);

        return $query->where(function (Builder $scope) use ($allowOverride, $settings, $userTable): void {
            if ($allowOverride) {
                $scope->where("{$userTable}.kpi_participation_override", true)
                    ->orWhere(function (Builder $eligible) use ($settings, $userTable): void {
                        $this->applyBaseEligibilityRules($eligible, $settings, $userTable);
                    });

                return;
            }

            $this->applyBaseEligibilityRules($scope, $settings, $userTable);
        });
    }

    public function applyEligibilityJoinForEntries(
        Builder $query,
        string $entryUserColumn = 'kpi_entries.user_id',
        string $joinedUsersAlias = 'eligible_users'
    ): Builder {
        if (! $this->isEnabled()) {
            return $query;
        }

        $query->join("users as {$joinedUsersAlias}", "{$joinedUsersAlias}.id", '=', $entryUserColumn);

        return $this->applyEligibilityConstraints($query, $joinedUsersAlias);
    }

    /**
     * @param array<string, mixed> $settings
     */
    private function applyBaseEligibilityRules(Builder $query, array $settings, string $userTable): void
    {
        $minRate = (float) ($settings['min_workload_rate'] ?? 1.0);
        $minExperienceYears = (float) ($settings['min_experience_years'] ?? 1.0);
        $requiredPlanPercent = (float) ($settings['required_individual_plan_completion_percent'] ?? 100.0);

        $query->whereNotNull("{$userTable}.kpi_workload_rate")
            ->where("{$userTable}.kpi_workload_rate", '>=', $minRate)
            ->whereNotNull("{$userTable}.kpi_experience_years")
            ->where("{$userTable}.kpi_experience_years", '>=', $minExperienceYears)
            ->whereNotNull("{$userTable}.kpi_individual_plan_completion_percent")
            ->where("{$userTable}.kpi_individual_plan_completion_percent", '>=', $requiredPlanPercent);
    }

    private function hardCheckColumnsExist(): bool
    {
        if ($this->hasHardCheckColumns !== null) {
            return $this->hasHardCheckColumns;
        }

        $requiredColumns = [
            'kpi_workload_rate',
            'kpi_experience_years',
            'kpi_individual_plan_completion_percent',
            'kpi_participation_override',
        ];

        foreach ($requiredColumns as $column) {
            if (! Schema::hasColumn('users', $column)) {
                $this->hasHardCheckColumns = false;

                return false;
            }
        }

        $this->hasHardCheckColumns = true;

        return true;
    }

    /**
     * Hard-check should only be active after KPI eligibility metrics are actually populated.
     * This preserves backward compatibility for imported/legacy datasets where new fields exist
     * structurally but are still null for everyone.
     */
    private function hardCheckDataInitialized(): bool
    {
        if ($this->hasEligibilitySeedData !== null) {
            return $this->hasEligibilitySeedData;
        }

        $this->hasEligibilitySeedData = User::query()
            ->whereNotNull('kpi_workload_rate')
            ->orWhereNotNull('kpi_experience_years')
            ->orWhereNotNull('kpi_individual_plan_completion_percent')
            ->orWhere('kpi_participation_override', true)
            ->exists();

        return $this->hasEligibilitySeedData;
    }
}
