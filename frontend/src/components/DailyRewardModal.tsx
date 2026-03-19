import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { Gift, X, CheckCircle, Calendar } from 'lucide-react';
import { fetchRewardStatus, claimDailyReward } from '../services/usersApi';
import type { RewardStatus } from '../services/usersApi';

interface DailyRewardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DailyRewardModal({ isOpen, onClose }: DailyRewardModalProps) {
    const { user } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const [status, setStatus] = useState<RewardStatus | null>(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            checkStatus();
        }
    }, [isOpen, user]);

    const checkStatus = async () => {
        if (!user) return;
        setLoading(true);
        setError('');
        try {
            const data = await fetchRewardStatus(user.token);
            setStatus(data);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || 'Failed to fetch reward status');
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async () => {
        if (!user) return;
        setClaiming(true);
        setError('');
        try {
            const data = await claimDailyReward(user.token);
            setSuccessMessage(`Успішно отримано: +${data.softReward} 🪙 ${data.hardReward > 0 ? `+${data.hardReward} 💎` : ''}`);
            await checkStatus();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || 'Помилка отримання нагороди');
        } finally {
            setClaiming(false);
        }
    };

    if (!isOpen) return null;

    // Generate days for visual streak (up to 7 max boost)
    const renderStreakDays = () => {
        const days = [];
        const currentStreak = status?.loginStreak || 0;

        for (let i = 1; i <= 7; i++) {
            const isCompleted = currentStreak >= i;
            const isToday = status?.canClaim && (currentStreak + 1 === i) ||
                !status?.canClaim && currentStreak === i;

            days.push(
                <div key={i} className={`flex flex-col items-center justify-center p-2 rounded-lg border 
                    ${isCompleted ? 'bg-green-900/40 border-green-500' : 'bg-[#1a1a1a] border-gray-700'}
                    ${isToday ? 'ring-2 ring-mafia-red shadow-[0_0_15px_rgba(204,0,0,0.5)] transform scale-110 relative z-10' : ''}`}>
                    <span className="text-xs text-gray-400 mb-1">День {i}</span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#111] border border-gray-600">
                        {isCompleted && !isToday ? (
                            <CheckCircle size={16} className="text-green-500" />
                        ) : i === 7 ? (
                            <span className="text-sm">💎</span>
                        ) : (
                            <span className="text-sm text-yellow-500">🪙</span>
                        )}
                    </div>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#111] border border-red-900/50 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden relative">

                <div className="bg-gradient-to-r from-red-900/40 to-black p-4 border-b border-red-900/30 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Gift className="text-mafia-red" />
                        Щоденна Нагорода
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin w-8 h-8 border-4 border-mafia-red border-t-transparent rounded-full" />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">

                            {error && <div className="w-full bg-red-900/50 border border-red-500 text-red-100 p-3 rounded mb-4 text-sm text-center">{error}</div>}
                            {successMessage && <div className="w-full bg-green-900/50 border border-green-500 text-green-100 p-3 rounded mb-4 text-sm text-center font-bold">{successMessage}</div>}

                            <div className="mb-6 flex items-center gap-2 bg-[#1a1a1a] px-4 py-2 rounded-full border border-gray-800">
                                <Calendar size={16} className="text-gray-400" />
                                <span className="text-sm text-gray-300">Серія входів:</span>
                                <span className="text-mafia-red font-bold">{status?.loginStreak || 0} днів</span>
                            </div>

                            <div className="w-full grid grid-cols-4 sm:grid-cols-7 gap-2 mb-8">
                                {renderStreakDays()}
                            </div>

                            {status?.canClaim ? (
                                <button
                                    onClick={handleClaim}
                                    disabled={claiming}
                                    className="w-full py-3 bg-gradient-to-r from-mafia-red to-red-700 hover:from-red-600 hover:to-red-500 text-white font-bold rounded-lg shadow-[0_0_20px_rgba(204,0,0,0.4)] transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 uppercase tracking-wider"
                                >
                                    {claiming ? 'Отримання...' : 'Отримати Нагороду'}
                                </button>
                            ) : (
                                <div className="w-full py-4 bg-gray-900 border border-gray-700 rounded-lg text-center">
                                    <p className="text-gray-400 font-medium tracking-wide">Нагорода вже отримана сьогодні!</p>
                                    <p className="text-xs text-gray-500 mt-1">Повертайтеся завтра для більших бонусів.</p>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
