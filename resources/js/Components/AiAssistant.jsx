/**
 * AiAssistant — shared public portal AI modal.
 * A university digital companion: integrated into the portal's
 * design system, not a generic chatbot widget.
 */
import { FileCheck, MapPin, RefreshCw, Send, ShieldCheck, Sparkles, User, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const SUGGESTED = [
    { icon: MapPin, label: 'Где деканат?' },
    { icon: Users, label: 'Контакты ректората' },
    { icon: FileCheck, label: 'Как получить справку?' },
    { icon: Sparkles, label: 'Что умеет портал?' },
];

const WELCOME_TEXT = 'Здравствуйте! Я цифровой помощник КазУТБ.\n\nПомогу найти кабинет, сотрудника, подразделение или нужный сервис — и объясню, как работает портал.';

const INITIAL_MESSAGE = {
    id: 1,
    role: 'assistant',
    text: WELCOME_TEXT,
    isError: false,
};

/* ── Avatars ── */
function AssistantAvatar({ size = 40 }) {
    return (
        <div className="relative flex-shrink-0">
            <div
                className="flex items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[rgba(252,187,89,0.16)] shadow-[0_6px_18px_rgba(0,0,0,.22)]"
                style={{ width: size, height: size }}
            >
                <img src="/assets/images/logo.png" alt="КазУТБ" className="h-full w-full object-cover" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--navy-900)] bg-emerald-400" />
        </div>
    );
}

function UserAvatar() {
    return (
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
            <User className="h-[18px] w-[18px] text-white/60" />
        </div>
    );
}

/* ── Message bubble ── */
function MessageBubble({ msg, onRetry }) {
    const isUser = msg.role === 'user';

    if (msg.isError) {
        return (
            <div className="kz-up flex items-start gap-3">
                <AssistantAvatar />
                <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-amber-500/10 px-5 py-4">
                    <p className="text-[15px] leading-relaxed text-amber-200/90">
                        Не удалось получить ответ от сервиса.
                    </p>
                    <p className="mt-1 text-[13px] text-amber-300/55">
                        Попробуйте ещё раз или задайте другой вопрос.
                    </p>
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/8 px-3.5 py-1.5 text-[13px] font-medium text-white/70 transition hover:bg-white/14 hover:text-white"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Попробовать снова
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (isUser) {
        return (
            <div className="kz-up flex items-end justify-end gap-3">
                <div className="max-w-[72%] rounded-2xl rounded-br-sm px-5 py-3.5" style={{ background: 'var(--gradient-gold)' }}>
                    <p className="text-[15px] font-medium leading-[1.55] text-[var(--navy-900)]">
                        {msg.text}
                    </p>
                </div>
                <UserAvatar />
            </div>
        );
    }

    return (
        <div className="kz-up flex items-start gap-3">
            <AssistantAvatar />
            <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-white/[0.08] px-5 py-4">
                <p className="whitespace-pre-wrap text-[15px] leading-[1.6] text-white/90">
                    {msg.text}
                </p>
            </div>
        </div>
    );
}

/* ── Empty state: suggested capabilities ── */
function SuggestedPrompts({ onSelect }) {
    return (
        <div className="kz-up mt-4 grid gap-2 pl-[52px] sm:grid-cols-2" style={{ animationDelay: '160ms' }}>
            {SUGGESTED.map(({ icon: Icon, label }) => (
                <button
                    key={label}
                    type="button"
                    onClick={() => onSelect(label)}
                    className="kz-tile items-center gap-2.5 px-3.5 py-2.5 text-left"
                >
                    <span className="kz-icon-badge h-7 w-7 !rounded-full">
                        <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[13px] font-medium text-white/75">{label}</span>
                </button>
            ))}
        </div>
    );
}

/* ── Main component ── */
export default function AiAssistant({ onClose }) {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [lastUserText, setLastUserText] = useState('');
    const [messages, setMessages] = useState([INITIAL_MESSAGE]);
    const endRef = useRef(null);
    const inputRef = useRef(null);

    const hasUserMessage = messages.some((m) => m.role === 'user');

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 80);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const doSend = async (text) => {
        const value = (text ?? input).trim();
        if (!value || loading) return;

        setLastUserText(value);
        const userMsg = { id: Date.now(), role: 'user', text: value, isError: false };
        const next = [...messages, userMsg];
        setMessages(next);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    messages: next.map(({ role, text: t }) => ({ role, text: t })),
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const reply = (data.text ?? '').trim() || 'Извините, ответ не получен.';
            setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', text: reply, isError: false }]);
        } catch {
            setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', text: '', isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = () => {
        setMessages((prev) => prev.filter((m) => !m.isError));
        doSend(lastUserText);
    };

    return (
        <div
            className="animate-fade-in fixed inset-0 flex items-end justify-center bg-[rgba(2,8,38,0.82)] px-0 backdrop-blur-[6px] sm:items-center sm:px-6"
            style={{ zIndex: 'var(--z-modal)', fontFamily: 'var(--font-sans)' }}
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="AI Ассистент КазУТБ"
                className="animate-modal-in flex w-full flex-col overflow-hidden sm:max-w-[860px] sm:rounded-[var(--radius-lg)] sm:border sm:border-[rgba(9,186,178,0.18)]"
                style={{
                    height: 'min(92vh, 800px)',
                    background: 'rgb(7,18,65)',
                    boxShadow: '0 0 80px rgba(9,186,178,0.14), 0 48px 120px rgba(0,0,0,.85)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgba(9,186,178,0.12)] px-5 py-4 sm:px-6" style={{ background: 'rgb(5,12,48)' }}>
                    <div className="flex items-center gap-3.5">
                        <AssistantAvatar size={48} />
                        <div>
                            <p className="kz-eyebrow">Цифровой помощник университета</p>
                            <h2 className="kz-display mt-1 text-[17px] font-semibold leading-tight">
                                AI Ассистент КазУТБ
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white/35 transition hover:bg-white/8 hover:text-white/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--teal-400)]"
                        aria-label="Закрыть"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* ── Messages ── */}
                <div className="kz-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-6">
                    <div className="space-y-5">
                        {messages.map((msg, index) => (
                            <div key={msg.id}>
                                <MessageBubble
                                    msg={msg}
                                    onRetry={msg.isError ? handleRetry : undefined}
                                />
                                {index === 0 && !hasUserMessage && (
                                    <SuggestedPrompts onSelect={doSend} />
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div className="flex items-center gap-3" role="status" aria-label="Ассистент печатает">
                                <AssistantAvatar />
                                <div className="rounded-2xl rounded-tl-sm bg-white/[0.08] px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--teal-300)]/70" style={{ animationDelay: '0ms' }} />
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--teal-300)]/70" style={{ animationDelay: '160ms' }} />
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--teal-300)]/70" style={{ animationDelay: '320ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={endRef} />
                    </div>
                </div>

                {/* ── Input ── */}
                <div className="flex-shrink-0 border-t border-[rgba(9,186,178,0.12)] px-5 py-4 sm:px-6" style={{ background: 'rgb(5,12,48)' }}>
                    <div className="flex items-center gap-3">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    doSend();
                                }
                            }}
                            placeholder="Напишите ваш вопрос…"
                            disabled={loading}
                            className="kz-field h-12"
                            aria-label="Вопрос для AI-ассистента"
                        />
                        <button
                            type="button"
                            onClick={() => doSend()}
                            disabled={loading || !input.trim()}
                            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--navy-900)] shadow-[var(--shadow-gold)] transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--teal-400)]"
                            style={{ background: 'var(--gradient-gold)' }}
                            aria-label="Отправить"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/35">
                        <ShieldCheck className="h-3 w-3 text-[var(--teal-300)]/60" />
                        Ассистент может ошибаться — проверяйте важную информацию в официальных источниках
                    </p>
                </div>
            </div>
        </div>
    );
}
