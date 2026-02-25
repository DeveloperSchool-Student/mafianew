import { useState } from 'react';
import axios from 'axios';
import { useAppStore } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface AdminPanelModalProps {
    showAdminPanel: boolean;
    setShowAdminPanel: (show: boolean) => void;
}

export function AdminPanelModal({ showAdminPanel, setShowAdminPanel }: AdminPanelModalProps) {
    const { user } = useAppStore();
    const [adminTarget, setAdminTarget] = useState('');
    const [adminAction, setAdminAction] = useState<'PUNISH' | 'GOLD' | 'EXP'>('PUNISH');
    const [adminDuration, setAdminDuration] = useState(3600); // сек, за замовчуванням 1 година
    const [adminType, setAdminType] = useState<'KICK' | 'BAN' | 'MUTE'>('KICK');
    const [adminReason, setAdminReason] = useState('');
    const [adminDelta, setAdminDelta] = useState(100);

    if (!showAdminPanel) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-mafia-gray border border-red-900/50 p-6 rounded-xl w-full max-w-sm shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-mafia-red">🛡️</span> Адмін-панель
                </h2>
                <input
                    type="text"
                    placeholder="Нікнейм гравця"
                    value={adminTarget}
                    onChange={(e) => setAdminTarget(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:outline-none focus:border-red-500 transition mb-4"
                />
                <div className="flex gap-2 mb-4 text-xs text-gray-300">
                    <button
                        onClick={() => setAdminAction('PUNISH')}
                        className={`flex-1 py-1 px-2 border rounded ${adminAction === 'PUNISH' ? 'bg-red-900/70 text-white border-red-700' : 'bg-[#1a1a1a] border-gray-700'}`}
                    >Покарання</button>
                    <button
                        onClick={() => setAdminAction('GOLD')}
                        className={`flex-1 py-1 px-2 border rounded ${adminAction === 'GOLD' ? 'bg-yellow-900/70 text-white border-yellow-700' : 'bg-[#1a1a1a] border-gray-700'}`}
                    >Золото</button>
                    <button
                        onClick={() => setAdminAction('EXP')}
                        className={`flex-1 py-1 px-2 border rounded ${adminAction === 'EXP' ? 'bg-blue-900/70 text-white border-blue-700' : 'bg-[#1a1a1a] border-gray-700'}`}
                    >Досвід</button>
                </div>

                {adminAction === 'PUNISH' && (
                    <>
                        <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-gray-300">
                            <div>
                                <label className="block mb-1">Тип покарання</label>
                                <select
                                    value={adminType}
                                    onChange={(e) => setAdminType(e.target.value as 'KICK' | 'BAN' | 'MUTE')}
                                    className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-xs"
                                >
                                    <option value="KICK">Kick (викинути зараз)</option>
                                    <option value="BAN">Ban (заблокувати вхід)</option>
                                    <option value="MUTE">Mute (заборонити чат)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1">Тривалість</label>
                                <select
                                    value={adminDuration}
                                    onChange={(e) => setAdminDuration(Number(e.target.value))}
                                    className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-xs"
                                >
                                    <option value={1800}>30 хв</option>
                                    <option value={3600}>1 година</option>
                                    <option value={10800}>3 години</option>
                                    <option value={86400}>1 день</option>
                                    <option value={604800}>7 днів</option>
                                </select>
                            </div>
                        </div>
                        <textarea
                            placeholder="Причина (необовʼязково)"
                            value={adminReason}
                            onChange={(e) => setAdminReason(e.target.value)}
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-xs mb-4"
                            rows={2}
                        />
                    </>
                )}
                {(adminAction === 'GOLD' || adminAction === 'EXP') && (
                    <div className="mb-4 text-xs text-gray-300">
                        <label className="block mb-1">Кількість (можна від'ємну)</label>
                        <input
                            type="number"
                            value={adminDelta}
                            onChange={(e) => setAdminDelta(Number(e.target.value))}
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-xs"
                        />
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            if (!adminTarget || !user) return;
                            try {
                                if (adminAction === 'PUNISH') {
                                    await axios.post(
                                        `${API_URL}/admin/punish`,
                                        {
                                            targetUsername: adminTarget,
                                            type: adminType,
                                            durationSeconds: adminType === 'KICK' ? undefined : adminDuration,
                                            scope: 'GLOBAL',
                                            reason: adminReason || undefined,
                                        },
                                        { headers: { Authorization: `Bearer ${user.token}` } },
                                    );
                                } else if (adminAction === 'GOLD') {
                                    await axios.post(
                                        `${API_URL}/admin/adjust-gold`,
                                        { targetUsername: adminTarget, delta: adminDelta },
                                        { headers: { Authorization: `Bearer ${user.token}` } },
                                    );
                                } else if (adminAction === 'EXP') {
                                    await axios.post(
                                        `${API_URL}/admin/adjust-exp`,
                                        { targetUsername: adminTarget, delta: adminDelta },
                                        { headers: { Authorization: `Bearer ${user.token}` } },
                                    );
                                }
                                alert('Успішно!');
                                setShowAdminPanel(false);
                                setAdminTarget('');
                                setAdminReason('');
                                setAdminDelta(100);
                            } catch (err: any) {
                                alert(err.response?.data?.message || 'Помилка виконання дії');
                            }
                        }}
                        className={`flex-1 border text-white font-bold py-2 px-2 rounded text-xs transition-colors uppercase ${adminAction === 'PUNISH' ? 'bg-red-900/70 hover:bg-red-700 border-red-700/80' :
                            adminAction === 'GOLD' ? 'bg-yellow-900/70 hover:bg-yellow-700 border-yellow-700/80' :
                                'bg-blue-900/70 hover:bg-blue-700 border-blue-700/80'
                            }`}
                    >
                        Застосувати
                    </button>
                </div>
                <button
                    onClick={() => setShowAdminPanel(false)}
                    className="w-full mt-4 text-center text-sm text-gray-400 hover:text-white transition"
                >
                    Закрити
                </button>
            </div>
        </div>
    );
}
