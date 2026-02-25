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
    const [error, setError] = useState('');
    const setUser = useAppStore(state => state.setUser);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const endpoint = isLogin ? '/auth/login' : '/auth/register';

        try {
            const res = await axios.post(`${API_URL}${endpoint}`, { username, password });
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

    return (
        <div className="flex items-center justify-center min-h-screen bg-mafia-dark text-mafia-light p-4 relative">
            <div className="absolute top-4 right-4">
                <LanguageSwitcher />
            </div>

            <form onSubmit={handleSubmit} className="bg-mafia-gray p-8 rounded-lg shadow-2xl w-full max-w-md border border-red-900/30">
                <h2 className="text-3xl font-bold mb-6 text-center text-mafia-light">
                    {isLogin ? t('login.title') : t('login.register')}
                </h2>

                {error && <div className="bg-red-900/50 border border-red-500 text-red-100 p-3 rounded mb-4 text-sm">{error}</div>}

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
                    <label className="block text-sm font-medium mb-1 text-gray-400">{t('login.password')}</label>
                    <input
                        type="password"
                        value={password} onChange={e => setPassword(e.target.value)} required
                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:border-mafia-red focus:outline-none transition-colors"
                        placeholder="••••••••"
                    />
                </div>

                <button type="submit" className="w-full bg-mafia-red hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-all duration-300 transform hover:scale-[1.02] shadow-[0_0_15px_rgba(204,0,0,0.5)]">
                    {isLogin ? t('login.submit') : t('login.register')}
                </button>

                <p className="mt-4 text-center text-sm text-gray-500">
                    {isLogin ? 'Don\'t have an account? ' : 'Already played? '}
                    <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-mafia-red hover:underline focus:outline-none">
                        {isLogin ? t('login.register') : t('login.submit')}
                    </button>
                </p>
            </form>
        </div>
    );
}
