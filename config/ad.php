<?php

return [
    // Toggle AD authentication. If disabled, app uses local auth only.
    'enabled' => env('AD_ENABLED', false),

    // Use ldaps://dc1.kaztbu.edu.kz:636 for secure bind.
    'host' => env('AD_HOST', 'dc1.kaztbu.edu.kz'),
    'port' => (int) env('AD_PORT', 636),
    'use_ssl' => env('AD_USE_SSL', true),
    'timeout' => (int) env('AD_TIMEOUT', 5),

    // Service account used to search users in directory.
    'bind_dn' => env('AD_BIND_DN', 'api-kiosk@kaztbu.edu.kz'),
    'bind_password' => env('AD_BIND_PASSWORD', ''),

    // LDAP tree and user lookup settings.
    'base_dn' => env('AD_BASE_DN', 'ou=Univer,dc=kaztbu,dc=edu,dc=kz'),
    'login_field' => env('AD_LOGIN_FIELD', 'samaccountname'),

    // Default filter from user requirements; excludes disabled accounts.
    'user_filter' => env(
        'AD_USER_FILTER',
        '(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))'
    ),

    // If true, TLS certificate must be valid and trusted by OS CA store.
    'require_cert' => env('AD_REQUIRE_CERT', true),
];
