import { Head, Link } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import '../../../css/welcome.css';

const fallbackPoints = [
    { badge: '100', title: 'Кабинет 100', meta: '1 корпус • 1 этаж', kind: 'cabinet' },
    { badge: '101', title: 'Кабинет 101', meta: '2 корпус • 1 этаж', kind: 'cabinet' },
    { badge: '102', title: 'Кабинет 102', meta: '2 корпус • 1 этаж', kind: 'cabinet' },
    { badge: '103', title: 'Кабинет 103', meta: '2 корпус • 1 этаж', kind: 'cabinet' },
    { badge: '103/1', title: 'Кабинет 103/1', meta: '2 корпус • 1 этаж', kind: 'cabinet' },
    { badge: '104', title: 'Кабинет 104', meta: '2 корпус • 1 этаж', kind: 'cabinet' },
    { badge: '105', title: 'Кабинет 105', meta: '2 корпус • 1 этаж', kind: 'cabinet' },
    { badge: '106', title: 'Кабинет 106', meta: '2 корпус • 1 этаж', kind: 'cabinet' },
    { badge: '201', title: 'Кабинет 201', meta: '2 корпус • 2 этаж', kind: 'cabinet' },
    { badge: '202', title: 'Кабинет 202', meta: '2 корпус • 2 этаж', kind: 'cabinet' },
    { badge: '203', title: 'Кабинет 203', meta: '2 корпус • 2 этаж', kind: 'cabinet' },
    { badge: '204', title: 'Кабинет 204', meta: '2 корпус • 2 этаж', kind: 'cabinet' },
    { badge: 'IT', title: 'Деканат ИТ', meta: '1 корпус • 2 этаж', kind: 'department' },
    { badge: 'HR', title: 'Отдел кадров', meta: 'Главный корпус • 1 этаж', kind: 'department' },
    { badge: 'SM', title: 'Смагулова А.', meta: '2 корпус • 3 этаж', kind: 'staff', room: '315', floor: 3 },
    { badge: 'AK', title: 'Ахметов К.', meta: '1 корпус • 2 этаж', kind: 'staff', room: '214', floor: 2 },
];

const tabs = [
    { key: 'all', label: 'Все' },
    { key: 'cabinet', label: 'Кабинеты' },
    { key: 'staff', label: 'Сотрудники' },
    { key: 'department', label: 'Отделы' },
];

function getRouteSteps(item, routeMode) {
    const floorMatch = item.meta.match(/(\d+)\s*этаж/i);
    const floor = item.floor ?? (floorMatch ? Number(floorMatch[1]) : 1);
    const riseMethod = routeMode === 'elevator' ? 'Поднимитесь на лифте' : 'Поднимитесь по лестнице';
    const destination = getDestinationLabel(item);

    return [
        `Старт: киоск в холле (${item.meta.split('•')[0]?.trim() ?? 'корпус'}).`,
        'Пройдите прямо до центрального навигационного указателя.',
        `${riseMethod} на ${floor} этаж.`,
        `Двигайтесь по указателям до точки «${destination}».`,
        `Финиш: ${destination}.`,
    ];
}

function getDestinationLabel(item) {
    if ((item.kind === 'staff' || item.kind === 'cabinet') && item.room) {
        return `кабинет ${item.room}`;
    }

    return item.title;
}

function extractFloor(meta) {
    const floorMatch = meta.match(/(\d+)\s*этаж/i);
    return floorMatch ? Number(floorMatch[1]) : 1;
}

export default function Index() {
    const [points, setPoints] = useState(fallbackPoints);
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [selectedItem, setSelectedItem] = useState(null);

    useEffect(() => {
        let isMounted = true;

        fetch('/api/nav/routes?active=1', {
            headers: {
                Accept: 'application/json',
            },
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Не удалось получить маршруты');
                }

                return response.json();
            })
            .then((payload) => {
                if (!isMounted) {
                    return;
                }

                const data = Array.isArray(payload?.data) ? payload.data : [];
                if (data.length > 0) {
                    setPoints(data);
                }
            })
            .catch(() => {
                // Keep fallback routes when API is temporarily unavailable.
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const filteredPoints = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return points.filter((item) => {
            const tabOk = activeTab === 'all' || item.kind === activeTab;
            if (!tabOk) {
                return false;
            }

            if (normalizedQuery === '') {
                return true;
            }

            const haystack = `${item.title} ${item.meta} ${item.badge} ${item.room ?? ''} ${item.building ?? ''}`.toLowerCase();
            return haystack.includes(normalizedQuery);
        });
    }, [activeTab, query]);

    const routeSteps = selectedItem
        ? (Array.isArray(selectedItem.steps) && selectedItem.steps.length > 0
            ? selectedItem.steps
            : getRouteSteps(selectedItem, 'stairs'))
        : [];
    const selectedFloor = selectedItem ? (selectedItem.floor ?? extractFloor(selectedItem.meta)) : 1;

    const handleFind = () => {
        if (filteredPoints.length > 0) {
            setSelectedItem(filteredPoints[0]);
        }
    };

    return (
        <>
            <Head title="Заявка" />

            <div className="page nav-page">
                <div className="brand-blob" aria-hidden="true" />
                <div className="container">
                    <header className="topbar">
                        <div className="logo">
                            <div className="logo-badge">
                                <img src="/assets/images/logo.png" alt="KazUTB" />
                            </div>
                            <div className="logo-title">
                                <b>KazUTB</b>
                                <span>Заявка</span>
                            </div>
                        </div>
                        <div className="right-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                    className="btn btn-primary"
                                    type="button"
                                    style={{ padding: '8px 12px', fontSize: '14px', minWidth: 'auto' }}
                                >
                                    РУС
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    type="button"
                                    style={{ padding: '8px 12px', fontSize: '14px', minWidth: 'auto' }}
                                >
                                    ҚАЗ
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    type="button"
                                    style={{ padding: '8px 12px', fontSize: '14px', minWidth: 'auto' }}
                                >
                                    ENG
                                </button>
                            </div>
                            <Link className="btn btn-ghost" href="/">
                                На главную
                            </Link>
                        </div>
                    </header>

                    <main className="fr2 nav-template-main">
                        <section className="tiles-wrap">
                            <h1 className="page-title">Куда вам нужно?</h1>
                            <p className="subtitle">Введите номер кабинета, фамилию сотрудника или название отдела.</p>

                            <div className="searchRow">
                                <div className="search searchRowInput">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="7" />
                                        <path d="M21 21l-4.3-4.3" />
                                    </svg>
                                    <input
                                        placeholder="Например: 315 или Деканат ИТ"
                                        autoComplete="off"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                    />
                                </div>
                                <button className="btn btn-primary" type="button" onClick={handleFind}>
                                    Найти →
                                </button>
                            </div>

                            <div className="seg" role="tablist" aria-label="Фильтр">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.key}
                                        className={`chip ${activeTab === tab.key ? 'active' : ''}`}
                                        type="button"
                                        onClick={() => setActiveTab(tab.key)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="results" aria-label="Результаты поиска">
                                {filteredPoints.map((item) => (
                                    <div
                                        className={`result ${selectedItem?.title === item.title ? 'active' : ''}`}
                                        key={item.badge + item.title}
                                    >
                                        <div className="r-left">
                                            <div className="badge">{item.badge}</div>
                                            <div>
                                                <div className="r-title">{item.title}</div>
                                                <div className="r-meta">
                                                    {item.meta}
                                                    {(item.kind === 'staff' || item.kind === 'cabinet') && item.room ? ` • каб. ${item.room}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-primary"
                                            type="button"
                                            onClick={() => setSelectedItem(item)}
                                        >
                                            Показать →
                                        </button>
                                    </div>
                                ))}
                                {filteredPoints.length === 0 && (
                                    <div className="route-empty">Ничего не найдено. Уточните запрос.</div>
                                )}
                            </div>

                            <div className="hint">
                                <span>Подсказка: нажмите на результат → маршрут построится справа.</span>
                                <span>Опция: лифт/лестница учитывается в шагах.</span>
                            </div>
                        </section>

                        <section className="tiles-wrap">
                            <header className="routeHeader">
                                <div>
                                    <h1 className="page-title routeTitle">
                                        {selectedItem ? `Маршрут: ${selectedItem.title}` : 'Маршрут'}
                                    </h1>
                                    <div className="subtitle routeSubtitle">
                                        {selectedItem
                                            ? `${selectedItem.meta.split('•')[0]?.trim()} • Старт: Холл (вход) → Цель: ${getDestinationLabel(selectedItem)}`
                                            : 'Выберите кабинет/отдел — покажем путь от киоска до двери.'}
                                    </div>
                                </div>
                            </header>

                            <div className="routeBox">
                                <div className="steps">
                                    {!selectedItem && <div className="subtitle">Выберите слева кабинет.</div>}
                                    {selectedItem && (
                                        <>
                                            <div className="route-flow-card">
                                                <div className="route-step-index">1</div>
                                                <div>
                                                    <div className="route-flow-title">Следуйте по маршруту</div>
                                                    <div className="route-flow-subtitle">Маршрут задан вручную.</div>
                                                </div>
                                            </div>

                                            <div className="route-floor-card">
                                                <div className="route-floor-title">Этаж {selectedFloor} — до {getDestinationLabel(selectedItem)}</div>
                                                <span className="floor-chip">Эт. {selectedFloor}</span>
                                                <div className="route-map-preview" aria-hidden="true" />
                                            </div>

                                            <ol className="route-list sr-only">
                                                {routeSteps.map((step) => (
                                                    <li key={step}>{step}</li>
                                                ))}
                                            </ol>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="hint mb10">
                                <span>Киоск фиксирован: маршрут строится без QR и без сканирования.</span>
                                <span>Для телефонов можно добавить QR "забрать маршрут" (опционально).</span>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </>
    );
}