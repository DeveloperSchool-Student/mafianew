import { useEffect, useState } from 'react';
import { CoinIcon } from '../components/CoinIcon';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import axios from 'axios';
import { ArrowLeft, Shield, Users, FileText, Activity, UserCog, Trash2, Award, Eye, Gift, Swords, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TITLES } from '../constants/titles';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/* ── Role Definitions (mirror of backend admin.roles.ts) ── */
const STAFF_ROLES = [
    { key: 'OWNER', title: 'Власник', power: 9, color: '#ff0000' },
    { key: 'CURATOR', title: 'Куратор Адміністраторів', power: 8, color: '#ff4400' },
    { key: 'SENIOR_ADMIN', title: 'Старший Адміністратор', power: 7, color: '#ff6600' },
    { key: 'ADMIN', title: 'Адміністратор', power: 6, color: '#ff8800' },
    { key: 'JUNIOR_ADMIN', title: 'Молодший Адміністратор', power: 5, color: '#ffaa00' },
    { key: 'SENIOR_MOD', title: 'Старший Модератор', power: 4, color: '#00ccff' },
    { key: 'MOD', title: 'Модератор', power: 3, color: '#00aaff' },
    { key: 'HELPER', title: 'Хелпер', power: 2, color: '#44ddaa' },
    { key: 'TRAINEE', title: 'Стажер', power: 1, color: '#88cc88' },
];

function getMyPower(staffRoleKey?: string | null): number {
    if (!staffRoleKey) return 0;
    return STAFF_ROLES.find(r => r.key === staffRoleKey)?.power ?? 0;
}

function headers(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

type Tab = 'reports' | 'appeals' | 'clanwars' | 'users' | 'staff' | 'logs' | 'duties' | 'leaders' | 'rooms' | 'events' | 'stats' | 'seasons';

export function AdminPage() {
    const { user } = useAppStore();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [tab, setTab] = useState<Tab>('reports');
    const [actionTarget, setActionTarget] = useState('');
    const myPower = getMyPower(user?.staffRoleKey);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        if (myPower === 0) { navigate('/lobby'); return; }
    }, [user, myPower, navigate]);

    if (!user || myPower === 0) return null;

    const tabs: { key: Tab; label: string; icon: any; minPower: number }[] = [
        { key: 'reports', label: t('admin.reports'), icon: FileText, minPower: 1 },
        { key: 'appeals', label: 'Апеляції', icon: Shield, minPower: 1 },
        { key: 'clanwars', label: 'Війни Кланів', icon: Swords, minPower: 4 },
        { key: 'users', label: t('admin.users'), icon: Users, minPower: 3 },
        { key: 'rooms', label: 'Кімнати', icon: Eye, minPower: 3 },
        { key: 'staff', label: t('admin.staff'), icon: UserCog, minPower: 8 },
        { key: 'leaders', label: 'Лідери', icon: Award, minPower: 8 },
        { key: 'logs', label: t('admin.logs'), icon: Activity, minPower: 7 },
        { key: 'duties', label: 'Обов\'язки', icon: FileText, minPower: 1 },
        { key: 'stats', label: 'Статистика', icon: Activity, minPower: 7 },
        { key: 'seasons', label: 'Сезони', icon: Calendar, minPower: 8 },
        { key: 'events', label: 'Івенти', icon: Gift, minPower: 9 },
    ];

    return (
        <div className="min-h-screen bg-mafia-dark text-mafia-light">
            {/* Header */}
            <div className="bg-[#161616] border-b border-gray-800 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-4">
                    <button onClick={() => navigate('/lobby')} className="text-gray-400 hover:text-white transition">
                        <ArrowLeft size={20} />
                    </button>
                    <Shield size={20} className="text-mafia-red sm:w-6 sm:h-6" />
                    <h1 className="text-base sm:text-xl font-bold">{t('admin.title')}</h1>
                    {user.staffTitle && (
                        <span className="text-xs sm:text-sm px-2 py-0.5 rounded border hidden sm:inline" style={{ color: user.staffColor || '#aaa', borderColor: user.staffColor || '#aaa' }}>
                            {user.staffTitle}
                        </span>
                    )}
                </div>
                <span className="text-gray-500 text-xs sm:text-sm">{user.username}</span>
            </div>

            {/* Mobile Tab Bar */}
            <div className="md:hidden flex overflow-x-auto border-b border-gray-800 bg-[#111]">
                {tabs.filter(t => myPower >= t.minPower).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-medium whitespace-nowrap transition border-b-2 ${tab === t.key ? 'border-mafia-red text-white' : 'border-transparent text-gray-400'}`}
                    >
                        <t.icon size={14} />
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="flex">
                {/* Desktop Sidebar */}
                <nav className="hidden md:block w-56 bg-[#111] border-r border-gray-800 min-h-[calc(100vh-64px)] p-4 space-y-1">
                    {tabs.filter(t => myPower >= t.minPower).map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition ${tab === t.key ? 'bg-mafia-red/20 text-white border border-mafia-red/40' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'}`}
                        >
                            <t.icon size={16} />
                            {t.label}
                        </button>
                    ))}
                </nav>

                {/* Content */}
                <main className="flex-1 p-3 sm:p-6 overflow-x-hidden">
                    {tab === 'reports' && <ReportsTab token={user.token} myPower={myPower} onUserAction={(username) => { setActionTarget(username); setTab('users'); }} />}
                    {tab === 'appeals' && <AppealsTab token={user.token} myPower={myPower} onUserAction={(username) => { setActionTarget(username); setTab('users'); }} />}
                    {tab === 'clanwars' && <ClanWarsTab token={user.token} />}
                    {tab === 'users' && <UsersTab token={user.token} myPower={myPower} actionTarget={actionTarget} setActionTarget={setActionTarget} />}
                    {tab === 'staff' && <StaffTab token={user.token} myPower={myPower} />}
                    {tab === 'rooms' && <RoomsTab token={user.token} />}
                    {tab === 'leaders' && <LeadersTab token={user.token} />}
                    {tab === 'logs' && <LogsTab token={user.token} myPower={myPower} onUserAction={(username) => { setActionTarget(username); setTab('users'); }} />}
                    {tab === 'duties' && <DutiesTab />}
                    {tab === 'stats' && <StatsTab token={user.token} />}
                    {tab === 'seasons' && <SeasonsTab token={user.token} />}
                    {tab === 'events' && <EventsTab token={user.token} />}
                </main>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   REPORTS TAB
   ═══════════════════════════════════════════════════════════ */
function ReportsTab({ token, myPower, onUserAction }: { token: string; myPower: number; onUserAction: (username: string) => void }) {
    const [reports, setReports] = useState<any[]>([]);
    const [filter, setFilter] = useState('OPEN');
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();

    const load = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/reports?status=${filter}`, headers(token));
            setReports(res.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, [filter]);

    const resolve = async (id: string, status: 'RESOLVED' | 'REJECTED') => {
        const note = prompt(t('admin.comment_prompt'));
        try {
            await axios.post(`${API_URL}/admin/reports/${id}/resolve`, { status, note: note || undefined }, headers(token));
            load();
        } catch (e: any) { alert(e.response?.data?.message || t('common.error')); }
    };

    const quickPunish = async (targetUsername: string, type: 'MUTE' | 'BAN', durationSeconds: number, reason: string) => {
        if (!confirm(`${type} ${targetUsername} — ${durationSeconds}s — "${reason}"?`)) return;
        try {
            await axios.post(`${API_URL}/admin/punish`, {
                targetUsername, type, durationSeconds, scope: 'GLOBAL', reason
            }, headers(token));
            alert(t('admin.punishment_issued'));
        } catch (e: any) { alert(e.response?.data?.message || t('common.error')); }
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                <h2 className="text-xl sm:text-2xl font-bold">📋 {t('admin.reports')}</h2>
                <div className="flex gap-2">
                    {['OPEN', 'RESOLVED', 'REJECTED'].map(s => (
                        <button key={s} onClick={() => setFilter(s)}
                            className={`text-xs px-3 py-1.5 rounded border transition ${filter === s ? 'bg-mafia-red/20 border-mafia-red text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                        >{s}</button>
                    ))}
                </div>
            </div>

            {loading ? <p className="text-gray-500">{t('common.loading')}</p> : reports.length === 0 ? <p className="text-gray-500">{t('admin.no_reports', { status: filter })}</p> : (
                <div className="space-y-3">
                    {reports.map(r => (
                        <div key={r.id} className="bg-[#1a1a1a] border border-gray-800 rounded p-3 sm:p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-sm">
                                        <b className="text-gray-300">{t('admin.from')}</b> <button onClick={() => r.reporter?.username && onUserAction(r.reporter.username)} className="text-yellow-400 hover:underline">{r.reporter?.username || r.reporterId}</button>
                                    </p>
                                    <p className="text-sm">
                                        <b className="text-gray-300">{t('admin.to_target')}</b> <button onClick={() => r.target?.username && onUserAction(r.target.username)} className="text-red-400 font-bold hover:underline">{r.target?.username || r.targetId}</button>
                                    </p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${r.status === 'OPEN' ? 'bg-yellow-900/50 text-yellow-300' : r.status === 'RESOLVED' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                                    {r.status}
                                </span>
                            </div>
                            <p className="text-gray-300 mb-2 text-sm">{r.reason}</p>
                            {r.screenshotUrl && (
                                <a href={r.screenshotUrl} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline">{t('admin.screenshot')}</a>
                            )}
                            {r.resolvedNote && <p className="text-sm text-gray-500 mt-1">{t('admin.response')} {r.resolvedNote}</p>}
                            <p className="text-xs text-gray-600 mt-2">{new Date(r.createdAt).toLocaleString('uk-UA')}</p>
                            {r.status === 'OPEN' && myPower >= 2 && (
                                <div className="flex flex-col gap-2 mt-3">
                                    <div className="flex gap-2 flex-wrap">
                                        <button onClick={() => resolve(r.id, 'RESOLVED')} className="text-xs bg-green-900/50 hover:bg-green-700 border border-green-600 text-green-300 px-3 py-1 rounded transition">{t('admin.resolve')}</button>
                                        <button onClick={() => resolve(r.id, 'REJECTED')} className="text-xs bg-red-900/50 hover:bg-red-700 border border-red-600 text-red-300 px-3 py-1 rounded transition">{t('admin.reject')}</button>
                                    </div>
                                    {myPower >= 3 && r.target?.username && (
                                        <div className="flex gap-2 flex-wrap">
                                            <span className="text-xs text-gray-500 py-1">{t('admin.quick_action')}</span>
                                            <button onClick={() => quickPunish(r.target.username, 'MUTE', 3600, 'Скарги: Порушення правил')} className="text-xs bg-orange-900/50 hover:bg-orange-700 border border-orange-600 text-orange-300 px-2 py-1 rounded transition">Mute 1h</button>
                                            <button onClick={() => quickPunish(r.target.username, 'MUTE', 86400, 'Скарги: Серйозне порушення')} className="text-xs bg-orange-900/50 hover:bg-orange-700 border border-orange-600 text-orange-300 px-2 py-1 rounded transition">Mute 1d</button>
                                            <button onClick={() => quickPunish(r.target.username, 'BAN', 86400, 'Скарги: Бан 1 день')} className="text-xs bg-red-900/50 hover:bg-red-700 border border-red-600 text-red-300 px-2 py-1 rounded transition">Ban 1d</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   APPEALS TAB
   ═══════════════════════════════════════════════════════════ */
function AppealsTab({ token, myPower, onUserAction }: { token: string; myPower: number; onUserAction: (username: string) => void }) {
    const [appeals, setAppeals] = useState<any[]>([]);
    const [filter, setFilter] = useState('PENDING');
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/appeals?status=${filter}`, headers(token));
            setAppeals(res.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, [filter]);

    const resolve = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        if (!confirm(`Ви впевнені, що хочете ${status === 'APPROVED' ? 'СХВАЛИТИ' : 'ВІДХИЛИТИ'} цю апеляцію?`)) return;
        try {
            await axios.post(`${API_URL}/admin/appeals/${id}/resolve`, { status }, headers(token));
            load();
        } catch (e: any) { alert(e.response?.data?.message || 'Помилка'); }
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                <h2 className="text-xl sm:text-2xl font-bold">⚖️ Апеляції</h2>
                <div className="flex gap-2">
                    {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
                        <button key={s} onClick={() => setFilter(s)}
                            className={`text-xs px-3 py-1.5 rounded border transition ${filter === s ? 'bg-mafia-red/20 border-mafia-red text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                        >{s}</button>
                    ))}
                </div>
            </div>

            {loading ? <p className="text-gray-500">Завантаження...</p> : appeals.length === 0 ? <p className="text-gray-500">Немає апеляцій ({filter}).</p> : (
                <div className="space-y-3">
                    {appeals.map(a => (
                        <div key={a.id} className="bg-[#1a1a1a] border border-gray-800 rounded p-3 sm:p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-sm">
                                        <b className="text-gray-300">Тип:</b> <span className={a.type === 'UNBAN' ? 'text-red-400' : 'text-orange-400 font-bold'}>{a.type}</span>
                                    </p>
                                    <p className="text-sm">
                                        <b className="text-gray-300">Гравець:</b> <button onClick={() => a.user?.username && onUserAction(a.user.username)} className="text-yellow-400 hover:underline">{a.user?.username || a.userId}</button>
                                    </p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${a.status === 'PENDING' ? 'bg-yellow-900/50 text-yellow-300' : a.status === 'APPROVED' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                                    {a.status}
                                </span>
                            </div>
                            <div className="bg-[#111] p-3 rounded mt-2 text-sm text-gray-300 border border-gray-800">
                                {a.reason}
                            </div>
                            <p className="text-xs text-gray-600 mt-2">{new Date(a.createdAt).toLocaleString('uk-UA')}</p>

                            {a.status === 'PENDING' && myPower >= 2 && (
                                <div className="flex gap-2 mt-4">
                                    <button onClick={() => resolve(a.id, 'APPROVED')} className="text-sm bg-green-900/50 hover:bg-green-700 border border-green-600 text-green-300 px-4 py-1.5 rounded transition">✅ Схвалити</button>
                                    <button onClick={() => resolve(a.id, 'REJECTED')} className="text-sm bg-red-900/50 hover:bg-red-700 border border-red-600 text-red-300 px-4 py-1.5 rounded transition">❌ Відхилити</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   USERS TAB
   ═══════════════════════════════════════════════════════════ */
const PUNISH_TEMPLATES = [
    { label: 'Власний (ручний ввід)', type: 'KICK', duration: 0, reason: '' },
    { label: 'Образа гравців (Мут 2 години)', type: 'MUTE', duration: 7200, reason: 'Образа гравців' },
    { label: 'Спам / Флуд (Мут 30 хвилин)', type: 'MUTE', duration: 1800, reason: 'Спам / Флуд' },
    { label: 'Неадекватна поведінка (Бан 1 день)', type: 'BAN', duration: 86400, reason: 'Неадекватна поведінка' },
    { label: 'Використання читів (Бан на 30 днів)', type: 'BAN', duration: 2592000, reason: 'Використання читів / стороннього ПЗ' },
];

function UsersTab({ token, myPower, actionTarget, setActionTarget }: { token: string; myPower: number; actionTarget: string; setActionTarget: (u: string) => void }) {
    const [users, setUsers] = useState<any[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [actionType, setActionType] = useState<'PUNISH' | 'GOLD' | 'EXP' | 'NICK' | 'DELETE'>('PUNISH');
    const [templateIndex, setTemplateIndex] = useState(0);
    const [punishType, setPunishType] = useState<'KICK' | 'BAN' | 'MUTE' | 'WARN'>('KICK');
    const [duration, setDuration] = useState(3600);
    const [reason, setReason] = useState('');
    const [delta, setDelta] = useState(100);
    const [newNick, setNewNick] = useState('');
    const { t } = useTranslation();

    const load = async (reset = false) => {
        setLoading(true);
        try {
            const currentCursor = reset ? null : cursor;
            const res = await axios.get(`${API_URL}/admin/users?limit=50${currentCursor ? `&cursor=${currentCursor}` : ''}`, headers(token));
            if (reset) {
                setUsers(res.data.data);
            } else {
                setUsers(prev => [...prev, ...res.data.data]);
            }
            setCursor(res.data.nextCursor);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(true); }, []);

    const filtered = search ? users.filter(u => u.username.toLowerCase().includes(search.toLowerCase())) : users;

    const executeAction = async () => {
        if (!actionTarget) return;
        try {
            if (actionType === 'PUNISH') {
                await axios.post(`${API_URL}/admin/punish`, {
                    targetUsername: actionTarget, type: punishType,
                    durationSeconds: (punishType === 'KICK' || punishType === 'WARN') ? undefined : duration,
                    scope: 'GLOBAL', reason: reason || undefined,
                }, headers(token));
            } else if (actionType === 'GOLD') {
                await axios.post(`${API_URL}/admin/adjust-gold`, { targetUsername: actionTarget, delta }, headers(token));
            } else if (actionType === 'EXP') {
                await axios.post(`${API_URL}/admin/adjust-exp`, { targetUsername: actionTarget, delta }, headers(token));
            } else if (actionType === 'NICK') {
                await axios.post(`${API_URL}/admin/change-nickname`, { targetUsername: actionTarget, newUsername: newNick }, headers(token));
            } else if (actionType === 'DELETE') {
                if (!confirm(t('admin.confirm_delete', { username: actionTarget }))) return;
                await axios.post(`${API_URL}/admin/delete-user`, { targetUsername: actionTarget }, headers(token));
            }
            alert(`✅ ${t('common.success')}`);
            load(true);
        } catch (e: any) { alert(e.response?.data?.message || t('common.error')); }
    };

    return (
        <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-6">👥 {t('admin.users')}</h2>

            {/* Search */}
            <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('admin.search_nick')}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white mb-4 focus:outline-none focus:border-gray-500 text-sm"
            />

            {/* User table */}
            <div className="overflow-x-auto mb-8 -mx-3 sm:mx-0">
                <table className="w-full text-xs sm:text-sm min-w-[500px]">
                    <thead>
                        <tr className="border-b border-gray-800 text-gray-500">
                            <th className="text-left py-2 px-2 sm:px-3">{t('admin.nickname')}</th>
                            <th className="text-left py-2 px-2 sm:px-3">{t('admin.role')}</th>
                            <th className="text-left py-2 px-2 sm:px-3">{t('admin.level')}</th>
                            <th className="text-left py-2 px-2 sm:px-3 hidden sm:table-cell">MMR</th>
                            <th className="text-left py-2 px-2 sm:px-3">{t('admin.balance')}</th>
                            <th className="text-left py-2 px-2 sm:px-3">{t('admin.status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? <tr><td colSpan={6} className="py-4 text-center text-gray-500">{t('common.loading')}</td></tr> :
                            filtered.slice(0, 50).map(u => {
                                const roleInfo = u.staffRole || STAFF_ROLES.find(r => r.key === u.staffRoleKey);
                                return (
                                    <tr key={u.id}
                                        onClick={() => setActionTarget(u.username)}
                                        className={`border-b border-gray-800/50 cursor-pointer transition hover:bg-[#1a1a1a] ${actionTarget === u.username ? 'bg-mafia-red/10' : ''}`}
                                    >
                                        <td className="py-2 px-2 sm:px-3 font-medium" style={{ color: roleInfo?.color || '#e0e0e0' }}>{u.username}</td>
                                        <td className="py-2 px-2 sm:px-3 text-gray-400">{roleInfo?.title || u.role || 'USER'}</td>
                                        <td className="py-2 px-2 sm:px-3 text-gray-400">{u.profile?.level ?? '—'}</td>
                                        <td className="py-2 px-2 sm:px-3 text-gray-400 hidden sm:table-cell">{u.profile?.mmr ?? '—'}</td>
                                        <td className="py-2 px-2 sm:px-3 text-yellow-400">{u.wallet?.soft ?? 0} <CoinIcon size={14} /></td>
                                        <td className="py-2 px-2 sm:px-3">
                                            {u.profile?.bannedUntil && new Date(u.profile.bannedUntil) > new Date() ? <span className="text-red-400 text-xs">🚫 BAN</span> :
                                                u.profile?.mutedUntil && new Date(u.profile.mutedUntil) > new Date() ? <span className="text-orange-400 text-xs">🔇 MUTE</span> :
                                                    <span className="text-green-400 text-xs">✅ OK</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
                {cursor && (
                    <div className="flex justify-center py-4">
                        <button onClick={() => load(false)} className="text-sm bg-[#1a1a1a] border border-gray-700 hover:bg-[#2a2a2a] text-white px-4 py-2 rounded transition">
                            {loading ? t('common.loading') : 'Завантажити ще'}
                        </button>
                    </div>
                )}
            </div>

            {/* Action Panel */}
            {actionTarget && (
                <div className="bg-[#111] border border-gray-700 p-3 sm:p-4 rounded-xl mb-6">
                    <h3 className="font-bold mb-3 text-gray-200">{t('admin.actions_for')} <span className="text-white">{actionTarget}</span></h3>
                    <div className="flex gap-2 mb-4 text-xs flex-wrap">
                        {[
                            { key: 'PUNISH' as const, label: t('admin.punishment'), min: 3 },
                            { key: 'GOLD' as const, label: t('admin.gold'), min: 6 },
                            { key: 'EXP' as const, label: t('admin.experience'), min: 6 },
                            { key: 'NICK' as const, label: t('admin.nick_change'), min: 5 },
                            { key: 'DELETE' as const, label: t('admin.delete_account'), min: 8 },
                        ].filter(a => myPower >= a.min).map(a => (
                            <button key={a.key} onClick={() => setActionType(a.key)}
                                className={`px-3 py-1.5 border rounded transition ${actionType === a.key
                                    ? (a.key === 'DELETE' ? 'bg-red-900/50 border-red-500 text-red-300' : 'bg-mafia-red/30 border-mafia-red text-white')
                                    : 'border-gray-700 text-gray-400'}`}
                            >{a.key === 'DELETE' ? `🗑️ ${a.label}` : a.label}</button>
                        ))}
                    </div>

                    {actionType === 'PUNISH' && (
                        <div className="mb-3">
                            <select
                                value={templateIndex}
                                onChange={e => {
                                    const idx = Number(e.target.value);
                                    setTemplateIndex(idx);
                                    if (idx !== 0) {
                                        setPunishType(PUNISH_TEMPLATES[idx].type as any);
                                        setDuration(PUNISH_TEMPLATES[idx].duration);
                                        setReason(PUNISH_TEMPLATES[idx].reason);
                                    }
                                }}
                                className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-sm mb-3"
                            >
                                {PUNISH_TEMPLATES.map((t, i) => (
                                    <option key={i} value={i}>{t.label}</option>
                                ))}
                            </select>

                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <select value={punishType} onChange={e => { setPunishType(e.target.value as any); setTemplateIndex(0); }} className="bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-sm">
                                    <option value="WARN">⚠️ Warn</option>
                                    <option value="KICK">Kick</option>
                                    <option value="BAN">Ban</option>
                                    <option value="MUTE">Mute</option>
                                </select>
                                <select value={duration} onChange={e => { setDuration(Number(e.target.value)); setTemplateIndex(0); }} className="bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-sm">
                                    <option value={1800}>30 хв</option>
                                    <option value={3600}>1 год</option>
                                    <option value={7200}>2 год</option>
                                    <option value={10800}>3 год</option>
                                    <option value={21600}>6 год</option>
                                    <option value={86400}>1 день</option>
                                    <option value={259200}>3 дні</option>
                                    <option value={604800}>7 днів</option>
                                    <option value={2592000}>30 днів</option>
                                </select>
                                <input type="text" placeholder={t('admin.reason_placeholder')} value={reason} onChange={e => { setReason(e.target.value); setTemplateIndex(0); }} className="col-span-2 bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-sm" />
                            </div>
                        </div>
                    )}

                    {actionType === 'DELETE' && (
                        <div className="mb-3 bg-red-900/20 border border-red-700/50 rounded p-3">
                            <p className="text-red-300 text-sm flex items-center gap-2">
                                <Trash2 size={16} />
                                {t('admin.confirm_delete', { username: actionTarget })}
                            </p>
                        </div>
                    )}

                    {(actionType === 'GOLD' || actionType === 'EXP') && (
                        <input type="number" value={delta} onChange={e => setDelta(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-sm mb-3" placeholder={t('admin.amount_placeholder')} />
                    )}
                    {actionType === 'NICK' && (
                        <input type="text" value={newNick} onChange={e => setNewNick(e.target.value)} className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-sm mb-3" placeholder={t('admin.new_nick_placeholder')} />
                    )}

                    <button onClick={executeAction}
                        className={`w-full font-bold py-2 rounded transition text-sm ${actionType === 'DELETE' ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-mafia-red hover:bg-red-700 text-white'}`}
                    >
                        {t('admin.apply')}
                    </button>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   STAFF TAB
   ═══════════════════════════════════════════════════════════ */
function StaffTab({ token, myPower }: { token: string; myPower: number }) {
    const { socket } = useAppStore();
    const [staff, setStaff] = useState<any[]>([]);
    const [onlineStaff, setOnlineStaff] = useState<any[]>([]);
    const [newStaffUsername, setNewStaffUsername] = useState('');
    const [newStaffRole, setNewStaffRole] = useState('TRAINEE');
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();

    const load = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/staff`, headers(token));
            setStaff(res.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    // Listen for online staff updates
    useEffect(() => {
        if (!socket) return;
        const handleStaffOnline = (data: any[]) => {
            setOnlineStaff(data);
        };
        socket.on('staff_online_update', handleStaffOnline);
        return () => { socket.off('staff_online_update', handleStaffOnline); };
    }, [socket]);

    const assignRole = async () => {
        if (!newStaffUsername) return;
        try {
            await axios.post(`${API_URL}/admin/staff/set-role`, { targetUsername: newStaffUsername, roleKey: newStaffRole }, headers(token));
            alert(t('admin.role_assigned'));
            setNewStaffUsername('');
            load();
        } catch (e: any) { alert(e.response?.data?.message || t('common.error')); }
    };

    const removeRole = async (username: string) => {
        if (!confirm(t('admin.confirm_remove_role', { username }))) return;
        try {
            await axios.post(`${API_URL}/admin/staff/remove-role`, { targetUsername: username }, headers(token));
            load();
        } catch (e: any) { alert(e.response?.data?.message || t('common.error')); }
    };

    const availableRoles = STAFF_ROLES.filter(r => r.power < myPower || myPower >= 9);

    // Build set of online user IDs for quick lookup
    const onlineIds = new Set(onlineStaff.map(s => s.userId));

    return (
        <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-6">🛡️ {t('admin.staff')}</h2>

            {/* Online Staff Dashboard */}
            <div className="mb-8 bg-[#111] border border-gray-700 rounded-xl p-4">
                <h3 className="font-bold mb-3 text-gray-200 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                    Зараз онлайн ({onlineStaff.length})
                </h3>
                {onlineStaff.length === 0 ? (
                    <p className="text-gray-500 text-sm">Немає адміністраторів онлайн.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {onlineStaff.map(s => (
                            <div key={s.userId} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-gray-800">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="text-sm font-medium" style={{ color: s.staffRoleColor }}>{s.username}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                                    color: s.staffRoleColor,
                                    backgroundColor: s.staffRoleColor + '22',
                                    border: `1px solid ${s.staffRoleColor}55`,
                                }}>{s.staffRoleTitle}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Existing staff */}
            <div className="space-y-2 mb-8">
                {loading ? <p className="text-gray-500">{t('common.loading')}</p> :
                    staff.length === 0 ? <p className="text-gray-500">{t('admin.no_staff')}</p> :
                        staff.map(s => {
                            const roleInfo = s.staffRole || STAFF_ROLES.find(r => r.key === s.staffRoleKey);
                            const isOnline = onlineIds.has(s.id);
                            return (
                                <div key={s.id} className="flex items-center justify-between bg-[#1a1a1a] border border-gray-800 p-3 rounded">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: `${roleInfo?.color}22`, color: roleInfo?.color }}>
                                                {s.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1a1a1a] ${isOnline ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                                        </div>
                                        <div>
                                            <span className="font-medium" style={{ color: roleInfo?.color }}>{s.username}</span>
                                            <p className="text-xs text-gray-500">{roleInfo?.title || s.staffRoleKey} • {t('admin.last_login')} {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString('uk-UA') : t('admin.unknown_login')}</p>
                                        </div>
                                    </div>
                                    {(roleInfo?.power || 0) < myPower && (
                                        <button onClick={() => removeRole(s.username)} className="text-xs bg-red-900/40 hover:bg-red-700 border border-red-700/50 text-red-300 px-2 py-1 rounded transition">
                                            {t('admin.remove_role')}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
            </div>

            {/* Add new staff */}
            <div className="bg-[#111] border border-gray-700 rounded-xl p-4">
                <h3 className="font-bold mb-3 text-gray-200">{t('admin.assign_new')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                        type="text" value={newStaffUsername} onChange={e => setNewStaffUsername(e.target.value)}
                        placeholder={t('admin.player_nick')}
                        className="bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-sm"
                    />
                    <select value={newStaffRole} onChange={e => setNewStaffRole(e.target.value)} className="bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-sm">
                        {availableRoles.map(r => (
                            <option key={r.key} value={r.key} style={{ color: r.color }}>{r.title} (lv.{r.power})</option>
                        ))}
                    </select>
                    <button onClick={assignRole} className="bg-green-700 hover:bg-green-600 text-white font-bold py-2 rounded transition text-sm">
                        {t('admin.assign')}
                    </button>
                </div>
            </div>

            {/* Role Legend */}
            <div className="mt-8">
                <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{t('admin.hierarchy')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STAFF_ROLES.map(r => (
                        <div key={r.key} className="flex items-center gap-2 px-3 py-2 rounded bg-[#1a1a1a] border border-gray-800">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }}></div>
                            <span className="text-xs sm:text-sm truncate" style={{ color: r.color }}>{r.title}</span>
                            <span className="text-xs text-gray-600 ml-auto flex-shrink-0">Lv.{r.power}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   LOGS TAB
   ═══════════════════════════════════════════════════════════ */
function LogsTab({ token, myPower, onUserAction }: { token: string; myPower: number; onUserAction: (username: string) => void }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [clearDays, setClearDays] = useState<number | 'all'>(7);
    const { t } = useTranslation();

    const load = async (reset = false) => {
        setLoading(true);
        try {
            const currentCursor = reset ? null : cursor;
            const res = await axios.get(`${API_URL}/admin/logs?limit=50${currentCursor ? `&cursor=${currentCursor}` : ''}`, headers(token));
            if (reset) {
                setLogs(res.data.data);
            } else {
                setLogs(prev => [...prev, ...res.data.data]);
            }
            setCursor(res.data.nextCursor);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(true); }, []);

    const handleClearLogs = async () => {
        const label = clearDays === 'all' ? 'ВСІ логи' : `логи старші за ${clearDays} днів`;
        if (!confirm(`Ви впевнені? Буде видалено ${label}. Цю дію неможливо скасувати.`)) return;
        try {
            const body: any = {};
            if (clearDays !== 'all') body.olderThanDays = clearDays;
            const res = await axios.post(`${API_URL}/admin/logs/clear`, body, headers(token));
            alert(`✅ Видалено ${res.data.deleted} записів`);
            load(true);
        } catch (e: any) { alert(e.response?.data?.message || 'Помилка'); }
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                <h2 className="text-xl sm:text-2xl font-bold">📜 {t('admin.logs')}</h2>
                {myPower >= 9 && (
                    <div className="flex items-center gap-2">
                        <select
                            value={String(clearDays)}
                            onChange={e => setClearDays(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-1.5 text-white text-xs"
                        >
                            <option value="7">Старші 7 днів</option>
                            <option value="30">Старші 30 днів</option>
                            <option value="all">Всі логи</option>
                        </select>
                        <button
                            onClick={handleClearLogs}
                            className="text-xs bg-red-900/50 hover:bg-red-700 border border-red-600 text-red-300 px-3 py-1.5 rounded transition flex items-center gap-1"
                        >
                            <Trash2 size={12} /> Очистити
                        </button>
                    </div>
                )}
            </div>
            {loading ? <p className="text-gray-500">{t('common.loading')}</p> : logs.length === 0 ? <p className="text-gray-500">{t('admin.no_logs')}</p> : (
                <div className="space-y-2">
                    {logs.map(l => (
                        <div key={l.id} className="bg-[#1a1a1a] border border-gray-800 rounded p-3 flex flex-col sm:flex-row items-start justify-between gap-2">
                            <div>
                                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-300 font-mono">{l.action}</span>
                                <p className="text-sm text-gray-400 mt-1">
                                    {t('admin.admin_action')} <button onClick={() => l.actor?.username && onUserAction(l.actor.username)} className="text-gray-200 hover:underline">{l.actor?.username || l.actorId}</button>
                                    {l.targetId && <> → {t('admin.target')} <button onClick={() => l.target?.username && onUserAction(l.target.username)} className="text-yellow-400 hover:underline">{l.target?.username || l.targetId}</button></>}
                                </p>
                                {l.details && <p className="text-xs text-gray-500 mt-1">{l.details}</p>}
                            </div>
                            <span className="text-xs text-gray-600 whitespace-nowrap">{new Date(l.createdAt).toLocaleString('uk-UA')}</span>
                        </div>
                    ))}
                    {cursor && (
                        <div className="flex justify-center py-4">
                            <button onClick={() => load(false)} className="text-sm bg-[#1a1a1a] border border-gray-700 hover:bg-[#2a2a2a] text-white px-4 py-2 rounded transition">
                                {loading ? t('common.loading') : 'Завантажити ще'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   DUTIES TAB
   ═══════════════════════════════════════════════════════════ */
function DutiesTab() {
    return (
        <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-yellow-400">⚖️ Права та обов'язки адміністратора</h2>
            <div className="bg-[#111] p-6 rounded-lg border border-gray-800 space-y-6">
                <section>
                    <h3 className="text-lg font-bold text-red-400 mb-2">1. Загальні положення</h3>
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-2">
                        <li>Головна мета адміністратора — підтримувати порядок, комфортну гру та дотримання правил усіма гравцями.</li>
                        <li>Адміністратор зобов'язаний бути ввічливим, компетентним та об'єктивним.</li>
                        <li>Незнання цих правил не звільняє від відповідальності за їх порушення.</li>
                    </ul>
                </section>
                <section>
                    <h3 className="text-lg font-bold text-blue-400 mb-2">2. Обов'язки під час гри</h3>
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-2">
                        <li>Регулярно перевіряти систему скарг та обробляти їх оперативно.</li>
                        <li>У разі виявлення порушень (особисто або через скарги) накладати покарання відповідно до серйозності проступку.</li>
                        <li>Пояснювати гравцям причини їх покарання, якщо вони про це запитують в адекватній формі.</li>
                        <li>Допомагати новачкам з питаннями щодо механік гри.</li>
                    </ul>
                </section>
                <section>
                    <h3 className="text-lg font-bold text-purple-400 mb-2">3. Заборони (що категорично не можна робити)</h3>
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-2">
                        <li><b className="text-red-300">Видавати покарання без причини або через особисту антипатію.</b></li>
                        <li>Зливати ігрову ситуацію, підказувати гравцям їх ролі, або будь-яким іншим чином втручатися в хід гри, де ви є спостерігачем чи учасником.</li>
                        <li>Ігнорувати скарги або масові порушення правил в кімнаті.</li>
                        <li>Використовувати адмін-панель (зміну золота, досвіду, нікнеймів, або покарання) для власної вигоди або для розваги.</li>
                        <li>Вступати в публічні конфлікти або скандали з гравцями від імені адміністрації.</li>
                    </ul>
                </section>
                <div className="mt-8 p-4 bg-red-900/20 border-l-4 border-mafia-red rounded text-sm text-gray-300">
                    <p className="font-bold text-white mb-1">Увага!</p>
                    <p>Кожна ваша дія логується та може бути перевірена Старшою адміністрацією або Власником.</p>
                    <p>Перевищення повноважень або порушення цих правил карається <b>попередженням</b>, <b>пониженням рангу</b> або <b>повним зняттям повноважень</b> з можливим блокуванням акаунту.</p>
                </div>

                <a
                    href="/punishment-grid"
                    target="_blank"
                    className="mt-6 block w-full text-center bg-orange-600/20 hover:bg-orange-600/40 border border-orange-500/50 text-orange-400 hover:text-orange-300 font-bold py-3 rounded transition text-sm"
                >
                    📋 Відкрити Сітку Покарань (окремою сторінкою)
                </a>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   LEADERS (TITLES) TAB
   ═══════════════════════════════════════════════════════════ */
function LeadersTab({ token }: { token: string }) {
    const [targetUsername, setTargetUsername] = useState('');
    const [selectedTitle, setSelectedTitle] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const { t } = useTranslation();

    const assignTitle = async () => {
        if (!targetUsername) return;
        try {
            await axios.post(`${API_URL}/admin/set-title`, {
                targetUsername,
                title: selectedTitle || null // Empty string means remove title
            }, headers(token));
            alert('Титул успішно оновлено!');
            setTargetUsername('');
            setSelectedTitle('');
            setSearchTerm('');
        } catch (e: any) { alert(e.response?.data?.message || t('common.error')); }
    };

    const filteredTitles = TITLES.filter(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-yellow-500">🏆 Лідери (Титули)</h2>

            <div className="bg-[#111] border border-gray-700 rounded-xl p-4 md:p-6 max-w-2xl">
                <p className="text-sm text-gray-400 mb-6">Видача спеціальних титулів гравцям. Титул відображатиметься в профілі гравця золотим кольором. Залиште поле титулу пустим, щоб зняти поточний титул з гравця.</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">Нікнейм гравця</label>
                        <input
                            type="text" value={targetUsername} onChange={e => setTargetUsername(e.target.value)}
                            placeholder="Введіть нікнейм"
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:outline-none focus:border-yellow-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">Вибір Титулу</label>
                        <input
                            type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Пошук титулу..."
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white mb-2 text-sm focus:outline-none focus:border-yellow-500"
                        />
                        <div className="bg-[#1a1a1a] border border-gray-700 rounded max-h-60 overflow-y-auto">
                            <div
                                onClick={() => setSelectedTitle('')}
                                className={`p-2 cursor-pointer text-sm border-b border-gray-800 transition ${selectedTitle === '' ? 'bg-mafia-red/20 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                            >
                                [🚫 Зняти титул]
                            </div>
                            {filteredTitles.map(t => (
                                <div
                                    key={t}
                                    onClick={() => setSelectedTitle(t)}
                                    className={`p-2 cursor-pointer text-sm font-medium border-b border-gray-800 transition ${selectedTitle === t ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-300 hover:bg-gray-800'}`}
                                >
                                    {t}
                                </div>
                            ))}
                            {filteredTitles.length === 0 && <div className="p-3 text-sm text-gray-500 text-center">Нічого не знайдено</div>}
                        </div>
                    </div>

                    {selectedTitle && (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded">
                            <p className="text-sm text-gray-400 mb-1">Попередній перегляд (у профілі):</p>
                            <p className="text-yellow-500 font-bold tracking-wide" style={{ textShadow: '0 0 5px rgba(234, 179, 8, 0.4)' }}>«{selectedTitle}»</p>
                        </div>
                    )}

                    <button
                        onClick={assignTitle}
                        disabled={!targetUsername}
                        className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded transition mt-4"
                    >
                        {selectedTitle ? 'Видати Титул' : 'Зняти Титул'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   ROOMS TAB
   ═══════════════════════════════════════════════════════════ */
function RoomsTab({ token }: { token: string }) {
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { socket } = useAppStore();

    const load = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/rooms`, { headers: { Authorization: `Bearer ${token}` } });
            setRooms(res.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const spectate = (roomId: string, status: string) => {
        if (!socket) return;
        if (status !== 'IN_PROGRESS') {
            alert('Неможливо переглядати кімнату до початку гри.');
            return;
        }
        socket.emit('spectate_room', { roomId });
        navigate('/game');
    };

    const closeRoom = async (roomId: string) => {
        if (!confirm(`Ви впевнені, що хочете закрити кімнату ${roomId}?`)) return;
        try {
            await axios.post(`${API_URL}/admin/rooms/${roomId}/close`, {}, { headers: { Authorization: `Bearer ${token}` } });
            alert('Кімнату успішно закрито.');
            load();
        } catch (e: any) { alert(e.response?.data?.message || 'Помилка'); }
    };

    return (
        <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-blue-400">👀 Активні Кімнати</h2>
            <button onClick={load} className="mb-4 bg-[#1a1a1a] border border-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded transition">Оновити</button>
            {loading ? <p className="text-gray-500">Завантаження...</p> : rooms.length === 0 ? <p className="text-gray-500">Немає активних кімнат.</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rooms.map((r: any) => (
                        <div key={r.id} className="bg-[#1a1a1a] border border-gray-800 rounded p-4 flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-lg text-white mb-2">Кімната: {r.id}</h3>
                                <p className="text-sm text-gray-400">Статус: <span className={r.status === 'IN_PROGRESS' ? 'text-green-400' : 'text-yellow-400'}>{r.status}</span></p>
                                <p className="text-sm text-gray-400">Гравців: {r.playersCount}</p>
                                {r.status === 'IN_PROGRESS' && (
                                    <>
                                        <p className="text-sm text-gray-400">Фаза: <span className="text-purple-400">{r.phase}</span></p>
                                        <p className="text-sm text-gray-400">День: {r.dayCount}</p>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => spectate(r.id, r.status)}
                                    disabled={r.status !== 'IN_PROGRESS'}
                                    className={`flex-1 font-bold py-2 px-2 rounded transition flex items-center justify-center gap-1 text-sm ${r.status === 'IN_PROGRESS'
                                        ? 'bg-blue-900/50 hover:bg-blue-700 text-blue-300'
                                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                                >
                                    <Eye size={16} /> {r.status === 'IN_PROGRESS' ? 'Спостерігати' : 'Очікування...'}
                                </button>
                                <button
                                    onClick={() => closeRoom(r.id)}
                                    className="flex-1 font-bold py-2 px-2 rounded transition flex items-center justify-center gap-1 text-sm bg-red-900/50 hover:bg-red-700 text-red-300"
                                >
                                    <Trash2 size={16} /> Закрити
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   EVENTS TAB
   ═══════════════════════════════════════════════════════════ */
function EventsTab({ token }: { token: string }) {
    const [eventName, setEventName] = useState('');
    const [rewardCoins, setRewardCoins] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [enableEventRoles, setEnableEventRoles] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

    const EVENT_ROLES = [
        { key: 'KRAMPUS', label: 'Крампус', emoji: '👹', desc: 'Щоночі "карає" одного гравця, блокуючи його та знімаючи одну дію' },
        { key: 'CUPID', label: 'Купідон', emoji: '💘', desc: 'Першої ночі обирає двох закоханих. Якщо один помирає — інший також' },
        { key: 'SNOWMAN', label: 'Сніговик', emoji: '⛄', desc: 'Заморожує одного гравця вночі — той не може голосувати наступного дня' },
        { key: 'WITCH', label: 'Відьма', emoji: '🧙‍♀️', desc: 'Має одне зілля зцілення та одне зілля отрути на всю гру' },
        { key: 'SANTA', label: 'Санта', emoji: '🎅', desc: 'Щоночі дарує "подарунок" — випадкова корисна дія одному гравцю' },
        { key: 'GHOST', label: 'Привид', emoji: '👻', desc: 'Після смерті може ще одну ніч діяти з потойбіччя' },
    ];

    const toggleRole = (key: string) => {
        setSelectedRoles(prev =>
            prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]
        );
    };

    const handleLaunch = async () => {
        if (!eventName || eventName.trim().length < 3) {
            alert('Назва івенту занадто коротка. Мінімум 3 символи.');
            return;
        }

        const rolesText = enableEventRoles && selectedRoles.length > 0
            ? `\nУвімкнені івент-ролі: ${selectedRoles.map(r => EVENT_ROLES.find(er => er.key === r)?.label).join(', ')}`
            : '';

        if (!confirm(`Ви впевнені, що хочете запустити Глобальний Івент «${eventName}»? Всі онлайн гравці отримають сповіщення${rewardCoins ? ` та ${rewardCoins} монет` : ''}.${rolesText}`)) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/admin/events/launch`, {
                eventName,
                rewardCoins: rewardCoins === '' ? 0 : Number(rewardCoins),
                eventRoles: enableEventRoles ? selectedRoles : []
            }, headers(token));

            alert(`Успіх! ${res.data.message} ${res.data.rewardedUsers ? `(Нагороджено користувачів: ${res.data.rewardedUsers})` : ''}${res.data.activatedRoles?.length ? `\nАктивовані ролі: ${res.data.activatedRoles.join(', ')}` : ''}`);
            setEventName('');
            setRewardCoins('');
            setSelectedRoles([]);
            setEnableEventRoles(false);
        } catch (e: any) {
            alert(e.response?.data?.message || 'Помилка запуску івенту');
        }
        setLoading(false);
    };

    return (
        <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-pink-500">🎁 Запуск Івентів</h2>

            <div className="bg-[#111] border border-gray-700 rounded-xl p-4 md:p-6 max-w-2xl">
                <p className="text-sm text-gray-400 mb-6">Ця панель дозволяє Власнику запустити Глобальний Івент. Усі гравці отримають сповіщення, а також можна задати суму золота, яку отримає КОЖЕН зареєстрований гравець на сервері.</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">Назва Івенту (Повідомлення)</label>
                        <input
                            type="text" value={eventName} onChange={e => setEventName(e.target.value)}
                            placeholder="Наприклад: Зимові Свята 2024!"
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:outline-none focus:border-pink-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">Нагорода (Монет кожному)</label>
                        <input
                            type="number" value={rewardCoins} onChange={e => setRewardCoins(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Наприклад: 1000 (необов'язково)"
                            min="0"
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white focus:outline-none focus:border-pink-500"
                        />
                    </div>

                    {/* EVENT ROLES SECTION */}
                    <div className="border border-purple-800/50 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setEnableEventRoles(!enableEventRoles)}
                            className={`w-full flex items-center justify-between p-4 transition ${enableEventRoles ? 'bg-purple-900/30' : 'bg-[#1a1a1a] hover:bg-[#222]'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${enableEventRoles ? 'bg-purple-600 border-purple-400' : 'border-gray-600'}`}>
                                    {enableEventRoles && <span className="text-white text-xs">✓</span>}
                                </div>
                                <span className="font-bold text-white text-sm">✨ Увімкнути Івент-ролі</span>
                            </div>
                            <span className="text-xs text-gray-500">{enableEventRoles ? `(${selectedRoles.length} обрано)` : ''}</span>
                        </button>

                        {enableEventRoles && (
                            <div className="p-4 border-t border-purple-800/30 space-y-2">
                                <p className="text-xs text-gray-400 mb-3">Оберіть спеціальні ролі, які почнуть випадати гравцям у нових матчах під час дії івенту:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {EVENT_ROLES.map(role => {
                                        const isSelected = selectedRoles.includes(role.key);
                                        return (
                                            <button
                                                key={role.key}
                                                onClick={() => toggleRole(role.key)}
                                                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition ${isSelected
                                                    ? 'bg-purple-900/40 border-purple-500/50'
                                                    : 'bg-[#111] border-gray-800 hover:border-gray-600'}`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${isSelected ? 'bg-purple-600 border-purple-400' : 'border-gray-600'}`}>
                                                    {isSelected && <span className="text-white text-xs">✓</span>}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-white text-sm">{role.emoji} {role.label}</span>
                                                    <p className="text-xs text-gray-500 mt-0.5">{role.desc}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 p-4 bg-pink-900/20 border-l-4 border-pink-500 rounded text-sm text-gray-300">
                        <p className="font-bold text-white mb-1">Увага! Глобальна Дія</p>
                        <p>Ця дія відправить повідомлення всім активним гравцям та нарахує золото. Це незворотньо.</p>
                        {enableEventRoles && selectedRoles.length > 0 && (
                            <p className="mt-2 text-purple-400">Обрані ролі почнуть випадати у всіх нових матчах до завершення івенту.</p>
                        )}
                    </div>

                    <button
                        onClick={handleLaunch}
                        disabled={loading || !eventName}
                        className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded transition mt-4"
                    >
                        {loading ? 'Запуск...' : '🚀 ЗАПУСТИТИ ІВЕНТ'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   CLAN WARS TAB
   ═══════════════════════════════════════════════════════════ */
function ClanWarsTab({ token }: { token: string }) {
    const [wars, setWars] = useState<any[]>([]);
    const [filter, setFilter] = useState('ACTIVE');
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/clan-wars?status=${filter}`, headers(token));
            setWars(res.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, [filter]);

    const resolveWar = async (warId: string, winnerId: string | null) => {
        if (!confirm(`Ви впевнені, що хочете визначити ${winnerId ? 'переможця' : 'нічию'} для цієї війни?`)) return;
        try {
            await axios.post(`${API_URL}/admin/clan-wars/${warId}/resolve`, { winnerId }, headers(token));
            load();
        } catch (e: any) { alert(e.response?.data?.message || 'Помилка'); }
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2 mb-2"><Swords size={24} /> Війни Кланів (Адмін)</h2>
                <div className="flex gap-2">
                    {['PENDING', 'ACTIVE', 'FINISHED', 'CANCELLED'].map(s => (
                        <button key={s} onClick={() => setFilter(s)}
                            className={`text-xs px-3 py-1.5 rounded border transition ${filter === s ? 'bg-mafia-red/20 border-mafia-red text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                        >{s}</button>
                    ))}
                </div>
            </div>

            {loading ? <p className="text-gray-500">Завантаження...</p> : wars.length === 0 ? <p className="text-gray-500">Немає війн ({filter}).</p> : (
                <div className="space-y-3">
                    {wars.map(w => (
                        <div key={w.id} className="bg-[#1a1a1a] border border-gray-800 rounded p-4">
                            <div className="flex justify-between items-center mb-4">
                                <div className="text-center flex-1">
                                    <h3 className="text-lg font-bold text-blue-400">{w.challenger?.name || w.challengerId}</h3>
                                    <p className="text-xs text-gray-500">Рейтинг: {w.challenger?.rating || 0}</p>
                                </div>
                                <div className="px-4 text-center">
                                    <span className="text-2xl font-bold text-mafia-red">VS</span>
                                    <p className="text-xs text-yellow-500 mt-1">Ставка: {w.customBet || 25}</p>
                                </div>
                                <div className="text-center flex-1">
                                    <h3 className="text-lg font-bold text-red-400">{w.target?.name || w.targetId}</h3>
                                    <p className="text-xs text-gray-500">Рейтинг: {w.target?.rating || 0}</p>
                                </div>
                            </div>

                            <p className="text-xs text-gray-600 mb-4 text-center">Створено: {new Date(w.createdAt).toLocaleString('uk-UA')}</p>

                            {w.status === 'ACTIVE' && (
                                <div className="flex gap-2 justify-center border-t border-gray-800 pt-3">
                                    <button onClick={() => resolveWar(w.id, w.challengerId)} className="text-sm bg-blue-900/50 hover:bg-blue-700 border border-blue-600 text-blue-300 px-4 py-1.5 rounded transition">Перемога (Атакуючі)</button>
                                    <button onClick={() => resolveWar(w.id, null)} className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-4 py-1.5 rounded transition">Нічия</button>
                                    <button onClick={() => resolveWar(w.id, w.targetId)} className="text-sm bg-red-900/50 hover:bg-red-700 border border-red-600 text-red-300 px-4 py-1.5 rounded transition">Перемога (Захисники)</button>
                                </div>
                            )}

                            {w.status === 'FINISHED' && (
                                <div className="text-center pt-3 border-t border-gray-800">
                                    <p className="text-sm text-green-400 font-bold">Завершено! Переможець: {w.winnerId === w.challengerId ? w.challenger?.name : (w.winnerId === w.targetId ? w.target?.name : 'Нічия')}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   STATS TAB
   ═══════════════════════════════════════════════════════════ */
function StatsTab({ token }: { token: string }) {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/stats`, headers(token));
            setStats(res.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <Activity size={24} /> Глобальна Статистика
                </h2>
                <button onClick={load} className="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded transition">
                    Оновити
                </button>
            </div>

            {loading ? <p className="text-gray-500">Завантаження...</p> : !stats ? <p className="text-red-500">Не вдалося завантажити статистику.</p> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-[#1a1a1a] border border-gray-800 p-4 rounded text-center">
                        <Users className="mx-auto mb-2 text-mafia-light" size={24} />
                        <h3 className="text-sm text-gray-400">Всього гравців</h3>
                        <p className="text-3xl font-bold">{stats.totalUsers}</p>
                    </div>

                    <div className="bg-[#1a1a1a] border border-gray-800 p-4 rounded text-center border-t-4 border-t-green-500">
                        <Activity className="mx-auto mb-2 text-green-500" size={24} />
                        <h3 className="text-sm text-green-400">Онлайн зараз</h3>
                        <p className="text-3xl font-bold text-white">{stats.online}</p>
                    </div>

                    <div className="bg-[#1a1a1a] border border-gray-800 p-4 rounded">
                        <h3 className="text-sm text-gray-400 mb-4 border-b border-gray-700 pb-2">Зіграно ігор</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-300">Сьогодні</span>
                                <span className="font-bold text-yellow-500">{stats.matches.today}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-300">За тиждень</span>
                                <span className="font-bold text-yellow-500">{stats.matches.week}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-300">За місяць</span>
                                <span className="font-bold text-yellow-500">{stats.matches.month}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1a1a1a] border border-gray-800 p-4 rounded col-span-1 sm:col-span-2 lg:col-span-3">
                        <h3 className="text-sm text-gray-400 mb-4 border-b border-gray-700 pb-2 text-center">Найпопулярніші Ролі (за весь час)</h3>
                        {stats.popularRoles.length === 0 ? (
                            <p className="text-gray-500 text-center text-sm">Недостатньо даних</p>
                        ) : (
                            <div className="flex flex-wrap justify-center gap-4">
                                {stats.popularRoles.map((r: any, idx: number) => (
                                    <div key={idx} className="bg-[#222] border border-gray-700 px-4 py-2 rounded-lg text-center min-w-[120px]">
                                        <p className="font-bold text-blue-400 mb-1">{r.role}</p>
                                        <p className="text-xs text-gray-400">{r.count} матчів</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   SEASONS TAB
   ═══════════════════════════════════════════════════════════ */
function SeasonsTab({ token }: { token: string }) {
    const [seasons, setSeasons] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [newSeasonName, setNewSeasonName] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/seasons`, headers(token));
            setSeasons(res.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const startSeason = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/admin/seasons/start`, { name: newSeasonName }, headers(token));
            setNewSeasonName('');
            load();
        } catch (err: any) { alert(err.response?.data?.message || 'Помилка'); }
    };

    const endSeason = async () => {
        if (!confirm('Ви дійсно хочете завершити поточний сезон? Це скине MMR всіх гравців до 1500 і видасть нагороди топ-100. Дія незворотна!')) return;
        try {
            const res = await axios.post(`${API_URL}/admin/seasons/end`, {}, headers(token));
            alert(`Сезон успішно завершено! Видано нагород: ${res.data.rewardsGiven}`);
            load();
        } catch (err: any) { alert(err.response?.data?.message || 'Помилка'); }
    };

    return (
        <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 mb-6">
                <Calendar size={24} /> Управління Сезонами
            </h2>

            <div className="bg-[#1a1a1a] border border-gray-800 p-4 rounded mb-8">
                <h3 className="text-lg font-bold mb-4">Поточний Сезон</h3>
                {seasons.length > 0 && seasons[0].isActive ? (
                    <div>
                        <p className="text-xl text-green-400 font-bold mb-2">Активний: {seasons[0].name}</p>
                        <p className="text-sm text-gray-400 mb-6">Початок: {new Date(seasons[0].startDate).toLocaleString('uk-UA')}</p>
                        <button onClick={endSeason} className="bg-red-900/50 hover:bg-red-700 border border-red-600 text-red-300 font-bold px-4 py-2 rounded transition w-full sm:w-auto">
                            Завершити Сезон та Роздати Нагороди (Reset MMR)
                        </button>
                    </div>
                ) : (
                    <div>
                        <p className="text-gray-500 mb-4">Наразі немає активного сезону.</p>
                        <form onSubmit={startSeason} className="flex gap-2 flex-col sm:flex-row">
                            <input
                                type="text"
                                placeholder="Введіть назву нового сезону (напр. 'Сезон 1')"
                                required
                                value={newSeasonName}
                                onChange={e => setNewSeasonName(e.target.value)}
                                className="bg-[#111] border border-gray-700 p-2 rounded text-white flex-1 focus:border-mafia-red focus:outline-none"
                            />
                            <button type="submit" className="bg-green-700 hover:bg-green-600 border border-green-600 text-white font-bold px-4 py-2 rounded transition whitespace-nowrap">
                                Почати Сезон
                            </button>
                        </form>
                    </div>
                )}
            </div>

            <h3 className="text-lg font-bold mb-4">Історія Сезонів</h3>
            {loading ? <p className="text-gray-500">Завантаження...</p> : seasons.length === 0 ? <p className="text-gray-500">Немає сезонів.</p> : (
                <div className="space-y-3">
                    {seasons.map(s => (
                        <div key={s.id} className="bg-[#111] border border-gray-800 p-4 rounded flex flex-col sm:flex-row justify-between sm:items-center gap-2 relative overflow-hidden">
                            {s.isActive && <div className="absolute top-0 left-0 w-1 h-full bg-green-500 shadow-[0_0_10px_#22c55e]"></div>}
                            <div className={s.isActive ? 'pl-2' : ''}>
                                <h4 className={`font-bold text-lg ${s.isActive ? 'text-green-500' : 'text-gray-300'}`}>{s.name} {s.isActive && '(Активний)'}</h4>
                                <p className="text-xs text-gray-500 block sm:hidden">
                                    {new Date(s.startDate).toLocaleDateString()} — {s.endDate ? new Date(s.endDate).toLocaleDateString() : 'дотепер'}
                                </p>
                            </div>
                            <div className="text-left sm:text-right">
                                <p className="text-xs text-gray-400 hidden sm:block">
                                    {new Date(s.startDate).toLocaleDateString()} — {s.endDate ? new Date(s.endDate).toLocaleDateString() : 'дотепер'}
                                </p>
                                <p className="text-sm font-bold text-yellow-500 mt-1">Видано нагород: {s._count?.rewards || 0}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
