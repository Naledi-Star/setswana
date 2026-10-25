import { Platform } from 'react-native'
import { storage } from './storage'

export type DeviceInfo = {
  deviceId: string
  platform: 'ios' | 'android'
  timezone: string
}

function generateDeviceId(): string {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function devicePlatform(): 'ios' | 'android' {
  return Platform.OS === 'ios' ? 'ios' : 'android'
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Gaborone'
  } catch {
    return 'Africa/Gaborone'
  }
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  const existing = await storage.getDeviceId()
  const deviceId = existing ?? generateDeviceId()
  if (!existing) await storage.setDeviceId(deviceId)

  return { deviceId, platform: devicePlatform(), timezone: deviceTimezone() }
}
