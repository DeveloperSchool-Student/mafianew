import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, 
    RefreshCcw, 
    Plus, 
    Search, 
    X, 
    Clock, 
    User, 
    ArrowRightLeft,
    CheckCircle2,
    XCircle,
    History,
    TrendingUp,
    TrendingDown,
    Loader2,
} from 'lucide-react';
import { useAppStore } from '../store';
import { useToastStore } from '../store/toastStore';
import { useTranslation } from 'react-i18next';
import * as tradeApi from '../services/tradeApi';
import * as profileApi from '../services/profileApi';
import { CoinIcon } from '../components/CoinIcon.tsx';
import { HardIcon } from '../components/HardIcon.tsx'; 

export const Trades: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAppStore();
    const { addToast } = useToastStore();

    const [trades, setTrades] = useState<tradeApi.Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'history'>('incoming');
    
    // New Trade Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [foundUser, setFoundUser] = useState<{ id: string; username: string } | null>(null);
    const [searching, setSearching] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Trade configuring state
    const [offerAmount, setOfferAmount] = useState<number>(0);
    const [offerCurrency, setOfferCurrency] = useState<'SOFT' | 'HARD'>('SOFT');
    const [requestAmount, setRequestAmount] = useState<number>(0);
    const [requestCurrency, setRequestCurrency] = useState<'SOFT' | 'HARD'>('SOFT');

    useEffect(() => {
        if (user?.token) {
            fetchTradesData();
        }
    }, [user?.token]);

    const fetchTradesData = async () => {
        if (!user?.token) return;
        try {
            setLoading(true);
            const data = await tradeApi.fetchTrades(user.token);
            setTrades(data);
        } catch (err) {
            addToast('error', 'Помилка завантаження угод');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim() || !user?.token) return;
        try {
            setSearching(true);
            const found = await profileApi.searchUsersByUsername(user.token, searchQuery);
            if (found.id === user.id) {
                addToast('error', 'Ви не можете торгувати з самим собою');
                setFoundUser(null);
            } else {
                setFoundUser(found);
            }
        } catch (err) {
            addToast('error', 'Користувача не знайдено');
            setFoundUser(null);
        } finally {
            setSearching(false);
        }
    };

    const handleCreateTrade = async () => {
        if (!foundUser || !user?.token) return;
        if (offerAmount <= 0 && requestAmount <= 0) {
            addToast('error', 'Вкажіть суму пропозиції або запиту');
            return;
        }

        try {
            setActionLoading(true);
            await tradeApi.createTrade(user.token, {
                receiverId: foundUser.id,
                offerAmount,
                offerCurrency,
                requestAmount,
                requestCurrency
            });
            addToast('success', 'Угоду відправлено успішно!');
            setShowCreateModal(false);
            resetModalFields();
            fetchTradesData();
        } catch (err: any) {
            addToast('error', err.response?.data?.message || 'Помилка створення угоди');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAcceptTradeAction = async (id: string) => {
        if (!user?.token) return;
        try {
            setActionLoading(true);
            await tradeApi.acceptTrade(user.token, id);
            addToast('success', 'Угоду прийнято успішно!');
            fetchTradesData();
        } catch (err: any) {
            addToast('error', err.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectTradeAction = async (id: string) => {
        if (!user?.token) return;
        try {
            setActionLoading(true);
            await tradeApi.rejectTrade(user.token, id);
            addToast('success', 'Дія виконана');
            fetchTradesData();
        } catch (err: any) {
            addToast('error', err.response?.data?.message || 'Помилка');
        } finally {
            setActionLoading(false);
        }
    };

    const resetModalFields = () => {
        setFoundUser(null);
        setSearchQuery('');
        setOfferAmount(0);
        setRequestAmount(0);
    };

    const incomingTrades = trades.filter(t => t.receiverId === user?.id && t.status === 'PENDING');
    const outgoingTrades = trades.filter(t => t.senderId === user?.id && t.status === 'PENDING');
    const historyTradesList = trades.filter(t => t.status !== 'PENDING').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const currentList = activeTab === 'incoming' ? incomingTrades : activeTab === 'outgoing' ? outgoingTrades : historyTradesList;

    if (!user) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="animate-spin text-blue-500 mx-auto mb-4" size={48} />
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Авторизація...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center pb-24">
            {/* Header Section */}
            <div className="w-full bg-[#0d0d0d] border-b border-gray-800/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_rgba(59,130,246,0.1)_0%,_transparent_70%)]" />
                <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 relative z-10">
                    <button onClick={() => navigate('/lobby')} className="group text-gray-400 hover:text-white transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-6 border border-gray-800 rounded-full px-4 py-1.5 bg-black/40">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        {t('common.back')}
                    </button>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                        <div>
                            <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter uppercase leading-none mb-3">Торговий вузол</h1>
                            <p className="text-gray-400 text-sm sm:text-lg font-medium">Безпечний обмін ресурсами між гравцями</p>
                        </div>
                        <button 
                            onClick={() => setShowCreateModal(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-sm tracking-tighter flex items-center gap-3 transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.3)]"
                        >
                            <Plus size={20} /> Нова угода
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-5xl px-4 mt-8">
                {/* Tabs */}
                <div className="flex p-1.5 bg-gray-900/50 backdrop-blur-xl rounded-2xl mb-8 border border-gray-800/50">
                    <button 
                        onClick={() => setActiveTab('incoming')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'incoming' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <TrendingDown size={14} /> Отримані {incomingTrades.length > 0 && <span className="bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[8px]">{incomingTrades.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('outgoing')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'outgoing' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <TrendingUp size={14} /> Відправлені
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <History size={14} /> Історія
                    </button>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center">
                        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Завантаження операцій...</p>
                    </div>
                ) : currentList.length === 0 ? (
                    <div className="py-24 text-center bg-[#0d0d0d] border border-dashed border-gray-800 rounded-3xl">
                        <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-700">
                             {activeTab === 'incoming' ? <TrendingDown size={32} /> : activeTab === 'outgoing' ? <TrendingUp size={32} /> : <History size={32} />}
                        </div>
                        <h3 className="text-xl font-black text-white mb-2 uppercase italic">Жодних угод не знайдено</h3>
                        <p className="text-gray-500 max-w-xs mx-auto">Тут з'являться ваші {activeTab === 'incoming' ? 'вхідні запити на обмін' : activeTab === 'outgoing' ? 'надіслані пропозиції' : 'завершені операції'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {currentList.map(trade => (
                            <div key={trade.id} className="bg-[#111] border border-gray-800/50 hover:border-gray-700 rounded-3xl p-6 transition-all group relative overflow-hidden">
                                {trade.status === 'PENDING' && (
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="bg-yellow-500/10 text-yellow-500 text-[9px] font-black uppercase px-2 py-1 rounded border border-yellow-500/20 flex items-center gap-1">
                                            <Clock size={10} /> Очікує
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                    <div className="flex-1 flex items-center gap-4 w-full md:w-auto">
                                        <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center border border-gray-800">
                                            <User size={32} className="text-gray-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                                                {activeTab === 'incoming' ? 'Від гравця' : activeTab === 'outgoing' ? 'Гравцю' : 'Контрагент'}
                                            </p>
                                            <h4 className="text-xl font-black text-white italic">
                                                {activeTab === 'incoming' ? trade.sender?.username : trade.receiver?.username}
                                            </h4>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-8 py-4 sm:py-0 w-full sm:w-auto">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[9px] font-black uppercase text-blue-400 mb-2">Ви віддаєте</span>
                                            <div className="flex items-center gap-2 bg-blue-500/5 px-4 py-2.5 rounded-xl border border-blue-500/20 shadow-inner">
                                                {trade.offerCurrency === 'SOFT' ? <CoinIcon size={18} /> : (trade.offerCurrency === 'HARD' ? <HardIcon size={18} /> : <div className="w-[18px]" />)}
                                                <span className="text-2xl font-black italic">{trade.offerAmount}</span>
                                            </div>
                                        </div>

                                        <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-gray-700 border border-gray-800 shadow-xl scale-75 sm:scale-100">
                                            <ArrowRightLeft size={20} />
                                        </div>

                                        <div className="flex flex-col items-center">
                                            <span className="text-[9px] font-black uppercase text-yellow-500 mb-2">Ви отримуєте</span>
                                            <div className="flex items-center gap-2 bg-yellow-500/5 px-4 py-2.5 rounded-xl border border-yellow-500/20 shadow-inner">
                                                {trade.requestCurrency === 'SOFT' ? <CoinIcon size={18} /> : (trade.requestCurrency === 'HARD' ? <HardIcon size={18} /> : <div className="w-[18px]" />)}
                                                <span className="text-2xl font-black italic text-yellow-500">{trade.requestAmount}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 w-full md:w-auto justify-end">
                                        {activeTab === 'incoming' && (
                                            <>
                                                <button 
                                                    onClick={() => handleAcceptTradeAction(trade.id)}
                                                    disabled={actionLoading}
                                                    className="flex-1 md:flex-none bg-green-600 hover:bg-green-500 text-white font-black uppercase text-xs py-4 px-8 rounded-2xl transition-all shadow-lg active:scale-95"
                                                >
                                                    Прийняти
                                                </button>
                                                <button 
                                                    onClick={() => handleRejectTradeAction(trade.id)}
                                                    disabled={actionLoading}
                                                    className="flex-1 md:flex-none bg-gray-800 hover:bg-red-600 text-gray-400 hover:text-white font-black uppercase text-xs py-4 px-8 rounded-2xl transition-all active:scale-95"
                                                >
                                                    Відхилити
                                                </button>
                                            </>
                                        )}
                                        {activeTab === 'outgoing' && (
                                            <button 
                                                onClick={() => handleRejectTradeAction(trade.id)}
                                                disabled={actionLoading}
                                                className="w-full md:w-auto bg-gray-800 hover:bg-red-600 text-gray-400 hover:text-white font-black uppercase text-xs py-4 px-8 rounded-2xl transition-all active:scale-95"
                                            >
                                                Скасувати
                                            </button>
                                        )}
                                        {activeTab === 'history' && (
                                            <div className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border ${
                                                trade.status === 'ACCEPTED' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                                                trade.status === 'REJECTED' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                                'bg-gray-800 text-gray-500 border-gray-700'
                                            }`}>
                                                {trade.status === 'ACCEPTED' ? <CheckCircle2 size={16} /> : (trade.status === 'REJECTED' ? <XCircle size={16} /> : <XCircle size={16} />)}
                                                {trade.status === 'ACCEPTED' ? 'Завершено' : trade.status === 'REJECTED' ? 'Відхилено' : 'Скасовано'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Trade Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-[#0d0d0d] border border-gray-800 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-8 sm:p-12 relative">
                            <button 
                                onClick={() => { setShowCreateModal(false); resetModalFields(); }} 
                                className="absolute top-8 right-8 text-gray-600 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <h2 className="text-3xl font-black uppercase italic mb-8">Створити угоду</h2>
                            
                            {!foundUser ? (
                                <div className="space-y-6">
                                    <div className="relative">
                                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input 
                                            type="text" 
                                            placeholder="Введіть нікнейм гравця..." 
                                            className="w-full bg-[#111] border-2 border-gray-800 rounded-3xl py-6 pl-16 pr-8 text-xl font-bold focus:border-blue-500 focus:outline-none transition-all"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                    </div>
                                    <button 
                                        onClick={handleSearch}
                                        disabled={searching || !searchQuery}
                                        className="w-full bg-blue-600 hover:bg-blue-500 py-6 rounded-3xl font-black uppercase tracking-widest text-sm transition-all shadow-xl active:scale-95 disabled:bg-gray-800 disabled:text-gray-600 flex items-center justify-center"
                                    >
                                        {searching ? <Loader2 className="animate-spin" /> : 'Знайти гравця'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-10">
                                    <div className="flex items-center gap-4 bg-blue-500/5 p-6 rounded-3xl border border-blue-500/20">
                                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                                            <User size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black uppercase text-blue-400">Торгівля з</p>
                                            <h3 className="text-2xl font-black italic">{foundUser.username}</h3>
                                        </div>
                                        <button onClick={() => setFoundUser(null)} className="text-gray-500 hover:text-white p-2">
                                            <RefreshCcw size={18} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                        {/* Offer */}
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Ви пропонуєте</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    placeholder="0"
                                                    className="w-full bg-[#111] border-2 border-gray-800 rounded-2xl py-5 pl-14 pr-4 text-2xl font-black focus:border-blue-500 transition-all text-blue-500"
                                                    value={offerAmount || ''}
                                                    onChange={(e) => setOfferAmount(Number(e.target.value))}
                                                />
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                                    {offerCurrency === 'SOFT' ? <CoinIcon size={24} /> : <HardIcon size={24} />}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => setOfferCurrency('SOFT')}
                                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${offerCurrency === 'SOFT' ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500' : 'bg-gray-900 border-gray-800 text-gray-600'}`}
                                                >
                                                    Монети
                                                </button>
                                                <button 
                                                    onClick={() => setOfferCurrency('HARD')}
                                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${offerCurrency === 'HARD' ? 'bg-blue-500/10 border-blue-500/40 text-blue-500' : 'bg-gray-900 border-gray-800 text-gray-600'}`}
                                                >
                                                    Hard
                                                </button>
                                            </div>
                                        </div>

                                        {/* Request */}
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Ви просите</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    placeholder="0"
                                                    className="w-full bg-[#111] border-2 border-gray-800 rounded-2xl py-5 pl-14 pr-4 text-2xl font-black focus:border-yellow-500 transition-all text-yellow-500"
                                                    value={requestAmount || ''}
                                                    onChange={(e) => setRequestAmount(Number(e.target.value))}
                                                />
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                                    {requestCurrency === 'SOFT' ? <CoinIcon size={24} /> : <HardIcon size={24} />}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => setRequestCurrency('SOFT')}
                                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${requestCurrency === 'SOFT' ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500' : 'bg-gray-900 border-gray-800 text-gray-600'}`}
                                                >
                                                    Монети
                                                </button>
                                                <button 
                                                    onClick={() => setRequestCurrency('HARD')}
                                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${requestCurrency === 'HARD' ? 'bg-blue-500/10 border-blue-500/40 text-blue-500' : 'bg-gray-900 border-gray-800 text-gray-600'}`}
                                                >
                                                    Hard
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button 
                                            onClick={handleCreateTrade}
                                            disabled={actionLoading}
                                            className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-sm transition-all shadow-[0_0_30px_rgba(59,130,246,0.2)] active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            {actionLoading ? <Loader2 className="animate-spin" /> : <ArrowRightLeft size={18} />} Відправити запит
                                        </button>
                                        <button 
                                            onClick={() => { setShowCreateModal(false); resetModalFields(); }}
                                            className="flex-1 bg-gray-900 hover:bg-gray-800 text-gray-500 py-6 rounded-3xl font-black uppercase tracking-widest text-sm transition-all active:scale-95"
                                        >
                                            Скасувати
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

