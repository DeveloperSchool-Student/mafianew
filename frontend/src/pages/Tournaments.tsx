import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { useToastStore } from '../store/toastStore';
import { useNavigate } from 'react-router-dom';
import { Trophy, Users, ArrowLeft, Plus, Play, X, Award, Loader2, Check } from 'lucide-react';
import { CoinIcon } from '../components/CoinIcon';
import type { Tournament } from '../types/api';
import { getStaffPower } from '../types/api';
import * as tournamentsApi from '../services/tournamentsApi';

export function Tournaments() {
    const { user } = useAppStore();
    const { addToast } = useToastStore();
    const navigate = useNavigate();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<string>('');
    const [showCreate, setShowCreate] = useState(false);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Create form
    const [name, setName] = useState('');
    const [maxParticipants, setMaxParticipants] = useState(16);
    const [prizePool, setPrizePool] = useState(0);
    const [entryFee, setEntryFee] = useState(0);
    const [rules, setRules] = useState('');

    // End tournament modal
    const [showEndModal, setShowEndModal] = useState(false);
    const [endWinnerId, setEndWinnerId] = useState('');

useEffect(() => {
    if (!user) {
        navigate('/login');
        return;
    }
    loadTournaments();
}, [user, navigate, filter]);

    const loadTournaments = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await tournamentsApi.fetchTournaments(user.token, filter || undefined);
            setTournaments(data);
        } catch {
            addToast('error', 'Не вдалося завантажити турніри');
        }
        setLoading(false);
    };

    const loadTournament = async (id: string) => {
        if (!user) return;
        try {
            const data = await tournamentsApi.fetchTournament(user.token, id);
            setSelectedTournament(data);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка завантаження турніру');
        }
    };

    const createTournament = async () => {
        if (!user || actionLoading) return;
        setActionLoading(true);
        try {
            await tournamentsApi.createTournament(user.token, {
                name, maxParticipants, prizePool, entryFee, rules: rules || undefined,
            });
            setShowCreate(false);
            setName(''); setPrizePool(0); setEntryFee(0); setRules('');
            addToast('success', 'Турнір успішно створено!');
            loadTournaments();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка створення турніру');
        } finally {
            setActionLoading(false);
        }
    };

    const joinTournament = async (id: string) => {
        if (!user || actionLoading) return;
        setActionLoading(true);
        try {
            await tournamentsApi.joinTournament(user.token, id);
            addToast('success', '✅ Ви зареєстровані на турнір!');
            loadTournaments();
            if (selectedTournament?.id === id) loadTournament(id);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка реєстрації');
        } finally {
            setActionLoading(false);
        }
    };

    const leaveTournament = async (id: string) => {
        if (!user || actionLoading) return;
        setActionLoading(true);
        try {
            await tournamentsApi.leaveTournament(user.token, id);
            addToast('success', 'Ви покинули турнір.');
            loadTournaments();
            if (selectedTournament?.id === id) loadTournament(id);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const startTournament = async (id: string) => {
        if (!user || actionLoading) return;
        setActionLoading(true);
        try {
            await tournamentsApi.startTournament(user.token, id);
            addToast('success', '🎮 Турнір розпочато!');
            loadTournaments();
            if (selectedTournament?.id === id) loadTournament(id);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handleEndTournament = async (id: string) => {
        if (!user || actionLoading) return;
        setActionLoading(true);
        try {
            await tournamentsApi.endTournament(user.token, id, endWinnerId || undefined);
            addToast('success', '🏆 Турнір завершено!');
            setShowEndModal(false);
            setEndWinnerId('');
            loadTournaments();
            if (selectedTournament?.id === id) loadTournament(id);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const cancelTournament = async (id: string) => {
        if (!user || !confirm('Скасувати турнір? Всі внески будуть повернені.') || actionLoading) return;
        setActionLoading(true);
        try {
            await tournamentsApi.cancelTournament(user.token, id);
            addToast('success', 'Турнір скасовано.');
            loadTournaments();
            setSelectedTournament(null);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
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
    <div className="min-h-screen bg-[#0d0d0d] text-white">
        <div className="relative overflow-hidden bg-[#161616] border-b border-gray-800">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_#ffcc00_0%,_transparent_70%)] pointer-events-none" />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/lobby')}
                            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                <Trophy size={32} className="text-yellow-500 animate-pulse" /> Турніри
                            </h1>
                            <p className="text-gray-500 text-sm sm:text-base font-medium mt-1">
                                Змагання за славу та нагороди
                            </p>
                        </div>
                    </div>
                    {getStaffPower(user.staffRoleKey) >= 8 && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="bg-yellow-600 hover:bg-yellow-500 text-black px-6 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-[0_0_20px_rgba(202,138,4,0.3)] active:scale-95"
                        >
                            <Plus size={18} /> Створити Турнір
                        </button>
                    )}
                </div>
            </div>
        </div>

        <div className="max-w-4xl mx-auto p-4 sm:p-6 mb-20">
            {/* Filters */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
                {[
                    { value: '', label: 'Всі Події' },
                    { value: 'REGISTRATION', label: '📝 Реєстрація' },
                    { value: 'ACTIVE', label: '⚔️ Активні' },
                    { value: 'FINISHED', label: '🏆 Завершені' }
                ].map(s => (
                    <button
                        key={s.value}
                        onClick={() => setFilter(s.value)}
                        className={`text-xs font-bold px-5 py-2.5 rounded-full border transition-all whitespace-nowrap ${
                            filter === s.value
                                ? 'bg-yellow-500 border-yellow-500 text-black shadow-lg'
                                : 'bg-[#111] border-gray-800 text-gray-500 hover:border-gray-600 hover:text-white'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Create Tournament Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Trophy size={18} className="text-yellow-500" /> Новий турнір
                            </h2>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Назва турніру"
                                className="w-full bg-[#111] border border-gray-700 rounded p-3 text-white text-sm"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500">Макс. учасників</label>
                                    <input
                                        type="number"
                                        value={maxParticipants}
                                        onChange={e => setMaxParticipants(Number(e.target.value))}
                                        className="w-full bg-[#111] border border-gray-700 rounded p-2 text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Призовий фонд</label>
                                    <input
                                        type="number"
                                        value={prizePool}
                                        onChange={e => setPrizePool(Number(e.target.value))}
                                        className="w-full bg-[#111] border border-gray-700 rounded p-2 text-white text-sm"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-gray-500">Вступний внесок</label>
                                    <input
                                        type="number"
                                        value={entryFee}
                                        onChange={e => setEntryFee(Number(e.target.value))}
                                        className="w-full bg-[#111] border border-gray-700 rounded p-2 text-white text-sm"
                                    />
                                </div>
                            </div>
                            <textarea
                                value={rules}
                                onChange={e => setRules(e.target.value)}
                                placeholder="Правила (необов'язково)"
                                rows={3}
                                className="w-full bg-[#111] border border-gray-700 rounded p-3 text-white text-sm resize-none"
                            />
                            <button
                                onClick={createTournament}
                                disabled={actionLoading}
                                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-black font-bold py-3 rounded transition flex items-center justify-center gap-2"
                            >
                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                                Створити турнір
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* End Tournament Modal */}
            {showEndModal && selectedTournament && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-6 w-full max-w-sm">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Award size={18} className="text-yellow-500" /> Завершити турнір
                        </h2>
                        <label className="text-xs text-gray-400 mb-1 block">ID переможця (необов'язково)</label>
                        <input
                            type="text"
                            value={endWinnerId}
                            onChange={e => setEndWinnerId(e.target.value)}
                            placeholder="Залиште порожнім, якщо немає"
                            className="w-full bg-[#111] border border-gray-700 rounded p-3 text-white text-sm mb-4"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleEndTournament(selectedTournament.id)}
                                disabled={actionLoading}
                                className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-black font-bold py-2.5 rounded transition flex items-center justify-center gap-1"
                            >
                                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />}
                                Завершити
                            </button>
                            <button
                                onClick={() => {
                                    setShowEndModal(false);
                                    setEndWinnerId('');
                                }}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2.5 rounded transition"
                            >
                                Скасувати
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
                            <button onClick={() => setSelectedTournament(null)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                            <div className="bg-[#111] border border-gray-800 rounded p-3 text-center">
                                <p className="text-xs text-gray-500">Статус</p>
                                <p className="text-sm font-bold">
                                    {statusLabels[selectedTournament.status] || selectedTournament.status}
                                </p>
                            </div>
                            <div className="bg-[#111] border border-gray-800 rounded p-3 text-center">
                                <p className="text-xs text-gray-500">Учасники</p>
                                <p className="text-sm font-bold">
                                    {selectedTournament.participants.length}/{selectedTournament.maxParticipants}
                                </p>
                            </div>
                            <div className="bg-[#111] border border-gray-800 rounded p-3 text-center">
                                <p className="text-xs text-gray-500">Призовий фонд</p>
                                <p className="text-sm font-bold text-yellow-400 flex items-center justify-center gap-1">
                                    {selectedTournament.prizePool} <CoinIcon size={14} />
                                </p>
                            </div>
                            <div className="bg-[#111] border border-gray-800 rounded p-3 text-center">
                                <p className="text-xs text-gray-500">Вступний внесок</p>
                                <p className="text-sm font-bold text-orange-400 flex items-center justify-center gap-1">
                                    {selectedTournament.entryFee} <CoinIcon size={14} />
                                </p>
                            </div>
                        </div>

                        {selectedTournament.rules && (
                            <div className="bg-[#111] border border-gray-800 rounded p-3 mb-4">
                                <p className="text-xs text-gray-500 mb-1">📋 Правила</p>
                                <p className="text-sm text-gray-300">{selectedTournament.rules}</p>
                            </div>
                        )}

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
                                                {p.status === 'WINNER' ? '🏆 ' : ''}
                                                {p.username}
                                            </td>
                                            <td className="py-2 px-2">
                                                <span
                                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                                        p.status === 'WINNER'
                                                            ? 'bg-yellow-900/50 text-yellow-300'
                                                            : p.status === 'ELIMINATED'
                                                            ? 'bg-red-900/30 text-red-400'
                                                            : p.status === 'ACTIVE'
                                                            ? 'bg-green-900/30 text-green-400'
                                                            : 'bg-gray-800 text-gray-400'
                                                    }`}
                                                >
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-center text-green-400">{p.wins}</td>
                                            <td className="py-2 px-2 text-center text-red-400">{p.losses}</td>
                                        </tr>
                                    ))}
                                    {selectedTournament.participants.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-4 text-center text-gray-500">
                                                Поки немає учасників
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            {selectedTournament.status === 'REGISTRATION' && (
                                <>
                                    {selectedTournament.participants.find(p => p.userId === user.id) ? (
                                        <button
                                            onClick={() => leaveTournament(selectedTournament.id)}
                                            disabled={actionLoading}
                                            className="text-sm bg-red-900/50 hover:bg-red-700 disabled:opacity-50 border border-red-600 text-red-300 px-4 py-2 rounded transition flex items-center gap-1"
                                        >
                                            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                            Покинути турнір
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => joinTournament(selectedTournament.id)}
                                            disabled={actionLoading}
                                            className="text-sm bg-green-900/50 hover:bg-green-700 disabled:opacity-50 border border-green-600 text-green-300 px-4 py-2 rounded transition flex items-center gap-1"
                                        >
                                            {actionLoading ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Users size={14} />
                                            )}
                                            Зареєструватися
                                            {selectedTournament.entryFee > 0 && ` (${selectedTournament.entryFee} 🪙)`}
                                        </button>
                                    )}
                                </>
                            )}

                            {user.staffRoleKey && selectedTournament.status === 'REGISTRATION' && (
                                <button
                                    onClick={() => startTournament(selectedTournament.id)}
                                    disabled={actionLoading}
                                    className="text-sm bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-black px-4 py-2 rounded font-bold transition flex items-center gap-1"
                                >
                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                    Почати турнір
                                </button>
                            )}

                            {user.staffRoleKey && selectedTournament.status === 'ACTIVE' && (
                                <button
                                    onClick={() => setShowEndModal(true)}
                                    className="text-sm bg-yellow-600 hover:bg-yellow-500 text-black px-4 py-2 rounded font-bold transition flex items-center gap-1"
                                >
                                    <Award size={14} /> Завершити турнір
                                </button>
                            )}

                            {user.staffRoleKey &&
                                selectedTournament.status !== 'FINISHED' &&
                                selectedTournament.status !== 'CANCELLED' && (
                                    <button
                                        onClick={() => cancelTournament(selectedTournament.id)}
                                        disabled={actionLoading}
                                        className="text-sm bg-red-900/50 hover:bg-red-700 disabled:opacity-50 border border-red-600 text-red-300 px-4 py-2 rounded transition"
                                    >
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {tournaments.map(t => {
                        const isJoined = t.participants.some(p => p.userId === user.id);
                        return (
                            <div
                                key={t.id}
                                onClick={() => loadTournament(t.id)}
                                className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden cursor-pointer hover:border-yellow-500/40 transition-all group flex flex-col h-full shadow-lg hover:shadow-yellow-500/5"
                            >
                                <div className="p-6 flex flex-col flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex flex-col">
                                            <span
                                                className={`text-[10px] font-black px-2 py-0.5 rounded border w-fit mb-2 uppercase ${
                                                    statusColors[t.status] || 'bg-gray-800'
                                                }`}
                                            >
                                                {statusLabels[t.status]?.replace(/[^a-zA-Z а-яА-ЯіїєґІЇЄҐ]/g, '') || t.status}
                                            </span>
                                            <h3 className="font-black text-xl text-white group-hover:text-yellow-400 transition tracking-tight">
                                                {t.name}
                                            </h3>
                                        </div>
                                        {isJoined && (
                                            <div
                                                className="bg-green-500/20 p-1.5 rounded-full border border-green-500/50"
                                                title="Ви учасник"
                                            >
                                                <Check size={14} className="text-green-400" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 my-4">
                                        <div className="bg-black/40 rounded-xl p-3 border border-gray-800/50">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Приз</p>
                                            <p className="text-lg font-black text-yellow-500 flex items-center gap-1">
                                                {t.prizePool} <CoinIcon size={14} />
                                            </p>
                                        </div>
                                        <div className="bg-black/40 rounded-xl p-3 border border-gray-800/50">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Учасників</p>
                                            <p className="text-lg font-black text-white flex items-center gap-1">
                                                <Users size={16} className="text-gray-400" /> {t.participants.length}/{t.maxParticipants}
                                            </p>
                                        </div>
                                    </div>

                                    {t.entryFee > 0 && (
                                        <div className="text-xs text-orange-400 font-bold flex items-center gap-1 mb-2">
                                            🎟️ Вхід: {t.entryFee} 🪙
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 border-t border-gray-800/50 flex justify-between items-center text-[10px] text-gray-500 font-mono">
                                        <span>#{t.id.slice(0, 8)}</span>
                                        <span>{new Date(t.createdAt).toLocaleDateString('uk-UA')}</span>
                                    </div>
                                </div>
                                <div className="bg-gray-800/20 group-hover:bg-yellow-500 group-hover:text-black transition-all p-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    Детальніше
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    </div>
);
