import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Trophy, Calendar } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface MatchHistory {
    id: string;
    role: string;
    won: boolean;
    match: {
        id: string;
        winner: string;
        duration: number;
        createdAt: string;
    };
}

export function History() {
    const { user } = useAppStore();
    const navigate = useNavigate();
    const [history, setHistory] = useState<MatchHistory[]>([]);
    const [loading, setLoading] = useState(true);

    const [filterOutcome, setFilterOutcome] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
    const [filterRole, setFilterRole] = useState('ALL');

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        axios.get(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${user.token}` }
        })
            .then(res => {
                setHistory(res.data?.profile?.matchHistory || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [user, navigate]);

    const filteredHistory = history.filter(h => {
        if (filterOutcome === 'WIN' && !h.won) return false;
        if (filterOutcome === 'LOSS' && h.won) return false;
        if (filterRole !== 'ALL' && h.role !== filterRole) return false;
        return true;
    });

    const roles = Array.from(new Set(history.map(h => h.role)));

    return (
        <div className="min-h-screen bg-mafia-dark text-white p-8">
            <div className="max-w-4xl mx-auto mt-8">
                <button onClick={() => navigate(-1)} className="mb-4 text-mafia-red hover:underline">&larr; Назад</button>

                <h1 className="text-3xl font-bold mb-6 text-mafia-red tracking-widest uppercase">Історія Ігор</h1>

                {/* Filters */}
                <div className="flex gap-4 mb-8 bg-[#111] p-4 rounded border border-gray-800">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Результат</label>
                        <select
                            value={filterOutcome}
                            onChange={e => setFilterOutcome(e.target.value as any)}
                            className="bg-black border border-gray-700 p-2 rounded text-sm text-white focus:outline-none"
                        >
                            <option value="ALL">Всі матчі</option>
                            <option value="WIN">Перемоги</option>
                            <option value="LOSS">Поразки</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Роль</label>
                        <select
                            value={filterRole}
                            onChange={e => setFilterRole(e.target.value)}
                            className="bg-black border border-gray-700 p-2 rounded text-sm text-white focus:outline-none uppercase"
                        >
                            <option value="ALL">Всі ролі</option>
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <p>Завантаження...</p>
                ) : filteredHistory.length === 0 ? (
                    <p className="text-gray-500">Матчів не знайдено.</p>
                ) : (
                    <div className="space-y-4">
                        {filteredHistory.map(h => (
                            <div key={h.id} className="bg-[#1a1a1a] border border-gray-800 rounded p-4 flex items-center justify-between hover:border-gray-600 transition">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-12 rounded-full ${h.won ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <div>
                                        <p className="font-bold text-lg mb-1">{h.role === 'MAFIA' || h.role === 'DON' ? <span className="text-red-500">{h.role}</span> : (h.role === 'SHERIFF' ? <span className="text-yellow-500">{h.role}</span> : (h.role === 'JESTER' ? <span className="text-pink-500">{h.role}</span> : <span className="text-blue-500">{h.role}</span>))}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={12} /> {new Date(h.match.createdAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</p>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2">
                                    <div>
                                        <p className={`font-bold uppercase tracking-wider ${h.won ? 'text-green-500' : 'text-red-500'}`}>{h.won ? 'ПЕРЕМОГА' : 'ПОРАЗКА'}</p>
                                        <p className="text-xs text-gray-400 flex items-center justify-end gap-1 mt-1"><Trophy size={10} /> Перемогли: {h.match.winner} ({h.match.duration} Днів)</p>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/match/${h.match.id}`)}
                                        className="text-xs bg-[#222] hover:bg-[#333] border border-gray-700 text-white py-1 px-3 rounded transition"
                                    >
                                        Подивитися Реплей
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
