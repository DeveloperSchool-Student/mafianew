import { act, renderHook, waitFor } from '@testing-library/react'
import { useMobileChatUI } from '../hooks/useMobileChatUI'
import { vi } from 'vitest'

let mockChat: any[] = []

vi.mock('../store', () => ({
  useAppStore: () => ({
    gameState: {
      chat: mockChat,
    },
  }),
}))

describe('useMobileChatUI', () => {
  it('accumulates unreadCount when chat grows while closed (mobile)', async () => {
    mockChat = [{ id: 1 }, { id: 2 }]

    const { result, rerender } = renderHook(() => useMobileChatUI(true))

    await waitFor(() => {
      expect(result.current.isChatOpen).toBe(false)
      expect(result.current.unreadCount).toBe(2)
    })

    mockChat = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
    rerender()

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(4)
    })
  })

  it('resets unreadCount when chat opens', async () => {
    mockChat = [{ id: 1 }, { id: 2 }]

    const { result, rerender } = renderHook(() => useMobileChatUI(true))

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(2)
    })

    act(() => {
      result.current.setIsChatOpen(true)
    })
    rerender()

    await waitFor(() => {
      expect(result.current.isChatOpen).toBe(true)
      expect(result.current.unreadCount).toBe(0)
    })
  })
})

