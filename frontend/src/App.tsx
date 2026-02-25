import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from './store'
import { Shield } from 'lucide-react'

function App() {
  const user = useAppStore(state => state.user)
  const isInitializing = useAppStore(state => state.isInitializing)
  const fetchCurrentUser = useAppStore(state => state.fetchCurrentUser)
  const navigate = useNavigate()

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (isInitializing) return;

    if (user) {
      navigate('/lobby')
    } else {
      navigate('/login')
    }
  }, [user, navigate, isInitializing])

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
