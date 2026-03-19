import { useEffect, useState } from 'react';
import { CoinIcon } from '../components/CoinIcon';
import { useAppStore } from '../store';
import { useToastStore } from '../store/toastStore';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Shield, LogOut, Swords, Check, X, Loader2 } from 'lucide-react';
import type { UserProfile } from '../types/api';
import * as profileApi from '../services/profileApi';
import * as clansApi from '../services/clansApi';

export function Clans() {
    const { user } = useAppStore();
    const { addToast } = useToastStore();
    const navigate = useNavigate();
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
        <div className="min-h-screen bg-mafia-dark text-mafia-light p-4 flex flex-col items-center relative">
            <div className="w-full max-w-5xl mt-8">
                <div className="flex justify-between items-center mb-8">
                    <button onClick={() => navigate('/lobby')} className="text-mafia-red hover:underline">&larr; В Лоббі</button>
                    <div className="bg-[#1a1a1a] px-4 py-2 rounded-full border border-yellow-500/30 flex items-center gap-2">
                        <CoinIcon size={20} />
                        <span className="font-bold text-yellow-500">{balance}</span>
                        <span className="text-sm text-gray-400 font-bold ml-1">Монет</span>
                    </div>
                </div>

                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                        <Shield className="text-blue-500" size={32} />
                        Клани
                    </h1>
                    <p className="text-gray-500">Приєднуйтесь до інших або створіть власну імперію</p>
                </div>

                {myClan && (
                    <div className="bg-[#111] border border-blue-900 rounded-xl p-6 mb-10 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-sm text-blue-500 font-bold uppercase tracking-widest mb-1">Ваш Клан</h2>
                                <h3 className="text-3xl font-bold text-white mb-2">{myClan.name}</h3>
                                <p className="text-gray-400 text-sm mb-4">Лідер: <span className="text-white font-medium">{myClan.owner.username}</span></p>
                            </div>
                            <button
                                onClick={handleLeaveClan}
                                disabled={actionLoading}
                                className="bg-red-900/40 hover:bg-red-800 text-red-500 hover:text-white px-4 py-2 rounded font-bold transition flex items-center gap-2 text-sm border border-red-900"
                            >
                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />} Покинути
                            </button>
                        </div>

                        <div className="mt-6 border-t border-gray-800 pt-6">
                            <h4 className="text-sm font-bold text-gray-400 mb-4">Учасники ({myClan.members.length})</h4>
                            <div className="bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                                <div className="grid grid-cols-12 gap-4 p-3 border-b border-gray-800 text-xs font-bold text-gray-500 uppercase">
                                    <div className="col-span-4">Гравець</div>
                                    <div className="col-span-3">Роль</div>
                                    <div className="col-span-2 text-center">Контрибуція</div>
                                    <div className="col-span-3 text-right">Дії</div>
                                </div>
                                <div className="divide-y divide-gray-800 text-sm">
                                    {myClan.members.map((m: clansApi.ClanMember) => {
                                        const isCurrentUser = m.userId === profile.id;

                                        return (
                                            <div key={m.id} className="grid grid-cols-12 gap-4 p-3 items-center">
                                                <div className="col-span-4 font-bold text-white">
                                                    {m.user?.username || m.userId.substring(0, 8)} {isCurrentUser && '(Ви)'}
                                                </div>
                                                <div className="col-span-3 flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.clanRole === 'OWNER' ? 'bg-yellow-900/50 text-yellow-500 border border-yellow-700/50' : m.clanRole === 'OFFICER' ? 'bg-blue-900/50 text-blue-400 border border-blue-700/50' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                                                        {m.clanRole === 'OWNER' ? 'ЛІДЕР' : m.clanRole === 'OFFICER' ? 'ОФІЦЕР' : 'УЧАСНИК'}
                                                    </span>
                                                </div>
                                                <div className="col-span-2 text-center text-gray-400 font-mono">{m.clanContribution}</div>
                                                <div className="col-span-3 flex justify-end gap-2 text-xs">
                                                    {myRole === 'OWNER' && !isCurrentUser && (
                                                        <>
                                                            {m.clanRole !== 'OFFICER' && (
                                                                <button onClick={() => handlePromote(m.userId, 'OFFICER')} className="text-blue-400 hover:text-white transition px-2 py-1 bg-blue-900/30 rounded border border-blue-800/50">ОФІЦЕР</button>
                                                            )}
                                                            {m.clanRole === 'OFFICER' && (
                                                                <button onClick={() => handlePromote(m.userId, 'MEMBER')} className="text-gray-400 hover:text-white transition px-2 py-1 bg-gray-800 rounded border border-gray-700">ЗАБРАТИ</button>
                                                            )}
                                                            <button onClick={() => handleKick(m.userId)} className="text-red-400 hover:text-white transition px-2 py-1 bg-red-900/30 rounded border border-red-800/50">КИКНУТИ</button>
                                                        </>
                                                    )}
                                                    {myRole === 'OFFICER' && !isCurrentUser && m.clanRole === 'MEMBER' && (
                                                        <button onClick={() => handleKick(m.userId)} className="text-red-400 hover:text-white transition px-2 py-1 bg-red-900/30 rounded border border-red-800/50">КИКНУТИ</button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!myClan && (
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-mafia-red hover:bg-red-700 text-white font-bold py-2 px-6 rounded transition flex items-center gap-2 shadow-[0_0_10px_rgba(204,0,0,0.3)]"
                        >
                            <Plus size={20} /> Створити Клан (1000 <CoinIcon size={16} />)
                        </button>
                    </div>
                )}

                <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-800 text-sm font-bold text-gray-500 uppercase tracking-wider">
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Назва Клану</div>
                        <div className="col-span-3">Лідер</div>
                        <div className="col-span-1 text-center">Учасників</div>
                        <div className="col-span-2 text-right">Дія</div>
                    </div>

                    {clans.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Ще немає жодного клану. Станьте першим!</div>
                    ) : (
                        <div className="divide-y divide-gray-800/50">
                            {clans.map((clan, idx) => (
                                <div key={clan.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#222] transition">
                                    <div className="col-span-1 font-mono text-gray-500">{idx + 1}</div>
                                    <div className="col-span-5 font-bold text-white text-lg">{clan.name}</div>
                                    <div className="col-span-3 text-gray-400">{clan.owner.username}</div>
                                    <div className="col-span-1 text-center text-gray-300 flex items-center justify-center gap-1">
                                        <Users size={14} className="text-gray-500" /> {clan.members.length}
                                    </div>
                                    <div className="col-span-2 text-right">
                                        {!myClanId && (
                                            <button
                                                onClick={() => handleJoinClan(clan.name)}
                                                disabled={actionLoading}
                                                className="text-blue-500 hover:text-white bg-blue-900/20 hover:bg-blue-600 px-3 py-1.5 rounded transition font-bold text-sm border border-blue-900/50 flex items-center justify-center gap-1"
                                            >
                                                Вступити
                                            </button>
                                        )}
                                        {myClanId === clan.id ? (
                                            <span className="text-blue-500 font-bold text-sm bg-blue-900/20 px-3 py-1.5 rounded border border-blue-900/50">
                                                Ваш клан
                                            </span>
                                        ) : myClanId && canManageWars ? (
                                            <button
                                                onClick={() => { setSelectedTargetClan(clan); setShowWarModal(true); setWarBet(''); }}
                                                disabled={actionLoading}
                                                className="text-red-500 hover:text-white bg-red-900/20 hover:bg-red-600 px-3 py-1.5 rounded transition font-bold text-sm border border-red-900/50 flex items-center gap-1 ml-auto"
                                            >
                                                <Swords size={14} /> Війна
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
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
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 rounded transition flex justify-center gap-2 items-center"
                            >
                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                                Створити
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showWarModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
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
                                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3 rounded transition flex items-center justify-center gap-2"
                            >
                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Swords size={20} />} У Бій!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
