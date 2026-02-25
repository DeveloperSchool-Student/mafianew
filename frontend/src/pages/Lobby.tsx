import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { LogOut, Users, Play, Plus, Trophy, Settings, Globe, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ReportModal } from '../components/ReportModal';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function Lobby() {
    const { user, logout, socket, setSocket, gameState, setGameState } = useAppStore();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [inputRoomId, setInputRoomId] = useState('');
    const [error, setError] = useState('');
    const [isReady, setIsReady] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [recentPlayers, setRecentPlayers] = useState<string[]>([]);
    const [incomingInvite, setIncomingInvite] = useState<{ roomId: string, inviterUsername: string } | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isSearchingOnline, setIsSearchingOnline] = useState(false);
    const [localSettings, setLocalSettings] = useState({
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
            auth: { token: user.token }
        });

        newSocket.on('connect', () => {
            newSocket.emit('check_active_game');
        });
        newSocket.on('connect_error', (err) => {
            setError('Connection error: ' + err.message);
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
            setGameState({ roomId: room.id, hostId: room.hostId, players: room.players, settings: room.settings });
            setLocalSettings(room.settings || { dayTimerMs: 60000, nightTimerMs: 30000, enableSerialKiller: true, enableEscort: true, enableJester: true });
            if (room.status === 'IN_PROGRESS' && window.location.pathname !== '/game') {
                navigate('/game');
            }
        });

        newSocket.on('room_joined', (room) => {
            setGameState({ roomId: room.id, hostId: room.hostId, players: room.players, settings: room.settings });
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

        // Online matchmaking events
        newSocket.on('online_match_found', (data) => {
            setIsSearchingOnline(false);
            setGameState({ roomId: data.roomId });
        });

        newSocket.on('online_queue_update', (data) => {
            // Could show queue count here if needed
        });

        setSocket(newSocket);

        // NOTE: Do NOT disconnect on cleanup — socket is shared with Game page.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, navigate]);

    const handleCreate = () => socket?.emit('create_room');
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
    const allReady = gameState.players.length >= 4 && gameState.players.every(p => p.isReady);

    /* Navigation buttons for top bar */
    const navButtons = [
        { label: `📖 ${t('lobby.rules')}`, path: '/guide', color: 'orange', hideOnMobile: true },
        { label: `👥 ${t('lobby.friends')}`, path: '/friends', color: 'emerald', hideOnMobile: true },
        { label: `⚠️ ${t('lobby.report')}`, action: () => { setRecentPlayers(gameState.players ? gameState.players.map(p => p.username) : []); setIsReportOpen(true); }, color: 'red', hideOnMobile: true },
        { label: `🛡️ ${t('lobby.clans')}`, path: '/clans', color: 'blue' },
        { label: `🛒 ${t('lobby.store')}`, path: '/store', color: 'purple' },
        { label: `🎭 ${t('lobby.collection')}`, path: '/collection', color: 'pink' },
        { label: <><Trophy size={16} /> {t('lobby.leaderboard')}</>, path: '/leaderboard', color: 'yellow' },
        { label: `📜 ${t('lobby.history')}`, path: '/history', color: 'green' },
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

                    {user?.staffRoleKey && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="text-xs bg-red-900/50 hover:bg-red-700 border border-red-500 text-white px-2 py-1 rounded transition-colors uppercase"
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-fr">
                        {/* Create Room */}
                        <div className="bg-mafia-gray rounded-xl p-6 sm:p-8 border border-gray-800 flex flex-col items-center justify-center text-center hover:border-mafia-red/50 transition-colors h-full">
                            <Plus size={40} className="text-mafia-red mb-3 sm:mb-4" />
                            <h3 className="text-lg sm:text-xl font-bold mb-2">{t('lobby.create_room')}</h3>
                            <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">{t('lobby.create_room_desc')}</p>
                            <button onClick={handleCreate} className="w-full bg-mafia-red hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-all shadow-[0_0_10px_rgba(204,0,0,0.3)] uppercase text-sm">
                                {t('lobby.create_room')}
                            </button>
                        </div>

                        {/* Join Room */}
                        <div className="bg-mafia-gray rounded-xl p-6 sm:p-8 border border-gray-800 flex flex-col items-center justify-center text-center hover:border-mafia-red/50 transition-colors h-full">
                            <Users size={40} className="text-gray-400 mb-3 sm:mb-4" />
                            <h3 className="text-lg sm:text-xl font-bold mb-2">{t('lobby.join')}</h3>
                            <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">{t('lobby.join_desc')}</p>
                            <div className="flex w-full gap-2">
                                <input
                                    type="text"
                                    value={inputRoomId}
                                    onChange={e => setInputRoomId(e.target.value)}
                                    placeholder={t('lobby.join_code_placeholder')}
                                    maxLength={6}
                                    className="w-2/3 bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white text-center font-mono focus:border-white focus:outline-none uppercase text-sm"
                                />
                                <button onClick={handleJoin} className="w-1/3 bg-white text-black font-bold py-3 px-2 rounded hover:bg-gray-200 transition-colors uppercase text-sm">
                                    {t('lobby.join')}
                                </button>
                            </div>
                        </div>

                        {/* Online Matchmaking */}
                        <div className="bg-mafia-gray rounded-xl p-6 sm:p-8 border border-gray-800 flex flex-col items-center justify-center text-center hover:border-green-500/50 transition-colors h-full sm:col-span-2 lg:col-span-1">
                            <Globe size={40} className="text-green-400 mb-3 sm:mb-4" />
                            <h3 className="text-lg sm:text-xl font-bold mb-2">{t('lobby.online')}</h3>
                            <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">{t('lobby.online_desc')}</p>
                            <button onClick={handleJoinOnline} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)] uppercase text-sm">
                                {t('lobby.online')}
                            </button>
                        </div>
                    </div>
                ) : isSearchingOnline ? (
                    /* Searching for Online Match */
                    <div className="bg-mafia-gray rounded-xl border border-green-800 p-8 sm:p-12 text-center">
                        <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-6"></div>
                        <h2 className="text-2xl font-bold mb-2">{t('lobby.searching')}</h2>
                        <p className="text-gray-500 text-sm mb-8">{t('lobby.online_desc')}</p>
                        <button onClick={handleLeaveOnline} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-bold py-3 px-8 rounded transition-colors">
                            {t('lobby.stop_search')}
                        </button>
                    </div>
                ) : (
                    /* Inside Room */
                    <div className="bg-mafia-gray rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
                        <div className="bg-[#1a1a1a] p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center">
                            <div>
                                <p className="text-xs sm:text-sm text-gray-500 font-medium">{t('lobby.room')}</p>
                                <h2 className="text-2xl sm:text-3xl font-mono font-bold tracking-widest text-white">{gameState.roomId}</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-xs sm:text-sm text-gray-500 font-medium">{t('lobby.players_count')}</p>
                                <p className="text-lg sm:text-xl font-bold">{gameState.players.length} / 20</p>
                            </div>
                        </div>

                        <div className="p-4 sm:p-6">
                            <h3 className="text-base sm:text-lg font-medium text-gray-400 mb-4 flex items-center gap-2"><Users size={20} /> {t('lobby.player_list')}</h3>
                            <ul className="space-y-2 mb-6 sm:mb-8">
                                {gameState.players.map(p => (
                                    <li key={p.userId} className="flex justify-between items-center p-2 sm:p-3 rounded bg-[#1a1a1a] border border-gray-800/50">
                                        <div className="flex items-center gap-2">
                                            {p.level && <span className="text-xs text-yellow-500 font-mono font-bold bg-[#111] px-1 rounded border border-yellow-900/50">[{p.level}]</span>}
                                            <span className="font-medium text-gray-300 text-sm">
                                                <Link to={`/profile/${p.userId}`} className="hover:text-mafia-red transition-colors">{p.username}</Link> {p.userId === user?.id && `(${t('lobby.you')})`}
                                                {p.userId === gameState.hostId && <span className="ml-2 text-xs text-mafia-red font-bold">({t('lobby.host')})</span>}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${p.isReady ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                                                {p.isReady ? t('lobby.ready') : t('lobby.waiting_status')}
                                            </span>
                                            {isHost && p.userId !== user?.id && (
                                                <button
                                                    onClick={() => socket?.emit('host_kick', { roomId: gameState.roomId, targetId: p.userId })}
                                                    className="text-[10px] uppercase bg-red-900/40 hover:bg-red-700 border border-red-700/60 text-red-300 px-2 py-1 rounded transition-colors"
                                                >
                                                    {t('lobby.kick')}
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
                                            }).map(([key, label]) => (
                                                <div className="col-span-1 flex items-center gap-2" key={key}>
                                                    <input
                                                        type="checkbox"
                                                        id={key}
                                                        checked={(localSettings as any)[key]}
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
                                        {['Lawyer', 'Bodyguard', 'Tracker', 'Informer', 'Mayor', 'Judge', 'Bomber', 'Trapper', 'Silencer', 'Lovers'].map((role) => {
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
                                    <button
                                        onClick={handleStart}
                                        disabled={!allReady}
                                        className="flex-1 bg-mafia-red hover:bg-red-700 disabled:bg-red-900/30 disabled:text-gray-500 text-white font-bold py-2 sm:py-3 px-3 sm:px-4 rounded transition-colors flex justify-center items-center gap-1 sm:gap-2 text-sm"
                                    >
                                        <Play size={18} /> {t('lobby.start')}
                                    </button>
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
        </div>
    );
}
