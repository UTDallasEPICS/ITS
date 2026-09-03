// @vitest-environment nuxt
//
// A component test for the application shell (app/app.vue). It renders the real
// component in the Nuxt environment, stubs out page routing, and proves the two
// always-present pieces of the shell work: the brand link points home, and the
// theme toggle is reachable by assistive technology.
//
// This test never opens the database, reads an env file, sends email, or makes a
// network request. Those integrations are intentionally out of scope for the
// baseline (see docs/testing.md).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import App from '../../app/app.vue'

describe('application shell (app.vue)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Arrange: watch the global fetch so each test can prove the shell renders
    // without reaching the network. spyOn keeps the original implementation, so
    // a real request would still be recorded (and fail the assertion below).
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('links the brand to the home route', async () => {
    // Act: mount the shell, stubbing <NuxtPage /> so no page/route is loaded.
    const wrapper = await mountSuspended(App, {
      global: { stubs: { NuxtPage: true } },
    })

    // Assert: the brand link shows "Nuxt Template" and targets "/".
    const brandLink = wrapper.get('a')
    expect(brandLink.text()).toContain('Nuxt Template')
    expect(brandLink.attributes('href')).toBe('/')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('exposes an accessible "Toggle Theme" control', async () => {
    // Act
    const wrapper = await mountSuspended(App, {
      global: { stubs: { NuxtPage: true } },
    })

    // Assert: the theme toggle is present and labelled for screen readers.
    const toggle = wrapper.find('[aria-label="Toggle Theme"]')
    expect(toggle.exists()).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
