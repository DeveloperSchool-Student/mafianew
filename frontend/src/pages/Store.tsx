import { useEffect, useState } from 'react';
import { CoinIcon } from '../components/CoinIcon';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShoppingBag, Check } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const STORE_ITEMS = [
    // COMMON (100-500)
    { id: '', name: 'Стандартна Рамка', cost: 0, cssClass: 'border-gray-600', isDefault: true },
    { id: 'border-gray-300', name: 'Світло-сіра', cost: 100, cssClass: 'border-gray-300' },
    { id: 'border-red-500', name: 'Червона', cost: 200, cssClass: 'border-red-500' },
    { id: 'border-blue-500', name: 'Синя', cost: 200, cssClass: 'border-blue-500' },
    { id: 'border-green-500', name: 'Зелена', cost: 200, cssClass: 'border-green-500' },
    { id: 'border-yellow-500', name: 'Жовта', cost: 200, cssClass: 'border-yellow-500' },
    { id: 'border-purple-500', name: 'Фіолетова', cost: 200, cssClass: 'border-purple-500' },
    { id: 'border-pink-500', name: 'Рожева', cost: 200, cssClass: 'border-pink-500' },
    { id: 'border-orange-500', name: 'Помаранчева', cost: 200, cssClass: 'border-orange-500' },
    { id: 'border-cyan-500', name: 'Блакитна', cost: 300, cssClass: 'border-cyan-500' },
    { id: 'border-teal-500', name: 'Бірюзова', cost: 300, cssClass: 'border-teal-500' },

    // RARE (1000-3000)
    { id: 'border-mafia-red shadow-[0_0_10px_rgba(204,0,0,0.5)]', name: 'Кривава Мафія', cost: 1000, cssClass: 'border-mafia-red shadow-[0_0_10px_rgba(204,0,0,0.5)]' },
    { id: 'border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]', name: 'Крижаний Холод', cost: 1200, cssClass: 'border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]' },
    { id: 'border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]', name: 'Отруйний Плющ', cost: 1200, cssClass: 'border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' },
    { id: 'border-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.5)]', name: 'Темна Магія', cost: 1500, cssClass: 'border-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.5)]' },
    { id: 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]', name: 'Сонячний Промінь', cost: 1500, cssClass: 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' },
    { id: 'border-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]', name: 'Малиновий Захід', cost: 1800, cssClass: 'border-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]' },
    { id: 'border-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]', name: 'Нічне Небо', cost: 2000, cssClass: 'border-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]' },
    { id: 'border-white shadow-[0_0_10px_rgba(255,255,255,0.8)]', name: 'Святий Німб', cost: 3000, cssClass: 'border-white shadow-[0_0_10px_rgba(255,255,255,0.8)]' },

    // EPIC (5000-10000)
    { id: 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse', name: 'Пульсуюча Лють', cost: 5000, cssClass: 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse' },
    { id: 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)] animate-pulse', name: 'Глибинний Струм', cost: 5500, cssClass: 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)] animate-pulse' },
    { id: 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)] animate-pulse', name: 'Радіоактивність', cost: 6000, cssClass: 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)] animate-pulse' },
    { id: 'border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.8)] animate-pulse', name: 'Неоновий Демон', cost: 7000, cssClass: 'border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.8)] animate-pulse' },
    { id: 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.8)] animate-pulse', name: 'Золота Аура', cost: 8000, cssClass: 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.8)] animate-pulse' },
    { id: 'border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.8)] animate-pulse', name: 'Кіберпанк', cost: 9000, cssClass: 'border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.8)] animate-pulse' },

    // LEGENDARY (20000-50000)
    { id: 'border-transparent bg-gradient-to-r from-red-500 via-yellow-500 to-red-500 !bg-clip-border shadow-[0_0_30px_rgba(239,68,68,1)] animate-spin-slow', name: 'Пекельний Вихор', cost: 20000, cssClass: 'border-transparent bg-gradient-to-r from-red-500 via-yellow-500 to-red-500 !bg-clip-border shadow-[0_0_30px_rgba(239,68,68,1)] animate-spin-slow' },
    { id: 'border-white border-dashed shadow-[0_0_25px_rgba(255,255,255,1)] animate-pulse', name: 'Привид', cost: 25000, cssClass: 'border-white border-dashed shadow-[0_0_25px_rgba(255,255,255,1)] animate-pulse' },
    { id: 'border-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 !bg-clip-border shadow-[0_0_30px_rgba(217,70,239,0.9)] animate-bounce', name: 'Космічний Стрибок', cost: 30000, cssClass: 'border-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 !bg-clip-border shadow-[0_0_30px_rgba(217,70,239,0.9)] animate-bounce' },
    { id: 'border-transparent bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-600 !bg-clip-border shadow-[0_0_40px_rgba(251,191,36,1)] animate-pulse', name: 'Власник Казино', cost: 40000, cssClass: 'border-transparent bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-600 !bg-clip-border shadow-[0_0_40px_rgba(251,191,36,1)] animate-pulse' },
    { id: 'border-transparent bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-indigo-500 via-purple-500 to-indigo-500 !bg-clip-border shadow-[0_0_50px_rgba(99,102,241,1)] animate-spin', name: 'Бог Мафії', cost: 50000, cssClass: 'border-transparent bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-indigo-500 via-purple-500 to-indigo-500 !bg-clip-border shadow-[0_0_50px_rgba(99,102,241,1)] animate-spin' },
];

export function Store() {
    const { user } = useAppStore();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchProfile();
    }, [user, navigate]);

    const fetchProfile = () => {
        axios.get(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${user?.token}` }
        })
            .then(res => setProfile(res.data))
            .catch(err => console.error(err));
    };

    const handleBuy = async (item: typeof STORE_ITEMS[0]) => {
        if (loadingAction || profile?.wallet?.soft < item.cost) return;
        setLoadingAction(`buy-${item.id}`);
        try {
            await axios.post(`${API_URL}/users/store/buy`, { frameId: item.id, cost: item.cost }, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            fetchProfile(); // Refresh profile to get updated balance and unlocks
        } catch (err: any) {
            alert(err.response?.data?.message || 'Помилка покупки');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleEquip = async (item: typeof STORE_ITEMS[0]) => {
        if (loadingAction) return;
        setLoadingAction(`equip-${item.id}`);
        try {
            await axios.post(`${API_URL}/users/store/equip`, { frameId: item.id }, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            fetchProfile();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Помилка екіпірування');
        } finally {
            setLoadingAction(null);
        }
    };

    if (!profile) return <div className="min-h-screen bg-mafia-dark text-white p-8">Завантаження...</div>;

    const unlockedFrames = profile.profile?.unlockedFrames || [];
    const activeFrame = profile.profile?.activeFrame || '';
    const balance = profile.wallet?.soft || 0;

    return (
        <div className="min-h-screen bg-mafia-dark text-mafia-light p-4 flex flex-col items-center">
            <div className="w-full max-w-4xl mt-8">
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
                        <ShoppingBag className="text-mafia-red" size={32} />
                        Магазин Косметики
                    </h1>
                    <p className="text-gray-500">Персоналізуйте свій аватар за ігрові монети</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {STORE_ITEMS.map(item => {
                        const isUnlocked = item.isDefault || unlockedFrames.includes(item.id);
                        const isEquipped = activeFrame === item.id;
                        const canAfford = balance >= item.cost;

                        return (
                            <div key={item.id} className="bg-[#111] border border-gray-800 rounded-xl p-6 flex flex-col items-center text-center transition hover:border-gray-700 relative overflow-hidden">
                                {isEquipped && (
                                    <div className="absolute top-0 right-0 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                                        <Check size={12} /> Активно
                                    </div>
                                )}

                                <div className={`w-28 h-28 rounded-full border-4 mb-6 flex items-center justify-center bg-gray-900 ${item.cssClass}`}>
                                    {profile.profile?.avatarUrl ? (
                                        <img src={profile.profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                        <span className="text-4xl font-bold text-gray-500">{user?.username.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2">{item.name}</h3>

                                {!isUnlocked && (
                                    <div className="text-yellow-500 font-bold mb-4 flex items-center gap-1">
                                        <CoinIcon size={16} /> {item.cost}
                                    </div>
                                )}

                                {isUnlocked && !isEquipped && (
                                    <div className="text-gray-500 mb-4 h-6">Розблоковано</div>
                                )}
                                {isEquipped && (
                                    <div className="text-green-500 mb-4 h-6 font-bold">Одягнено</div>
                                )}

                                <div className="mt-auto w-full">
                                    {!isUnlocked ? (
                                        <button
                                            onClick={() => handleBuy(item)}
                                            disabled={!canAfford || loadingAction !== null}
                                            className={`w-full py-3 rounded font-bold transition flex justify-center items-center gap-2 ${canAfford ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                                        >
                                            {loadingAction === `buy-${item.id}` ? '...' : (canAfford ? 'Придбати' : 'Недостатньо монет')}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleEquip(item)}
                                            disabled={isEquipped || loadingAction !== null}
                                            className={`w-full py-3 rounded font-bold transition ${isEquipped ? 'bg-green-900/30 text-green-500 cursor-default border border-green-900' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                                        >
                                            {loadingAction === `equip-${item.id}` ? '...' : (isEquipped ? 'Активно' : 'Одягнути')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
