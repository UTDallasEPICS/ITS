// @vitest-environment nuxt

import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { TicketDetail } from '#components'
import type { Ticket } from '../../app/utils/tickets'

describe('TicketDetail component', () => {
  const sampleTicket: Ticket = {
    id: 46,
    projectId: 1,
    title: 'DX/Feature: Build NPTS ticket detail view',
    status: 'In Progress',
    userId: 'usr_test_123',
    description: 'Component rendering test for ticket detail view',
    timestamp: '2026-10-08T10:30:00Z',
    githubIssueId: '46',
  }

  it('renders all core ticket details matching database schema', async () => {
    const wrapper = await mountSuspended(TicketDetail, {
      props: {
        ticket: sampleTicket,
      },
    })

    // Ticket ID
    expect(wrapper.text()).toContain('Ticket #46')
    expect(wrapper.text()).toContain('46')

    // Title
    expect(wrapper.text()).toContain('DX/Feature: Build NPTS ticket detail view')

    // Status
    expect(wrapper.text()).toContain('In Progress')

    // Description
    expect(wrapper.text()).toContain('Component rendering test for ticket detail view')

    // Date Created / Timestamp
    expect(wrapper.text()).toContain('Date Created')
    expect(wrapper.text()).toContain('2026-10-08T10:30:00Z')
  })

  it('renders "Back to Tickets" navigation button', async () => {
    const wrapper = await mountSuspended(TicketDetail, {
      props: {
        ticket: sampleTicket,
      },
    })

    const backButton = wrapper.find('#back-to-tickets-btn')
    expect(backButton.exists()).toBe(true)
    expect(backButton.text()).toContain('Back to Tickets')
  })
})
