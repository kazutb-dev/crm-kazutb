<?php

namespace App\Contracts;

use App\Models\User;
use Illuminate\Support\Collection;

interface AcademicContextProvider
{
    public function sourceSystem(): string;

    public function sourceLabel(): string;

    /**
     * @return array<int, string>
     */
    public function supportedSources(): array;

    /**
     * @param Collection<int, User> $users
     * @return array<int, array<string, mixed>>
     */
    public function resolveForUsers(Collection $users): array;

    /**
     * @return array<string, mixed>
     */
    public function resolveForUser(User $user): array;

    /**
     * @return array<string, mixed>
     */
    public function contractState(): array;
}
