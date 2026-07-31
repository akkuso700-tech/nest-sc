const multer = require('multer')
const { ZodError } = require('zod')

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500

  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Dogrulama basarisiz oldu.',
      issues: error.issues,
    })
    return
  }

  if (error.code === 11000) {
    res.status(409).json({
      message: 'Benzersiz olmasi gereken bir alan zaten mevcut.',
      duplicateKey: error.keyValue,
    })
    return
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    res.status(401).json({
      message: 'Token gecersiz veya suresi dolmus.',
    })
    return
  }

  if (error instanceof multer.MulterError) {
    const messageByCode = {
      LIMIT_FILE_SIZE: 'Yuklenen her dosya en fazla 100 MB olabilir.',
      LIMIT_FILE_COUNT: 'Bu islem icin cok fazla dosya yuklendi.',
      LIMIT_UNEXPECTED_FILE: 'Beklenmeyen bir yukleme alani gonderildi.',
    }

    res.status(400).json({
      message: messageByCode[error.code] || 'Yukleme dogrulamasi basarisiz oldu.',
      details: { code: error.code },
    })
    return
  }

  res.status(statusCode).json({
    message: error.message || 'Bir seyler ters gitti.',
    details: error.details || null,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
  })
}

module.exports = { errorHandler }
