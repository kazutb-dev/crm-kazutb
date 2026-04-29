import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ChatBot({ isOpen, setIsOpen }) {
    const { t } = useTranslation();
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: t('chat_initial_message') || 'Привет! Я AI помощник KazUTB. Чем я могу вам помочь?',
            isBot: true,
        },
    ]);
    const [inputValue, setInputValue] = useState('');

    const handleSendMessage = () => {
        if (!inputValue.trim()) return;

        const userMessage = {
            id: messages.length + 1,
            text: inputValue,
            isBot: false,
        };

        setMessages([...messages, userMessage]);
        setInputValue('');

        // Симуляция ответа бота с небольшой задержкой
        setTimeout(() => {
            const botResponse = {
                id: messages.length + 2,
                text: t('chat_response') || 'Я обрабатываю ваш запрос. Эта функция находится в разработке.',
                isBot: true,
            };
            setMessages((prev) => [...prev, botResponse]);
        }, 500);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="chat-bot-overlay" onClick={() => setIsOpen(false)}>
            <div className="chat-bot-modal" onClick={(e) => e.stopPropagation()}>
                <div className="chat-bot-header">
                    <div className="chat-bot-title">
                        <h3>Campus AI</h3>
                        <p>{t('chat_subtitle') || 'Сросите о сервисах, справках или расписании'}</p>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="chat-bot-close"
                        aria-label="Close chat"
                    >
                        {t('chat_close') || 'Закрыть'}
                    </button>
                </div>

                <div className="chat-bot-messages">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`chat-bot-message ${msg.isBot ? 'bot' : 'user'}`}
                        >
                            <div className="chat-bot-bubble">{msg.text}</div>
                        </div>
                    ))}
                </div>

                <div className="chat-bot-helper-text">
                    {t('chat_helper_text') || 'Задайте вопрос, и я помогу сориентироваться.'}
                </div>

                <div className="chat-bot-input-area">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={t('chat_placeholder') || 'Вадай вопрос (например: как получить справку?)'}
                        className="chat-bot-input"
                    />
                    <button
                        onClick={handleSendMessage}
                        className="chat-bot-send"
                        disabled={!inputValue.trim()}
                    >
                        {t('chat_send') || 'Отправить'}
                    </button>
                </div>
            </div>
        </div>
    );
}
