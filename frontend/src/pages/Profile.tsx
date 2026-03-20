import { useEffect, useState } from 'react';
import { CoinIcon } from '../components/CoinIcon';
import { useAppStore } from '../store';
import { useToastStore } from '../store/toastStore';
import { useNavigate, useParams } from 'react-router-dom';
import { Trophy, Hash, Edit2, Volume2, VolumeX, Loader2, Clock, Award, Skull, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audioManager } from '../utils/audio';
import type { UserProfile, Quest } from '../types/api';
import * as profileApi from '../services/profileApi';
import * as authApi from '../services/authApi';

export function Profile() {
    const { user, logout, theme, setTheme } = useAppStore();
    const { addToast } = useToastStore();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { id: routeUserId } = useParams<{ id?: string }>();
    const isOwnProfile = !routeUserId || routeUserId === user?.id;
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isEditingAvatar, setIsEditingAvatar] = useState(false);
    const [newAvatarUrl, setNewAvatarUrl] = useState('');
    const [quests, setQuests] = useState<Quest[]>([]);

    // Loading + error states
    const [loadError, setLoadError] = useState('');
    const [avatarSaving, setAvatarSaving] = useState(false);
    const [questClaimLoading, setQuestClaimLoading] = useState<string | null>(null);

    // Email binding state
    const [bindEmailMode, setBindEmailMode] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [bindEmailLoading, setBindEmailLoading] = useState(false);

    // 2FA state
    const [twoFactorMode, setTwoFactorMode] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [twoFactorToken, setTwoFactorToken] = useState('');
    const [twoFactorLoading, setTwoFactorLoading] = useState(false);

    // Audio State
    const [volume, setVolume] = useState(audioManager.getVolume());
    const [isMuted, setIsMuted] = useState(audioManager.isAudioMuted());

    // Appeal State
    const [appealMode, setAppealMode] = useState<'UNBAN' | 'UNMUTE' | null>(null);
    const [appealReason, setAppealReason] = useState('');
    const [appealLoading, setAppealLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        setLoadError('');

        if (isOwnProfile) {
            profileApi.fetchMyProfile(user.token)
                .then(data => setProfile(data))
                .catch(() => setLoadError('Не вдалося завантажити профіль'));

            profileApi.fetchQuests(user.token)
                .then(data => setQuests(data))
                .catch(e => { console.warn('Quests load failed, non-critical:', e); });
        } else {
            profileApi.fetchUserProfile(user.token, routeUserId!)
                .then(data => setProfile(data))
                .catch(() => {
                    setLoadError('Профіль не знайдено');
                    navigate('/lobby');
                });
        }
    }, [user, navigate, routeUserId, isOwnProfile]);

    const claimQuest = async (questId: string) => {
        if (!user || questClaimLoading) return;
        setQuestClaimLoading(questId);
        try {
            const res = await profileApi.claimQuest(user.token, questId);
            if (res.success) {
                setQuests(prev => prev.map(q => q.id === questId ? { ...q, claimed: true } : q));
                setProfile(p => p ? { ...p, wallet: { ...p.wallet!, soft: p.wallet!.soft + res.reward } } : null);
                addToast('success', `Отримано ${res.reward} монет!`);
            }
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } }; message?: string };
            addToast('error', e.response?.data?.message || e.message || 'Помилка отримання нагороди');
        } finally {
            setQuestClaimLoading(null);
        }
    };

    const handleAvatarSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || avatarSaving) return;
        setAvatarSaving(true);
        try {
            await profileApi.updateAvatar(user.token, newAvatarUrl);
            setProfile(prev => prev ? { ...prev, profile: { ...prev.profile!, avatarUrl: newAvatarUrl } } : null);
            setIsEditingAvatar(false);
            setNewAvatarUrl('');
            addToast('success', 'Аватар успішно оновлено!');
        } catch {
            addToast('error', 'Не вдалося оновити аватар');
        } finally {
            setAvatarSaving(false);
        }
    };

    const handleBindEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || bindEmailLoading) return;
        setBindEmailLoading(true);
        try {
            const res = await authApi.bindEmail(user.token, newEmail);
            addToast('success', res.message);
            setProfile(prev => prev ? { ...prev, email: newEmail } : null);
            setBindEmailMode(false);
            setNewEmail('');
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка прив\'язки пошти');
        } finally {
            setBindEmailLoading(false);
        }
    };

    const startTwoFactorSetup = async () => {
        if (!user || twoFactorLoading) return;
        setTwoFactorLoading(true);
        try {
            const res = await authApi.generate2FA(user.token);
            setQrCodeDataUrl(res.qrCodeDataUrl);
            setTwoFactorMode(true);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Не вдалося згенерувати QR код');
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const confirmTwoFactorSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || twoFactorLoading) return;
        setTwoFactorLoading(true);
        try {
            const res = await authApi.enable2FA(user.token, twoFactorToken);
            addToast('success', res.message);
            setProfile(prev => prev ? { ...prev, isTwoFactorEnabled: true } : null);
            setTwoFactorMode(false);
            setTwoFactorToken('');
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка підтвердження 2FA');
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const disableTwoFactor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || twoFactorLoading) return;
        setTwoFactorLoading(true);
        try {
            const res = await authApi.disable2FA(user.token, twoFactorToken);
            addToast('success', res.message);
            setProfile(prev => prev ? { ...prev, isTwoFactorEnabled: false } : null);
            setTwoFactorMode(false);
            setTwoFactorToken('');
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка вимкнення 2FA');
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const handleSubmitAppeal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !appealMode || appealLoading) return;
        setAppealLoading(true);
        try {
            await profileApi.submitAppeal(user.token, appealMode, appealReason);
            addToast('success', 'Апеляцію успішно надіслано на розгляд.');
            setAppealMode(null);
            setAppealReason('');
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            addToast('error', e.response?.data?.message || 'Помилка надсилання апеляції');
        } finally {
            setAppealLoading(false);
        }
    };

    if (loadError) {
        return (
            <div className="min-h-screen bg-mafia-dark text-white p-8 flex flex-col items-center justify-center">
                <p className="text-red-400 mb-4">{loadError}</p>
                <button onClick={() => navigate(-1)} className="text-mafia-red hover:underline">← Назад</button>
            </div>
        );
    }

    if (!profile) return <div className="min-h-screen bg-mafia-dark text-white p-8">{t('common.loading')}</div>;

    const getRankLabel = (mmr: number) => {
        if (mmr < 1200) return t('profile.rank_bronze');
        if (mmr < 1500) return t('profile.rank_silver');
        if (mmr < 1800) return t('profile.rank_gold');
        return t('profile.rank_diamond');
    };

    return (
        <div className="min-h-screen bg-mafia-dark text-mafia-light p-2 sm:p-4 flex flex-col items-center">
            <div className="w-full max-w-2xl mt-4 sm:mt-8">
                <button onClick={() => navigate(-1)} className="mb-4 text-mafia-red hover:underline text-sm">← {isOwnProfile ? t('common.back_to_lobby') : 'Назад'}</button>
                {!isOwnProfile && <p className="text-xs text-gray-500 mb-2">👁️ Ви переглядаєте профіль іншого гравця (тільки для читання)</p>}

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 sm:p-8 shadow-2xl">
                    <div className="flex items-center gap-4 sm:gap-6 mb-8 border-b border-gray-800 pb-6">
                        <div className="relative group flex-shrink-0">
                            <div className={`w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-mafia-gray border-4 flex items-center justify-center text-2xl sm:text-4xl font-bold bg-gray-900 ${profile.profile?.activeFrame || 'border-gray-500'} ${!profile.profile?.activeFrame?.includes('shadow') ? 'overflow-hidden' : ''}`}>
                                {profile.profile?.avatarUrl ? (
                                    <img src={profile.profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    profile.username.charAt(0).toUpperCase()
                                )}
                            </div>
                            {isOwnProfile && (
                                <button
                                    onClick={() => setIsEditingAvatar(!isEditingAvatar)}
                                    className="absolute bottom-0 right-0 bg-gray-800 p-1.5 sm:p-2 rounded-full border border-gray-600 hover:bg-gray-700 transition"
                                    title={t('profile.edit_avatar')}
                                >
                                    <Edit2 size={12} className="text-white sm:w-[14px] sm:h-[14px]" />
                                </button>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                                <h1 className="text-xl sm:text-3xl font-bold text-white truncate">{profile.username}</h1>
                                {profile.staffRole && (
                                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold uppercase rounded border" style={{ backgroundColor: `${profile.staffRole.color}20`, borderColor: `${profile.staffRole.color}50`, color: profile.staffRole.color }}>
                                        {profile.staffRole.title}
                                    </span>
                                )}
                            </div>
                            {profile.profile?.title && (
                                <p className="text-yellow-500 font-bold mb-1 text-sm sm:text-base tracking-wide" style={{ textShadow: '0 0 5px rgba(234, 179, 8, 0.4)' }}>
                                    «{profile.profile.title}»
                                </p>
                            )}
                            <p className="text-gray-500 text-xs sm:text-sm flex items-center gap-2">
                                <Hash size={14} /> ID: {profile.id.split('-')[0]}...
                            </p>
                            <div className="mt-3 sm:mt-4">
                                <div className="flex justify-between text-[10px] sm:text-xs font-bold text-gray-400 mb-1">
                                    <span>{t('profile.level', { level: profile.profile?.level || 1 })}</span>
                                    <span>{t('profile.xp_progress', { xp: profile.profile?.xp || 0, max: (profile.profile?.level || 1) * 500 })}</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div className="bg-mafia-red h-2 rounded-full" style={{ width: `${Math.min(100, ((profile.profile?.xp || 0) / ((profile.profile?.level || 1) * 500)) * 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {isOwnProfile && isEditingAvatar && (
                        <form onSubmit={handleAvatarSubmit} className="mb-6 bg-[#111] p-4 rounded border border-gray-800">
                            <label className="block text-sm text-gray-400 mb-2">{t('profile.avatar_url')}</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newAvatarUrl}
                                    onChange={e => setNewAvatarUrl(e.target.value)}
                                    placeholder="https://example.com/avatar.png"
                                    className="flex-1 bg-[#1a1a1a] border border-gray-700 p-2 rounded text-white text-sm focus:outline-none focus:border-mafia-red"
                                    disabled={avatarSaving}
                                />
                                <button type="submit" disabled={avatarSaving} className="bg-mafia-red hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded font-bold text-sm transition flex items-center gap-1">
                                    {avatarSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                                    {t('common.save')}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Punishments & Appeals Section — own profile only */}
                    {isOwnProfile && (profile.profile?.bannedUntil || profile.profile?.mutedUntil) && (
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-red-500 mb-4 tracking-widest uppercase border-t border-gray-800 pt-8">Обмеження Акаунта</h3>

                            {profile.profile.bannedUntil && new Date(profile.profile.bannedUntil) > new Date() && (
                                <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 mb-4">
                                    <h4 className="font-bold text-red-500 mb-2">🚫 Акаунт Заблоковано</h4>
                                    <p className="text-sm text-red-200 mb-4">
                                        Ваш акаунт заблоковано до: {new Date(profile.profile.bannedUntil).toLocaleString('uk-UA')}
                                    </p>
                                    {!appealMode && (
                                        <button onClick={() => setAppealMode('UNBAN')} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-bold transition">
                                            Подати апеляцію (Unban)
                                        </button>
                                    )}
                                </div>
                            )}

                            {profile.profile.mutedUntil && new Date(profile.profile.mutedUntil) > new Date() && (
                                <div className="bg-orange-900/20 border border-orange-900/50 rounded-lg p-4 mb-4">
                                    <h4 className="font-bold text-orange-500 mb-2">🔇 Чат Заблоковано</h4>
                                    <p className="text-sm text-orange-200 mb-4">
                                        Вам заборонено писати в чат до: {new Date(profile.profile.mutedUntil).toLocaleString('uk-UA')}
                                    </p>
                                    {!appealMode && (
                                        <button onClick={() => setAppealMode('UNMUTE')} className="bg-orange-700 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm font-bold transition">
                                            Подати апеляцію (Unmute)
                                        </button>
                                    )}
                                </div>
                            )}

                            {appealMode && (
                                <form onSubmit={handleSubmitAppeal} className="bg-[#111] p-4 rounded border border-gray-800">
                                    <h4 className="font-bold text-white mb-2">Оскаржити {appealMode === 'UNBAN' ? 'Блокування' : 'Мут'}</h4>
                                    <p className="text-sm text-gray-400 mb-4">Опишіть детально, чому ви вважаєте покарання помилковим або чому воно має бути зняте.</p>

                                    <textarea
                                        value={appealReason}
                                        onChange={e => setAppealReason(e.target.value)}
                                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:outline-none focus:border-mafia-red mb-3 min-h-[100px] text-sm"
                                        placeholder="Детальна причина апеляції..."
                                        required
                                        minLength={10}
                                        disabled={appealLoading}
                                    />
                                    <div className="flex gap-2">
                                        <button type="submit" disabled={appealLoading} className="bg-mafia-red hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded font-bold text-sm transition flex items-center gap-1">
                                            {appealLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                            Надіслати Апеляцію
                                        </button>
                                        <button type="button" onClick={() => { setAppealMode(null); }} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-bold text-sm transition">
                                            Скасувати
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    {isOwnProfile && <>
                        <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-widest uppercase border-t border-gray-800 pt-8">Безпека Акаунта</h3>
                        <div className="bg-[#111] p-4 rounded border border-gray-800 mb-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Електронна пошта</p>
                                    {profile.email ? (
                                        <p className="text-white font-bold">{profile.email}</p>
                                    ) : (
                                        <p className="text-red-500 font-bold text-sm">Не прив'язана (Рекомендується)</p>
                                    )}
                                </div>
                                {!profile.email && !bindEmailMode && (
                                    <button
                                        onClick={() => setBindEmailMode(true)}
                                        className="bg-mafia-red hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold transition whitespace-nowrap"
                                    >
                                        Прив'язати пошту
                                    </button>
                                )}
                            </div>

                            {bindEmailMode && (
                                <form onSubmit={handleBindEmail} className="mt-4 pt-4 border-t border-gray-800">
                                    <div className="flex gap-2">
                                        <input
                                            type="email"
                                            required
                                            value={newEmail}
                                            onChange={e => setNewEmail(e.target.value)}
                                            placeholder="Введіть ваш email"
                                            className="flex-1 bg-[#1a1a1a] border border-gray-700 p-2 rounded text-white text-sm focus:outline-none focus:border-mafia-red"
                                            disabled={bindEmailLoading}
                                        />
                                        <button type="submit" disabled={bindEmailLoading} className="bg-mafia-red hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded font-bold text-sm transition flex items-center gap-1">
                                            {bindEmailLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                            Зберегти
                                        </button>
                                        <button type="button" onClick={() => { setBindEmailMode(false); }} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-bold text-sm transition">
                                            Скасувати
                                        </button>
                                    </div>
                                </form>
                            )}

                            <hr className="border-gray-800 my-4" />

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Двофакторна автентифікація (2FA)</p>
                                    {profile.isTwoFactorEnabled ? (
                                        <p className="text-green-500 font-bold">Увімкнено</p>
                                    ) : (
                                        <p className="text-red-500 font-bold text-sm">Вимкнено (Рекомендується)</p>
                                    )}
                                </div>
                                {!twoFactorMode && (
                                    <button
                                        onClick={() => profile.isTwoFactorEnabled ? setTwoFactorMode(true) : startTwoFactorSetup()}
                                        disabled={twoFactorLoading}
                                        className={`${profile.isTwoFactorEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-mafia-red hover:bg-red-700'} disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-bold transition whitespace-nowrap flex items-center gap-1`}
                                    >
                                        {twoFactorLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                        {profile.isTwoFactorEnabled ? 'Вимкнути 2FA' : 'Увімкнути 2FA'}
                                    </button>
                                )}
                            </div>

                            {twoFactorMode && !profile.isTwoFactorEnabled && (
                                <div className="mt-4 pt-4 border-t border-gray-800">
                                    <p className="text-sm text-gray-400 mb-2">Відскануйте цей QR-код у додатку Google Authenticator або Authy:</p>
                                    {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="2FA QR Code" className="mb-4 bg-white p-2 rounded w-40 h-40" />}
                                    <form onSubmit={confirmTwoFactorSetup}>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                required
                                                value={twoFactorToken}
                                                onChange={e => setTwoFactorToken(e.target.value)}
                                                placeholder="Код з додатка (6 цифр)"
                                                className="flex-1 bg-[#1a1a1a] border border-gray-700 p-2 rounded text-white text-sm focus:outline-none focus:border-mafia-red tracking-widest"
                                                disabled={twoFactorLoading}
                                            />
                                            <button type="submit" disabled={twoFactorLoading} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded font-bold text-sm transition flex items-center gap-1">
                                                {twoFactorLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                                Підтвердити
                                            </button>
                                            <button type="button" onClick={() => { setTwoFactorMode(false); }} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-bold text-sm transition">
                                                Скасувати
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {twoFactorMode && profile.isTwoFactorEnabled && (
                                <form onSubmit={disableTwoFactor} className="mt-4 pt-4 border-t border-gray-800">
                                    <p className="text-sm text-gray-400 mb-3">Щоб вимкнути 2FA, введіть поточний код з додатка:</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            required
                                            value={twoFactorToken}
                                            onChange={e => setTwoFactorToken(e.target.value)}
                                            placeholder="Код з додатка (6 цифр)"
                                            className="flex-1 bg-[#1a1a1a] border border-gray-700 p-2 rounded text-white text-sm focus:outline-none focus:border-mafia-red tracking-widest"
                                            disabled={twoFactorLoading}
                                        />
                                        <button type="submit" disabled={twoFactorLoading} className="bg-mafia-red hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded font-bold text-sm transition flex items-center gap-1">
                                            {twoFactorLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                            Вимкнути
                                        </button>
                                        <button type="button" onClick={() => { setTwoFactorMode(false); }} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-bold text-sm transition">
                                            Скасувати
                                        </button>
                                    </div>
                                </form>
                            )}

                            <hr className="border-gray-800 my-4" />

                            <div className="flex flex-col gap-4">
                                <div>
                                    <p className="text-sm text-gray-400 mb-2">Налаштування звуку</p>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => {
                                                audioManager.toggleMute();
                                                setIsMuted(audioManager.isAudioMuted());
                                            }}
                                            className="text-gray-400 hover:text-white transition"
                                        >
                                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={volume}
                                            onChange={(e) => {
                                                const newVol = parseFloat(e.target.value);
                                                audioManager.setVolume(newVol);
                                                setVolume(newVol);
                                                if (isMuted && newVol > 0) {
                                                    audioManager.toggleMute();
                                                    setIsMuted(false);
                                                }
                                            }}
                                            className="flex-1 accent-mafia-red bg-gray-700 h-2 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <span className="text-xs text-gray-500 w-8">{Math.round(volume * 100)}%</span>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-400 mb-2">Тема оформлення</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setTheme('dark')}
                                            className={`px-4 py-1.5 rounded transition font-bold text-sm ${theme === 'dark' ? 'bg-mafia-red text-white' : 'bg-[#1a1a1a] border border-gray-700 text-gray-400'}`}
                                        >
                                            Dark
                                        </button>
                                        <button
                                            onClick={() => setTheme('light')}
                                            className={`px-4 py-1.5 rounded transition font-bold text-sm ${theme === 'light' ? 'bg-mafia-red text-white' : 'bg-[#1a1a1a] border border-gray-700 text-gray-400'}`}
                                        >
                                            Light
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-400 mb-2">Мова (Language)</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => i18n.changeLanguage('uk')}
                                            className={`px-4 py-1.5 rounded transition font-bold text-sm ${i18n.language === 'uk' || i18n.language === 'ua' ? 'bg-gray-200 text-black' : 'bg-[#1a1a1a] border border-gray-700 text-gray-400'}`}
                                        >
                                            UA
                                        </button>
                                        <button
                                            onClick={() => i18n.changeLanguage('en')}
                                            className={`px-4 py-1.5 rounded transition font-bold text-sm ${i18n.language === 'en' ? 'bg-gray-200 text-black' : 'bg-[#1a1a1a] border border-gray-700 text-gray-400'}`}
                                        >
                                            EN
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>}

                    {isOwnProfile && <>
                        <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-widest uppercase">{t('profile.daily_quests')}</h3>
                        <div className="space-y-3 mb-8">
                            {quests.map(q => (
                                <div key={q.id} className="bg-[#111] border border-gray-800 rounded p-3 sm:p-4 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-white mb-1 text-sm truncate">{q.title}</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 sm:w-32 bg-gray-800 rounded-full h-1.5">
                                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}></div>
                                            </div>
                                            <span className="text-xs text-gray-500">{q.progress} / {q.target}</span>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {q.claimed ? (
                                            <span className="text-green-500 font-bold text-xs sm:text-sm">{t('profile.completed')}</span>
                                        ) : q.progress >= q.target ? (
                                            <button
                                                onClick={() => claimQuest(q.id)}
                                                disabled={questClaimLoading === q.id}
                                                className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-bold transition whitespace-nowrap flex items-center gap-1"
                                            >
                                                {questClaimLoading === q.id ? <Loader2 size={12} className="animate-spin" /> : null}
                                                {t('profile.claim', { reward: q.reward })} <CoinIcon size={14} />
                                            </button>
                                        ) : (
                                            <span className="text-gray-500 text-xs sm:text-sm font-bold whitespace-nowrap">{t('profile.reward', { reward: q.reward })} <CoinIcon size={14} /></span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {quests.length === 0 && <p className="text-gray-500 text-sm pb-4">{t('profile.no_quests')}</p>}
                        </div>
                    </>}

                    <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-widest uppercase border-t border-gray-800 pt-8">{t('profile.finances')}</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
                        <div className="bg-[#111] p-3 sm:p-4 rounded border border-gray-800 text-center">
                            <CoinIcon size={24} className="mb-1 sm:w-[28px] sm:h-[28px]" />
                            <p className="text-[10px] sm:text-xs text-gray-500">{t('profile.coins')}</p>
                            <p className="text-xl sm:text-2xl font-bold text-yellow-500">{profile.wallet?.soft || 0}</p>
                        </div>
                        <div className="bg-[#111] p-3 sm:p-4 rounded border border-gray-800 text-center flex flex-col items-center justify-center">
                            <p className="text-[10px] sm:text-xs text-gray-500 mb-1 sm:mb-2">{t('profile.rating')}</p>
                            <div className="flex flex-col items-center justify-center gap-1">
                                <span className="text-xl sm:text-2xl font-bold text-white font-mono">{profile.profile?.mmr || 1500}</span>
                                <div className={`flex items-center gap-1 border px-2 border-opacity-50 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-black/40 ${(profile.profile?.mmr || 1500) < 1200 ? 'text-amber-700 border-amber-900' :
                                    (profile.profile?.mmr || 1500) < 1500 ? 'text-gray-400 border-gray-600' :
                                        (profile.profile?.mmr || 1500) < 1800 ? 'text-yellow-400 border-yellow-600' :
                                            'text-cyan-400 border-cyan-800'
                                    }`}>
                                    {getRankLabel(profile.profile?.mmr || 1500)}
                                </div>
                            </div>
                        </div>
                        <div className="bg-[#111] p-3 sm:p-4 rounded border border-gray-800 text-center">
                            <Trophy className="mx-auto mb-1 sm:mb-2 text-mafia-light" size={20} />
                            <p className="text-[10px] sm:text-xs text-gray-500">{t('profile.matches')}</p>
                            <p className="text-xl sm:text-2xl font-bold text-white">{profile.profile?.matches || 0}</p>
                        </div>
                        <div className="bg-[#111] p-3 sm:p-4 rounded border border-gray-800 text-center">
                            <p className="text-[10px] sm:text-xs text-green-500 mb-1 sm:mb-2 font-bold uppercase">{t('profile.wins_losses')}</p>
                            <p className="text-xl sm:text-2xl font-bold text-white">
                                <span className="text-green-400">{profile.profile?.wins || 0}</span> <span className="text-gray-600 mx-1">/</span> <span className="text-mafia-red">{profile.profile?.losses || 0}</span>
                            </p>
                        </div>
                    </div>

                    <h3 className="text-sm font-bold text-gray-400 mb-4 mt-8 tracking-widest uppercase border-t border-gray-800 pt-8">Детальна Статистика</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4">
                        <div className="bg-[#111] p-3 sm:p-4 rounded border border-gray-800 text-center">
                            <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Відсоток перемог (WR%)</p>
                            <p className="text-xl sm:text-2xl font-bold text-white">
                                {profile.profile?.matches ? ((profile.profile.wins / profile.profile.matches) * 100).toFixed(1) : 0}%
                            </p>
                        </div>
                        <div className="bg-[#111] p-3 sm:p-4 rounded border border-gray-800 text-center">
                            <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Улюблена роль</p>
                            <p className="text-[14px] sm:text-[18px] font-bold text-blue-400 mt-2 truncate">
                                {profile.profile?.favoriteRole || 'НЕМАЄ'}
                            </p>
                        </div>
                        <div className="bg-[#111] p-3 sm:p-4 rounded border border-gray-800 text-center">
                            <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Найдовша серія</p>
                            <p className="text-xl sm:text-2xl font-bold text-yellow-500">
                                {profile.profile?.maxWinStreak || 0}
                            </p>
                        </div>
                        <div className="bg-[#111] p-3 sm:p-4 rounded border border-gray-800 text-center">
                            <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Середня тривалість гри</p>
                            <p className="text-xl sm:text-2xl font-bold text-white">
                                {profile.profile?.matches ? ((profile.profile?.totalDuration || 0) / profile.profile.matches).toFixed(1) : 0} дн.
                            </p>
                        </div>
                        <div className="bg-[#111] p-3 sm:p-4 rounded border border-gray-800 text-center">
                            <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Виживань до кінця</p>
                            <p className="text-xl sm:text-2xl font-bold text-green-400">
                                {profile.profile?.survivedMatches || 0}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 sm:gap-4 mt-8 pt-6 border-t border-gray-800">
                        {isOwnProfile ? (
                            <>
                                <button onClick={logout} className="flex-1 bg-mafia-gray hover:bg-gray-800 text-white font-bold py-2.5 sm:py-3 px-3 sm:px-4 rounded transition-colors border border-gray-700 text-sm">
                                    {t('profile.logout')}
                                </button>
                                <button onClick={() => navigate('/lobby')} className="flex-2 bg-mafia-red hover:bg-red-700 text-white font-bold py-2.5 sm:py-3 px-3 sm:px-4 rounded transition-colors text-sm">
                                    {t('common.play')}
                                </button>
                            </>
                        ) : (
                            <button onClick={() => navigate(-1)} className="flex-1 bg-mafia-red hover:bg-red-700 text-white font-bold py-2.5 sm:py-3 px-3 sm:px-4 rounded transition-colors text-sm">
                                ← Назад
                            </button>
                        )}
                    </div>

                    {profile.profile?.matchHistory && profile.profile.matchHistory.length > 0 && (
                        <div className="mt-12 pt-10 border-t border-gray-800">
                            <h3 className="text-xs font-black text-gray-500 mb-6 tracking-[0.3em] uppercase flex items-center gap-2">
                                <Clock size={14} className="text-mafia-red" />
                                {t('profile.match_history')}
                            </h3>
                            <div className="space-y-4">
                                {profile.profile.matchHistory.map(mh => {
                                    const roleColors: Record<string, string> = {
                                        'MAFIA': 'text-red-500', 'DON': 'text-red-600', 'SILENCER': 'text-red-400', 'BOMBER': 'text-red-400',
                                        'SHERIFF': 'text-yellow-500', 'MAYOR': 'text-yellow-400', 'JUDGE': 'text-yellow-600',
                                        'DOCTOR': 'text-blue-400', 'BODYGUARD': 'text-blue-500', 'TRACKER': 'text-cyan-400', 'INFORMER': 'text-cyan-500', 'JOURNALIST': 'text-blue-300',
                                        'SERIAL_KILLER': 'text-purple-500', 'JESTER': 'text-pink-500', 'LOVERS': 'text-pink-400'
                                    };
                                    const roleColor = roleColors[mh.role as string] || 'text-blue-400';
                                    
                                    return (
                                        <div 
                                            key={mh.id} 
                                            onClick={() => navigate(`/match/${mh.match.id}`)}
                                            className="group relative bg-[#111] border border-gray-800 rounded-3xl p-5 overflow-hidden transition-all hover:border-mafia-red/50 hover:bg-gray-900/50 cursor-pointer active:scale-[0.98]"
                                        >
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                                                <div className="flex items-center gap-5">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-transform group-hover:scale-110 ${mh.won ? 'bg-green-500/10 border-green-500/40 text-green-500' : 'bg-red-500/10 border-red-500/40 text-red-500'}`}>
                                                        {mh.won ? <Trophy size={20} /> : <Skull size={20} />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className={`font-black uppercase italic text-lg tracking-tighter ${roleColor}`}>{mh.role}</p>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${mh.won ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                                                        </div>
                                                        <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest">
                                                            {new Date(mh.match.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                                    <div className="text-right">
                                                        <p className={`text-xs font-black uppercase tracking-widest mb-1 ${mh.won ? 'text-green-500' : 'text-red-500'}`}>
                                                            {mh.won ? t('profile.victory') : t('profile.defeat')}
                                                        </p>
                                                        <p className="text-[10px] text-gray-600 font-bold flex items-center justify-end gap-2 uppercase">
                                                            <Clock size={10} /> {mh.match.duration} {t('profile.days')}
                                                            <span className="text-gray-800 mx-1">|</span>
                                                            <Award size={10} /> {mh.match.winner}
                                                        </p>
                                                    </div>
                                                    <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-gray-700 group-hover:text-mafia-red transition-colors border border-gray-800">
                                                        <ArrowRight size={18} />
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Decorative Background Winner text */}
                                            <div className="absolute right-[-10%] top-[-20%] opacity-[0.02] text-[80px] font-black uppercase italic pointer-events-none select-none transition-opacity group-hover:opacity-[0.05]">
                                                {mh.match.winner}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
