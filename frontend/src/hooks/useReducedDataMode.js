import { useEffect, useState } from 'react'

function shouldReduceMediaData() {
  if (typeof navigator === 'undefined') {
    return false
  }

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!connection) {
    return false
  }

  const effectiveType = `${connection.effectiveType || ''}`.toLowerCase()
  const downlink = Number(connection.downlink)

  return Boolean(
    connection.saveData ||
      effectiveType === 'slow-2g' ||
      effectiveType === '2g' ||
      (Number.isFinite(downlink) && downlink > 0 && downlink < 1.5),
  )
}

export function useReducedDataMode() {
  const [reducedDataMode, setReducedDataMode] = useState(shouldReduceMediaData)

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (!connection) {
      return undefined
    }

    const handleConnectionChange = () => setReducedDataMode(shouldReduceMediaData())
    connection.addEventListener?.('change', handleConnectionChange)

    return () => connection.removeEventListener?.('change', handleConnectionChange)
  }, [])

  return reducedDataMode
}
