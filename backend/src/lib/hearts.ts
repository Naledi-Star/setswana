export type HeartState = {
  hearts: number
  heartsUpdatedAt: Date
  nextRefillAt: Date | null
}

export function projectHearts(
  hearts: number,
  heartsUpdatedAt: Date,
  max: number,
  refillMinutes: number,
  now = new Date(),
): HeartState {
  const current = Math.max(0, Math.min(hearts, max))

  if (current >= max) {
    return { hearts: max, heartsUpdatedAt: now, nextRefillAt: null }
  }

  const intervalMs = refillMinutes * 60_000
  const elapsed = now.getTime() - heartsUpdatedAt.getTime()
  const gained = Math.floor(elapsed / intervalMs)

  if (gained <= 0) {
    return {
      hearts: current,
      heartsUpdatedAt,
      nextRefillAt: new Date(heartsUpdatedAt.getTime() + intervalMs),
    }
  }

  const next = Math.min(max, current + gained)
  const at = next >= max ? now : new Date(heartsUpdatedAt.getTime() + gained * intervalMs)

  return {
    hearts: next,
    heartsUpdatedAt: at,
    nextRefillAt: next >= max ? null : new Date(at.getTime() + intervalMs),
  }
}
