import { io, Socket } from 'socket.io-client'
import { apiOrigin, refreshSession } from '../lib/apiClient.js'

let socketInstance: Socket | null = null
let socketConsumerCount = 0
let isRefreshingAuth = false

export function getSocketClient(): Socket {
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

    socketInstance.on('connect_error', async (error: any) => {
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
          if (socketConsumerCount > 0 && socketInstance && !socketInstance.connected) {
            socketInstance.connect()
          }
        } catch {
          // Session expired or logged out; keep socket disconnected
          if (socketInstance) {
            socketInstance.disconnect()
          }
        } finally {
          isRefreshingAuth = false
        }
      }
    })
  }

  return socketInstance
}

export function connectSocketClient(): Socket {
  const socket = getSocketClient()
  socketConsumerCount += 1

  if (!socket.connected) {
    socket.connect()
  }

  return socket
}

export function disconnectSocketClient(): void {
  socketConsumerCount = Math.max(0, socketConsumerCount - 1)

  if (socketConsumerCount === 0 && socketInstance?.connected) {
    socketInstance.disconnect()
  }
}
