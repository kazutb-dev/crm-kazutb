<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'topic_ai' => [
        'enabled' => env('TOPIC_AI_ENABLED', false),
        'endpoint' => env('TOPIC_AI_ENDPOINT', 'https://api.openai.com/v1/chat/completions'),
        'model' => env('TOPIC_AI_MODEL', 'gpt-4o-mini'),
        'api_key' => env('TOPIC_AI_API_KEY'),
        'timeout' => env('TOPIC_AI_TIMEOUT', 15),
    ],

    'teacher_ai' => [
        'enabled' => env('TEACHER_AI_ENABLED', false),
        'endpoint' => env('TEACHER_AI_ENDPOINT', 'https://api.openai.com/v1/chat/completions'),
        'model' => env('TEACHER_AI_MODEL', 'gpt-4o-mini'),
        'api_key' => env('TEACHER_AI_API_KEY'),
        'timeout' => env('TEACHER_AI_TIMEOUT', 90),
        'max_chars' => env('TEACHER_AI_MAX_CHARS', 60000),
        'daily_limit' => env('TEACHER_AI_DAILY_LIMIT', 20),
        'pdftotext_binary' => env('TEACHER_AI_PDFTOTEXT_BINARY', 'pdftotext'),
        // Lesson generator (lectures + presentations). Shares endpoint/key with reviews.
        'lesson_daily_limit' => env('TEACHER_AI_LESSON_DAILY_LIMIT', 10),
        'lesson_timeout' => env('TEACHER_AI_LESSON_TIMEOUT', 90),
        'lesson_model' => env('TEACHER_AI_LESSON_MODEL'),
        'lesson_concurrency' => env('TEACHER_AI_LESSON_CONCURRENCY', 4),
        'lesson_city' => env('TEACHER_AI_LESSON_CITY'),
        // Slide illustrations (OpenAI images API, same key).
        'images_enabled' => env('TEACHER_AI_IMAGES_ENABLED', true),
        'image_model' => env('TEACHER_AI_IMAGE_MODEL', 'gpt-image-1.5'),
        'image_quality' => env('TEACHER_AI_IMAGE_QUALITY', 'low'),
        'image_endpoint' => env('TEACHER_AI_IMAGE_ENDPOINT', 'https://api.openai.com/v1/images/generations'),
        'image_timeout' => env('TEACHER_AI_IMAGE_TIMEOUT', 90),
        'images_max' => env('TEACHER_AI_IMAGES_MAX', 8),
        'image_concurrency' => env('TEACHER_AI_IMAGE_CONCURRENCY', 3),
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
    ],

    'library_catalog' => [
        'endpoint' => env('LIBRARY_CATALOG_ENDPOINT', 'http://10.0.1.8:5173/api/v1/catalog'),
        'timeout' => env('LIBRARY_CATALOG_TIMEOUT', 15),
    ],

    'green_api' => [
        'enabled' => env('GREEN_API_ENABLED', false),
        'base_url' => env('GREEN_API_BASE_URL', 'https://api.green-api.com'),
        'instance_id' => env('GREEN_API_INSTANCE_ID'),
        'api_token_instance' => env('GREEN_API_API_TOKEN_INSTANCE'),
    ],

    'zoom' => [
        'enabled' => env('ZOOM_ENABLED', false),
        'oauth_base_url' => env('ZOOM_OAUTH_BASE_URL', 'https://zoom.us'),
        'base_url' => env('ZOOM_BASE_URL', 'https://api.zoom.us'),
        'account_id' => env('ZOOM_ACCOUNT_ID'),
        'client_id' => env('ZOOM_CLIENT_ID'),
        'client_secret' => env('ZOOM_CLIENT_SECRET'),
        'user_id' => env('ZOOM_USER_ID', 'me'),
    ],

    'crm' => [
        'api_key' => env('CRM_API_KEY'),
    ],

];
