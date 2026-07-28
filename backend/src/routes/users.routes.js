const express = require('express')
const { authenticate, authenticateOptional } = require('../middlewares/authenticate')
const { validateRequest } = require('../middlewares/validateRequest')
const {
  getMyProfile,
  getProfileByUsername,
  checkUsernameAvailability,
  searchUsers,
  getDiscoverySuggestions,
  updateDiscoveryLocation,
  getMyConnections,
  getProfileConnections,
  updateMyProfile,
  toggleFollowByUsername,
  changeMyPassword,
  deleteMyAccount,
  getMyVerificationRequest,
  createMyVerificationRequest,
  updateMyVerificationRequest,
  withdrawMyVerificationRequest,
} = require('../controllers/usersController')
const {
  getProfileSchema,
  checkUsernameAvailabilitySchema,
  searchUsersSchema,
  getDiscoverySuggestionsSchema,
  updateDiscoveryLocationSchema,
  getMyConnectionsSchema,
  getProfileConnectionsSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  createVerificationRequestSchema,
  updateVerificationRequestSchema,
} = require('../validators/userValidators')

const usersRouter = express.Router()

usersRouter.get(
  '/username-availability',
  authenticateOptional,
  validateRequest(checkUsernameAvailabilitySchema),
  checkUsernameAvailability,
)
usersRouter.get(
  '/search',
  authenticateOptional,
  validateRequest(searchUsersSchema),
  searchUsers,
)
usersRouter.get(
  '/discovery/suggestions',
  authenticateOptional,
  validateRequest(getDiscoverySuggestionsSchema),
  getDiscoverySuggestions,
)
usersRouter.post(
  '/discovery/location',
  authenticate,
  validateRequest(updateDiscoveryLocationSchema),
  updateDiscoveryLocation,
)
usersRouter.get('/me/profile', authenticate, getMyProfile)
usersRouter.get('/me/verification-request', authenticate, getMyVerificationRequest)
usersRouter.post(
  '/me/verification-requests',
  authenticate,
  validateRequest(createVerificationRequestSchema),
  createMyVerificationRequest,
)
usersRouter.patch(
  '/me/verification-request',
  authenticate,
  validateRequest(updateVerificationRequestSchema),
  updateMyVerificationRequest,
)
usersRouter.delete('/me/verification-request', authenticate, withdrawMyVerificationRequest)
usersRouter.get(
  '/me/:connectionType',
  authenticate,
  validateRequest(getMyConnectionsSchema),
  getMyConnections,
)
usersRouter.patch(
  '/me/profile',
  authenticate,
  validateRequest(updateProfileSchema),
  updateMyProfile,
)
usersRouter.patch(
  '/me/password',
  authenticate,
  validateRequest(changePasswordSchema),
  changeMyPassword,
)
usersRouter.delete(
  '/me',
  authenticate,
  validateRequest(deleteAccountSchema),
  deleteMyAccount,
)
usersRouter.get(
  '/profile/:username',
  authenticateOptional,
  validateRequest(getProfileSchema),
  getProfileByUsername,
)
usersRouter.post(
  '/profile/:username/follow',
  authenticate,
  validateRequest(getProfileSchema),
  toggleFollowByUsername,
)
usersRouter.get(
  '/profile/:username/:connectionType',
  authenticateOptional,
  validateRequest(getProfileConnectionsSchema),
  getProfileConnections,
)

module.exports = { usersRouter }
