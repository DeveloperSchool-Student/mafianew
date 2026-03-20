import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ReportModal } from '../components/ReportModal'

const addToastMock = vi.fn()
const onCloseMock = vi.fn()

const submitReportMock = vi.fn()

vi.mock('../store', () => ({
  useAppStore: () => ({
    user: {
      id: 'u1',
      username: 'alice',
      token: 'token123',
    },
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../store/toastStore', () => ({
  useToastStore: () => ({
    addToast: addToastMock,
  }),
}))

vi.mock('../services/adminApi', () => ({
  fetchMyReports: vi.fn().mockResolvedValue([]),
}))

vi.mock('../services/gameApi', () => ({
  submitReport: (...args: any[]) => submitReportMock(...args),
}))

describe('ReportModal', () => {
  beforeEach(() => {
    addToastMock.mockClear()
    submitReportMock.mockReset()
    onCloseMock.mockClear()
  })

  it('shows success toast on successful report submit', async () => {
    submitReportMock.mockResolvedValue({ success: true })

    render(<ReportModal isOpen={true} onClose={onCloseMock} recentPlayers={[]} />)

    // Wait for effect to populate category
    const categorySelect = await screen.findByRole('combobox')
    await waitFor(() => {
      expect(categorySelect).toHaveValue('report.cat_insult')
    })

    const targetInput = screen.getByPlaceholderText('report.enter_nick')
    fireEvent.change(targetInput, { target: { value: 'bob' } })

    const commentTextarea = screen.getByPlaceholderText('report.comment_placeholder')
    fireEvent.change(commentTextarea, { target: { value: 'spam here' } })

    fireEvent.click(screen.getByRole('button', { name: 'report.submit' }))

    await waitFor(() => {
      expect(submitReportMock).toHaveBeenCalled()
      expect(addToastMock).toHaveBeenCalledWith('success', '✅ common.success')
      expect(onCloseMock).toHaveBeenCalled()
    })

    expect(submitReportMock).toHaveBeenCalledWith('token123', expect.objectContaining({
      targetUsername: 'bob',
      reason: 'report.cat_insult: spam here',
    }))
  })

  it('shows error toast on failed report submit', async () => {
    submitReportMock.mockResolvedValue({ success: false, error: 'ERR_MSG' })

    render(<ReportModal isOpen={true} onClose={onCloseMock} recentPlayers={[]} />)

    const categorySelect = await screen.findByRole('combobox')
    await waitFor(() => {
      expect(categorySelect).toHaveValue('report.cat_insult')
    })

    const targetInput = screen.getByPlaceholderText('report.enter_nick')
    fireEvent.change(targetInput, { target: { value: 'bob' } })

    const commentTextarea = screen.getByPlaceholderText('report.comment_placeholder')
    fireEvent.change(commentTextarea, { target: { value: 'spam here' } })

    fireEvent.click(screen.getByRole('button', { name: 'report.submit' }))

    await waitFor(() => {
      expect(submitReportMock).toHaveBeenCalled()
      expect(addToastMock).toHaveBeenCalledWith('error', 'ERR_MSG')
    })
    expect(onCloseMock).not.toHaveBeenCalled()
  })
})

