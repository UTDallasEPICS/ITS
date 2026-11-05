export type ChatWireMessage = {
  id: number
  threadId: number
  userId: string
  plainTextBody: string
  createdAt: string
}

export type ChatWireThread = {
  id: number
  projectId: number
  createdAt: string
  closedAt: string | null
}

export type ChatServerFrame =
  | { type: 'ready' }
  | { type: 'message.created', message: ChatWireMessage }
  | { type: 'thread.created', thread: ChatWireThread }
  | { type: 'ping' }
  | { type: 'pong' }
