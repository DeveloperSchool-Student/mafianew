import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import axios from 'axios';
import { ArrowLeft, ArrowRightLeft, Check, X, Search } from 'lucide-react';
import { CoinIcon } from '../components/CoinIcon';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function Trades() {
    const { user } = useAppStore();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [receiverName, setReceiverName] = useState('');
    const [offerAmount, setOfferAmount] = useState<number | ''>('');
    const [offerCurrency, setOfferCurrency] = useState<'SOFT' | 'HARD'>('SOFT');
    const [requestAmount, setRequestAmount] = useState<number | ''>('');
    const [requestCurrency, setRequestCurrency] = useState<'SOFT' | 'HARD'>('SOFT');
    const [tradeError, setTradeError] = useState('');
    const [tradeSuccess, setTradeSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchTrades();
    }, [user]);

    const fetchTrades = async () => {
        try {
            const res = await axios.get(`${API_URL}/trade/list`, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            setTrades(res.data);
        } catch (e) { console.error('Failed to fetch trades', e); }
        setLoading(false);
    };

    const handleCreateTrade = async (e: React.FormEvent) => {
        e.preventDefault();
        setTradeError('');
        setTradeSuccess('');
        if (!receiverName || offerAmount === '' || requestAmount === '') {
            setTradeError('Заповніть всі поля');
            return;
        }

        setSubmitting(true);
        try {
            // Find user by username
            const lookupRes = await axios.get(`${API_URL}/users/find/${receiverName}`, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });

            const receiverId = lookupRes.data.id;

            await axios.post(`${API_URL}/trade/create`, {
                receiverId,
                offerAmount: Number(offerAmount),
                offerCurrency,
                requestAmount: Number(requestAmount),
                requestCurrency
            }, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });

            setTradeSuccess('Обмін успішно запропоновано!');
            setReceiverName('');
            setOfferAmount('');
            setRequestAmount('');
            fetchTrades();
        } catch (err: any) {
            setTradeError(err.response?.data?.message || 'Помилка створення обміну');
        }
        setSubmitting(false);
    };

    const handleAction = async (tradeId: string, action: 'accept' | 'reject') => {
        try {
            await axios.post(`${API_URL}/trade/${tradeId}/${action}`, {}, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            fetchTrades();
            useAppStore.getState().fetchCurrentUser(); // refresh wallet
        } catch (err: any) {
            alert(err.response?.data?.message || `Помилка: ${action}`);
        }
    };

    if (loading) return <div className="min-h-screen bg-mafia-dark text-white p-8">{t('common.loading')}</div>;

    const myTrades = trades.filter(t => t.senderId === user?.id);
    const incomingTrades = trades.filter(t => t.receiverId === user?.id);

    return (
        <div className="min-h-screen bg-mafia-dark text-mafia-light p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-white transition">
                        <ArrowLeft size={24} />
                    </button>
                    <ArrowRightLeft size={32} className="text-blue-500" />
                    <h1 className="text-2xl sm:text-3xl font-bold">Система Обміну</h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Create Trade Form */}
                    <div className="bg-[#111] border border-gray-800 rounded-xl p-6 h-fit relative sm:sticky top-4">
                        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                            <ArrowRightLeft className="text-mafia-red" size={20} />
                            Нова Пропозиція
                        </h2>

                        <form onSubmit={handleCreateTrade} className="space-y-4">
                            {tradeError && <div className="bg-red-900/50 border border-red-500 text-red-100 p-3 rounded text-sm">{tradeError}</div>}
                            {tradeSuccess && <div className="bg-green-900/50 border border-green-500 text-green-100 p-3 rounded text-sm">{tradeSuccess}</div>}

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Одержувач (Нікнейм)</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                    <input
                                        type="text" required value={receiverName} onChange={e => setReceiverName(e.target.value)}
                                        placeholder="Введіть нікнейм гравця"
                                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2.5 pl-9 text-white focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
                                <label className="block text-sm font-bold text-gray-300 mb-3">Ви віддаєте:</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number" required min="0" value={offerAmount} onChange={e => setOfferAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                        placeholder="Сума" className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white"
                                    />
                                    <select
                                        value={offerCurrency} onChange={e => setOfferCurrency(e.target.value as any)}
                                        className="bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white outline-none"
                                    >
                                        <option value="SOFT">Монети</option>
                                        <option value="HARD">Донат</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
                                <label className="block text-sm font-bold text-gray-300 mb-3">Ви отримуєте:</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number" required min="0" value={requestAmount} onChange={e => setRequestAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                        placeholder="Сума" className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white"
                                    />
                                    <select
                                        value={requestCurrency} onChange={e => setRequestCurrency(e.target.value as any)}
                                        className="bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white outline-none"
                                    >
                                        <option value="SOFT">Монети</option>
                                        <option value="HARD">Донат</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit" disabled={submitting}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded transition mt-4"
                            >
                                {submitting ? 'Надсилання...' : 'Запропонувати обмін'}
                            </button>
                        </form>
                    </div>

                    {/* Trades List */}
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold mb-4 text-white">Вхідні Пропозиції</h2>
                            {incomingTrades.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">Немає вхідних пропозицій</p>
                            ) : (
                                <div className="space-y-3">
                                    {incomingTrades.map(t => (
                                        <div key={t.id} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <p className="font-bold text-white text-sm">Від: <span className="text-blue-400">{t.sender.username}</span></p>
                                                <span className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</span>
                                            </div>

                                            <div className="flex items-center justify-between bg-[#111] p-3 rounded mb-3">
                                                <div className="text-center flex-1">
                                                    <p className="text-xs text-green-500 mb-1">Ви отримаєте</p>
                                                    <p className="font-bold flex items-center justify-center gap-1 text-sm">
                                                        {t.offerAmount} {t.offerCurrency === 'SOFT' ? <CoinIcon size={14} /> : '💎'}
                                                    </p>
                                                </div>
                                                <ArrowRightLeft size={16} className="text-gray-600 mx-2" />
                                                <div className="text-center flex-1">
                                                    <p className="text-xs text-red-500 mb-1">Ви віддасте</p>
                                                    <p className="font-bold flex items-center justify-center gap-1 text-sm">
                                                        {t.requestAmount} {t.requestCurrency === 'SOFT' ? <CoinIcon size={14} /> : '💎'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button onClick={() => handleAction(t.id, 'accept')} className="flex-1 bg-green-600/20 hover:bg-green-600 border border-green-500/50 text-green-500 hover:text-white py-1.5 rounded transition flex justify-center items-center gap-1 text-sm font-bold">
                                                    <Check size={16} /> Прийняти
                                                </button>
                                                <button onClick={() => handleAction(t.id, 'reject')} className="flex-1 bg-red-600/20 hover:bg-red-600 border border-red-500/50 text-red-500 hover:text-white py-1.5 rounded transition flex justify-center items-center gap-1 text-sm font-bold">
                                                    <X size={16} /> Відхилити
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <h2 className="text-xl font-bold mb-4 text-white">Вихідні Пропозиції</h2>
                            {myTrades.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">Немає вихідних пропозицій</p>
                            ) : (
                                <div className="space-y-3">
                                    {myTrades.map(t => (
                                        <div key={t.id} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 opacity-70">
                                            <div className="flex justify-between items-start mb-3">
                                                <p className="font-bold text-white text-sm">Кому: <span className="text-blue-400">{t.receiver.username}</span></p>
                                                <span className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</span>
                                            </div>

                                            <div className="flex items-center justify-between bg-[#111] p-3 rounded mb-3">
                                                <div className="text-center flex-1">
                                                    <p className="text-xs text-red-500 mb-1">Ви віддаєте</p>
                                                    <p className="font-bold flex items-center justify-center gap-1 text-sm">
                                                        {t.offerAmount} {t.offerCurrency === 'SOFT' ? <CoinIcon size={14} /> : '💎'}
                                                    </p>
                                                </div>
                                                <ArrowRightLeft size={16} className="text-gray-600 mx-2" />
                                                <div className="text-center flex-1">
                                                    <p className="text-xs text-green-500 mb-1">Ви просите</p>
                                                    <p className="font-bold flex items-center justify-center gap-1 text-sm">
                                                        {t.requestAmount} {t.requestCurrency === 'SOFT' ? <CoinIcon size={14} /> : '💎'}
                                                    </p>
                                                </div>
                                            </div>

                                            <button onClick={() => handleAction(t.id, 'reject')} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-1.5 rounded transition text-sm font-bold">
                                                Скасувати запит
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
