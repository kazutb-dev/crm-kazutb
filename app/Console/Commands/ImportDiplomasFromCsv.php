<?php

namespace App\Console\Commands;

use App\Services\DiplomaImportService;
use Illuminate\Console\Command;

class ImportDiplomasFromCsv extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'diplomas:import-csv {path : Absolute or relative path to CSV file}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Import diplomas history from CSV file';

    public function handle(DiplomaImportService $importService): int
    {
        $path = (string) $this->argument('path');

        $result = $importService->importFromCsv($path);

        $this->info('Imported: ' . $result['imported']);

        foreach ($result['errors'] as $error) {
            $this->warn($error);
        }

        return self::SUCCESS;
    }
}
