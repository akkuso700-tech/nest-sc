function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function hasUnsafeKey(key) {
  return key.startsWith('$') || key.includes('.')
}

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    value.forEach((item) => sanitizeValue(item))
    return value
  }

  if (!isPlainObject(value)) {
    return value
  }

  Object.keys(value).forEach((key) => {
    if (hasUnsafeKey(key)) {
      delete value[key]
      return
    }

    sanitizeValue(value[key])
  })

  return value
}

function sanitizeRequest(req, res, next) {
  sanitizeValue(req.body)
  sanitizeValue(req.params)
  sanitizeValue(req.query)
  next()
}

module.exports = { sanitizeRequest }
