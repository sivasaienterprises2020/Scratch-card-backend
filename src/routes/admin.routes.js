import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { useSystemAdmin } from '../middleware/auth.js';
import { uploadRewardImage } from '../middleware/upload.js';
import {
  auditLogs, claimReward, dashboard, listCampaigns, listRewards,
  participants, updateCampaign, updateReward
} from '../controllers/admin.controller.js';

const router = Router();

router.use(useSystemAdmin);

router.get('/campaigns', asyncHandler(listCampaigns));
router.patch('/campaigns/:campaignId', asyncHandler(updateCampaign));
router.get('/campaigns/:campaignId/dashboard', asyncHandler(dashboard));
router.get('/campaigns/:campaignId/participants', asyncHandler(participants));
router.get('/campaigns/:campaignId/rewards', asyncHandler(listRewards));
router.patch(
  '/campaigns/:campaignId/rewards/:rewardId',
  uploadRewardImage.single('image'),
  asyncHandler(updateReward)
);
router.post('/claims/:claimCode/complete', asyncHandler(claimReward));
router.get('/audit-logs', asyncHandler(auditLogs));

export default router;
