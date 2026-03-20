import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from './store'
import { useNotificationStore } from './store/notificationStore'
import { Shield } from 'lucide-react'
import { audioManager } from './utils/audio'

function App() {
  const user = useAppStore(state => state.user)
  const isInitializing = useAppStore(state => state.isInitializing)
  const fetchCurrentUser = useAppStore(state => state.fetchCurrentUser)
  const theme = useAppStore(state => state.theme)
  const socket = useAppStore(state => state.socket)
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Global click sound handler
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, [role="button"]')) {
        audioManager.playClick();
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    if (isInitializing) return;

    if (user) {
      if (window.location.pathname === '/login' || window.location.pathname === '/register' || window.location.pathname === '/') {
          navigate('/lobby');
      }
    } else {
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register' && !window.location.pathname.startsWith('/reset-password')) {
          navigate('/login');
      }
    }
  }, [user, navigate, isInitializing])

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data: { title: string; message: string; type?: string }) => {
      audioManager.playNotification();
      useNotificationStore.getState().addNotification({
        title: data.title,
        message: data.message,
        type: (data.type as any) || 'info'
      });
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket]);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-mafia-dark text-mafia-light">
        <div className="flex flex-col items-center animate-pulse">
          <Shield size={64} className="text-mafia-red mb-4" />
          <h1 className="text-2xl font-bold tracking-widest text-mafia-light">MAFIA <span className="text-mafia-red">ONLINE</span></h1>
          <p className="mt-2 text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return null;
}

export default App
