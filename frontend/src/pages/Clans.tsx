import { useEffect, useState } from 'react';
import { CoinIcon } from '../components/CoinIcon';
import { useAppStore } from '../store';
import { useToastStore } from '../store/toastStore';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Shield, LogOut, Swords, Check, X, Loader2, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UserProfile } from '../types/api';
import * as profileApi from '../services/profileApi';
import * as clansApi from '../services/clansApi';

export function Clans() {
    const { user } = useAppStore();
    const { addToast } = useToastStore();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [clans, setClans] = useState<clansApi.Clan[]>([]);
    const [wars, setWars] = useState<clansApi.ClanWar[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showWarModal, setShowWarModal] = useState(false);
    const [selectedTargetClan, setSelectedTargetClan] = useState<clansApi.Clan | null>(null);
    const [warBet, setWarBet] = useState<number | ''>('');
    const [newClanName, setNewClanName] = useState('');
    const [actionLoading, setActionLoading] = useState(false);


    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchData();
    }, [user, navigate]);

    const fetchData = () => {
        if (!user) return;
        setLoading(true);
        Promise.all([
            profileApi.fetchMyProfile(user.token),
            clansApi.fetchClans(user.token),
            clansApi.fetchClanWars(user.token).catch(() => [] as clansApi.ClanWar[])
        ]).then(([profileRes, clansRes, warsRes]) => {
            setProfile(profileRes);
            setClans(clansRes);
            setWars(warsRes);
        }).catch(err => {
            console.error(err);
        }).finally(() => setLoading(false));
    };

    const handleCreateClan = async () => {
        if (!user || !newClanName || newClanName.length < 3) return;
        setActionLoading(true);
        try {
            await clansApi.createClan(user.token, newClanName);
            setShowCreateModal(false);
            setNewClanName('');
            addToast('success', 'Успішно створено клан!');
            fetchData();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handleJoinClan = async (clanName: string) => {
        if (!user) return;
        setActionLoading(true);
        try {
            await clansApi.joinClan(user.token, clanName);
            addToast('success', `Ви успішно вступили до клану ${clanName}!`);
            fetchData();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeaveClan = async () => {
        if (!user || !window.confirm("Ви дійсно хочете покинути клан?")) return;
        setActionLoading(true);
        try {
            await clansApi.leaveClan(user.token);
            addToast('success', 'Ви покинули клан.');
            fetchData();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handleKick = async (targetId: string) => {
        if (!user || !window.confirm("Вигнати гравця?")) return;
        setActionLoading(true);
        try {
            await clansApi.kickClanMember(user.token, targetId);
            addToast('success', 'Гравця вигнано з клану.');
            fetchData();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePromote = async (targetId: string, role: string) => {
        if (!user || !window.confirm(`Змінити роль гравця на ${role}?`)) return;
        setActionLoading(true);
        try {
            await clansApi.promoteClanMember(user.token, targetId, role);
            addToast('success', `Роль гравця змінено на ${role}.`);
            fetchData();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeclareWar = async () => {
        if (!user || !selectedTargetClan || warBet === '') return;
        setActionLoading(true);
        try {
            await clansApi.declareWar(user.token, selectedTargetClan.id, Number(warBet));
            setShowWarModal(false);
            setWarBet('');
            addToast('success', 'Війну оголошено!');
            fetchData();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handleWarAction = async (warId: string, action: 'accept' | 'reject') => {
        if (!user) return;
        setActionLoading(true);
        try {
            await clansApi.answerWar(user.token, warId, action);
            if (action === 'accept') {
                addToast('success', 'Ви прийняли виклик на війну!');
            } else {
                addToast('success', 'Ви відхилили війну.');
            }
            fetchData();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading || !profile) return <div className="min-h-screen bg-mafia-dark text-white p-8">Завантаження...</div>;

    const myClanId = (profile as any).profile?.clanId; // Temporary bypass if profile data misses clan fields
    const myRole = (profile as any).profile?.clanRole;
    const canManageWars = myRole === 'OWNER' || myRole === 'OFFICER';
    const myClan = clans.find(c => c.id === myClanId);
    const balance = profile.wallet?.soft || 0;

    return (
        <>
            <div className="relative overflow-hidden bg-[#0d0d0d] border-b border-gray-800 w-full">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_#3b82f6_0%,_transparent_70%)] pointer-events-none" />
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 relative z-10 text-center">
                    <div className="flex justify-between items-center absolute top-4 left-4 right-4 sm:px-4">
                        <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-white transition flex items-center gap-1 text-sm font-bold">
                            <ArrowLeft size={16} /> {t('common.back')}
                        </button>
                        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-yellow-500/30 flex items-center gap-2 shadow-lg">
                            <CoinIcon size={20} />
                            <span className="font-black text-yellow-500">{balance}</span>
                        </div>
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-black text-white mb-4 uppercase tracking-tighter flex items-center justify-center gap-4">
                        <Shield className="text-blue-500" size={48} /> Клани
                    </h1>
                    <p className="text-gray-400 text-sm sm:text-lg max-w-xl mx-auto">Обирай сторону, створюй альянси та домінуй у кланових війнах</p>
                </div>
            </div>

            <div className="w-full max-w-5xl p-4 sm:p-6 mb-20 mx-auto">
                {myClan ? (
                    <div className="mb-16">
                        <div className="bg-[#111] border border-blue-900/40 rounded-3xl overflow-hidden shadow-2xl relative">
                             <div className="bg-gradient-to-r from-blue-900/20 to-transparent p-6 sm:p-10 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h2 className="text-xs text-blue-500 font-bold uppercase tracking-[0.3em] mb-2">Ваша організація</h2>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-3xl sm:text-5xl font-black text-white">{myClan.name}</h3>
                                        <div className="bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-full text-[10px] font-black text-blue-400 uppercase">LVL 1</div>
                                    </div>
                                    <p className="text-gray-400 text-sm mt-3 flex items-center gap-2">
                                        <Shield size={14} className="text-gray-600" /> Клан-лідер: <span className="text-white font-bold">{myClan.owner.username}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={handleLeaveClan}
                                    disabled={actionLoading}
                                    className="bg-red-950/30 hover:bg-red-600 text-red-500 hover:text-white px-6 py-3 rounded-xl font-black transition-all flex items-center gap-2 text-xs uppercase tracking-widest border border-red-900/50"
                                >
                                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />} Покинути Клан
                                </button>
                            </div>

                            <div className="p-6 sm:p-8">
                                <h4 className="text-sm font-black text-gray-500 mb-6 uppercase tracking-widest flex items-center gap-2">
                                    <Users size={16} /> Склад Клану ({myClan.members.length})
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {myClan.members.map((m: clansApi.ClanMember) => {
                                        const isCurrentUser = m.userId === profile.id;

                                        return (
                                            <div key={m.id} className={`p-4 rounded-2xl border transition-all ${isCurrentUser ? 'bg-blue-600/5 border-blue-500/30' : 'bg-[#161616] border-gray-800 hover:border-gray-700'}`}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className={`font-black text-lg truncate ${isCurrentUser ? 'text-blue-400' : 'text-white'}`}>
                                                            {m.user?.username || m.userId.substring(0, 8)} 
                                                        </span>
                                                        <span className={`text-[9px] font-black uppercase tracking-wider w-fit px-1.5 py-0.5 rounded ${
                                                            m.clanRole === 'OWNER' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30' : 
                                                            m.clanRole === 'OFFICER' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' : 
                                                            'bg-gray-800 text-gray-400'
                                                        }`}>
                                                            {m.clanRole === 'OWNER' ? '👑 Лідер' : m.clanRole === 'OFFICER' ? '⭐ Офіцер' : '👤 Учасник'}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-gray-600 font-bold uppercase">Внесок</p>
                                                        <p className="text-sm font-mono text-gray-400">{m.clanContribution}</p>
                                                    </div>
                                                </div>

                                                {((myRole === 'OWNER' || myRole === 'OFFICER') && !isCurrentUser) && (
                                                    <div className="mt-4 pt-4 border-t border-gray-800 flex gap-2">
                                                        {myRole === 'OWNER' && (
                                                            <button 
                                                                onClick={() => handlePromote(m.userId, m.clanRole === 'OFFICER' ? 'MEMBER' : 'OFFICER')}
                                                                className={`flex-1 text-[9px] font-black uppercase py-2 rounded-lg transition-all ${m.clanRole === 'OFFICER' ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-blue-900/30 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-800/50'}`}
                                                            >
                                                                {m.clanRole === 'OFFICER' ? 'Зняти' : 'У Офіцери'}
                                                            </button>
                                                        )}
                                                        {(myRole === 'OWNER' || (myRole === 'OFFICER' && m.clanRole === 'MEMBER')) && (
                                                            <button 
                                                                onClick={() => handleKick(m.userId)}
                                                                className="flex-1 text-[9px] font-black uppercase py-2 rounded-lg bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white border border-red-900/40 transition-all font-bold"
                                                            >
                                                                Вигнати
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mb-12 flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="bg-[#111] p-6 rounded-2xl border border-gray-800 flex-1 w-full sm:w-auto">
                            <p className="text-gray-400 text-sm mb-4">Ви ще не приєдналися до жодного клану. Створіть свій власний клан, щоб розблокувати війни та бонуси!</p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-8 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-tighter shadow-xl active:scale-95"
                            >
                                <Plus size={24} /> Створити Клан (1000 <CoinIcon size={20} />)
                            </button>
                        </div>
                    </div>
                )}

                <div className="mb-6">
                    <h3 className="text-2xl font-black text-white mb-6 uppercase tracking-tight flex items-center gap-2">
                        <Users size={24} className="text-blue-500" /> Глобальний список
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {clans.map((clan, idx) => (
                            <div key={clan.id} className={`group bg-[#111] border rounded-2xl p-5 transition-all flex items-center justify-between ${myClanId === clan.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-gray-800 hover:border-gray-700 shadow-lg'}`}>
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-10 h-10 shrink-0 bg-gray-900 rounded-xl flex items-center justify-center font-black text-gray-500 border border-gray-800">
                                        {idx + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xl font-black text-white truncate group-hover:text-blue-400 transition-colors">{clan.name}</h4>
                                        <p className="text-xs text-gray-500 font-medium truncate flex items-center gap-1">
                                            <Shield size={10} /> {clan.owner.username} • <Users size={10} /> {clan.members.length}
                                        </p>
                                    </div>
                                </div>
                                <div className="shrink-0 ml-4">
                                    {!myClanId ? (
                                        <button
                                            onClick={() => handleJoinClan(clan.name)}
                                            disabled={actionLoading}
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase rounded-xl transition-all shadow-lg active:scale-95"
                                        >
                                            Вступити
                                        </button>
                                    ) : myClanId === clan.id ? (
                                        <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg border border-blue-500/20">Ваш клан</span>
                                    ) : (canManageWars && (
                                        <button
                                            onClick={() => { setSelectedTargetClan(clan); setShowWarModal(true); setWarBet(''); }}
                                            className="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 rounded-xl transition-all"
                                            title="Оголосити війну"
                                        >
                                            <Swords size={18} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    {clans.length === 0 && (
                        <div className="bg-[#111] rounded-2xl border border-gray-800 p-12 text-center text-gray-600">
                            Тут поки що порожньо. Будьте першим, хто створить клан!
                        </div>
                    )}
                </div>

                {myClanId && wars.length > 0 && (
                    <div className="mt-8 bg-[#1a1a1a] rounded-xl border border-gray-800 p-6">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Swords className="text-red-500" /> Кланові Війни
                        </h3>
                        <div className="space-y-4">
                            {wars.map((w: clansApi.ClanWar) => {
                                const isChallenger = w.challengerId === myClanId;
                                const myTeamName = isChallenger ? w.challenger?.name : w.target?.name;
                                const enemyName = isChallenger ? w.target?.name : w.challenger?.name;
                                const myScore = isChallenger ? w.challengerScore : w.targetScore;
                                const enemyScore = isChallenger ? w.targetScore : w.challengerScore;
                                const totalScore = myScore + enemyScore || 1;
                                const myPercent = Math.round((myScore / totalScore) * 100);
                                const canAccept = !isChallenger && w.status === 'PENDING' && canManageWars;

                                // Time left for active wars
                                let timeLeft = '';
                                if (w.status === 'ACTIVE' && w.startedAt) {
                                    const endMs = new Date(w.startedAt).getTime() + (w.durationHours || 48) * 3600 * 1000;
                                    const leftMs = endMs - Date.now();
                                    if (leftMs > 0) {
                                        const hours = Math.floor(leftMs / 3600000);
                                        const mins = Math.floor((leftMs % 3600000) / 60000);
                                        timeLeft = `${hours}г ${mins}хв`;
                                    } else {
                                        timeLeft = 'Завершується...';
                                    }
                                }

                                const isFinished = w.status === 'FINISHED';
                                const didWin = isFinished && w.winnerId === myClanId;
                                const isDraw = isFinished && !w.winnerId;

                                return (
                                    <div key={w.id} className={`bg-[#111] rounded-lg border overflow-hidden ${isFinished ? (didWin ? 'border-green-800' : isDraw ? 'border-gray-700' : 'border-red-900')
                                            : w.status === 'ACTIVE' ? 'border-orange-900/50' : 'border-gray-800'
                                        }`}>
                                        <div className="p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="text-white font-bold text-lg">
                                                        {isChallenger ? 'Ви кинули виклик' : 'Вам кинули виклик'} <span className="text-red-500">{enemyName}</span>
                                                    </p>
                                                    <div className="flex gap-4 text-sm text-gray-400 mt-1">
                                                        <span>Статус: <b className={
                                                            w.status === 'ACTIVE' ? 'text-green-400' :
                                                                w.status === 'FINISHED' ? 'text-gray-400' :
                                                                    'text-yellow-500'
                                                        }>{w.status === 'ACTIVE' ? 'Активна' : w.status === 'FINISHED' ? 'Завершена' : 'Очікує'}</b></span>
                                                        <span className="flex items-center gap-1">Ставка: <b className="text-yellow-500">{w.customBet}</b> <CoinIcon size={12} /></span>
                                                        {timeLeft && <span>⏰ {timeLeft}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 text-sm">
                                                    {w.status === 'PENDING' && canManageWars && (
                                                        <>
                                                            {canAccept && (
                                                                <button onClick={() => handleWarAction(w.id, 'accept')} className="bg-green-600/20 hover:bg-green-600 border border-green-500/50 text-green-500 hover:text-white py-1.5 px-3 rounded transition flex items-center gap-1 font-bold">
                                                                    <Check size={16} /> Прийняти
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleWarAction(w.id, 'reject')} className="bg-red-600/20 hover:bg-red-600 border border-red-500/50 text-red-500 hover:text-white py-1.5 px-3 rounded transition flex items-center gap-1 font-bold">
                                                                <X size={16} /> {isChallenger ? 'Скасувати' : 'Відхилити'}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Live Scoreboard */}
                                            {(w.status === 'ACTIVE' || isFinished) && (
                                                <div className="mt-3">
                                                    <div className="flex justify-between items-center text-sm mb-1">
                                                        <span className="text-blue-400 font-bold">{myTeamName} <span className="text-lg">{myScore}</span></span>
                                                        <span className="text-gray-500 text-xs">VS</span>
                                                        <span className="text-red-400 font-bold"><span className="text-lg">{enemyScore}</span> {enemyName}</span>
                                                    </div>
                                                    <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex">
                                                        <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${myPercent}%` }} />
                                                        <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${100 - myPercent}%` }} />
                                                    </div>
                                                    {isFinished && (
                                                        <p className={`text-center mt-2 font-bold text-sm ${didWin ? 'text-green-400' : isDraw ? 'text-gray-400' : 'text-red-400'}`}>
                                                            {didWin ? `🏆 Перемога! +${w.ratingChange} рейтингу` : isDraw ? '🤝 Нічия' : `❌ Поразка. -${Math.floor(w.ratingChange / 2)} рейтингу`}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Top Contributors */}
                                            {w.contributions && w.contributions.length > 0 && (w.status === 'ACTIVE' || isFinished) && (
                                                <div className="mt-3 pt-3 border-t border-gray-800">
                                                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-bold">Топ внесок</p>
                                                    <div className="flex gap-2 flex-wrap text-xs">
                                                        {w.contributions.slice(0, 5).map((c, i) => (
                                                            <span key={c.userId} className="bg-[#1a1a1a] border border-gray-700 px-2 py-1 rounded text-gray-300">
                                                                #{i + 1} <span className="text-white font-medium">{c.userId.slice(0, 6)}...</span> +{c.points}pts
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#111] border border-gray-700 p-8 rounded-xl w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-6">Створення Клану</h2>
                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm mb-2">Назва Клану (3-20 символів)</label>
                            <input
                                type="text"
                                value={newClanName}
                                onChange={e => setNewClanName(e.target.value)}
                                maxLength={20}
                                className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:outline-none focus:border-blue-500 transition"
                                placeholder="Введіть назву..."
                            />
                        </div>
                        <div className="p-4 bg-yellow-900/30 border border-yellow-700/50 rounded flex items-center gap-3 mb-8 text-yellow-500 text-sm">
                            <CoinIcon size={28} />
                            <span>Вартість створення: <b>1000 монет</b>.<br />Ваш баланс: {balance} монет.</span>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 bg-transparent hover:bg-gray-800 text-gray-400 py-3 rounded font-bold transition"
                            >
                                Скасувати
                            </button>
                            <button
                                onClick={handleCreateClan}
                                disabled={actionLoading || balance < 1000 || newClanName.length < 3}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-black py-3 rounded transition flex justify-center gap-2 items-center uppercase text-sm"
                            >
                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                                Створити
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showWarModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#111] border border-gray-700 p-8 rounded-xl w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <Swords className="text-red-500" /> Оголосити Війну
                        </h2>
                        <p className="text-gray-400 mb-6">Виклик клану <b className="text-red-400">{selectedTargetClan?.name}</b></p>

                        <div className="mb-8">
                            <label className="block text-gray-400 text-sm mb-2">Ставка монет (необов'язково)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2"><CoinIcon size={20} /></span>
                                <input
                                    type="number"
                                    min="0"
                                    value={warBet}
                                    onChange={e => setWarBet(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 pl-10 text-white focus:outline-none focus:border-red-500 transition"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowWarModal(false)}
                                className="flex-1 bg-transparent hover:bg-gray-800 text-gray-400 py-3 rounded font-bold transition"
                            >
                                Скасувати
                            </button>
                            <button
                                onClick={handleDeclareWar}
                                disabled={actionLoading}
                                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-3 rounded transition flex items-center justify-center gap-2 uppercase text-sm"
                            >
                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Swords size={20} />} У Бій!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
