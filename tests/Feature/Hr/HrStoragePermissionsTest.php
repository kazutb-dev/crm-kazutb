<?php

namespace Tests\Feature\Hr;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Folders the web server (www-data) creates on the private disk stay open to its group: the cron queue
 * (LibreOffice preview), the scheduler and the backups run as the deploy user in that group. Owner-only
 * 0700 folders broke the PDF preview and made the backup script stop silently.
 */
class HrStoragePermissionsTest extends TestCase
{
    public function test_private_disk_creates_group_accessible_folders(): void
    {
        $root = storage_path('framework/testing/permissions-'.uniqid());
        $disk = Storage::build(['root' => $root] + config('filesystems.disks.local'));
        $umask = umask(0022); // as under PHP-FPM

        try {
            $disk->put('hr/previews/a.docx', 'docx');

            $this->assertSame('750', substr(sprintf('%o', fileperms("{$root}/hr/previews")), -3), 'group can enter and read');
            $this->assertSame('750', substr(sprintf('%o', fileperms("{$root}/hr")), -3));
            $this->assertSame('4', substr(sprintf('%o', fileperms("{$root}/hr/previews/a.docx")), -2, 1), 'group can read the file');
        } finally {
            umask($umask);
            File::deleteDirectory($root);
        }
    }
}
