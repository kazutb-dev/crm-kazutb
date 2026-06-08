<?php

namespace App\Console\Commands;

use App\Models\PhonebookDepartment;
use App\Models\PhonebookUser;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ImportPhonebookBackup extends Command
{
    protected $signature = 'phonebook:import-backup
        {path : Path to SQL dump file}
        {--truncate : Truncate phonebook tables before import}';

    protected $description = 'Import phonebook users/departments from legacy SQL dump into isolated phonebook tables';

    public function handle(): int
    {
        if (! Schema::hasTable('phonebook_departments') || ! Schema::hasTable('phonebook_users')) {
            $this->error('Phonebook tables not found. Run migrations first.');

            return self::FAILURE;
        }

        $path = (string) $this->argument('path');

        if (! is_file($path)) {
            $this->error("File not found: {$path}");

            return self::FAILURE;
        }

        $sql = file_get_contents($path);

        if ($sql === false) {
            $this->error('Failed to read dump file.');

            return self::FAILURE;
        }

        $departmentRows = $this->extractInsertRows($sql, 'departments');
        $userRows = $this->extractInsertRows($sql, 'users');

        if ($departmentRows === [] && $userRows === []) {
            $this->error('No INSERT INTO `departments` or INSERT INTO `users` blocks found in dump.');

            return self::FAILURE;
        }

        if ((bool) $this->option('truncate')) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');

            try {
                PhonebookUser::query()->truncate();
                PhonebookDepartment::query()->truncate();
            } finally {
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
            }
        }

        DB::transaction(function () use ($departmentRows, $userRows): void {

            $departmentIdByLegacyId = [];

            foreach ($departmentRows as $row) {
                $legacyId = $this->toInt($row[0] ?? null);
                $name = $this->toString($row[1] ?? null);

                if ($legacyId === null || $name === null || $name === '') {
                    continue;
                }

                $department = PhonebookDepartment::query()->updateOrCreate(
                    ['legacy_id' => $legacyId],
                    [
                        'name' => $name,
                        'created_at' => $this->toDateTime($row[2] ?? null),
                        'updated_at' => $this->toDateTime($row[3] ?? null),
                    ]
                );

                $departmentIdByLegacyId[$legacyId] = $department->id;
            }

            foreach ($userRows as $row) {
                $legacyId = $this->toInt($row[0] ?? null);

                if ($legacyId === null) {
                    continue;
                }

                $fullName = $this->toString($row[1] ?? null) ?? '';
                $email = $this->toString($row[2] ?? null);
                $jobTitle = $this->toString($row[5] ?? null);

                // Ignore technical admin user from legacy dump.
                if (strtolower(trim($fullName)) === 'admin'
                    || strtolower((string) $email) === 'admin@kaztbu.edu.kz'
                    || strtolower((string) $jobTitle) === 'administrator') {
                    continue;
                }

                $legacyDepartmentId = $this->toInt($row[9] ?? null);
                $departmentId = $legacyDepartmentId !== null
                    ? ($departmentIdByLegacyId[$legacyDepartmentId] ?? null)
                    : null;

                PhonebookUser::query()->updateOrCreate(
                    ['legacy_id' => $legacyId],
                    [
                        'full_name' => $fullName,
                        'email' => $email,
                        'phone' => $this->toString($row[3] ?? null),
                        'inner_phone' => $this->toString($row[4] ?? null),
                        'job_title' => $jobTitle,
                        'status' => $this->toString($row[6] ?? null) ?? '0',
                        'avatar_url' => $this->toString($row[7] ?? null),
                        'legacy_department_id' => $legacyDepartmentId,
                        'department_id' => $departmentId,
                        'sort_order' => $this->toInt($row[14] ?? null),
                        'office' => $this->toString($row[15] ?? null),
                        'created_at' => $this->toDateTime($row[12] ?? null),
                        'updated_at' => $this->toDateTime($row[13] ?? null),
                    ]
                );
            }
        });

        $this->info('Import completed successfully.');
        $this->line('Imported departments: '.PhonebookDepartment::query()->count());
        $this->line('Imported users: '.PhonebookUser::query()->count());

        return self::SUCCESS;
    }

    /**
     * @return array<int, array<int, mixed>>
     */
    private function extractInsertRows(string $sql, string $table): array
    {
        $pattern = '/INSERT INTO\\s+`'.preg_quote($table, '/').'`\\s+VALUES\\s*(.+?);/si';

        if (! preg_match_all($pattern, $sql, $matches) || ! isset($matches[1])) {
            return [];
        }

        $rows = [];

        foreach ($matches[1] as $payload) {
            foreach ($this->parseTuplePayload($payload) as $tuple) {
                $rows[] = $this->splitTupleFields($tuple);
            }
        }

        return $rows;
    }

    /**
     * @return array<int, string>
     */
    private function parseTuplePayload(string $payload): array
    {
        $tuples = [];
        $inString = false;
        $escaped = false;
        $depth = 0;
        $buffer = '';

        $length = strlen($payload);

        for ($i = 0; $i < $length; $i++) {
            $char = $payload[$i];

            if ($escaped) {
                if ($depth > 0) {
                    $buffer .= $char;
                }
                $escaped = false;
                continue;
            }

            if ($char === '\\\\') {
                if ($depth > 0) {
                    $buffer .= $char;
                }
                $escaped = true;
                continue;
            }

            if ($char === "'") {
                if ($depth > 0) {
                    $buffer .= $char;
                }
                $inString = ! $inString;
                continue;
            }

            if (! $inString && $char === '(') {
                $depth++;
                if ($depth === 1) {
                    $buffer = '';
                    continue;
                }
            }

            if (! $inString && $char === ')') {
                if ($depth === 1) {
                    $tuples[] = $buffer;
                    $buffer = '';
                    $depth = 0;
                    continue;
                }
                if ($depth > 1) {
                    $depth--;
                }
            }

            if ($depth > 0) {
                $buffer .= $char;
            }
        }

        return $tuples;
    }

    /**
     * @return array<int, mixed>
     */
    private function splitTupleFields(string $tuple): array
    {
        $values = [];
        $inString = false;
        $escaped = false;
        $buffer = '';
        $length = strlen($tuple);

        for ($i = 0; $i < $length; $i++) {
            $char = $tuple[$i];

            if ($escaped) {
                $buffer .= $char;
                $escaped = false;
                continue;
            }

            if ($char === '\\\\') {
                $buffer .= $char;
                $escaped = true;
                continue;
            }

            if ($char === "'") {
                $buffer .= $char;
                $inString = ! $inString;
                continue;
            }

            if (! $inString && $char === ',') {
                $values[] = $this->decodeSqlValue($buffer);
                $buffer = '';
                continue;
            }

            $buffer .= $char;
        }

        $values[] = $this->decodeSqlValue($buffer);

        return $values;
    }

    private function decodeSqlValue(string $token): mixed
    {
        $token = trim($token);

        if (strcasecmp($token, 'NULL') === 0) {
            return null;
        }

        if ($token !== '' && $token[0] === "'" && substr($token, -1) === "'") {
            $inner = substr($token, 1, -1);

            return str_replace(
                ['\\\\\\\'', '\\\\\\\\', '\\\\n', '\\\\r', '\\\\t'],
                ["'", '\\\\', "\n", "\r", "\t"],
                $inner
            );
        }

        if (is_numeric($token)) {
            return str_contains($token, '.') ? (float) $token : (int) $token;
        }

        return $token;
    }

    private function toInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }

    private function toString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $string = trim((string) $value);

        return $string === '' ? null : $string;
    }

    private function toDateTime(mixed $value): ?string
    {
        $string = $this->toString($value);

        return $string === null ? null : $string;
    }
}
