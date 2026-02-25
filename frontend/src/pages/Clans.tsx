import { useEffect, useState } from 'react';
import { CoinIcon } from '../components/CoinIcon';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, Plus, Shield, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function Clans() {
    const { user } = useAppStore();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [clans, setClans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
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
        setLoading(true);
        Promise.all([
            axios.get(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${user?.token}` } }),
            axios.get(`${API_URL}/users/clans`, { headers: { Authorization: `Bearer ${user?.token}` } })
        ]).then(([profileRes, clansRes]) => {
            setProfile(profileRes.data);
            setClans(clansRes.data);
        }).catch(err => {
            console.error(err);
        }).finally(() => setLoading(false));
    };

    const handleCreateClan = async () => {
        if (!newClanName || newClanName.length < 3) return;
        setActionLoading(true);
        try {
            await axios.post(`${API_URL}/users/clans`, { name: newClanName }, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            setShowCreateModal(false);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handleJoinClan = async (clanName: string) => {
        setActionLoading(true);
        try {
            await axios.post(`${API_URL}/users/clans/join`, { clanName }, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeaveClan = async () => {
        if (!window.confirm("Ви дійсно хочете покинути клан?")) return;
        setActionLoading(true);
        try {
            await axios.post(`${API_URL}/users/clans/leave`, {}, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handleKick = async (targetId: string) => {
        if (!window.confirm("Вигнати гравця?")) return;
        setActionLoading(true);
        try {
            await axios.post(`${API_URL}/users/clans/kick`, { targetUserId: targetId }, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePromote = async (targetId: string, role: string) => {
        if (!window.confirm(`Змінити роль гравця на ${role}?`)) return;
        setActionLoading(true);
        try {
            await axios.post(`${API_URL}/users/clans/promote`, { targetUserId: targetId, newRole: role }, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading || !profile) return <div className="min-h-screen bg-mafia-dark text-white p-8">Завантаження...</div>;

    const myClanId = profile.profile?.clanId;
    const myClan = clans.find(c => c.id === myClanId);
    const balance = profile.wallet?.soft || 0;

    return (
        <div className="min-h-screen bg-mafia-dark text-mafia-light p-4 flex flex-col items-center">
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
                                <LogOut size={16} /> Покинути
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
                                    {myClan.members.map((m: any) => {
                                        const myProfile = myClan.members.find((x: any) => x.userId === profile.id);
                                        const myRole = myProfile?.clanRole || 'MEMBER';

                                        return (
                                            <div key={m.id} className="grid grid-cols-12 gap-4 p-3 items-center">
                                                <div className="col-span-4 font-bold text-white">{m.user?.username || m.userId.substring(0, 8)} {m.userId === profile.id && '(Ви)'}</div>
                                                <div className="col-span-3 flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.clanRole === 'OWNER' ? 'bg-yellow-900/50 text-yellow-500 border border-yellow-700/50' : m.clanRole === 'OFFICER' ? 'bg-blue-900/50 text-blue-400 border border-blue-700/50' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                                                        {m.clanRole === 'OWNER' ? 'ЛІДЕР' : m.clanRole === 'OFFICER' ? 'ОФІЦЕР' : 'УЧАСНИК'}
                                                    </span>
                                                </div>
                                                <div className="col-span-2 text-center text-gray-400 font-mono">{m.clanContribution}</div>
                                                <div className="col-span-3 flex justify-end gap-2 text-xs">
                                                    {myRole === 'OWNER' && m.userId !== profile.id && (
                                                        <>
                                                            {m.clanRole !== 'OFFICER' && (
                                                                <button onClick={() => handlePromote(m.userId, 'OFFICER')} className="text-blue-400 hover:text-white transition px-2 py-1 bg-blue-900/30 rounded border border-blue-800/50">ДАТИ ОФІЦЕРА</button>
                                                            )}
                                                            {m.clanRole === 'OFFICER' && (
                                                                <button onClick={() => handlePromote(m.userId, 'MEMBER')} className="text-gray-400 hover:text-white transition px-2 py-1 bg-gray-800 rounded border border-gray-700">ЗАБРАТИ ОФІЦЕРА</button>
                                                            )}
                                                            <button onClick={() => handleKick(m.userId)} className="text-red-400 hover:text-white transition px-2 py-1 bg-red-900/30 rounded border border-red-800/50">КИКНУТИ</button>
                                                        </>
                                                    )}
                                                    {myRole === 'OFFICER' && m.userId !== profile.id && m.clanRole === 'MEMBER' && (
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
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded transition flex items-center gap-2"
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
                                                className="text-blue-500 hover:text-white bg-blue-900/20 hover:bg-blue-600 px-3 py-1.5 rounded transition font-bold text-sm border border-blue-900/50"
                                            >
                                                Вступити
                                            </button>
                                        )}
                                        {myClanId === clan.id && (
                                            <span className="text-blue-500 font-bold text-sm bg-blue-900/20 px-3 py-1.5 rounded border border-blue-900/50">
                                                Ваш клан
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

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
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 rounded transition"
                            >
                                Створити
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
