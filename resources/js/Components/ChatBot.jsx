import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ChatBot({ isOpen, setIsOpen }) {
    const { t } = useTranslation();
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: t('chat_initial_message') || 'Привет! Я AI помощник KazUTB. Чем я могу вам помочь? Я могу ответить на вопросы о системе KPI и помочь найти нужный кабинет или сервис.',
            isBot: true,
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const userMessage = {
            id: messages.length + 1,
            text: inputValue,
            isBot: false,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Call the AI chat API
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    messages: messages
                        .filter((msg) => msg.text)
                        .map((msg) => ({
                            role: msg.isBot ? 'assistant' : 'user',
                            text: msg.text,
                        }))
                        .concat([
                            {
                                role: 'user',
                                text: userMessage.text,
                            },
                        ]),
                }),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const botResponse = {
                id: messages.length + 2,
                text: data.text || t('chat_response') || 'Извините, не смог получить ответ.',
                isBot: true,
            };

            setMessages((prev) => [...prev, botResponse]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = {
                id: messages.length + 2,
                text: t('chat_error') || 'Извините, произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.',
                isBot: true,
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
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
                        <p>{t('chat_subtitle') || 'Спросите о KPI, сервисах или расписании'}</p>
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
                    {isLoading && (
                        <div className="chat-bot-message bot">
                            <div className="chat-bot-bubble">
                                <span className="loading-dots">●●●</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="chat-bot-helper-text">
                    {t('chat_helper_text') || 'Задайте вопрос о KPI системе, кабинетах или сервисах.'}
                </div>

                <div className="chat-bot-input-area">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={t('chat_placeholder') || 'Например: как создать KPI-запись?'}
                        className="chat-bot-input"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSendMessage}
                        className="chat-bot-send"
                        disabled={!inputValue.trim() || isLoading}
                    >
                        {isLoading ? (
                            <span>{t('chat_sending') || 'Отправка...'}</span>
                        ) : (
                            <>
                                {t('chat_send') || 'Отправить'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
