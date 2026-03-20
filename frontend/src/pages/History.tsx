import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Filter, Skull, Clock, Award, ArrowRight, Loader2 } from 'lucide-react';
import { fetchMyProfile } from '../services/profileApi';
import type { MatchHistoryEntry } from '../types/api';

type FilterOutcome = 'ALL' | 'WIN' | 'LOSS';

export function History() {
    const { user } = useAppStore();
    const navigate = useNavigate();
    const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const [filterOutcome, setFilterOutcome] = useState<FilterOutcome>('ALL');
    const [filterRole, setFilterRole] = useState('ALL');

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchMyProfile(user.token)
            .then(data => {
                setHistory(data.profile?.matchHistory || []);
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

    const roleColors: Record<string, string> = {
        'MAFIA': 'text-red-500', 'DON': 'text-red-600', 'SILENCER': 'text-red-400', 'BOMBER': 'text-red-400',
        'SHERIFF': 'text-yellow-500', 'MAYOR': 'text-yellow-400', 'JUDGE': 'text-yellow-600',
        'DOCTOR': 'text-blue-400', 'BODYGUARD': 'text-blue-500', 'TRACKER': 'text-cyan-400', 'INFORMER': 'text-cyan-500', 'JOURNALIST': 'text-blue-300',
        'SERIAL_KILLER': 'text-purple-500', 'JESTER': 'text-pink-500', 'LOVERS': 'text-pink-400'
    };

    return (
        <div className="min-h-screen bg-mafia-dark text-white p-4 sm:p-8">
            <div className="max-w-4xl mx-auto mt-4 sm:mt-8">
                <button onClick={() => navigate(-1)} className="mb-6 text-mafia-red hover:underline flex items-center gap-2 group">
                    <ArrowRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" /> 
                    Назад
                </button>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl sm:text-5xl font-black text-white italic tracking-tighter uppercase mb-2">
                            Історія <span className="text-mafia-red">Матчів</span>
                        </h1>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-[0.2em]">Ваш бойовий шлях у місті</p>
                    </div>

                    <div className="flex gap-2">
                        <div className="bg-[#111] border border-gray-800 rounded-2xl p-2 flex items-center gap-2">
                             <Filter size={14} className="text-gray-500 ml-2" />
                             <select
                                value={filterOutcome}
                                onChange={e => setFilterOutcome(e.target.value as FilterOutcome)}
                                className="bg-transparent border-none p-1 text-xs font-bold text-gray-300 focus:outline-none uppercase"
                            >
                                <option value="ALL">Всі результати</option>
                                <option value="WIN">Перемоги</option>
                                <option value="LOSS">Поразки</option>
                            </select>
                        </div>
                        <div className="bg-[#111] border border-gray-800 rounded-2xl p-2 flex items-center gap-2">
                             <select
                                value={filterRole}
                                onChange={e => setFilterRole(e.target.value)}
                                className="bg-transparent border-none p-1 text-xs font-bold text-gray-300 focus:outline-none uppercase"
                            >
                                <option value="ALL">Всі ролі</option>
                                {roles.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="animate-spin text-mafia-red" size={48} />
                        <p className="text-gray-500 animate-pulse font-bold tracking-widest uppercase text-xs">Завантаження архівів...</p>
                    </div>
                ) : filteredHistory.length === 0 ? (
                    <div className="text-center py-20 bg-[#111] rounded-3xl border border-dashed border-gray-800">
                        <p className="text-gray-500 font-bold uppercase tracking-widest">Матчів не знайдено.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredHistory.map(h => {
                            const roleColor = roleColors[h.role as string] || 'text-blue-400';
                            return (
                                <div 
                                    key={h.id} 
                                    onClick={() => navigate(`/match/${h.match.id}`)}
                                    className="group relative bg-[#111] border border-gray-800 rounded-3xl p-5 overflow-hidden transition-all hover:border-mafia-red/50 hover:bg-gray-900/50 cursor-pointer active:scale-[0.98]"
                                >
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                                        <div className="flex items-center gap-5">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-transform group-hover:scale-110 ${h.won ? 'bg-green-500/10 border-green-500/40 text-green-500' : 'bg-red-500/10 border-red-500/40 text-red-500'}`}>
                                                {h.won ? <Trophy size={20} /> : <Skull size={20} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className={`font-black uppercase italic text-lg tracking-tighter ${roleColor}`}>{h.role}</p>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${h.won ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                                                </div>
                                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                                    <Calendar size={12} />
                                                    {new Date(h.match.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                            <div className="text-right">
                                                <p className={`text-xs font-black uppercase tracking-widest mb-1 ${h.won ? 'text-green-500' : 'text-red-500'}`}>
                                                    {h.won ? 'ПЕРЕМОГА' : 'ПОРАЗКА'}
                                                </p>
                                                <p className="text-[10px] text-gray-600 font-bold flex items-center justify-end gap-3 uppercase">
                                                    <span className="flex items-center gap-1"><Clock size={10} /> {h.match.duration} Днів</span>
                                                    <span className="text-gray-800">|</span>
                                                    <span className="flex items-center gap-1"><Award size={10} /> {h.match.winner}</span>
                                                </p>
                                            </div>
                                            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-gray-700 group-hover:text-mafia-red transition-colors border border-gray-800">
                                                <ArrowRight size={18} />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Decoration */}
                                    <div className="absolute right-[-10%] top-[-20%] opacity-[0.02] text-[80px] font-black uppercase italic pointer-events-none select-none transition-opacity group-hover:opacity-[0.05]">
                                        {h.match.winner}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
