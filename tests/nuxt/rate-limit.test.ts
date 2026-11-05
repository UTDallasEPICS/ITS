import { beforeEach, describe, expect, it } from 'vitest'
import { checkRateLimit, resetRateLimits } from '../../server/utils/rateLimit'

// 3 requests per 10 seconds, then a 5-minute cooldown (ADR 006).
const opts = { max: 3, windowMs: 10_000, cooldownMs: 300_000 }

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimits()
  })

  it('allows requests up to the limit', () => {
    expect(checkRateLimit('k', opts, 0).ok).toBe(true)
    expect(checkRateLimit('k', opts, 1_000).ok).toBe(true)
    expect(checkRateLimit('k', opts, 2_000).ok).toBe(true)
  })

  it('blocks the request over the limit and returns a retry time', () => {
    checkRateLimit('k', opts, 0)
    checkRateLimit('k', opts, 1_000)
    checkRateLimit('k', opts, 2_000)

    expect(checkRateLimit('k', opts, 3_000)).toEqual({ ok: false, retryAfter: 300 })
  })

  it('stays blocked during the cooldown, then allows again', () => {
    for (const t of [0, 1_000, 2_000, 3_000]) checkRateLimit('k', opts, t)

    // Still inside the 5-minute cooldown.
    expect(checkRateLimit('k', opts, 60_000).ok).toBe(false)
    // Cooldown is over.
    expect(checkRateLimit('k', opts, 3_000 + 300_000).ok).toBe(true)
  })

  it('forgets requests older than the window (sliding window)', () => {
    checkRateLimit('k', opts, 0)
    checkRateLimit('k', opts, 1_000)
    checkRateLimit('k', opts, 2_000)

    // 11 seconds later the first request has left the 10-second window.
    expect(checkRateLimit('k', opts, 11_000).ok).toBe(true)
  })

  it('counts each key separately', () => {
    for (const t of [0, 1_000, 2_000, 3_000]) checkRateLimit('a', opts, t)

    expect(checkRateLimit('a', opts, 4_000).ok).toBe(false)
    expect(checkRateLimit('b', opts, 4_000).ok).toBe(true)
  })
})
