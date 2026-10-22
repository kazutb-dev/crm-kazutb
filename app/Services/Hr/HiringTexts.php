<?php

namespace App\Services\Hr;

/**
 * Wording of the contract/order variants that the documents assemble from data. Kept here, one place,
 * so HR and lawyers can review it. Texts marked «проверить в ОУП» are not in the sample contract
 * (the Kazakh ones were drafted for the module) and must be checked by the HR department.
 */
final class HiringTexts
{
    public const RU_YEARS = [1 => 'один год', 2 => 'два года', 3 => 'три года'];

    public const KZ_YEARS = [1 => 'бір жылға', 2 => 'екі жылға', 3 => 'үш жылға'];

    // проверить в ОУП: «бір жыл мерзімге» в приказе
    public const KZ_YEARS_ORDER = [1 => 'бір жыл мерзімге', 2 => 'екі жыл мерзімге', 3 => 'үш жыл мерзімге'];

    public const RU_MONTHS = [1 => 'один месяц', 2 => 'два месяца', 3 => 'три месяца'];

    public const KZ_MONTHS = [1 => 'бір ай', 2 => 'екі ай', 3 => 'үш ай'];

    /** Contract 2.1, fixed term (the sample: «Настоящий договор заключен на один год» / «Осы шарт бір жылға жасалды.»). */
    public static function termYears(int $years): array
    {
        return [
            'ru' => 'Настоящий договор заключен на '.self::RU_YEARS[$years],
            'kz' => 'Осы шарт '.self::KZ_YEARS[$years].' жасалды.',
        ];
    }

    /** Contract 2.1, open-ended — проверить в ОУП (KZ). */
    public static function termIndefinite(): array
    {
        return [
            'ru' => 'Настоящий договор заключен на неопределенный срок',
            'kz' => 'Осы шарт белгіленбеген мерзімге жасалды.',
        ];
    }

    /** Contract 2.1, for the time of an absent employee — проверить в ОУП (KZ). */
    public static function termReplacement(string $name): array
    {
        return [
            'ru' => "Настоящий договор заключен на время исполнения обязанностей временно отсутствующего работника ({$name})",
            'kz' => "Осы шарт уақытша жоқ жұмыскердің ({$name}) міндеттерін атқару уақытына жасалды.",
        ];
    }

    /** Contract end for a replacement — проверить в ОУП (KZ). */
    public const END_REPLACEMENT = [
        'ru' => 'до выхода основного работника на работу.',
        'kz' => 'негізгі жұмыскер жұмысқа шыққанға дейін',
    ];

    /** Contract 1.7 for a part-time (secondary) job — проверить в ОУП (KZ). */
    public const CLAUSE_1_7_SECONDARY = [
        'ru' => '1.7. Работа по данному Договору является работой по совместительству.',
        'kz' => '1.7. Осы Шарт бойынша жұмыс Жұмыскер үшін қоса атқарылатын жұмыс (қоса атқару) болып табылады.',
    ];

    /** Contract 3.1.2 for the administrative schedule (RU from the OUP note in the sample) — проверить в ОУП (KZ). */
    public const CLAUSE_3_1_2_AUP = [
        'ru' => '3.1.2. Восьмичасовой рабочий день - с 08.30 до 17.30.',
        'kz' => '3.1.2. Сегіз сағаттық жұмыс күні – 08.30-дан 17.30-ға дейін.',
    ];

    /** Contract 3.1 for shift work, replaces 3.1–3.1.3 (RU from the OUP note in the sample) — проверить в ОУП (KZ). */
    public const CLAUSE_3_1_SHIFT = [
        'ru' => '3.1.Режим рабочего времени Работника устанавливается согласно графику (по графику).',
        'kz' => '3.1. Жұмыскердің жұмыс уақытының режимі кестеге сәйкес белгіленеді (кесте бойынша).',
    ];

    /** Order: term after the position — проверить в ОУП (KZ). */
    public static function orderTermYears(int $years): array
    {
        return ['ru' => 'сроком на '.self::RU_YEARS[$years], 'kz' => self::KZ_YEARS_ORDER[$years]];
    }

    public const ORDER_TERM_INDEFINITE = [
        'ru' => 'на неопределенный срок',
        'kz' => 'белгіленбеген мерзімге',
    ];

    public static function orderTermReplacement(string $name): array
    {
        return [
            'ru' => "на время отсутствия основного работника ({$name})",
            'kz' => "уақытша жоқ жұмыскердің ({$name}) орнына, ол жұмысқа шыққанға дейінгі мерзімге",
        ];
    }

    public static function orderProbation(int $months): array
    {
        return [
            'ru' => ', с испытательным сроком '.self::RU_MONTHS[$months],
            'kz' => ', '.self::KZ_MONTHS[$months].' сынақ мерзімімен',
        ];
    }

    public const ORDER_KIND = [
        'main' => ['ru' => 'по основному месту работы', 'kz' => 'негізгі'],
        'secondary' => ['ru' => 'по совместительству', 'kz' => 'қоса атқару бойынша'],
    ];
}
