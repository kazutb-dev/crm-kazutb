<?php

namespace App\Services;

use App\Models\AppSetting;

class KpiNpuSettingsService
{
    private const SETTINGS_KEY = 'kpi_npu_settings';

    /** @return array<string, mixed> */
    public function get(): array
    {
        $defaults = $this->defaults();

        $stored = AppSetting::query()
            ->where('key', self::SETTINGS_KEY)
            ->value('value');

        if (! is_array($stored)) {
            return $defaults;
        }

        return $this->normalize($stored, $defaults);
    }

    /** @param array<string, mixed> $settings */
    public function save(array $settings): array
    {
        $normalized = $this->normalize($settings, $this->defaults());

        AppSetting::query()->updateOrCreate(
            ['key' => self::SETTINGS_KEY],
            ['value' => $normalized],
        );

        return $normalized;
    }

    /** @return array<string, mixed> */
    private function defaults(): array
    {
        return [
            'teacher' => [
                'default_points' => (int) config('kpi.npu.teacher.default_points', 0),
                'rules' => collect(config('kpi.npu.teacher.rules', []))
                    ->map(fn (array $rule): array => [
                        'label' => (string) ($rule['label'] ?? ''),
                        'points' => (int) ($rule['points'] ?? 0),
                        'keywords' => collect($rule['keywords'] ?? [])
                            ->map(fn ($keyword): string => trim((string) $keyword))
                            ->filter()
                            ->values()
                            ->all(),
                    ])
                    ->filter(fn (array $rule): bool => $rule['label'] !== '' && $rule['keywords'] !== [])
                    ->values()
                    ->all(),
            ],
            'hod' => [
                'default_points' => (int) config('kpi.npu.hod.default_points', 0),
                'special_points' => (int) config('kpi.npu.hod.special_points', 0),
                'special_department_codes' => collect(config('kpi.npu.hod.special_department_codes', []))
                    ->map(fn ($code): string => trim((string) $code))
                    ->filter()
                    ->values()
                    ->all(),
            ],
            'dean' => [
                'points' => (int) config('kpi.npu.dean.points', 0),
            ],
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @param array<string, mixed> $defaults
     * @return array<string, mixed>
     */
    private function normalize(array $input, array $defaults): array
    {
        $teacher = is_array($input['teacher'] ?? null) ? $input['teacher'] : [];
        $hod = is_array($input['hod'] ?? null) ? $input['hod'] : [];
        $dean = is_array($input['dean'] ?? null) ? $input['dean'] : [];

        $teacherRules = collect($teacher['rules'] ?? [])
            ->filter(fn ($rule): bool => is_array($rule))
            ->map(function (array $rule): array {
                $keywords = collect($rule['keywords'] ?? [])
                    ->map(fn ($keyword): string => trim((string) $keyword))
                    ->filter()
                    ->values()
                    ->all();

                return [
                    'label' => trim((string) ($rule['label'] ?? '')),
                    'points' => max(0, (int) ($rule['points'] ?? 0)),
                    'keywords' => $keywords,
                ];
            })
            ->filter(fn (array $rule): bool => $rule['label'] !== '' && $rule['keywords'] !== [])
            ->values()
            ->all();

        return [
            'teacher' => [
                'default_points' => max(0, (int) ($teacher['default_points'] ?? $defaults['teacher']['default_points'] ?? 0)),
                'rules' => $teacherRules !== [] ? $teacherRules : ($defaults['teacher']['rules'] ?? []),
            ],
            'hod' => [
                'default_points' => max(0, (int) ($hod['default_points'] ?? $defaults['hod']['default_points'] ?? 0)),
                'special_points' => max(0, (int) ($hod['special_points'] ?? $defaults['hod']['special_points'] ?? 0)),
                'special_department_codes' => collect($hod['special_department_codes'] ?? $defaults['hod']['special_department_codes'] ?? [])
                    ->map(fn ($code): string => trim((string) $code))
                    ->filter()
                    ->unique()
                    ->values()
                    ->all(),
            ],
            'dean' => [
                'points' => max(0, (int) ($dean['points'] ?? $defaults['dean']['points'] ?? 0)),
            ],
        ];
    }
}