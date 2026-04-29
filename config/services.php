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

];
