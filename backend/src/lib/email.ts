import { env } from '../config/env.js'
import { logger } from './logger.js'

export type EmailMessage = {
  to: string
  subject: string
  text: string
}

/**
 * Email delivery is deliberately unimplemented in v1: no provider exists yet.
 * The interface keeps the call sites honest so enabling a provider later does
 * not require changing the auth flows.
 */
export interface EmailTransport {
  readonly enabled: boolean
  send(message: EmailMessage): Promise<void>
}

class ConsoleTransport implements EmailTransport {
  readonly enabled = true

  async send(message: EmailMessage): Promise<void> {
    logger.info(
      { to: message.to, subject: message.subject, body: message.text },
      'email_console_transport',
    )
  }
}

class DisabledTransport implements EmailTransport {
  readonly enabled = false

  async send(message: EmailMessage): Promise<void> {
    logger.warn({ to: message.to, subject: message.subject }, 'email_delivery_disabled')
  }
}

export const emailTransport: EmailTransport =
  env.EMAIL_TRANSPORT === 'console' ? new ConsoleTransport() : new DisabledTransport()

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${env.PUBLIC_API_URL}/reset-password?token=${encodeURIComponent(token)}`
  await emailTransport.send({
    to,
    subject: 'Reset your Puo password',
    text: `Open this link within 30 minutes to choose a new password:\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
  })
}
