const test = require('node:test')
const assert = require('node:assert/strict')
const { updateProfileSchema } = require('../src/validators/userValidators')
const { serializeUser } = require('../src/utils/tokens')

test('updateProfileSchema accepts shadowMessages in emailNotifications and inAppNotifications', () => {
  const input = {
    body: {
      preferences: {
        emailNotifications: {
          messages: true,
          mentions: true,
          shadowMessages: true,
        },
        inAppNotifications: {
          shadowMessages: true,
        },
        calling: {
          voiceCallEnabled: true,
          videoCallEnabled: false,
        },
      },
    },
  }

  const result = updateProfileSchema.safeParse(input)
  assert.equal(result.success, true)
  assert.equal(result.data.body.preferences.emailNotifications.shadowMessages, true)
  assert.equal(result.data.body.preferences.inAppNotifications.shadowMessages, true)
})

test('serializeUser includes shadowMessages in emailNotifications and inAppNotifications', () => {
  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    username: 'johndoe',
    preferences: {
      emailNotifications: {
        messages: true,
        mentions: false,
        shadowMessages: true,
      },
      inAppNotifications: {
        shadowMessages: true,
      },
      calling: {
        voiceCallEnabled: true,
        videoCallEnabled: true,
      },
    },
  }

  const serialized = serializeUser(mockUser)
  assert.equal(serialized.preferences.emailNotifications.shadowMessages, true)
  assert.equal(serialized.preferences.inAppNotifications.shadowMessages, true)

  // Default / false case
  const mockUserOff = {
    _id: '507f1f77bcf86cd799439012',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    username: 'janedoe',
    preferences: {},
  }

  const serializedOff = serializeUser(mockUserOff)
  assert.equal(serializedOff.preferences.emailNotifications.shadowMessages, false)
  assert.equal(serializedOff.preferences.inAppNotifications.shadowMessages, false)
})
