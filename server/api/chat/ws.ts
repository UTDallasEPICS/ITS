import { defineWebSocketHandler } from 'h3'
import { chatSocketHooks } from '~~/server/utils/chat/socket'

export default defineWebSocketHandler(chatSocketHooks)
