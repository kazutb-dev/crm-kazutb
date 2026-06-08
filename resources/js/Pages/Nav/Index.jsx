import { Head, Link } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';
import '../../../css/welcome.css';

const SEARCH_HISTORY_KEY = 'nav.search.history';

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

function extractBuilding(item) {
    if (item.building) {
        return String(item.building);
    }

    return String(item.meta?.split('•')?.[0]?.trim() ?? 'Не указан');
}

function getItemSearchText(item) {
    const attachedUsersText = Array.isArray(item.attached_users)
        ? item.attached_users
            .map((user) => `${user.name ?? ''} ${user.ad_login ?? ''}`)
            .join(' ')
        : '';

    return `${item.title} ${item.meta} ${item.badge} ${item.room ?? ''} ${item.building ?? ''} ${attachedUsersText}`.toLowerCase();
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatch(text, query) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || !text) {
        return text;
    }

    const pattern = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'ig');
    const parts = String(text).split(pattern);

    return parts.map((part, index) => {
        if (part.toLowerCase() === normalizedQuery.toLowerCase()) {
            return (
                <mark
                    key={`match-${index}`}
                    className="bg-[#E8A020]/80 px-0.5 text-[#0f243f]"
                >
                    {part}
                </mark>
            );
        }

        return <span key={`text-${index}`}>{part}</span>;
    });
}

function normalizePolyline(polyline) {
    if (!Array.isArray(polyline)) {
        return [];
    }

    return polyline
        .map((point) => ({
            x: Number(point?.x),
            y: Number(point?.y),
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .filter((point) => point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100);
}

function buildSmoothPath(points) {
    if (!Array.isArray(points) || points.length === 0) {
        return '';
    }

    if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y}`;
    }

    if (points.length === 2) {
        return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    const pathParts = [`M ${points[0].x} ${points[0].y}`];

    for (let index = 1; index < points.length - 1; index += 1) {
        const current = points[index];
        const next = points[index + 1];
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;
        pathParts.push(`Q ${current.x} ${current.y}, ${midX} ${midY}`);
    }

    const lastIndex = points.length - 1;
    pathParts.push(`Q ${points[lastIndex - 1].x} ${points[lastIndex - 1].y}, ${points[lastIndex].x} ${points[lastIndex].y}`);

    return pathParts.join(' ');
}

function Index() {
    const [points, setPoints] = useState(fallbackPoints);
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedBuilding, setSelectedBuilding] = useState('all');
    const [selectedFloor, setSelectedFloor] = useState('all');
    const [onlyCabinets, setOnlyCabinets] = useState(false);
    const [searchHistory, setSearchHistory] = useState([]);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);

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

    useEffect(() => {
        try {
            const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
            if (!raw) {
                return;
            }

            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setSearchHistory(parsed.filter((entry) => typeof entry === 'string').slice(0, 8));
            }
        } catch {
            // Ignore history parsing errors.
        }
    }, []);

    const saveHistory = (nextHistory) => {
        setSearchHistory(nextHistory);
        try {
            localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory));
        } catch {
            // Ignore storage write failures.
        }
    };

    const rememberSearch = (value) => {
        const normalized = value.trim();
        if (!normalized) {
            return;
        }

        const nextHistory = [
            normalized,
            ...searchHistory.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase()),
        ].slice(0, 8);
        saveHistory(nextHistory);
    };

    const buildings = useMemo(() => {
        const values = Array.from(new Set(points.map((item) => extractBuilding(item))));
        return values.sort((a, b) => a.localeCompare(b, 'ru'));
    }, [points]);

    const floors = useMemo(() => {
        const values = Array.from(new Set(points.map((item) => String(item.floor ?? extractFloor(item.meta)))));
        return values.sort((a, b) => Number(a) - Number(b));
    }, [points]);

    const suggestions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        if (normalizedQuery.length < 1) {
            return searchHistory.slice(0, 5).map((entry) => ({ type: 'history', value: entry }));
        }

        const pointSuggestions = points
            .filter((item) => getItemSearchText(item).includes(normalizedQuery))
            .slice(0, 6)
            .map((item) => ({
                type: 'point',
                value: item.title,
                item,
            }));

        const historySuggestions = searchHistory
            .filter((entry) => entry.toLowerCase().includes(normalizedQuery))
            .slice(0, 3)
            .map((entry) => ({ type: 'history', value: entry }));

        return [...pointSuggestions, ...historySuggestions].slice(0, 8);
    }, [points, query, searchHistory]);

    const filteredPoints = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return points.filter((item) => {
            const tabOk = activeTab === 'all' || item.kind === activeTab;
            if (!tabOk) {
                return false;
            }

            const buildingOk = selectedBuilding === 'all' || extractBuilding(item) === selectedBuilding;
            if (!buildingOk) {
                return false;
            }

            const floorOk = selectedFloor === 'all' || String(item.floor ?? extractFloor(item.meta)) === selectedFloor;
            if (!floorOk) {
                return false;
            }

            if (onlyCabinets && item.kind !== 'cabinet') {
                return false;
            }

            if (normalizedQuery === '') {
                return true;
            }

            return getItemSearchText(item).includes(normalizedQuery);
        });
    }, [activeTab, onlyCabinets, points, query, selectedBuilding, selectedFloor]);

    const routeSteps = selectedItem
        ? (Array.isArray(selectedItem.steps) && selectedItem.steps.length > 0
            ? selectedItem.steps
            : getRouteSteps(selectedItem, 'stairs'))
        : [];
    const selectedRouteFloor = selectedItem ? (selectedItem.floor ?? extractFloor(selectedItem.meta)) : 1;
    const selectedPolyline = selectedItem ? normalizePolyline(selectedItem.map_polyline) : [];
    const selectedMapImage = selectedItem?.map_image_url || selectedItem?.map_image_path || null;
    const svgPath = buildSmoothPath(selectedPolyline);
    const startPoint = selectedPolyline.length > 0 ? selectedPolyline[0] : null;
    const finishPoint = selectedPolyline.length > 1 ? selectedPolyline[selectedPolyline.length - 1] : null;
    const selectedBuildingLabel = selectedItem ? extractBuilding(selectedItem) : null;

    const handleFind = () => {
        rememberSearch(query);
        if (filteredPoints.length > 0) {
            setSelectedItem(filteredPoints[0]);
        }
        setSuggestionsOpen(false);
    };

    const applySuggestion = (value) => {
        setQuery(value);
        rememberSearch(value);
        setSuggestionsOpen(false);
    };

    const headingFont = { fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' };

    return (
        <>
            <Head title="Навигация по кампусу · КазУТБ">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Manrope:wght@400..800&display=swap" rel="stylesheet" />
            </Head>

            <main className="relative min-h-screen overflow-hidden p-3 font-['Manrope'] sm:p-4 lg:p-6">

                <section className="relative z-10 mx-auto w-full max-w-[1280px] overflow-hidden rounded-2xl bg-[#0f243f]/55 px-4 py-6 text-white ring-1 ring-white/15 shadow-[0_28px_90px_rgba(0,0,0,.42),inset_0_0_0_1px_rgba(232,160,32,.22)] sm:px-6 lg:px-8 lg:py-8">
                    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <div className="max-w-3xl">
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#E8A020]/75">Навигация</p>
                            <h1 style={headingFont} className="text-xl font-extrabold leading-tight sm:text-2xl">Поиск кабинетов и маршрутов</h1>
                            <p className="mt-1 text-sm text-white/65">Быстрый поиск кабинетов, сотрудников и отделов в едином маршрутизаторе кампуса.</p>
                        </div>

                        <Link
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/8 px-4 text-xs font-semibold text-white/80 transition hover:bg-white/14 hover:text-white"
                            href="/"
                        >
                            Главная
                        </Link>
                    </header>

                    <main className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <section className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[0_16px_38px_rgba(0,0,0,.24)] backdrop-blur-md sm:p-5">
                            <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-[#E8A020]">Поиск</p>
                            <p className="mb-4 text-sm text-white/70">Введите номер кабинета, фамилию сотрудника или название отдела.</p>

                            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <div className="rounded-xl border border-white/12 bg-[#102845]/78 px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/42">Найдено</div>
                                    <div className="mt-1 text-2xl font-bold text-white">{filteredPoints.length}</div>
                                </div>
                                <div className="rounded-xl border border-white/12 bg-[#102845]/78 px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/42">Корпусов</div>
                                    <div className="mt-1 text-2xl font-bold text-white">{buildings.length}</div>
                                </div>
                                <div className="rounded-xl border border-white/12 bg-[#102845]/78 px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/42">Этажей</div>
                                    <div className="mt-1 text-2xl font-bold text-white">{floors.length}</div>
                                </div>
                            </div>

                            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                                <div className="relative flex-1">
                                    <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#0f243f]/45">
                                            <circle cx="11" cy="11" r="7" />
                                            <path d="M21 21l-4.3-4.3" />
                                        </svg>
                                        <input
                                            className="w-full bg-transparent text-sm text-[#0f243f] placeholder:text-[#0f243f]/55 focus:outline-none"
                                            placeholder="Например: 315 или Деканат ИТ"
                                            autoComplete="off"
                                            value={query}
                                            onFocus={() => setSuggestionsOpen(true)}
                                            onBlur={() => setTimeout(() => setSuggestionsOpen(false), 140)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    handleFind();
                                                }
                                            }}
                                            onChange={(event) => {
                                                setQuery(event.target.value);
                                                setSuggestionsOpen(true);
                                            }}
                                        />
                                    </div>

                                    {suggestionsOpen && suggestions.length > 0 && (
                                        <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-white/20 bg-[#122a47] shadow-xl">
                                            {suggestions.map((suggestion, index) => (
                                                <button
                                                    key={`${suggestion.type}-${suggestion.value}-${index}`}
                                                    type="button"
                                                    className="flex w-full items-center justify-between border-b border-white/10 px-3 py-2 text-left text-xs text-white/85 transition last:border-b-0 hover:bg-white/10"
                                                    onMouseDown={() => applySuggestion(suggestion.value)}
                                                >
                                                    <span className="truncate">{suggestion.value}</span>
                                                    <span className="ml-3 text-[10px] uppercase tracking-[0.12em] text-white/50">
                                                        {suggestion.type === 'history' ? 'история' : 'подсказка'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#E8A020] px-5 text-sm font-bold text-[#0f243f] shadow-[0_10px_20px_rgba(232,160,32,.16)] transition hover:bg-[#d08c12]"
                                    type="button"
                                    onClick={handleFind}
                                >
                                    Найти
                                </button>
                            </div>

                            <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Фильтр">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.key}
                                        className={`rounded-xl px-3 py-2 text-xs font-bold transition ${activeTab === tab.key ? 'bg-[#E8A020] text-[#0f243f]' : 'border border-white/20 bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'}`}
                                        type="button"
                                        onClick={() => setActiveTab(tab.key)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <select
                                    value={selectedBuilding}
                                    onChange={(event) => setSelectedBuilding(event.target.value)}
                                    className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-xs text-white outline-none"
                                >
                                    <option value="all" className="text-slate-900">Все корпуса</option>
                                    {buildings.map((building) => (
                                        <option key={building} value={building} className="text-slate-900">
                                            {building}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={selectedFloor}
                                    onChange={(event) => setSelectedFloor(event.target.value)}
                                    className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-xs text-white outline-none"
                                >
                                    <option value="all" className="text-slate-900">Все этажи</option>
                                    {floors.map((floor) => (
                                        <option key={floor} value={floor} className="text-slate-900">
                                            Этаж {floor}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    onClick={() => setOnlyCabinets((value) => !value)}
                                    className={`rounded-xl px-3 py-2.5 text-xs font-bold transition ${onlyCabinets ? 'bg-[#E8A020] text-[#0f243f]' : 'border border-white/20 bg-white/10 text-white/80 hover:bg-white/20'}`}
                                >
                                    Только кабинеты
                                </button>
                            </div>

                            <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                                <div>
                                    <div className="text-sm font-semibold text-white">Результаты поиска</div>
                                    <div className="text-xs text-white/52">Выберите точку слева, маршрут появится справа.</div>
                                </div>
                                <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/78">
                                    {filteredPoints.length} результатов
                                </span>
                            </div>

                            <div className="max-h-[460px] space-y-2 overflow-auto pr-1" aria-label="Результаты поиска">
                                {filteredPoints.map((item) => {
                                    const metaText = `${item.meta}${(item.kind === 'staff' || item.kind === 'cabinet') && item.room ? ` • каб. ${item.room}` : ''}`;
                                    const attachedNames = Array.isArray(item.attached_users) && item.attached_users.length > 0
                                        ? item.attached_users.map((user) => user.name).join(', ')
                                        : '';

                                    return (
                                        <div
                                            className={`flex flex-col gap-3 rounded-xl border p-3 transition sm:flex-row sm:items-center sm:justify-between ${selectedItem?.title === item.title ? 'border-[#E8A020]/70 bg-[#E8A020]/12 shadow-[0_10px_22px_rgba(232,160,32,.1)]' : 'border-white/15 bg-white/8 hover:bg-white/12'}`}
                                            key={item.badge + item.title}
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-11 min-w-11 items-center justify-center rounded-full border border-white/35 bg-white/10 text-sm font-extrabold text-white">
                                                    {item.badge}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-white break-words">{highlightMatch(item.title, query)}</div>
                                                    <div className="text-xs text-white/60 break-words">{highlightMatch(metaText, query)}</div>
                                                    {attachedNames && (
                                                        <div className="mt-0.5 text-[11px] text-white/70 break-words">
                                                            Сотрудники: {highlightMatch(attachedNames, query)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                className="inline-flex w-full items-center justify-center rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 sm:w-auto"
                                                type="button"
                                                onClick={() => {
                                                    setSelectedItem(item);
                                                    rememberSearch(item.title);
                                                }}
                                            >
                                                Построить маршрут
                                            </button>
                                        </div>
                                    );
                                })}
                                {filteredPoints.length === 0 && (
                                    <div className="border border-dashed border-white/25 bg-white/5 p-4 text-center text-sm text-white/65">
                                        Ничего не найдено. Уточните запрос.
                                    </div>
                                )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
                                <span>Подсказка: нажмите на результат — маршрут появится справа.</span>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[0_16px_38px_rgba(0,0,0,.24)] backdrop-blur-md sm:p-5">
                            <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-[#E8A020]">Маршрут</p>
                            <h2 style={headingFont} className="text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                                {selectedItem ? `Маршрут: ${selectedItem.title}` : 'Маршрут не выбран'}
                            </h2>
                            <p className="mt-2 text-sm text-white/70">
                                {selectedItem
                                    ? `${selectedItem.meta.split('•')[0]?.trim()} • Старт: Холл (вход) → Цель: ${getDestinationLabel(selectedItem)}`
                                    : 'Выберите кабинет или отдел, и мы покажем путь от киоска до двери.'}
                            </p>

                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <div className="rounded-xl border border-white/12 bg-[#102845]/78 px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/42">Пункт назначения</div>
                                    <div className="mt-1 text-sm font-semibold text-white">{selectedItem ? getDestinationLabel(selectedItem) : 'Не выбран'}</div>
                                </div>
                                <div className="rounded-xl border border-white/12 bg-[#102845]/78 px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/42">Корпус</div>
                                    <div className="mt-1 text-sm font-semibold text-white">{selectedBuildingLabel ?? 'Не выбран'}</div>
                                </div>
                                <div className="rounded-xl border border-white/12 bg-[#102845]/78 px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/42">Этаж</div>
                                    <div className="mt-1 text-sm font-semibold text-white">{selectedItem ? `Этаж ${selectedRouteFloor}` : 'Не выбран'}</div>
                                </div>
                            </div>

                            <div className="mt-4 min-h-[360px] rounded-xl border border-white/15 bg-[#0b1a2e]/35 p-4">
                                {!selectedItem && (
                                    <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-white/60">
                                        Выберите слева кабинет.
                                    </div>
                                )}

                                {selectedItem && (
                                    <>
                                        <div className="mb-3 flex items-center gap-3 rounded-lg border border-white/15 bg-white/10 p-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-2xl font-bold">1</div>
                                            <div>
                                                <div className="text-sm font-bold text-white">Следуйте по маршруту</div>
                                                <div className="text-xs text-white/60">Маршрут сформирован для выбранной точки кампуса.</div>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-white/15 bg-white/8 p-4">
                                            <div className="text-xl font-bold text-white sm:text-2xl">Этаж {selectedRouteFloor} — до {getDestinationLabel(selectedItem)}</div>
                                            <span className="mt-2 inline-flex border border-white/20 bg-white/10 px-2.5 py-1 text-xs text-white/75">Эт. {selectedRouteFloor}</span>
                                            <div className="relative mt-3 overflow-hidden rounded-lg border border-white/15 bg-[linear-gradient(180deg,#f9fafb_0%,#e5e7eb_62%,#d1d5db_100%)]">
                                                {selectedMapImage ? (
                                                    <div className="relative mx-auto w-fit max-w-full">
                                                        <img
                                                            src={selectedMapImage}
                                                            alt="План этажа"
                                                            className="block max-h-[70vh] w-auto max-w-full bg-slate-100"
                                                        />

                                                        {selectedPolyline.length > 0 && (
                                                            <svg
                                                                viewBox="0 0 100 100"
                                                                preserveAspectRatio="none"
                                                                className="pointer-events-none absolute inset-0 h-full w-full"
                                                                aria-hidden="true"
                                                            >
                                                                <defs>
                                                                    <filter id="routeShadowPublic" x="-40%" y="-40%" width="200%" height="200%">
                                                                        <feDropShadow dx="0" dy="0.2" stdDeviation="0.4" floodColor="#111111" floodOpacity="0.32" />
                                                                    </filter>
                                                                    <linearGradient id="flagPolePublic" x1="0" y1="-3.6" x2="0.6" y2="1.4" gradientUnits="userSpaceOnUse">
                                                                        <stop offset="0%" stopColor="#9ea7b1" />
                                                                        <stop offset="55%" stopColor="#6f7781" />
                                                                        <stop offset="100%" stopColor="#4e555f" />
                                                                    </linearGradient>
                                                                    <linearGradient id="flagMainPublic" x1="0" y1="-3.1" x2="2.7" y2="-1.8" gradientUnits="userSpaceOnUse">
                                                                        <stop offset="0%" stopColor="#7fa06f" />
                                                                        <stop offset="65%" stopColor="#5f7c55" />
                                                                        <stop offset="100%" stopColor="#485e43" />
                                                                    </linearGradient>
                                                                    <linearGradient id="flagSidePublic" x1="0" y1="-3.1" x2="0.65" y2="-1.45" gradientUnits="userSpaceOnUse">
                                                                        <stop offset="0%" stopColor="#6d8a60" />
                                                                        <stop offset="100%" stopColor="#3f5239" />
                                                                    </linearGradient>
                                                                    <linearGradient id="flagBasePublic" x1="-1.8" y1="0.65" x2="1.8" y2="1.9" gradientUnits="userSpaceOnUse">
                                                                        <stop offset="0%" stopColor="#6f8f61" />
                                                                        <stop offset="100%" stopColor="#486244" />
                                                                    </linearGradient>
                                                                </defs>
                                                                {selectedPolyline.length > 1 && (
                                                                    <>
                                                                        <path
                                                                            d={svgPath}
                                                                            fill="none"
                                                                            stroke="#000000"
                                                                            strokeWidth="1.16"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                            opacity="0.16"
                                                                            filter="url(#routeShadowPublic)"
                                                                        />
                                                                        <path
                                                                            d={svgPath}
                                                                            fill="none"
                                                                            stroke="#111111"
                                                                            strokeWidth="0.6"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                            strokeDasharray="1.55 2.35"
                                                                            strokeDashoffset="0"
                                                                            opacity="0.92"
                                                                        >
                                                                            <animate
                                                                                attributeName="stroke-dashoffset"
                                                                                from="0"
                                                                                to="-7.8"
                                                                                dur="1.25s"
                                                                                repeatCount="indefinite"
                                                                            />
                                                                        </path>
                                                                    </>
                                                                )}
                                                                {selectedPolyline.slice(1, -1).map((point, index) => (
                                                                    <g key={`${point.x}-${point.y}-${index}`}>
                                                                        <circle
                                                                            cx={point.x}
                                                                            cy={point.y}
                                                                            r="1.18"
                                                                            fill="#ffffff"
                                                                            opacity="0.9"
                                                                        />
                                                                        <circle
                                                                            cx={point.x}
                                                                            cy={point.y}
                                                                            r="0.56"
                                                                            fill="#64748b"
                                                                        />
                                                                    </g>
                                                                ))}
                                                                {startPoint && (
                                                                    <g>
                                                                        <circle
                                                                            cx={startPoint.x}
                                                                            cy={startPoint.y}
                                                                            r="0.7"
                                                                            fill="none"
                                                                            stroke="#e5242a"
                                                                            strokeWidth="0.36"
                                                                            opacity="0.66"
                                                                        >
                                                                            <animate attributeName="r" values="0.7;1.45;0.7" dur="1.6s" repeatCount="indefinite" />
                                                                            <animate attributeName="opacity" values="0.66;0.18;0.66" dur="1.6s" repeatCount="indefinite" />
                                                                        </circle>
                                                                        <g transform={`translate(${startPoint.x} ${startPoint.y}) scale(0.28)`}>
                                                                            <path
                                                                                d="M 0 0 C 0 0 -2.35 -2.55 -2.35 -4.5 C -2.35 -6.35 -1.3 -7.55 0 -7.55 C 1.3 -7.55 2.35 -6.35 2.35 -4.5 C 2.35 -2.55 0 0 0 0 Z"
                                                                                fill="#e5242a"
                                                                                stroke="#ffffff"
                                                                                strokeWidth="0.44"
                                                                            />
                                                                            <circle cx="0" cy="-4.55" r="1.02" fill="#ffffff" />
                                                                        </g>
                                                                    </g>
                                                                )}
                                                                {finishPoint && (
                                                                    <g>
                                                                        <circle
                                                                            cx={finishPoint.x}
                                                                            cy={finishPoint.y}
                                                                            r="0.8"
                                                                            fill="none"
                                                                            stroke="#16a34a"
                                                                            strokeWidth="0.34"
                                                                            opacity="0.7"
                                                                        >
                                                                            <animate attributeName="r" values="0.8;1.5;0.8" dur="1.5s" repeatCount="indefinite" />
                                                                            <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.5s" repeatCount="indefinite" />
                                                                        </circle>
                                                                        <g transform={`translate(${finishPoint.x} ${finishPoint.y}) scale(0.34)`}>
                                                                            <path
                                                                                d="M 0 0 C 0 0 -2.35 -2.55 -2.35 -4.5 C -2.35 -6.35 -1.3 -7.55 0 -7.55 C 1.3 -7.55 2.35 -6.35 2.35 -4.5 C 2.35 -2.55 0 0 0 0 Z"
                                                                                fill="#16a34a"
                                                                                stroke="#ffffff"
                                                                                strokeWidth="0.44"
                                                                            />
                                                                            <path
                                                                                d="M -0.95 -4.6 L -0.2 -3.88 L 1.15 -5.22"
                                                                                fill="none"
                                                                                stroke="#ffffff"
                                                                                strokeWidth="0.46"
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                            />
                                                                        </g>
                                                                    </g>
                                                                )}
                                                            </svg>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex h-56 w-full items-center justify-center text-sm text-slate-600 sm:h-64">
                                                        Добавьте картинку плана этажа в админке.
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4 rounded-xl border border-white/12 bg-[#102845]/78 p-4">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div className="text-sm font-semibold text-white">Пошаговый маршрут</div>
                                                <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/78">
                                                    {routeSteps.length} шагов
                                                </span>
                                            </div>
                                            <ol className="space-y-2">
                                                {routeSteps.map((step, index) => (
                                                    <li key={step} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/6 px-3 py-2.5">
                                                        <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#E8A020] text-[11px] font-bold text-[#0f243f]">
                                                            {index + 1}
                                                        </span>
                                                        <span className="text-sm leading-6 text-white/78">{step}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>

                                    </>
                                )}
                            </div>

                            <div className="mt-3 text-xs text-white/55">Киоск фиксирован: маршрут строится без QR и без сканирования.</div>
                        </section>
                    </main>
                </section>
            </main>
        </>
    );
}

Index.layout = page => <PublicLayout>{page}</PublicLayout>;
export default Index;
