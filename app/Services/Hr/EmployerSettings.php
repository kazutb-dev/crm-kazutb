<?php

namespace App\Services\Hr;

use App\Models\AppSetting;

/**
 * Employer requisites used by the hiring documents, edited by HR in the module settings (app_settings).
 */
class EmployerSettings
{
    public const KEY = 'hr_employer';

    /** Field => label (RU) for the settings form and the "missing field" list. */
    public const FIELDS = [
        'name_ru' => 'Наименование (рус.)',
        'name_kz' => 'Наименование (каз.)',
        'bin' => 'БИН',
        'basis_ru' => 'Основание полномочий (рус., род. падеж)',
        'basis_kz' => 'Основание полномочий (каз.)',
        'signatory_title_ru' => 'Должность подписанта (рус.)',
        'signatory_title_kz' => 'Должность подписанта (каз.)',
        'signatory_ru_gen' => 'Подписант в преамбуле (рус., «в лице …»)',
        'signatory_kz' => 'Подписант в преамбуле (каз.)',
        'signatory_short' => 'Подписант (инициалы и фамилия)',
        'bank' => 'Банк',
        'iik' => 'ИИК',
        'bik' => 'БИК',
        'legal_address_kz' => 'Юридический адрес (каз.)',
        'legal_address_ru' => 'Юридический адрес (рус.)',
        'phone' => 'Телефон',
        'visa_title_ru' => 'Виза: должность (рус.)',
        'visa_title_kz' => 'Виза: должность (каз.)',
        'visa_name' => 'Виза: инициалы и фамилия',
        'break_start' => 'Перерыв по умолчанию: начало (ЧЧ.ММ)',
        'break_end' => 'Перерыв по умолчанию: конец (ЧЧ.ММ)',
    ];

    /**
     * @return array<string, string>
     */
    public function all(): array
    {
        $stored = AppSetting::query()->where('key', self::KEY)->value('value');
        $stored = is_array($stored) ? $stored : [];

        $values = [];
        foreach (array_keys(self::FIELDS) as $field) {
            $values[$field] = trim((string) ($stored[$field] ?? ''));
        }

        return $values;
    }

    /**
     * @param  array<string, string|null>  $values
     */
    public function update(array $values): void
    {
        $current = $this->all();
        foreach (array_keys(self::FIELDS) as $field) {
            if (array_key_exists($field, $values)) {
                $current[$field] = trim((string) $values[$field]);
            }
        }

        AppSetting::query()->updateOrCreate(['key' => self::KEY], ['value' => $current]);
    }
}
