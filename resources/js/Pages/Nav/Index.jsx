import { Head } from '@inertiajs/react';
import { Building2, Layers, MapPin, Route, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';

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
                    className="rounded-sm bg-[#fcbb59] px-0.5 text-[#0a1a2e]"
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

    return (
        <>
            <Head title="Навигация по кампусу · КазУТБ" />

            <main
                className="relative mx-auto w-full max-w-[var(--container-xl)] px-[var(--gutter)] pb-14 pt-8 text-white lg:pt-12"
                style={{ fontFamily: 'var(--font-sans)' }}
            >
                {/* ── Header ── */}
                <header className="kz-up max-w-2xl">
                    <h1 className="kz-display text-[clamp(1.6rem,2.8vw,2.2rem)] font-semibold">
                        Куда вам нужно?
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-white/60 sm:text-[15px]">
                        Найдите кабинет, сотрудника или отдел — портал построит пошаговый маршрут.
                    </p>
                </header>

                {/* ── Search & filters ── */}
                <section className="kz-up kz-panel mt-6 p-4 sm:p-5" style={{ animationDelay: '120ms' }}>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                            <input
                                className="kz-field !pl-11"
                                placeholder="Например: 315, Смагулова или Деканат ИТ"
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
                                aria-label="Поиск по кампусу"
                            />

                            {suggestionsOpen && suggestions.length > 0 && (
                                <div className="kz-panel kz-panel--strong kz-scroll animate-fade-in absolute z-20 mt-2 max-h-56 w-full overflow-auto !rounded-[var(--radius-md)] p-1">
                                    {suggestions.map((suggestion, index) => (
                                        <button
                                            key={`${suggestion.type}-${suggestion.value}-${index}`}
                                            type="button"
                                            className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-white/85 transition hover:bg-white/10"
                                            onMouseDown={() => applySuggestion(suggestion.value)}
                                        >
                                            <span className="truncate">{suggestion.value}</span>
                                            <span className="flex-shrink-0 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-white/40">
                                                {suggestion.type === 'history' ? 'история' : 'подсказка'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button className="kz-btn kz-btn--gold sm:px-7" type="button" onClick={handleFind}>
                            Найти
                        </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Тип точки">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`kz-chip !min-h-[34px] ${activeTab === tab.key ? 'kz-chip--active' : ''}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="ml-auto flex flex-wrap items-center gap-1.5">
                            <select
                                value={selectedBuilding}
                                onChange={(event) => setSelectedBuilding(event.target.value)}
                                className="kz-field !min-h-[34px] !w-auto !px-3 !text-[13px]"
                                aria-label="Корпус"
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
                                className="kz-field !min-h-[34px] !w-auto !px-3 !text-[13px]"
                                aria-label="Этаж"
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
                                aria-pressed={onlyCabinets}
                                className={`kz-chip !min-h-[34px] ${onlyCabinets ? 'kz-chip--active' : ''}`}
                            >
                                Только кабинеты
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── Results + Route ── */}
                <div className="kz-up mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" style={{ animationDelay: '220ms' }}>
                    {/* Results list */}
                    <section className="kz-panel flex flex-col p-4 sm:p-5" aria-label="Результаты поиска">
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                            <div>
                                <h2 className="kz-display text-[16px] font-semibold">Результаты</h2>
                                <p className="mt-0.5 text-xs text-white/50">
                                    {buildings.length} корпусов · {floors.length} этажей
                                </p>
                            </div>
                            <span className="rounded-full bg-white/[0.08] px-3 py-1 text-[12px] font-semibold tabular-nums text-white/75">
                                {filteredPoints.length}
                            </span>
                        </div>

                        <div className="kz-scroll max-h-[560px] space-y-2 overflow-auto pr-1">
                            {filteredPoints.map((item) => {
                                const metaText = `${item.meta}${(item.kind === 'staff' || item.kind === 'cabinet') && item.room ? ` • каб. ${item.room}` : ''}`;
                                const attachedNames = Array.isArray(item.attached_users) && item.attached_users.length > 0
                                    ? item.attached_users.map((user) => user.name).join(', ')
                                    : '';
                                const isSelected = selectedItem?.title === item.title;

                                return (
                                    <button
                                        type="button"
                                        key={item.badge + item.title}
                                        onClick={() => {
                                            setSelectedItem(item);
                                            rememberSearch(item.title);
                                        }}
                                        aria-pressed={isSelected}
                                        className={`kz-tile w-full items-center gap-3 p-3 text-left ${
                                            isSelected ? '!border-[rgba(252,187,89,0.45)] !bg-[rgba(252,187,89,0.10)]' : ''
                                        }`}
                                    >
                                        <span className={`flex h-10 min-w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] px-1.5 text-[12px] font-extrabold ${
                                            isSelected ? 'bg-[rgba(252,187,89,0.20)] text-[var(--gold-300)]' : 'bg-white/[0.08] text-white/80'
                                        }`}>
                                            {item.badge}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block break-words text-sm font-bold text-white">{highlightMatch(item.title, query)}</span>
                                            <span className="block break-words text-xs text-white/55">{highlightMatch(metaText, query)}</span>
                                            {attachedNames && (
                                                <span className="mt-0.5 block break-words text-[11px] text-white/65">
                                                    Сотрудники: {highlightMatch(attachedNames, query)}
                                                </span>
                                            )}
                                        </span>
                                        <MapPin className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-[var(--gold-400)]' : 'text-white/25'}`} />
                                    </button>
                                );
                            })}
                            {filteredPoints.length === 0 && (
                                <div className="rounded-[var(--radius-md)] border border-dashed border-white/20 bg-white/[0.04] p-5 text-center text-sm text-white/60">
                                    Ничего не найдено. Уточните запрос или измените фильтры.
                                </div>
                            )}
                        </div>

                        {!selectedItem && (
                            <p className="mt-3 text-xs text-white/45">
                                Нажмите на точку — маршрут появится справа.
                            </p>
                        )}
                    </section>

                    {/* Route panel */}
                    <section className="kz-panel p-4 sm:p-5" aria-label="Маршрут">
                        {!selectedItem ? (
                            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
                                <span className="kz-icon-badge h-14 w-14 !rounded-full">
                                    <Route className="h-6 w-6" />
                                </span>
                                <h2 className="kz-display text-[17px] font-semibold">Маршрут не выбран</h2>
                                <p className="max-w-[300px] text-sm leading-relaxed text-white/55">
                                    Выберите кабинет, сотрудника или отдел слева — мы покажем путь
                                    от киоска до двери.
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className="kz-eyebrow">Маршрут</p>
                                <h2 className="kz-display mt-1.5 text-[20px] font-semibold sm:text-[24px]">
                                    {selectedItem.title}
                                </h2>

                                <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-white/80">
                                        <Building2 className="h-3.5 w-3.5 text-[var(--teal-300)]" />
                                        {selectedBuildingLabel ?? 'Корпус не указан'}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-white/80">
                                        <Layers className="h-3.5 w-3.5 text-[var(--teal-300)]" />
                                        Этаж {selectedRouteFloor}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-white/80">
                                        <MapPin className="h-3.5 w-3.5 text-[var(--gold-400)]" />
                                        {getDestinationLabel(selectedItem)}
                                    </span>
                                </div>

                                {/* Floor plan with animated route */}
                                <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-white/12 bg-[linear-gradient(180deg,#f9fafb_0%,#e5e7eb_62%,#d1d5db_100%)]">
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
                                            План этажа пока не добавлен.
                                        </div>
                                    )}
                                </div>

                                {/* Step-by-step route */}
                                <div className="kz-panel--inset mt-4 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-semibold text-white">Пошаговый маршрут</h3>
                                        <span className="rounded-full bg-white/[0.08] px-3 py-1 text-[11px] font-semibold tabular-nums text-white/70">
                                            {routeSteps.length} шагов
                                        </span>
                                    </div>
                                    <ol className="space-y-0">
                                        {routeSteps.map((step, index) => (
                                            <li key={step} className="relative flex gap-3 pb-3 last:pb-0">
                                                {index < routeSteps.length - 1 && (
                                                    <span aria-hidden="true" className="absolute left-[11px] top-7 h-[calc(100%-22px)] w-px bg-white/12" />
                                                )}
                                                <span className="z-10 mt-0.5 flex h-[23px] w-[23px] flex-shrink-0 items-center justify-center rounded-full bg-[var(--gold-500)] text-[11px] font-bold text-[var(--navy-900)]">
                                                    {index + 1}
                                                </span>
                                                <span className="text-sm leading-6 text-white/78">{step}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>

                            </>
                        )}
                    </section>
                </div>
            </main>
        </>
    );
}

Index.layout = (page) => <PublicLayout>{page}</PublicLayout>;
export default Index;
