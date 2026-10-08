// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { USelect } from '#components'
import TicketForm from '../../app/components/TicketForm.vue'

const projects = [
  { id: 7, name: 'Community Website' },
  { id: 12, name: 'Volunteer Portal' },
]

describe('TicketForm', () => {
  let wrapper: Awaited<ReturnType<typeof mountSuspended<typeof TicketForm>>>

  beforeEach(async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request'))
    wrapper = await mountSuspended(TicketForm, {
      props: { projects },
      // Icons are decorative; keep their runtime loading out of these form tests.
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

  it('shows required errors and does not submit an empty form', async () => {
    await submit()

    expect(wrapper.text()).toContain('Choose a project.')
    expect(wrapper.text()).toContain('Enter a ticket title.')
    expect(wrapper.text()).toContain('Describe the issue.')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits the chosen project and trimmed ticket text', async () => {
    await fillForm()
    await submit()

    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          projectId: 7,
          title: 'Contact form is broken',
          description: 'Clicking Send does nothing.',
        },
      ],
    ])
    // Keep the draft until the parent knows the API request succeeded.
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toContain(
      'Clicking Send does nothing.'
    )
  })

  it('rejects whitespace-only title and description', async () => {
    await fillForm()
    await wrapper.get('input').setValue('   ')
    await wrapper.get('textarea').setValue('\n  ')
    await submit()

    expect(wrapper.text()).toContain('Enter a ticket title.')
    expect(wrapper.text()).toContain('Describe the issue.')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('requires a project even when the ticket text is valid', async () => {
    await wrapper.get('input').setValue('Broken link')
    await wrapper.get('textarea').setValue('The Help link opens a missing page.')
    await submit()

    expect(wrapper.text()).toContain('Choose a project.')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('rejects a selected project that is removed from the available projects', async () => {
    await fillForm()
    await wrapper.setProps({ projects: [{ id: 12, name: 'Volunteer Portal' }] })
    await submit()

    expect(wrapper.text()).toContain('Choose a project.')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('explains when no projects are available and disables submission', async () => {
    await wrapper.setProps({ projects: [] })

    expect(wrapper.get('[role="status"]').text()).toContain('No projects are available.')
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(true)
    await submit()
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('blocks another submission while the parent is saving', async () => {
    await fillForm()
    await wrapper.setProps({ submitting: true })

    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(true)
    expect(wrapper.get<HTMLInputElement>('input').element.disabled).toBe(true)
    await submit()
    expect(wrapper.emitted('submit')).toBeUndefined()

    await wrapper.setProps({ submitting: false })
    await submit()
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })
})
