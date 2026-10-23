// @vitest-environment nuxt
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ChatThread from '../../app/components/chat/ChatThread.vue'
import type { ChatAdapter, ChatMessagePage, ChatSubscriptionHandlers } from '../../app/types/chat'
import type { ChatWireMessage } from '../../shared/types/chat'

function wireMessage(id: number, plainTextBody = `message ${id}`, userId = 'a'): ChatWireMessage {
  return { id, threadId: 1, userId, plainTextBody, createdAt: '2026-10-23T12:00:00.000Z' }
}

function page(messages: ChatWireMessage[]): ChatMessagePage {
  return { messages, metadata: { hasMore: false } }
}

function createAdapter(overrides: Partial<ChatAdapter> = {}) {
  let handlers: ChatSubscriptionHandlers | undefined
  const unsubscribe = vi.fn()

  const adapter: ChatAdapter = {
    loadMessages: vi.fn(async () => page([wireMessage(1, 'Hello there')])),
    sendMessage: vi.fn(async (body: string) => wireMessage(2, body, 'b')),
    subscribe: vi.fn((next) => {
      handlers = next
      next.onStatusChange?.('live')
      return unsubscribe
    }),
    ...overrides,
  }

  return {
    adapter,
    unsubscribe,
    get handlers() {
      return handlers
    },
  }
}

let wrapper: Awaited<ReturnType<typeof mountSuspended<typeof ChatThread>>> | undefined
let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  expect(fetchSpy).not.toHaveBeenCalled()
  fetchSpy.mockRestore()
})

async function mountThread(adapter: ChatAdapter, props: Record<string, unknown> = {}) {
  wrapper = await mountSuspended(ChatThread, {
    props: { adapter, ...props },
  })
  await flushPromises()
  return wrapper
}

describe('ChatThread', () => {
  it('renders a loaded thread with author names and timestamps', async () => {
    const { adapter } = createAdapter()
    const mounted = await mountThread(adapter, {
      title: 'Community Website',
      authorNames: { a: 'Ada' },
      currentUserId: 'a',
    })

    expect(mounted.text()).toContain('Community Website')
    expect(mounted.get('[role="log"]').text()).toContain('Ada')
    expect(mounted.text()).toContain('Hello there')
    expect(mounted.text()).toContain('Live')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('shows a loading state until history resolves', async () => {
    let resolveLoad: (value: ChatMessagePage) => void = () => {}
    const pending = new Promise<ChatMessagePage>((resolve) => {
      resolveLoad = resolve
    })
    const { adapter } = createAdapter({ loadMessages: vi.fn(() => pending) })

    wrapper = await mountSuspended(ChatThread, { props: { adapter } })

    expect(wrapper.text()).toContain('Loading messages…')
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.disabled).toBe(true)

    resolveLoad(page([wireMessage(1, 'Loaded after all')]))
    await flushPromises()

    expect(wrapper.text()).toContain('Loaded after all')
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.disabled).toBe(false)
  })

  it('explains a failed load and retries without losing the shell', async () => {
    const loadMessages = vi
      .fn<ChatAdapter['loadMessages']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([wireMessage(1, 'Back online')]))
    const { adapter } = createAdapter({ loadMessages })

    const mounted = await mountThread(adapter)

    expect(mounted.get('[role="alert"]').text()).toContain('Unable to load messages')

    const retry = mounted.findAll('button').find((button) => button.text().includes('Try again'))
    expect(retry).toBeDefined()
    await retry?.trigger('click')
    await flushPromises()

    expect(mounted.text()).toContain('Back online')
  })

  it('invites the first message in an empty thread', async () => {
    const { adapter } = createAdapter({ loadMessages: vi.fn(async () => page([])) })
    const mounted = await mountThread(adapter)

    expect(mounted.text()).toContain('No messages yet. Say hello.')
  })

  it('sends a trimmed message and clears the composer', async () => {
    const { adapter } = createAdapter()
    const mounted = await mountThread(adapter)

    await mounted.get('textarea').setValue('  Can you share the link?  ')
    await mounted.get('form').trigger('submit')
    await flushPromises()

    expect(adapter.sendMessage).toHaveBeenCalledExactlyOnceWith('Can you share the link?')
    expect(mounted.text()).toContain('Can you share the link?')
    expect(mounted.get<HTMLTextAreaElement>('textarea').element.value).toBe('')
  })

  it('keeps the draft when sending fails', async () => {
    const sendMessage = vi.fn(async (): Promise<ChatWireMessage> => {
      throw new Error('network down')
    })
    const { adapter } = createAdapter({ sendMessage })
    const mounted = await mountThread(adapter)

    await mounted.get('textarea').setValue('Draft I do not want to lose')
    await mounted.get('form').trigger('submit')
    await flushPromises()

    expect(mounted.get('[role="alert"]').text()).toContain('Unable to send message')
    expect(mounted.get<HTMLTextAreaElement>('textarea').element.value).toBe(
      'Draft I do not want to lose'
    )
  })

  it('appends messages pushed by the live feed', async () => {
    const subscription = createAdapter()
    const mounted = await mountThread(subscription.adapter)

    subscription.handlers?.onMessage(wireMessage(2, 'Arrived over the socket', 'b'))
    await mounted.vm.$nextTick()

    expect(mounted.text()).toContain('Arrived over the socket')
  })

  it('reports connection changes to the reader', async () => {
    const subscription = createAdapter()
    const mounted = await mountThread(subscription.adapter)

    expect(mounted.text()).toContain('Live')

    subscription.handlers?.onStatusChange?.('reconnecting')
    await mounted.vm.$nextTick()
    expect(mounted.text()).toContain('Reconnecting…')

    subscription.handlers?.onStatusChange?.('offline')
    await mounted.vm.$nextTick()
    expect(mounted.text()).toContain('Live updates unavailable')
  })

  it('hides the live status when the adapter has no live feed', async () => {
    const { adapter } = createAdapter({ subscribe: undefined })
    const mounted = await mountThread(adapter)

    expect(mounted.text()).toContain('Hello there')
    expect(mounted.text()).not.toContain('Live updates unavailable')
    expect(mounted.text()).not.toContain('Live')
  })

  it('closes the feed when it unmounts', async () => {
    const { adapter, unsubscribe } = createAdapter()
    wrapper = await mountSuspended(ChatThread, { props: { adapter } })
    await flushPromises()

    wrapper.unmount()
    wrapper = undefined

    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})

describe('ChatThread isolation', () => {
  // Read from the repo root: the Nuxt test environment does not hand back a
  // file:// URL from import.meta.url.
  const sources = {
    component: readFileSync('app/components/chat/ChatThread.vue', 'utf8'),
    composable: readFileSync('app/composables/useChatThread.ts', 'utf8'),
  }

  it.each(Object.entries(sources))(
    'keeps ITS-only auth and routing code out of %s',
    (_name, source) => {
      for (const forbidden of [
        'better-auth',
        'auth-client',
        'definePageMeta',
        'navigateTo',
        'useRoute',
        'middleware',
      ]) {
        expect(source).not.toContain(forbidden)
      }
    }
  )
})
