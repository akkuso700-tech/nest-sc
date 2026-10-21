import { io, Socket } from 'socket.io-client'
import { apiOrigin, getAccessToken, refreshSession } from '../lib/apiClient.js'

let socketInstance: Socket | null = null
let socketConsumerCount = 0
let isRefreshingAuth = false
let lastAuthRefreshAttemptAt = 0
let disconnectTimer: ReturnType<typeof setTimeout> | null = null

const AUTH_REFRESH_COOLDOWN_MS = 15000
const DISCONNECT_DEBOUNCE_MS = 1500

export function getSocketClient(): Socket {
  if (!socketInstance) {
    socketInstance = io(apiOrigin, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10000,
      auth(cb) {
        const token = getAccessToken()
        cb(token ? { token } : {})
      },
    })

    socketInstance.on('connect_error', async (error: any) => {
      const errorMessage = String(error?.message || '').toLowerCase()
      const isAuthError =
        errorMessage.includes('authentication') ||
        errorMessage.includes('token') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('jwt') ||
        errorMessage.includes('expired')

      const now = Date.now()
      if (
        isAuthError &&
        !isRefreshingAuth &&
        now - lastAuthRefreshAttemptAt >= AUTH_REFRESH_COOLDOWN_MS
      ) {
        isRefreshingAuth = true
        lastAuthRefreshAttemptAt = now
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
  if (disconnectTimer) {
    clearTimeout(disconnectTimer)
    disconnectTimer = null
  }

  const socket = getSocketClient()
  socketConsumerCount += 1

  if (!socket.connected) {
    socket.connect()
  }

  return socket
}

export function disconnectSocketClient(immediate = false): void {
  if (immediate) {
    if (disconnectTimer) {
      clearTimeout(disconnectTimer)
      disconnectTimer = null
    }
    socketConsumerCount = 0
    if (socketInstance?.connected) {
      socketInstance.disconnect()
    }
    return
  }

  socketConsumerCount = Math.max(0, socketConsumerCount - 1)

  if (socketConsumerCount === 0) {
    if (disconnectTimer) {
      clearTimeout(disconnectTimer)
    }
    disconnectTimer = setTimeout(() => {
      disconnectTimer = null
      if (socketConsumerCount === 0 && socketInstance?.connected) {
        socketInstance.disconnect()
      }
    }, DISCONNECT_DEBOUNCE_MS)
  }
}
