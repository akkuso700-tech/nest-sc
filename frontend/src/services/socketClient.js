import { io } from 'socket.io-client'
import { apiOrigin, refreshSession } from '../lib/apiClient.js'

let socketInstance = null
let socketConsumerCount = 0
let isRefreshingAuth = false

export function getSocketClient() {
  if (!socketInstance) {
    socketInstance = io(apiOrigin, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketInstance.on('connect_error', async (error) => {
      const errorMessage = String(error?.message || '').toLowerCase()
      const isAuthError =
        errorMessage.includes('authentication') ||
        errorMessage.includes('token') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('jwt')

      if (isAuthError && !isRefreshingAuth) {
        isRefreshingAuth = true
        try {
          await refreshSession()
          if (socketConsumerCount > 0 && !socketInstance.connected) {
            socketInstance.connect()
          }
        } catch {
          // Session expired or logged out; keep socket disconnected
        } finally {
          isRefreshingAuth = false
        }
      }
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
