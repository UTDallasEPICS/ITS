import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  role: text('role'),
  banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
  banReason: text('banReason'),
  banExpires: integer('banExpires', { mode: 'timestamp' }),
}, (table) => [
  uniqueIndex('user_email_unique').on(table.email),
])

export const session = sqliteTable('session', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  activeOrganizationId: text('activeOrganizationId'),
  impersonatedBy: text('impersonatedBy'),
}, (table) => [
  index('session_userId_idx').on(table.userId),
  uniqueIndex('session_token_unique').on(table.token),
])

export const account = sqliteTable('account', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('account_userId_idx').on(table.userId),
])

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('verification_identifier_idx').on(table.identifier),
])

export const organization = sqliteTable('organization', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  logo: text('logo'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('organization_slug_unique').on(table.slug),
])

export const member = sqliteTable('member', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organizationId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('member_organizationId_idx').on(table.organizationId),
  index('member_userId_idx').on(table.userId),
])

export const invitation = sqliteTable('invitation', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organizationId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull().default('pending'),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  inviterId: text('inviterId').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  index('invitation_organizationId_idx').on(table.organizationId),
  index('invitation_email_idx').on(table.email),
])

// Dynamic access control: roles an organization defines at runtime, stored as a
// JSON permission map and merged over the static `roles` on permission checks.
// The export name must stay `organizationRole` -- the Drizzle adapter resolves
// tables by the Better Auth model name, not the SQL table name.
export const organizationRole = sqliteTable('organizationRole', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organizationId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  permission: text('permission').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }),
}, (table) => [
  index('organizationRole_organizationId_idx').on(table.organizationId),
])

export const project = sqliteTable('project', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  // GitHub's `full_name`, e.g. `UTDallasEPICS/ITS`. This is the form every REST
  // endpoint is addressed by; there is no REST lookup by repository id.
  githubRepo: text('githubRepo').notNull(),
  // Points at the `organization` table, which represents a project partner. The
  // export and table name stay `organization` for the Better Auth plugin, so
  // this is the project's own name for the reference.
  projectPartnerId: text('projectPartnerId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
}, (table) => [
  index('project_projectPartnerId_idx').on(table.projectPartnerId),
])

// Declared after `project` so the foreign key resolves in declaration order.
export const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey(),
  // Matches `project.id`, which is an integer primary key.
  projectId: integer('projectId')
    .notNull()
    .references(() => project.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status').notNull(),
  userId: text('userId').notNull(),
  description: text('description').notNull(),
  timestamp: text('timestamp').notNull(),
}, (table) => [
  index('tickets_projectId_idx').on(table.projectId),
])

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  invitations: many(invitation),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  // An organization is a project partner; the table keeps the Better Auth
  // model name, so this is where that vocabulary lives in the relations.
  projects: many(project),
  roles: many(organizationRole),
}))
export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, { fields: [member.userId], references: [user.id] }),
}))

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, { fields: [invitation.inviterId], references: [user.id] }),
}))

export const projectRelations = relations(project, ({ one, many }) => ({
  projectPartner: one(organization, {
    fields: [project.projectPartnerId],
    references: [organization.id],
  }),
  tickets: many(tickets),
}))

export const ticketsRelations = relations(tickets, ({ one }) => ({
  project: one(project, { fields: [tickets.projectId], references: [project.id] }),
}))

export const organizationRoleRelations = relations(organizationRole, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationRole.organizationId],
    references: [organization.id],
  }),
}))

// Select schemas mirror the table. Insert schemas omit the columns Better Auth
// marks `input: false` (admin/ban state, active organization, impersonation) so
// they cannot be set through a validated request body.
export const selectUserSchema = createSelectSchema(user)
export const insertUserSchema = createInsertSchema(user).omit({
  role: true,
  banned: true,
  banReason: true,
  banExpires: true,
})
export const selectSessionSchema = createSelectSchema(session)
export const insertSessionSchema = createInsertSchema(session).omit({
  activeOrganizationId: true,
  impersonatedBy: true,
})
export const selectAccountSchema = createSelectSchema(account)
export const insertAccountSchema = createInsertSchema(account)
export const selectVerificationSchema = createSelectSchema(verification)
export const insertVerificationSchema = createInsertSchema(verification)
export const selectOrganizationSchema = createSelectSchema(organization)
export const insertOrganizationSchema = createInsertSchema(organization)
export const selectMemberSchema = createSelectSchema(member)
export const insertMemberSchema = createInsertSchema(member)
export const selectInvitationSchema = createSelectSchema(invitation)
export const insertInvitationSchema = createInsertSchema(invitation)
export const selectOrganizationRoleSchema = createSelectSchema(organizationRole)
export const insertOrganizationRoleSchema = createInsertSchema(organizationRole)
export const selectProjectSchema = createSelectSchema(project)
export const insertProjectSchema = createInsertSchema(project)
export const selectTicketsSchema = createSelectSchema(tickets)
export const insertTicketsSchema = createInsertSchema(tickets)
