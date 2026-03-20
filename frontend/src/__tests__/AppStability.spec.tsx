import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import App from '../App'

let mockState: any
const navigateMock = vi.fn()
const fetchCurrentUserMock = vi.fn()

vi.mock('../store', () => ({
  useAppStore: (selector: any) => selector(mockState),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

describe('App stability', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    fetchCurrentUserMock.mockClear()
  })

  it('renders loading UI when isInitializing=true', () => {
    mockState = {
      user: null,
      socket: null,
      isInitializing: true,
      fetchCurrentUser: fetchCurrentUserMock,
      theme: 'dark',
    }

    render(<App />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()

    return waitFor(() => {
      expect(fetchCurrentUserMock).toHaveBeenCalled()
    })
  })

  it('does not crash when isInitializing=false and user is null', async () => {
    mockState = {
      user: null,
      socket: null,
      isInitializing: false,
      fetchCurrentUser: fetchCurrentUserMock,
      theme: 'dark',
    }

    render(<App />)

    // Second effect should attempt navigation to /login when user is absent.
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login')
    })
  })
})

