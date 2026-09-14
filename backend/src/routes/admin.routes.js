const express = require('express')
const { authenticate } = require('../middlewares/authenticate')
const { authorizeRoles } = require('../middlewares/authorizeRoles')
const { validateRequest } = require('../middlewares/validateRequest')
const {
  getOverview,
  listUsers,
  getUsersSummary,
  getContentSummary,
  listAuditLogs,
  getUserDetail,
  listContent,
  listComments,
  listReports,
  updateUserRole,
  updateUserStatus,
  updatePostModeration,
  updateCommentModeration,
  bulkUpdateUserStatus,
  bulkDeleteUsers,
  bulkUpdatePostModeration,
  updateReportStatus,
  getSignupNotificationSettings,
  updateSignupNotificationSettings,
  getSignupContractsSettingsController,
  updateSignupContractsSettingsController,
  listVerificationRequests,
  getVerificationRequest,
  updateVerificationRequestStatus,
  revokeUserVerification,
  deleteAdminConversation,
  deleteAdminMessage,
  getAdminMonetizationSummary,
  listAdminCreatorApplications,
  updateAdminCreatorApplicationStatus,
  listAdminPayoutRequests,
  updateAdminPayoutRequestStatus,
  listAdminCreators,
  updateAdminCreatorWalletStatus,
} = require('../controllers/adminController')
const {
  adminOverviewSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  adminListUsersSchema,
  adminUsersSummarySchema,
  adminContentSummarySchema,
  adminUserIdSchema,
  adminListContentSchema,
  updatePostModerationSchema,
  bulkUserStatusSchema,
  bulkUserDeleteSchema,
  bulkPostModerationSchema,
  adminListCommentsSchema,
  updateCommentModerationSchema,
  adminListReportsSchema,
  updateReportStatusSchema,
  adminListAuditLogsSchema,
  adminSignupNotificationSettingsSchema,
  updateAdminSignupNotificationSettingsSchema,
  adminSignupContractsSettingsSchema,
  updateAdminSignupContractsSettingsSchema,
  adminListVerificationRequestsSchema,
  adminVerificationRequestIdSchema,
  updateVerificationRequestStatusSchema,
  revokeUserVerificationSchema,
  deleteAdminConversationSchema,
  deleteAdminMessageSchema,
  adminCreatorSummarySchema,
  adminListCreatorApplicationsSchema,
  adminCreatorApplicationIdSchema,
  updateCreatorApplicationStatusSchema,
  adminListPayoutRequestsSchema,
  adminPayoutRequestIdSchema,
  updatePayoutRequestStatusSchema,
  adminListCreatorsSchema,
  updateCreatorWalletStatusSchema,
} = require('../validators/adminValidators')

const adminRouter = express.Router()

adminRouter.use(authenticate, authorizeRoles('admin'))
adminRouter.get('/overview', validateRequest(adminOverviewSchema), getOverview)
adminRouter.get('/audit-logs', validateRequest(adminListAuditLogsSchema), listAuditLogs)
adminRouter.get('/users', validateRequest(adminListUsersSchema), listUsers)
adminRouter.get(
  '/verification-requests',
  validateRequest(adminListVerificationRequestsSchema),
  listVerificationRequests,
)
adminRouter.get(
  '/verification-requests/:requestId',
  validateRequest(adminVerificationRequestIdSchema),
  getVerificationRequest,
)
adminRouter.patch(
  '/verification-requests/:requestId/status',
  validateRequest(updateVerificationRequestStatusSchema),
  updateVerificationRequestStatus,
)
adminRouter.get('/users/summary', validateRequest(adminUsersSummarySchema), getUsersSummary)
adminRouter.get('/content/summary', validateRequest(adminContentSummarySchema), getContentSummary)
adminRouter.get('/users/:userId', validateRequest(adminUserIdSchema), getUserDetail)
adminRouter.patch(
  '/users/:userId/role',
  validateRequest(updateUserRoleSchema),
  updateUserRole,
)
adminRouter.patch(
  '/users/:userId/status',
  validateRequest(updateUserStatusSchema),
  updateUserStatus,
)
adminRouter.patch(
  '/users/:userId/verification/revoke',
  validateRequest(revokeUserVerificationSchema),
  revokeUserVerification,
)
adminRouter.post(
  '/users/bulk-status',
  validateRequest(bulkUserStatusSchema),
  bulkUpdateUserStatus,
)
adminRouter.post(
  '/users/bulk-delete',
  validateRequest(bulkUserDeleteSchema),
  bulkDeleteUsers,
)
adminRouter.get('/content', validateRequest(adminListContentSchema), listContent)
adminRouter.post(
  '/content/bulk-moderation',
  validateRequest(bulkPostModerationSchema),
  bulkUpdatePostModeration,
)
adminRouter.patch(
  '/content/:postId/moderation',
  validateRequest(updatePostModerationSchema),
  updatePostModeration,
)
adminRouter.get('/comments', validateRequest(adminListCommentsSchema), listComments)
adminRouter.patch(
  '/comments/:commentId/moderation',
  validateRequest(updateCommentModerationSchema),
  updateCommentModeration,
)
adminRouter.get('/reports', validateRequest(adminListReportsSchema), listReports)
adminRouter.patch(
  '/reports/:reportId/status',
  validateRequest(updateReportStatusSchema),
  updateReportStatus,
)
adminRouter.get(
  '/settings/signup-notifications',
  validateRequest(adminSignupNotificationSettingsSchema),
  getSignupNotificationSettings,
)
adminRouter.patch(
  '/settings/signup-notifications',
  validateRequest(updateAdminSignupNotificationSettingsSchema),
  updateSignupNotificationSettings,
)
adminRouter.get(
  '/settings/contracts',
  validateRequest(adminSignupContractsSettingsSchema),
  getSignupContractsSettingsController,
)
adminRouter.delete(
  '/conversations/:conversationId',
  validateRequest(deleteAdminConversationSchema),
  deleteAdminConversation,
)
adminRouter.delete(
  '/messages/:messageId',
  validateRequest(deleteAdminMessageSchema),
  deleteAdminMessage,
)

// ==================== İÇERİK ÜRETİCİLERİ & PARA ÇEKME YÖNETİMİ ====================
adminRouter.get(
  '/creators/summary',
  validateRequest(adminCreatorSummarySchema),
  getAdminMonetizationSummary,
)
adminRouter.get(
  '/creators/applications',
  validateRequest(adminListCreatorApplicationsSchema),
  listAdminCreatorApplications,
)
adminRouter.patch(
  '/creators/applications/:applicationId/status',
  validateRequest(updateCreatorApplicationStatusSchema),
  updateAdminCreatorApplicationStatus,
)
adminRouter.get(
  '/creators/payouts',
  validateRequest(adminListPayoutRequestsSchema),
  listAdminPayoutRequests,
)
adminRouter.patch(
  '/creators/payouts/:payoutId/status',
  validateRequest(updatePayoutRequestStatusSchema),
  updateAdminPayoutRequestStatus,
)
adminRouter.get(
  '/creators/users',
  validateRequest(adminListCreatorsSchema),
  listAdminCreators,
)
adminRouter.patch(
  '/creators/users/:userId/wallet-status',
  validateRequest(updateCreatorWalletStatusSchema),
  updateAdminCreatorWalletStatus,
)

module.exports = { adminRouter }

