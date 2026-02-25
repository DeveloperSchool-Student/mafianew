import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { MessageSquare, Send, ArrowLeft } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Conversation {
    user: { id: string; username: string; profile?: { avatarUrl?: string } };
    lastMessage: { content: string; createdAt: string; readAt: string | null };
    unreadCount: number;
}

interface Message {
    id: string;
    fromId: string;
    toId: string;
    content: string;
    createdAt: string;
}

export function Messages() {
    const { user } = useAppStore();
    const navigate = useNavigate();
    const { id: targetId } = useParams();

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        fetchConversations();
        if (targetId) {
            fetchMessages(targetId);
        } else {
            setLoading(false);
        }

        // Polling for updates (for simplicity without sockets)
        const interval = setInterval(() => {
            fetchConversations();
            if (targetId) fetchMessages(targetId, true);
        }, 5000);
        return () => clearInterval(interval);
    }, [user, navigate, targetId]);

    const fetchConversations = async () => {
        try {
            const res = await axios.get(`${API_URL}/pm/conversations`, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            setConversations(res.data);
        } catch (err) {
            console.error('Failed to fetch conversations', err);
        }
    };

    const fetchMessages = async (targetId: string, background = false) => {
        if (!background) setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/pm/chat/${targetId}`, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            setMessages(res.data);
            if (!background) scrollToBottom();
        } catch (err) {
            console.error('Failed to fetch messages', err);
        } finally {
            if (!background) setLoading(false);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!newMessage.trim() || !targetId) return;

        try {
            await axios.post(`${API_URL}/pm/send`, { targetId, content: newMessage }, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            setNewMessage('');
            fetchMessages(targetId);
            fetchConversations();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Помилка відправки');
        }
    };

    const targetUser = conversations.find(c => c.user.id === targetId)?.user;

    return (
        <div className="min-h-screen bg-mafia-dark text-white p-6">
            <div className="max-w-5xl mx-auto mt-6 flex flex-col md:flex-row gap-6 h-[80vh]">

                {/* Sidebar - Conversations */}
                <div className={`w-full ${targetId ? 'hidden md:flex' : 'flex'} md:w-1/3 bg-[#161616] border border-gray-800 rounded-xl flex-col overflow-hidden`}>
                    <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#1a1a1a]">
                        <h2 className="text-xl font-bold tracking-widest uppercase flex items-center gap-2">
                            <MessageSquare size={20} className="text-blue-500" /> Діалоги
                        </h2>
                        <button onClick={() => navigate('/friends')} className="text-xs text-blue-400 hover:underline">До друзів</button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <p className="p-6 text-center text-gray-500 text-sm">Немає діалогів. Почніть спілкування з друзями!</p>
                        ) : (
                            conversations.map(conv => (
                                <Link
                                    key={conv.user.id}
                                    to={`/messages/${conv.user.id}`}
                                    className={`flex items-center gap-3 p-4 border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors ${targetId === conv.user.id ? 'bg-gray-800/80 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold overflow-hidden shrink-0">
                                        {conv.user.profile?.avatarUrl ? <img src={conv.user.profile.avatarUrl} className="w-full h-full object-cover" /> : conv.user.username.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-sm truncate uppercase">{conv.user.username}</span>
                                            <span className="text-[10px] text-gray-500 shrink-0">{new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-white font-bold' : 'text-gray-500'}`}>
                                                {conv.lastMessage.content}
                                            </span>
                                            {conv.unreadCount > 0 && (
                                                <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-2">
                                                    {conv.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className={`w-full ${!targetId ? 'hidden md:flex items-center justify-center text-gray-500' : 'flex'} md:w-2/3 bg-[#111] border border-gray-800 rounded-xl flex-col h-full overflow-hidden relative`}>
                    {!targetId ? (
                        <div className="text-center p-8">
                            <MessageSquare size={48} className="mx-auto mb-4 text-gray-700" />
                            <p className="text-lg">Виберіть діалог для спілкування</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 border-b border-gray-800 bg-[#161616] flex items-center gap-3">
                                <button onClick={() => navigate('/messages')} className="md:hidden text-gray-400 p-1">
                                    <ArrowLeft size={20} />
                                </button>
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold">
                                    {targetUser?.profile?.avatarUrl ? <img src={targetUser.profile.avatarUrl} className="w-full h-full object-cover rounded-full" /> : targetUser?.username?.charAt(0) || '?'}
                                </div>
                                <h3 className="font-bold uppercase tracking-wider">{targetUser?.username || 'Користувач'}</h3>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
                                {loading && messages.length === 0 ? (
                                    <div className="text-center text-gray-500 my-auto">Завантаження...</div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center text-gray-600 my-auto text-sm">Немає повідомлень. Напишіть щось!</div>
                                ) : (
                                    messages.map((msg, idx) => {
                                        const isMine = msg.fromId === user?.id;
                                        const showTime = idx === 0 || new Date(msg.createdAt).getTime() - new Date(messages[idx - 1].createdAt).getTime() > 300000;

                                        return (
                                            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                                {showTime && <span className="text-[10px] text-gray-600 mb-2 my-2 mx-auto">{new Date(msg.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>}
                                                <div className={`max-w-[75%] rounded-xl p-3 text-sm ${isMine ? 'bg-blue-600 rounded-tr-sm text-white' : 'bg-[#1a1a1a] border border-gray-700 rounded-tl-sm text-gray-200'}`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800 bg-[#161616]">
                                {error && <p className="text-red-500 text-xs mb-2 font-bold">{error}</p>}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        placeholder="Написати повідомлення..."
                                        className="flex-1 bg-[#1a1a1a] border border-gray-700 p-3 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim()}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 disabled:text-gray-500 text-white p-3 rounded-xl transition-colors flex items-center justify-center aspect-square"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
