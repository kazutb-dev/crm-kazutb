<?php

use App\Models\OrgUnit;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('org_units', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 80)->unique();
            $table->string('name');
            $table->string('unit_type', 60);
            $table->foreignId('parent_id')->nullable()->constrained('org_units')->nullOnDelete();
            $table->string('leader_name')->nullable();
            $table->string('leader_title')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->string('source', 120)->default('manual');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('unit_type');
            $table->index('parent_id');
            $table->index('sort_order');
        });

        $this->seedInitialOrgCatalog();
    }

    public function down(): void
    {
        Schema::dropIfExists('org_units');
    }

    private function seedInitialOrgCatalog(): void
    {
        $now = now();
        $codeToId = [];

        foreach ($this->units() as $row) {
            $parentCode = $row['parent_code'] ?? null;
            $parentId = null;

            if (is_string($parentCode) && $parentCode !== '') {
                $parentId = $codeToId[$parentCode]
                    ?? DB::table('org_units')->where('code', $parentCode)->value('id');
            }

            DB::table('org_units')->updateOrInsert(
                ['code' => $row['code']],
                [
                    'name' => $row['name'],
                    'unit_type' => $row['unit_type'],
                    'parent_id' => $parentId,
                    'leader_name' => $row['leader_name'] ?? null,
                    'leader_title' => $row['leader_title'] ?? null,
                    'sort_order' => $row['sort_order'] ?? 0,
                    'is_active' => true,
                    'source' => 'seed:real_university_structure:2026-06-03',
                    'metadata' => isset($row['metadata']) ? json_encode($row['metadata'], JSON_UNESCAPED_UNICODE) : null,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );

            $codeToId[$row['code']] = (int) DB::table('org_units')
                ->where('code', $row['code'])
                ->value('id');
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function units(): array
    {
        return [
            [
                'code' => 'KAZUTB',
                'name' => 'Университет КазУТБ',
                'unit_type' => OrgUnit::TYPE_UNIVERSITY,
                'sort_order' => 10,
            ],
            [
                'code' => 'BOARD',
                'name' => 'Совет директоров',
                'unit_type' => OrgUnit::TYPE_GOVERNANCE,
                'parent_code' => 'KAZUTB',
                'sort_order' => 20,
            ],
            [
                'code' => 'PRESIDENT',
                'name' => 'Президент',
                'unit_type' => OrgUnit::TYPE_GOVERNANCE,
                'parent_code' => 'BOARD',
                'sort_order' => 30,
            ],
            [
                'code' => 'RECTOR',
                'name' => 'Ректор',
                'unit_type' => OrgUnit::TYPE_GOVERNANCE,
                'parent_code' => 'BOARD',
                'sort_order' => 40,
            ],
            [
                'code' => 'ACADEMIC_COUNCIL',
                'name' => 'Учёный совет',
                'unit_type' => OrgUnit::TYPE_GOVERNANCE,
                'parent_code' => 'BOARD',
                'sort_order' => 50,
            ],
            [
                'code' => 'DEPT_STRATEGY',
                'name' => 'Департамент стратегического развития',
                'unit_type' => OrgUnit::TYPE_DEPARTMENT,
                'parent_code' => 'RECTOR',
                'sort_order' => 110,
            ],
            [
                'code' => 'ADMIN_STRATEGY_DEV',
                'name' => 'Управление стратегического развития',
                'unit_type' => OrgUnit::TYPE_ADMINISTRATION,
                'parent_code' => 'DEPT_STRATEGY',
                'sort_order' => 120,
            ],
            [
                'code' => 'OMKO',
                'name' => 'Отдел менеджмента качества образования (СМК)',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_STRATEGY_DEV',
                'leader_name' => 'Эрнст Айгерим',
                'sort_order' => 130,
            ],
            [
                'code' => 'ORIA',
                'name' => 'Отдел рейтингов и аккредитации',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_STRATEGY_DEV',
                'leader_name' => 'Сыздыков Ерке Калиакбарович',
                'sort_order' => 140,
            ],
            [
                'code' => 'OMOAM',
                'name' => 'Отдел международного образования и академической мобильности',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_STRATEGY_DEV',
                'leader_name' => 'Өсербай Мөлдір',
                'sort_order' => 150,
            ],
            [
                'code' => 'OMIPR',
                'name' => 'Отдел маркетинга и PR',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_STRATEGY_DEV',
                'leader_name' => 'Сайлау Бейбарыс Қозыбағарұлы',
                'sort_order' => 160,
            ],
            [
                'code' => 'UOKIA',
                'name' => 'Управление обеспечения качества и аккредитации',
                'unit_type' => OrgUnit::TYPE_ADMINISTRATION,
                'parent_code' => 'DEPT_STRATEGY',
                'leader_name' => 'Оразалина Динара Кайыргалиевна',
                'sort_order' => 170,
            ],
            [
                'code' => 'ADMIN_PLAN_ACC_ANALYTICS',
                'name' => 'Управление планирования, бухгалтерского учёта и анализа',
                'unit_type' => OrgUnit::TYPE_ADMINISTRATION,
                'parent_code' => 'DEPT_STRATEGY',
                'sort_order' => 180,
            ],
            [
                'code' => 'OFFICE_ACCOUNTING',
                'name' => 'Отдел бухгалтерского учёта и расчёта',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_PLAN_ACC_ANALYTICS',
                'sort_order' => 190,
            ],
            [
                'code' => 'OFFICE_ECON_PLANNING',
                'name' => 'Отдел экономического планирования',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_PLAN_ACC_ANALYTICS',
                'sort_order' => 200,
            ],
            [
                'code' => 'VICE_ACADEMIC',
                'name' => 'Проректор по академическим вопросам',
                'unit_type' => OrgUnit::TYPE_RECTORATE,
                'parent_code' => 'RECTOR',
                'sort_order' => 210,
            ],
            [
                'code' => 'UOP',
                'name' => 'Управление образовательных программ',
                'unit_type' => OrgUnit::TYPE_ADMINISTRATION,
                'parent_code' => 'VICE_ACADEMIC',
                'leader_name' => 'Баядилова Бакыт Мелисовна',
                'sort_order' => 220,
            ],
            [
                'code' => 'OFFICE_STUDY',
                'name' => 'Учебный отдел',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'UOP',
                'sort_order' => 230,
            ],
            [
                'code' => 'OFFICE_METHOD',
                'name' => 'Методический отдел',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'UOP',
                'sort_order' => 240,
            ],
            [
                'code' => 'OFFICE_POSTGRAD',
                'name' => 'Отдел послевузовского образования',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'UOP',
                'sort_order' => 250,
            ],
            [
                'code' => 'OR',
                'name' => 'Офис регистратора',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'VICE_ACADEMIC',
                'leader_name' => 'Алимбай Сайрангуль Хабибулловна',
                'sort_order' => 260,
            ],
            [
                'code' => 'CKAR',
                'name' => 'Центр карьеры',
                'unit_type' => OrgUnit::TYPE_CENTER,
                'parent_code' => 'VICE_ACADEMIC',
                'leader_name' => 'Абдыкаримова Сафира Зайтбековна',
                'sort_order' => 270,
            ],
            [
                'code' => 'LIBRARY',
                'name' => 'Научная библиотека',
                'unit_type' => OrgUnit::TYPE_SERVICE,
                'parent_code' => 'VICE_ACADEMIC',
                'sort_order' => 280,
            ],
            [
                'code' => 'VICE_SCIENCE',
                'name' => 'Проректор по науке и инновациям',
                'unit_type' => OrgUnit::TYPE_RECTORATE,
                'parent_code' => 'RECTOR',
                'sort_order' => 310,
            ],
            [
                'code' => 'UNIVS',
                'name' => 'Управление науки и внешних связей',
                'unit_type' => OrgUnit::TYPE_ADMINISTRATION,
                'parent_code' => 'VICE_SCIENCE',
                'leader_name' => 'Хастаева Айгерим Жанузаковна',
                'sort_order' => 320,
                'metadata' => [
                    'transitional_mapping' => true,
                    'note' => 'Сопоставлено с веткой Управление науки / внешних связей из текущего CRM.',
                ],
            ],
            [
                'code' => 'OFFICE_SCIENCE_COMM',
                'name' => 'Отдел науки и коммерциализации',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'UNIVS',
                'sort_order' => 330,
            ],
            [
                'code' => 'SCI_PUBLISH_HUB',
                'name' => 'Science Publishing Hub',
                'unit_type' => OrgUnit::TYPE_CENTER,
                'parent_code' => 'UNIVS',
                'sort_order' => 340,
            ],
            [
                'code' => 'CK',
                'name' => 'Центр компетенций',
                'unit_type' => OrgUnit::TYPE_CENTER,
                'parent_code' => 'VICE_SCIENCE',
                'leader_name' => 'Мылтыкбаева Лязат Аманбековна',
                'sort_order' => 350,
            ],
            [
                'code' => 'VICE_SOCIAL',
                'name' => 'Проректор по воспитательной и социальной работе',
                'unit_type' => OrgUnit::TYPE_RECTORATE,
                'parent_code' => 'RECTOR',
                'sort_order' => 410,
            ],
            [
                'code' => 'VISR',
                'name' => 'Управление воспитательной и социальной работы',
                'unit_type' => OrgUnit::TYPE_ADMINISTRATION,
                'parent_code' => 'VICE_SOCIAL',
                'leader_name' => 'Саят Бердіғалиұлы',
                'sort_order' => 420,
                'metadata' => [
                    'transitional_mapping' => true,
                    'note' => 'В CRM встречается краткий код ВиСР.',
                ],
            ],
            [
                'code' => 'ADMIN_YOUTH',
                'name' => 'Управление по делам молодёжи',
                'unit_type' => OrgUnit::TYPE_ADMINISTRATION,
                'parent_code' => 'VICE_SOCIAL',
                'sort_order' => 430,
            ],
            [
                'code' => 'CENTER_LEVEL_UP',
                'name' => 'Центр молодёжи Level-up',
                'unit_type' => OrgUnit::TYPE_CENTER,
                'parent_code' => 'ADMIN_YOUTH',
                'sort_order' => 440,
            ],
            [
                'code' => 'CENTER_COMMUNITY',
                'name' => 'Community Center',
                'unit_type' => OrgUnit::TYPE_CENTER,
                'parent_code' => 'ADMIN_YOUTH',
                'sort_order' => 450,
            ],
            [
                'code' => 'ADMIN_CONTINGENT',
                'name' => 'Управление формирования контингента',
                'unit_type' => OrgUnit::TYPE_ADMINISTRATION,
                'parent_code' => 'VICE_SOCIAL',
                'sort_order' => 460,
            ],
            [
                'code' => 'OP',
                'name' => 'Отдел профориентации',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_CONTINGENT',
                'leader_name' => 'Әбдібек Алина Әділханқызы',
                'sort_order' => 470,
            ],
            [
                'code' => 'ADMISSION',
                'name' => 'Приёмная комиссия',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_CONTINGENT',
                'sort_order' => 480,
            ],
            [
                'code' => 'SERVICE_PSY',
                'name' => 'Служба психологической поддержки и адаптации',
                'unit_type' => OrgUnit::TYPE_SERVICE,
                'parent_code' => 'VICE_SOCIAL',
                'sort_order' => 490,
            ],
            [
                'code' => 'HEALTH_POINT',
                'name' => 'Здравпункт',
                'unit_type' => OrgUnit::TYPE_SERVICE,
                'parent_code' => 'VICE_SOCIAL',
                'sort_order' => 500,
            ],
            [
                'code' => 'EF',
                'name' => 'Эндаумент фонд',
                'unit_type' => OrgUnit::TYPE_CENTER,
                'parent_code' => 'VICE_SOCIAL',
                'leader_name' => 'Саят Бердіғалиұлы',
                'sort_order' => 510,
            ],
            [
                'code' => 'VICE_ADMIN',
                'name' => 'Проректор по административно-хозяйственным вопросам',
                'unit_type' => OrgUnit::TYPE_RECTORATE,
                'parent_code' => 'RECTOR',
                'sort_order' => 610,
            ],
            [
                'code' => 'ADMIN_HOUSE',
                'name' => 'Административно-хозяйственное управление',
                'unit_type' => OrgUnit::TYPE_ADMINISTRATION,
                'parent_code' => 'VICE_ADMIN',
                'sort_order' => 620,
            ],
            [
                'code' => 'OFFICE_SUPPLY',
                'name' => 'Отдел снабжения и закупа',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_HOUSE',
                'sort_order' => 630,
            ],
            [
                'code' => 'OFFICE_MIL_RECORD',
                'name' => 'Отдел военного учёта, стола, ГЗ и ЧС',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_HOUSE',
                'sort_order' => 640,
            ],
            [
                'code' => 'DEPT_DIGITAL_IT',
                'name' => 'Департамент цифрового развития и информационных технологий',
                'unit_type' => OrgUnit::TYPE_DEPARTMENT,
                'parent_code' => 'RECTOR',
                'sort_order' => 710,
            ],
            [
                'code' => 'CENTER_AI_DATA',
                'name' => 'Центр искусственного интеллекта и аналитики данных',
                'unit_type' => OrgUnit::TYPE_CENTER,
                'parent_code' => 'DEPT_DIGITAL_IT',
                'sort_order' => 720,
            ],
            [
                'code' => 'CENTER_IT',
                'name' => 'Центр информационных технологий',
                'unit_type' => OrgUnit::TYPE_CENTER,
                'parent_code' => 'DEPT_DIGITAL_IT',
                'sort_order' => 730,
            ],
            [
                'code' => 'ADMIN_LEGAL_HR',
                'name' => 'Управление правовой и кадровой службы',
                'unit_type' => OrgUnit::TYPE_ADMINISTRATION,
                'parent_code' => 'DEPT_DIGITAL_IT',
                'sort_order' => 740,
            ],
            [
                'code' => 'OUP',
                'name' => 'Отдел управления персоналом',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_LEGAL_HR',
                'leader_name' => 'Мырзалиева Меруерт Бериковна',
                'sort_order' => 750,
            ],
            [
                'code' => 'OFFICE_ANTI_CORRUPTION',
                'name' => 'Отдел противодействия коррупции и правового обеспечения',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_LEGAL_HR',
                'sort_order' => 760,
            ],
            [
                'code' => 'OFFICE_CHANCERY',
                'name' => 'Канцелярия',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_LEGAL_HR',
                'sort_order' => 770,
            ],
            [
                'code' => 'OFFICE_ARCHIVE',
                'name' => 'Архив',
                'unit_type' => OrgUnit::TYPE_OFFICE,
                'parent_code' => 'ADMIN_LEGAL_HR',
                'sort_order' => 780,
            ],
            [
                'code' => 'MIL_DEPT',
                'name' => 'Военная кафедра',
                'unit_type' => OrgUnit::TYPE_MILITARY,
                'parent_code' => 'KAZUTB',
                'sort_order' => 810,
            ],
            [
                'code' => 'FAC_TECH_ENG',
                'name' => 'Факультет Технологии и инжиниринг',
                'unit_type' => OrgUnit::TYPE_FACULTY,
                'parent_code' => 'KAZUTB',
                'leader_name' => 'Сафуани Жанар Есенқұлқызы',
                'leader_title' => 'Декан факультета',
                'sort_order' => 820,
                'metadata' => [
                    'deputies' => [
                        'Рыспаева Улжан Аманжоловна — заместитель декана по учебной работе',
                        'Бекбауова Саулет Аскаровна — заместитель декана по воспитательной работе',
                        'Тусупбекова Ақбота Жомартқызы — методист',
                    ],
                ],
            ],
            [
                'code' => 'CHAIR_TST',
                'name' => 'Кафедра Технология и стандартизация',
                'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
                'parent_code' => 'FAC_TECH_ENG',
                'leader_name' => 'Оразов Аян Жарилкасинович',
                'sort_order' => 830,
            ],
            [
                'code' => 'CHAIR_TLPD',
                'name' => 'Кафедра Технология лёгкой промышленности и дизайна',
                'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
                'parent_code' => 'FAC_TECH_ENG',
                'leader_name' => 'Байжанова Жазира Болатбековна',
                'sort_order' => 840,
            ],
            [
                'code' => 'CHAIR_AIS',
                'name' => 'Кафедра Автоматизация и инженерные системы',
                'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
                'parent_code' => 'FAC_TECH_ENG',
                'leader_name' => 'Акишев Каршыга Максутович',
                'sort_order' => 850,
                'metadata' => [
                    'transitional_mapping' => true,
                    'legacy_mapping_from' => 'Компьютерная инженерия и автоматизация',
                ],
            ],
            [
                'code' => 'CHAIR_PE',
                'name' => 'Кафедра Физическое воспитание',
                'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
                'parent_code' => 'FAC_TECH_ENG',
                'sort_order' => 860,
            ],
            [
                'code' => 'FAC_ECON_BUS',
                'name' => 'Факультет Экономика и бизнес',
                'unit_type' => OrgUnit::TYPE_FACULTY,
                'parent_code' => 'KAZUTB',
                'leader_name' => 'Мақыш Мулдир Кикбаевна',
                'leader_title' => 'Декан факультета',
                'sort_order' => 870,
                'metadata' => [
                    'deputies' => [
                        'Мұратова Эльмира Мұратқызы — заместитель декана по учебно-методической работе',
                        'Ауесбекова Асылжан Армиевна — заместитель декана по воспитательной работе',
                    ],
                ],
            ],
            [
                'code' => 'CHAIR_MANAGEMENT',
                'name' => 'Кафедра Менеджмент',
                'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
                'parent_code' => 'FAC_ECON_BUS',
                'leader_name' => 'Абдильдинова Найля Ермухановна',
                'sort_order' => 880,
                'metadata' => [
                    'transitional_mapping' => true,
                    'legacy_mapping_from' => 'Экономика и управление',
                ],
            ],
            [
                'code' => 'CHAIR_ECON_FIN',
                'name' => 'Кафедра Экономика и финансы',
                'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
                'parent_code' => 'FAC_ECON_BUS',
                'leader_name' => 'Бекбусинова Гульнафиз Кенжебековна',
                'sort_order' => 890,
                'metadata' => [
                    'transitional_mapping' => true,
                    'legacy_mapping_from' => 'Финансы и учет',
                ],
            ],
            [
                'code' => 'CHAIR_TOURISM_SERVICE',
                'name' => 'Кафедра Туризм и сервис',
                'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
                'parent_code' => 'FAC_ECON_BUS',
                'leader_name' => 'Жунусова Алия Анархановна',
                'sort_order' => 900,
            ],
            [
                'code' => 'CHAIR_STATE_LOCAL',
                'name' => 'Кафедра Государственный и местный управление',
                'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
                'parent_code' => 'FAC_ECON_BUS',
                'leader_name' => 'Канафиева Куланда Кабылсеитовна',
                'sort_order' => 910,
                'metadata' => [
                    'transitional_mapping' => true,
                    'legacy_mapping_from' => 'Государственный и иностранные языки',
                ],
            ],
            [
                'code' => 'FAC_ENG_IT',
                'name' => 'Факультет Инжиниринг и информационные технологии',
                'unit_type' => OrgUnit::TYPE_FACULTY,
                'parent_code' => 'KAZUTB',
                'leader_name' => 'Серимбетов Булат Абуталибович',
                'leader_title' => 'Декан факультета',
                'sort_order' => 920,
                'metadata' => [
                    'deputies' => [
                        'Қажытаева Назира Төреқажықызы — заместитель декана по учебно-методической работе',
                        'Болсынбек Мұхаммед Құрманбекұлы — заместитель декана по воспитательной работе',
                    ],
                ],
            ],
            [
                'code' => 'CHAIR_CHEM_ENV',
                'name' => 'Кафедра Химическая технология и рациональное природопользование',
                'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
                'parent_code' => 'FAC_ENG_IT',
                'leader_name' => 'Нұртай Жадыра Тастенбековна',
                'sort_order' => 930,
                'metadata' => [
                    'transitional_mapping' => true,
                    'legacy_mapping_from' => 'Химия, химическая технология и экология',
                ],
            ],
            [
                'code' => 'CHAIR_IT',
                'name' => 'Кафедра Информационные технологии',
                'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
                'parent_code' => 'FAC_ENG_IT',
                'leader_name' => 'Абдукаримова Алия Амировна',
                'sort_order' => 940,
            ],
            [
                'code' => 'CHAIR_SOC_HUM',
                'name' => 'Кафедра Социально-гуманитарные дисциплины',
                'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
                'parent_code' => 'FAC_ENG_IT',
                'leader_name' => 'Магауянов Даурен Абильтаевич',
                'sort_order' => 950,
                'metadata' => [
                    'transitional_mapping' => true,
                    'note' => 'Кафедра перенесена из технологического факультета в факультет ИиИТ.',
                ],
            ],
            [
                'code' => 'COLLEGE',
                'name' => 'Колледж',
                'unit_type' => OrgUnit::TYPE_COLLEGE,
                'parent_code' => 'KAZUTB',
                'sort_order' => 960,
            ],
        ];
    }
};
