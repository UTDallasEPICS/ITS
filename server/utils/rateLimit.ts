// In-memory sliding-window rate limiter with a cooldown (see ADR 006).
// Counts are per server instance and reset on restart.
const hits = new Map<string, number[]>()
const blockedUntil = new Map<string, number>()

export type RateLimitOptions = {
  max: number // requests allowed inside the window
  windowMs: number // window length in milliseconds
  cooldownMs: number // how long to block after going over the limit
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number }

export function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
  now = Date.now()
): RateLimitResult {
  // Still blocked from an earlier burst?
  const until = blockedUntil.get(key)
  if (until && now < until) {
    return { ok: false, retryAfter: Math.ceil((until - now) / 1000) }
  }

  // Keep only requests inside the window (sliding window), then add this one.
  const recent = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs)
  recent.push(now)
  hits.set(key, recent)

  if (recent.length > opts.max) {
    // With no cooldown, wait until the oldest request leaves the window.
    const waitMs = opts.cooldownMs > 0 ? opts.cooldownMs : opts.windowMs - (now - recent[0]!)
    blockedUntil.set(key, now + waitMs)
    return { ok: false, retryAfter: Math.ceil(waitMs / 1000) }
  }

  return { ok: true }
}

// Test helper: clear all counters between tests.
export function resetRateLimits() {
  hits.clear()
  blockedUntil.clear()
}
