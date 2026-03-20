import { describe, expect, it, beforeEach } from 'vitest'
import { useNotificationStore } from '../store/notificationStore'

describe('useNotificationStore', () => {
  beforeEach(() => {
    localStorage.setItem('mafia_notifications_history', '[]')
    useNotificationStore.setState({
      notifications: [],
      history: [],
    } as any)
  })

  it('adds notifications and persists history (unread by default)', () => {
    const store = useNotificationStore.getState()
    store.addNotification({
      type: 'info',
      title: 'T',
      message: 'M',
      duration: 0,
    })

    const next = useNotificationStore.getState()
    expect(next.notifications.length).toBe(1)
    expect(next.history.length).toBe(1)
    expect(next.history[0].title).toBe('T')
    expect(next.history[0].read).toBe(false)
  })

  it('markAsRead toggles read flag in history', () => {
    const store = useNotificationStore.getState()
    store.addNotification({
      type: 'success',
      title: 'T',
      message: 'M',
      duration: 0,
    })

    const next = useNotificationStore.getState()
    const id = next.history[0].id
    store.markAsRead(id)

    const after = useNotificationStore.getState()
    expect(after.history[0].read).toBe(true)
  })

  it('clearHistory empties history and persists to localStorage', () => {
    const store = useNotificationStore.getState()
    store.addNotification({
      type: 'error',
      title: 'T',
      message: 'M',
      duration: 0,
    })
    expect(useNotificationStore.getState().history.length).toBe(1)

    store.clearHistory()
    const after = useNotificationStore.getState()
    expect(after.history.length).toBe(0)
    expect(localStorage.getItem('mafia_notifications_history')).toBe('[]')
  })
})

