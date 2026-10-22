<?php

namespace Tests\Unit\Hr;

use App\Services\Hr\Iin;
use App\Services\Hr\RussianInflector;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class RussianInflectorTest extends TestCase
{
    /**
     * @return array<string, array{string, string, string, string, string}>
     */
    public static function names(): array
    {
        return [
            'kazakh male' => ['Айтмаганбетов', 'Асет', 'Лайыкович', Iin::GENDER_MALE, 'Айтмаганбетова Асета Лайыковича'],
            'russian female' => ['Иванова', 'Мария', 'Петровна', Iin::GENDER_FEMALE, 'Иванову Марию Петровну'],
            'indeclinable surname' => ['Сейткали', 'Айгерим', 'Нурлановна', Iin::GENDER_FEMALE, 'Сейткали Айгерим Нурлановну'],
            'adjective surname' => ['Толстой', 'Илья', 'Сергеевич', Iin::GENDER_MALE, 'Толстого Илью Сергеевича'],
            'kazakh patronymic -улы' => ['Ахметов', 'Нурлан', 'Серикулы', Iin::GENDER_MALE, 'Ахметова Нурлана Серикулы'],
            'kazakh patronymic -қызы' => ['Жумабаева', 'Динара', 'Маратқызы', Iin::GENDER_FEMALE, 'Жумабаеву Динару Маратқызы'],
            'double surname' => ['Петрова-Водкина', 'Анна', 'Ивановна', Iin::GENDER_FEMALE, 'Петрову-Водкину Анну Ивановну'],
        ];
    }

    #[DataProvider('names')]
    public function test_full_name_accusative(string $last, string $first, string $middle, string $gender, string $expected): void
    {
        $this->assertSame($expected, RussianInflector::fullNameAccusative($last, $first, $middle, $gender));
    }

    public function test_unknown_gender_leaves_the_name_as_is(): void
    {
        $this->assertSame('Иванова Мария', RussianInflector::fullNameAccusative('Иванова', 'Мария', null, null));
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function units(): array
    {
        return [
            'chair gets quotes' => ['Кафедра Информационные технологии', 'кафедры «Информационные технологии»'],
            'quoted chair' => ['Кафедра «Информационные технологии»', 'кафедры «Информационные технологии»'],
            'faculty gets quotes' => ['Факультет Технологии и инжиниринг', 'факультета «Технологии и инжиниринг»'],
            'office' => ['Отдел управления персоналом', 'Отдела управления персоналом'],
            'administration' => ['Управление стратегического развития', 'Управления стратегического развития'],
            'adjective + noun' => ['Научная библиотека', 'Научной библиотеки'],
            'commission' => ['Приёмная комиссия', 'Приёмной комиссии'],
            'department' => ['Департамент цифрового развития и информационных технологий', 'Департамента цифрового развития и информационных технологий'],
            'chancery' => ['Канцелярия', 'Канцелярии'],
            'latin name untouched' => ['Science Publishing Hub', 'Science Publishing Hub'],
        ];
    }

    #[DataProvider('units')]
    public function test_unit_genitive(string $name, string $expected): void
    {
        $this->assertSame($expected, RussianInflector::genitive($name));
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function positions(): array
    {
        return [
            ['Старший преподаватель', 'старшего преподавателя'],
            ['Главный специалист', 'главного специалиста'],
            ['Ведущий специалист', 'ведущего специалиста'],
            ['Заведующий кафедрой', 'заведующего кафедрой'],
            ['Инженер-программист', 'инженера-программиста'],
            ['Профессор-исследователь', 'профессора-исследователя'],
            ['Руководитель', 'руководителя'],
            ['И.о. профессора', 'и.о. профессора'],
            ['Методист', 'методиста'],
        ];
    }

    #[DataProvider('positions')]
    public function test_position_genitive(string $title, string $expected): void
    {
        $this->assertSame($expected, RussianInflector::positionGenitive($title));
    }
}
