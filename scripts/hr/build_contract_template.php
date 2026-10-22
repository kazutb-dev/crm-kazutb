<?php

// Builds resources/hr/templates/contract.docx from the HR sample contract:
//   php scripts/hr/build_contract_template.php [docs/hr-module/Образец ТД.docx] [resources/hr/templates/contract.docx]
// ${tags} replace the blanks, ${if_x}…${/if_x} blocks wrap whole-paragraph variants, the OUP notes after the
// table are dropped. Untouched runs keep their formatting byte for byte; tag runs lose the fill-in highlight.
// Paragraph numbers refer to the sample (see DocxEditor); the script fails loudly if the sample text differs.
// Prints the places that stay highlighted but did not become tags, for the HR department to review.

require __DIR__.'/DocxEditor.php';

$root = dirname(__DIR__, 2);
$src = $argv[1] ?? $root.'/docs/hr-module/Образец ТД.docx';
$dst = $argv[2] ?? $root.'/resources/hr/templates/contract.docx';
$zip = new ZipArchive;
$zip->open($src);
$e = new DocxEditor($zip->getFromName('word/document.xml'));
$zip->close();

// ---------------- KZ column ----------------
$e->replace(1, '№_______', '№${num} ');
$e->replace(3, '«__» _________ 202__ ж.', '${contract_date_kz}');

$e->replace(5, '/Жарғы және 08\.07\.2025 жылғы\s+№188-25-К Бұйрық/', '${emp_basis_kz}')
    ->replace(5, '/ететін\s+/', 'ететін ')
    ->replace(5, 'Президент Е.Т. Кулажанов', '${emp_signatory_kz}')
    ->replace(5, 'БИН 030240001575', 'БИН ${emp_bin}')
    ->replace(5, '_______________________', '${fio}')
    ->replace(5, '______ жылы туған', '${birth_date} жылы туған')
    ->replace(5, 'Қазақстан Республикасының азаматы', '${citizen_kz}')
    ->replace(5, '№__________', '№${id_num}')
    ->replace(5, 'ҚР ІІМ', '${id_issuer_kz}')
    ->replace(5, '________жылы берген', '${id_date} жылы берген')
    ->replace(5, 'ЖСН _____________', 'ЖСН ${iin}');

$e->replace(10, '_______________', '${position_full_kz}');
$e->replace(15, '202_ жылғы «__» _________', '${start_kz}');

$e->blockAfter(17, 17, 'if_sovm', '${clause_1_7_sovm_kz}')->block('if_main', 17, 17);

$e->replace(23, 'Осы шарт бір жылға жасалды.', '${term_kz}');
$e->replace(24, '202_ жылғы __ _________', '${start_kz}');
$e->replace(25, '202_ жылғы __ _________', '${end_kz}')->block('if_has_end', 25, 25);

$e->replace(27, '/үш ай\s+сынақ мерзімі белгіленді\.\s+\(жазбаша\)/', '${prob_kz} сынақ мерзімі белгіленді.');
$e->replace(29, '202_ жылғы __ _________', '${start_kz}');
$e->replace(30, '202_ жылғы __ _________', '${prob_end_kz}');
$e->block('if_prob', 27, 37);

$e->blockAfter(44, 44, 'if_sched_aup', '${clause_3_1_2_aup_kz}')->block('if_sched_pps', 44, 44);
$e->blockAfter(45, 42, 'if_sched_shift', '${clause_3_1_shift_kz}');
$e->block('if_week', 42, 43)->block('if_week', 45, 45);

$e->replace(47, '56 (елу алты)', '${vac_days} (${vac_days_kz})');
$e->replace(53, '100 000 (жүз мың) теңге', '${salary} (${salary_kz}) теңге');

// Section 11, KZ requisites
$e->replace(243, '030240001575', '${emp_bin}')->replace(243, '«ФРИДОМ БАНК КАЗАХСТАН» АҚ', '${emp_bank}');
$e->replace(245, 'KZ68551Z227008936KZT', '${emp_iik}');
$e->replace(246, 'KSNVKZKA', '${emp_bik}');
$e->replace(247, 'Астана қ.', '${emp_address}')->delete(248);
$e->replace(250, '8(7172) 72-58-12', '${emp_phone}');
$e->setText(255, '${emp_signatory_title_kz}');
$e->replace(257, 'Е. Кулажанов', '${emp_signatory_short}');
$e->setText(260, '${visa_title_kz}')->delete(261);
$e->replace(262, 'А. Қуат', '${visa_name}');
$e->setText(267, '${fio}');
$e->replace(270, '_____', '${addr_city}');
$e->replace(271, '_________', '${addr_street}')->replace(271, '____ үй', '${addr_house} үй${addr_apt_kz}');
$e->replace(273, '___________', '${phone}');
$e->setText(280, '${oup_executor}');

// ---------------- RU column ----------------
$e->replace(297, '№_______', '№${num}');
$e->replace(299, '«__» _______ 202_ г.', '${contract_date_ru}');

$e->replace(301, 'Президента Е. Т. Кулажанова', '${emp_signatory_ru_gen}')
    ->replace(301, 'Устава и Приказа № 188-25-К от 08.07.2025 г.', '${emp_basis_ru}')
    ->replace(301, 'БИН 030240001575', 'БИН ${emp_bin}')
    ->replace(301, '__________________', '${fio}')
    ->replace(301, '__________ года рождения', '${birth_date} года рождения')
    ->replace(301, 'гражданин (ка) Республики Казахстан', '${citizen_ru}')
    ->replace(301, '№_________', '№${id_num}')
    ->replace(301, 'МВД РК от _______ года', '${id_issuer_ru} от ${id_date} года')
    ->replace(301, 'ИИН __________', 'ИИН ${iin}');

$e->replace(305, '_____________________________________', '${position_full_ru}');
$e->replace(311, '«__» _________ 202_ года.', '${start_ru} года.');

$e->blockAfter(313, 313, 'if_sovm', '${clause_1_7_sovm_ru}')->block('if_main', 313, 313);

$e->replace(321, 'Настоящий договор заключен на один год', '${term_ru}');
$e->replace(322, '__ _________ 202_', '${start_ru}');
$e->replace(323, '__ ________ 202_ года.', '${end_ru}')->block('if_has_end', 323, 323);

$e->replace(326, 'три  месяца', '${prob_ru}');
$e->delete(327); // «(прописью)»
$e->replace(328, '__ _________ 202_', '${start_ru}');
$e->replace(329, '__ _________ 202_', '${prob_end_ru}');
$e->block('if_prob', 326, 335);

$e->blockAfter(342, 342, 'if_sched_aup', '${clause_3_1_2_aup_ru}')->block('if_sched_pps', 342, 342);
$e->blockAfter(343, 340, 'if_sched_shift', '${clause_3_1_shift_ru}');
$e->block('if_week', 340, 341)->block('if_week', 343, 343);

$e->replace(345, '/продолжительностью\s+/', 'продолжительностью ')
    ->replace(345, '56 (пятьдесят шесть)', '${vac_days} (${vac_days_ru})');
$e->replace(355, '100 000 (сто тысяч) тенге', '${salary} (${salary_ru}) тенге');

// Section 11, RU column (the sample keeps the employer block in Kazakh here too)
$e->replace(541, '030240001575', '${emp_bin}')->replace(541, '«ФРИДОМ БАНК КАЗАХСТАН» АҚ', '${emp_bank}');
$e->replace(543, 'KZ68551Z227008936KZT', '${emp_iik}');
$e->replace(544, 'KSNVKZKA', '${emp_bik}');
$e->replace(545, 'Астана қ.', '${emp_address}')->delete(546);
$e->replace(548, '8(7172) 72-58-12', '${emp_phone}');
$e->setText(552, '${emp_signatory_title_ru}');
$e->replace(554, 'Е. Кулажанов', '${emp_signatory_short}');
$e->setText(557, '${visa_title_ru}')->delete(558);
$e->replace(559, 'А. Қуат', '${visa_name}');
$e->setText(564, '${fio}');
$e->replace(567, '_____', '${addr_city}');
$e->replace(568, '__________', '${addr_street}')->replace(568, '___, кв.20.', '${addr_house}${addr_apt_ru}.');
$e->replace(570, '____________', '${phone}');
$e->replace(576, 'М.Р. Тасполтаева', '${oup_executor}');

// ---------------- OUP notes after the table ----------------
$e->delete(...range(590, 601));

$e->stripMacroHighlight();

copy($src, $dst);
$out = new ZipArchive;
$out->open($dst);
$out->addFromString('word/document.xml', $e->xml());
$out->close();
echo "template written: $dst\n\nStill highlighted, not tags:\n";

foreach ($e->highlightReport() as [$column, $text, $fragments]) {
    $excerpt = mb_strlen($text) > 110 ? mb_substr($text, 0, 107).'…' : $text;
    printf("[%s] «%s»\n    маркер: %s\n", $column, $excerpt, implode(' | ', array_map(fn ($f) => '«'.$f.'»', $fragments)));
}
