<?php

namespace App\Services\Hr\Docx;

use App\Models\HrDocumentTemplate;

/**
 * Tags a hiring template may use. All value tags are available in every document type (they come from the
 * same hiring); blocks, table rows and required tags differ per type. Uploaded templates are checked against
 * this list, and the HR instruction (docs/hr-module/README-ОУП.md) documents it.
 */
final class HrTemplateCatalog
{
    /** Value tag => description. */
    public const VALUES = [
        // Employee
        'fio' => 'ФИО полностью',
        'fio_short' => 'Фамилия и инициалы',
        'fio_acc' => 'ФИО в винительном падеже («кого?») для приказа',
        'last_name' => 'Фамилия',
        'first_name' => 'Имя',
        'middle_name' => 'Отчество',
        'birth_date' => 'Дата рождения, ДД.ММ.ГГГГ',
        'gender_label' => 'Пол (Мужской / Женский)',
        'iin' => 'ИИН',
        'citizen_ru' => '«гражданин/гражданка Республики Казахстан»',
        'citizen_kz' => '«Қазақстан Республикасының азаматы»',
        'citizenship_label' => 'Гражданство для личной карточки',
        'id_doc_kind' => 'Вид документа, удостоверяющего личность',
        'id_num' => '№ удостоверения личности',
        'id_date' => 'Дата выдачи удостоверения, ДД.ММ.ГГГГ',
        'id_issuer_ru' => 'Кем выдано, после «выданного» (МВД РК)',
        'id_issuer_kz' => 'Кем выдано (ҚР ІІМ)',
        'id_issuer_label' => 'Кем выдано, именительный падеж',
        'addr_city' => 'Город',
        'addr_street' => 'Улица',
        'addr_house' => 'Дом',
        'addr_apt_ru' => '«, кв.15» или пусто',
        'addr_apt_kz' => '«, 15 пәтер» или пусто',
        'address_line' => 'Адрес одной строкой',
        'phone' => 'Телефон',
        'marital_label' => 'Семейное положение',
        'military_label' => 'Воинский учёт',
        'pensioner_label' => 'Пенсионер (Да / Нет)',
        'disability_label' => 'Инвалидность',
        'student_label' => 'Обучающийся (Да / Нет)',
        'large_family_label' => 'Многодетная семья (Да / Нет)',
        // Appointment
        'category_label' => 'Категория персонала',
        'top_unit_name' => 'Департамент, управление, факультет',
        'sub_unit_name' => 'Отдел, кафедра',
        'position_name' => 'Должность',
        'position_full_ru' => 'Полная должность, род. падеж: «старшего преподавателя кафедры … факультета …»',
        'position_full_kz' => 'Полная должность: «… факультетінің … кафедрасының аға оқытушысы»',
        'start_ru' => 'Дата начала работы: «02 ноября 2026»',
        'start_kz' => 'Дата начала работы: «2026 жылғы 02 қараша»',
        'start_kz_from' => '«2026 жылғы 02 қарашадан» (перед «бастап»)',
        'start_date_short' => 'Дата приёма, ДД.ММ.ГГГГ',
        'probation_label' => 'Испытательный срок для личной карточки',
        'replacement_label' => 'Замещаемый работник для личной карточки',
        // Contract
        'num' => '№ договора',
        'contract_date_ru' => 'Дата договора: «"30" октября 2026 г.»',
        'contract_date_kz' => 'Дата договора: «"30" қазан 2026 ж.»',
        'contract_date_short' => 'Дата договора, ДД.ММ.ГГГГ',
        'contract_label' => '«№412 от 30.10.2026» для личной карточки',
        'term_ru' => 'Пункт 2.1 (рус.): «Настоящий договор заключен на …»',
        'term_kz' => 'Пункт 2.1 (каз.): «Осы шарт … жасалды.»',
        'end_ru' => 'Окончание договора: «01 ноября 2027 года.» или «до выхода основного работника на работу.»',
        'end_kz' => 'Окончание договора: «2027 жылғы 01 қараша» или «негізгі жұмыскер жұмысқа шыққанға дейін»',
        'prob_ru' => 'Испытательный срок: «три месяца»',
        'prob_kz' => 'Испытательный срок: «үш ай»',
        'prob_end_ru' => 'Окончание испытания: «01 февраля 2027»',
        'prob_end_kz' => 'Окончание испытания: «2027 жылғы 01 ақпан»',
        'vac_days' => 'Дни отпуска цифрами',
        'vac_days_ru' => 'Дни отпуска прописью (рус.)',
        'vac_days_kz' => 'Дни отпуска прописью (каз.)',
        'salary' => 'Оклад цифрами: «385 000»',
        'salary_ru' => 'Оклад прописью (рус.)',
        'salary_kz' => 'Оклад прописью (каз.)',
        'employment_label' => 'Вид работы (Основная / Совместительство)',
        'clause_1_7_sovm_ru' => 'Пункт 1.7 при совместительстве (рус.)',
        'clause_1_7_sovm_kz' => 'Пункт 1.7 при совместительстве (каз.)',
        'clause_3_1_2_aup_ru' => 'Пункт 3.1.2 при графике АУП (рус.)',
        'clause_3_1_2_aup_kz' => 'Пункт 3.1.2 при графике АУП (каз.)',
        'clause_3_1_shift_ru' => 'Пункт 3.1 при сменном графике (рус.)',
        'clause_3_1_shift_kz' => 'Пункт 3.1 при сменном графике (каз.)',
        'oup_executor' => 'Исполнитель ОУП (по умолчанию — кто формирует документ)',
        // Order
        'order_num' => '№ приказа',
        'order_date_ru' => 'Дата приказа: «"30" октября 2026 г.»',
        'order_date_kz' => 'Дата приказа: «"30" қазан 2026 ж.»',
        'order_label' => '«№412-К от 30.10.2026» для личной карточки',
        'ord_term_ru' => 'Срок в приказе: «сроком на один год», «на неопределенный срок», «на время отсутствия …»',
        'ord_term_kz' => 'Срок в приказе (каз.)',
        'ord_prob_ru' => '«, с испытательным сроком три месяца» или пусто',
        'ord_prob_kz' => '«, үш ай сынақ мерзімімен» или пусто',
        'ord_kind_ru' => '«по основному месту работы» / «по совместительству»',
        'ord_kind_kz' => '«негізгі» / «қоса атқару бойынша»',
        // Employer (module settings)
        'emp_name_ru' => 'Работодатель (рус.)',
        'emp_name_kz' => 'Работодатель (каз.)',
        'emp_bin' => 'БИН',
        'emp_basis_ru' => 'Основание: «Устава и Приказа № … от …»',
        'emp_basis_kz' => 'Основание (каз.)',
        'emp_signatory_ru_gen' => '«Президента Е. Т. Кулажанова»',
        'emp_signatory_kz' => '«Президент Е.Т. Кулажанов»',
        'emp_signatory_title_ru' => 'Должность подписанта (рус.)',
        'emp_signatory_title_kz' => 'Должность подписанта (каз.)',
        'emp_signatory_short' => '«Е. Кулажанов»',
        'emp_bank' => 'Банк',
        'emp_iik' => 'ИИК',
        'emp_bik' => 'БИК',
        'emp_address' => 'Юридический адрес (каз.), можно в несколько строк',
        'emp_address_ru' => 'Юридический адрес (рус.)',
        'emp_phone' => 'Телефон работодателя',
        'visa_title_ru' => 'Виза: должность (рус.)',
        'visa_title_kz' => 'Виза: должность (каз.)',
        'visa_name' => 'Виза: инициалы и фамилия',
        // Card
        'fill_date' => 'Дата формирования, ДД.ММ.ГГГГ',
    ];

    /** Image tag => description. */
    public const IMAGES = [
        'photo' => 'Фото 3×4 (личная карточка)',
    ];

    /** Table row tags: the row holding the first tag is repeated per item. */
    public const ROWS = [
        'edu_level' => ['edu_level', 'edu_institution', 'edu_year', 'edu_specialty', 'edu_diploma'],
        'child_name' => ['child_name', 'child_birth'],
        'att_no' => ['att_no', 'att_type', 'att_name'],
    ];

    /** Block name => description. */
    public const BLOCKS = [
        'if_main' => 'Основная работа',
        'if_sovm' => 'Совместительство',
        'if_has_end' => 'У договора есть дата окончания (не бессрочный)',
        'if_prob' => 'Есть испытательный срок',
        'if_week' => 'Пятидневная неделя (не сменный график)',
        'if_sched_pps' => 'График ППС',
        'if_sched_aup' => 'График АУП',
        'if_sched_shift' => 'Сменный график',
        'if_has_edu' => 'Есть сведения об образовании',
        'if_no_edu' => 'Нет сведений об образовании',
        'if_has_children' => 'Есть дети',
        'if_no_children' => 'Нет детей',
        'if_has_attachments' => 'Есть прикреплённые документы',
        'if_no_attachments' => 'Нет прикреплённых документов',
    ];

    /** Tags a template of the type cannot do without. */
    public const REQUIRED = [
        HrDocumentTemplate::TYPE_CONTRACT => ['num', 'fio', 'iin', 'position_full_ru', 'position_full_kz', 'start_ru', 'start_kz', 'salary'],
        HrDocumentTemplate::TYPE_ORDER => ['order_num', 'fio', 'fio_acc', 'position_full_ru', 'position_full_kz', 'start_ru', 'salary'],
        HrDocumentTemplate::TYPE_CARD => ['last_name', 'first_name', 'iin', 'position_name'],
    ];

    public static function isKnownTag(string $tag): bool
    {
        $base = explode(':', $tag, 2)[0];

        return isset(self::VALUES[$base]) || isset(self::IMAGES[$base]) || isset(self::BLOCKS[ltrim($base, '/')])
            || in_array($base, array_merge(...array_values(self::ROWS)), true);
    }
}
