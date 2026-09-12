const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const SCRYPT_PREFIX = 'scrypt:v1:'
const KEY_LEN = 64
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
}

function isBcryptHash(storedHash) {
  const hash = String(storedHash || '').trim()
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')
}

function isScryptHash(storedHash) {
  return String(storedHash || '').trim().startsWith(SCRYPT_PREFIX)
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex')
    crypto.scrypt(String(password), salt, KEY_LEN, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(`${SCRYPT_PREFIX}${salt}:${derivedKey.toString('hex')}`)
    })
  })
}

function verifyScrypt(candidatePassword, storedHash) {
  return new Promise((resolve, reject) => {
    const parts = String(storedHash).split(':')
    if (parts.length !== 4 || `${parts[0]}:${parts[1]}:` !== SCRYPT_PREFIX) {
      return resolve(false)
    }

    const salt = parts[2]
    const expectedKeyHex = parts[3]
    const expectedBuffer = Buffer.from(expectedKeyHex, 'hex')

    crypto.scrypt(
      String(candidatePassword),
      salt,
      expectedBuffer.length,
      SCRYPT_OPTIONS,
      (err, derivedKey) => {
        if (err) return reject(err)
        if (expectedBuffer.length !== derivedKey.length) return resolve(false)
        resolve(crypto.timingSafeEqual(expectedBuffer, derivedKey))
      },
    )
  })
}

async function verifyPassword(candidatePassword, storedHash) {
  const hash = String(storedHash || '').trim()

  if (!hash || !candidatePassword) {
    return { valid: false, needsRehash: false }
  }

  if (isScryptHash(hash)) {
    const valid = await verifyScrypt(candidatePassword, hash)
    return { valid, needsRehash: false }
  }

  if (isBcryptHash(hash)) {
    const valid = await bcrypt.compare(String(candidatePassword), hash)
    return { valid, needsRehash: valid }
  }

  // Fallback for any unknown hash format
  try {
    const valid = await bcrypt.compare(String(candidatePassword), hash)
    return { valid, needsRehash: valid }
  } catch {
    return { valid: false, needsRehash: false }
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  isBcryptHash,
  isScryptHash,
}
