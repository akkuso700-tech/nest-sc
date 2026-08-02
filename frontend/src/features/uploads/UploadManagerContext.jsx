import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import UploadTray from './UploadTray.jsx'

const UploadManagerContext = createContext(null)

function createUploadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeProgress(value) {
  if (!Number.isFinite(value)) {
    return null
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

export function UploadManagerProvider({ children }) {
  const [uploads, setUploads] = useState([])
  const [isMinimized, setIsMinimized] = useState(false)
  const runnersRef = useRef(new Map())
  const controllersRef = useRef(new Map())
  const dismissTimersRef = useRef(new Map())

  const updateUpload = useCallback((uploadId, updates) => {
    setUploads((currentUploads) =>
      currentUploads.map((upload) =>
        upload.id === uploadId
          ? {
              ...upload,
              ...(typeof updates === 'function' ? updates(upload) : updates),
            }
          : upload,
      ),
    )
  }, [])

  const removeUpload = useCallback((uploadId) => {
    controllersRef.current.get(uploadId)?.abort()
    controllersRef.current.delete(uploadId)
    runnersRef.current.delete(uploadId)

    const dismissTimer = dismissTimersRef.current.get(uploadId)
    if (dismissTimer) {
      clearTimeout(dismissTimer)
      dismissTimersRef.current.delete(uploadId)
    }

    setUploads((currentUploads) => currentUploads.filter((upload) => upload.id !== uploadId))
  }, [])

  const scheduleDismiss = useCallback(
    (uploadId, delayMs) => {
      const currentTimer = dismissTimersRef.current.get(uploadId)
      if (currentTimer) {
        clearTimeout(currentTimer)
      }

      const timer = setTimeout(() => removeUpload(uploadId), delayMs)
      dismissTimersRef.current.set(uploadId, timer)
    },
    [removeUpload],
  )

  const executeUpload = useCallback(
    async (uploadId) => {
      const runner = runnersRef.current.get(uploadId)
      if (!runner) {
        return
      }

      const previousController = controllersRef.current.get(uploadId)
      previousController?.abort()

      const controller = new AbortController()
      controllersRef.current.set(uploadId, controller)
      updateUpload(uploadId, {
        status: 'running',
        progress: runner.initialProgress,
        phase: runner.initialPhase,
        error: '',
      })
      setIsMinimized(false)

      try {
        const result = await runner.run({
          signal: controller.signal,
          setPhase(phase) {
            updateUpload(uploadId, { phase })
          },
          setProgress(progress) {
            updateUpload(uploadId, { progress: normalizeProgress(progress) })
          },
        })

        if (
          controller.signal.aborted ||
          controllersRef.current.get(uploadId) !== controller
        ) {
          return
        }

        updateUpload(uploadId, {
          status: 'completed',
          progress: 100,
          phase: runner.successPhase,
          result,
        })
        controllersRef.current.delete(uploadId)
        scheduleDismiss(uploadId, 8000)
      } catch (error) {
        if (controllersRef.current.get(uploadId) !== controller) {
          return
        }

        controllersRef.current.delete(uploadId)

        if (controller.signal.aborted) {
          updateUpload(uploadId, {
            status: 'cancelled',
            progress: null,
            phase: runner.cancelledPhase,
            error: '',
          })
          return
        }

        updateUpload(uploadId, {
          status: 'failed',
          progress: null,
          phase: runner.failedPhase,
          error: error?.message || runner.failedPhase,
        })
      }
    },
    [scheduleDismiss, updateUpload],
  )

  const enqueueUpload = useCallback((options) => {
    const uploadId = createUploadId()
    const runner = {
      run: options.run,
      initialProgress: normalizeProgress(options.initialProgress),
      initialPhase: options.initialPhase || 'Yükleme hazırlanıyor',
      successPhase: options.successPhase || 'Paylaşım yayınlandı',
      failedPhase: options.failedPhase || 'Yükleme tamamlanamadı',
      cancelledPhase: options.cancelledPhase || 'Yükleme iptal edildi',
    }

    runnersRef.current.set(uploadId, runner)
    setUploads((currentUploads) => [
      ...currentUploads,
      {
        id: uploadId,
        title: options.title || 'İçerik yükleniyor',
        detail: options.detail || '',
        kind: options.kind || 'content',
        status: 'queued',
        progress: runner.initialProgress,
        phase: runner.initialPhase,
        error: '',
        cancellable: options.cancellable !== false,
        createdAt: Date.now(),
      },
    ])
    setIsMinimized(false)

    queueMicrotask(() => executeUpload(uploadId))
    return uploadId
  }, [executeUpload])

  const cancelUpload = useCallback(
    (uploadId) => {
      const controller = controllersRef.current.get(uploadId)
      if (controller) {
        controller.abort()
      }
      updateUpload(uploadId, (upload) => ({
        status: 'cancelled',
        progress: null,
        phase: runnersRef.current.get(uploadId)?.cancelledPhase || upload.phase,
        error: '',
      }))
    },
    [updateUpload],
  )

  const retryUpload = useCallback(
    (uploadId) => {
      const dismissTimer = dismissTimersRef.current.get(uploadId)
      if (dismissTimer) {
        clearTimeout(dismissTimer)
        dismissTimersRef.current.delete(uploadId)
      }
      queueMicrotask(() => executeUpload(uploadId))
    },
    [executeUpload],
  )

  useEffect(
    () => () => {
      controllersRef.current.forEach((controller) => controller.abort())
      dismissTimersRef.current.forEach((timer) => clearTimeout(timer))
    },
    [],
  )

  const value = useMemo(
    () => ({ enqueueUpload }),
    [enqueueUpload],
  )

  return (
    <UploadManagerContext.Provider value={value}>
      {children}
      <UploadTray
        uploads={uploads}
        isMinimized={isMinimized}
        onToggleMinimized={() => setIsMinimized((currentValue) => !currentValue)}
        onCancel={cancelUpload}
        onRetry={retryUpload}
        onRemove={removeUpload}
      />
    </UploadManagerContext.Provider>
  )
}

export function useUploadManager() {
  const value = useContext(UploadManagerContext)

  if (!value) {
    throw new Error('useUploadManager must be used inside UploadManagerProvider.')
  }

  return value
}
