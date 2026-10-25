import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { api } from '../api/client'
import { getDeviceInfo } from './device'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

function projectId(): string | null {
  const expoConfig = Constants.expoConfig as
    | (typeof Constants.expoConfig & { extra?: { eas?: { projectId?: string } } })
    | null
  return (
    expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    null
  )
}

/**
 * Requests permission and registers the Expo push token with the API.
 * Returns false (without throwing) when notifications are not configured,
 * which is the normal state in local development.
 */
export async function enablePushNotifications(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync()
    let granted = existing.granted
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync()
      granted = requested.granted
    }
    if (!granted) return false

    const project = projectId()
    if (!project) return false

    const token = await Notifications.getExpoPushTokenAsync({ projectId: project })
    const device = await getDeviceInfo()
    await api.registerDevice({
      expoPushToken: token.data,
      platform: device.platform,
      deviceId: device.deviceId,
    })
    return true
  } catch {
    return false
  }
}

export async function hasPushPermission(): Promise<boolean> {
  try {
    const permissions = await Notifications.getPermissionsAsync()
    return permissions.granted
  } catch {
    return false
  }
}
