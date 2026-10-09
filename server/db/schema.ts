import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const organization = sqliteTable('organization', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const user = sqliteTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  // Omitted orgId defaults to NULL in SQLite: NPTS access. Set an org for partners.
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

export const chatThreads = sqliteTable('chat_threads', {
  id: integer('id').primaryKey(),
  projectId: integer('projectId')
    .notNull()
    .references(() => project.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', {mode: 'timestamp'}),
  closedAt: integer('closed_at', {mode: 'timestamp'}),
}, (table) => [
  index('chat_threads_projectId_idx').on(table.projectId),
])

export const chatThreadMessages = sqliteTable('chat_thread_messages', {
  id: integer('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  threadId: integer('thread_id').references(() => chatThreads.id).notNull(),
  userId: integer('user_id').references(() => user.id).notNull(),
  plainTextBody: text("plain_text_body").notNull()
}, (table) => [
  index('chat_thread_messages_pagination_idx').on(table.threadId, table.id)
])

export const chatThreadMembers = sqliteTable('chat_thread_members', {
  threadId: integer('thread_id').references(() => chatThreads.id).notNull(),
  userId: integer('user_id').references(() => user.id).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
}, (table) => [
  primaryKey({columns: [table.threadId, table.userId]}),
  index('chat_thread_members_user_idx').on(table.userId)
])

export const chatThreadRelations = relations(chatThreads, ({ one, many }) => ({
  members: many(chatThreadMembers),
  project: one(project, {fields: [chatThreads.projectId], references: [project.id]}),
  messages: many(chatThreadMessages)
}))

export const chatThreadMemberRelations = relations(chatThreadMembers, ({ one }) => ({
  user: one(user, { fields: [chatThreadMembers.userId], references: [user.id] }),
  thread: one(chatThreads, {fields: [chatThreadMembers.threadId], references: [chatThreads.id]})
}))

export const chatThreadMessageRelations = relations(chatThreadMessages, ({ one }) => ({
  user: one(user, { fields: [chatThreadMessages.userId], references: [user.id] }),
  thread: one(chatThreads, {fields: [chatThreadMessages.threadId], references: [chatThreads.id]})
}))

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

export const selectChatThreadsSchema = createSelectSchema(chatThreads)
export const insertChatThreadsSchema = createInsertSchema(chatThreads)
export const selectChatThreadMessagesSchema = createSelectSchema(chatThreadMessages)
export const insertChatThreadMessagesSchema = createInsertSchema(chatThreadMessages)
export const selectChatThreadMembersSchema = createSelectSchema(chatThreadMembers)
export const insertChatThreadMembersSchema = createInsertSchema(chatThreadMembers)
