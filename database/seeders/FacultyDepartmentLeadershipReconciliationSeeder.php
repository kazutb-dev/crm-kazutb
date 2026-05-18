<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class FacultyDepartmentLeadershipReconciliationSeeder extends Seeder
{
    /**
     * Reconcile faculty/department reference data and leadership bindings.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $this->ensureLeadershipRoles();

            $facultyMap = $this->ensureFaculties();
            $departmentMap = $this->ensureDepartments($facultyMap);

            $leaders = $this->leadershipList();
            $users = User::query()
                ->select([
                    'id',
                    'name',
                    'display_name',
                    'email',
                    'ad_login',
                    'ad_guid',
                    'role',
                    'role_id',
                    'faculty_id',
                    'department_id',
                ])
                ->get();

            foreach ($leaders as $leader) {
                $matchedUser = $this->findBestUserMatch($users, (string) $leader['full_name']);

                if ($matchedUser === null) {
                    continue;
                }

                $targetRole = (string) $leader['target_role_slug'];
                $targetRoleId = (int) (Role::query()->where('slug', $targetRole)->value('id') ?? 0);

                if ($targetRoleId === 0) {
                    continue;
                }

                $facultyId = $facultyMap[(string) $leader['faculty_name']] ?? null;
                $departmentId = null;

                $departmentName = $leader['department_name'];
                if (is_string($departmentName) && $departmentName !== '') {
                    $departmentId = $departmentMap[$departmentName] ?? null;
                }

                $updates = [];

                if ($targetRole === 'dean') {
                    $updates['role'] = 'dean';
                    $updates['role_id'] = $targetRoleId;
                    $updates['faculty_id'] = $facultyId;
                    $updates['department_id'] = null;
                }

                if ($targetRole === 'hod') {
                    $updates['role'] = 'hod';
                    $updates['role_id'] = $targetRoleId;
                    $updates['department_id'] = $departmentId;
                    $updates['faculty_id'] = $facultyId;
                }

                if ($updates !== []) {
                    User::query()
                        ->where('id', $matchedUser->id)
                        ->update($updates);
                }
            }
        });
    }

    /**
     * @return array<int, array<string, string|null>>
     */
    private function leadershipList(): array
    {
        return [
            [
                'full_name' => 'Сафуани Жанар Есенқұлқызы',
                'faculty_name' => 'Faculty of Technology',
                'department_name' => null,
                'target_role_slug' => 'dean',
            ],
            [
                'full_name' => 'Оразов Аян Жарилкасинович',
                'faculty_name' => 'Faculty of Technology',
                'department_name' => 'Технология и стандартизация',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Байжанова Жазира Болатбековна',
                'faculty_name' => 'Faculty of Technology',
                'department_name' => 'Технология легкой промышленности и дизайна',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Магауянов Даурен Абильтаевич',
                'faculty_name' => 'Faculty of Technology',
                'department_name' => 'Социально-гуманитарные дисциплины',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Мақыш Мулдир Кикбаевна',
                'faculty_name' => 'Faculty of Economics and Business',
                'department_name' => null,
                'target_role_slug' => 'dean',
            ],
            [
                'full_name' => 'Жунусова Алия Анархановна',
                'faculty_name' => 'Faculty of Economics and Business',
                'department_name' => 'Туризм и сервис',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Абдильдинова Найля Ермухановна',
                'faculty_name' => 'Faculty of Economics and Business',
                'department_name' => 'Экономика и управление',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Бекбусинова Гульнафиз Кенжебековна',
                'faculty_name' => 'Faculty of Economics and Business',
                'department_name' => 'Финансы и учет',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Канафиева Куланда Кабылсеитовна',
                'faculty_name' => 'Faculty of Economics and Business',
                'department_name' => 'Государственный и иностранные языки',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Серимбетов Булат Абуталибович',
                'faculty_name' => 'Faculty of Engineering and Information Technologies',
                'department_name' => null,
                'target_role_slug' => 'dean',
            ],
            [
                'full_name' => 'Абдукаримова Алия Амировна',
                'faculty_name' => 'Faculty of Engineering and Information Technologies',
                'department_name' => 'Информационные технологии',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Акишев Каршыга Максутович',
                'faculty_name' => 'Faculty of Engineering and Information Technologies',
                'department_name' => 'Компьютерная инженерия и автоматизация',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Нұртай Жадыра Тастенбековна',
                'faculty_name' => 'Faculty of Engineering and Information Technologies',
                'department_name' => 'Химия, химическая технология и экология',
                'target_role_slug' => 'hod',
            ],
        ];
    }

    private function ensureLeadershipRoles(): void
    {
        Role::query()->firstOrCreate(
            ['slug' => 'dean'],
            ['name' => 'Dean']
        );

        Role::query()->firstOrCreate(
            ['slug' => 'hod'],
            ['name' => 'HOD']
        );
    }

    /**
     * @return array<string, int>
     */
    private function ensureFaculties(): array
    {
        $rows = [
            ['name' => 'Faculty of Technology', 'code' => 'FT'],
            ['name' => 'Faculty of Economics and Business', 'code' => 'FEB'],
            ['name' => 'Faculty of Engineering and Information Technologies', 'code' => 'FEIT'],
        ];

        $map = [];

        foreach ($rows as $row) {
            $faculty = Faculty::query()->firstOrCreate(
                ['code' => $row['code']],
                [
                    'name' => $row['name'],
                    'code' => $row['code'],
                    'description' => 'Reconciled from leadership source list',
                ]
            );

            if ($faculty->name !== $row['name']) {
                $faculty->forceFill(['name' => $row['name']])->save();
            }

            $map[$row['name']] = (int) $faculty->id;
        }

        return $map;
    }

    /**
     * @param array<string, int> $facultyMap
     * @return array<string, int>
     */
    private function ensureDepartments(array $facultyMap): array
    {
        $rows = [
            ['name' => 'Технология и стандартизация', 'code' => 'TST', 'faculty_name' => 'Faculty of Technology'],
            ['name' => 'Технология легкой промышленности и дизайна', 'code' => 'TLPD', 'faculty_name' => 'Faculty of Technology'],
            ['name' => 'Социально-гуманитарные дисциплины', 'code' => 'SHD', 'faculty_name' => 'Faculty of Technology'],
            ['name' => 'Туризм и сервис', 'code' => 'TS', 'faculty_name' => 'Faculty of Economics and Business'],
            ['name' => 'Экономика и управление', 'code' => 'EU', 'faculty_name' => 'Faculty of Economics and Business'],
            ['name' => 'Финансы и учет', 'code' => 'FA', 'faculty_name' => 'Faculty of Economics and Business'],
            ['name' => 'Государственный и иностранные языки', 'code' => 'GIY', 'faculty_name' => 'Faculty of Economics and Business'],
            ['name' => 'Информационные технологии', 'code' => 'IT', 'faculty_name' => 'Faculty of Engineering and Information Technologies'],
            ['name' => 'Компьютерная инженерия и автоматизация', 'code' => 'KIA', 'faculty_name' => 'Faculty of Engineering and Information Technologies'],
            ['name' => 'Химия, химическая технология и экология', 'code' => 'HHTE', 'faculty_name' => 'Faculty of Engineering and Information Technologies'],
        ];

        $hasFacultyColumn = Schema::hasColumn('departments', 'faculty_id');
        $map = [];

        foreach ($rows as $row) {
            $values = [
                'code' => $row['code'],
                'name' => $row['name'],
                'description' => 'Reconciled from leadership source list',
            ];

            if ($hasFacultyColumn) {
                $values['faculty_id'] = $facultyMap[$row['faculty_name']] ?? null;
            }

            $department = Department::query()->firstOrCreate(['code' => $row['code']], $values);

            if ($department->name !== $row['name']) {
                $department->forceFill(['name' => $row['name']])->save();
            }

            if ($hasFacultyColumn && (int) ($department->faculty_id ?? 0) !== (int) ($facultyMap[$row['faculty_name']] ?? 0)) {
                $department->forceFill([
                    'faculty_id' => $facultyMap[$row['faculty_name']] ?? null,
                ])->save();
            }

            $map[$row['name']] = (int) $department->id;
        }

        return $map;
    }

    /**
     * Conservative matching: assign only when full-name normalization is exact and unique.
     *
     * @param \Illuminate\Support\Collection<int, User> $users
     */
    private function findBestUserMatch($users, string $fullName): ?User
    {
        $target = $this->normalizeName($fullName);

        if ($target === '') {
            return null;
        }

        $matches = $users->filter(function (User $user) use ($target): bool {
            $name = $this->normalizeName((string) ($user->name ?? ''));
            $display = $this->normalizeName((string) ($user->display_name ?? ''));

            return $name === $target || $display === $target;
        })->values();

        if ($matches->count() !== 1) {
            return null;
        }

        return $matches->first();
    }

    private function normalizeName(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
        $value = str_replace(['ё', 'й'], ['е', 'и'], $value);

        return $value;
    }
}
