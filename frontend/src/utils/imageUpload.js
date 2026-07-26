function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image could not be loaded.'))
    }

    image.src = objectUrl
  })
}

function canvasToDataUrl(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Image could not be processed.'))
          return
        }

        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Image could not be converted.'))
        reader.readAsDataURL(blob)
      },
      type,
      quality,
    )
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Image could not be processed.'))
          return
        }

        resolve(blob)
      },
      type,
      quality,
    )
  })
}

function createSizedCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function drawImageToCanvas(image, width, height) {
  const canvas = createSizedCanvas(width, height)
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas context is not available.')
  }

  context.drawImage(image, 0, 0, width, height)
  return canvas
}

function getFileExtensionByMimeType(type) {
  if (type === 'image/webp') {
    return 'webp'
  }

  if (type === 'image/jpeg') {
    return 'jpg'
  }

  if (type === 'image/png') {
    return 'png'
  }

  return 'img'
}

function buildOptimizedFileName(file, outputType = 'image/webp', prefix = 'image') {
  const extension = getFileExtensionByMimeType(outputType)
  const baseName = (file?.name || prefix).replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-')
  return `${baseName || prefix}-optimized.${extension}`
}

export function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const normalized = bytes / 1024 ** unitIndex
  const decimals = normalized >= 100 || unitIndex === 0 ? 0 : normalized >= 10 ? 1 : 2
  return `${normalized.toFixed(decimals)} ${units[unitIndex]}`
}

export async function compressImageToDataUrl(
  file,
  {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.84,
    type = 'image/webp',
  } = {},
) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Only image files are supported.')
  }

  const image = await loadImage(file)
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
  const width = Math.max(1, Math.round(image.width * ratio))
  const height = Math.max(1, Math.round(image.height * ratio))
  const canvas = document.createElement('canvas')

  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas context is not available.')
  }

  context.drawImage(image, 0, 0, width, height)

  return canvasToDataUrl(canvas, type, quality)
}

export async function compressImageToFile(
  file,
  {
    maxWidth = 1440,
    maxHeight = 1440,
    quality = 0.74,
    type = 'image/webp',
    maxBytes = 1.5 * 1024 * 1024,
    fileNamePrefix = 'image',
  } = {},
) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Only image files are supported.')
  }

  const image = await loadImage(file)
  const initialRatio = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
  let width = Math.max(1, Math.round(image.width * initialRatio))
  let height = Math.max(1, Math.round(image.height * initialRatio))
  let nextQuality = quality

  let optimizedBlob = await canvasToBlob(drawImageToCanvas(image, width, height), type, nextQuality)

  if (maxBytes && optimizedBlob.size > maxBytes) {
    // Two-pass fallback for stubborn images: lower dimensions and quality.
    const shrinkRatio = Math.max(Math.sqrt(maxBytes / optimizedBlob.size), 0.62)
    width = Math.max(1, Math.round(width * shrinkRatio))
    height = Math.max(1, Math.round(height * shrinkRatio))
    nextQuality = Math.max(0.56, quality - 0.16)
    optimizedBlob = await canvasToBlob(drawImageToCanvas(image, width, height), type, nextQuality)
  }

  if (maxBytes && optimizedBlob.size > maxBytes) {
    throw new Error(`Image is still too large after optimization (${formatBytes(optimizedBlob.size)}).`)
  }

  if (optimizedBlob.size >= file.size) {
    return file
  }

  return new File([optimizedBlob], buildOptimizedFileName(file, type, fileNamePrefix), {
    type: optimizedBlob.type || type,
    lastModified: Date.now(),
  })
}
