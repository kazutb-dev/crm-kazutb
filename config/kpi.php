<?php

return [
    'npu' => [
        'teacher' => [
            'default_points' => 0,
            'rules' => [
                [
                    'label' => 'Ассоциированный профессор / и.о. ассоциированного профессора',
                    'points' => 800,
                    'keywords' => ['ассоциированный профессор', 'и.о. ассоциированного'],
                ],
                [
                    'label' => 'Профессор / профессор-исследователь / и.о. профессора',
                    'points' => 1000,
                    'keywords' => ['профессор', 'и.о. профессора'],
                ],
                [
                    'label' => 'Сеньор-лектор / ассистент профессора',
                    'points' => 600,
                    'keywords' => ['сеньор лектор', 'ассистент профессора'],
                ],
                [
                    'label' => 'Лектор',
                    'points' => 500,
                    'keywords' => ['лектор'],
                ],
                [
                    'label' => 'Ассистент',
                    'points' => 400,
                    'keywords' => ['ассистент'],
                ],
            ],
        ],
        'hod' => [
            'default_points' => 500,
            'special_points' => 200,
            'special_department_codes' => ['ГиИЯ', 'СГД', 'ФВ'],
        ],
        'dean' => [
            'points' => 2000,
        ],
    ],

    // Rank grouping ranges used in admin summary (p.15.1 style reporting).
    'rank_bands' => [
        'teacher' => [
            ['key' => 'lt_400', 'label' => 'До 400', 'min' => null, 'max' => 399.99],
            ['key' => 'range_400_599', 'label' => '400-599', 'min' => 400, 'max' => 599.99],
            ['key' => 'range_600_799', 'label' => '600-799', 'min' => 600, 'max' => 799.99],
            ['key' => 'range_800_999', 'label' => '800-999', 'min' => 800, 'max' => 999.99],
            ['key' => 'gte_1000', 'label' => '1000 и выше', 'min' => 1000, 'max' => null],
        ],
        'hod' => [
            ['key' => 'lt_0', 'label' => 'Ниже 0', 'min' => null, 'max' => -0.01],
            ['key' => 'range_0_499', 'label' => '0-499', 'min' => 0, 'max' => 499.99],
            ['key' => 'range_500_999', 'label' => '500-999', 'min' => 500, 'max' => 999.99],
            ['key' => 'gte_1000', 'label' => '1000 и выше', 'min' => 1000, 'max' => null],
        ],
        'dean' => [
            ['key' => 'lt_0', 'label' => 'Ниже 0', 'min' => null, 'max' => -0.01],
            ['key' => 'range_0_999', 'label' => '0-999', 'min' => 0, 'max' => 999.99],
            ['key' => 'range_1000_1999', 'label' => '1000-1999', 'min' => 1000, 'max' => 1999.99],
            ['key' => 'gte_2000', 'label' => '2000 и выше', 'min' => 2000, 'max' => null],
        ],
    ],

    // Position grouping rules used in admin teacher rating view (p.14.7 style reporting).
    'position_groups' => [
        'teacher' => [
            ['key' => 'professor', 'label' => 'Профессор', 'keywords' => ['профессор']],
            ['key' => 'associate_professor', 'label' => 'Ассоциированный профессор / доцент', 'keywords' => ['ассоциированный профессор', 'доцент']],
            ['key' => 'senior_lecturer', 'label' => 'Сеньор-лектор / старший преподаватель', 'keywords' => ['сеньор', 'старший преподаватель']],
            ['key' => 'lecturer', 'label' => 'Лектор / преподаватель', 'keywords' => ['лектор', 'преподаватель']],
            ['key' => 'assistant', 'label' => 'Ассистент', 'keywords' => ['ассистент']],
        ],
    ],

    // Hard-check eligibility for KPI participation.
    'hard_check' => [
        'enabled' => true,
        'allow_override' => true,
        'min_workload_rate' => 1.00,
        'min_experience_years' => 1,
        'required_individual_plan_completion_percent' => 100.00,
    ],

    // Transitional KPI authorization migration controls.
    // legacy_with_diagnostics: keep current production behavior, but calculate governance decision and expose mismatches.
    // strict_governance: enforce governance formula directly (deny-by-default when requirements are missing).
    'governance_migration' => [
        'queue_gate_mode' => env('KPI_QUEUE_GATE_MODE', 'strict_governance'),
    ],
];
