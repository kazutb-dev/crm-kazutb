<?php

// Builds resources/hr/templates/card.docx — the employee's personal card (личная карточка), Russian only:
//   php scripts/hr/build_card_template.php [out.docx]
// The HR department can replace it with its own layout in the module settings (same tags).

require dirname(__DIR__, 2).'/vendor/autoload.php';

use PhpOffice\PhpWord\Element\Section;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\SimpleType\Jc;
use PhpOffice\PhpWord\Style\Tab;

$dst = $argv[1] ?? dirname(__DIR__, 2).'/resources/hr/templates/card.docx';

$word = new PhpWord;
$word->setDefaultFontName('Times New Roman');
$word->setDefaultFontSize(11);

$section = $word->addSection([
    'paperSize' => 'A4',
    'marginTop' => 1000,
    'marginBottom' => 1000,
    'marginLeft' => 1418,
    'marginRight' => 851,
]);

$width = 9600;
$grid = ['borderSize' => 6, 'borderColor' => '000000', 'cellMargin' => 60];
$tight = ['spaceAfter' => 0];

// Header: employer and HR office on the left, photo 3×4 on the right.
$head = $section->addTable(['borderSize' => 0, 'borderColor' => 'FFFFFF']);
$head->addRow(2300);
$left = $head->addCell($width - 1900, ['valign' => 'center']);
$left->addText('АО «Казахский университет технологии и бизнеса имени К. Кулажанова»', ['bold' => true], ['alignment' => Jc::CENTER] + $tight);
$left->addText('Отдел управления персоналом', [], ['alignment' => Jc::CENTER] + $tight);
$photo = $head->addCell(1900, ['borderSize' => 6, 'borderColor' => '000000', 'valign' => 'center']);
$photo->addText('${photo}', ['size' => 9], ['alignment' => Jc::CENTER] + $tight);

$section->addText('');
$section->addText('ЛИЧНАЯ КАРТОЧКА РАБОТНИКА', ['bold' => true, 'size' => 14], ['alignment' => Jc::CENTER] + $tight);
$section->addText('Дата заполнения: ${fill_date}', [], ['alignment' => Jc::CENTER]);

$heading = static fn (Section $s, string $text) => $s->addText($text, ['bold' => true], ['spaceBefore' => 160, 'spaceAfter' => 60, 'keepNext' => true]);

$keyValue = static function (Section $s, array $rows) use ($grid, $width, $tight): void {
    $table = $s->addTable($grid);
    foreach ($rows as [$label, $tag]) {
        $table->addRow();
        $table->addCell(3600)->addText($label, [], $tight);
        $table->addCell($width - 3600)->addText('${'.$tag.'}', [], $tight);
    }
};

$listTable = static function (Section $s, array $columns, string $emptyText, string $block) use ($grid, $tight): void {
    $s->addText('${if_has_'.$block.'}', [], $tight);
    $table = $s->addTable($grid);
    $table->addRow();
    foreach ($columns as [$title, , $cellWidth]) {
        $table->addCell($cellWidth, ['bgColor' => 'EDEDED'])->addText($title, ['bold' => true], $tight);
    }
    $table->addRow();
    foreach ($columns as [, $tag, $cellWidth]) {
        $table->addCell($cellWidth)->addText('${'.$tag.'}', [], $tight);
    }
    $s->addText('${/if_has_'.$block.'}', [], $tight);
    $s->addText('${if_no_'.$block.'}', [], $tight);
    $s->addText($emptyText, [], $tight);
    $s->addText('${/if_no_'.$block.'}', [], $tight);
};

$heading($section, '1. Общие сведения');
$keyValue($section, [
    ['Фамилия', 'last_name'],
    ['Имя', 'first_name'],
    ['Отчество', 'middle_name'],
    ['Дата рождения', 'birth_date'],
    ['Пол', 'gender_label'],
    ['ИИН', 'iin'],
    ['Гражданство', 'citizenship_label'],
    ['Семейное положение', 'marital_label'],
]);

$heading($section, '2. Документ, удостоверяющий личность');
$keyValue($section, [
    ['Вид документа', 'id_doc_kind'],
    ['Номер', 'id_num'],
    ['Дата выдачи', 'id_date'],
    ['Кем выдан', 'id_issuer_label'],
]);

$heading($section, '3. Адрес проживания и контакты');
$keyValue($section, [
    ['Адрес', 'address_line'],
    ['Телефон', 'phone'],
]);

$heading($section, '4. Образование');
$listTable($section, [
    ['Уровень', 'edu_level', 1800],
    ['Учебное заведение', 'edu_institution', 3000],
    ['Год окончания', 'edu_year', 1100],
    ['Специальность', 'edu_specialty', 2200],
    ['Диплом №', 'edu_diploma', 1500],
], 'Сведения не указаны', 'edu');

$heading($section, '5. Дети');
$listTable($section, [
    ['ФИО', 'child_name', 6600],
    ['Дата рождения', 'child_birth', 3000],
], 'Нет', 'children');

$heading($section, '6. Воинский учёт и социальный статус');
$keyValue($section, [
    ['Воинский учёт', 'military_label'],
    ['Пенсионер', 'pensioner_label'],
    ['Инвалидность', 'disability_label'],
    ['Обучающийся', 'student_label'],
    ['Многодетная семья', 'large_family_label'],
]);

$heading($section, '7. Приём на работу');
$keyValue($section, [
    ['Дата приёма', 'start_date_short'],
    ['Категория', 'category_label'],
    ['Департамент, управление, факультет', 'top_unit_name'],
    ['Отдел, кафедра', 'sub_unit_name'],
    ['Должность', 'position_name'],
    ['Испытательный срок', 'probation_label'],
    ['На время замещения', 'replacement_label'],
    ['Приказ', 'order_label'],
    ['Трудовой договор', 'contract_label'],
    ['Вид работы', 'employment_label'],
]);

$heading($section, '8. Прилагаемые документы');
$listTable($section, [
    ['№', 'att_no', 700],
    ['Вид документа', 'att_type', 3400],
    ['Файл', 'att_name', 5500],
], 'Документы не прикреплены', 'attachments');

$section->addText('');
$section->addText('');
$section->addText("Работник ____________ \${fio_short}\tСпециалист ОУП ____________", [], ['tabs' => [new Tab('right', $width)]]);

IOFactory::createWriter($word, 'Word2007')->save($dst);
echo "template written: $dst\n";
