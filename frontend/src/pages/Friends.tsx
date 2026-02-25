import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, UserPlus, Check, X, Trash2, MessageSquare } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Friend {
    id: string;
    status: 'pending' | 'accepted' | 'blocked';
    isSender: boolean;
    friend: {
        id: string;
        username: string;
        profile?: {
            avatarUrl?: string;
            level: number;
        };
    };
    createdAt: string;
}

export function Friends() {
    const { user, socket, gameState } = useAppStore();
    const navigate = useNavigate();
    const [friendsList, setFriendsList] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'friends' | 'requests'>('friends');
    const [addUsername, setAddUsername] = useState('');
    const [addError, setAddError] = useState('');

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchFriends();
    }, [user, navigate]);

    const fetchFriends = async () => {
        try {
            const res = await axios.get(`${API_URL}/friends`, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            setFriendsList(res.data);
        } catch (err) {
            console.error('Failed to fetch friends', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError('');
        try {
            await axios.post(`${API_URL}/friends/request`, { friendUsername: addUsername }, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            setAddUsername('');
            fetchFriends();
            alert('Запит надіслано!');
        } catch (err: any) {
            setAddError(err.response?.data?.message || 'Помилка надсилання запиту');
        }
    };

    const handleAccept = async (id: string) => {
        try {
            await axios.post(`${API_URL}/friends/accept/${id}`, {}, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            fetchFriends();
        } catch (err) {
            console.error(err);
        }
    };

    const handleReject = async (id: string) => {
        try {
            await axios.post(`${API_URL}/friends/reject/${id}`, {}, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            fetchFriends();
        } catch (err) {
            console.error(err);
        }
    };

    const handleRemove = async (id: string) => {
        if (!window.confirm('Ви впевнені, що хочете видалити цього друга?')) return;
        try {
            await axios.post(`${API_URL}/friends/remove/${id}`, {}, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            fetchFriends();
        } catch (err) {
            console.error(err);
        }
    };

    const acceptedFriends = friendsList.filter(f => f.status === 'accepted');
    const pendingRequests = friendsList.filter(f => f.status === 'pending' && !f.isSender);
    const sentRequests = friendsList.filter(f => f.status === 'pending' && f.isSender);

    return (
        <div className="min-h-screen bg-mafia-dark text-mafia-light p-6">
            <div className="max-w-3xl mx-auto mt-10">
                <button
                    onClick={() => navigate('/lobby')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
                >
                    &larr; Назад у лоббі
                </button>

                <div className="bg-[#161616] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                    <div className="bg-[#1a1a1a] p-6 border-b border-gray-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Users size={32} className="text-blue-500" />
                            <h1 className="text-3xl font-bold tracking-widest text-white uppercase">Друзі</h1>
                        </div>
                        <div className="flex gap-2 bg-black/50 p-1 rounded-lg">
                            <button
                                onClick={() => setTab('friends')}
                                className={`px-4 py-2 rounded font-bold text-sm transition-colors ${tab === 'friends' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Список ({acceptedFriends.length})
                            </button>
                            <button
                                onClick={() => setTab('requests')}
                                className={`px-4 py-2 rounded font-bold text-sm flex items-center gap-2 transition-colors ${tab === 'requests' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Запити
                                {pendingRequests.length > 0 && (
                                    <span className="bg-mafia-red text-white text-[10px] px-2 py-0.5 rounded-full">
                                        {pendingRequests.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="p-6">
                        {/* Форма додавання */}
                        <form onSubmit={handleSendRequest} className="mb-8 bg-[#111] p-4 rounded border border-gray-800">
                            <label className="block text-sm text-gray-400 mb-2 font-bold uppercase tracking-wider flex items-center gap-2"><UserPlus size={16} /> Додати друга</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={addUsername}
                                    onChange={e => setAddUsername(e.target.value)}
                                    placeholder="Введіть нікнейм..."
                                    className="flex-1 bg-[#1a1a1a] border border-gray-700 p-3 rounded text-white text-sm focus:outline-none focus:border-blue-500 transition-colors uppercase"
                                />
                                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded font-bold text-sm transition-colors uppercase tracking-wider">
                                    Надіслати
                                </button>
                            </div>
                            {addError && <p className="text-red-500 text-xs mt-2 font-bold">{addError}</p>}
                        </form>

                        {loading ? (
                            <div className="p-10 text-center text-gray-500 animate-pulse">Завантаження...</div>
                        ) : tab === 'friends' ? (
                            <div>
                                {acceptedFriends.length === 0 ? (
                                    <div className="p-10 text-center text-gray-500 bg-[#111] rounded border border-gray-800">У вас ще немає друзів.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {acceptedFriends.map(f => (
                                            <div key={f.id} className="flex items-center justify-between bg-[#1a1a1a] p-4 rounded border border-gray-800/50 hover:border-gray-600 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800 border-2 border-gray-700 flex items-center justify-center font-bold text-xl">
                                                        {f.friend.profile?.avatarUrl ? (
                                                            <img src={f.friend.profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                                                        ) : (
                                                            f.friend.username.charAt(0)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-lg text-white uppercase tracking-wider">{f.friend.username}</h3>
                                                        <p className="text-xs text-gray-500">Рівень {f.friend.profile?.level || 1}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    {gameState.roomId && (
                                                        <button onClick={() => {
                                                            socket?.emit('invite_to_room', { targetUserId: f.friend.id, roomId: gameState.roomId });
                                                        }} className="bg-green-900/30 hover:bg-green-800 text-green-400 p-2 rounded transition-colors border border-green-800/50" title="Запросити в кімнату">
                                                            <UserPlus size={18} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => navigate(`/messages/${f.friend.id}`)} className="bg-blue-900/30 hover:bg-blue-800 text-blue-400 p-2 rounded transition-colors border border-blue-800/50" title="Написати">
                                                        <MessageSquare size={18} />
                                                    </button>
                                                    <button onClick={() => handleRemove(f.id)} className="bg-red-900/30 hover:bg-red-800 text-red-400 p-2 rounded transition-colors border border-red-800/50" title="Видалити">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-400 mb-3 tracking-widest uppercase border-b border-gray-800 pb-2">Вхідні запити</h3>
                                    {pendingRequests.length === 0 ? (
                                        <p className="text-gray-500 text-sm">Немає нових запитів.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {pendingRequests.map(f => (
                                                <div key={f.id} className="flex items-center justify-between bg-blue-900/10 p-3 rounded border border-blue-900/30">
                                                    <span className="font-bold text-white uppercase">{f.friend.username}</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleAccept(f.id)} className="bg-green-600 hover:bg-green-500 text-white p-2 rounded text-xs px-4 font-bold flex items-center gap-1 transition-colors">
                                                            <Check size={14} /> Прийняти
                                                        </button>
                                                        <button onClick={() => handleReject(f.id)} className="bg-red-900/50 hover:bg-red-800 text-red-100 p-2 rounded text-xs px-4 font-bold flex items-center gap-1 transition-colors border border-red-800">
                                                            <X size={14} /> Відхилити
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-400 mb-3 tracking-widest uppercase border-b border-gray-800 pb-2">Відправлені запити</h3>
                                    {sentRequests.length === 0 ? (
                                        <p className="text-gray-500 text-sm">Немає відправлених запитів.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {sentRequests.map(f => (
                                                <div key={f.id} className="flex items-center justify-between bg-[#111] p-3 rounded border border-gray-800">
                                                    <span className="font-bold text-gray-400 uppercase">{f.friend.username} <span className="text-xs text-gray-600 font-normal normal-case ml-2">(Очікування...)</span></span>
                                                    <button onClick={() => handleReject(f.id)} className="text-gray-500 hover:text-red-500 text-xs flex items-center gap-1 transition-colors">
                                                        Скасувати
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
