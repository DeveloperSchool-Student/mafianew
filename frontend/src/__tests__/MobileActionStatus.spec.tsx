import { render, screen } from '@testing-library/react'
import { MobileActionStatus } from '../components/MobileActionStatus'

describe('MobileActionStatus', () => {
  it('shows voting feedback when user already voted (DAY_VOTING)', () => {
    render(
      <MobileActionStatus
        phase="DAY_VOTING"
        hasVoted={true}
        votedTargetName="Bob"
        hasActedNight={false}
      />,
    )

    expect(
      screen.getByText(/Ви вже проголосували за Bob/i),
    ).toBeInTheDocument()
  })

  it('shows journalist compare prompt (0/1/2 targets)', () => {
    const { rerender } = render(
      <MobileActionStatus
        phase="NIGHT"
        role="JOURNALIST"
        hasVoted={false}
        hasActedNight={false}
        journalistSelectedCount={0}
      />,
    )

    expect(
      screen.getByText(/Оберіть 2 цілі для порівняння/i),
    ).toBeInTheDocument()

    rerender(
      <MobileActionStatus
        phase="NIGHT"
        role="JOURNALIST"
        hasVoted={false}
        hasActedNight={false}
        journalistSelectedCount={1}
      />,
    )
    expect(
      screen.getByText(/Обрано 1\/2 — оберіть другу ціль/i),
    ).toBeInTheDocument()

    rerender(
      <MobileActionStatus
        phase="NIGHT"
        role="JOURNALIST"
        hasVoted={false}
        hasActedNight={false}
        journalistSelectedCount={2}
      />,
    )
    expect(screen.getByText(/Обрано 2\/2 ✓/i)).toBeInTheDocument()
  })
})

