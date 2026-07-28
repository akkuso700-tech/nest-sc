import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPostSharePayload,
  buildPostShareUrl,
  buildShareTargets,
} from '../src/utils/postShare.js'

test('share links tolerate malformed Unicode from stored post data', () => {
  const malformedText = `before\ud800after\udc00`
  const shareUrl = buildPostShareUrl({
    postId: 'post-1',
    slug: malformedText,
    lang: 'tr',
    origin: 'https://nest-sc.com',
  })
  const payload = buildPostSharePayload({
    postId: 'post-1',
    post: {
      slug: malformedText,
      text: malformedText,
      author: { username: malformedText },
    },
    lang: 'tr',
    origin: 'https://nest-sc.com',
  })
  const targets = buildShareTargets(payload)

  assert.match(shareUrl, /before%EF%BF%BDafter%EF%BF%BD/)
  assert.match(targets.whatsapp, /^https:\/\/wa\.me\/\?text=/)
  assert.match(targets.x, /^https:\/\/twitter\.com\/intent\/tweet\?/)
  assert.match(targets.facebook, /^https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?/)
})
