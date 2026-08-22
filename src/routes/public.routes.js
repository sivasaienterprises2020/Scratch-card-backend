import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { requireParticipant } from '../middleware/auth.js';
import {
  confirmReview, getCampaign, openReview, participantMe,
  play, register, returnFromReview
} from '../controllers/public.controller.js';

const router = Router();

router.get('/campaigns/:slug', asyncHandler(getCampaign));
router.post('/campaigns/:slug/register', asyncHandler(register));
router.get('/participants/me', requireParticipant, asyncHandler(participantMe));
router.post('/participants/review/open', requireParticipant, asyncHandler(openReview));
router.post('/participants/review/return', requireParticipant, asyncHandler(returnFromReview));
router.post('/participants/review/confirm', requireParticipant, asyncHandler(confirmReview));
router.post('/participants/play', requireParticipant, asyncHandler(play));

export default router;
