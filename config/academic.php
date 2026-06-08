<?php

return [
    // Identity remains under AD/auth governance; CRM interprets authority.
    'identity_source' => env('ACADEMIC_IDENTITY_SOURCE', 'ad'),

    // Future upstream for academic context (read-only source of context data).
    'upstream_source' => env('ACADEMIC_UPSTREAM_SOURCE', 'platonus_read_only'),

    // CRM governance remains the only source of truth for effective permissions.
    'permission_source' => 'crm_governance',

    // Contract layer defines the allowed academic context providers for the target model.
    'contract_layer' => [
        'primary_source' => 'crm',
        'supported_sources' => [
            'crm',
            'platonus',
            'future_api',
            'future_tunnel',
            'future_readonly_connection',
        ],
    ],

    // Explicit trust boundary: never grant permissions directly from upstream data.
    'allow_upstream_direct_authority' => false,

    'scope_dimensions' => [
        'faculty',
        'department',
        'program',
        'group',
        'course',
        'stream',
    ],

    'assignment_types' => [
        'student',
        'curator',
        'registrar',
        'academic_admin',
        'faculty_admin',
    ],

    // Contract for future mobile/API consumers.
    'mobile_payload' => [
        'include_dual_context' => true,
        'include_org_scope' => true,
        'include_academic_scope' => true,
        'include_elevated_categories' => true,
    ],
];
