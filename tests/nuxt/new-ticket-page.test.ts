// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { USelect } from '#components'
import NewTicketPage from '../../app/pages/tickets/new.vue'
import Dashboard from '../../app/pages/index.vue'
import TicketForm from '../../app/components/TicketForm.vue'

const { useFetchMock, submitMock } = vi.hoisted(() => ({
  useFetchMock: vi.fn(),
  submitMock: vi.fn(),
}))

mockNuxtImport('useFetch', () => useFetchMock)
mockNuxtImport('$fetch', () => submitMock)

// Route middleware may run during mounting. Keep that session lookup isolated
// from the page's mocked project request and from real authentication.
vi.mock('../../app/utils/auth-client', async () => {
  const { ref } = await import('vue')
  return {
    authClient: {
      useSession: vi.fn(async () => ({ data: ref({ user: { id: 'test-partner' } }) })),
      signOut: vi.fn(),
    },
  }
})

describe('new ticket page', () => {
  let wrapper: Awaited<ReturnType<typeof mountSuspended<typeof NewTicketPage>>>
  let projectState: {
    data: ReturnType<typeof ref<{ id: number; name: string }[]>>
    status: ReturnType<typeof ref<'idle' | 'pending' | 'success' | 'error'>>
    error: ReturnType<typeof ref<{ statusCode: number } | null>>
    refresh: ReturnType<typeof vi.fn>
  }

  beforeEach(async () => {
    projectState = {
      data: ref([{ id: 7, name: 'Community Website' }]),
      status: ref('success'),
      error: ref(null),
      refresh: vi.fn(),
    }
    useFetchMock.mockReset().mockReturnValue(projectState)
    submitMock.mockReset().mockResolvedValue({ id: 42, status: 'open' })
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request'))
    wrapper = await mountSuspended(NewTicketPage, {
      global: { stubs: { UIcon: true } },
    })
  })

  afterEach(() => {
    wrapper.unmount()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  async function fillForm() {
    await wrapper.getComponent(USelect).setValue(7)
    await wrapper.get('input').setValue('  Contact form is broken  ')
    await wrapper.get('textarea').setValue('  Clicking Send does nothing.  ')
  }

  async function submit() {
    await wrapper.get('form').trigger('submit')
    await flushPromises()
  }

  it('loads projects and passes them to the reusable form', () => {
    // Nuxt adds a generated cache key as another argument during compilation.
    expect(useFetchMock.mock.calls[0]?.[0]).toBe('/api/projects')
    expect(wrapper.getComponent(TicketForm).props('projects')).toEqual([
      { id: 7, name: 'Community Website' },
    ])
    expect(wrapper.get('h1').text()).toBe('New ticket')
  })

  it('shows a loading message until projects are available', async () => {
    projectState.status.value = 'pending'
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Loading your projects')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(submitMock).not.toHaveBeenCalled()
  })

  it('offers a retry after project loading fails', async () => {
    projectState.status.value = 'error'
    projectState.error.value = { statusCode: 500 }
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('We could not load your projects')
    expect(wrapper.find('form').exists()).toBe(false)
    const retry = wrapper.findAll('button').find((button) => button.text() === 'Try again')!
    await retry.trigger('click')
    expect(projectState.refresh).toHaveBeenCalledOnce()
  })

  it('explains unavailable account access without requiring an organization', async () => {
    projectState.status.value = 'error'
    projectState.error.value = { statusCode: 403 }
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Your account access is unavailable')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('offers a sign-in link when the project request is unauthorized', async () => {
    projectState.status.value = 'error'
    projectState.error.value = { statusCode: 401 }
    await flushPromises()
    expect(wrapper.get('a[href="/auth"]').text()).toBe('Sign in')
  })

  it('disables submission when the partner has no projects', async () => {
    projectState.data.value = []
    await flushPromises()
    expect(wrapper.text()).toContain('No projects are available.')
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(true)
    expect(submitMock).not.toHaveBeenCalled()
  })

  it('posts valid form data and replaces the form with confirmation', async () => {
    await fillForm()
    await submit()
    expect(submitMock).toHaveBeenCalledExactlyOnceWith('/api/tickets', {
      method: 'POST',
      body: {
        projectId: 7,
        title: 'Contact form is broken',
        description: 'Clicking Send does nothing.',
      },
    })
    expect(wrapper.get('[role="status"]').text()).toContain('Ticket #42 was saved. Status: open.')
    expect(wrapper.find('form').exists()).toBe(false)

    const another = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Submit another ticket')!
    await another.trigger('click')
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('')
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('')
  })

  it('does not call the API for an invalid form', async () => {
    await submit()
    expect(submitMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Enter a ticket title.')
  })

  it('keeps the draft after a failed save and allows retry', async () => {
    submitMock.mockRejectedValueOnce(new Error('Save failed'))
    await fillForm()
    await submit()
    expect(wrapper.get('[role="alert"]').text()).toContain('Your draft is still here')
    expect(wrapper.get<HTMLInputElement>('input').element.value).toContain('Contact form is broken')
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toContain('Clicking Send')
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(false)

    await submit()
    expect(submitMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('Ticket #42 was saved')
  })

  it('blocks duplicate submissions while saving', async () => {
    let resolveSave!: (value: { id: number; status: string }) => void
    submitMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve
      })
    )
    await fillForm()
    await submit()
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(true)
    // Even a duplicate event from the child cannot start a second request.
    wrapper.getComponent(TicketForm).vm.$emit('submit', {
      projectId: 7,
      title: 'Duplicate',
      description: 'Duplicate',
    })
    await flushPromises()
    expect(submitMock).toHaveBeenCalledTimes(1)

    resolveSave({ id: 42, status: 'open' })
    await flushPromises()
    expect(wrapper.text()).toContain('Ticket #42 was saved')
  })

  it('links from the dashboard to the new ticket page', async () => {
    useFetchMock.mockReturnValue({ data: ref([]), pending: ref(false), error: ref(null) })
    const dashboard = await mountSuspended(Dashboard, {
      global: { stubs: { UIcon: true } },
    })
    try {
      expect(dashboard.get('a[href="/tickets/new"]').text()).toBe('New ticket')
    } finally {
      dashboard.unmount()
    }
  })
})
