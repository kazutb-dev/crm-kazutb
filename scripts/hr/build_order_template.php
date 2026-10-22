<?php

// Builds resources/hr/templates/order.docx — the hiring order (no HR sample yet, so this is a draft layout
// that the HR department can replace with its own file in the module settings):
//   php scripts/hr/build_order_template.php [out.docx]
// Two columns KZ | RU, Times New Roman 12. The Kazakh wording is a draft — проверить в ОУП.

require dirname(__DIR__, 2).'/vendor/autoload.php';

use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\SimpleType\Jc;
use PhpOffice\PhpWord\Style\Tab;

$dst = $argv[1] ?? dirname(__DIR__, 2).'/resources/hr/templates/order.docx';

$word = new PhpWord;
$word->setDefaultFontName('Times New Roman');
$word->setDefaultFontSize(12);

$section = $word->addSection([
    'paperSize' => 'A4',
    'marginTop' => 1134,
    'marginBottom' => 1134,
    'marginLeft' => 1418,
    'marginRight' => 851,
]);

$columnWidth = 4800;
$table = $section->addTable(['borderSize' => 0, 'borderColor' => 'FFFFFF', 'cellMargin' => 80]);
$table->addRow();

$columns = [
    'kz' => [
        ['c', true, '«Қ. Құлажанов атындағы Қазақ технология және бизнес университеті» акционерлік қоғамы'],
        ['c', false, ''],
        ['c', true, 'БҰЙРЫҚ'],
        ['c', false, ''],
        ['tab', false, '${order_date_kz}', '№${order_num}'],
        ['c', false, 'Астана қ.'],
        ['c', false, ''],
        ['l', true, 'Жұмысқа қабылдау туралы'],
        ['c', false, ''],
        ['j', false, 'Қазақстан Республикасы Еңбек кодексінің 33-бабына сәйкес БҰЙЫРАМЫН:'],
        ['j', false, '1. ${fio} ${start_kz_from} бастап ${position_full_kz} лауазымына ${ord_term_kz}${ord_prob_kz}, штаттық кестеге сәйкес ${salary} (${salary_kz}) теңге лауазымдық жалақымен ${ord_kind_kz} жұмысқа қабылдансын.'],
        ['j', false, '2. Персоналды басқару бөлімі Жұмыскерді лауазымдық нұсқаулықпен және Ішкі еңбек тәртібі қағидаларымен таныстырсын.'],
        ['c', false, ''],
        ['j', false, 'Негіздеме: Жұмыскердің өтініші, ${contract_date_short} ж. №${num} еңбек шарты.'],
        ['c', false, ''],
        ['c', false, ''],
        ['tab', true, '${emp_signatory_title_kz}', '${emp_signatory_short}'],
        ['c', false, ''],
        ['c', false, ''],
        ['l', false, 'Бұйрықпен таныстым:'],
        ['l', false, '____________ ${fio_short}'],
        ['l', false, '«___» ____________ 20__ ж.'],
    ],
    'ru' => [
        ['c', true, 'Акционерное общество «Казахский университет технологии и бизнеса имени К. Кулажанова»'],
        ['c', false, ''],
        ['c', true, 'ПРИКАЗ'],
        ['c', false, ''],
        ['tab', false, '${order_date_ru}', '№${order_num}'],
        ['c', false, 'г. Астана'],
        ['c', false, ''],
        ['l', true, 'О приеме на работу'],
        ['c', false, ''],
        ['j', false, 'В соответствии со статьей 33 Трудового кодекса Республики Казахстан ПРИКАЗЫВАЮ:'],
        ['j', false, '1. Принять ${fio_acc} на должность ${position_full_ru} с ${start_ru} года ${ord_term_ru}${ord_prob_ru}, с должностным окладом согласно штатному расписанию ${salary} (${salary_ru}) тенге, ${ord_kind_ru}.'],
        ['j', false, '2. Отделу управления персоналом ознакомить Работника с должностной инструкцией и Правилами внутреннего трудового распорядка.'],
        ['c', false, ''],
        ['j', false, 'Основание: заявление Работника, трудовой договор №${num} от ${contract_date_short} г.'],
        ['c', false, ''],
        ['c', false, ''],
        ['tab', true, '${emp_signatory_title_ru}', '${emp_signatory_short}'],
        ['c', false, ''],
        ['c', false, ''],
        ['l', false, 'С приказом ознакомлен(а):'],
        ['l', false, '____________ ${fio_short}'],
        ['l', false, '«___» ____________ 20__ г.'],
    ],
];

$align = ['c' => Jc::CENTER, 'l' => Jc::START, 'j' => Jc::BOTH];
foreach ($columns as $lines) {
    $cell = $table->addCell($columnWidth);
    foreach ($lines as $line) {
        [$kind, $bold] = $line;
        $font = ['bold' => $bold];
        if ($kind === 'tab') {
            $cell->addText($line[2]."\t".$line[3], $font, ['tabs' => [new Tab('right', $columnWidth - 200)], 'spaceAfter' => 0]);

            continue;
        }
        $cell->addText($line[2], $font + ($line[2] === 'БҰЙРЫҚ' || $line[2] === 'ПРИКАЗ' ? ['size' => 14] : []), ['alignment' => $align[$kind], 'spaceAfter' => 0]);
    }
}

IOFactory::createWriter($word, 'Word2007')->save($dst);
echo "template written: $dst\n";
