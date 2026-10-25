const FALLBACK_TIMEZONE = 'Africa/Gaborone'

const SETSWANA_WEEKDAYS = ['Sontaga', 'Mosupologo', 'Labobedi', 'Laboraro', 'Labone', 'Labotlhano', 'Matlhatso']

const SETSWANA_MONTHS = [
  'Ferikgong',
  'Tlhakole',
  'Mopitlwe',
  'Moranang',
  'Motsheganong',
  'Seetebosigo',
  'Phukwi',
  'Phatwe',
  'Lwetse',
  'Diphalane',
  'Ngwanatsele',
  'Sedimonthole',
]

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function safeTimezone(timezone: string | null | undefined): string {
  return timezone && isValidTimezone(timezone) ? timezone : FALLBACK_TIMEZONE
}

/** Returns the calendar date (YYYY-MM-DD) for an instant in a given timezone. */
export function localDateString(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

export function dateOnly(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`)
}

export function todayIn(timezone: string, at = new Date()): string {
  return localDateString(at, timezone)
}

export function addDaysToDateString(dateString: string, days: number): string {
  const base = dateOnly(dateString)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

export function isYesterday(previous: string, today: string): boolean {
  return addDaysToDateString(previous, 1) === today
}

/** Human label for the home screen, e.g. "Labobedi, 14 Motsheganong". */
export function localTimeString(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimezone(timezone),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at)
}

export function learnerDateLabel(at: Date, timezone: string): string {
  const safe = safeTimezone(timezone)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safe,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(at)

  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970')
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '1')
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '1')

  const utc = new Date(Date.UTC(year, month - 1, day))
  const weekdayIndex = utc.getUTCDay()

  return `${SETSWANA_WEEKDAYS[weekdayIndex]}, ${day} ${SETSWANA_MONTHS[month - 1]}`
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function parseDurationToSeconds(value: string, fallbackSeconds: number): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim())
  if (!match) return fallbackSeconds
  const amount = Number(match[1])
  const unit = match[2]
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return amount * (multipliers[unit ?? 's'] ?? 1)
}
