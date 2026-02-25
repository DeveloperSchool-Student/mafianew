import { useEffect, useState } from 'react';
import { CoinIcon } from '../components/CoinIcon';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import axios from 'axios';
import { ArrowLeft, Shield, Users, FileText, Activity, UserCog, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

type Tab = 'reports' | 'users' | 'staff' | 'logs';

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
        { key: 'users', label: t('admin.users'), icon: Users, minPower: 3 },
        { key: 'staff', label: t('admin.staff'), icon: UserCog, minPower: 8 },
        { key: 'logs', label: t('admin.logs'), icon: Activity, minPower: 7 },
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
                    {tab === 'users' && <UsersTab token={user.token} myPower={myPower} actionTarget={actionTarget} setActionTarget={setActionTarget} />}
                    {tab === 'staff' && <StaffTab token={user.token} myPower={myPower} />}
                    {tab === 'logs' && <LogsTab token={user.token} onUserAction={(username) => { setActionTarget(username); setTab('users'); }} />}
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
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [actionType, setActionType] = useState<'PUNISH' | 'GOLD' | 'EXP' | 'NICK' | 'DELETE'>('PUNISH');
    const [templateIndex, setTemplateIndex] = useState(0);
    const [punishType, setPunishType] = useState<'KICK' | 'BAN' | 'MUTE'>('KICK');
    const [duration, setDuration] = useState(3600);
    const [reason, setReason] = useState('');
    const [delta, setDelta] = useState(100);
    const [newNick, setNewNick] = useState('');
    const { t } = useTranslation();

    const load = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/users`, headers(token));
            setUsers(res.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const filtered = search ? users.filter(u => u.username.toLowerCase().includes(search.toLowerCase())) : users;

    const executeAction = async () => {
        if (!actionTarget) return;
        try {
            if (actionType === 'PUNISH') {
                await axios.post(`${API_URL}/admin/punish`, {
                    targetUsername: actionTarget, type: punishType,
                    durationSeconds: punishType === 'KICK' ? undefined : duration,
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
            load();
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
    const [staff, setStaff] = useState<any[]>([]);
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

    return (
        <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-6">🛡️ {t('admin.staff')}</h2>

            {/* Existing staff */}
            <div className="space-y-2 mb-8">
                {loading ? <p className="text-gray-500">{t('common.loading')}</p> :
                    staff.length === 0 ? <p className="text-gray-500">{t('admin.no_staff')}</p> :
                        staff.map(s => {
                            const roleInfo = s.staffRole || STAFF_ROLES.find(r => r.key === s.staffRoleKey);
                            return (
                                <div key={s.id} className="flex items-center justify-between bg-[#1a1a1a] border border-gray-800 p-3 rounded">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: `${roleInfo?.color}22`, color: roleInfo?.color }}>
                                            {s.username.charAt(0).toUpperCase()}
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
function LogsTab({ token, onUserAction }: { token: string; onUserAction: (username: string) => void }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${API_URL}/admin/logs`, headers(token));
                setLogs(res.data);
            } catch { }
            setLoading(false);
        })();
    }, []);

    return (
        <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-6">📜 {t('admin.logs')}</h2>
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
                </div>
            )}
        </div>
    );
}
