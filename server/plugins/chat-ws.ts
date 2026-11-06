import { onChatMessage, onChatThreadCreated } from '../utils/chat/events'
import { publishChatMessage, publishThreadCreated, toWireMessage } from '../utils/chat/ws'

export default defineNitroPlugin(() => {
  onChatMessage(({ message }) => {
    publishChatMessage(message.threadId, toWireMessage(message))
  })

  onChatThreadCreated(({ thread, memberIds }) => {
    publishThreadCreated(thread, memberIds)
  })
})
