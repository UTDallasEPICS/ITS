import { createAccessControl } from 'better-auth/plugins/access'
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access'

// The plugin's own statements (organization, member, invitation, team, ac) plus
// the ITS domain resources, so an organization role can gate ticket and project
// actions and not just membership management.
const statement = {
  ...defaultStatements,
  ticket: ['create', 'read', 'update', 'delete'],
  project: ['create', 'read', 'update', 'delete'],
} as const

export const ac = createAccessControl(statement)

// Spread the default role statements so the plugin-managed resources keep their
// existing grants, then layer the ITS resources on top. `ownerAc`/`adminAc` come
// from the default access control, so their statement sets already match
// `statement` minus the two new keys.
export const owner = ac.newRole({
  ...ownerAc.statements,
  ticket: ['create', 'read', 'update', 'delete'],
  project: ['create', 'read', 'update', 'delete'],
})

export const admin = ac.newRole({
  ...adminAc.statements,
  ticket: ['create', 'read', 'update', 'delete'],
  project: ['create', 'read', 'update', 'delete'],
})

// Project partners are ordinary members: they submit and follow up on tickets
// and read their projects, but manage neither the org nor its membership.
export const member = ac.newRole({
  ...memberAc.statements,
  ticket: ['create', 'read'],
  project: ['read'],
})

export const roles = { owner, admin, member }
