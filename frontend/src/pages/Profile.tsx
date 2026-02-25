import { useEffect, useState } from 'react';
import { CoinIcon } from '../components/CoinIcon';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Trophy, Hash, Star, Edit2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface UserProfile {
    id: string;
    username: string;
    createdAt: string;
    staffRoleKey?: string | null;
    staffRole?: { title: string; color: string; } | null;
    profile?: {
        mmr: number; matches: number; wins: number; losses: number; avatarUrl?: string; xp?: number; level?: number; activeFrame?: string;
        matchHistory?: {
            id: string; role: string; won: boolean;
            match: { id: string; winner: string; duration: number; createdAt: string; }
        }[]
    };
    wallet?: { soft: number; hard: number };
}

export function Profile() {
    const { user, logout } = useAppStore();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isEditingAvatar, setIsEditingAvatar] = useState(false);
    const [newAvatarUrl, setNewAvatarUrl] = useState('');
    const [quests, setQuests] = useState<any[]>([]);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        axios.get(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${user.token}` }
        })
            .then(res => setProfile(res.data))
            .catch(err => console.error(err));

        axios.get(`${API_URL}/users/quests`, {
            headers: { Authorization: `Bearer ${user.token}` }
        })
            .then(res => setQuests(res.data))
            .catch(err => console.error(err));
    }, [user, navigate]);

    const claimQuest = async (questId: string) => {
        try {
            const res = await axios.post(`${API_URL}/users/quests/claim`, { questId }, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            if (res.data.success) {
                setQuests(prev => prev.map(q => q.id === questId ? { ...q, claimed: true } : q));
                setProfile(p => p ? { ...p, wallet: { ...p.wallet!, soft: p.wallet!.soft + res.data.reward } } : null);
            }
        } catch (err: any) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const handleAvatarSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/users/avatar`, { avatarUrl: newAvatarUrl }, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            setProfile(prev => prev ? { ...prev, profile: { ...prev.profile!, avatarUrl: newAvatarUrl } } : null);
            setIsEditingAvatar(false);
            setNewAvatarUrl('');
        } catch (err) {
            console.error('Failed to update avatar', err);
        }
    };

    if (!profile) return <div className="min-h-screen bg-mafia-dark text-white p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-mafia-dark text-mafia-light p-4 flex flex-col items-center">
            <div className="w-full max-w-2xl mt-8">
                <button onClick={() => navigate('/lobby')} className="mb-4 text-mafia-red hover:underline">&larr; В Лоббі</button>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-8 shadow-2xl">
                    <div className="flex items-center gap-6 mb-8 border-b border-gray-800 pb-6">
                        <div className="relative group flex-shrink-0">
                            <div className={`w-24 h-24 rounded-full bg-mafia-gray border-4 flex items-center justify-center text-4xl font-bold bg-gray-900 ${profile.profile?.activeFrame || 'border-gray-500'} ${!profile.profile?.activeFrame?.includes('shadow') ? 'overflow-hidden' : ''}`}>
                                {profile.profile?.avatarUrl ? (
                                    <img src={profile.profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    profile.username.charAt(0).toUpperCase()
                                )}
                            </div>
                            <button
                                onClick={() => setIsEditingAvatar(!isEditingAvatar)}
                                className="absolute bottom-0 right-0 bg-gray-800 p-2 rounded-full border border-gray-600 hover:bg-gray-700 transition"
                                title="Змінити аватар"
                            >
                                <Edit2 size={14} className="text-white" />
                            </button>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-bold text-white">{profile.username}</h1>
                                {profile.staffRole && (
                                    <span className="px-3 py-1 text-xs font-bold uppercase rounded border" style={{ backgroundColor: `${profile.staffRole.color}20`, borderColor: `${profile.staffRole.color}50`, color: profile.staffRole.color }}>
                                        {profile.staffRole.title}
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-500 text-sm flex items-center gap-2">
                                <Hash size={14} /> ID: {profile.id.split('-')[0]}...
                            </p>
                            <div className="mt-4">
                                <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
                                    <span>РІВЕНЬ {profile.profile?.level || 1}</span>
                                    <span>{profile.profile?.xp || 0} / {(profile.profile?.level || 1) * 500} XP</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div className="bg-mafia-red h-2 rounded-full" style={{ width: `${Math.min(100, ((profile.profile?.xp || 0) / ((profile.profile?.level || 1) * 500)) * 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {isEditingAvatar && (
                        <form onSubmit={handleAvatarSubmit} className="mb-6 bg-[#111] p-4 rounded border border-gray-800">
                            <label className="block text-sm text-gray-400 mb-2">Посилання на зображення (URL)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newAvatarUrl}
                                    onChange={e => setNewAvatarUrl(e.target.value)}
                                    placeholder="https://example.com/avatar.png"
                                    className="flex-1 bg-[#1a1a1a] border border-gray-700 p-2 rounded text-white text-sm focus:outline-none focus:border-mafia-red"
                                />
                                <button type="submit" className="bg-mafia-red hover:bg-red-700 text-white px-4 py-2 rounded font-bold text-sm transition">
                                    Зберегти
                                </button>
                            </div>
                        </form>
                    )}

                    <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-widest uppercase">Щоденні Квести</h3>
                    <div className="space-y-3 mb-8">
                        {quests.map(q => (
                            <div key={q.id} className="bg-[#111] border border-gray-800 rounded p-4 flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-white mb-1">{q.title}</p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-32 bg-gray-800 rounded-full h-1.5">
                                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}></div>
                                        </div>
                                        <span className="text-xs text-gray-500">{q.progress} / {q.target}</span>
                                    </div>
                                </div>
                                <div>
                                    {q.claimed ? (
                                        <span className="text-green-500 font-bold text-sm">Виконано ✓</span>
                                    ) : q.progress >= q.target ? (
                                        <button onClick={() => claimQuest(q.id)} className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded text-sm font-bold transition">
                                            Забрати +{q.reward} <CoinIcon size={14} />
                                        </button>
                                    ) : (
                                        <span className="text-gray-500 text-sm font-bold">Нагорода: {q.reward} <CoinIcon size={14} /></span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {quests.length === 0 && <p className="text-gray-500 text-sm pb-4">Немає активних квестів.</p>}
                    </div>

                    <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-widest uppercase border-t border-gray-800 pt-8">Фінанси та Статистика</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-[#111] p-4 rounded border border-gray-800 text-center">
                            <CoinIcon size={28} className="mb-1" />
                            <p className="text-xs text-gray-500">Монети</p>
                            <p className="text-2xl font-bold text-yellow-500">{profile.wallet?.soft || 0}</p>
                        </div>
                        <div className="bg-[#111] p-4 rounded border border-gray-800 text-center flex flex-col items-center justify-center">
                            <p className="text-xs text-gray-500 mb-2">Рейтинг (MMR)</p>
                            <div className="flex flex-col xl:flex-row items-center justify-center gap-2">
                                <span className="text-2xl font-bold text-white font-mono">{profile.profile?.mmr || 1500}</span>
                                <div className={`flex items-center gap-1 border px-2 border-opacity-50 py-0.5 rounded text-xs font-bold bg-black/40 ${(profile.profile?.mmr || 1500) < 1200 ? 'text-amber-700 border-amber-900' :
                                    (profile.profile?.mmr || 1500) < 1500 ? 'text-gray-400 border-gray-600' :
                                        (profile.profile?.mmr || 1500) < 1800 ? 'text-yellow-400 border-yellow-600' :
                                            'text-cyan-400 border-cyan-800'
                                    }`}>
                                    {(profile.profile?.mmr || 1500) < 1200 ? '🟤 Бронза' : (profile.profile?.mmr || 1500) < 1500 ? '⚪ Срібло' : (profile.profile?.mmr || 1500) < 1800 ? '🟡 Золото' : '💎 Діамант'}
                                </div>
                            </div>
                        </div>
                        <div className="bg-[#111] p-4 rounded border border-gray-800 text-center">
                            <Trophy className="mx-auto mb-2 text-mafia-light" size={24} />
                            <p className="text-xs text-gray-500">Матчі</p>
                            <p className="text-2xl font-bold text-white">{profile.profile?.matches || 0}</p>
                        </div>
                        <div className="bg-[#111] p-4 rounded border border-gray-800 text-center">
                            <p className="text-xs text-green-500 mb-2 font-bold uppercase">Перемоги / Поразки</p>
                            <p className="text-2xl font-bold text-white">
                                <span className="text-green-400">{profile.profile?.wins || 0}</span> <span className="text-gray-600 mx-1">/</span> <span className="text-mafia-red">{profile.profile?.losses || 0}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-8 pt-6 border-t border-gray-800">
                        <button onClick={logout} className="flex-1 bg-mafia-gray hover:bg-gray-800 text-white font-bold py-3 px-4 rounded transition-colors border border-gray-700">
                            Вийти з акаунту
                        </button>
                        <button onClick={() => navigate('/lobby')} className="flex-2 bg-mafia-red hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-colors">
                            ГРАТИ
                        </button>
                    </div>

                    {profile.profile?.matchHistory && profile.profile.matchHistory.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-gray-800">
                            <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-widest uppercase">Історія Матчів</h3>
                            <div className="space-y-2">
                                {profile.profile.matchHistory.map(mh => (
                                    <div key={mh.id} className="bg-[#111] border border-gray-800 rounded p-4 outline outline-1 outline-transparent hover:outline-gray-700 transition flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-2 h-10 rounded-full ${mh.won ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <div>
                                                <p className="text-white font-bold text-lg mb-1">{mh.role === 'MAFIA' || mh.role === 'DON' ? <span className="text-red-500">{mh.role}</span> : (mh.role === 'SHERIFF' ? <span className="text-yellow-500">{mh.role}</span> : (mh.role === 'JESTER' ? <span className="text-pink-500">{mh.role}</span> : <span className="text-blue-500">{mh.role}</span>))}</p>
                                                <p className="text-xs text-gray-500">{new Date(mh.match.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${mh.won ? 'text-green-500' : 'text-red-500'}`}>{mh.won ? 'ПЕРЕМОГА' : 'ПОРАЗКА'}</p>
                                            <p className="text-xs text-gray-500 flex items-center justify-end gap-1"><Trophy size={10} /> {mh.match.winner} | {mh.match.duration} Днів</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
