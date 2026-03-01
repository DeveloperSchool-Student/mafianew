import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { Send, MessageSquare } from 'lucide-react';

interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    timestamp: string;
}

export function LobbyChat() {
    const { socket, user } = useAppStore();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputQuery, setInputQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!socket) return;

        const handleGlobalChat = (msg: ChatMessage) => {
            setMessages((prev) => [...prev, msg].slice(-50)); // Keep last 50 messages
        };

        socket.on('global_chat_message', handleGlobalChat);

        return () => {
            socket.off('global_chat_message', handleGlobalChat);
        };
    }, [socket]);

    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputQuery.trim() || !socket) return;

        socket.emit('chat_message', {
            roomId: 'global', // We use 'global' to identify lobby chat in gateway
            message: inputQuery.trim()
        });

        setInputQuery('');
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-4 right-4 z-40 p-3 sm:p-4 rounded-full shadow-lg transition-all 
                 ${isOpen ? 'bg-gray-800 text-white' : 'bg-mafia-red hover:bg-red-700 text-white animate-bounce shadow-[0_0_15px_rgba(204,0,0,0.5)]'}`}
            >
                <MessageSquare size={24} />
            </button>

            {/* Chat Panel */}
            <div
                className={`fixed bottom-[76px] right-4 sm:bottom-4 sm:right-20 z-40 w-[calc(100%-2rem)] sm:w-80 md:w-96 bg-[#161616] border border-gray-800 rounded-xl shadow-2xl transition-all duration-300 transform origin-bottom-right
                ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
                style={{ height: '60vh', maxHeight: '500px' }}
            >
                <div className="flex flex-col h-full">
                    <div className="bg-gradient-to-r from-red-900/40 to-[#111] p-3 border-b border-gray-800 rounded-t-xl flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <MessageSquare size={16} className="text-mafia-red" />
                            Глобальний Чат
                        </h3>
                        <span className="text-xs text-gray-400">{messages.length} повідомлень</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <MessageSquare size={32} className="mb-2 opacity-50" />
                                <p className="text-sm">Тут ще нічого немає.</p>
                                <p className="text-xs">Напишіть першим!</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg) => {
                                    const isMe = msg.sender === user?.username;
                                    return (
                                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span className={`text-xs font-bold ${isMe ? 'text-mafia-red' : 'text-gray-300'}`}>
                                                    {isMe ? 'Ви' : msg.sender}
                                                </span>
                                                <span className="text-[10px] text-gray-500">{formatTime(msg.timestamp)}</span>
                                            </div>
                                            <div className={`px-3 py-2 rounded-lg text-sm max-w-[85%] break-words
                                                ${isMe ? 'bg-red-900/30 border border-mafia-red/30 text-white rounded-tr-none'
                                                    : 'bg-[#1a1a1a] border border-gray-700 text-gray-200 rounded-tl-none'}`}
                                            >
                                                {msg.text}
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-3 border-t border-gray-800 bg-[#111] rounded-b-xl">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                value={inputQuery}
                                onChange={(e) => setInputQuery(e.target.value)}
                                placeholder="Повідомлення..."
                                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-full py-2 pl-4 pr-10 text-white text-sm focus:border-mafia-red focus:outline-none transition-colors"
                            />
                            <button
                                type="submit"
                                disabled={!inputQuery.trim()}
                                className="absolute right-2 p-1.5 text-mafia-red hover:text-red-400 disabled:text-gray-600 transition-colors"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #333;
                    border-radius: 10px;
                }
            `}</style>
        </>
    );
}
