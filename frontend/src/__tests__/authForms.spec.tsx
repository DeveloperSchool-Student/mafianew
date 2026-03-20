import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { Login } from '../pages/Login'
import { ResetPassword } from '../pages/ResetPassword'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const setUserMock = vi.fn()
const navigateMock = vi.fn()

vi.mock('../store', () => ({
  useAppStore: (selector: any) =>
    selector({
      setUser: setUserMock,
    }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../utils/fingerprint', () => ({
  getFingerprint: vi.fn().mockResolvedValue('fp'),
}))

const loginMock = vi.fn()
const registerMock = vi.fn()
const authenticate2FAMock = vi.fn()

vi.mock('../services/usersApi', () => ({
  login: (...args: any[]) => loginMock(...args),
  register: (...args: any[]) => registerMock(...args),
  authenticate2FA: (...args: any[]) => authenticate2FAMock(...args),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

describe('Frontend auth forms', () => {
  beforeEach(() => {
    setUserMock.mockClear()
    navigateMock.mockClear()
    loginMock.mockReset()
    registerMock.mockReset()
    authenticate2FAMock.mockReset()
  })

  it('registration requires acceptedTerms', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    // Switch to register mode
    fireEvent.click(screen.getByText('login.register'))

    await waitFor(() => {
      expect(screen.getAllByText('login.register').length).toBeGreaterThan(0)
    })

    // Submit without checkbox
    fireEvent.click(screen.getByRole('button', { name: 'login.register' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Ви повинні погодитися з Політикою Конфіденційності для реєстрації.',
        ),
      ).toBeInTheDocument()
    })
  })

  it('login shows API error message when credentials are invalid', async () => {
    loginMock.mockRejectedValue({
      response: { data: { message: 'Bad creds' } },
    })

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('Login...'), {
      target: { value: 'alice' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'pw' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'login.submit' }))

    await waitFor(() => {
      expect(screen.getByText('Bad creds')).toBeInTheDocument()
    })
  })

  it('reset password shows error when token is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(
        screen.getByText('Токен відсутній у посиланні. Будь ласка, перевірте ваше посилання.'),
      ).toBeInTheDocument()
    })
  })

  it('reset password shows error when passwords do not match', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=good']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>,
    )

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')

    fireEvent.change(passwordInputs[0], {
      target: { value: '123456' },
    })
    fireEvent.change(passwordInputs[1], {
      target: { value: '654321' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Змінити пароль' }))

    await waitFor(() => {
      expect(screen.getByText('Паролі не співпадають!')).toBeInTheDocument()
    })
  })
})

