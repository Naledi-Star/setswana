import * as SecureStore from 'expo-secure-store'

const REFRESH_KEY = 'puo.refreshToken'
const GUEST_KEY = 'puo.guestToken'
const DEVICE_KEY = 'puo.deviceId'
const ONBOARDING_PREFIX = 'puo.onboarding.'

async function safeGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

async function safeSet(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key)
    else await SecureStore.setItemAsync(key, value)
  } catch {
    // Storage failures should never break the app; the user simply signs in again.
  }
}

export const storage = {
  getRefreshToken: () => safeGet(REFRESH_KEY),
  setRefreshToken: (value: string | null) => safeSet(REFRESH_KEY, value),
  getGuestToken: () => safeGet(GUEST_KEY),
  setGuestToken: (value: string | null) => safeSet(GUEST_KEY, value),
  getDeviceId: () => safeGet(DEVICE_KEY),
  setDeviceId: (value: string) => safeSet(DEVICE_KEY, value),
  hasOnboarded: async (userId: string) => (await safeGet(`${ONBOARDING_PREFIX}${userId}`)) === 'true',
  markOnboarded: (userId: string) => safeSet(`${ONBOARDING_PREFIX}${userId}`, 'true'),
}
