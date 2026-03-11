import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Trophy, Users, ArrowLeft, Plus, Play, X, Award } from 'lucide-react';
import { CoinIcon } from '../components/CoinIcon';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const STAFF_ROLES = [
    { key: 'OWNER', power: 9 },
    { key: 'CURATOR', power: 8 },
    { key: 'SENIOR_ADMIN', power: 7 },
    { key: 'ADMIN', power: 6 },
    { key: 'JUNIOR_ADMIN', power: 5 },
    { key: 'SENIOR_MOD', power: 4 },
    { key: 'MOD', power: 3 },
    { key: 'HELPER', power: 2 },
    { key: 'TRAINEE', power: 1 },
];

function getStaffPower(staffRoleKey?: string | null): number {
    if (!staffRoleKey) return 0;
    return STAFF_ROLES.find(r => r.key === staffRoleKey)?.power ?? 0;
}

function headers(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

type Tournament = {
    id: string;
    name: string;
    status: string;
    maxParticipants: number;
    prizePool: number;
    entryFee: number;
    rules: string | null;
    createdById: string;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
    participants: Participant[];
};

type Participant = {
    id: string;
    userId: string;
    username: string;
    status: string;
    wins: number;
    losses: number;
    placement: number | null;
};

export function Tournaments() {
    const { user } = useAppStore();
    const navigate = useNavigate();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<string>('');
    const [showCreate, setShowCreate] = useState(false);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

    // Create form
    const [name, setName] = useState('');
    const [maxParticipants, setMaxParticipants] = useState(16);
    const [prizePool, setPrizePool] = useState(0);
    const [entryFee, setEntryFee] = useState(0);
    const [rules, setRules] = useState('');



    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadTournaments();
    }, [user, navigate, filter]);

    const loadTournaments = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const url = filter
                ? `${API_URL}/tournaments?status=${filter}`
                : `${API_URL}/tournaments`;
            const res = await axios.get(url, headers(user.token));
            setTournaments(res.data);
        } catch { }
        setLoading(false);
    };

    const loadTournament = async (id: string) => {
        if (!user) return;
        try {
            const res = await axios.get(`${API_URL}/tournaments/${id}`, headers(user.token));
            setSelectedTournament(res.data);
        } catch (e: any) { alert(e.response?.data?.message || 'Помилка'); }
    };

    const createTournament = async () => {
        if (!user) return;
        try {
            await axios.post(`${API_URL}/tournaments`, {
                name, maxParticipants, prizePool, entryFee, rules: rules || undefined,
            }, headers(user.token));
            setShowCreate(false);
            setName(''); setPrizePool(0); setEntryFee(0); setRules('');
            loadTournaments();
        } catch (e: any) { alert(e.response?.data?.message || 'Помилка'); }
    };

    const joinTournament = async (id: string) => {
        if (!user) return;
        try {
            await axios.post(`${API_URL}/tournaments/${id}/join`, {}, headers(user.token));
            alert('✅ Ви зареєстровані на турнір!');
            loadTournaments();
            if (selectedTournament?.id === id) loadTournament(id);
        } catch (e: any) { alert(e.response?.data?.message || 'Помилка'); }
    };

    const leaveTournament = async (id: string) => {
        if (!user) return;
        try {
            await axios.post(`${API_URL}/tournaments/${id}/leave`, {}, headers(user.token));
            alert('Ви покинули турнір.');
            loadTournaments();
            if (selectedTournament?.id === id) loadTournament(id);
        } catch (e: any) { alert(e.response?.data?.message || 'Помилка'); }
    };

    const startTournament = async (id: string) => {
        if (!user) return;
        try {
            await axios.post(`${API_URL}/tournaments/${id}/start`, {}, headers(user.token));
            alert('🎮 Турнір розпочато!');
            loadTournaments();
            if (selectedTournament?.id === id) loadTournament(id);
        } catch (e: any) { alert(e.response?.data?.message || 'Помилка'); }
    };

    const endTournament = async (id: string) => {
        if (!user) return;
        const winnerId = prompt('ID переможця (або залиште порожнім):');
        try {
            await axios.post(`${API_URL}/tournaments/${id}/end`, {
                winnerId: winnerId || undefined,
            }, headers(user.token));
            alert('🏆 Турнір завершено!');
            loadTournaments();
            if (selectedTournament?.id === id) loadTournament(id);
        } catch (e: any) { alert(e.response?.data?.message || 'Помилка'); }
    };

    const cancelTournament = async (id: string) => {
        if (!user || !confirm('Скасувати турнір? Всі внески будуть повернені.')) return;
        try {
            await axios.post(`${API_URL}/tournaments/${id}/cancel`, {}, headers(user.token));
            alert('Турнір скасовано.');
            loadTournaments();
            setSelectedTournament(null);
        } catch (e: any) { alert(e.response?.data?.message || 'Помилка'); }
    };

    if (!user) return null;

    const statusColors: Record<string, string> = {
        REGISTRATION: 'bg-blue-900/50 text-blue-300 border-blue-600',
        ACTIVE: 'bg-green-900/50 text-green-300 border-green-600',
        FINISHED: 'bg-gray-800 text-gray-400 border-gray-600',
        CANCELLED: 'bg-red-900/50 text-red-400 border-red-600',
    };

    const statusLabels: Record<string, string> = {
        REGISTRATION: '📝 Реєстрація',
        ACTIVE: '⚔️ Активний',
        FINISHED: '🏆 Завершено',
        CANCELLED: '❌ Скасовано',
    };

    return (
        <div className="min-h-screen bg-mafia-dark text-mafia-light">
            {/* Header */}
            <div className="bg-[#161616] border-b border-gray-800 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-4">
                    <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-white transition">
                        <ArrowLeft size={20} />
                    </button>
                    <Trophy size={20} className="text-yellow-500 sm:w-6 sm:h-6" />
                    <h1 className="text-base sm:text-xl font-bold">Турніри</h1>
                </div>
                <div className="flex items-center gap-2">
                    {getStaffPower(user.staffRoleKey) >= 8 && (
                        <button onClick={() => setShowCreate(true)}
                            className="text-xs bg-yellow-600 hover:bg-yellow-500 text-black px-3 py-1.5 rounded font-bold transition flex items-center gap-1">
                            <Plus size={14} /> Створити
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-3 sm:p-6">
                {/* Filters */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    {['', 'REGISTRATION', 'ACTIVE', 'FINISHED'].map(s => (
                        <button key={s} onClick={() => setFilter(s)}
                            className={`text-xs px-3 py-1.5 rounded border transition ${filter === s ? 'bg-yellow-500/20 border-yellow-500 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                        >{s || 'Всі'}</button>
                    ))}
                </div>

                {/* Create Tournament Modal */}
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                        <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-6 w-full max-w-md">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold flex items-center gap-2"><Trophy size={18} className="text-yellow-500" /> Новий турнір</h2>
                                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                            </div>
                            <div className="space-y-3">
                                <input type="text" value={name} onChange={e => setName(e.target.value)}
                                    placeholder="Назва турніру" className="w-full bg-[#111] border border-gray-700 rounded p-3 text-white text-sm" />
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-gray-500">Макс. учасників</label>
                                        <input type="number" value={maxParticipants} onChange={e => setMaxParticipants(Number(e.target.value))}
                                            className="w-full bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">Призовий фонд</label>
                                        <input type="number" value={prizePool} onChange={e => setPrizePool(Number(e.target.value))}
                                            className="w-full bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs text-gray-500">Вступний внесок</label>
                                        <input type="number" value={entryFee} onChange={e => setEntryFee(Number(e.target.value))}
                                            className="w-full bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                                    </div>
                                </div>
                                <textarea value={rules} onChange={e => setRules(e.target.value)}
                                    placeholder="Правила (необов'язково)" rows={3} className="w-full bg-[#111] border border-gray-700 rounded p-3 text-white text-sm resize-none" />
                                <button onClick={createTournament}
                                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded transition">
                                    Створити турнір
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tournament Detail View */}
                {selectedTournament && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
                        <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-6 w-full max-w-2xl my-8">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Trophy size={18} className="text-yellow-500" /> {selectedTournament.name}
                                </h2>
                                <button onClick={() => setSelectedTournament(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                <div className="bg-[#111] border border-gray-800 rounded p-3 text-center">
                                    <p className="text-xs text-gray-500">Статус</p>
                                    <p className="text-sm font-bold">{statusLabels[selectedTournament.status] || selectedTournament.status}</p>
                                </div>
                                <div className="bg-[#111] border border-gray-800 rounded p-3 text-center">
                                    <p className="text-xs text-gray-500">Учасники</p>
                                    <p className="text-sm font-bold">{selectedTournament.participants.length}/{selectedTournament.maxParticipants}</p>
                                </div>
                                <div className="bg-[#111] border border-gray-800 rounded p-3 text-center">
                                    <p className="text-xs text-gray-500">Призовий фонд</p>
                                    <p className="text-sm font-bold text-yellow-400 flex items-center justify-center gap-1">{selectedTournament.prizePool} <CoinIcon size={14} /></p>
                                </div>
                                <div className="bg-[#111] border border-gray-800 rounded p-3 text-center">
                                    <p className="text-xs text-gray-500">Вступний внесок</p>
                                    <p className="text-sm font-bold text-orange-400 flex items-center justify-center gap-1">{selectedTournament.entryFee} <CoinIcon size={14} /></p>
                                </div>
                            </div>

                            {selectedTournament.rules && (
                                <div className="bg-[#111] border border-gray-800 rounded p-3 mb-4">
                                    <p className="text-xs text-gray-500 mb-1">📋 Правила</p>
                                    <p className="text-sm text-gray-300">{selectedTournament.rules}</p>
                                </div>
                            )}

                            {/* Participants Table */}
                            <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Учасники</h3>
                            <div className="overflow-x-auto mb-4 -mx-2 sm:mx-0">
                                <table className="w-full text-xs sm:text-sm min-w-[400px]">
                                    <thead>
                                        <tr className="border-b border-gray-800 text-gray-500">
                                            <th className="text-left py-2 px-2">#</th>
                                            <th className="text-left py-2 px-2">Гравець</th>
                                            <th className="text-left py-2 px-2">Статус</th>
                                            <th className="text-center py-2 px-2">W</th>
                                            <th className="text-center py-2 px-2">L</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedTournament.participants.map((p, i) => (
                                            <tr key={p.id} className="border-b border-gray-800/50">
                                                <td className="py-2 px-2 text-gray-500">{p.placement || i + 1}</td>
                                                <td className="py-2 px-2 font-medium text-gray-200">
                                                    {p.status === 'WINNER' ? '🏆 ' : ''}{p.username}
                                                </td>
                                                <td className="py-2 px-2">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${p.status === 'WINNER' ? 'bg-yellow-900/50 text-yellow-300' :
                                                        p.status === 'ELIMINATED' ? 'bg-red-900/30 text-red-400' :
                                                            p.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' :
                                                                'bg-gray-800 text-gray-400'
                                                        }`}>{p.status}</span>
                                                </td>
                                                <td className="py-2 px-2 text-center text-green-400">{p.wins}</td>
                                                <td className="py-2 px-2 text-center text-red-400">{p.losses}</td>
                                            </tr>
                                        ))}
                                        {selectedTournament.participants.length === 0 && (
                                            <tr><td colSpan={5} className="py-4 text-center text-gray-500">Поки немає учасників</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 flex-wrap">
                                {selectedTournament.status === 'REGISTRATION' && (
                                    <>
                                        {selectedTournament.participants.find(p => p.userId === user.id) ? (
                                            <button onClick={() => leaveTournament(selectedTournament.id)}
                                                className="text-sm bg-red-900/50 hover:bg-red-700 border border-red-600 text-red-300 px-4 py-2 rounded transition">
                                                Покинути турнір
                                            </button>
                                        ) : (
                                            <button onClick={() => joinTournament(selectedTournament.id)}
                                                className="text-sm bg-green-900/50 hover:bg-green-700 border border-green-600 text-green-300 px-4 py-2 rounded transition flex items-center gap-1">
                                                <Users size={14} /> Зареєструватися
                                                {selectedTournament.entryFee > 0 && ` (${selectedTournament.entryFee} 🪙)`}
                                            </button>
                                        )}
                                    </>
                                )}

                                {user.staffRoleKey && selectedTournament.status === 'REGISTRATION' && (
                                    <button onClick={() => startTournament(selectedTournament.id)}
                                        className="text-sm bg-yellow-600 hover:bg-yellow-500 text-black px-4 py-2 rounded font-bold transition flex items-center gap-1">
                                        <Play size={14} /> Почати турнір
                                    </button>
                                )}

                                {user.staffRoleKey && selectedTournament.status === 'ACTIVE' && (
                                    <button onClick={() => endTournament(selectedTournament.id)}
                                        className="text-sm bg-yellow-600 hover:bg-yellow-500 text-black px-4 py-2 rounded font-bold transition flex items-center gap-1">
                                        <Award size={14} /> Завершити турнір
                                    </button>
                                )}

                                {user.staffRoleKey && selectedTournament.status !== 'FINISHED' && selectedTournament.status !== 'CANCELLED' && (
                                    <button onClick={() => cancelTournament(selectedTournament.id)}
                                        className="text-sm bg-red-900/50 hover:bg-red-700 border border-red-600 text-red-300 px-4 py-2 rounded transition">
                                        Скасувати турнір
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tournament List */}
                {loading ? (
                    <p className="text-gray-500 text-center py-8">Завантаження...</p>
                ) : tournaments.length === 0 ? (
                    <div className="text-center py-12">
                        <Trophy size={48} className="text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500">Немає турнірів{filter ? ` (${filter})` : ''}.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tournaments.map(t => {
                            const isJoined = t.participants.some(p => p.userId === user.id);
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => loadTournament(t.id)}
                                    className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-yellow-500/50 transition group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-lg text-white group-hover:text-yellow-400 transition">{t.name}</h3>
                                        <span className={`text-xs px-2 py-1 rounded border ${statusColors[t.status] || 'bg-gray-800 text-gray-400 border-gray-600'}`}>
                                            {statusLabels[t.status] || t.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                                        <span className="flex items-center gap-1"><Users size={14} /> {t.participants.length}/{t.maxParticipants}</span>
                                        {t.prizePool > 0 && <span className="flex items-center gap-1 text-yellow-400"><Trophy size={14} /> {t.prizePool} <CoinIcon size={12} /></span>}
                                        {t.entryFee > 0 && <span className="text-orange-400">Вхід: {t.entryFee} 🪙</span>}
                                    </div>
                                    {isJoined && (
                                        <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded">✅ Ви зареєстровані</span>
                                    )}
                                    <p className="text-xs text-gray-600 mt-2">{new Date(t.createdAt).toLocaleString('uk-UA')}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
