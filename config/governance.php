<?php

return [
    // legacy_with_diagnostics: keep legacy broad behavior while evaluating new authority categories
    // strict_categories: enforce category-based elevated checks for integrated call sites
    'elevated_mode' => env('GOVERNANCE_ELEVATED_MODE', 'legacy_with_diagnostics'),

    // Capability identifiers for scoped grants/delegations.
    'capabilities' => [
        'business_super_admin' => 'governance.business_super_admin',
        'technical_super_admin' => 'governance.technical_super_admin',
        'platform_operator' => 'governance.platform_operator',
    ],

    // Dangerous action policy map for the transitional phase.
    'dangerous_actions' => [
        'kpi_access_management' => [
            'category' => 'business',
            'allow_technical_override' => true,
            'business_reason_required' => false,
            'technical_reason_required' => true,
        ],
        'position_request_decision' => [
            'category' => 'business',
            'allow_technical_override' => true,
            'business_reason_required' => false,
            'technical_reason_required' => true,
        ],
        'governance_access_request_decision' => [
            'category' => 'business',
            'allow_technical_override' => true,
            'business_reason_required' => false,
            'technical_reason_required' => true,
        ],
        'break_glass_override' => [
            'category' => 'technical',
            'allow_technical_override' => true,
            'business_reason_required' => false,
            'technical_reason_required' => true,
        ],
    ],
];
