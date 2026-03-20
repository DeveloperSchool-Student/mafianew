import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { useNotificationStore } from '../store/notificationStore';
import { useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { LogOut, Users, Play, Plus, Trophy, Settings, Globe, Menu, X, Bell, Trash2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ReportModal } from '../components/ReportModal';
import { DailyRewardModal } from '../components/DailyRewardModal';
import { LobbyChat } from '../components/LobbyChat';
import type { RoomSettings } from '../types/api';

const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'щойно';
    if (minutes < 60) return `${minutes}хв тому`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}год тому`;
    return `${Math.floor(hours / 24)}д тому`;
};

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function Lobby() {
    const { user, logout, socket, setSocket, gameState, setGameState } = useAppStore();
    const { addNotification, history, markAsRead, markAllAsRead, clearHistory } = useNotificationStore();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [inputRoomId, setInputRoomId] = useState('');
    const [error, setError] = useState('');
    const [isReady, setIsReady] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isRewardOpen, setIsRewardOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [createRoomType, setCreateRoomType] = useState<'CASUAL' | 'RANKED'>('CASUAL');
    const [recentPlayers, setRecentPlayers] = useState<string[]>([]);
    const [incomingInvite, setIncomingInvite] = useState<{ roomId: string, inviterUsername: string } | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isSearchingOnline, setIsSearchingOnline] = useState(false);
    const notificationsRef = useRef<HTMLDivElement>(null);

    // Close notifications on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [onlineQueueInfo, setOnlineQueueInfo] = useState<{ inQueue: number, timer: number | null, minPlayers: number, maxPlayers: number }>({
        inQueue: 0,
        timer: null,
        minPlayers: 5,
        maxPlayers: 20
    });
    const [localSettings, setLocalSettings] = useState<RoomSettings>({
        dayTimerMs: 60000,
        nightTimerMs: 30000,
        enableSerialKiller: true,
        enableEscort: true,
        enableJester: true,
        enableLawyer: false,
        enableBodyguard: false,
        enableTracker: false,
        enableInformer: false,
        enableMayor: false,
        enableJudge: false,
        enableBomber: false,
        enableTrapper: false,
        enableSilencer: false,
        enableLovers: false,
        enableWhore: false,
        enableJournalist: false,
    });


    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        // Only create socket if we don't have one
        const currentSocket = useAppStore.getState().socket;
        if (currentSocket) {
            // Re-check for active games on returning to lobby
            currentSocket.emit('check_active_game');
            return;
        }

        const newSocket = io(SOCKET_URL, {
            auth: { token: user.token },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });

        newSocket.on('connect', () => {
            setError('');
            newSocket.emit('check_active_game');
        });

        newSocket.on('disconnect', (reason) => {
            if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'ping timeout') {
                setError('Зв\'язок з сервером втрачено. Перепідключення... ⏳');
            }
        });

        newSocket.io.on('reconnect', () => {
            setError('');
            newSocket.emit('check_active_game');
        });

        newSocket.on('connect_error', (err) => {
            setError('Помилка з\'єднання. Перевірте інтернет.');
            if (err.message === 'No token' || err.message === 'Invalid credentials') {
                logout();
            }
        });

        newSocket.on('error', (err) => setError(err));

        newSocket.on('session_replaced', () => {
            setError(t('lobby.session_replaced'));
            newSocket.io.opts.reconnection = false;
            newSocket.disconnect();
            setSocket(null);
        });

        newSocket.on('active_game_found', (data) => {
            setGameState({ roomId: data.roomId });
            navigate('/game');
        });

        newSocket.on('active_lobby_found', (data) => {
            setGameState({ roomId: data.roomId });
        });

        newSocket.on('room_updated', (room) => {
            setGameState({ roomId: room.id, hostId: room.hostId, type: room.type, players: room.players, settings: room.settings });
            setLocalSettings(room.settings || { dayTimerMs: 60000, nightTimerMs: 30000, enableSerialKiller: true, enableEscort: true, enableJester: true });
            if (room.status === 'IN_PROGRESS' && window.location.pathname !== '/game') {
                navigate('/game');
            }
        });

        newSocket.on('room_joined', (room) => {
            setGameState({ roomId: room.id, hostId: room.hostId, type: room.type, players: room.players, settings: room.settings });
            setLocalSettings(room.settings || { dayTimerMs: 60000, nightTimerMs: 30000, enableSerialKiller: true, enableEscort: true, enableJester: true });
            if (room.status === 'IN_PROGRESS' && window.location.pathname !== '/game') {
                navigate('/game');
            }
        });

        newSocket.on('room_created', (data) => {
            setGameState({ roomId: data.roomId });
        });

        newSocket.on('room_invite', (data) => {
            setIncomingInvite(data);
        });

        newSocket.on('kicked_from_room', (payload) => {
            setGameState({ roomId: null, hostId: null, players: [] });
            setIsReady(false);
            setShowSettings(false);
            setError(payload?.reason || t('lobby.kicked_from_room'));
        });

        newSocket.on('online_queue_update', (data) => {
            setOnlineQueueInfo({
                inQueue: data.inQueue || 0,
                timer: data.timer !== undefined ? data.timer : null,
                minPlayers: data.minPlayers || 5,
                maxPlayers: data.maxPlayers || 20
            });
        });

        newSocket.on('punishment_notification', (data: { type: string; message: string }) => {
            addNotification({
                type: data.type === 'BAN' ? 'error' : data.type === 'WARN' ? 'warning' : 'info',
                title: 'Покарання',
                message: `${data.message}\n\nЯкщо ви вважаєте це помилкою — подайте апеляцію у профілі.`,
                duration: 10000,
            });
            if (data.type === 'BAN') {
                navigate('/profile');
            }
        });

        newSocket.on('staff_role_changed', (data: { message: string }) => {
            addNotification({
                type: 'info',
                title: 'Зміна ролі',
                message: data.message,
                duration: 8000
            });
            // Refresh user data to get updated role
            useAppStore.getState().fetchCurrentUser();
        });

        newSocket.on('report_resolved', (data: { message?: string }) => {
            addNotification({
                type: 'success',
                title: 'Оновлення скарги',
                message: data.message || 'Вашу скаргу було розглянуто адміністратором.',
                duration: 6000
            });
        });

        setSocket(newSocket);

        // NOTE: Do NOT disconnect on cleanup — socket is shared with Game page.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, navigate]);

    const handleCreate = () => socket?.emit('create_room', { type: createRoomType });
    const handleJoin = () => {
        if (!inputRoomId) return;
        socket?.emit('join_room', { roomId: inputRoomId.toUpperCase() });
    };
    const handleReady = () => {
        setIsReady(!isReady);
        socket?.emit('ready', { roomId: gameState.roomId, isReady: !isReady });
    };
    const handleStart = () => socket?.emit('start_game', { roomId: gameState.roomId });

    const handleLeave = () => {
        socket?.emit('leave_room', { roomId: gameState.roomId });
        setGameState({ roomId: null, hostId: null, players: [] });
        setIsReady(false);
        setShowSettings(false);
    };

    const handleSaveSettings = () => {
        socket?.emit('update_room_settings', { roomId: gameState.roomId, settings: localSettings });
        setShowSettings(false);
    };

    const handleJoinOnline = () => {
        setIsSearchingOnline(true);
        socket?.emit('join_online_queue');
    };

    const handleLeaveOnline = () => {
        setIsSearchingOnline(false);
        socket?.emit('leave_online_queue');
    };

    const isHost = user?.id === gameState.hostId;
    const allReady = gameState.players.length >= 5 && gameState.players.every(p => p.isReady);

    /* Navigation buttons for top bar */
    const navButtons = [
        { label: `🎁 Щоденна Нагорода`, action: () => setIsRewardOpen(true), color: 'red', hideOnMobile: false },
        { label: `📖 ${t('lobby.rules')}`, path: '/guide', color: 'orange', hideOnMobile: true },
        { label: `👥 ${t('lobby.friends')}`, path: '/friends', color: 'emerald', hideOnMobile: true },
        { label: `⚠️ ${t('lobby.report')}`, action: () => { setRecentPlayers(gameState.players ? gameState.players.map(p => p.username) : []); setIsReportOpen(true); }, color: 'red', hideOnMobile: true },
        { label: `🛡️ ${t('lobby.clans')}`, path: '/clans', color: 'blue' },
        { label: `🛒 ${t('lobby.store')}`, path: '/store', color: 'purple' },
        { label: `🎭 ${t('lobby.collection')}`, path: '/collection', color: 'pink' },
        { label: <><Trophy size={16} /> {t('lobby.leaderboard')}</>, path: '/leaderboard', color: 'yellow' },
        { label: `📜 ${t('lobby.history')}`, path: '/history', color: 'green' },
        { label: `🤝 Обмін`, path: '/trades', color: 'teal' },
        { label: `🏆 Турніри`, path: '/tournaments', color: 'amber' },
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-mafia-dark text-mafia-light p-2 sm:p-4 relative">
            {/* Incoming Invite Toast */}
            {incomingInvite && (
                <div className="fixed top-20 right-4 bg-[#111] border border-blue-500 rounded p-4 shadow-[0_0_15px_rgba(59,130,246,0.3)] z-50 animate-bounce max-w-[90vw]">
                    <p className="font-bold text-white mb-3">{t('lobby.invite_text', { username: incomingInvite.inviterUsername })}</p>
                    <div className="flex gap-2">
                        <button onClick={() => {
                            socket?.emit('join_room', { roomId: incomingInvite.roomId });
                            setIncomingInvite(null);
                        }} className="flex-1 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded font-bold text-sm transition">{t('lobby.invite_accept')}</button>
                        <button onClick={() => setIncomingInvite(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded font-bold text-sm transition">{t('lobby.invite_decline')}</button>
                    </div>
                </div>
            )}

            {/* Top Bar */}
            <div className="absolute top-0 w-full p-2 sm:p-4 flex justify-between items-center border-b border-gray-800 bg-[#161616] z-40">
                <div
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 p-1.5 sm:p-2 rounded transition flex-shrink-0"
                    onClick={() => navigate('/profile')}
                >
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-mafia-gray border ${user?.username === 'ADMIN' ? 'border-mafia-red' : 'border-gray-500'} flex items-center justify-center font-bold text-sm`}>
                        {user?.username.charAt(0).toUpperCase()}
                    </div>
                    <span className={`font-medium text-sm ${user?.username === 'ADMIN' ? 'text-mafia-red' : 'text-gray-300'} hidden sm:inline`}>
                        {user?.username} <span className="text-xs text-gray-500">({t('common.profile')})</span>
                    </span>
                </div>

                {/* Desktop nav */}
                <div className="hidden lg:flex items-center gap-2 flex-wrap justify-end">
                    {navButtons.map((btn, i) => (
                        <button
                            key={i}
                            onClick={btn.action || (() => navigate(btn.path!))}
                            className={`text-${btn.color}-500 hover:text-${btn.color}-400 font-bold transition-colors flex items-center gap-1 text-xs bg-${btn.color}-900/30 px-2 py-1.5 rounded border border-${btn.color}-700/50`}
                        >
                            {btn.label}
                        </button>
                    ))}

                    <div className="relative" ref={notificationsRef}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="relative text-gray-400 hover:text-white transition-colors p-1.5 bg-gray-900 border border-gray-700 rounded-full ml-2"
                        >
                            <Bell size={18} />
                            {history.filter(n => !n.read).length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                    {history.filter(n => !n.read).length}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 top-10 w-80 bg-[#161616] border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden">
                                <div className="p-3 border-b border-gray-800 bg-[#111] flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Bell size={14} /> Нотифікації
                                    </h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => markAllAsRead()} title="Прочитати все" className="text-gray-400 hover:text-blue-400">
                                            <CheckCircle2 size={16} />
                                        </button>
                                        <button onClick={() => clearHistory()} title="Очистити історію" className="text-gray-400 hover:text-red-400">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {history.length > 0 ? history.map(notif => (
                                        <div
                                            key={notif.id}
                                            onClick={() => markAsRead(notif.id)}
                                            className={`p-3 border-b border-gray-800 hover:bg-[#1a1a1a] cursor-pointer transition ${notif.read ? 'opacity-60' : 'bg-gray-900/30'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className={`text-xs font-bold ${notif.type === 'error' ? 'text-red-400' :
                                                    notif.type === 'success' ? 'text-green-400' :
                                                        notif.type === 'warning' ? 'text-yellow-400' :
                                                            'text-blue-400'
                                                    }`}>{notif.title}</h4>
                                                <span className="text-[10px] text-gray-500">{formatTimeAgo(notif.timestamp)}</span>
                                            </div>
                                            <p className="text-xs text-gray-300 whitespace-pre-wrap">{notif.message}</p>
                                        </div>
                                    )) : (
                                        <div className="p-4 text-center text-gray-500 text-xs">Немає нових нотифікацій</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {user?.staffRoleKey && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="text-xs bg-red-900/50 hover:bg-red-700 border border-red-500 text-white px-2 py-1 rounded transition-colors uppercase ml-2"
                        >
                            {t('lobby.admin_panel')}
                        </button>
                    )}
                    <h2 className="text-sm font-bold truncate max-w-[160px] text-gray-200">
                        {t('lobby.title', { username: user?.username })}
                    </h2>

                    <LanguageSwitcher />

                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-2 py-1.5 rounded transition shadow-sm text-xs"
                    >
                        <LogOut size={14} />
                        <span className="hidden xl:inline">{t('lobby.logout')}</span>
                    </button>
                </div>

                {/* Mobile menu toggle */}
                <div className="flex lg:hidden items-center gap-2">
                    <LanguageSwitcher />

                    <div className="relative" ref={notificationsRef}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="relative text-gray-400 hover:text-white transition-colors p-1.5 bg-gray-900 border border-gray-700 rounded-full"
                        >
                            <Bell size={18} />
                            {history.filter(n => !n.read).length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                    {history.filter(n => !n.read).length}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="fixed inset-x-2 top-14 z-50 bg-[#161616] border border-gray-700 rounded-lg shadow-2xl overflow-hidden text-left max-w-sm mx-auto">
                                <div className="p-3 border-b border-gray-800 bg-[#111] flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Bell size={14} /> Нотифікації
                                    </h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => markAllAsRead()} title="Прочитати все" className="text-gray-400 hover:text-blue-400">
                                            <CheckCircle2 size={16} />
                                        </button>
                                        <button onClick={() => clearHistory()} title="Очистити історію" className="text-gray-400 hover:text-red-400">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="max-h-[60vh] overflow-y-auto">
                                    {history.length > 0 ? history.map(notif => (
                                        <div
                                            key={notif.id}
                                            onClick={() => markAsRead(notif.id)}
                                            className={`p-3 border-b border-gray-800 hover:bg-[#1a1a1a] cursor-pointer transition ${notif.read ? 'opacity-60' : 'bg-gray-900/30'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className={`text-xs font-bold ${notif.type === 'error' ? 'text-red-400' :
                                                    notif.type === 'success' ? 'text-green-400' :
                                                        notif.type === 'warning' ? 'text-yellow-400' :
                                                            'text-blue-400'
                                                    }`}>{notif.title}</h4>
                                                <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">{formatTimeAgo(notif.timestamp)}</span>
                                            </div>
                                            <p className="text-xs text-gray-300 whitespace-pre-wrap">{notif.message}</p>
                                        </div>
                                    )) : (
                                        <div className="p-4 text-center text-gray-500 text-xs">Немає нових нотифікацій</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {user?.staffRoleKey && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="text-[10px] bg-red-900/50 border border-red-500 text-white px-1.5 py-1 rounded uppercase"
                        >
                            {t('lobby.admin_panel')}
                        </button>
                    )}
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-400 hover:text-white p-1">
                        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
                <div className="fixed top-14 left-0 w-full bg-[#111] border-b border-gray-800 z-30 p-4 lg:hidden">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {navButtons.map((btn, i) => (
                            <button
                                key={i}
                                onClick={() => { setMobileMenuOpen(false); btn.action ? btn.action() : navigate(btn.path!); }}
                                className={`text-${btn.color}-400 font-bold transition-colors flex items-center justify-center gap-1 text-xs bg-${btn.color}-900/30 px-2 py-2 rounded border border-${btn.color}-700/50`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded transition text-sm"
                    >
                        <LogOut size={14} /> {t('lobby.logout')}
                    </button>
                </div>
            )}


            <div className="w-full max-w-2xl mt-16 sm:mt-16">
                {error && <div className="bg-red-900/50 border border-red-500 text-red-100 p-3 rounded mb-6 text-sm text-center">{error}</div>}

                {!gameState.roomId && !isSearchingOnline ? (
                    <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Play Online Matchmaking (Main focus) */}
                        <div
                            onClick={handleJoinOnline}
                            className="relative group overflow-hidden rounded-2xl border-2 border-green-500/30 hover:border-green-400 transition-all cursor-pointer h-80 sm:h-96 md:col-span-2 shadow-[0_0_20px_rgba(34,197,94,0.1)]"
                        >
                            <img
                                src="/assets/radar_bg.png"
                                alt="Online Matchmaking"
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col items-center justify-end p-8 text-center">
                                <Globe size={48} className="text-green-400 mb-4 animate-pulse" />
                                <h3 className="text-2xl sm:text-4xl font-black mb-2 uppercase tracking-tighter">{t('lobby.online')}</h3>
                                <p className="text-gray-300 text-sm sm:text-base max-w-md">{t('lobby.online_desc')}</p>
                                <div className="mt-6 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-12 rounded-full transition-all uppercase tracking-widest shadow-lg active:scale-95">
                                    {t('lobby.online')}
                                </div>
                            </div>
                        </div>

                        {/* Create Room */}
                        <div className="relative group overflow-hidden rounded-2xl border border-gray-800 bg-mafia-gray hover:border-mafia-red/50 transition-all p-8 flex flex-col justify-between h-80 shadow-2xl">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Plus size={120} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                                    <Plus className="text-mafia-red" /> {t('lobby.create_room')}
                                </h3>
                                <p className="text-gray-400 text-sm mb-6">{t('lobby.create_room_desc')}</p>
                            </div>

                            <div>
                                <div className="mb-4">
                                    <label className="text-[10px] uppercase font-bold text-gray-500 ml-1 mb-1 block">Тип Кімнати</label>
                                    <select
                                        value={createRoomType}
                                        onChange={e => setCreateRoomType(e.target.value as 'CASUAL' | 'RANKED')}
                                        className="w-full bg-[#111] border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-mafia-red outline-none appearance-none transition-all"
                                    >
                                        <option value="CASUAL">🟢 CASUAL (Без MMR)</option>
                                        <option value="RANKED">🔴 RANKED (±25 MMR)</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleCreate}
                                    className="w-full bg-mafia-red hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md uppercase text-sm tracking-widest"
                                >
                                    {t('lobby.create_room')}
                                </button>
                            </div>
                        </div>

                        {/* Join Room */}
                        <div className="relative group overflow-hidden rounded-2xl border border-gray-800 bg-mafia-gray hover:border-blue-500/50 transition-all p-8 flex flex-col justify-between h-80 shadow-2xl">
                             <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Users size={120} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                                    <Users className="text-blue-400" /> {t('lobby.join')}
                                </h3>
                                <p className="text-gray-400 text-sm mb-6">{t('lobby.join_desc')}</p>
                            </div>
                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={inputRoomId}
                                        onChange={e => setInputRoomId(e.target.value)}
                                        placeholder={t('lobby.join_code_placeholder')}
                                        maxLength={6}
                                        className="w-full bg-[#111] border border-gray-700 rounded-xl p-4 text-white text-center font-mono focus:border-blue-500 outline-none uppercase tracking-[0.5em] text-xl"
                                    />
                                </div>
                                <button
                                    onClick={handleJoin}
                                    className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors uppercase text-sm tracking-widest"
                                >
                                    {t('lobby.join')}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : isSearchingOnline ? (
                    /* Searching for Online Match */
                    <div className="w-full max-w-2xl bg-mafia-gray rounded-2xl border border-green-500/30 overflow-hidden shadow-2xl relative">
                        <img
                            src="/assets/radar_bg.png"
                            alt="Radar"
                            className="absolute inset-0 w-full h-full object-cover opacity-10"
                        />
                        <div className="relative p-8 sm:p-12 text-center flex flex-col items-center">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse"></div>
                                <div className="animate-spin w-24 h-24 border-t-4 border-l-4 border-green-500 rounded-full relative z-10 flex items-center justify-center">
                                    <Globe size={40} className="text-green-400" />
                                </div>
                            </div>
                            <h2 className="text-3xl font-bold mb-2 text-white uppercase tracking-tighter">{t('lobby.searching')}</h2>
                            <p className="text-gray-400 text-sm mb-8">{t('lobby.online_desc')}</p>

                            <div className="w-full bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-gray-800 mb-8 max-w-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-gray-400 font-medium">Гравців у черзі:</span>
                                    <span className="text-2xl font-black text-green-400 font-mono">{onlineQueueInfo.inQueue} / {onlineQueueInfo.maxPlayers}</span>
                                </div>

                                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-6">
                                    <div
                                        className="bg-green-500 h-full transition-all duration-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                        style={{ width: `${(onlineQueueInfo.inQueue / onlineQueueInfo.maxPlayers) * 100}%` }}
                                    ></div>
                                </div>

                                {onlineQueueInfo.timer !== null ? (
                                    <div className="p-4 bg-green-900/40 border border-green-700/50 rounded-xl">
                                        <p className="text-green-400 font-bold text-xs uppercase mb-1">Матч знайдено! Гра за</p>
                                        <p className="text-4xl font-black font-mono text-white tracking-widest">{onlineQueueInfo.timer}с</p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                        <p className="text-gray-400 text-xs italic">Очікування набору мінімуму для запуску...</p>
                                        <div className="flex justify-center gap-1 mt-2 text-green-500">
                                            <span className="animate-bounce delay-0 w-1.5 h-1.5 bg-current rounded-full"></span>
                                            <span className="animate-bounce delay-75 w-1.5 h-1.5 bg-current rounded-full"></span>
                                            <span className="animate-bounce delay-150 w-1.5 h-1.5 bg-current rounded-full"></span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button onClick={handleLeaveOnline} className="text-gray-400 hover:text-white font-bold py-2 px-8 rounded-full border border-gray-700 hover:border-gray-500 transition-all text-xs uppercase tracking-widest">
                                {t('lobby.stop_search')}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Inside Room */
                    <div className="bg-mafia-gray rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
                        <div className="bg-[#1a1a1a] p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center relative overflow-hidden">
                            {/* Room Type Badge */}
                            {gameState.type && (
                                <div className={`absolute top-0 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs px-4 py-0.5 font-bold rounded-b-md shadow-sm border-x border-b ${gameState.type === 'RANKED'
                                    ? 'bg-red-900/80 text-red-200 border-red-700/50 shadow-[0_0_10px_rgba(204,0,0,0.3)]'
                                    : 'bg-green-900/80 text-green-200 border-green-700/50'
                                    }`}>
                                    {gameState.type}
                                </div>
                            )}
                            <div>
                                <p className="text-xs sm:text-sm text-gray-500 font-medium mt-3 sm:mt-1">{t('lobby.room')}</p>
                                <h2 className="text-2xl sm:text-3xl font-mono font-bold tracking-widest text-white">{gameState.roomId}</h2>
                            </div>
                            <div className="text-right mt-3 sm:mt-1">
                                <p className="text-xs sm:text-sm text-gray-500 font-medium">{t('lobby.players_count')}</p>
                                <p className="text-lg sm:text-xl font-bold">{gameState.players.length} / 20</p>
                            </div>
                        </div>

                        <div className="p-4 sm:p-6">
                            {/* Host Banner - Show to host when full/ready */}
                            {isHost && allReady && (
                                <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="bg-green-600/20 border border-green-500/50 p-4 rounded-xl mb-6 text-center shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                                >
                                    <span className="font-bold text-green-400 uppercase tracking-widest text-sm animate-pulse">Усі гравці готові! Можна запускати.</span>
                                </motion.div>
                            )}

                            <h3 className="text-base sm:text-lg font-medium text-gray-400 mb-4 flex items-center gap-2">
                                <Users size={20} className="text-mafia-red" />
                                {t('lobby.player_list')}
                                <span className="ml-auto text-xs text-gray-600">{gameState.players.filter(p => p.isReady).length} готові</span>
                            </h3>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                                {gameState.players.map(p => (
                                    <li key={p.userId} className={`flex justify-between items-center p-3 rounded-xl bg-[#111] border transition-all ${p.isReady ? 'border-green-800/50 bg-green-900/5' : 'border-gray-800/50'}`}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {p.userId === gameState.hostId ? (
                                                <div className="text-yellow-500" title={t('lobby.host')}><Trophy size={16} fill="currentColor" /></div>
                                            ) : p.level && (
                                                <span className="text-[10px] text-gray-500 font-mono font-bold bg-gray-900 px-1 rounded border border-gray-800">LVL {p.level}</span>
                                            )}
                                            <Link to={`/profile/${p.userId}`} className={`font-bold text-sm truncate hover:text-white transition-colors uppercase tracking-wider ${p.userId === user?.id ? 'text-mafia-red' : 'text-gray-300'}`}>
                                                {p.username}
                                            </Link>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {p.isReady ? (
                                                <CheckCircle2 size={18} className="text-green-500" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-dashed border-gray-600 animate-spin"></div>
                                            )}
                                            {isHost && p.userId !== user?.id && (
                                                <button
                                                    onClick={() => socket?.emit('host_kick', { roomId: gameState.roomId, targetId: p.userId })}
                                                    className="p-1 hover:text-red-500 text-gray-600 transition-colors"
                                                    title={t('lobby.kick')}
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            {/* Settings Section */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-base sm:text-lg font-medium text-gray-400 flex items-center gap-2"><Settings size={20} /> {t('lobby.room_settings')}</h3>
                                    {isHost && (
                                        <button
                                            onClick={() => setShowSettings(!showSettings)}
                                            className="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1 text-white rounded transition"
                                        >
                                            {showSettings ? t('lobby.hide_settings') : t('lobby.show_settings')}
                                        </button>
                                    )}
                                </div>

                                {showSettings && isHost ? (
                                    <div className="bg-[#111] border border-gray-700 p-4 rounded mb-4">
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">{t('lobby.day_timer')}</label>
                                                <select
                                                    value={localSettings.dayTimerMs}
                                                    onChange={e => setLocalSettings(prev => ({ ...prev, dayTimerMs: Number(e.target.value) }))}
                                                    className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-sm"
                                                >
                                                    <option value={30000}>30 сек</option>
                                                    <option value={60000}>60 сек</option>
                                                    <option value={90000}>90 сек</option>
                                                    <option value={120000}>120 сек</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">{t('lobby.night_timer')}</label>
                                                <select
                                                    value={localSettings.nightTimerMs}
                                                    onChange={e => setLocalSettings(prev => ({ ...prev, nightTimerMs: Number(e.target.value) }))}
                                                    className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-white text-sm"
                                                >
                                                    <option value={15000}>15 сек</option>
                                                    <option value={30000}>30 сек</option>
                                                    <option value={45000}>45 сек</option>
                                                    <option value={60000}>60 сек</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="enableSerialKiller"
                                                    checked={localSettings.enableSerialKiller}
                                                    onChange={e => setLocalSettings(prev => ({ ...prev, enableSerialKiller: e.target.checked }))}
                                                    className="w-4 h-4 accent-mafia-red"
                                                />
                                                <label htmlFor="enableSerialKiller" className="text-sm">{t('lobby.role_serial_killer')}</label>
                                            </div>
                                            <div className="col-span-2 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="enableEscort"
                                                    checked={localSettings.enableEscort}
                                                    onChange={e => setLocalSettings(prev => ({ ...prev, enableEscort: e.target.checked }))}
                                                    className="w-4 h-4 accent-mafia-red"
                                                />
                                                <label htmlFor="enableEscort" className="text-sm">{t('lobby.role_escort')}</label>
                                            </div>
                                            <div className="col-span-2 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="enableJester"
                                                    checked={localSettings.enableJester}
                                                    onChange={e => setLocalSettings(prev => ({ ...prev, enableJester: e.target.checked }))}
                                                    className="w-4 h-4 accent-mafia-red"
                                                />
                                                <label htmlFor="enableJester" className="text-sm">{t('lobby.role_jester')}</label>
                                            </div>

                                            {/* NEW ROLES */}
                                            {Object.entries({
                                                enableLawyer: 'Адвокат',
                                                enableBodyguard: 'Охоронець',
                                                enableTracker: 'Слідопит',
                                                enableInformer: 'Інформатор',
                                                enableMayor: 'Мер',
                                                enableJudge: 'Суддя',
                                                enableBomber: 'Підривник',
                                                enableTrapper: 'Трапер',
                                                enableSilencer: 'Глушувач',
                                                enableLovers: 'Коханці',
                                                enableWhore: 'Повія',
                                                enableJournalist: 'Журналіст',
                                            }).map(([key, label]) => (
                                                <div className="col-span-1 flex items-center gap-2" key={key}>
                                                    <input
                                                        type="checkbox"
                                                        id={key}
                                                        checked={localSettings[key] as boolean}
                                                        onChange={e => setLocalSettings(prev => ({ ...prev, [key]: e.target.checked }))}
                                                        className="w-4 h-4 accent-mafia-red"
                                                    />
                                                    <label htmlFor={key} className="text-sm truncate">{label}</label>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={handleSaveSettings}
                                            className="w-full bg-green-700 hover:bg-green-600 font-bold py-2 rounded text-sm transition"
                                        >
                                            {t('lobby.save_settings')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-[#1a1a1a] border border-gray-800/50 p-3 rounded flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400">
                                        <div>☀️ {t('lobby.day_timer')}: <b>{(gameState.settings?.dayTimerMs || 60000) / 1000}с</b></div>
                                        <div>🌙 {t('lobby.night_timer')}: <b>{(gameState.settings?.nightTimerMs || 30000) / 1000}с</b></div>
                                        <div>🔪 {t('lobby.role_serial_killer').split(' (')[0]}: <b>{gameState.settings?.enableSerialKiller === false ? t('lobby.off') : t('lobby.on')}</b></div>
                                        <div>💃 {t('lobby.role_escort').split(' (')[0]}: <b>{gameState.settings?.enableEscort === false ? t('lobby.off') : t('lobby.on')}</b></div>
                                        <div>🤡 {t('lobby.role_jester').split(' (')[0]}: <b>{gameState.settings?.enableJester === false ? t('lobby.off') : t('lobby.on')}</b></div>

                                        {/* Display only enabled extra roles */}
                                        {['Lawyer', 'Bodyguard', 'Tracker', 'Informer', 'Mayor', 'Judge', 'Bomber', 'Trapper', 'Silencer', 'Lovers', 'Whore', 'Journalist'].map((role) => {
                                            const settingsKey = `enable${role}`;
                                            return gameState.settings?.[settingsKey as keyof typeof gameState.settings] ? (
                                                <div key={role}>✅ {role}</div>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 sm:gap-4">
                                <button
                                    onClick={handleLeave}
                                    className="flex-1 bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-800 font-bold py-2 sm:py-3 px-3 sm:px-4 rounded transition-colors text-sm"
                                >
                                    {t('lobby.leave')}
                                </button>
                                <button
                                    onClick={handleReady}
                                    className={`flex-2 font-bold py-2 sm:py-3 px-3 sm:px-4 rounded transition-all shadow-lg text-sm ${isReady ? 'bg-gray-600 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                >
                                    {isReady ? t('lobby.cancel_ready') : t('lobby.im_ready')}
                                </button>

                                {isHost && (
                                    <div className="flex-1 relative group">
                                        <button
                                            onClick={handleStart}
                                            disabled={!allReady}
                                            className="w-full bg-mafia-red hover:bg-red-700 disabled:bg-red-900/30 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 sm:py-3 px-3 sm:px-4 rounded transition-colors flex justify-center items-center gap-1 sm:gap-2 text-sm"
                                        >
                                            <Play size={18} /> {t('lobby.start')}
                                        </button>
                                        {!allReady && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black border border-gray-700 text-gray-300 text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                Потрібно мін. 4 гравців і всі мають бути готові
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ReportModal
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                recentPlayers={recentPlayers}
            />

            <DailyRewardModal
                isOpen={isRewardOpen}
                onClose={() => setIsRewardOpen(false)}
            />

            {!isSearchingOnline && (
                <LobbyChat roomId={gameState.roomId || 'global'} />
            )}
        </div>
    );
}
