import { useNitroApp } from 'nitropack/runtime'
import type { selectChatThreadMessagesSchema, selectChatThreadsSchema } from '../../db/schema'

export type ChatMessageEvent = {
  threadId: selectChatThreadMessagesSchema['threadId']
  message: selectChatThreadMessagesSchema
}

export type ChatThreadCreatedEvent = {
  thread: selectChatThreadsSchema
  memberIds: string[]
}

declare module 'nitropack/types' {
  interface NitroRuntimeHooks {
    'chat:message': (payload: ChatMessageEvent) => void | Promise<void>
    'chat:thread-created': (payload: ChatThreadCreatedEvent) => void | Promise<void>
  }
}

export function onChatMessage(listener: (payload: ChatMessageEvent) => void | Promise<void>) {
  return useNitroApp().hooks.hook('chat:message', listener)
}

export function onChatThreadCreated(
  listener: (payload: ChatThreadCreatedEvent) => void | Promise<void>,
) {
  return useNitroApp().hooks.hook('chat:thread-created', listener)
}

export async function emitChatMessage(message: selectChatThreadMessagesSchema) {
  await useNitroApp().hooks.callHook('chat:message', {
    threadId: message.threadId,
    message,
  })
}

export async function emitChatThreadCreated(
  thread: selectChatThreadsSchema,
  memberIds: string[],
) {
  await useNitroApp().hooks.callHook('chat:thread-created', { thread, memberIds })
}
