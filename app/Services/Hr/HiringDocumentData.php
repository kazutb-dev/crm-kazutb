<?php

namespace App\Services\Hr;

/**
 * Everything a hiring document template is filled with, plus what is still missing and what needs a look.
 */
final class HiringDocumentData
{
    /**
     * @param  array<string, string>  $values  tag => text
     * @param  array<string, bool>  $flags  block => keep
     * @param  array<string, list<array<string, string>>>  $rows  first row tag => rows
     * @param  list<array{field: string, label: string, step: int}>  $missing
     * @param  list<string>  $warnings
     */
    public function __construct(
        public readonly array $values,
        public readonly array $flags,
        public readonly array $rows,
        public readonly ?string $photoPath,
        public readonly array $missing,
        public readonly array $warnings,
    ) {}
}
