import { useEffect, useMemo, useRef, useState } from 'react'

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getOutputSize(target) {
  if (target === 'avatar') {
    return { width: 280, height: 280, aspectRatio: 1 }
  }

  return { width: 1100, height: 344, aspectRatio: 16 / 5 }
}

function ProfileImageCropModal({ open, file, target, onClose, onConfirm }) {
  const frameRef = useRef(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [imageState, setImageState] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
  })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragStateRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  })

  const output = useMemo(() => getOutputSize(target), [target])

  useEffect(() => {
    if (!file || !open) {
      return
    }

    const nextUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      setImageState({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      })
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    }

    image.src = nextUrl
    setSourceUrl(nextUrl)

    return () => {
      URL.revokeObjectURL(nextUrl)
      setSourceUrl('')
    }
  }, [file, open])

  if (!open || !file) {
    return null
  }

  const previewWidth = target === 'avatar' ? 320 : 760
  const previewHeight = Math.round(previewWidth / output.aspectRatio)
  const baseScale = imageState.naturalWidth && imageState.naturalHeight
    ? Math.max(previewWidth / imageState.naturalWidth, previewHeight / imageState.naturalHeight)
    : 1
  const currentScale = baseScale * zoom
  const maxOffsetX = Math.max((imageState.naturalWidth * currentScale - previewWidth) / 2, 0)
  const maxOffsetY = Math.max((imageState.naturalHeight * currentScale - previewHeight) / 2, 0)
  const clampedOffset = {
    x: clamp(offset.x, -maxOffsetX, maxOffsetX),
    y: clamp(offset.y, -maxOffsetY, maxOffsetY),
  }

  function startDrag(clientX, clientY) {
    dragStateRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      baseX: clampedOffset.x,
      baseY: clampedOffset.y,
    }
  }

  function handlePointerMove(clientX, clientY) {
    if (!dragStateRef.current.active) {
      return
    }

    const nextX = dragStateRef.current.baseX + (clientX - dragStateRef.current.startX)
    const nextY = dragStateRef.current.baseY + (clientY - dragStateRef.current.startY)

    setOffset({
      x: clamp(nextX, -maxOffsetX, maxOffsetX),
      y: clamp(nextY, -maxOffsetY, maxOffsetY),
    })
  }

  function stopDrag() {
    dragStateRef.current.active = false
  }

  async function handleConfirm() {
    const canvas = document.createElement('canvas')
    canvas.width = output.width
    canvas.height = output.height

    const context = canvas.getContext('2d')

    if (!context) {
      return
    }

    const sourceWidth = previewWidth / currentScale
    const sourceHeight = previewHeight / currentScale
    const unclampedX =
      imageState.naturalWidth / 2 - sourceWidth / 2 - clampedOffset.x / currentScale
    const unclampedY =
      imageState.naturalHeight / 2 - sourceHeight / 2 - clampedOffset.y / currentScale
    const sourceX = clamp(unclampedX, 0, imageState.naturalWidth - sourceWidth)
    const sourceY = clamp(unclampedY, 0, imageState.naturalHeight - sourceHeight)

    const image = new Image()
    image.src = sourceUrl

    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
    })

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      output.width,
      output.height,
    )

    const result = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Image crop failed.'))
            return
          }

          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('Image conversion failed.'))
          reader.readAsDataURL(blob)
        },
        'image/webp',
        0.74,
      )
    })

    onConfirm(result)
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-[32px] border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
              {target === 'avatar' ? 'Profil Fotografini Kirp' : 'Kapak Fotografini Kirp'}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Gorseli surukleyebilir, yakinlastirabilir ve tam istedigin alani secebilirsin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            X
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-[28px] border border-zinc-200 bg-zinc-100 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div
              ref={frameRef}
              className={`relative mx-auto overflow-hidden rounded-[24px] bg-black ${
                target === 'avatar' ? 'max-w-[320px] aspect-square' : 'max-w-[760px] aspect-[16/5]'
              }`}
              style={{ width: '100%' }}
              onMouseDown={(event) => startDrag(event.clientX, event.clientY)}
              onMouseMove={(event) => handlePointerMove(event.clientX, event.clientY)}
              onMouseUp={stopDrag}
              onMouseLeave={stopDrag}
              onTouchStart={(event) => {
                const touch = event.touches[0]
                startDrag(touch.clientX, touch.clientY)
              }}
              onTouchMove={(event) => {
                const touch = event.touches[0]
                handlePointerMove(touch.clientX, touch.clientY)
              }}
              onTouchEnd={stopDrag}
            >
              {sourceUrl ? (
                <img
                  src={sourceUrl}
                  alt="Crop preview"
                  draggable="false"
                  className="pointer-events-none absolute left-1/2 top-1/2 select-none"
                  style={{
                    width: imageState.naturalWidth * currentScale,
                    height: imageState.naturalHeight * currentScale,
                    maxWidth: 'none',
                    transform: `translate(calc(-50% + ${clampedOffset.x}px), calc(-50% + ${clampedOffset.y}px))`,
                  }}
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-4 rounded-[28px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Yakinlastirma</p>
              <input
                type="range"
                min="1"
                max="2.6"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="mt-3 w-full accent-zinc-950 dark:accent-white"
              />
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
              {target === 'avatar'
                ? 'Profil fotografisi kare olarak kaydedilecek.'
                : 'Kapak fotografisi genis oranli olarak kaydedilecek.'}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-950"
              >
                Vazgec
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Uygula
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileImageCropModal
