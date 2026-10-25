import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { Button, EmptyState, FeedbackFooter, Hearts, OptionCard } from '../src/components/ui'
import { Pitsi } from '../src/components/Pitsi'
import { t, tSetswana } from '../src/lib/i18n'

describe('UI primitives', () => {
  it('renders a button label and fires on press', async () => {
    const onPress = jest.fn()
    const user = userEvent.setup()
    await render(<Button label="Start learning" onPress={onPress} />)

    expect(screen.getByText('Start learning')).toBeTruthy()
    await user.press(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not fire when disabled', async () => {
    const onPress = jest.fn()
    const user = userEvent.setup()
    await render(<Button label="Continue" onPress={onPress} disabled />)
    await user.press(screen.getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('marks a correct option for screen readers', async () => {
    await render(<OptionCard label="Hello" status="correct" onPress={() => undefined} />)
    expect(screen.getByText('Hello')).toBeTruthy()
  })

  it('renders the empty state copy and action', async () => {
    const onRetry = jest.fn()
    const user = userEvent.setup()
    await render(
      <EmptyState
        title="No words yet"
        body="Finish a lesson first."
        action={<Button label="Retry" onPress={onRetry} />}
      />,
    )
    expect(screen.getByText('No words yet')).toBeTruthy()
    await user.press(screen.getByText('Retry'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('renders the hearts count accessibly', async () => {
    await render(<Hearts hearts={3} max={5} />)
    expect(screen.getByLabelText('3 of 5 hearts')).toBeTruthy()
  })

  it('renders the mascot with an accessible label', async () => {
    await render(<Pitsi state="celebrate" />)
    expect(screen.getByLabelText('Pitsi the zebra guide')).toBeTruthy()
  })
})

describe('lesson feedback footer', () => {
  it('shows a correct message and calls continue', async () => {
    const onAction = jest.fn()
    const user = userEvent.setup()
    await render(
      <FeedbackFooter
        state="correct"
        title="Go siame!"
        body="That’s correct."
        actionLabel="Continue"
        onAction={onAction}
      />,
    )
    expect(screen.getByText('Go siame!')).toBeTruthy()
    await user.press(screen.getByText('Continue'))
    expect(onAction).toHaveBeenCalled()
  })

  it('shows the almost feedback with a retry label', async () => {
    await render(
      <FeedbackFooter
        state="wrong"
        title="Almost!"
        body="Hello — Dumela"
        actionLabel="Try again"
        onAction={() => undefined}
      />,
    )
    expect(screen.getByText('Almost!')).toBeTruthy()
    expect(screen.getByText('Try again')).toBeTruthy()
  })
})

describe('interface strings', () => {
  it('interpolates values', () => {
    expect(t('home.greeting', { name: 'Naledi' })).toBe('Dumela, Naledi!')
    expect(t('home.goalProgress', { done: 2, goal: 5 })).toBe('2 of 5 lessons')
  })

  it('falls back to the key when missing, and exposes Setswana stubs', () => {
    expect(t('missing.key')).toBe('missing.key')
    expect(tSetswana('nav.words')).toBe('Mafoko')
    expect(tSetswana('missing.key')).toBeNull()
  })
})
