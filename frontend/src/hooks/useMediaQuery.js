import { useSyncExternalStore } from 'react'

export const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)'

const queryStores = new Map()

function createQueryStore(query) {
  const listeners = new Set()
  let mediaQuery = null

  const getMediaQuery = () => {
    if (!mediaQuery && typeof window !== 'undefined') {
      mediaQuery = window.matchMedia(query)
    }
    return mediaQuery
  }

  const notifyListeners = () => {
    listeners.forEach((listener) => listener())
  }

  return {
    getSnapshot: () => Boolean(getMediaQuery()?.matches),
    getServerSnapshot: () => false,
    subscribe(listener) {
      const currentMediaQuery = getMediaQuery()
      listeners.add(listener)

      if (listeners.size === 1) {
        if (currentMediaQuery?.addEventListener) {
          currentMediaQuery.addEventListener('change', notifyListeners)
        } else {
          currentMediaQuery?.addListener?.(notifyListeners)
        }
      }

      return () => {
        listeners.delete(listener)
        if (!listeners.size) {
          if (currentMediaQuery?.removeEventListener) {
            currentMediaQuery.removeEventListener('change', notifyListeners)
          } else {
            currentMediaQuery?.removeListener?.(notifyListeners)
          }
        }
      }
    },
  }
}

export function useMediaQuery(query) {
  if (!queryStores.has(query)) {
    queryStores.set(query, createQueryStore(query))
  }

  const store = queryStores.get(query)
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
