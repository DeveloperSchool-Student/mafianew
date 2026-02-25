import { useState } from 'react';
import axios from 'axios';
import { X, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    recentPlayers?: string[]; // optionally provide list of names
}

export function ReportModal({ isOpen, onClose, recentPlayers = [] }: ReportModalProps) {
    const { user } = useAppStore();
    const [targetUsername, setTargetUsername] = useState('');
    const [reasonCategory, setReasonCategory] = useState('Образа гравців');
    const [comment, setComment] = useState('');
    const [screenshotUrl, setScreenshotUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !user) return null;

    const CATEGORIES = [
        'Образа гравців',
        'Спам / Флуд',
        'Використання читів / багів',
        'Неадекватна поведінка',
        'Інше'
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetUsername.trim()) {
            alert('Вкажіть нікнейм гравця');
            return;
        }

        setIsSubmitting(true);
        try {
            const finalReason = comment ? `${reasonCategory}: ${comment}` : reasonCategory;

            await axios.post(`${API_URL}/admin/reports`, {
                targetUsername: targetUsername.trim(),
                reason: finalReason,
                screenshotUrl: screenshotUrl || undefined
            }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });

            alert('✅ Скаргу успішно відправлено! Дякуємо за допомогу.');
            onClose();
            setTargetUsername('');
            setComment('');
            setScreenshotUrl('');
        } catch (error: any) {
            alert(error.response?.data?.message || 'Помилка при відправці скарги. Перевірте нікнейм.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#111] border border-gray-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden relative" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-[#161616]">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-mafia-red">
                        <AlertTriangle size={20} />
                        Поскаржитись на гравця
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Нікнейм порушника *</label>
                        {recentPlayers.length > 0 ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    required
                                    value={targetUsername}
                                    onChange={e => setTargetUsername(e.target.value)}
                                    placeholder="Введіть нікнейм"
                                    className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-mafia-red transition"
                                />
                                <select
                                    className="bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white w-10 text-transparent relative focus:outline-none focus:border-mafia-red cursor-pointer"
                                    onChange={e => setTargetUsername(e.target.value)}
                                    title="Вибрати з лоббі"
                                >
                                    <option value="" disabled className="text-gray-500">Виберіть гравця</option>
                                    {recentPlayers.filter(p => p !== user.username).map(p => (
                                        <option key={p} value={p} className="text-white">{p}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <input
                                type="text"
                                required
                                value={targetUsername}
                                onChange={e => setTargetUsername(e.target.value)}
                                placeholder="Введіть нікнейм"
                                className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-mafia-red transition"
                            />
                        )}
                        {recentPlayers.length > 0 && <p className="text-xs text-gray-500 mt-1">Ви можете обрати гравця з кімнати через випадний список.</p>}
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Категорія порушення *</label>
                        <select
                            value={reasonCategory}
                            onChange={e => setReasonCategory(e.target.value)}
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white focus:outline-none"
                        >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Коментар (необов'язково)</label>
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="Опишіть ситуацію детальніше..."
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white resize-none min-h-[80px] focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Посилання на скріншот (необов'язково)</label>
                        <input
                            type="url"
                            value={screenshotUrl}
                            onChange={e => setScreenshotUrl(e.target.value)}
                            placeholder="https://imgur.com/..."
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white focus:outline-none"
                        />
                    </div>

                    <p className="text-xs text-gray-500 italic">
                        Фейкові скарги можуть призвести до блокування вашого акаунту.
                    </p>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-mafia-red hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded transition uppercase tracking-wider"
                    >
                        {isSubmitting ? 'Відправка...' : 'Відправити скаргу'}
                    </button>
                </form>
            </div>
        </div>
    );
}
