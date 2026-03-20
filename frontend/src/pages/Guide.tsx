import { useNavigate } from 'react-router-dom';
import { 
    Users, 
    Target, 
    Zap,  
    ShieldCheck, 
    Skull, 
    Sword, 
    Scale, 
    Smartphone, 
    Trophy, 
    ArrowRight,
    Search,
    Heart,
    Bomb,
    Eye,
    Hammer,
    ArrowLeft
} from 'lucide-react';
import { motion } from 'framer-motion';

export function Guide() {
    const navigate = useNavigate();

    const roleCards = [
        { name: 'Citizen', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: <Users />, desc: 'Звичайний мирний житель. Його мета — знайти мафію за допомогою логіки та обговорень.' },
        { name: 'Sheriff', color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: <Search />, desc: 'Щоночі перевіряє гравця. Якщо Шериф стріляє в мирного — гинуть обидва.' },
        { name: 'Doctor', color: 'text-green-500', bg: 'bg-green-500/10', icon: <Heart />, desc: 'Лікує одного гравця щоночі. Не може лікувати себе двічі поспіль.' },
        { name: 'Escort', color: 'text-pink-500', bg: 'bg-pink-500/10', icon: <Target />, desc: 'Блокує нічну дію обраного гравця. Корисна роль для стримування мафії.' },
        { name: 'Mayor', color: 'text-cyan-500', bg: 'bg-cyan-500/10', icon: <Scale />, desc: 'Світла роль, чий голос на денному голосуванні рахується за два.' },
        { name: 'Mafia', color: 'text-red-500', bg: 'bg-red-500/10', icon: <Sword />, desc: 'Члени угруповання. Знають один одного та щоночі обирають жертву.' },
        { name: 'Don', color: 'text-red-600', bg: 'bg-red-600/10', icon: <Eye />, desc: 'Голова мафії. Шукає Шерифа щоночі серед мешканців.' },
        { name: 'Silencer', color: 'text-red-400', bg: 'bg-red-400/10', icon: <Zap />, desc: 'Позбавляє обраного гравця можливості писати в чат на наступний день.' },
        { name: 'Bomber', color: 'text-red-500', bg: 'bg-red-700/10', icon: <Bomb />, desc: 'Закладає вибухівку, яка може знищити кількох гравців одночасно.' },
        { name: 'Serial Killer', color: 'text-purple-500', bg: 'bg-purple-500/10', icon: <Skull />, desc: 'Нейтральний вбивця. Перемагає, якщо залишиться один.' },
        { name: 'Jester', color: 'text-orange-500', bg: 'bg-orange-500/10', icon: <Hammer />, desc: 'Блазень. Його мета — бути страченим на денному голосуванні.' },
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 sm:p-8 flex flex-col items-center selection:bg-mafia-red/30">
            <div className="w-full max-w-5xl mt-4">
                <button 
                    onClick={() => navigate('/lobby')} 
                    className="mb-8 text-gray-500 hover:text-white transition-all flex items-center gap-2 group text-xs font-black uppercase tracking-widest"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
                    Повернутися в Лоббі
                </button>

                <div className="relative mb-16">
                     <div className="absolute -left-10 -top-10 w-40 h-40 bg-mafia-red/10 rounded-full blur-[80px]" />
                     <h1 className="text-5xl sm:text-7xl font-black italic tracking-tighter uppercase leading-none mb-4">
                        Посібник <span className="text-mafia-red underline decoration-1 underline-offset-8">Гравця</span>
                     </h1>
                     <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-xs">Все, що потрібно знати про місто</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-16">
                        
                        {/* Phase 1: Basics */}
                        <section>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/30">
                                    <Target size={24} />
                                </div>
                                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Основа та Мета</h2>
                            </div>
                            
                            <div className="bg-[#0b0b0b] border border-gray-800 rounded-3xl p-8 leading-relaxed text-gray-400 space-y-6">
                                <p>
                                    <strong className="text-white">MafiaNew</strong> — це багатокористувацька стратегічна гра з прихованими ролями. Гравці діляться на команди, кожна з яких має свою ціль.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <h4 className="text-blue-500 font-black uppercase text-xs tracking-widest">Мирні Жителі</h4>
                                        <p className="text-sm">Вирахувати всіх членів мафії та стратити їх на денному голосуванні. Ваша зброя — логіка та дедукція.</p>
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-mafia-red font-black uppercase text-xs tracking-widest">Мафія та Злодії</h4>
                                        <p className="text-sm">Пережити денні обговорення та потайки прибирати жителів вночі, доки не отримаєте контроль над містом.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Phase 2: Role Cards */}
                        <section>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-mafia-red/20 rounded-2xl flex items-center justify-center text-mafia-red border border-mafia-red/30">
                                    <Users size={24} />
                                </div>
                                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Архіви Ролей</h2>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {roleCards.map((role, idx) => (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        key={idx} 
                                        className="bg-[#0b0b0b] border border-gray-800 p-6 rounded-3xl hover:border-gray-600 transition-all group"
                                    >
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className={`w-10 h-10 ${role.bg} ${role.color} rounded-xl flex items-center justify-center border border-current/20 group-hover:scale-110 transition-transform`}>
                                                {role.icon}
                                            </div>
                                            <h4 className={`text-xl font-black italic uppercase tracking-tighter ${role.color}`}>{role.name}</h4>
                                        </div>
                                        <p className="text-sm text-gray-500 leading-relaxed">{role.desc}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </section>

                        {/* Phase 3: Systems */}
                        <section>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center text-yellow-500 border border-yellow-500/30">
                                    <Trophy size={24} />
                                </div>
                                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Економіка та Клани</h2>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-gray-900 to-black p-8 rounded-3xl border border-gray-800">
                                    <h4 className="text-white font-black uppercase text-sm mb-4 flex items-center gap-2">
                                        <Sword className="text-orange-500" size={16} /> Кланові Війни
                                    </h4>
                                    <p className="text-sm text-gray-500 leading-relaxed mb-6">Об'єднуйтесь у клани, щоб отримувати бонуси до досвіду та брати участь у масштабних Clan Wars. Чим сильніше ваш клан — тим вище ви в глобальному рейтингу.</p>
                                    <div className="flex gap-4">
                                        <div className="bg-orange-500/10 border border-orange-500/30 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-orange-500">Exp Boost x1.2</div>
                                        <div className="bg-orange-500/10 border border-orange-500/30 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-orange-500">Clan Skins</div>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-gray-900 to-black p-8 rounded-3xl border border-gray-800">
                                    <h4 className="text-white font-black uppercase text-sm mb-4 flex items-center gap-2">
                                        <Users className="text-blue-500" size={16} /> Торгівля та Обмін
                                    </h4>
                                    <p className="text-sm text-gray-500 leading-relaxed mb-6">Маєте рідкісні рамки чи титули? Використовуйте систему Trades, щоб обмінюватися предметами з іншими гравцями. Будьте обережні та перевіряйте склад угоди перед підтвердженням.</p>
                                    <button onClick={() => navigate('/trades')} className="text-blue-500 text-[10px] font-black uppercase hover:underline flex items-center gap-2">
                                        Відкрити ринок <ArrowRight size={12} />
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Phase 4: Rules */}
                        <section>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 border border-red-500/30">
                                    <ShieldCheck size={24} />
                                </div>
                                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Правила Поведінки</h2>
                            </div>
                            
                            <div className="bg-[#0b0b0b] border border-gray-800 rounded-3xl p-8 space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <h5 className="text-white font-black uppercase text-[10px] tracking-widest">5.1. Повага</h5>
                                        <p className="text-xs text-gray-500 leading-relaxed">Заборонені будь-які прямі образи, розпалювання ворожнечі або погрози.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <h5 className="text-white font-black uppercase text-[10px] tracking-widest">5.2. Чесна гра</h5>
                                        <p className="text-xs text-gray-500 leading-relaxed">Використання скриптів, багів або передача інформації поза ігровим чатом суворо заборонені.</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-red-900/10 border-l-2 border-mafia-red">
                                    <p className="text-[10px] text-gray-400 italic">Порушення правил може призвести до тимчасового або довічного блокування аккаунту.</p>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Sidebar / Quick Tips */}
                    <div className="space-y-8">
                        <div className="bg-[#0b0b0b] border border-gray-800 rounded-[2rem] p-8 sticky top-8">
                             <h3 className="text-lg font-black uppercase italic mb-8 flex items-center gap-2">
                                <Smartphone className="text-mafia-red" size={20} /> Mobile Guide
                             </h3>
                             
                             <div className="space-y-10">
                                <div className="space-y-3">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Дистанційна Дія</h5>
                                    <p className="text-xs text-gray-500 leading-relaxed">На мобільних пристроях ви можете використовувати довге натискання на гравця для виклику меню дій.</p>
                                </div>
                                
                                <div className="space-y-3">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Швидкий Чат</h5>
                                    <p className="text-xs text-gray-500 leading-relaxed">Використовуйте заготовлені фрази праворуч від поля вводу, щоб швидко реагувати на звинувачення.</p>
                                </div>

                                <div className="p-6 bg-red-600/5 border border-red-600/20 rounded-2xl">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-3 flex items-center gap-2">
                                        <ShieldCheck size={14} /> Захист аккаунту
                                    </h5>
                                    <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                                        Ми рекомендуємо увімкнути 2FA у профілі для захисту ваших скінів та кланової власності.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                     <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Розклад Дня</h5>
                                     <div className="space-y-2">
                                         <div className="flex justify-between text-[10px] font-bold uppercase py-2 border-b border-gray-800/50">
                                             <span className="text-gray-600">Обговорення</span>
                                             <span>60s</span>
                                         </div>
                                         <div className="flex justify-between text-[10px] font-bold uppercase py-2 border-b border-gray-800/50">
                                             <span className="text-gray-600">Голосування</span>
                                             <span>30s</span>
                                         </div>
                                         <div className="flex justify-between text-[10px] font-bold uppercase py-2 border-b border-gray-800/50">
                                             <span className="text-gray-600">Ніч</span>
                                             <span>40s</span>
                                         </div>
                                     </div>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>

                <footer className="mt-24 pb-12 border-t border-gray-800 pt-12 text-center">
                    <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.5em] mb-4">MafiaNew Digital Protocol</p>
                    <div className="flex justify-center gap-8">
                        <button className="text-gray-400 hover:text-white text-[10px] font-bold uppercase transition">Privacy Policy</button>
                        <button className="text-gray-400 hover:text-white text-[10px] font-bold uppercase transition">Terms of Service</button>
                        <button className="text-gray-400 hover:text-white text-[10px] font-bold uppercase transition">Support</button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
