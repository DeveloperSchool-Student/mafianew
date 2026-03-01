import { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            setStatus({ type: 'error', msg: 'Токен відсутній у посиланні. Будь ласка, перевірте ваше посилання.' });
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setStatus({ type: 'error', msg: 'Паролі не співпадають!' });
            return;
        }

        if (password.length < 6) {
            setStatus({ type: 'error', msg: 'Пароль має бути не менше 6 символів.' });
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            const res = await axios.post(`${API_URL}/auth/reset-password`, { token, newPassword: password });
            setStatus({ type: 'success', msg: res.data.message });
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            setStatus({ type: 'error', msg: err.response?.data?.message || 'Помилка скидання паролю' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-mafia-dark text-mafia-light p-4">
            <div className="bg-mafia-gray p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-800 relative">
                <button
                    onClick={() => navigate('/login')}
                    className="absolute top-4 left-4 text-gray-500 hover:text-white transition"
                    title="На головну"
                >
                    <ArrowLeft size={20} />
                </button>

                <div className="flex flex-col items-center mb-6 mt-4">
                    <div className="bg-mafia-red/20 p-4 rounded-full mb-4">
                        <Lock className="text-mafia-red w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-center text-mafia-light">Створення нового паролю</h2>
                </div>

                {status && (
                    <div className={`p-3 rounded mb-6 text-sm ${status.type === 'success' ? 'bg-green-900/50 border border-green-500 text-green-200' : 'bg-red-900/50 border border-red-500 text-red-100'}`}>
                        {status.msg}
                    </div>
                )}

                {!status || status.type !== 'success' ? (
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1 text-gray-400">Новий пароль</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                disabled={!token || loading}
                                className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:border-mafia-red focus:outline-none transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-1 text-gray-400">Підтвердіть пароль</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                disabled={!token || loading}
                                className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:border-mafia-red focus:outline-none transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!token || loading}
                            className="w-full bg-mafia-red hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Збереження...' : 'Змінити пароль'}
                        </button>
                    </form>
                ) : null}
            </div>
        </div>
    );
}
