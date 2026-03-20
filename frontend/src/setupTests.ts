import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom doesn't always provide Audio; mock it to keep notification store tests stable.
if (!('Audio' in globalThis)) {
  ;(globalThis as any).Audio = function AudioMock() {
    return {
      volume: 1,
      play: vi.fn().mockResolvedValue(undefined),
    }
  }
}

