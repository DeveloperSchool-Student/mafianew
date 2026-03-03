import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface LeaderboardEntry {
    mmr: number;
    user: {
        username: string;
    };
}

export function Leaderboard() {
    const { user } = useAppStore();
    const navigate = useNavigate();
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [clanLeaderboard, setClanLeaderboard] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'players' | 'clans'>('players');

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchLeaderboard = async () => {
            try {
                const [playersRes, clansRes] = await Promise.all([
                    fetch(`${API_URL}/users/leaderboard`, { headers: { Authorization: `Bearer ${user.token}` } }),
                    fetch(`${API_URL}/users/clans`, { headers: { Authorization: `Bearer ${user.token}` } })
                ]);

                if (!playersRes.ok || !clansRes.ok) throw new Error('Failed to fetch leaderboard');

                setLeaderboard(await playersRes.json());
                setClanLeaderboard(await clansRes.json());
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [user, navigate]);

    return (
        <div className="min-h-screen bg-mafia-dark text-mafia-light p-6">
            <div className="max-w-3xl mx-auto mt-10">
                <button
                    onClick={() => navigate('/lobby')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
                >
                    <ArrowLeft size={20} /> Назад у лоббі
                </button>

                <div className="bg-[#161616] border border-mafia-red/50 rounded-xl overflow-hidden shadow-2xl">
                    <div className="bg-mafia-red p-6 flex flex-col items-center justify-center gap-4 relative">
                        <div className="flex items-center gap-4">
                            <Trophy size={40} className="text-yellow-400" />
                            <h1 className="text-3xl font-bold font-mono tracking-widest text-white uppercase">Лідерборд</h1>
                        </div>
                        <div className="flex bg-black/30 p-1 rounded-lg w-full max-w-sm mt-2 relative z-10">
                            <button
                                onClick={() => setTab('players')}
                                className={`flex-1 py-2 font-bold text-sm transition-colors rounded ${tab === 'players' ? 'bg-[#1a1a1a] text-white shadow' : 'text-gray-300 hover:text-white'}`}
                            >
                                Топ Гравці
                            </button>
                            <button
                                onClick={() => setTab('clans')}
                                className={`flex-1 py-2 font-bold text-sm transition-colors rounded ${tab === 'clans' ? 'bg-[#1a1a1a] text-white shadow' : 'text-gray-300 hover:text-white'}`}
                            >
                                Топ Клани
                            </button>
                        </div>
                    </div>

                    <div className="p-2">
                        {loading ? (
                            <div className="p-10 text-center text-gray-500 animate-pulse">Завантаження...</div>
                        ) : error ? (
                            <div className="p-10 text-center text-red-500">{error}</div>
                        ) : (tab === 'players' && leaderboard.length === 0) || (tab === 'clans' && clanLeaderboard.length === 0) ? (
                            <div className="p-10 text-center text-gray-500">Ще немає даних у рейтингу.</div>
                        ) : tab === 'players' ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="text-xs text-gray-400 uppercase bg-[#1a1a1a] border-b border-gray-800">
                                        <tr>
                                            <th className="px-6 py-4">Місце</th>
                                            <th className="px-6 py-4">Гравець</th>
                                            <th className="px-6 py-4 text-right">Рейтинг (MMR)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.map((entry, idx) => (
                                            <tr
                                                key={idx}
                                                className={` border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors
                                                ${idx === 0 ? 'text-yellow-400 font-bold bg-[#1a1a1a]' : ''}
                                                ${idx === 1 ? 'text-gray-300 font-bold' : ''}
                                                ${idx === 2 ? 'text-amber-400 font-bold' : ''}
                                                `}
                                            >
                                                <td className="px-6 py-4 flex items-center gap-2">
                                                    {idx === 0 && <span className="text-xl">🥇</span>}
                                                    {idx === 1 && <span className="text-xl">🥈</span>}
                                                    {idx === 2 && <span className="text-xl">🥉</span>}
                                                    {idx > 2 && <span className="text-gray-500 font-mono w-6 block text-center">#{idx + 1}</span>}
                                                </td>
                                                <td className="px-6 py-4 font-medium uppercase tracking-wider">{entry.user.username}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="font-mono text-lg">{entry.mmr}</span>
                                                        <span className="text-xl" title={
                                                            entry.mmr < 1200 ? 'Бронза' : entry.mmr < 1500 ? 'Срібло' : entry.mmr < 1800 ? 'Золото' : 'Діамант'
                                                        }>
                                                            {entry.mmr < 1200 ? '🟤' : entry.mmr < 1500 ? '⚪' : entry.mmr < 1800 ? '🟡' : '💎'}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="text-xs text-gray-400 uppercase bg-[#1a1a1a] border-b border-gray-800">
                                        <tr>
                                            <th className="px-6 py-4">Місце</th>
                                            <th className="px-6 py-4">Клан</th>
                                            <th className="px-6 py-4">Лідер</th>
                                            <th className="px-6 py-4 text-right">Рейтинг</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clanLeaderboard.map((clan, idx) => (
                                            <tr
                                                key={idx}
                                                className={` border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors
                                                ${idx === 0 ? 'text-yellow-400 font-bold bg-[#1a1a1a]' : ''}
                                                ${idx === 1 ? 'text-gray-300 font-bold' : ''}
                                                ${idx === 2 ? 'text-amber-400 font-bold' : ''}
                                                `}
                                            >
                                                <td className="px-6 py-4 flex items-center gap-2">
                                                    {idx === 0 && <span className="text-xl">🥇</span>}
                                                    {idx === 1 && <span className="text-xl">🥈</span>}
                                                    {idx === 2 && <span className="text-xl">🥉</span>}
                                                    {idx > 2 && <span className="text-gray-500 font-mono w-6 block text-center">#{idx + 1}</span>}
                                                </td>
                                                <td className="px-6 py-4 font-medium uppercase tracking-wider">{clan.name}</td>
                                                <td className="px-6 py-4 text-gray-400">{clan.owner.username}</td>
                                                <td className="px-6 py-4 text-right font-mono text-lg">{clan.rating}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
