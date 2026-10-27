import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '../src/api/client'
import { WelcomeScreen } from '../src/screens/auth/AuthScreens'

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

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ continueAsGuest: jest.fn().mockResolvedValue(undefined) }),
}))

jest.mock('../src/api/client', () => ({
  api: { config: jest.fn() },
  ApiError: class ApiError extends Error {},
}))

jest.mock('../src/screens/auth/GoogleButton', () => ({
  googleConfigured: false,
  GoogleButton: () => null,
}))

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('Welcome screen', () => {
  it(
    'renders the brand logo and every welcome action',
    async () => {
      ;(api.config as jest.Mock).mockResolvedValue({
        features: { guestPlay: true, googleSignIn: false, pushEnabled: false, emailDelivery: false },
      })

      await renderWithQuery(<WelcomeScreen navigation={{ navigate: jest.fn() }} />)

      expect(await screen.findByText('Puo')).toBeTruthy()
      expect(screen.getByText('Get started')).toBeTruthy()
      expect(screen.getByText('I already have an account')).toBeTruthy()
      expect(await screen.findByText('Try a lesson first')).toBeTruthy()
      expect(screen.getByText('Dumela!')).toBeTruthy()
    },
    30_000,
  )

  it(
    'keeps Try a lesson first visible while config is still loading',
    async () => {
      ;(api.config as jest.Mock).mockReturnValue(new Promise(() => undefined))

      await renderWithQuery(<WelcomeScreen navigation={{ navigate: jest.fn() }} />)

      expect(await screen.findByText('Try a lesson first')).toBeTruthy()
    },
    30_000,
  )
})