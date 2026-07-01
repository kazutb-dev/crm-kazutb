<?php

return [
    'integration' => [
        'api_key' => env('LANGUAGE_TESTING_INTEGRATION_API_KEY', ''),
        'bearer_token' => env('LANGUAGE_TESTING_INTEGRATION_BEARER_TOKEN', ''),
        'session_ttl_minutes' => (int) env('LANGUAGE_TESTING_INTEGRATION_SESSION_TTL_MINUTES', 180),
        'rate_limit_per_minute' => (int) env('LANGUAGE_TESTING_INTEGRATION_RATE_LIMIT_PER_MINUTE', 120),
        'rate_limit_per_minute_per_ip' => (int) env('LANGUAGE_TESTING_INTEGRATION_RATE_LIMIT_PER_MINUTE_PER_IP', 240),
    ],

    'languages' => [
        'english' => 'English',
        'russian' => 'Russian',
        'kazakh' => 'Kazakh',
    ],

    'statuses' => [
        'active' => 'Активен',
        'inactive' => 'Неактивен',
    ],

    'result_statuses' => [
        'passed' => 'Passed',
        'failed' => 'Failed',
    ],

    'default_tests' => [
        [
            'name' => 'English Placement Test',
            'language' => 'english',
            'passing_score' => 60,
            'total_questions' => 20,
            'status' => 'active',
            'description' => null,
        ],
        [
            'name' => 'Russian Placement Test',
            'language' => 'russian',
            'passing_score' => 60,
            'total_questions' => 20,
            'status' => 'active',
            'description' => null,
        ],
        [
            'name' => 'Kazakh Placement Test',
            'language' => 'kazakh',
            'passing_score' => 60,
            'total_questions' => 20,
            'status' => 'active',
            'description' => null,
        ],
    ],
];
