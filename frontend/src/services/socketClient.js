import { io } from 'socket.io-client'
import { apiOrigin } from '../lib/apiClient.js'

let socketInstance = null
let socketConsumerCount = 0

export function getSocketClient() {
  if (!socketInstance) {
    socketInstance = io(apiOrigin, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
  }

  return socketInstance
}

export function connectSocketClient() {
  const socket = getSocketClient()
  socketConsumerCount += 1

  if (!socket.connected) {
    socket.connect()
  }

  return socket
}

export function disconnectSocketClient() {
  socketConsumerCount = Math.max(0, socketConsumerCount - 1)

  if (socketConsumerCount === 0 && socketInstance?.connected) {
    socketInstance.disconnect()
  }
}
