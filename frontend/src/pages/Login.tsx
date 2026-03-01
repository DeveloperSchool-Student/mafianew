import { useState } from 'react';
import axios from 'axios';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [error, setError] = useState('');
    const [requires2FA, setRequires2FA] = useState(false);
    const [tempUserId, setTempUserId] = useState('');
    const [twoFactorToken, setTwoFactorToken] = useState('');

    const setUser = useAppStore(state => state.setUser);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!isLogin && !acceptedTerms) {
            setError('Ви повинні погодитися з Політикою Конфіденційності для реєстрації.');
            return;
        }

        const endpoint = isLogin ? '/auth/login' : '/auth/register';

        try {
            const res = await axios.post(`${API_URL}${endpoint}`, { username, password });

            if (res.data.requires2FA) {
                setRequires2FA(true);
                setTempUserId(res.data.userId);
                return;
            }

            setUser({
                id: res.data.user.id,
                username: res.data.user.username,
                token: res.data.access_token,
                role: res.data.user.role,
                staffRoleKey: res.data.user.staffRoleKey ?? null,
            });
            navigate('/lobby');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Authentication failed');
        }
    };

    const handle2FASubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const res = await axios.post(`${API_URL}/auth/2fa/authenticate`, { userId: tempUserId, token: twoFactorToken });
            setUser({
                id: res.data.user.id,
                username: res.data.user.username,
                token: res.data.access_token,
                role: res.data.user.role,
                staffRoleKey: res.data.user.staffRoleKey ?? null,
            });
            navigate('/lobby');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Хибний код 2FA');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-mafia-dark text-mafia-light p-4 relative">
            <div className="absolute top-4 right-4">
                <LanguageSwitcher />
            </div>

            <form onSubmit={requires2FA ? handle2FASubmit : handleSubmit} className="bg-mafia-gray p-8 rounded-lg shadow-2xl w-full max-w-md border border-red-900/30">
                <h2 className="text-3xl font-bold mb-6 text-center text-mafia-light">
                    {requires2FA ? '2FA Підтвердження' : (isLogin ? t('login.title') : t('login.register'))}
                </h2>

                {error && <div className="bg-red-900/50 border border-red-500 text-red-100 p-3 rounded mb-4 text-sm">{error}</div>}

                {requires2FA ? (
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-1 text-gray-400 text-center">Введіть 6-значний код з додатку</label>
                        <input
                            type="text"
                            value={twoFactorToken} onChange={e => setTwoFactorToken(e.target.value)} required
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:border-mafia-red focus:outline-none transition-colors text-center text-xl tracking-widest mt-2"
                            placeholder="000000"
                            maxLength={6}
                        />
                        <button type="button" onClick={() => setRequires2FA(false)} className="mt-4 w-full text-sm text-gray-500 hover:text-white transition">
                            Повернутись назад
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1 text-gray-400">{t('login.username')}</label>
                            <input
                                type="text"
                                value={username} onChange={e => setUsername(e.target.value)} required
                                className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:border-mafia-red focus:outline-none transition-colors"
                                placeholder="Login..."
                            />
                        </div>

                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-gray-400">{t('login.password')}</label>
                                {isLogin && (
                                    <button
                                        type="button"
                                        onClick={() => navigate('/forgot-password')}
                                        className="text-xs text-mafia-red hover:underline focus:outline-none"
                                    >
                                        Забули пароль?
                                    </button>
                                )}
                            </div>
                            <input
                                type="password"
                                value={password} onChange={e => setPassword(e.target.value)} required
                                className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:border-mafia-red focus:outline-none transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        {!isLogin && (
                            <div className="mb-6 flex items-start gap-2">
                                <input
                                    type="checkbox"
                                    className="mt-1 flex-shrink-0"
                                    checked={acceptedTerms}
                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                    required
                                />
                                <label className="text-sm text-gray-400">
                                    Я погоджуюсь з <a href="/privacy" target="_blank" className="text-mafia-red hover:underline">Політикою Конфіденційності</a>.
                                </label>
                            </div>
                        )}
                    </>
                )}

                <button type="submit" className="w-full bg-mafia-red hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-all duration-300 transform hover:scale-[1.02] shadow-[0_0_15px_rgba(204,0,0,0.5)]">
                    {requires2FA ? 'Увійти' : (isLogin ? t('login.submit') : t('login.register'))}
                </button>

                {!requires2FA && (
                    <p className="mt-4 text-center text-sm text-gray-500">
                        {isLogin ? 'Don\'t have an account? ' : 'Already played? '}
                        <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-mafia-red hover:underline focus:outline-none">
                            {isLogin ? t('login.register') : t('login.submit')}
                        </button>
                    </p>
                )}
            </form>
        </div>
    );
}
