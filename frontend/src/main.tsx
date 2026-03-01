import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import './i18n'
import App from './App.tsx'
import { Login } from './pages/Login.tsx'
import { Lobby } from './pages/Lobby.tsx'
import { Game } from './pages/Game.tsx'
import { Profile } from './pages/Profile.tsx'
import { Leaderboard } from './pages/Leaderboard.tsx' // Added import for Leaderboard
import { Store } from './pages/Store.tsx'
import { Clans } from './pages/Clans.tsx'
import { Collection } from './pages/Collection.tsx'
import { History } from './pages/History.tsx'
import { Friends } from './pages/Friends.tsx'
import { Messages } from './pages/Messages.tsx'
import { Trades } from './pages/Trades.tsx'
import { AdminPage } from './pages/AdminPage.tsx'
import { Guide } from './pages/Guide.tsx'
import { MatchReplay } from './pages/MatchReplay.tsx'
import { Privacy } from './pages/Privacy.tsx'
import { ForgotPassword } from './pages/ForgotPassword.tsx'
import { ResetPassword } from './pages/ResetPassword.tsx'

// @ts-ignore
import Twemoji from 'react-twemoji'
import { NotificationToaster } from './components/NotificationToaster.tsx'

import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Нова версія доступна! Оновити зараз?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('Додаток готовий працювати офлайн')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Twemoji options={{ className: 'twemoji inline-block w-[1em] h-[1em] align-middle mb-[2px]' }}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<Login />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game" element={<Game />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/leaderboard" element={<Leaderboard />} /> {/* Added route for Leaderboard */}
          <Route path="/store" element={<Store />} />
          <Route path="/clans" element={<Clans />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/history" element={<History />} />
          <Route path="/match/:id" element={<MatchReplay />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:id" element={<Messages />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Twemoji>
      <NotificationToaster />
    </BrowserRouter>
  </StrictMode>,
)
