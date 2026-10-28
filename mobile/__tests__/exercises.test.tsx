import React from 'react'
import { Linking, Text } from 'react-native'
import { render, screen, userEvent } from '@testing-library/react-native'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'
import { requestRecordingPermissionsAsync } from 'expo-audio'
import { FillBlankExercise, SpeakExercise, TypeAnswerExercise } from '../src/screens/lesson/Exercises'
import { Screen } from '../src/components/ui'
import type { ExerciseDto } from '../src/api/types'

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

// The renderers pull in the recorder through the speak exercise module.
const mockRecorder = {
  prepareToRecordAsync: jest.fn(),
  record: jest.fn(),
  stop: jest.fn(),
  uri: null,
}

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ seekTo: jest.fn(), play: jest.fn(), pause: jest.fn(), replace: jest.fn() }),
  useAudioPlayerStatus: () => ({ playing: false }),
  useAudioRecorder: () => mockRecorder,
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(),
}))

const requestPermission = requestRecordingPermissionsAsync as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  requestPermission.mockResolvedValue({ granted: true, canAskAgain: true })
})

function exercise(overrides: Partial<ExerciseDto>): ExerciseDto {
  return {
    id: 'ex-1',
    slug: 'ex',
    type: 'FILL_BLANK',
    prompt: {},
    xp: 10,
    audioUrl: null,
    position: 0,
    ...overrides,
  } as ExerciseDto
}

describe('fill in the blank', () => {
  it('shows the whole sentence with one whole-word blank', async () => {
    await render(
      <FillBlankExercise
        exercise={exercise({
          prompt: {
            sentence: 'Dumela ___',
            translationHint: 'Hello Madam',
            wordBank: ['Mma', 'Rra'],
          },
        })}
        disabled={false}
        onAnswer={() => undefined}
      />,
    )

    // The sentence must read "Dumela _____", not the first/last letters around the blank.
    expect(screen.getByText('Dumela _____')).toBeTruthy()
    expect(screen.getByText('Hello Madam')).toBeTruthy()
  })

  it('keeps the words around a mid-sentence blank', async () => {
    await render(
      <FillBlankExercise
        exercise={exercise({
          prompt: { sentence: 'Dumelang ___ le BoRra', wordBank: ['BoMma'] },
        })}
        disabled={false}
        onAnswer={() => undefined}
      />,
    )

    expect(screen.getByText('Dumelang _____ le BoRra')).toBeTruthy()
  })
})

describe('type the answer', () => {
  it('asks an explicit question with the phrase to translate', async () => {
    await render(
      <TypeAnswerExercise
        exercise={exercise({
          type: 'TYPE_ANSWER',
          prompt: { direction: 'en-tn', sourceText: 'Hello Madam' },
        })}
        disabled={false}
        onAnswer={() => undefined}
      />,
    )

    expect(screen.getByText('How do you say “Hello Madam” in Setswana?')).toBeTruthy()
  })

  it('asks in the other direction too', async () => {
    await render(
      <TypeAnswerExercise
        exercise={exercise({
          type: 'TYPE_ANSWER',
          prompt: { direction: 'tn-en', sourceText: 'Ke teng' },
        })}
        disabled={false}
        onAnswer={() => undefined}
      />,
    )

    expect(screen.getByText('What does “Ke teng” mean in English?')).toBeTruthy()
  })
})

describe('say it out loud', () => {
  it('asks for the microphone again when the device still allows the dialog', async () => {
    requestPermission
      .mockResolvedValueOnce({ granted: false, canAskAgain: true })
      .mockResolvedValueOnce({ granted: true, canAskAgain: true })
    const user = userEvent.setup()
    await render(
      <SpeakExercise
        exercise={exercise({ type: 'SPEAK', prompt: { phrase: 'Dumela Rra' } })}
        disabled={false}
        onAnswer={() => undefined}
      />,
    )

    await user.press(screen.getByText('Record'))
    // The first attempt was declined; the screen offers to trigger the dialog again.
    expect(await screen.findByText('Allow microphone')).toBeTruthy()

    await user.press(screen.getByText('Allow microphone'))
    expect(mockRecorder.record).toHaveBeenCalled()
  })

  it('offers device settings when the OS will not show the dialog again', async () => {
    requestPermission.mockResolvedValue({ granted: false, canAskAgain: false })
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    const user = userEvent.setup()
    await render(
      <SpeakExercise
        exercise={exercise({ type: 'SPEAK', prompt: { phrase: 'Dumela Rra' } })}
        disabled={false}
        onAnswer={() => undefined}
      />,
    )

    await user.press(screen.getByText('Record'))
    expect(await screen.findByText('Open settings')).toBeTruthy()

    await user.press(screen.getByText('Open settings'))
    expect(openSettings).toHaveBeenCalled()
  })
})

describe('screen footer', () => {
  it('lifts the footer above the absolute tab bar', async () => {
    await render(
      <BottomTabBarHeightContext.Provider value={68}>
        <Screen scroll={false} footer={<Text>Continue</Text>}>
          <></>
        </Screen>
      </BottomTabBarHeightContext.Provider>,
    )

    const footerText = await screen.findByText('Continue')
    const wrapper = footerText.parent as unknown as { props: { style: { marginBottom: number } } }
    expect(wrapper.props.style.marginBottom).toBe(68)
  })
})
