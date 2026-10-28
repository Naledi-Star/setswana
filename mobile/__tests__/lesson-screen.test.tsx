import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '../src/api/client'
import { LessonScreen } from '../src/screens/lesson/LessonScreen'

jest.mock('react-native-safe-area-context', () => {
  const ReactLib = require('react')
  const { View } = require('react-native')
  const Wrapper = ({ children }: { children?: React.ReactNode }) =>
    ReactLib.createElement(View, null, children)
  return {
    SafeAreaView: Wrapper,
    SafeAreaProvider: Wrapper,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})

// Native modules are unavailable in the jest environment.
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ seekTo: jest.fn(), play: jest.fn(), pause: jest.fn(), replace: jest.fn() }),
  useAudioPlayerStatus: () => ({ playing: false }),
  useAudioRecorder: () => ({}),
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
}))

jest.mock('../src/lib/haptics', () => ({
  haptics: { light: jest.fn(), medium: jest.fn(), success: jest.fn(), warning: jest.fn() },
}))

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ applyStats: jest.fn() }),
}))

jest.mock('../src/api/client', () => ({
  api: {
    lesson: jest.fn(),
    startLesson: jest.fn(),
    answer: jest.fn(),
    completeAttempt: jest.fn(),
    abandonAttempt: jest.fn(),
  },
  ApiError: class ApiError extends Error {},
  mediaUrl: (url: string | null) => url,
}))

// Match-the-pairs with five pairs is the tallest exercise in lesson 1.
const lessonResponse = {
  id: 'lesson-1',
  slug: 'basic-greetings-section-1',
  title: 'Basic Greetings (Singular)',
  subtitle: 'Dumela, Rra and Mma — greeting one person',
  xpBonus: 10,
  guide: null,
  unit: { id: 'unit-1', title: 'Basic Greetings and Expressions', colour: 'blue' },
  exercises: [
    {
      id: 'ex-1',
      slug: 's1-match-titles',
      type: 'MATCH_PAIRS',
      prompt: {
        pairs: [
          { id: 'p1', setswana: 'Dumela', english: 'Hello (to one person)' },
          { id: 'p2', setswana: 'Rra', english: 'Sir' },
          { id: 'p3', setswana: 'Mma', english: 'Madam / Mrs' },
          { id: 'p4', setswana: 'Dumela Rra', english: 'Hello Sir' },
          { id: 'p5', setswana: 'Dumela Mma', english: 'Hello Madam' },
        ],
      },
      xp: 10,
      audioUrl: null,
      position: 0,
    },
  ],
}

const attemptResponse = {
  attemptId: 'attempt-1',
  hearts: { remaining: 3, max: 5 },
}

describe('lesson screen', () => {
  it('scrolls when the exercise is taller than the screen', async () => {
    ;(api.lesson as jest.Mock).mockResolvedValue(lessonResponse)
    ;(api.startLesson as jest.Mock).mockResolvedValue(attemptResponse)

    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const view = await render(
      <QueryClientProvider client={client}>
        <LessonScreen lessonId="lesson-1" onExit={() => undefined} onComplete={() => undefined} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Question 1 of 1')).toBeTruthy()
    // Tall exercises must be reachable: the body scrolls behind the fixed footer.
    expect(JSON.stringify(view.toJSON())).toContain('ScrollView')
    // The feedback footer with Continue stays pinned below the scroll area.
    expect(screen.getByText('Answer to continue')).toBeTruthy()
  })
})
