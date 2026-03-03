import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft, Package, Sparkles } from 'lucide-react';

export function Trades() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-mafia-dark text-mafia-light p-4 sm:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-white transition">
                        <ArrowLeft size={24} />
                    </button>
                    <ArrowRightLeft size={32} className="text-blue-500" />
                    <h1 className="text-2xl sm:text-3xl font-bold">Система Обміну</h1>
                </div>

                <div className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-8 sm:p-12 text-center border-b border-gray-800 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                            <div className="absolute top-4 left-1/4 animate-pulse"><Sparkles size={24} /></div>
                            <div className="absolute bottom-6 right-1/3 animate-pulse delay-500"><Sparkles size={20} /></div>
                            <div className="absolute top-8 right-1/4 animate-pulse delay-1000"><Sparkles size={16} /></div>
                        </div>

                        <div className="relative z-10">
                            <div className="w-20 h-20 mx-auto mb-6 bg-purple-500/20 border-2 border-purple-500/50 rounded-full flex items-center justify-center">
                                <Package size={40} className="text-purple-400" />
                            </div>

                            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                                Обмін Колекційними Предметами
                            </h2>

                            <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 px-4 py-2 rounded-full text-sm font-bold">
                                <Sparkles size={16} /> Coming Soon
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 sm:p-10">
                        <div className="space-y-6 text-center">
                            <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
                                Ми готуємо новий формат обміну! Незабаром ви зможете обмінюватись
                                <strong className="text-white"> колекційними картками</strong>,
                                <strong className="text-white"> рамками</strong> та
                                <strong className="text-white"> унікальними предметами</strong> з іншими гравцями.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5">
                                    <div className="text-3xl mb-3">🃏</div>
                                    <h3 className="text-white font-bold mb-1">Картки</h3>
                                    <p className="text-gray-500 text-xs">Унікальні картки ролей та персонажів</p>
                                </div>
                                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5">
                                    <div className="text-3xl mb-3">🖼️</div>
                                    <h3 className="text-white font-bold mb-1">Рамки</h3>
                                    <p className="text-gray-500 text-xs">Ексклюзивні рамки для профілю</p>
                                </div>
                                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5">
                                    <div className="text-3xl mb-3">✨</div>
                                    <h3 className="text-white font-bold mb-1">Предмети</h3>
                                    <p className="text-gray-500 text-xs">Лімітовані предмети з івентів</p>
                                </div>
                            </div>

                            <div className="mt-8 p-4 bg-blue-900/15 border border-blue-800/30 rounded-lg">
                                <p className="text-blue-400 text-sm">
                                    💡 Обмін валютою (монети/донат) між гравцями більше не підтримується.
                                    Новий формат обміну буде зосереджений на колекційних предметах.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
