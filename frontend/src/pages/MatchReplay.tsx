import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Trophy } from 'lucide-react';
import { fetchMatchDetails } from '../services/usersApi';
import type { MatchDetails } from '../services/usersApi';

export function MatchReplay() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [match, setMatch] = useState<MatchDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const token = localStorage.getItem('mafia_token') || undefined;
                const data = await fetchMatchDetails(id!, token);
                setMatch(data);
            } catch (err: unknown) {
                const axiosErr = err as { response?: { data?: { message?: string } } };
                setError(axiosErr.response?.data?.message || 'Помилка при завантаженні матчу');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-[#111] text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        );
    }

    if (error || !match) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen bg-[#111] text-white">
                <p className="text-red-500 mb-4">{error || 'Матч не знайдено'}</p>
                <button onClick={() => navigate(-1)} className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
                    <ArrowLeft size={20} /> Повернутися
                </button>
            </div>
        );
    }

    const { participants, logs } = match;

    return (
        <div className="min-h-screen bg-[#111] text-white p-4 md:p-8 font-mono pb-20">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition"
                >
                    <ArrowLeft size={20} />
                    Назад до профілю
                </button>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 mb-8 shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-700 pb-4 mb-4">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Trophy className="text-yellow-500" />
                                Матч {match.id.split('-')[0]}
                            </h1>
                            <p className="text-gray-400 text-sm mt-1">
                                {new Date(match.createdAt).toLocaleString()}
                            </p>
                        </div>
                        <div className="mt-4 md:mt-0 text-right">
                            <p className="text-lg font-bold">
                                Переможець: <span className="text-green-400">{match.winner}</span>
                            </p>
                            <p className="text-gray-400 flex items-center justify-end gap-1 mt-1">
                                <Clock size={16} /> {match.duration} Днів
                            </p>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold mb-4 text-blue-400">Учасники</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                        {participants.map((p, idx) => (
                            <div key={idx} className={`p-3 rounded border ${p.won ? 'border-green-800 bg-green-900/20' : 'border-red-900 bg-red-900/10'}`}>
                                <div className="font-bold">{p.profile.user.username}</div>
                                <div className="text-sm text-gray-400 flex justify-between">
                                    <span>{p.role}</span>
                                    {p.won ? <span className="text-green-400">WIN</span> : <span className="text-red-400 text-xs">LOSS</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <h2 className="text-2xl font-bold mb-6 text-yellow-500 border-b border-gray-800 pb-2">Історія подій</h2>
                <div className="space-y-4">
                    {logs && logs.length > 0 ? (
                        logs.map((log, idx) => {
                            const isNight = log.phase === 'NIGHT';
                            return (
                                <div key={idx} className={`p-4 rounded border-l-4 ${isNight ? 'bg-[#0f0f1a] border-indigo-600' : 'bg-[#1a1a1a] border-yellow-600'}`}>
                                    <div className="text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">
                                        {isNight ? '🌙 Ніч' : '☀️ День'} {log.day}
                                    </div>
                                    <div className="text-gray-200">
                                        {log.text}
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <p className="text-gray-500 italic p-4 bg-[#1a1a1a] rounded">Історія подій для цього матчу недоступна. (Старий матч або помилка запису)</p>
                    )}
                </div>
            </div>
        </div>
    );
}
