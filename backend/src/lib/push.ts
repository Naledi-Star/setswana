import { Expo, type ExpoPushMessage } from 'expo-server-sdk'
import { logger } from './logger.js'

const expo = new Expo()

export type PushPayload = {
  title: string
  body: string
  data?: Record<string, unknown>
}

export async function sendPush(tokens: string[], payload: PushPayload): Promise<void> {
  const valid = tokens.filter((token) => Expo.isExpoPushToken(token))
  if (!valid.length) return

  const messages: ExpoPushMessage[] = valid.map((to) => ({
    to,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }))

  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk)
      for (const receipt of receipts) {
        if (receipt.status === 'error') {
          logger.warn({ receipt }, 'push_delivery_error')
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'push_send_failed')
    }
  }
}
