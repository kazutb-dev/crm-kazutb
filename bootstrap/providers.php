<?php

return [
    App\Providers\AppServiceProvider::class,
    App\Modules\LanguageTestingModule\Providers\LanguageTestingServiceProvider::class,
    ...(class_exists(\Laravel\Telescope\TelescopeApplicationServiceProvider::class)
        ? [App\Providers\TelescopeServiceProvider::class]
        : []),
];
