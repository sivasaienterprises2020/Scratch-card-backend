import { query } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { normalizeMobile } from '../utils/mobile.js';
import { hashIp, signParticipantToken } from '../utils/security.js';
import { registrationSchema } from '../validators/schemas.js';

export async function getCampaign(req, res) {
  const result = await query(
    `SELECT c.id, c.name, c.slug, c.google_review_url, c.game, c.status,
            c.primary_colour, c.secondary_colour, c.logo_url, c.hero_image_url, c.terms_text,
            COALESCE(json_agg(json_build_object(
              'id', r.id, 'name', r.name, 'description', r.description,
              'rewardType', r.reward_type, 'imageUrl', r.image_url,
              'displayOrder', r.display_order
            ) ORDER BY r.display_order) FILTER (WHERE r.id IS NOT NULL), '[]') AS rewards
     FROM campaigns c
     LEFT JOIN rewards r ON r.campaign_id = c.id AND r.is_active = TRUE
     WHERE c.slug = $1
     GROUP BY c.id`,
    [req.params.slug]
  );
  if (!result.rowCount) throw new ApiError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND');
  res.json({ success: true, data: result.rows[0] });
}

export async function register(req, res) {
  const body = registrationSchema.parse(req.body);
  const mobile = normalizeMobile(body.mobile);
  const campaignResult = await query(
    `SELECT id FROM campaigns
     WHERE slug = $1 AND status = 'active'
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())`,
    [req.params.slug]
  );
  if (!campaignResult.rowCount) throw new ApiError(404, 'Campaign is not currently active', 'CAMPAIGN_INACTIVE');

  const campaignId = campaignResult.rows[0].id;
  const result = await query(
    `INSERT INTO participants
       (campaign_id, full_name, gender, mobile, mobile_normalized, email, consent_accepted_at)
     VALUES ($1, $2, $3, $4, $5, lower($6), NOW())
     RETURNING id, campaign_id, full_name, gender, mobile, email, status, registered_at`,
    [campaignId, body.fullName, body.gender, body.mobile, mobile, body.email]
  );
  const participant = result.rows[0];
  res.status(201).json({ success: true, data: { participant, token: signParticipantToken(participant) } });
}

export async function participantMe(req, res) {
  const result = await query(
    `SELECT p.id, p.full_name, p.gender, p.mobile, p.email, p.status, p.registered_at,
            rp.review_opened_at, rp.returned_at, rp.confirmed_at,
            pl.result, pl.claim_code, pl.claim_status, pl.played_at,
            r.name AS reward_name, r.image_url AS reward_image_url
     FROM participants p
     LEFT JOIN review_progress rp ON rp.participant_id = p.id
     LEFT JOIN plays pl ON pl.participant_id = p.id
     LEFT JOIN rewards r ON r.id = pl.reward_id
     WHERE p.id = $1 AND p.campaign_id = $2`,
    [req.auth.sub, req.auth.campaignId]
  );
  if (!result.rowCount) throw new ApiError(404, 'Participant not found', 'PARTICIPANT_NOT_FOUND');
  res.json({ success: true, data: result.rows[0] });
}

export async function openReview(req, res) {
  const participant = await query(
    `SELECT p.id, p.status, c.google_review_url
     FROM participants p JOIN campaigns c ON c.id = p.campaign_id
     WHERE p.id = $1 AND p.campaign_id = $2`,
    [req.auth.sub, req.auth.campaignId]
  );
  if (!participant.rowCount) throw new ApiError(404, 'Participant not found', 'PARTICIPANT_NOT_FOUND');
  if (participant.rows[0].status === 'played') throw new ApiError(409, 'Campaign already played', 'ALREADY_PLAYED');

  await query(
    `INSERT INTO review_progress (participant_id)
     VALUES ($1)
     ON CONFLICT (participant_id) DO NOTHING`,
    [req.auth.sub]
  );
  await query(
    `UPDATE participants SET status = 'review_opened'
     WHERE id = $1 AND status = 'registered'`,
    [req.auth.sub]
  );
  res.json({ success: true, data: { reviewUrl: participant.rows[0].google_review_url } });
}

export async function returnFromReview(req, res) {
  const result = await query(
    `UPDATE review_progress SET returned_at = COALESCE(returned_at, NOW())
     WHERE participant_id = $1 RETURNING returned_at`,
    [req.auth.sub]
  );
  if (!result.rowCount) throw new ApiError(409, 'Open the review link first', 'REVIEW_NOT_OPENED');
  res.json({ success: true, data: result.rows[0] });
}

export async function confirmReview(req, res) {
  const result = await query(
    `UPDATE review_progress
     SET confirmed_at = COALESCE(confirmed_at, NOW()),
         confirmation_ip_hash = $2,
         confirmation_user_agent = left($3, 500)
     WHERE participant_id = $1 AND returned_at IS NOT NULL
     RETURNING confirmed_at`,
    [req.auth.sub, hashIp(req.ip), req.get('user-agent') || 'unknown']
  );
  if (!result.rowCount) throw new ApiError(409, 'Return from the review page before confirming', 'REVIEW_RETURN_REQUIRED');
  await query(
    `UPDATE participants SET status = 'review_confirmed'
     WHERE id = $1 AND status <> 'played'`,
    [req.auth.sub]
  );
  res.json({ success: true, data: result.rows[0] });
}

export async function play(req, res) {
  try {
    const result = await query(
      'SELECT * FROM play_campaign($1::uuid, $2::uuid)',
      [req.auth.campaignId, req.auth.sub]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    const message = String(error.message || '');
    if (message.includes('already played')) throw new ApiError(409, 'You have already played', 'ALREADY_PLAYED');
    if (message.includes('Review step')) throw new ApiError(409, 'Complete the review step first', 'REVIEW_REQUIRED');
    if (message.includes('No rewards')) throw new ApiError(409, 'No rewards are currently available', 'NO_REWARDS');
    throw error;
  }
}
