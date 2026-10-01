import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// A project partner. Declared before `user` so `user.orgId` resolves in
// declaration order.
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

export const user = sqliteTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  // The user's partner, or null for a global admin -- that null is the entire
  // role model, so there is no role column. No onDelete: SET NULL would promote
  // every ex-member to global admin if a partner were deleted, and CASCADE
  // would delete its users. NO ACTION blocks deleting a partner still in use.
  orgId: text('orgId').references(() => organization.id),
}, (table) => [
  uniqueIndex('user_email_unique').on(table.email),
  index('user_orgId_idx').on(table.orgId),
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

export const project = sqliteTable('project', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  // repo `full_name`. ex: `UTDallasEPICS/ITS`
  githubRepo: text('githubRepo').notNull(),
  projectPartnerId: text('projectPartnerId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
}, (table) => [
  index('project_projectPartnerId_idx').on(table.projectPartnerId),
])

export const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey(),
  projectId: integer('projectId')
    .notNull()
    .references(() => project.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status').notNull(),
  userId: text('userId').references(() => user.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  timestamp: text('timestamp').notNull(),
  githubIssueId: text('githubIssueId'),
}, (table) => [
  index('tickets_projectId_idx').on(table.projectId),
  index('tickets_userId_idx').on(table.userId),
  uniqueIndex('tickets_githubIssueId_unique').on(table.githubIssueId),
])

export const userRelations = relations(user, ({ one, many }) => ({
  org: one(organization, { fields: [user.orgId], references: [organization.id] }),
  sessions: many(session),
  accounts: many(account),
  tickets: many(tickets),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const organizationRelations = relations(organization, ({ many }) => ({
  users: many(user),
  projects: many(project),
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
  user: one(user, { fields: [tickets.userId], references: [user.id] }),
}))

// Insert schemas no longer omit anything: the only columns that ever needed
// omitting were the plugins' `input: false` fields.
export const selectUserSchema = createSelectSchema(user)
export const insertUserSchema = createInsertSchema(user)
export const selectSessionSchema = createSelectSchema(session)
export const insertSessionSchema = createInsertSchema(session)
export const selectAccountSchema = createSelectSchema(account)
export const insertAccountSchema = createInsertSchema(account)
export const selectVerificationSchema = createSelectSchema(verification)
export const insertVerificationSchema = createInsertSchema(verification)
export const selectOrganizationSchema = createSelectSchema(organization)
export const insertOrganizationSchema = createInsertSchema(organization)
export const selectProjectSchema = createSelectSchema(project)
export const insertProjectSchema = createInsertSchema(project)
export const selectTicketsSchema = createSelectSchema(tickets)
export const insertTicketsSchema = createInsertSchema(tickets)
