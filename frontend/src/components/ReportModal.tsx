import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    recentPlayers?: string[];
}

export function ReportModal({ isOpen, onClose, recentPlayers = [] }: ReportModalProps) {
    const { user } = useAppStore();
    const { t } = useTranslation();
    const [targetUsername, setTargetUsername] = useState('');
    const [reasonCategory, setReasonCategory] = useState('');
    const [comment, setComment] = useState('');
    const [screenshotUrl, setScreenshotUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [myReports, setMyReports] = useState<any[]>([]);
    const [showMyReports, setShowMyReports] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            setReasonCategory(t('report.cat_insult'));
            // Load my reports
            axios.get(`${API_URL}/admin/my-reports`, {
                headers: { Authorization: `Bearer ${user.token}` }
            }).then(res => setMyReports(res.data)).catch(() => { });
        }
    }, [isOpen, user]);

    if (!isOpen || !user) return null;

    const CATEGORIES = [
        t('report.cat_insult'),
        t('report.cat_spam'),
        t('report.cat_cheats'),
        t('report.cat_behavior'),
        t('report.cat_other'),
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetUsername.trim()) {
            alert(t('report.enter_nick'));
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

            alert(`✅ ${t('common.success')}`);
            onClose();
            setTargetUsername('');
            setComment('');
            setScreenshotUrl('');
        } catch (error: any) {
            alert(error.response?.data?.message || t('common.error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#111] border border-gray-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-[#161616]">
                    <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-mafia-red">
                        <AlertTriangle size={20} />
                        {t('report.title')}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('report.target_nick')}</label>
                        {recentPlayers.length > 0 ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    required
                                    value={targetUsername}
                                    onChange={e => setTargetUsername(e.target.value)}
                                    placeholder={t('report.enter_nick')}
                                    className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-mafia-red transition text-sm"
                                />
                                <select
                                    className="bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white w-10 text-transparent relative focus:outline-none focus:border-mafia-red cursor-pointer"
                                    onChange={e => setTargetUsername(e.target.value)}
                                    title={t('report.select_from_lobby')}
                                >
                                    <option value="" disabled className="text-gray-500">{t('report.select_from_lobby')}</option>
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
                                placeholder={t('report.enter_nick')}
                                className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-mafia-red transition text-sm"
                            />
                        )}
                        {recentPlayers.length > 0 && <p className="text-xs text-gray-500 mt-1">{t('report.select_from_lobby')}</p>}
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('report.category')}</label>
                        <select
                            value={reasonCategory}
                            onChange={e => setReasonCategory(e.target.value)}
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white focus:outline-none text-sm"
                        >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('report.comment')}</label>
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder={t('report.comment_placeholder')}
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white resize-none min-h-[80px] focus:outline-none text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('report.screenshot_url')}</label>
                        <input
                            type="url"
                            value={screenshotUrl}
                            onChange={e => setScreenshotUrl(e.target.value)}
                            placeholder="https://imgur.com/..."
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white focus:outline-none text-sm"
                        />
                    </div>

                    <p className="text-xs text-gray-500 italic">
                        {t('report.warning')}
                    </p>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-mafia-red hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded transition uppercase tracking-wider text-sm"
                    >
                        {isSubmitting ? t('report.submitting') : t('report.submit')}
                    </button>
                </form>

                {/* My Reports Section */}
                <div className="border-t border-gray-800">
                    <button
                        onClick={() => setShowMyReports(!showMyReports)}
                        className="w-full p-3 text-sm font-bold text-gray-400 hover:text-white text-left transition flex justify-between items-center"
                    >
                        📋 {t('report.my_reports')}
                        <span className="text-xs text-gray-600">{myReports.length}</span>
                    </button>
                    {showMyReports && (
                        <div className="px-4 pb-4 space-y-2 max-h-60 overflow-y-auto">
                            {myReports.length === 0 ? (
                                <p className="text-gray-500 text-sm">{t('report.no_reports')}</p>
                            ) : (
                                myReports.map(r => (
                                    <div key={r.id} className="bg-[#1a1a1a] border border-gray-800 rounded p-3">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-sm text-gray-300 font-medium">{r.target?.username || r.targetId}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded ${r.status === 'OPEN' ? 'bg-yellow-900/50 text-yellow-300' :
                                                    r.status === 'RESOLVED' ? 'bg-green-900/50 text-green-300' :
                                                        'bg-red-900/50 text-red-300'
                                                }`}>{r.status}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-1">{r.reason}</p>
                                        {r.resolvedNote && <p className="text-xs text-gray-400">↪ {r.resolvedNote}</p>}
                                        <p className="text-[10px] text-gray-600 mt-1">{new Date(r.createdAt).toLocaleString('uk-UA')}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
