<?php

return [
    'integration' => [
        'api_key' => env('LANGUAGE_TESTING_INTEGRATION_API_KEY', ''),
        'bearer_token' => env('LANGUAGE_TESTING_INTEGRATION_BEARER_TOKEN', ''),
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