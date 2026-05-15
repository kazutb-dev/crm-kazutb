<?php

namespace Database\Seeders;

use App\Models\KpiStructuralUnit;
use App\Models\Role;
use App\Models\User;
use App\Services\ActiveDirectoryAuthenticator;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class StructuralUnitLeadershipSeeder extends Seeder
{
    /** @var array<string, bool> */
    private array $usersColumnCache = [];

    /**
     * Seed structural unit leadership bindings from AD users.
     */
    public function run(): void
    {
        $bindings = [
            ['unit_code' => 'УОП', 'manager' => 'Баядилова Бакыт Мелисовна'],
            ['unit_code' => 'ЦК', 'manager' => 'Мылтыкбаева Лязат Аманбековна'],
            ['unit_code' => 'УНиВС', 'manager' => 'Хастаева Айгерим Жанузаковна'],
            ['unit_code' => 'ОМОиАМ', 'manager' => 'Өсербай Мөлдір'],
            ['unit_code' => 'ВиСР', 'manager' => 'Саят Бердіғалиұлы'],
            ['unit_code' => 'УМиФК', 'manager' => 'Саят Бердіғалиұлы'],
            ['unit_code' => 'ОРиА', 'manager' => 'Сыздыков Ерке Калиакбарович'],
            ['unit_code' => 'ЦКАР', 'manager' => 'Абдыкаримова Сафира Зайтбековна'],
            ['unit_code' => 'ОУП', 'manager' => 'Мырзалиева Меруерт Бериковна'],
            ['unit_code' => 'УОКиА', 'manager' => 'Оразалина Динара Кайыргалиевна'],
            ['unit_code' => 'ОР', 'manager' => 'Алимбай Сайрангуль Хабибулловна'],
        ];

        $structuralRoleId = $this->resolveStructuralRoleId();

        $attached = 0;
        $skipped = 0;

        foreach ($bindings as $binding) {
            $unit = KpiStructuralUnit::query()->where('code', $binding['unit_code'])->first();

            if (! $unit) {
                $this->command?->warn("Unit not found: {$binding['unit_code']}");
                $skipped++;
                continue;
            }

            $user = $this->resolveOrCreateUserByName($binding['manager']);

            if (! $user instanceof User) {
                $skipped++;
                continue;
            }

            $updates = [];
            if ($this->hasUsersColumn('role')) {
                $updates['role'] = 'structural';
            }
            if ($structuralRoleId !== null && $this->hasUsersColumn('role_id')) {
                $updates['role_id'] = $structuralRoleId;
            }

            if ($updates !== []) {
                $user->forceFill($updates)->save();
            }
            $user->kpiStructuralUnits()->syncWithoutDetaching([$unit->id]);

            $this->command?->info("Bound: {$user->name} -> {$unit->code}");
            $attached++;
        }

        $this->command?->line("Structural leadership binding done. Attached: {$attached}, skipped: {$skipped}.");
        $this->command?->line('Note: Эндаумент фонд intentionally skipped (no assigned director yet).');
    }

    private function resolveOrCreateUserByName(string $fullName): ?User
    {
        $users = $this->findUsersByName($fullName);

        if ($users->count() === 1) {
            return $users->first();
        }

        if ($users->count() > 1) {
            $this->command?->warn("Local user match is ambiguous for '{$fullName}' (found: {$users->count()})");
            foreach ($users as $candidate) {
                $this->command?->line(" - #{$candidate->id} {$candidate->name} <{$candidate->email}>");
            }
            return null;
        }

        $adEntry = $this->findAdEntryByName($fullName);

        if ($adEntry === null) {
            $this->command?->warn("User not found in AD by full name: '{$fullName}'");
            return null;
        }

        return $this->upsertFromAdEntry($fullName, $adEntry);
    }

    private function resolveStructuralRoleId(): ?int
    {
        $id = Role::query()->where('slug', 'structural')->value('id');
        if ($id) {
            return (int) $id;
        }

        $fallback = Role::query()->where('slug', 'department')->value('id');
        return $fallback ? (int) $fallback : null;
    }

    /**
     * @return Collection<int, User>
     */
    private function findUsersByName(string $fullName): Collection
    {
        $normalized = mb_strtolower(trim($fullName));

        $exact = User::query()
            ->whereRaw('LOWER(TRIM(name)) = ?', [$normalized])
            ->when($this->hasUsersColumn('display_name'), function ($q) use ($normalized) {
                $q->orWhereRaw('LOWER(TRIM(display_name)) = ?', [$normalized]);
            })
            ->get();

        if ($exact->isNotEmpty()) {
            return $exact;
        }

        $parts = preg_split('/\s+/u', trim($fullName)) ?: [];
        $parts = array_values(array_filter($parts, fn (string $part): bool => $part !== ''));

        $query = User::query();
        foreach ($parts as $part) {
            $query->where(function ($q) use ($part) {
                $like = '%' . $part . '%';
                $q->where('name', 'like', $like);
                if ($this->hasUsersColumn('display_name')) {
                    $q->orWhere('display_name', 'like', $like);
                }
            });
        }

        return $query->get();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findAdEntryByName(string $fullName): ?array
    {
        /** @var ActiveDirectoryAuthenticator $ad */
        $ad = app(ActiveDirectoryAuthenticator::class);
        $entries = $ad->listDirectoryUsers($fullName) ?? [];

        if ($entries === []) {
            return null;
        }

        $entries = array_values(array_filter($entries, function (array $entry) use ($ad): bool {
            return ! $ad->isStudentEntry($entry);
        }));

        $normalized = mb_strtolower(trim($fullName));
        $exact = array_values(array_filter($entries, function (array $entry) use ($normalized): bool {
            $display = mb_strtolower(trim((string) ($entry['display_name'] ?? '')));
            return $display !== '' && $display === $normalized;
        }));

        if (count($exact) === 1) {
            return $exact[0];
        }

        $parts = preg_split('/\s+/u', trim($fullName)) ?: [];
        $parts = array_values(array_filter($parts, fn (string $part): bool => $part !== ''));

        $tokenMatched = array_values(array_filter($entries, function (array $entry) use ($parts): bool {
            $display = mb_strtolower((string) ($entry['display_name'] ?? ''));
            if ($display === '') {
                return false;
            }

            foreach ($parts as $part) {
                if (! Str::contains($display, mb_strtolower($part))) {
                    return false;
                }
            }

            return true;
        }));

        if (count($tokenMatched) === 1) {
            return $tokenMatched[0];
        }

        $candidates = $exact !== [] ? $exact : $tokenMatched;

        if ($candidates !== []) {
            $this->command?->warn("AD match is ambiguous for '{$fullName}' (found: " . count($candidates) . ")");
            foreach ($candidates as $candidate) {
                $name = (string) ($candidate['display_name'] ?? '');
                $login = (string) ($candidate['login'] ?? '');
                $email = (string) ($candidate['email'] ?? '');
                $this->command?->line(" - {$name} | {$login} | {$email}");
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed> $entry
     */
    private function upsertFromAdEntry(string $fullName, array $entry): User
    {
        $login = Str::lower(trim((string) ($entry['login'] ?? '')));
        $email = Str::lower(trim((string) ($entry['email'] ?? '')));
        $name = trim((string) ($entry['display_name'] ?? ''));
        if ($name === '') {
            $name = $fullName;
        }

        $user = null;

        if ($login !== '' && $this->hasUsersColumn('ad_login')) {
            $user = User::query()->whereRaw('LOWER(ad_login) = ?', [$login])->first();
        }

        if ($user === null && $email !== '') {
            $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();
        }

        if ($user === null) {
            $query = User::query()->whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower($name)]);
            if ($this->hasUsersColumn('display_name')) {
                $query->orWhereRaw('LOWER(TRIM(display_name)) = ?', [mb_strtolower($name)]);
            }
            $user = $query->first();
        }

        if ($user === null) {
            $user = new User();
            $user->password = Hash::make(Str::random(40));
        }

        $resolvedEmail = $email !== ''
            ? $email
            : ($login !== '' ? ($login . '@kaztbu.edu.kz') : $this->generateFallbackEmail($name));

        $resolvedEmail = $this->ensureUniqueEmail($user, $resolvedEmail);

        $payload = [
            'name' => $name,
            'email' => $resolvedEmail,
        ];

        if ($this->hasUsersColumn('display_name')) {
            $payload['display_name'] = $name;
        }
        if ($this->hasUsersColumn('ad_login') && $login !== '') {
            $payload['ad_login'] = $login;
        }
        if ($this->hasUsersColumn('ad_department')) {
            $payload['ad_department'] = $this->normalizeNullable($entry['department'] ?? null);
        }
        if ($this->hasUsersColumn('ad_division')) {
            $payload['ad_division'] = $this->normalizeNullable($entry['division'] ?? null);
        }
        if ($this->hasUsersColumn('ad_title')) {
            $payload['ad_title'] = $this->normalizeNullable($entry['title'] ?? null);
        }
        if ($this->hasUsersColumn('ad_employee_type')) {
            $payload['ad_employee_type'] = $this->normalizeNullable($entry['employee_type'] ?? null);
        }

        $user->forceFill($payload)->save();

        $this->command?->info("AD synced: {$user->name} <{$user->email}>");

        return $user;
    }

    private function hasUsersColumn(string $column): bool
    {
        if (! array_key_exists($column, $this->usersColumnCache)) {
            $this->usersColumnCache[$column] = Schema::hasColumn('users', $column);
        }

        return $this->usersColumnCache[$column];
    }

    private function normalizeNullable(mixed $value): ?string
    {
        $normalized = trim((string) $value);
        return $normalized === '' ? null : $normalized;
    }

    private function generateFallbackEmail(string $name): string
    {
        $slug = Str::slug($name, '.');
        if ($slug === '') {
            $slug = 'ad.user.' . Str::lower(Str::random(6));
        }

        return $slug . '@kaztbu.edu.kz';
    }

    private function ensureUniqueEmail(User $user, string $email): string
    {
        $base = $email;
        $suffix = 1;

        while (User::query()
            ->whereRaw('LOWER(email) = ?', [Str::lower($email)])
            ->when($user->exists, fn ($q) => $q->where('id', '!=', $user->id))
            ->exists()) {
            [$local, $domain] = array_pad(explode('@', $base, 2), 2, 'kaztbu.edu.kz');
            $email = $local . '.' . $suffix . '@' . $domain;
            $suffix++;
        }

        return $email;
    }
}
