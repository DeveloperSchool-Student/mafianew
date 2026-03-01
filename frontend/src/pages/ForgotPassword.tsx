import { useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus(null);

        try {
            const res = await axios.post(`${API_URL}/auth/forgot-password`, { email });
            setStatus({ type: 'success', msg: res.data.message });
        } catch (err: any) {
            setStatus({ type: 'error', msg: err.response?.data?.message || 'Помилка відправки запиту' });
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
                    title="Назад"
                >
                    <ArrowLeft size={20} />
                </button>

                <div className="flex flex-col items-center mb-6 mt-4">
                    <div className="bg-mafia-red/20 p-4 rounded-full mb-4">
                        <Mail className="text-mafia-red w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-center text-mafia-light">Відновлення паролю</h2>
                    <p className="text-gray-400 text-sm text-center mt-2">
                        Введіть свій email, і ми надішлемо вам інструкції для відновлення паролю.
                    </p>
                </div>

                {status && (
                    <div className={`p-3 rounded mb-6 text-sm ${status.type === 'success' ? 'bg-green-900/50 border border-green-500 text-green-200' : 'bg-red-900/50 border border-red-500 text-red-100'}`}>
                        {status.msg}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-1 text-gray-400">Електронна пошта</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:border-mafia-red focus:outline-none transition-colors"
                            placeholder="mail@example.com"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-mafia-red hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Відправка...' : 'Надіслати посилання'}
                    </button>
                </form>
            </div>
        </div>
    );
}
