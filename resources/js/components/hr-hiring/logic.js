// Client-side twins of the server rules (App\Services\Hr\Iin, RussianInflector, HiringDocumentContext::missing)
// for instant feedback while typing. The server stays authoritative: it re-checks on save and on generation.

export const BLANK_FIELD_STEP_SETTINGS = 0;

const WEIGHTS_FIRST = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const WEIGHTS_SECOND = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

function iinCheckDigit(first11) {
    const digits = first11.split('').map(Number);
    const sum = (weights) => weights.reduce((acc, weight, i) => acc + weight * digits[i], 0);
    let check = sum(WEIGHTS_FIRST) % 11;
    if (check === 10) {
        check = sum(WEIGHTS_SECOND) % 11;
        if (check === 10) {
            return null;
        }
    }

    return check;
}

/** { valid, error, birthDate: 'YYYY-MM-DD', gender: 'm'|'f' } */
export function parseIin(value) {
    const iin = String(value ?? '').trim();
    if (!/^\d{12}$/.test(iin)) {
        const digits = iin.replace(/\D/g, '').length;
        return { valid: false, error: iin === '' ? '' : `Введено ${digits} из 12 цифр` };
    }
    const check = iinCheckDigit(iin.slice(0, 11));
    if (check === null || check !== Number(iin[11])) {
        return { valid: false, error: 'Контрольная цифра не сходится — проверьте ИИН' };
    }
    const centuryGender = Number(iin[6]);
    if (centuryGender < 1 || centuryGender > 6) {
        return { valid: false, error: '7-я цифра ИИН должна быть от 1 до 6' };
    }
    const century = { 1: 1800, 2: 1800, 3: 1900, 4: 1900, 5: 2000, 6: 2000 }[centuryGender];
    const year = century + Number(iin.slice(0, 2));
    const month = Number(iin.slice(2, 4));
    const day = Number(iin.slice(4, 6));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return { valid: false, error: 'В ИИН некорректная дата рождения' };
    }

    const pad = (n) => String(n).padStart(2, '0');
    return { valid: true, error: '', birthDate: `${year}-${pad(month)}-${pad(day)}`, gender: centuryGender % 2 === 1 ? 'm' : 'f' };
}

const CONSONANT = /[бвгджзклмнпрстфхцчшщ]$/;

function matchCase(source, lower) {
    if (source.length > 1 && source === source.toUpperCase()) {
        return lower.toUpperCase();
    }
    return source[0] === source[0].toUpperCase() ? lower[0].toUpperCase() + lower.slice(1) : lower;
}

function accusativeWord(word, gender, part) {
    const lower = word.toLowerCase();
    if (/(улы|ұлы|кызы|қызы)$/.test(lower)) {
        return word;
    }
    let result = lower;
    if (gender === 'm') {
        if (part === 'last') {
            if (/(ов|ев|ёв|ин|ын)$/.test(lower)) result = `${lower}а`;
            else if (/(ий|ой|ый)$/.test(lower)) result = `${lower.slice(0, -2)}ого`;
            else if (CONSONANT.test(lower)) result = `${lower}а`;
        } else if (part === 'middle') {
            if (/ич$/.test(lower)) result = `${lower}а`;
        } else if (/[йь]$/.test(lower)) result = `${lower.slice(0, -1)}я`;
        else if (/я$/.test(lower)) result = `${lower.slice(0, -1)}ю`;
        else if (/а$/.test(lower)) result = `${lower.slice(0, -1)}у`;
        else if (CONSONANT.test(lower)) result = `${lower}а`;
    } else {
        if (part === 'last') {
            if (/(ова|ева|ёва|ина|ына)$/.test(lower)) result = `${lower.slice(0, -1)}у`;
            else if (/ая$/.test(lower)) result = `${lower.slice(0, -2)}ую`;
        } else if (part === 'middle') {
            if (/на$/.test(lower)) result = `${lower.slice(0, -1)}у`;
        } else if (/я$/.test(lower)) result = `${lower.slice(0, -1)}ю`;
        else if (/а$/.test(lower)) result = `${lower.slice(0, -1)}у`;
    }

    return matchCase(word, result);
}

/** «Иванова Мария Петровна» → «Иванову Марию Петровну» (same rules as the server). */
export function fullNameAccusative(last, first, middle, gender) {
    const parts = [['last', last], ['first', first], ['middle', middle]]
        .map(([part, value]) => [part, String(value ?? '').trim()])
        .filter(([, value]) => value !== '');
    if (gender !== 'm' && gender !== 'f') {
        return parts.map(([, value]) => value).join(' ');
    }

    return parts
        .map(([part, value]) => value.split('-').map((piece) => accusativeWord(piece, gender, part)).join('-'))
        .join(' ');
}

const filled = (value) => String(value ?? '').trim() !== '';
const isTime = (value) => /^\s*\d{1,2}[.:]\d{2}\s*$/.test(String(value ?? ''));

/**
 * Missing fields of a document, the way HiringDocumentContext::missing() sees them (employer settings come
 * from the server checks). Returns [{ field, label, step }].
 */
export function missingFields(state, type, { hasPhoto = false } = {}) {
    const { employee: e, hiring: h, contract: c } = state;
    const isContract = type === 'contract';
    const isOrder = type === 'order';
    const isCard = type === 'card';
    const usesForms = isContract || isOrder;
    const hasSub = filled(h.sub_unit?.name_ru);
    const replacement = c.term === 'replacement';

    const checks = [
        [true, 'employee.last_name', 'Фамилия', 1, filled(e.last_name)],
        [true, 'employee.first_name', 'Имя', 1, filled(e.first_name)],
        [isContract || isCard, 'employee.birth_date', 'Дата рождения', 1, filled(e.birth_date)],
        [isCard || (isOrder && !h.fio_accusative_manual), 'employee.gender', 'Пол', 1, filled(e.gender)],
        [isContract || isCard, 'employee.iin', 'ИИН', 1, parseIin(e.iin).valid],
        [isContract && e.citizenship === 'other', 'employee.citizenship', 'Гражданство', 1, filled(e.citizenship_ru) && filled(e.citizenship_kz)],
        [isCard, 'employee.photo', 'Фото', 1, hasPhoto],
        [isContract || isCard, 'employee.id_card_number', '№ удостоверения', 1, filled(e.id_card_number)],
        [isContract || isCard, 'employee.id_card_issued_at', 'Дата выдачи удостоверения', 1, filled(e.id_card_issued_at)],
        [isContract || isCard, 'employee.address', 'Адрес', 1, filled(e.city) && filled(e.street) && filled(e.house)],
        [isContract, 'employee.phone', 'Телефон', 1, filled(e.phone)],
        [isCard, 'employee.marital_status', 'Семейное положение', 1, filled(e.marital_status)],
        [isCard, 'employee.educations', 'Образование', 1, (e.educations ?? []).some((row) => filled(row.level) && filled(row.institution))],
        [isCard, 'employee.military_status', 'Воинский учёт', 1, filled(e.military_status)],

        [true, 'hiring.top_unit', 'Департамент, управление, факультет', 2, filled(h.top_unit?.name_ru)],
        [true, 'hiring.position', 'Должность', 2, filled(h.position?.name_ru)],
        [usesForms, 'hiring.top_unit_name_ru_gen', 'Подразделение: родительный падеж (рус.)', 2, filled(h.top_unit?.name_ru_gen)],
        [usesForms, 'hiring.top_unit_name_kz_gen', 'Подразделение: форма на казахском', 2, filled(h.top_unit?.name_kz_gen)],
        [usesForms && hasSub, 'hiring.sub_unit_name_ru_gen', 'Отдел, кафедра: родительный падеж (рус.)', 2, filled(h.sub_unit?.name_ru_gen)],
        [usesForms && hasSub, 'hiring.sub_unit_name_kz_gen', 'Отдел, кафедра: форма на казахском', 2, filled(h.sub_unit?.name_kz_gen)],
        [usesForms, 'hiring.position_name_ru_gen', 'Должность: родительный падеж (рус.)', 2, filled(h.position?.name_ru_gen)],
        [usesForms, 'hiring.position_name_kz_poss', 'Должность: форма на казахском', 2, filled(h.position?.name_kz_poss)],
        [true, 'hiring.start_date', 'Дата приёма', 2, filled(h.start_date)],
        [usesForms && replacement, 'hiring.replaces', 'Замещаемый работник', 2, filled(h.replaces?.full_name)],
        [isOrder, 'hiring.order_number', '№ приказа', 2, filled(h.order_number)],
        [isOrder, 'hiring.order_date', 'Дата приказа', 2, filled(h.order_date)],

        [usesForms, 'contract.number', '№ договора', 3, filled(c.number)],
        [usesForms, 'contract.date', 'Дата договора', 3, filled(c.date)],
        [usesForms, 'contract.term', 'Срок договора', 3, filled(c.term)],
        [usesForms, 'contract.salary', 'Оклад', 3, Number(c.salary) > 0],
        [isContract, 'contract.vacation_days', 'Дни отпуска', 3, Number(c.vacation_days) > 0],
        [isContract && c.schedule !== 'shift', 'contract.break', 'Перерыв для отдыха и питания', 3, isTime(c.break_start) && isTime(c.break_end)],
    ];

    return checks
        .filter(([applies, , , , ok]) => applies && !ok)
        .map(([, field, label, step]) => ({ field, label, step }));
}

/** DOM id of the input a missing field leads to. */
export function fieldElementId(field) {
    const aliases = {
        'employee.address': 'employee.street',
        'employee.photo': 'employee.photo',
        'employee.citizenship': 'employee.citizenship_ru',
        'hiring.top_unit_name_ru_gen': 'hiring.top_unit.name_ru_gen',
        'hiring.top_unit_name_kz_gen': 'hiring.top_unit.name_kz_gen',
        'hiring.sub_unit_name_ru_gen': 'hiring.sub_unit.name_ru_gen',
        'hiring.sub_unit_name_kz_gen': 'hiring.sub_unit.name_kz_gen',
        'hiring.position_name_ru_gen': 'hiring.position.name_ru_gen',
        'hiring.position_name_kz_poss': 'hiring.position.name_kz_poss',
        'contract.break': 'contract.break_start',
    };

    return `f-${(aliases[field] ?? field).replace(/\./g, '-')}`;
}

export const fieldId = (path) => `f-${path.replace(/\./g, '-')}`;

/** Full position as printed in the documents (RU genitive / KZ). */
export function positionFull(hiring) {
    const position = hiring.position ?? {};
    if (!filled(position.name_ru)) {
        return { ru: '', kz: '' };
    }
    const blank = '__________';
    const form = (value) => (filled(value) ? value.trim() : blank);
    const hasSub = filled(hiring.sub_unit?.name_ru);
    const hasTop = filled(hiring.top_unit?.name_ru);

    const ru = [form(position.name_ru_gen)];
    const kz = [];
    if (hasSub) ru.push(form(hiring.sub_unit.name_ru_gen));
    if (hasTop) {
        ru.push(form(hiring.top_unit.name_ru_gen));
        kz.push(form(hiring.top_unit.name_kz_gen));
    }
    if (hasSub) kz.push(form(hiring.sub_unit.name_kz_gen));
    kz.push(form(position.name_kz_poss));

    return { ru: ru.join(' '), kz: kz.join(' ') };
}

export const formatMoney = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits === '' ? '' : digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const DOCUMENT_TYPES = [
    { value: 'contract', label: 'Трудовой договор', short: 'Договор' },
    { value: 'order', label: 'Приказ о приёме', short: 'Приказ' },
    { value: 'card', label: 'Личная карточка', short: 'Личная карточка' },
];
