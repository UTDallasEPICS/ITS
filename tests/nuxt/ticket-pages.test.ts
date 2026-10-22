// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import { USelect } from '#components'
import TicketIndex from '../../app/pages/tickets/index.vue'
import TicketDetailPage from '../../app/pages/tickets/[id].vue'
import type { TicketDetail, TicketSummary } from '../../app/types/ticket'

const { useFetchMock, saveMock } = vi.hoisted(() => ({ useFetchMock: vi.fn(), saveMock: vi.fn() }))
mockNuxtImport('useFetch', () => useFetchMock)
mockNuxtImport('$fetch', () => saveMock)
mockNuxtImport('useRoute', () => () => ({ params: { id: '1' } }))
vi.mock('../../app/utils/auth-client', async () => {
  const { ref } = await import('vue')
  return {
    authClient: {
      useSession: vi.fn(async () => ({ data: ref({ user: { id: 'test-partner' } }) })),
    },
  }
})

const first: TicketSummary = {
  id: 1,
  title: 'Broken form',
  projectId: 7,
  projectName: 'Community Website',
  status: 'open',
  timestamp: '2026-10-18T12:00:00.000Z',
}
const second: TicketSummary = {
  ...first,
  id: 2,
  title: 'Broken link',
  projectId: 8,
  projectName: 'Volunteer Portal',
  status: 'resolved',
}
const detail: TicketDetail = {
  ...first,
  description: 'Clicking Send does nothing.',
  userId: 'test-partner',
  submitterName: 'Test Partner',
  githubIssueId: null,
  githubIssueUrl: null,
  canEdit: true,
}
let wrapper: VueWrapper
const status = ref('success')
const error = ref<{ statusCode: number } | null>(null)
const refresh = vi.fn()

beforeEach(() => {
  useFetchMock.mockReset()
  saveMock.mockReset().mockResolvedValue({ ...detail, title: 'Updated title' })
  refresh.mockReset()
  status.value = 'success'
  error.value = null
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request'))
})
afterEach(() => {
  wrapper?.unmount()
  expect(globalThis.fetch).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})
function button(label: string) {
  return wrapper.findAll('button').find((item) => item.text() === label)!
}
async function mountList(rows: TicketSummary[] = [first, second]) {
  const data = ref(rows)
  useFetchMock.mockReturnValue({ data, status, error, refresh })
  wrapper = await mountSuspended(TicketIndex, { global: { stubs: { UIcon: true } } })
  return data
}
async function mountDetail() {
  const data = ref({ ...detail })
  useFetchMock.mockReturnValue({ data, status, error, refresh })
  wrapper = await mountSuspended(TicketDetailPage, { global: { stubs: { UIcon: true } } })
  return data
}

describe('ticket list page', () => {
  it('loads the shared endpoint and links titles to details with project/status/date', async () => {
    await mountList()
    expect(useFetchMock.mock.calls[0]?.[0]).toBe('/api/tickets')
    expect(wrapper.get('a[href="/tickets/1"]').text()).toContain('Broken form')
    expect(wrapper.text()).toContain('Community Website')
    expect(wrapper.text()).toContain('open')
    expect(wrapper.text()).toContain('Created (UTC)')
  })
  it('combines project/status filters, explains no matches, and clears filters', async () => {
    await mountList()
    const selects = wrapper.findAllComponents(USelect)
    await selects[0]!.setValue('7')
    expect(wrapper.find('a[href="/tickets/2"]').exists()).toBe(false)
    await selects[1]!.setValue('resolved')
    expect(wrapper.text()).toContain('No tickets match these filters.')
    await button('Clear filters').trigger('click')
    expect(wrapper.find('a[href="/tickets/1"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/tickets/2"]').exists()).toBe(true)
  })
  it('refreshes and displays updated status, including unfamiliar statuses', async () => {
    const data = await mountList()
    refresh.mockImplementation(() => {
      data.value = [{ ...first, status: 'awaiting_partner' }]
    })
    await button('Refresh').trigger('click')
    expect(refresh).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('awaiting_partner')
  })
  it('handles empty, loading and error states without displaying stale tickets', async () => {
    const data = await mountList([])
    expect(wrapper.text()).toContain('No tickets yet.')
    data.value = [first]
    status.value = 'pending'
    await flushPromises()
    expect(wrapper.text()).toContain('Loading tickets')
    expect(wrapper.find('table').exists()).toBe(false)
    status.value = 'error'
    error.value = { statusCode: 500 }
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('We could not load tickets')
    expect(wrapper.find('table').exists()).toBe(false)
    await button('Try again').trigger('click')
    expect(refresh).toHaveBeenCalledOnce()
    error.value = { statusCode: 401 }
    await flushPromises()
    expect(wrapper.get('a[href="/auth"]').text()).toBe('Sign in')
  })
})

describe('ticket detail page', () => {
  it('shows full content, author, timestamp and missing GitHub link', async () => {
    await mountDetail()
    expect(useFetchMock.mock.calls[0]?.[0]()).toBe('/api/tickets/1')
    expect(wrapper.get('h1').text()).toBe('Broken form')
    expect(wrapper.text()).toContain('Clicking Send does nothing.')
    expect(wrapper.text()).toContain('Test Partner')
    expect(wrapper.text()).toContain('Not linked yet')
    expect(wrapper.get('a[href="/tickets"]').text()).toBe('Back to tickets')
  })
  it('handles loading, not found and account-denied states', async () => {
    await mountDetail()
    status.value = 'pending'
    await flushPromises()
    expect(wrapper.text()).toContain('Loading ticket')
    expect(wrapper.find('h1').exists()).toBe(false)
    status.value = 'error'
    error.value = { statusCode: 404 }
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Ticket not found')
    expect(wrapper.find('h1').exists()).toBe(false)
    error.value = { statusCode: 403 }
    await flushPromises()
    expect(wrapper.text()).toContain('Your account access is unavailable')
  })
  it('refreshes status and hides editing when the server withdraws permission', async () => {
    const data = await mountDetail()
    refresh.mockImplementation(() => {
      data.value = { ...detail, status: 'resolved', canEdit: false }
    })
    await button('Refresh').trigger('click')
    expect(wrapper.text()).toContain('resolved')
    expect(button('Edit ticket')).toBeUndefined()
  })
  it('validates and saves only title/description, then displays the result', async () => {
    await mountDetail()
    await button('Edit ticket').trigger('click')
    await wrapper.get('input').setValue(' ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(saveMock).not.toHaveBeenCalled()
    await wrapper.get('input').setValue('  Updated title  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(saveMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/1', {
      method: 'PATCH',
      body: { title: 'Updated title', description: detail.description },
    })
    expect(wrapper.get('h1').text()).toBe('Updated title')
    expect(wrapper.text()).toContain('Changes saved.')
    expect(wrapper.find('form').exists()).toBe(false)
  })
  it('retains the draft on failure and allows retry', async () => {
    await mountDetail()
    saveMock.mockRejectedValueOnce(new Error('Status changed'))
    await button('Edit ticket').trigger('click')
    await wrapper.get('input').setValue('Updated title')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Your draft is still here')
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('Updated title')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(saveMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Changes saved.')
  })
  it('disables duplicate saves and cancellation while saving', async () => {
    await mountDetail()
    let resolveSave!: (value: TicketDetail) => void
    saveMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve
      })
    )
    await button('Edit ticket').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(button('Saving…').attributes('disabled')).toBeDefined()
    expect(button('Cancel').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(saveMock).toHaveBeenCalledOnce()
    resolveSave(detail)
    await flushPromises()
  })
})
