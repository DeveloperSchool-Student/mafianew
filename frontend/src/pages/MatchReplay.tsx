import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, 
    Clock, 
    Trophy, 
    Moon, 
    Sun, 
    User,  
    ShieldCheck, 
    Skull, 
    MessageSquare, 
    Award,
    Search,
    PieChart,
    ChevronDown,
    Zap,
    History,
    XCircle
} from 'lucide-react';
import { fetchMatchDetails } from '../services/usersApi';
import type { MatchDetails, MatchLog } from '../services/usersApi';
import { motion, AnimatePresence } from 'framer-motion';

interface PhaseGroup {
    day: number;
    phase: string;
    logs: MatchLog[];
}

export function MatchReplay() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [match, setMatch] = useState<MatchDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState<'timeline' | 'stats'>('timeline');

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('mafia_token') || undefined;
                const data = await fetchMatchDetails(id!, token);
                setMatch(data);
                
                // Expand the first 3 phases by default
                const initialExpanded: Record<string, boolean> = {};
                if (data.logs) {
                    const uniquePhases = Array.from(new Set(data.logs.map(l => `${l.day}-${l.phase}`))).slice(0, 3);
                    uniquePhases.forEach(p => { initialExpanded[p] = true; });
                }
                setExpandedPhases(initialExpanded);
            } catch (err: unknown) {
                const axiosErr = err as { response?: { data?: { message?: string } } };
                setError(axiosErr.response?.data?.message || 'Помилка при завантаженні матчу');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const phaseGroups = useMemo(() => {
        if (!match?.logs) return [];
        const groups: PhaseGroup[] = [];
        match.logs.forEach(log => {
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && lastGroup.day === log.day && lastGroup.phase === log.phase) {
                lastGroup.logs.push(log);
            } else {
                groups.push({ day: log.day, phase: log.phase, logs: [log] });
            }
        });
        return groups;
    }, [match]);

    const togglePhase = (key: string) => {
        setExpandedPhases(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen bg-[#0a0a0a] text-white">
                <div className="relative w-24 h-24 mb-6">
                    <div className="absolute inset-0 border-4 border-red-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
                    <Trophy className="absolute inset-0 m-auto text-red-500 animate-pulse" size={32} />
                </div>
                <p className="text-gray-500 font-black uppercase tracking-widest text-xs animate-pulse">Аналіз протоколу...</p>
            </div>
        );
    }

    if (error || !match) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen bg-[#0a0a0a] text-white p-6 text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
                    <XCircle size={40} />
                </div>
                <h1 className="text-2xl font-black uppercase italic mb-2">Об'єкт не знайдено</h1>
                <p className="text-gray-500 mb-8 max-w-xs">{error || 'Дані про цей матч були видалені або пошкоджені'}</p>
                <button onClick={() => navigate(-1)} className="bg-white text-black font-black px-8 py-3 rounded-xl uppercase text-sm flex items-center gap-2 hover:bg-gray-200 transition-all active:scale-95">
                    <ArrowLeft size={16} /> Повернутися
                </button>
            </div>
        );
    }

    const { participants, logs } = match;

    const getLogIcon = (text: string) => {
        const t = text.toLowerCase();
        if (t.includes('вбито') || t.includes('страчено') || t.includes('самогубство')) return <Skull className="text-red-500" size={14} />;
        if (t.includes('проголосував')) return <MessageSquare className="text-gray-500" size={14} />;
        if (t.includes('перевірив') || t.includes('дізнався')) return <Search className="text-blue-400" size={14} />;
        if (t.includes('вилікував') || t.includes('врятував')) return <ShieldCheck className="text-green-400" size={14} />;
        if (t.includes('переміг') || t.includes('виграла')) return <Trophy className="text-yellow-500" size={14} />;
        return <Zap className="text-indigo-400" size={14} />;
    };

    const getLogColor = (text: string) => {
        const t = text.toLowerCase();
        if (t.includes('вбито') || t.includes('страчено') || t.includes('самогубство')) return 'text-red-400';
        if (t.includes('перемож') || t.includes('виграла')) return 'text-yellow-400 font-bold';
        if (t.includes('перевірив') || t.includes('дізнався')) return 'text-blue-300';
        if (t.includes('вилікував')) return 'text-green-300';
        return 'text-gray-300';
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center pb-24 selection:bg-red-500/30">
            {/* Hero Header */}
            <div className="w-full bg-[#0d0d0d] border-b border-gray-800/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_rgba(220,38,38,0.15)_0%,_transparent_70%)]" />
                <div className="max-w-5xl mx-auto px-6 py-10 sm:py-16 relative z-10">
                    <button onClick={() => navigate(-1)} className="group text-gray-500 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] mb-8 border border-gray-800/50 rounded-full px-4 py-1.5 bg-black/40 backdrop-blur-sm w-fit">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        Назад до профілю
                    </button>
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                                    Replay Mode
                                </div>
                                <span className="text-gray-600 font-mono text-sm"># {match.id.toUpperCase().split('-')[0]}</span>
                            </div>
                            <h1 className="text-5xl sm:text-7xl font-black italic tracking-tighter uppercase leading-none mb-4">
                                Результати <span className="text-red-600">Матчу</span>
                            </h1>
                            <div className="flex flex-wrap items-center gap-4 text-gray-400 text-sm font-medium">
                                <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-800/50">
                                    <Clock size={16} className="text-red-500" />
                                    {new Date(match.createdAt).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-800/50 uppercase text-xs font-black tracking-widest">
                                    Тривалість: {match.duration} Днів
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-3xl border border-gray-800 shadow-2xl min-w-[240px]">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Переможець</p>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center border border-yellow-500/20 text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.1)]">
                                    <Trophy size={24} />
                                </div>
                                <div>
                                    <h4 className="text-3xl font-black italic uppercase text-white tracking-widest leading-none mb-1">
                                        {match.winner}
                                    </h4>
                                    <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Victory achieved</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="w-full max-w-5xl px-6 -mt-8 relative z-20">
                {/* Tabs / Navigation */}
                <div className="flex gap-4 mb-8">
                    <button 
                        onClick={() => setActiveTab('timeline')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border ${activeTab === 'timeline' ? 'bg-red-600 border-red-500 text-white shadow-xl shadow-red-600/20' : 'bg-[#0d0d0d] border-gray-800 text-gray-500 hover:text-gray-300'}`}
                    >
                        <History size={18} /> Хронологія
                    </button>
                    <button 
                        onClick={() => setActiveTab('stats')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border ${activeTab === 'stats' ? 'bg-red-600 border-red-500 text-white shadow-xl shadow-red-600/20' : 'bg-[#0d0d0d] border-gray-800 text-gray-500 hover:text-gray-300'}`}
                    >
                        <PieChart size={18} /> Учасники
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column (Main Content) */}
                    <div className="lg:col-span-2 space-y-6">
                        {activeTab === 'timeline' ? (
                            <div className="space-y-4">
                                {phaseGroups.length > 0 ? (
                                    phaseGroups.map((group, idx) => {
                                        const key = `${group.day}-${group.phase}`;
                                        const isExpanded = expandedPhases[key];
                                        const isNight = group.phase === 'NIGHT';
                                        
                                        return (
                                            <div key={key} className={`rounded-3xl border transition-all overflow-hidden ${isNight ? 'bg-[#0a0f1e]/40 border-indigo-500/20' : 'bg-[#1a150a]/40 border-amber-500/20'}`}>
                                                <button 
                                                    onClick={() => togglePhase(key)}
                                                    className="w-full p-6 flex items-center justify-between group hover:bg-white/5 transition-colors"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${isNight ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-500'}`}>
                                                            {isNight ? <Moon size={24} /> : <Sun size={24} />}
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Етап {idx + 1}</p>
                                                            <h3 className="text-xl font-black italic uppercase tracking-tighter">
                                                                {isNight ? 'Покров Ночі' : 'Світло Дня'} — {group.day} День
                                                            </h3>
                                                        </div>
                                                    </div>
                                                    <div className={`text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                        <ChevronDown size={20} />
                                                    </div>
                                                </button>

                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div 
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="border-t border-gray-800/50 bg-black/20"
                                                        >
                                                            <div className="p-4 sm:p-6 space-y-3 font-mono text-sm">
                                                                {group.logs.map((log, lIdx) => (
                                                                    <div key={lIdx} className="flex gap-4 group/item">
                                                                        <div className="flex flex-col items-center gap-1 mt-1">
                                                                            <div className="w-6 h-6 rounded-lg bg-gray-900 flex items-center justify-center border border-gray-800 text-gray-600 group-hover/item:text-white transition-colors">
                                                                                {getLogIcon(log.text)}
                                                                            </div>
                                                                            <div className="w-0.5 flex-1 bg-gray-800/40"></div>
                                                                        </div>
                                                                        <div className={`flex-1 pb-4 border-b border-gray-800/20 last:border-0 ${getLogColor(log.text)}`}>
                                                                            {log.text}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-24 text-center bg-[#0d0d0d] border border-dashed border-gray-800 rounded-3xl">
                                        <History size={48} className="text-gray-700 mx-auto mb-4" />
                                        <p className="text-gray-500 font-bold uppercase italic tracking-widest">Логи відсутні або пошкоджені</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {participants.map((p, idx) => (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={idx} 
                                        className={`group relative overflow-hidden p-5 rounded-3xl border transition-all ${p.won ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40' : 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'}`}
                                    >
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-transform group-hover:scale-110 ${p.won ? 'bg-green-500/10 border-green-500/40 text-green-500' : 'bg-red-500/10 border-red-500/40 text-red-500'}`}>
                                                <User size={28} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                     <h4 className="text-lg font-black italic uppercase tracking-tighter truncate max-w-[120px]">{p.profile.user.username}</h4>
                                                     <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${p.won ? 'bg-green-500 text-white' : 'bg-red-900 text-red-100'}`}>
                                                         {p.won ? 'Перемога' : 'Поразка'}
                                                     </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">{p.role}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Background Decor */}
                                        <div className={`absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity ${p.won ? 'text-green-500' : 'text-red-500'}`}>
                                            <Award size={100} />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Column (Sidebar/Summary) */}
                    <div className="space-y-6">
                        <div className="bg-[#0d0d0d] border border-gray-800 rounded-[2rem] p-8 shadow-2xl">
                            <h3 className="text-xl font-black uppercase italic mb-6 flex items-center gap-2">
                                <Award className="text-red-500" size={20} /> Аналітика
                            </h3>
                            
                            <div className="space-y-6">
                                <div className="flex justify-between items-center pb-4 border-b border-gray-800/50">
                                    <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Учасників</span>
                                    <span className="text-lg font-black italic">{participants.length}</span>
                                </div>
                                <div className="flex justify-between items-center pb-4 border-b border-gray-800/50">
                                    <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Днів гри</span>
                                    <span className="text-lg font-black italic">{match.duration}</span>
                                </div>
                                <div className="flex justify-between items-center pb-4 border-b border-gray-800/50">
                                    <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Смертей</span>
                                    <span className="text-lg font-black italic text-red-500">{logs?.filter(l => l.text.toLowerCase().includes('убито') || l.text.toLowerCase().includes('страчено')).length || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Фракція-переможець</span>
                                    <span className={`text-sm font-black uppercase tracking-tighter ${match.winner.toLowerCase().includes('мафія') ? 'text-red-500' : 'text-green-500'}`}>{match.winner}</span>
                                </div>
                            </div>

                            <button onClick={() => navigate('/lobby')} className="w-full mt-8 bg-gray-900 hover:bg-white hover:text-black py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 border border-gray-800 ">
                                Повернутися в Лоббі
                            </button>
                        </div>

                        {/* Quick Tips or Meta info */}
                        <div className="p-6 bg-red-600/5 border border-red-600/20 rounded-3xl">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-2 flex items-center gap-2">
                                <ShieldCheck size={14} /> Порада
                            </h5>
                            <p className="text-xs text-gray-400 leading-relaxed font-medium">
                                Аналізуючи реплеї, звертайте увагу на ланцюжки голосувань. Це допоможе краще розуміти стратегію суперників.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

