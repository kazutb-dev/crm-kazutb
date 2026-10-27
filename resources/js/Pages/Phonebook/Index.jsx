import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader, qdFieldClass, Segmented, StatusBadge } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Building2,
    Check,
    Copy,
    GripVertical,
    Image as ImageIcon,
    LayoutGrid,
    List,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const LOGO_AVATAR_URL = '/assets/images/logo.png';

// Soft tints for people without a photo; picked by name so a person keeps the same colour.
const AVATAR_TONES = [
    'bg-teal-100 text-teal-800',
    'bg-blue-100 text-blue-800',
    'bg-amber-100 text-amber-800',
    'bg-orange-100 text-orange-800',
    'bg-emerald-100 text-emerald-800',
    'bg-slate-200 text-slate-700',
];

function initialsFromName(fullName) {
    const parts = String(fullName ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) {
        return '??';
    }

    return parts
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function avatarTone(fullName) {
    const text = String(fullName ?? '');
    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }

    return AVATAR_TONES[hash % AVATAR_TONES.length];
}

const hasPhoto = (item) => (item?.avatar_url ?? '').trim() !== '';

const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

// Photo when there is one (and it loads), otherwise initials on a tinted square.
function ContactAvatar({ item, className = 'h-11 w-11 rounded-full text-sm' }) {
    const [failed, setFailed] = useState(false);
    const avatarUrl = (item.avatar_url ?? '').trim();

    useEffect(() => setFailed(false), [avatarUrl]);

    if (avatarUrl !== '' && !failed) {
        return (
            <img
                src={avatarUrl}
                alt={item.full_name}
                draggable={false}
                className={`shrink-0 border border-slate-200 bg-slate-50 object-cover ${className}`}
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <span
            aria-hidden="true"
            className={`inline-flex shrink-0 select-none items-center justify-center font-display font-bold ${avatarTone(item.full_name)} ${className}`}
        >
            {initialsFromName(item.full_name)}
        </span>
    );
}

// Marks the applied search term inside a name or job title.
function Highlight({ text, query }) {
    const value = String(text ?? '');
    const needle = String(query ?? '').trim();

    if (needle === '') {
        return value;
    }

    const index = value.toLowerCase().indexOf(needle.toLowerCase());

    if (index === -1) {
        return value;
    }

    return (
        <>
            {value.slice(0, index)}
            <mark className="rounded-[3px] bg-amber-100 text-inherit">{value.slice(index, index + needle.length)}</mark>
            {value.slice(index + needle.length)}
        </>
    );
}

function InnerPhone({ value }) {
    if (!value) {
        return null;
    }

    return (
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[#102945]">
            <span className="font-medium text-slate-500">вн.</span>
            {value}
        </span>
    );
}

export default function Index({ sections, totalUsers, departments, filters }) {
    const page = usePage();
    const roleSlug = page?.props?.auth?.roleSlug;
    const canManagePhotos = ['admin', 'superadmin', 'hr'].includes(roleSlug);
    const canManageDirectory = ['admin', 'superadmin', 'hr'].includes(roleSlug);

    const groupedSections = Array.isArray(sections) ? sections : [];
    const [localSections, setLocalSections] = useState(groupedSections);
    const [search, setSearch] = useState(filters?.search ?? '');
    const [departmentId, setDepartmentId] = useState(filters?.department_id ?? '');
    const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
    const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
    const [photoPreview, setPhotoPreview] = useState({
        src: LOGO_AVATAR_URL,
        fullName: '',
    });
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addDepartmentDialogOpen, setAddDepartmentDialogOpen] = useState(false);
    const [viewMode, setViewMode] = useState('list');
    const [editingUser, setEditingUser] = useState(null);
    const [draggingUserId, setDraggingUserId] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [activeSectionKey, setActiveSectionKey] = useState(null);
    const [copiedKey, setCopiedKey] = useState(null);
    const copyTimer = useRef(null);
    const jumpLockUntil = useRef(0);

    const photoForm = useForm({
        avatar_url: '',
    });

    const uploadForm = useForm({
        avatar: null,
    });

    const editForm = useForm({
        department_id: '',
        full_name: '',
        job_title: '',
        phone: '',
        inner_phone: '',
        email: '',
        office: '',
        sort_order: '',
    });

    const addForm = useForm({
        department_id: '',
        full_name: '',
        job_title: '',
        phone: '',
        inner_phone: '',
        email: '',
        office: '',
        sort_order: '',
    });

    const departmentForm = useForm({
        name: '',
    });

    useEffect(() => {
        setLocalSections(groupedSections);
    }, [groupedSections]);

    const submitFilters = (event) => {
        event.preventDefault();

        router.get(
            route('phonebook.index'),
            {
                search,
                department_id: departmentId,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );
    };

    const clearFilters = () => {
        setSearch('');
        setDepartmentId('');

        router.get(route('phonebook.index'), {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const openPhotoDialog = (item) => {
        setEditingUser(item);
        photoForm.setData('avatar_url', item.avatar_url ?? '');
        photoForm.clearErrors();
        uploadForm.setData('avatar', null);
        uploadForm.clearErrors();
        setPhotoDialogOpen(true);
    };

    const openEditDialog = (item) => {
        setEditingUser(item);
        editForm.setData({
            department_id: item.department?.id ? String(item.department.id) : '',
            full_name: item.full_name ?? '',
            job_title: item.job_title ?? '',
            phone: item.phone ?? '',
            inner_phone: item.inner_phone ?? '',
            email: item.email ?? '',
            office: item.office ?? '',
            sort_order: item.sort_order == null ? '' : String(item.sort_order),
        });
        editForm.clearErrors();
        setEditDialogOpen(true);
    };

    const submitPhoto = (event) => {
        event.preventDefault();

        if (!editingUser) {
            return;
        }

        photoForm.patch(route('phonebook.users.avatar.update', editingUser.id), {
            preserveScroll: true,
            onSuccess: () => {
                setPhotoDialogOpen(false);
                setEditingUser(null);
            },
        });
    };

    const submitPhotoUpload = (event) => {
        event.preventDefault();

        if (!editingUser) {
            return;
        }

        uploadForm.post(route('phonebook.users.avatar.upload', editingUser.id), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setPhotoDialogOpen(false);
                setEditingUser(null);
            },
        });
    };

    const submitEdit = (event) => {
        event.preventDefault();

        if (!editingUser) {
            return;
        }

        editForm.patch(route('phonebook.users.update', editingUser.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditDialogOpen(false);
                setEditingUser(null);
            },
        });
    };

    const openAddDialog = () => {
        addForm.setData({
            department_id: '',
            full_name: '',
            job_title: '',
            phone: '',
            inner_phone: '',
            email: '',
            office: '',
            sort_order: '',
        });
        addForm.clearErrors();
        setAddDialogOpen(true);
    };

    const submitAdd = (event) => {
        event.preventDefault();

        addForm.post(route('phonebook.users.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setAddDialogOpen(false);
            },
        });
    };

    const openAddDepartmentDialog = () => {
        departmentForm.setData('name', '');
        departmentForm.clearErrors();
        setAddDepartmentDialogOpen(true);
    };

    const submitAddDepartment = (event) => {
        event.preventDefault();

        departmentForm.post(route('phonebook.departments.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setAddDepartmentDialogOpen(false);
            },
        });
    };

    const handleDeleteUser = (item) => {
        if (!canManageDirectory) {
            return;
        }

        const ok = window.confirm(`Удалить сотрудника "${item.full_name}"?`);

        if (!ok) {
            return;
        }

        router.delete(route('phonebook.users.destroy', item.id), {
            preserveScroll: true,
        });
    };

    const openPhotoPreview = (item) => {
        const avatarUrl = (item.avatar_url ?? '').trim();

        setPhotoPreview({
            src: avatarUrl !== '' ? avatarUrl : LOGO_AVATAR_URL,
            fullName: item.full_name ?? '',
        });
        setPhotoPreviewOpen(true);
    };

    const sectionKey = (section) => {
        if (section.department_id == null) {
            return `without-${section.name}`;
        }

        return `department-${section.department_id}`;
    };

    const persistMove = (draggedUserId, targetUserId, targetDepartmentId) => {
        router.patch(route('phonebook.users.move', draggedUserId), {
            target_user_id: targetUserId,
            target_department_id: targetDepartmentId,
        }, {
            preserveScroll: true,
            onFinish: () => setDraggingUserId(null),
        });
    };

    const moveLocalCard = (draggedUserId, targetSectionKey, targetUserId = null) => {
        let draggedItem = null;

        const withoutDragged = localSections.map((section) => {
            const items = (section.items ?? []).filter((item) => {
                if (item.id === draggedUserId) {
                    draggedItem = item;
                    return false;
                }

                return true;
            });

            return { ...section, items };
        });

        if (!draggedItem) {
            return localSections;
        }

        return withoutDragged.map((section) => {
            if (sectionKey(section) !== targetSectionKey) {
                return section;
            }

            const items = [...(section.items ?? [])];
            const insertIndex = targetUserId == null
                ? items.length
                : Math.max(items.findIndex((item) => item.id === targetUserId), 0);

            items.splice(insertIndex, 0, {
                ...draggedItem,
                department: section.department_id == null
                    ? null
                    : {
                        id: section.department_id,
                        name: section.name,
                    },
            });

            return { ...section, items };
        });
    };

    const handleDragStart = (event, userId) => {
        if (!canManageDirectory) {
            return;
        }

        setDraggingUserId(userId);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(userId));
    };

    const handleDropOnCard = (event, targetSection, targetUserId) => {
        event.preventDefault();
        event.stopPropagation();

        if (!canManageDirectory) {
            return;
        }

        const raw = event.dataTransfer.getData('text/plain');
        const draggedUserId = Number(raw);

        if (!Number.isFinite(draggedUserId) || draggedUserId === targetUserId) {
            return;
        }

        const key = sectionKey(targetSection);
        const nextSections = moveLocalCard(draggedUserId, key, targetUserId);
        setLocalSections(nextSections);
        persistMove(draggedUserId, targetUserId, targetSection.department_id ?? null);
    };

    const handleDropOnSection = (event, targetSection) => {
        event.preventDefault();
        event.stopPropagation();

        if (!canManageDirectory) {
            return;
        }

        const raw = event.dataTransfer.getData('text/plain');
        const draggedUserId = Number(raw);

        if (!Number.isFinite(draggedUserId)) {
            return;
        }

        const key = sectionKey(targetSection);
        const nextSections = moveLocalCard(draggedUserId, key, null);
        setLocalSections(nextSections);
        persistMove(draggedUserId, null, targetSection.department_id ?? null);
    };

    const canAct = canManageDirectory || canManagePhotos;
    const appliedSearch = filters?.search ?? '';
    const hasFilters = (filters?.search ?? '') !== '' || (filters?.department_id ?? '') !== '';
    const shownCount = localSections.reduce((sum, section) => sum + (section.items ?? []).length, 0);
    const anchorId = (section) => `pb-${sectionKey(section)}`;

    // Highlight the department the reader has scrolled to in the index.
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') {
            return undefined;
        }

        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

            // A click in the index wins over the observer while the page scrolls (the last sections never reach the top).
            if (visible.length > 0 && Date.now() > jumpLockUntil.current) {
                setActiveSectionKey(visible[0].target.dataset.sectionKey);
            }
        }, { rootMargin: '-120px 0px -55% 0px' });

        localSections.forEach((section) => {
            const element = document.getElementById(anchorId(section));

            if (element) {
                observer.observe(element);
            }
        });

        return () => observer.disconnect();
    }, [localSections, viewMode]);

    useEffect(() => () => clearTimeout(copyTimer.current), []);

    const jumpToSection = (section) => {
        jumpLockUntil.current = Date.now() + 1000;
        setActiveSectionKey(sectionKey(section));
        document.getElementById(anchorId(section))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const copyValue = async (key, value) => {
        try {
            await navigator.clipboard.writeText(String(value));
            setCopiedKey(key);
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopiedKey(null), 1500);
        } catch {
            // Clipboard is unavailable (insecure origin or denied) — the value stays selectable in the panel.
        }
    };

    // Dialogs open on top of a closed contact panel, never inside it.
    const fromSheet = (action) => (item) => {
        setSelectedUser(null);
        action(item);
    };

    const dragProps = (section, item) => (canManageDirectory ? {
        draggable: true,
        onDragStart: (event) => handleDragStart(event, item.id),
        onDragEnd: () => setDraggingUserId(null),
        onDragOver: (event) => event.preventDefault(),
        onDrop: (event) => handleDropOnCard(event, section, item.id),
    } : {});

    const renderRowActions = (item) => (
        <div className="flex shrink-0 items-center justify-end gap-1">
            {canManageDirectory && (
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" title="Редактировать" aria-label={`Редактировать: ${item.full_name}`} onClick={() => openEditDialog(item)}>
                    <Pencil className="h-4 w-4" />
                </Button>
            )}
            {canManagePhotos && (
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" title="Фото" aria-label={`Фото: ${item.full_name}`} onClick={() => openPhotoDialog(item)}>
                    <ImageIcon className="h-4 w-4" />
                </Button>
            )}
            {canManageDirectory && (
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-700 hover:bg-red-50 hover:text-red-800" title="Удалить" aria-label={`Удалить: ${item.full_name}`} onClick={() => handleDeleteUser(item)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
        </div>
    );

    const renderPerson = (item) => (
        <button
            type="button"
            draggable={false}
            onClick={() => setSelectedUser(item)}
            className="group/person flex min-w-0 items-center gap-3 rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal-600/30"
        >
            <ContactAvatar item={item} />
            <span className="min-w-0">
                <span className="block font-semibold leading-snug text-[#102945] group-hover/person:text-teal-700">
                    <Highlight text={item.full_name} query={appliedSearch} />
                </span>
                <span className="mt-0.5 line-clamp-2 text-sm text-slate-500">
                    {item.job_title ? <Highlight text={item.job_title} query={appliedSearch} /> : 'Должность не указана'}
                </span>
            </span>
        </button>
    );

    const renderListRow = (section, item) => (
        <li
            key={item.id}
            {...dragProps(section, item)}
            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 px-5 py-3.5 transition-colors hover:bg-slate-50 sm:px-6 2xl:grid-cols-[minmax(0,1.3fr)_14rem_minmax(0,1fr)_auto] ${draggingUserId === item.id ? 'opacity-50' : ''}`}
        >
            <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 2xl:col-start-auto 2xl:row-start-auto">
                {canManageDirectory && (
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300 active:cursor-grabbing" aria-hidden="true" />
                )}
                {renderPerson(item)}
            </div>

            <div className={`col-span-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm 2xl:contents ${canManageDirectory ? 'pl-[4.25rem]' : 'pl-14'}`}>
                <div className="flex min-w-0 items-center gap-2">
                    {item.phone ? (
                        <a href={telHref(item.phone)} className="inline-flex items-center gap-2 whitespace-nowrap font-medium tabular-nums text-[#102945] hover:text-teal-700">
                            <Phone className="h-4 w-4 shrink-0 text-teal-700" />
                            {item.phone}
                        </a>
                    ) : (
                        !item.inner_phone && <span className="text-slate-400">Нет телефона</span>
                    )}
                    <InnerPhone value={item.inner_phone} />
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1 2xl:block 2xl:space-y-0.5">
                    {item.email && (
                        <a href={`mailto:${item.email}`} className="flex min-w-0 items-center gap-2 text-slate-700 hover:text-teal-700">
                            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="truncate">{item.email}</span>
                        </a>
                    )}
                    {item.office && (
                        <div className="flex min-w-0 items-center gap-2 text-slate-500">
                            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="truncate">{item.office}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="col-start-2 row-start-1 hidden sm:block 2xl:col-start-auto 2xl:row-start-auto">
                {canAct && renderRowActions(item)}
            </div>
        </li>
    );

    const renderCard = (section, item) => (
        <article
            key={item.id}
            {...dragProps(section, item)}
            className={`flex flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white transition-colors hover:border-teal-600/40 ${canManageDirectory ? 'cursor-grab active:cursor-grabbing' : ''} ${draggingUserId === item.id ? 'opacity-50' : ''}`}
        >
            <button
                type="button"
                draggable={false}
                onClick={() => setSelectedUser(item)}
                className="group/card flex flex-col items-center gap-3 px-5 pb-4 pt-6 text-center focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-teal-600/30"
            >
                <ContactAvatar item={item} className="h-24 w-24 rounded-full text-2xl" />
                <span className="min-w-0">
                    <span className="line-clamp-2 font-display text-base font-bold leading-snug text-[#102945] group-hover/card:text-teal-700">
                        <Highlight text={item.full_name} query={appliedSearch} />
                    </span>
                    <span className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {item.job_title ? <Highlight text={item.job_title} query={appliedSearch} /> : 'Должность не указана'}
                    </span>
                </span>
            </button>

            <div className="mt-auto space-y-2 border-t border-slate-200 bg-slate-50/60 px-5 py-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                    {item.phone ? (
                        <a href={telHref(item.phone)} className="inline-flex min-w-0 items-center gap-2 font-medium tabular-nums text-[#102945] hover:text-teal-700">
                            <Phone className="h-4 w-4 shrink-0 text-teal-700" />
                            <span className="truncate">{item.phone}</span>
                        </a>
                    ) : <span className="text-slate-400">Нет телефона</span>}
                    <InnerPhone value={item.inner_phone} />
                </div>
                {item.email && (
                    <a href={`mailto:${item.email}`} className="flex min-w-0 items-center gap-2 text-slate-700 hover:text-teal-700">
                        <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate">{item.email}</span>
                    </a>
                )}
                {item.office && (
                    <div className="flex min-w-0 items-center gap-2 text-slate-500">
                        <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate">{item.office}</span>
                    </div>
                )}
            </div>

            {canAct && (
                <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
                    {canManageDirectory ? <GripVertical className="ml-2 h-4 w-4 text-slate-300" aria-hidden="true" /> : <span />}
                    {renderRowActions(item)}
                </div>
            )}
        </article>
    );

    const detailRows = selectedUser ? [
        { key: 'phone', label: 'Телефон', value: selectedUser.phone, href: selectedUser.phone ? telHref(selectedUser.phone) : null, Icon: Phone },
        { key: 'inner', label: 'Внутренний', value: selectedUser.inner_phone, Icon: Phone },
        { key: 'email', label: 'Email', value: selectedUser.email, href: selectedUser.email ? `mailto:${selectedUser.email}` : null, Icon: Mail },
        { key: 'office', label: 'Кабинет', value: selectedUser.office, Icon: MapPin },
        { key: 'department', label: 'Подразделение', value: selectedUser.department?.name || 'Без департамента', Icon: Building2 },
    ] : [];

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Справочник"
                    title="Телефонный справочник"
                    description="Контакты сотрудников университета: телефоны, внутренние номера, почта и кабинеты."
                    actions={canManageDirectory ? (
                        <>
                            <Button type="button" variant="outline" onClick={openAddDepartmentDialog}>
                                Добавить отдел
                            </Button>
                            <Button type="button" className="gap-2" onClick={openAddDialog}>
                                <Plus className="h-4 w-4" />
                                Добавить сотрудника
                            </Button>
                        </>
                    ) : null}
                    meta={<StatusBadge tone="info">{totalUsers} сотрудников</StatusBadge>}
                />
            )}
        >
            <Head title="Телефонный справочник" />

            <Dialog
                open={photoPreviewOpen}
                onOpenChange={setPhotoPreviewOpen}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{photoPreview.fullName || 'Фото сотрудника'}</DialogTitle>
                    </DialogHeader>

                    <div className="overflow-hidden rounded-lg border bg-muted/20 p-2">
                        <img
                            src={photoPreview.src}
                            alt={photoPreview.fullName || 'Фото сотрудника'}
                            className="mx-auto max-h-[82vh] w-full rounded-md object-contain"
                            onError={(event) => {
                                const image = event.currentTarget;

                                if (image.src.endsWith(LOGO_AVATAR_URL)) {
                                    image.onerror = null;
                                    return;
                                }

                                image.src = LOGO_AVATAR_URL;
                            }}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={photoDialogOpen}
                onOpenChange={(open) => {
                    setPhotoDialogOpen(open);

                    if (!open) {
                        setEditingUser(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Фото сотрудника</DialogTitle>
                        <DialogDescription>
                            Укажите ссылку на изображение для карточки сотрудника.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={submitPhoto}>
                        <div className="space-y-2">
                            <label className="qd-field-label block">URL изображения</label>
                            <Input
                                value={photoForm.data.avatar_url}
                                onChange={(event) => photoForm.setData('avatar_url', event.target.value)}
                                placeholder="https://..."
                            />
                            {photoForm.errors.avatar_url && (
                                <p className="text-sm text-destructive">{photoForm.errors.avatar_url}</p>
                            )}
                        </div>

                        <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                            <label className="qd-field-label block">Или загрузить файл</label>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null;
                                    uploadForm.setData('avatar', file);
                                }}
                            />
                            {uploadForm.errors.avatar && (
                                <p className="text-sm text-destructive">{uploadForm.errors.avatar}</p>
                            )}
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={uploadForm.processing || !uploadForm.data.avatar}
                                    onClick={submitPhotoUpload}
                                >
                                    Загрузить файл
                                </Button>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPhotoDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={photoForm.processing}>Сохранить</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={editDialogOpen}
                onOpenChange={(open) => {
                    setEditDialogOpen(open);

                    if (!open) {
                        setEditingUser(null);
                    }
                }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Редактирование сотрудника</DialogTitle>
                        <DialogDescription>
                            Измените данные карточки, включая департамент и порядок отображения.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={submitEdit}>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="qd-field-label block">ФИО</label>
                                <Input
                                    value={editForm.data.full_name}
                                    onChange={(event) => editForm.setData('full_name', event.target.value)}
                                />
                                {editForm.errors.full_name && <p className="text-sm text-destructive">{editForm.errors.full_name}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Департамент</label>
                                <select
                                    className={qdFieldClass}
                                    value={editForm.data.department_id}
                                    onChange={(event) => editForm.setData('department_id', event.target.value)}
                                >
                                    <option value="">Без департамента</option>
                                    {departments.map((department) => (
                                        <option key={department.id} value={department.id}>
                                            {department.name}
                                        </option>
                                    ))}
                                </select>
                                {editForm.errors.department_id && <p className="text-sm text-destructive">{editForm.errors.department_id}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Должность</label>
                                <Input
                                    value={editForm.data.job_title}
                                    onChange={(event) => editForm.setData('job_title', event.target.value)}
                                />
                                {editForm.errors.job_title && <p className="text-sm text-destructive">{editForm.errors.job_title}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Порядок (order)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={editForm.data.sort_order}
                                    onChange={(event) => editForm.setData('sort_order', event.target.value)}
                                />
                                {editForm.errors.sort_order && <p className="text-sm text-destructive">{editForm.errors.sort_order}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Телефон</label>
                                <Input
                                    value={editForm.data.phone}
                                    onChange={(event) => editForm.setData('phone', event.target.value)}
                                />
                                {editForm.errors.phone && <p className="text-sm text-destructive">{editForm.errors.phone}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Внутренний телефон</label>
                                <Input
                                    value={editForm.data.inner_phone}
                                    onChange={(event) => editForm.setData('inner_phone', event.target.value)}
                                />
                                {editForm.errors.inner_phone && <p className="text-sm text-destructive">{editForm.errors.inner_phone}</p>}
                            </div>

                            <div className="space-y-1 md:col-span-2">
                                <label className="qd-field-label block">Email</label>
                                <Input
                                    value={editForm.data.email}
                                    onChange={(event) => editForm.setData('email', event.target.value)}
                                />
                                {editForm.errors.email && <p className="text-sm text-destructive">{editForm.errors.email}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Кабинет</label>
                                <Input
                                    value={editForm.data.office}
                                    onChange={(event) => editForm.setData('office', event.target.value)}
                                />
                                {editForm.errors.office && <p className="text-sm text-destructive">{editForm.errors.office}</p>}
                            </div>

                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={editForm.processing}>Сохранить изменения</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Добавить сотрудника</DialogTitle>
                        <DialogDescription>
                            Создайте новую запись в телефонном справочнике.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={submitAdd}>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="qd-field-label block">ФИО</label>
                                <Input
                                    value={addForm.data.full_name}
                                    onChange={(event) => addForm.setData('full_name', event.target.value)}
                                />
                                {addForm.errors.full_name && <p className="text-sm text-destructive">{addForm.errors.full_name}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Департамент</label>
                                <select
                                    className={qdFieldClass}
                                    value={addForm.data.department_id}
                                    onChange={(event) => addForm.setData('department_id', event.target.value)}
                                >
                                    <option value="">Без департамента</option>
                                    {departments.map((department) => (
                                        <option key={department.id} value={department.id}>
                                            {department.name}
                                        </option>
                                    ))}
                                </select>
                                {addForm.errors.department_id && <p className="text-sm text-destructive">{addForm.errors.department_id}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Должность</label>
                                <Input
                                    value={addForm.data.job_title}
                                    onChange={(event) => addForm.setData('job_title', event.target.value)}
                                />
                                {addForm.errors.job_title && <p className="text-sm text-destructive">{addForm.errors.job_title}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Порядок (order)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={addForm.data.sort_order}
                                    onChange={(event) => addForm.setData('sort_order', event.target.value)}
                                />
                                {addForm.errors.sort_order && <p className="text-sm text-destructive">{addForm.errors.sort_order}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Телефон</label>
                                <Input
                                    value={addForm.data.phone}
                                    onChange={(event) => addForm.setData('phone', event.target.value)}
                                />
                                {addForm.errors.phone && <p className="text-sm text-destructive">{addForm.errors.phone}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Внутренний телефон</label>
                                <Input
                                    value={addForm.data.inner_phone}
                                    onChange={(event) => addForm.setData('inner_phone', event.target.value)}
                                />
                                {addForm.errors.inner_phone && <p className="text-sm text-destructive">{addForm.errors.inner_phone}</p>}
                            </div>

                            <div className="space-y-1 md:col-span-2">
                                <label className="qd-field-label block">Email</label>
                                <Input
                                    value={addForm.data.email}
                                    onChange={(event) => addForm.setData('email', event.target.value)}
                                />
                                {addForm.errors.email && <p className="text-sm text-destructive">{addForm.errors.email}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="qd-field-label block">Кабинет</label>
                                <Input
                                    value={addForm.data.office}
                                    onChange={(event) => addForm.setData('office', event.target.value)}
                                />
                                {addForm.errors.office && <p className="text-sm text-destructive">{addForm.errors.office}</p>}
                            </div>

                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={addForm.processing}>Добавить</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={addDepartmentDialogOpen}
                onOpenChange={(open) => {
                    setAddDepartmentDialogOpen(open);

                    if (!open) {
                        departmentForm.clearErrors();
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Добавить отдел</DialogTitle>
                        <DialogDescription>
                            Новый отдел сразу появится в фильтре и в карточках сотрудников.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={submitAddDepartment}>
                        <div className="space-y-1">
                            <label className="qd-field-label block">Название отдела</label>
                            <Input
                                value={departmentForm.data.name}
                                onChange={(event) => departmentForm.setData('name', event.target.value)}
                                placeholder="Например: Отдел кадров"
                            />
                            {departmentForm.errors.name && <p className="text-sm text-destructive">{departmentForm.errors.name}</p>}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddDepartmentDialogOpen(false)}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={departmentForm.processing}>Добавить отдел</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Sheet open={selectedUser !== null} onOpenChange={(open) => !open && setSelectedUser(null)}>
                <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
                    {selectedUser && (
                        <>
                            <div className="flex flex-col items-center gap-4 border-b border-slate-200 bg-slate-50 px-6 pb-6 pt-10 text-center">
                                {hasPhoto(selectedUser) ? (
                                    <button
                                        type="button"
                                        title="Открыть фото"
                                        className="rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal-600/30"
                                        onClick={() => openPhotoPreview(selectedUser)}
                                    >
                                        <ContactAvatar item={selectedUser} className="h-32 w-32 rounded-full text-3xl" />
                                    </button>
                                ) : (
                                    <ContactAvatar item={selectedUser} className="h-32 w-32 rounded-full text-3xl" />
                                )}
                                <div className="space-y-1">
                                    <SheetTitle className="font-display text-xl font-bold leading-snug text-[#102945]">
                                        {selectedUser.full_name}
                                    </SheetTitle>
                                    <SheetDescription className="text-sm text-slate-600">
                                        {selectedUser.job_title || 'Должность не указана'}
                                    </SheetDescription>
                                </div>
                                {selectedUser.phone && (
                                    <Button asChild className="gap-2">
                                        <a href={telHref(selectedUser.phone)}>
                                            <Phone className="h-4 w-4" />
                                            Позвонить
                                        </a>
                                    </Button>
                                )}
                            </div>

                            <dl className="divide-y divide-slate-200 px-6">
                                {detailRows.map(({ key, label, value, href, Icon }) => (
                                    <div key={key} className="flex items-center gap-3 py-3.5">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-teal-50 text-teal-700">
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <dt className="qd-field-label">{label}</dt>
                                            <dd className="mt-0.5 break-words text-sm font-medium text-[#102945]">
                                                {value ? (
                                                    href ? <a href={href} className="hover:text-teal-700">{value}</a> : value
                                                ) : <span className="font-normal text-slate-400">Не указано</span>}
                                            </dd>
                                        </div>
                                        {value && key !== 'department' && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 shrink-0"
                                                title="Скопировать"
                                                aria-label={`Скопировать: ${label}`}
                                                onClick={() => copyValue(`${selectedUser.id}-${key}`, value)}
                                            >
                                                {copiedKey === `${selectedUser.id}-${key}`
                                                    ? <Check className="h-4 w-4 text-emerald-700" />
                                                    : <Copy className="h-4 w-4" />}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </dl>

                            {canAct && (
                                <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-slate-200 px-6 py-4">
                                    {canManageDirectory && (
                                        <Button type="button" variant="destructive" size="sm" className="gap-1.5" onClick={() => fromSheet(handleDeleteUser)(selectedUser)}>
                                            <Trash2 className="h-4 w-4" />
                                            Удалить
                                        </Button>
                                    )}
                                    {canManagePhotos && (
                                        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fromSheet(openPhotoDialog)(selectedUser)}>
                                            <ImageIcon className="h-4 w-4" />
                                            Фото
                                        </Button>
                                    )}
                                    {canManageDirectory && (
                                        <Button type="button" size="sm" className="gap-1.5" onClick={() => fromSheet(openEditDialog)(selectedUser)}>
                                            <Pencil className="h-4 w-4" />
                                            Редактировать
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <div className="admin-page-wrap space-y-6">
                <form
                    onSubmit={submitFilters}
                    className="flex flex-col gap-3 rounded-[14px] border border-slate-200 bg-white p-3 shadow-[0_1px_2px_0_rgba(25,28,29,0.04)] md:flex-row md:items-center"
                >
                    <label className="relative min-w-0 flex-1">
                        <span className="sr-only">Поиск</span>
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <Input
                            className="h-12 border-transparent bg-slate-50 pl-12 pr-10 text-base shadow-none focus-visible:bg-white"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Имя, телефон, внутренний номер, почта или должность"
                        />
                        {search !== '' && (
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                aria-label="Очистить поиск"
                                onClick={() => setSearch('')}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </label>

                    <label className="md:w-72">
                        <span className="sr-only">Департамент</span>
                        <select
                            className={`${qdFieldClass} h-12`}
                            value={departmentId}
                            onChange={(event) => setDepartmentId(event.target.value)}
                        >
                            <option value="">Все департаменты</option>
                            {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                    {department.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="flex gap-2">
                        <Button type="submit" size="lg" className="h-12 flex-1 gap-2 md:flex-none">
                            <Search className="h-4 w-4" />
                            Найти
                        </Button>
                        {hasFilters && (
                            <Button type="button" variant="outline" size="lg" className="h-12" onClick={clearFilters}>
                                Сбросить
                            </Button>
                        )}
                    </div>
                </form>

                {localSections.length === 0 ? (
                    <EmptyState title="Записей не найдено" description="Измените запрос или выберите другой департамент." action={<Button type="button" variant="outline" onClick={clearFilters}>Сбросить фильтры</Button>} />
                ) : (
                    <div className="grid items-start gap-6 2xl:grid-cols-[17rem_minmax(0,1fr)]">
                        <nav aria-label="Подразделения" className="hidden 2xl:sticky 2xl:top-6 2xl:block">
                            <p className="qd-field-label mb-3 px-3">Подразделения</p>
                            <ul className="space-y-0.5">
                                {localSections.map((section) => {
                                    const active = activeSectionKey === sectionKey(section);

                                    return (
                                        <li key={sectionKey(section)}>
                                            <button
                                                type="button"
                                                onClick={() => jumpToSection(section)}
                                                className={`flex w-full items-center justify-between gap-3 rounded-[10px] border-l-2 px-3 py-2 text-left text-sm transition-colors ${active
                                                    ? 'border-teal-700 bg-white font-semibold text-[#102945] shadow-[0_1px_2px_0_rgba(25,28,29,0.06)]'
                                                    : 'border-transparent text-slate-600 hover:bg-white/70 hover:text-[#102945]'}`}
                                            >
                                                <span className="min-w-0 truncate">{section.name}</span>
                                                <span className={`shrink-0 text-xs tabular-nums ${active ? 'text-teal-700' : 'text-slate-400'}`}>{(section.items ?? []).length}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>

                        <div className="min-w-0 space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm text-slate-600">
                                    <span className="font-semibold tabular-nums text-[#102945]">{shownCount}</span>
                                    {' '}в выдаче
                                    {appliedSearch !== '' && <> по запросу «<span className="font-medium text-[#102945]">{appliedSearch}</span>»</>}
                                    {canManageDirectory && <span className="hidden text-slate-400 sm:inline"> · порядок меняется перетаскиванием</span>}
                                </p>
                                <Segmented
                                    items={[
                                        { key: 'list', label: <span className="inline-flex items-center gap-1.5"><List className="h-4 w-4" />Список</span> },
                                        { key: 'cards', label: <span className="inline-flex items-center gap-1.5"><LayoutGrid className="h-4 w-4" />Визитки</span> },
                                    ]}
                                    value={viewMode}
                                    onChange={setViewMode}
                                />
                            </div>

                            {localSections.length > 1 && (
                                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 2xl:hidden">
                                    {localSections.map((section) => (
                                        <button
                                            key={sectionKey(section)}
                                            type="button"
                                            onClick={() => jumpToSection(section)}
                                            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700 hover:border-teal-600/40 hover:text-[#102945]"
                                        >
                                            {section.name}
                                            <span className="text-xs tabular-nums text-slate-400">{(section.items ?? []).length}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {localSections.map((section) => (
                                <section
                                    key={sectionKey(section)}
                                    id={anchorId(section)}
                                    data-section-key={sectionKey(section)}
                                    className="scroll-mt-6"
                                    onDragOver={(event) => {
                                        if (canManageDirectory) {
                                            event.preventDefault();
                                        }
                                    }}
                                    onDrop={(event) => handleDropOnSection(event, section)}
                                >
                                    {viewMode === 'list' ? (
                                        <Card className="overflow-hidden">
                                            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                                                <CardTitle className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4" />
                                                    {section.name}
                                                </CardTitle>
                                                <span className="text-xs font-semibold tabular-nums text-slate-500">{(section.items ?? []).length}</span>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <ul className="divide-y divide-slate-200">
                                                    {(section.items ?? []).map((item) => renderListRow(section, item))}
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-2">
                                                <h2 className="font-display text-lg font-bold text-[#102945]">{section.name}</h2>
                                                <span className="text-xs font-semibold tabular-nums text-slate-500">{(section.items ?? []).length}</span>
                                            </div>
                                            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr))]">
                                                {(section.items ?? []).map((item) => renderCard(section, item))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
