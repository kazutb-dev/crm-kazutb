<?php

return [
    /*
     * Private disk for personal-file scans, photos, generated documents, previews and uploaded templates.
     * Never a public disk: files are streamed by the HR controllers after the access check.
     */
    'disk' => env('HR_DISK', 'local'),

    /*
     * LibreOffice for the PDF preview. Leave HR_LIBREOFFICE_BINARY empty when it is not installed: the preview
     * then reports "unavailable" and .docx downloads keep working. Each conversion gets its own profile
     * (-env:UserInstallation) so parallel runs do not lock each other.
     */
    'libreoffice' => [
        'binary' => env('HR_LIBREOFFICE_BINARY'),
        'timeout' => (int) env('HR_LIBREOFFICE_TIMEOUT', 60),
    ],

    // Previews older than this are deleted with their files by `hr:prune-previews`.
    'preview_ttl_hours' => (int) env('HR_PREVIEW_TTL_HOURS', 24),
];
