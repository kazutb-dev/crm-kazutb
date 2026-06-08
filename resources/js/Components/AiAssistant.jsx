/**
 * AiAssistant — shared public portal AI modal.
 * University-grade chat assistant experience.
 */
import { RefreshCw, Send, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const SERIF = { fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' };

const SUGGESTED = [
    'Где деканат?',
    'Контакты ректората',
    'Как получить справку?',
    'Где библиотека?',
];

const WELCOME_TEXT = 'Здравствуйте!\n\nЯ цифровой помощник КазУТБ.\n\nЯ могу помочь:\n• найти кабинет\n• найти подразделение\n• найти сотрудника\n• найти сервис\n• найти контакты\n• объяснить работу портала';

const INITIAL_MESSAGE = {
    id: 1,
    role: 'assistant',
    text: WELCOME_TEXT,
    isError: false,
};

/* ── Avatar ── */
function AssistantAvatar() {
    return (
        <div className="relative flex-shrink-0">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#E8A020]/18 shadow-[0_6px_18px_rgba(0,0,0,.22)]">
                <img
                    src="/assets/images/logo.png"
                    alt="КазУТБ"
                    className="h-full w-full object-cover"
                />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d1f38] bg-emerald-400" />
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
            <div className="flex items-start gap-3">
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
            <div className="flex items-end justify-end gap-3">
                <div className="max-w-[72%] rounded-2xl rounded-br-sm bg-[#E8A020] px-5 py-3.5">
                    <p className="text-[16px] font-medium leading-[1.55] text-[#0a1e36]">
                        {msg.text}
                    </p>
                </div>
                <UserAvatar />
            </div>
        );
    }

    return (
        <div className="flex items-start gap-3">
            <AssistantAvatar />
            <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-white/[0.08] px-5 py-4">
                <p className="whitespace-pre-wrap text-[16px] leading-[1.6] text-white/90">
                    {msg.text}
                </p>
            </div>
        </div>
    );
}

/* ── Suggested chips (inside chat area, below welcome) ── */
function SuggestedChips({ onSelect }) {
    return (
        <div className="mt-4 flex flex-wrap gap-2 pl-12">
            {SUGGESTED.map((prompt) => (
                <button
                    key={prompt}
                    type="button"
                    onClick={() => onSelect(prompt)}
                    className="rounded-full bg-white/[0.07] px-4 py-2 text-[13px] text-white/65 transition hover:bg-[#E8A020]/12 hover:text-white/88 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8A020]"
                >
                    {prompt}
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
            className="animate-fade-in fixed inset-0 z-[90] flex items-end justify-center bg-[#020d1a]/78 px-0 backdrop-blur-[5px] sm:items-center sm:px-6"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="AI Ассистент КазУТБ"
                className="animate-modal-in flex w-full flex-col overflow-hidden bg-[#0d1f38] shadow-[0_48px_120px_rgba(0,0,0,.9)] sm:max-w-[860px] sm:rounded-[18px]"
                style={{ height: 'min(92vh, 800px)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex flex-shrink-0 items-center justify-between bg-[#091828] px-6 py-4">
                <div className="flex items-center gap-3.5">
                    <div className="relative">
                            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#E8A020]/18 shadow-[0_8px_22px_rgba(0,0,0,.25)]">
                                <img
                                    src="/assets/images/logo.png"
                                    alt="КазУТБ"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#091828] bg-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/45">
                                Цифровой помощник
                            </p>
                            <h2 style={SERIF} className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-white">
                                AI Ассистент КазУТБ
                            </h2>
                            <p className="mt-1 text-[12px] text-white/52">
                                Онлайн · Готов помочь
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white/35 transition hover:bg-white/8 hover:text-white/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8A020]"
                        aria-label="Закрыть"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* ── Messages ── */}
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
                    <div className="space-y-5">
                        {messages.map((msg, index) => (
                            <div key={msg.id}>
                                <MessageBubble
                                    msg={msg}
                                    onRetry={msg.isError ? handleRetry : undefined}
                                />
                                {/* Suggested chips appear right after welcome message if no user message yet */}
                                {index === 0 && !hasUserMessage && (
                                    <SuggestedChips onSelect={doSend} />
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div className="flex items-center gap-3">
                                <AssistantAvatar />
                                <div className="rounded-2xl rounded-tl-sm bg-white/[0.08] px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/45" style={{ animationDelay: '0ms' }} />
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/45" style={{ animationDelay: '160ms' }} />
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/45" style={{ animationDelay: '320ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={endRef} />
                    </div>
                </div>

                {/* ── Divider ── */}
                <div className="h-px bg-white/[0.06]" />

                {/* ── Input ── */}
                <div className="flex-shrink-0 bg-[#091828] px-6 py-4">
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
                            placeholder="Напишите ваш вопрос..."
                            disabled={loading}
                            className="h-12 w-full rounded-xl bg-white px-5 text-[16px] text-[#0a1e36] outline-none placeholder:text-[#0a1e36]/60 transition focus:bg-white/95 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Вопрос для AI-ассистента"
                        />
                        <button
                            type="button"
                            onClick={() => doSend()}
                            disabled={loading || !input.trim()}
                            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8A020] text-[#0a1e36] shadow-[0_4px_20px_rgba(232,160,32,.35)] transition hover:bg-[#d08c12] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8A020]"
                            aria-label="Отправить"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
