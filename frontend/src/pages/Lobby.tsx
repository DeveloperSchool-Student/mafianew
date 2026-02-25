import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { LogOut, Users, Play, Plus, Trophy, Settings } from 'lucide-react';
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
            setError('Ваша сесія замінена іншою вкладкою.');
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
            setError(payload?.reason || 'Вас викинуто з кімнати хостом.');
        });

        setSocket(newSocket);

        // NOTE: Do NOT disconnect on cleanup — socket is shared with Game page.
        // Socket lifecycle is managed by logout() in the store.
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

    const isHost = user?.id === gameState.hostId;
    const allReady = gameState.players.length >= 4 && gameState.players.every(p => p.isReady);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-mafia-dark text-mafia-light p-4 relative">
            {/* Incoming Invite Toast */}
            {incomingInvite && (
                <div className="fixed top-20 right-4 bg-[#111] border border-blue-500 rounded p-4 shadow-[0_0_15px_rgba(59,130,246,0.3)] z-50 animate-bounce">
                    <p className="font-bold text-white mb-3">Гравець <span className="text-yellow-400">{incomingInvite.inviterUsername}</span> запрошує вас до кімнати!</p>
                    <div className="flex gap-2">
                        <button onClick={() => {
                            socket?.emit('join_room', { roomId: incomingInvite.roomId });
                            setIncomingInvite(null);
                        }} className="flex-1 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded font-bold text-sm transition">Прийняти</button>
                        <button onClick={() => setIncomingInvite(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded font-bold text-sm transition">Відхилити</button>
                    </div>
                </div>
            )}

            {/* Top Bar */}
            <div className="absolute top-0 w-full p-4 flex justify-between items-center border-b border-gray-800 bg-[#161616]">
                <div
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 p-2 rounded transition"
                    onClick={() => navigate('/profile')}
                >
                    <div className={`w-8 h-8 rounded-full bg-mafia-gray border ${user?.username === 'ADMIN' ? 'border-mafia-red' : 'border-gray-500'} flex items-center justify-center font-bold`}>
                        {user?.username.charAt(0).toUpperCase()}
                    </div>
                    <span className={`font-medium ${user?.username === 'ADMIN' ? 'text-mafia-red' : 'text-gray-300'}`}>
                        {user?.username} <span className="text-xs text-gray-500">(Профіль)</span>
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/guide')}
                        className="hidden md:flex text-orange-500 hover:text-orange-400 font-bold transition-colors items-center gap-1 text-sm bg-orange-900/30 px-3 py-1.5 rounded border border-orange-700/50"
                    >
                        📖 Правила
                    </button>
                    <button
                        onClick={() => navigate('/friends')}
                        className="hidden md:flex text-emerald-500 hover:text-emerald-400 font-bold transition-colors items-center gap-1 text-sm bg-emerald-900/30 px-3 py-1.5 rounded border border-emerald-700/50"
                    >
                        👥 Друзі
                    </button>
                    <button
                        onClick={() => {
                            setRecentPlayers(gameState.players ? gameState.players.map(p => p.username) : []);
                            setIsReportOpen(true);
                        }}
                        className="hidden md:flex text-red-500 hover:text-red-400 font-bold transition-colors items-center gap-1 text-sm bg-red-900/30 px-3 py-1.5 rounded border border-red-700/50"
                    >
                        ⚠️ Скарга
                    </button>
                    <button
                        onClick={() => navigate('/clans')}
                        className="text-blue-500 hover:text-blue-400 font-bold transition-colors flex items-center gap-1 text-sm bg-blue-900/30 px-3 py-1.5 rounded border border-blue-700/50"
                    >
                        🛡️ Клани
                    </button>
                    <button
                        onClick={() => navigate('/store')}
                        className="text-purple-500 hover:text-purple-400 font-bold transition-colors flex items-center gap-1 text-sm bg-purple-900/30 px-3 py-1.5 rounded border border-purple-700/50"
                    >
                        🛒 Магазин
                    </button>
                    <button
                        onClick={() => navigate('/collection')}
                        className="text-pink-500 hover:text-pink-400 font-bold transition-colors flex items-center gap-1 text-sm bg-pink-900/30 px-3 py-1.5 rounded border border-pink-700/50"
                    >
                        🎭 Колекція
                    </button>
                    <button
                        onClick={() => navigate('/leaderboard')}
                        className="text-yellow-500 hover:text-yellow-400 font-bold transition-colors flex items-center gap-1 text-sm bg-yellow-900/30 px-3 py-1.5 rounded border border-yellow-700/50"
                    >
                        <Trophy size={16} /> Рейтинг
                    </button>
                    <button
                        onClick={() => navigate('/history')}
                        className="text-green-500 hover:text-green-400 font-bold transition-colors flex items-center gap-1 text-sm bg-green-900/30 px-3 py-1.5 rounded border border-green-700/50"
                    >
                        📜 Історія
                    </button>

                    {/* Welcome Message */}
                    {user?.staffRoleKey && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="text-xs bg-red-900/50 hover:bg-red-700 border border-red-500 text-white px-2 py-1 rounded transition-colors uppercase"
                        >
                            Адмін-панель
                        </button>
                    )}
                    <h2 className="text-lg font-bold truncate max-w-[200px] text-gray-200">
                        {t('lobby.title', { username: user?.username })}
                    </h2>

                    <LanguageSwitcher />

                    <button
                        onClick={() => {
                            logout();
                            navigate('/login');
                        }}
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 py-1.5 rounded transition shadow-sm text-sm"
                    >
                        <LogOut size={16} />
                        <span className="hidden sm:inline">{t('lobby.logout')}</span>
                    </button>
                </div>
            </div>


            <div className="w-full max-w-2xl mt-16">
                {error && <div className="bg-red-900/50 border border-red-500 text-red-100 p-3 rounded mb-6 text-sm text-center">{error}</div>}

                {!gameState.roomId ? (
                    <div className="grid md:grid-cols-2 gap-6 auto-rows-fr">
                        {/* Create Room */}
                        <div className="bg-mafia-gray rounded-xl p-8 border border-gray-800 flex flex-col items-center justify-center text-center hover:border-mafia-red/50 transition-colors h-full">
                            <Plus size={48} className="text-mafia-red mb-4" />
                            <h3 className="text-xl font-bold mb-2">{t('lobby.create_room')}</h3>
                            <p className="text-gray-500 text-sm mb-6">Створіть закриту кімнату і запросіть друзів за кодом.</p>
                            <button onClick={handleCreate} className="w-full bg-mafia-red hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-all shadow-[0_0_10px_rgba(204,0,0,0.3)] uppercase">
                                {t('lobby.create_room')}
                            </button>
                        </div>

                        {/* Join Room */}
                        <div className="bg-mafia-gray rounded-xl p-8 border border-gray-800 flex flex-col items-center justify-center text-center hover:border-mafia-red/50 transition-colors h-full">
                            <Users size={48} className="text-gray-400 mb-4" />
                            <h3 className="text-xl font-bold mb-2">{t('lobby.join')}</h3>
                            <p className="text-gray-500 text-sm mb-6">Введіть 6-значний код кімнати щоб увійти.</p>
                            <div className="flex w-full gap-2">
                                <input
                                    type="text"
                                    value={inputRoomId}
                                    onChange={e => setInputRoomId(e.target.value)}
                                    placeholder="КОД"
                                    maxLength={6}
                                    className="w-2/3 bg-[#1a1a1a] border border-gray-700 rounded p-3 text-white text-center font-mono focus:border-white focus:outline-none uppercase"
                                />
                                <button onClick={handleJoin} className="w-1/3 bg-white text-black font-bold py-3 px-4 rounded hover:bg-gray-200 transition-colors uppercase">
                                    {t('lobby.join')}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Inside Room */
                    <div className="bg-mafia-gray rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
                        <div className="bg-[#1a1a1a] p-6 border-b border-gray-800 flex justify-between items-center">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Кімната</p>
                                <h2 className="text-3xl font-mono font-bold tracking-widest text-white">{gameState.roomId}</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500 font-medium">Гравців</p>
                                <p className="text-xl font-bold">{gameState.players.length} / 20</p>
                            </div>
                        </div>

                        <div className="p-6">
                            <h3 className="text-lg font-medium text-gray-400 mb-4 flex items-center gap-2"><Users size={20} /> Список гравців</h3>
                            <ul className="space-y-2 mb-8">
                                {gameState.players.map(p => (
                                    <li key={p.userId} className="flex justify-between items-center p-3 rounded bg-[#1a1a1a] border border-gray-800/50">
                                        <div className="flex items-center gap-2">
                                            {p.level && <span className="text-xs text-yellow-500 font-mono font-bold bg-[#111] px-1 rounded border border-yellow-900/50">[{p.level}]</span>}
                                            <span className="font-medium text-gray-300">
                                                <Link to={`/profile/${p.userId}`} className="hover:text-mafia-red transition-colors">{p.username}</Link> {p.userId === user?.id && '(Ви)'}
                                                {p.userId === gameState.hostId && <span className="ml-2 text-xs text-mafia-red font-bold">(Хост)</span>}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${p.isReady ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                                                {p.isReady ? 'ГОТОВИЙ' : 'ОЧІКУЄ'}
                                            </span>
                                            {isHost && p.userId !== user?.id && (
                                                <button
                                                    onClick={() => socket?.emit('host_kick', { roomId: gameState.roomId, targetId: p.userId })}
                                                    className="text-[10px] uppercase bg-red-900/40 hover:bg-red-700 border border-red-700/60 text-red-300 px-2 py-1 rounded transition-colors"
                                                >
                                                    Kick
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            {/* Settings Section */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-medium text-gray-400 flex items-center gap-2"><Settings size={20} /> Налаштування кімнати</h3>
                                    {isHost && (
                                        <button
                                            onClick={() => setShowSettings(!showSettings)}
                                            className="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1 text-white rounded transition"
                                        >
                                            {showSettings ? 'Сховати' : 'Змінити'}
                                        </button>
                                    )}
                                </div>

                                {showSettings && isHost ? (
                                    <div className="bg-[#111] border border-gray-700 p-4 rounded mb-4">
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">День (секунд)</label>
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
                                                <label className="block text-xs text-gray-500 mb-1">Ніч (секунд)</label>
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
                                                <label htmlFor="enableSerialKiller" className="text-sm">Вбивця (від 9 гравців)</label>
                                            </div>
                                            <div className="col-span-2 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="enableEscort"
                                                    checked={localSettings.enableEscort}
                                                    onChange={e => setLocalSettings(prev => ({ ...prev, enableEscort: e.target.checked }))}
                                                    className="w-4 h-4 accent-mafia-red"
                                                />
                                                <label htmlFor="enableEscort" className="text-sm">Ескорт (від 8 гравців)</label>
                                            </div>
                                            <div className="col-span-2 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="enableJester"
                                                    checked={localSettings.enableJester}
                                                    onChange={e => setLocalSettings(prev => ({ ...prev, enableJester: e.target.checked }))}
                                                    className="w-4 h-4 accent-mafia-red"
                                                />
                                                <label htmlFor="enableJester" className="text-sm">Блазень (від 7 гравців)</label>
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
                                            ЗБЕРЕГТИ НАЛАШТУВАННЯ
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-[#1a1a1a] border border-gray-800/50 p-3 rounded flex flex-wrap gap-4 text-sm text-gray-400">
                                        <div>☀️ День: <b>{(gameState.settings?.dayTimerMs || 60000) / 1000}с</b></div>
                                        <div>🌙 Ніч: <b>{(gameState.settings?.nightTimerMs || 30000) / 1000}с</b></div>
                                        <div>🔪 Вбивця: <b>{gameState.settings?.enableSerialKiller === false ? 'Вимк' : 'Увімк'}</b></div>
                                        <div>💃 Ескорт: <b>{gameState.settings?.enableEscort === false ? 'Вимк' : 'Увімк'}</b></div>
                                        <div>🤡 Блазень: <b>{gameState.settings?.enableJester === false ? 'Вимк' : 'Увімк'}</b></div>

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

                            <div className="flex gap-4">
                                <button
                                    onClick={handleLeave}
                                    className="flex-1 bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-800 font-bold py-3 px-4 rounded transition-colors"
                                >
                                    ПОКИНУТИ
                                </button>
                                <button
                                    onClick={handleReady}
                                    className={`flex-2 font-bold py-3 px-4 rounded transition-all shadow-lg ${isReady ? 'bg-gray-600 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                >
                                    {isReady ? 'СКАСУВАТИ' : 'Я ГОТОВИЙ'}
                                </button>

                                {isHost && (
                                    <button
                                        onClick={handleStart}
                                        disabled={!allReady}
                                        className="flex-1 bg-mafia-red hover:bg-red-700 disabled:bg-red-900/30 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded transition-colors flex justify-center items-center gap-2"
                                    >
                                        <Play size={20} /> СТАРТ
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
