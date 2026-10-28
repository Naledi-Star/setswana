import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '../src/api/client'
import { LessonsScreen } from '../src/screens/lessons/LessonsScreen'
import { LessonGuideScreen } from '../src/screens/lessons/LessonGuideScreen'

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}))

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

jest.mock('../src/api/client', () => ({
  api: { path: jest.fn(), lesson: jest.fn() },
  ApiError: class ApiError extends Error {},
  mediaUrl: (url: string | null) => url,
}))

// expo-audio needs a native player; guide rows only need the speaker button to mount.
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ seekTo: jest.fn(), play: jest.fn(), pause: jest.fn() }),
  useAudioPlayerStatus: () => ({ playing: false }),
  useAudioRecorder: () => ({}),
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: async () => ({ granted: false }),
}))

const pathResponse = {
  continueLessonId: 'lesson-1',
  units: [
    {
      id: 'unit-1',
      slug: 'basic-greetings',
      title: 'Basic Greetings and Expressions',
      titleEn: 'Basic Greetings and Expressions',
      description: null,
      colour: 'blue',
      state: 'active' as const,
      lessons: [
        {
          id: 'lesson-1',
          slug: 'basic-greetings-section-1',
          title: 'Basic Greetings (Singular)',
          subtitle: 'Dumela, Rra and Mma — greeting one person',
          xp: 10,
          exerciseCount: 6,
          state: 'active' as const,
        },
      ],
    },
  ],
}

const lessonResponse = {
  id: 'lesson-1',
  slug: 'basic-greetings-section-1',
  title: 'Basic Greetings (Singular)',
  subtitle: 'Dumela, Rra and Mma — greeting one person',
  xpBonus: 10,
  guide: {
    sections: [
      {
        heading: '1. Basic Greetings (Singular)',
        rows: [
          {
            setswana: 'Dumela',
            pronunciation: 'doo-meh-lah',
            english: 'Hello (to one person)',
            sample: 'Dumela!',
            audioUrl: '/media/dumela.m4a',
          },
          {
            setswana: 'Rra',
            pronunciation: 'rrah',
            english: 'Sir',
            sample: 'Dumela Rra',
            audioUrl: null,
          },
        ],
      },
    ],
    tips: { heading: 'Cultural Context Tips', items: ['Respect is key when speaking to elders.'] },
  },
  unit: { id: 'unit-1', title: 'Basic Greetings and Expressions', colour: 'blue' },
  exercises: [
    { id: 'ex-1', slug: 's1-listen-dumela', type: 'LISTEN_CHOOSE', prompt: {}, xp: 10, audioUrl: '/media/dumela.m4a', position: 0 },
  ],
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('Lessons tab', () => {
  // The first render of a screen warms the asset transformer, which is slow on a cold cache.
  it(
    'lists the lessons by number',
    async () => {
      ;(api.path as jest.Mock).mockResolvedValue(pathResponse)

      await renderWithQuery(<LessonsScreen />)

      expect(await screen.findByText('Lesson 1')).toBeTruthy()
      expect(screen.getByText('Dumela, Rra and Mma — greeting one person')).toBeTruthy()
      expect(screen.getByText('6 exercises')).toBeTruthy()
    },
    30_000,
  )

  it(
    'renders the lesson guide rows, samples and cultural tips',
    async () => {
      ;(api.lesson as jest.Mock).mockResolvedValue(lessonResponse)

      await renderWithQuery(
        <LessonGuideScreen
          route={{ key: 'k', name: 'LessonGuide', params: { lessonId: 'lesson-1' } } as never}
          navigation={{ navigate: jest.fn(), goBack: jest.fn() } as never}
        />,
      )

      expect(await screen.findByText('1. Basic Greetings (Singular)')).toBeTruthy()
      expect(screen.getByText('Dumela')).toBeTruthy()
      expect(screen.getByText('doo-meh-lah')).toBeTruthy()
      expect(screen.getByText('Hello (to one person)')).toBeTruthy()
      expect(screen.getByText('Say it: Dumela!')).toBeTruthy()
      expect(screen.getByText('Cultural Context Tips')).toBeTruthy()
      expect(screen.getByText('Respect is key when speaking to elders.')).toBeTruthy()
      // A row with a recording gets a speaker button; a row still awaiting audio does not.
      expect(screen.getByLabelText('Hear Dumela')).toBeTruthy()
      expect(screen.queryByLabelText('Hear Rra')).toBeNull()
    },
    30_000,
  )
})
