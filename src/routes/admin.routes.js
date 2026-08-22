import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadRewardImage } from '../middleware/upload.js';
import {
  adminMe, auditLogs, claimReward, dashboard, listCampaigns, listRewards,
  login, participants, setupAdmin, updateCampaign, updateReward
} from '../controllers/admin.controller.js';

const router = Router();

router.post('/auth/setup', asyncHandler(setupAdmin));
router.post('/auth/login', asyncHandler(login));
router.get('/auth/me', requireAdmin, asyncHandler(adminMe));
router.get('/campaigns', requireAdmin, asyncHandler(listCampaigns));
router.patch('/campaigns/:campaignId', requireAdmin, asyncHandler(updateCampaign));
router.get('/campaigns/:campaignId/dashboard', requireAdmin, asyncHandler(dashboard));
router.get('/campaigns/:campaignId/participants', requireAdmin, asyncHandler(participants));
router.get('/campaigns/:campaignId/rewards', requireAdmin, asyncHandler(listRewards));
router.patch(
  '/campaigns/:campaignId/rewards/:rewardId',
  requireAdmin,
  uploadRewardImage.single('image'),
  asyncHandler(updateReward)
);
router.post('/claims/:claimCode/complete', requireAdmin, asyncHandler(claimReward));
router.get('/audit-logs', requireAdmin, asyncHandler(auditLogs));

export default router;
