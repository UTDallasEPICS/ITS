import { createAccessControl } from 'better-auth/plugins/access'
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access'

const statement = {
  ...defaultStatements,
  ticket: ['create', 'read', 'update', 'delete'],
  project: ['create', 'read', 'update', 'delete'],
} as const

export const ac = createAccessControl(statement)

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

export const member = ac.newRole({
  ...memberAc.statements,
  ticket: ['create', 'read'],
  project: ['read'],
})

export const roles = { owner, admin, member }
