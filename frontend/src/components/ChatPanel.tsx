import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store';

interface ChatPanelProps {
    donMode: 'KILL' | 'CHECK_DON';
    setDonMode: (mode: 'KILL' | 'CHECK_DON') => void;
    lastWill: string;
    setLastWill: (will: string) => void;
    showLastWill: boolean;
    setShowLastWill: (show: boolean) => void;
    submitLastWill: () => void;
}

export function ChatPanel({
    donMode, setDonMode,
    lastWill, setLastWill,
    showLastWill, setShowLastWill,
    submitLastWill
}: ChatPanelProps) {
    const { user, gameState, socket } = useAppStore();
    const [activeTab, setActiveTab] = useState<'chat' | 'notepad'>('chat');
    const [chatInput, setChatInput] = useState('');
    const [notepad, setNotepad] = useState(() => localStorage.getItem(`mafia_notepad_${useAppStore.getState().gameState.roomId}`) || '');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (gameState.roomId) {
            localStorage.setItem(`mafia_notepad_${gameState.roomId}`, notepad);
        }
    }, [notepad, gameState.roomId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [gameState.chat]);

    const sendChat = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !socket || !gameState.roomId) return;
        socket.emit('chat_message', { roomId: gameState.roomId, message: chatInput });
        setChatInput('');
    };

    const me = gameState.players?.find(p => p.userId === user?.id);
    const isGameOver = gameState.phase === 'END_GAME';

    return (
        <div className="bg-[#111] border border-gray-800 rounded flex flex-col h-[500px]">
            <div className="p-4 border-b border-gray-800 bg-black/50 flex justify-between items-center">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`text-sm font-bold ${activeTab === 'chat' ? 'text-gray-200' : 'text-gray-600'}`}
                    >ЧАТ</button>
                    <button
                        onClick={() => setActiveTab('notepad')}
                        className={`text-sm font-bold ${activeTab === 'notepad' ? 'text-gray-200' : 'text-gray-600'}`}
                    >БЛОКНОТ</button>
                </div>

                <div className="flex gap-2 text-xs">
                    {me?.isAlive && (
                        <button
                            onClick={() => setShowLastWill(!showLastWill)}
                            className="px-2 py-1 border border-gray-700 rounded text-gray-400 hover:text-white"
                        >✍️ Заповіт</button>
                    )}
                    {gameState.myRole === 'DON' && gameState.phase === 'NIGHT' && (
                        <>
                            <button
                                onClick={() => setDonMode('KILL')}
                                className={`px-2 py-1 border rounded ${donMode === 'KILL' ? 'bg-mafia-red border-red-500 text-white' : 'border-gray-700 text-gray-400'}`}
                            >
                                ВБИТИ
                            </button>
                            <button
                                onClick={() => setDonMode('CHECK_DON')}
                                className={`px-2 py-1 border rounded ${donMode === 'CHECK_DON' ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-700 text-gray-400'}`}
                            >
                                ПЕРЕВІРИТИ
                            </button>
                        </>
                    )}
                </div>
            </div>

            {showLastWill && (
                <div className="p-4 bg-gray-900 border-b border-gray-700">
                    <p className="text-xs text-gray-400 mb-2">Напишіть заповіт, який буде показано всім після вашої смерті:</p>
                    <textarea
                        className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm focus:outline-none focus:border-gray-500 mb-2"
                        rows={2}
                        value={lastWill}
                        onChange={e => setLastWill(e.target.value)}
                        maxLength={150}
                    />
                    <div className="flex justify-end">
                        <button onClick={submitLastWill} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded">Зберегти</button>
                    </div>
                </div>
            )}

            <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col">
                {activeTab === 'chat' ? (
                    <div className="flex flex-col gap-2 mt-auto">
                        {gameState.chat?.map(msg => (
                            <div key={msg.id} className={`p-2 rounded text-sm ${msg.type === 'system' ? 'bg-[#1a1a1a] text-gray-400 border-l-2 border-mafia-red' :
                                msg.type === 'mafia' ? 'bg-red-900/20 text-red-200 border-l-2 border-red-500' :
                                    msg.type === 'dead' ? 'bg-gray-900 text-gray-500 italic' :
                                        'bg-[#222] text-gray-200'
                                }`}>
                                {msg.type !== 'system' && <span className="font-bold mr-2 opacity-70">
                                    {msg.type === 'dead' && '[Мертві/Глядачі] '}
                                    {msg.sender}:</span>}
                                <span>{msg.text}</span>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                ) : (
                    <textarea
                        className="w-full h-full bg-transparent text-gray-300 resize-none outline-none text-sm font-mono whitespace-pre-wrap flex-1"
                        placeholder="Ваші приватні нотатки... (зберігаються тільки для вас)"
                        value={notepad}
                        onChange={e => setNotepad(e.target.value)}
                    />
                )}
            </div>

            {activeTab === 'chat' && (
                <form onSubmit={sendChat} className="p-3 border-t border-gray-800 bg-black/50">
                    <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder={isGameOver ? 'Гра закінчена' : gameState.phase === 'NIGHT' && gameState.myRole !== 'MAFIA' && gameState.myRole !== 'DON' ? 'Ви спите...' : 'Написати в чат...'}
                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-gray-500 text-sm disabled:opacity-50"
                        disabled={isGameOver || !me?.isAlive || (gameState.phase === 'NIGHT' && gameState.myRole !== 'MAFIA' && gameState.myRole !== 'DON')}
                    />
                </form>
            )}
        </div>
    );
}
