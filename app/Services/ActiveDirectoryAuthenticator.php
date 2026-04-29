<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ActiveDirectoryAuthenticator
{
    private const LDAP_PAGED_RESULTS_OID = '1.2.840.113556.1.4.319';
    private const LDAP_PAGE_SIZE = 500;

    /**
     * @return list<array<string, string|null>>|null
     */
    public function listDirectoryUsers(string $search = ''): ?array
    {
        if (! config('ad.enabled')) {
            return null;
        }

        $connection = $this->connect();

        if ($connection === false) {
            return null;
        }

        $bindDn = (string) config('ad.bind_dn');
        $bindPassword = (string) config('ad.bind_password');

        if (! @ldap_bind($connection, $bindDn, $bindPassword)) {
            @ldap_unbind($connection);

            return null;
        }

        $baseDn = (string) config('ad.base_dn');
        $userFilter = (string) config('ad.user_filter');
        $search = trim($search);

        $searchFilter = $userFilter;

        if ($search !== '') {
            $escaped = ldap_escape($search, '', LDAP_ESCAPE_FILTER);
            $searchFilter = sprintf(
                '(&%s(|(displayname=*%s*)(cn=*%s*)(samaccountname=*%s*)(mail=*%s*)))',
                $userFilter,
                $escaped,
                $escaped,
                $escaped,
                $escaped,
            );
        }

        $attributes = [
            'displayname',
            'givenname',
            'sn',
            'initials',
            'description',
            'department',
            'departmentnumber',
            'division',
            'employeetype',
            'title',
            'physicaldeliveryofficename',
            'roomnumber',
            'cn',
            'mail',
            'userprincipalname',
            'samaccountname',
            'pager',
            'dn',
        ];

        $entries = $this->searchAllEntries($connection, $baseDn, $searchFilter, $attributes);
        @ldap_unbind($connection);

        if (! is_array($entries)) {
            return null;
        }

        if ($entries === []) {
            return [];
        }

        $users = [];

        foreach ($entries as $entry) {
            $login = $this->extractAttribute($entry, 'samaccountname');

            $users[] = [
                'display_name' => $this->extractAttribute($entry, 'displayname')
                    ?? $this->extractAttribute($entry, 'cn')
                    ?? $login,
                'login' => $login,
                'email' => $this->extractAttribute($entry, 'mail')
                    ?? $this->extractAttribute($entry, 'userprincipalname'),
                'department' => $this->extractAttribute($entry, 'department'),
                'department_number' => $this->extractAttribute($entry, 'departmentnumber'),
                'division' => $this->extractAttribute($entry, 'division'),
                'employee_type' => $this->extractAttribute($entry, 'employeetype'),
                'title' => $this->extractAttribute($entry, 'title'),
                'status' => $this->extractAttribute($entry, 'pager'),
                'dn' => isset($entry['dn']) ? (string) $entry['dn'] : null,
            ];
        }

        usort(
            $users,
            static fn (array $a, array $b): int => strcmp((string) $a['display_name'], (string) $b['display_name'])
        );

        return $users;
    }

    public function countDirectoryUsers(): ?int
    {
        if (! config('ad.enabled')) {
            return null;
        }

        $connection = $this->connect();

        if ($connection === false) {
            return null;
        }

        $bindDn = (string) config('ad.bind_dn');
        $bindPassword = (string) config('ad.bind_password');

        if (! @ldap_bind($connection, $bindDn, $bindPassword)) {
            @ldap_unbind($connection);

            return null;
        }

        $baseDn = (string) config('ad.base_dn');
        $userFilter = (string) config('ad.user_filter');

        $entries = $this->searchAllEntries($connection, $baseDn, $userFilter, ['dn']);
        @ldap_unbind($connection);

        if (! is_array($entries)) {
            return null;
        }

        return count($entries);
    }

    /**
     * @return array{students:int,staff:int,total:int}|null
     */
    public function countDirectoryUsersByCategory(): ?array
    {
        if (! config('ad.enabled')) {
            return null;
        }

        $connection = $this->connect();

        if ($connection === false) {
            return null;
        }

        $bindDn = (string) config('ad.bind_dn');
        $bindPassword = (string) config('ad.bind_password');

        if (! @ldap_bind($connection, $bindDn, $bindPassword)) {
            @ldap_unbind($connection);

            return null;
        }

        $baseDn = (string) config('ad.base_dn');
        $userFilter = (string) config('ad.user_filter');

        $entries = $this->searchAllEntries($connection, $baseDn, $userFilter, ['employeetype', 'pager', 'dn']);
        @ldap_unbind($connection);

        if (! is_array($entries)) {
            return null;
        }

        if ($entries === []) {
            return [
                'students' => 0,
                'staff' => 0,
                'total' => 0,
            ];
        }

        $students = 0;
        $staff = 0;

        foreach ($entries as $entry) {
            if ($this->isStudentDirectoryEntry($entry)) {
                $students++;
            } else {
                $staff++;
            }
        }

        return [
            'students' => $students,
            'staff' => $staff,
            'total' => $students + $staff,
        ];
    }

    public function authenticateAndSync(string $login, string $password): ?User
    {
        if (! config('ad.enabled')) {
            return null;
        }

        if ($login === '' || $password === '') {
            return null;
        }

        $connection = $this->connect();

        if ($connection === false) {
            return null;
        }

        $bindDn = (string) config('ad.bind_dn');
        $bindPassword = (string) config('ad.bind_password');

        if (! @ldap_bind($connection, $bindDn, $bindPassword)) {
            return null;
        }

        $entry = $this->findUserEntry($connection, $login);

        if ($entry === null || empty($entry['dn'])) {
            return null;
        }

        // Bind as user to validate supplied credentials.
        if (! @ldap_bind($connection, $entry['dn'], $password)) {
            return null;
        }

        return $this->upsertLocalUser($entry, $login);
    }

    private function connect()
    {
        $host = (string) config('ad.host');
        $port = (int) config('ad.port');
        $useSsl = (bool) config('ad.use_ssl');
        $timeout = (int) config('ad.timeout');
        $requireCert = (bool) config('ad.require_cert');

        $ldapUri = $useSsl ? "ldaps://{$host}" : $host;

        if (! $requireCert) {
            putenv('LDAPTLS_REQCERT=never');
            @ldap_set_option(null, LDAP_OPT_X_TLS_REQUIRE_CERT, LDAP_OPT_X_TLS_NEVER);
        }

        $connection = @ldap_connect($ldapUri, $port);

        if ($connection === false) {
            return false;
        }

        @ldap_set_option($connection, LDAP_OPT_PROTOCOL_VERSION, 3);
        @ldap_set_option($connection, LDAP_OPT_REFERRALS, 0);
        @ldap_set_option($connection, LDAP_OPT_NETWORK_TIMEOUT, $timeout);

        return $connection;
    }

    private function findUserEntry($connection, string $login): ?array
    {
        $baseDn = (string) config('ad.base_dn');
        $loginField = (string) config('ad.login_field');
        $userFilter = (string) config('ad.user_filter');

        $escapedLogin = ldap_escape($login, '', LDAP_ESCAPE_FILTER);

        $loginAttributes = array_values(array_unique(array_filter([
            $loginField,
            'samaccountname',
            'userprincipalname',
            'mail',
        ])));

        $orParts = array_map(
            static fn (string $attr): string => "({$attr}={$escapedLogin})",
            $loginAttributes
        );

        $searchFilter = "(&{$userFilter}(|".implode('', $orParts).'))';

        $result = @ldap_search(
            $connection,
            $baseDn,
            $searchFilter,
            [
                'dn',
                'displayname',
                'givenname',
                'sn',
                'initials',
                'description',
                'department',
                'departmentnumber',
                'division',
                'employeetype',
                'title',
                'physicaldeliveryofficename',
                'roomnumber',
                'cn',
                'mail',
                'userprincipalname',
                'samaccountname',
                'objectguid',
                'pager',
            ]
        );

        if ($result === false) {
            return null;
        }

        $entries = @ldap_get_entries($connection, $result);

        if (! is_array($entries) || ($entries['count'] ?? 0) < 1) {
            return null;
        }

        return $entries[0];
    }

    private function upsertLocalUser(array $entry, string $login): User
    {
        $adGuid = $this->extractAdGuid($entry);
        $samAccountName = $this->extractAttribute($entry, 'samaccountname') ?? $login;

        $name = $this->extractAttribute($entry, 'displayname')
            ?? $this->extractAttribute($entry, 'cn')
            ?? $samAccountName;

        $firstName = $this->extractAttribute($entry, 'givenname');
        $lastName = $this->extractAttribute($entry, 'sn');
        $initials = $this->extractAttribute($entry, 'initials');
        $displayName = $this->extractAttribute($entry, 'displayname')
            ?? trim(implode(' ', array_filter([$firstName, $lastName])));
        $description = $this->extractAttribute($entry, 'description');
        $employeeType = $this->extractAttribute($entry, 'employeetype');
        $room = $this->extractAttribute($entry, 'roomnumber')
            ?? $this->extractAttribute($entry, 'physicaldeliveryofficename');

        $email = $this->extractAttribute($entry, 'mail')
            ?? $this->extractAttribute($entry, 'userprincipalname')
            ?? ($samAccountName.'@kaztbu.edu.kz');

        // In AD we use "pager" as source, but store it locally in "status".
        $status = $this->extractAttribute($entry, 'pager');

        $user = null;

        if ($adGuid !== null) {
            $user = User::query()->where('ad_guid', $adGuid)->first();
        }

        if ($user === null) {
            $user = User::query()->where('email', $email)->first();
        }

        if ($user === null) {
            $user = new User();
            $user->password = Hash::make(Str::random(40));
        }

        $user->name = $name;
        $user->first_name = $firstName;
        $user->last_name = $lastName;
        $user->initials = $initials;
        $user->display_name = $displayName;
        $user->ad_description = $description;
        $user->ad_employee_type = $employeeType;
        $user->room = $room;
        $user->email = $email;
        $user->ad_guid = $adGuid;
        $user->ad_login = $samAccountName;
        $user->email_verified_at = now();
        $user->save();

        return $user;
    }

    private function isStudentDirectoryEntry(array $entry): bool
    {
        $employeeType = Str::lower(trim((string) $this->extractAttribute($entry, 'employeetype')));
        $status = Str::lower(trim((string) $this->extractAttribute($entry, 'pager')));
        $dn = Str::lower(trim((string) ($entry['dn'] ?? '')));

        return Str::contains($employeeType, 'student')
            || Str::contains($employeeType, 'студ')
            || Str::contains($status, 'student')
            || Str::contains($status, 'студ')
            || Str::contains($dn, 'ou=students')
            || Str::contains($dn, 'ou=student');
    }

    /**
     * @param resource|\LDAP\Connection $connection
     * @param list<string> $attributes
     * @return list<array<string, mixed>>|null
     */
    private function searchAllEntries($connection, string $baseDn, string $filter, array $attributes): ?array
    {
        $entries = [];
        $cookie = '';

        do {
            $controls = [
                [
                    'oid' => self::LDAP_PAGED_RESULTS_OID,
                    'iscritical' => true,
                    'value' => [
                        'size' => self::LDAP_PAGE_SIZE,
                        'cookie' => $cookie,
                    ],
                ],
            ];

            $result = @ldap_search(
                $connection,
                $baseDn,
                $filter,
                $attributes,
                0,
                0,
                0,
                LDAP_DEREF_NEVER,
                $controls
            );

            if ($result === false) {
                return $this->searchEntriesFallback($connection, $baseDn, $filter, $attributes);
            }

            $batch = @ldap_get_entries($connection, $result);

            if (! is_array($batch)) {
                return null;
            }

            for ($i = 0; $i < (int) ($batch['count'] ?? 0); $i++) {
                $entry = $batch[$i] ?? null;

                if (! is_array($entry)) {
                    continue;
                }

                $entries[] = $entry;
            }

            $parsedControls = [];
            @ldap_parse_result($connection, $result, $errorCode, $matchedDn, $errorMessage, $referrals, $parsedControls);

            $cookie = '';
            $cookieValue = $parsedControls[self::LDAP_PAGED_RESULTS_OID]['value']['cookie'] ?? '';

            if (is_string($cookieValue)) {
                $cookie = $cookieValue;
            }
        } while ($cookie !== '');

        return $entries;
    }

    /**
     * @param resource|\LDAP\Connection $connection
     * @param list<string> $attributes
     * @return list<array<string, mixed>>|null
     */
    private function searchEntriesFallback($connection, string $baseDn, string $filter, array $attributes): ?array
    {
        $result = @ldap_search($connection, $baseDn, $filter, $attributes);

        if ($result === false) {
            return null;
        }

        $batch = @ldap_get_entries($connection, $result);

        if (! is_array($batch)) {
            return null;
        }

        $entries = [];

        for ($i = 0; $i < (int) ($batch['count'] ?? 0); $i++) {
            $entry = $batch[$i] ?? null;

            if (! is_array($entry)) {
                continue;
            }

            $entries[] = $entry;
        }

        return $entries;
    }

    private function extractAttribute(array $entry, string $attribute): ?string
    {
        if (! isset($entry[$attribute][0])) {
            return null;
        }

        $value = trim((string) $entry[$attribute][0]);

        return $value === '' ? null : $value;
    }

    private function extractAdGuid(array $entry): ?string
    {
        if (! isset($entry['objectguid'][0])) {
            return null;
        }

        $raw = $entry['objectguid'][0];

        if (! is_string($raw) || strlen($raw) !== 16) {
            return null;
        }

        $hex = unpack('H*', $raw);

        if (! isset($hex[1])) {
            return null;
        }

        $h = $hex[1];

        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($h, 6, 2).substr($h, 4, 2).substr($h, 2, 2).substr($h, 0, 2),
            substr($h, 10, 2).substr($h, 8, 2),
            substr($h, 14, 2).substr($h, 12, 2),
            substr($h, 16, 4),
            substr($h, 20, 12)
        );
    }
}
