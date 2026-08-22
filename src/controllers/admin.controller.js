import argon2 from 'argon2';
import { query } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { signAdminToken } from '../utils/security.js';
import { audit } from '../services/audit.service.js';
import { uploadImage } from '../services/storage.service.js';
import { campaignUpdateSchema, loginSchema, rewardUpdateSchema, setupAdminSchema } from '../validators/schemas.js';

export async function setupAdmin(req, res) {
  const body = setupAdminSchema.parse(req.body);
  const count = await query('SELECT COUNT(*)::int AS count FROM admin_users');
  if (count.rows[0].count > 0) throw new ApiError(409, 'Initial admin already exists', 'ADMIN_EXISTS');
  const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
  const result = await query(
    `INSERT INTO admin_users (full_name, email, password_hash)
     VALUES ($1, lower($2), $3)
     RETURNING id, full_name, email, is_active, created_at`,
    [body.fullName, body.email, passwordHash]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}

export async function login(req, res) {
  const body = loginSchema.parse(req.body);
  const result = await query('SELECT * FROM admin_users WHERE lower(email) = lower($1)', [body.email]);
  const admin = result.rows[0];
  if (!admin || !admin.is_active || !(await argon2.verify(admin.password_hash, body.password))) {
    throw new ApiError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS');
  }
  await query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [admin.id]);
  res.json({
    success: true,
    data: { token: signAdminToken(admin), admin: { id: admin.id, fullName: admin.full_name, email: admin.email } }
  });
}

export async function adminMe(req, res) {
  const result = await query(
    'SELECT id, full_name, email, last_login_at, created_at FROM admin_users WHERE id = $1 AND is_active = TRUE',
    [req.auth.sub]
  );
  if (!result.rowCount) throw new ApiError(404, 'Admin not found', 'ADMIN_NOT_FOUND');
  res.json({ success: true, data: result.rows[0] });
}

export async function dashboard(req, res) {
  const campaignId = req.params.campaignId;
  const [summary, stock, recent] = await Promise.all([
    query('SELECT * FROM campaign_admin_summary WHERE campaign_id = $1', [campaignId]),
    query(
      `SELECT id, name, reward_type, image_url, initial_stock, remaining_stock,
              selection_weight, display_order, is_active
       FROM rewards WHERE campaign_id = $1 ORDER BY display_order`,
      [campaignId]
    ),
    query(
      `SELECT p.id, p.full_name, p.mobile, p.email, p.status, p.registered_at,
              r.name AS reward_name, pl.result, pl.claim_status, pl.played_at
       FROM participants p
       LEFT JOIN plays pl ON pl.participant_id = p.id
       LEFT JOIN rewards r ON r.id = pl.reward_id
       WHERE p.campaign_id = $1 ORDER BY p.registered_at DESC LIMIT 10`,
      [campaignId]
    )
  ]);
  res.json({ success: true, data: { summary: summary.rows[0] ?? null, rewards: stock.rows, recentParticipants: recent.rows } });
}

export async function listCampaigns(_req, res) {
  const result = await query('SELECT * FROM campaigns ORDER BY created_at DESC');
  res.json({ success: true, data: result.rows });
}

export async function updateCampaign(req, res) {
  const body = campaignUpdateSchema.parse(req.body);
  const old = await query('SELECT * FROM campaigns WHERE id = $1', [req.params.campaignId]);
  if (!old.rowCount) throw new ApiError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND');
  const result = await query(
    `UPDATE campaigns SET
       name = COALESCE($2, name), google_review_url = COALESCE($3, google_review_url),
       game = COALESCE($4::game_type, game), status = COALESCE($5::campaign_status, status),
       primary_colour = COALESCE($6, primary_colour), secondary_colour = COALESCE($7, secondary_colour),
       logo_url = CASE WHEN $8::boolean THEN $9 ELSE logo_url END,
       hero_image_url = CASE WHEN $10::boolean THEN $11 ELSE hero_image_url END,
       terms_text = CASE WHEN $12::boolean THEN $13 ELSE terms_text END
     WHERE id = $1 RETURNING *`,
    [req.params.campaignId, body.name, body.googleReviewUrl, body.game, body.status,
      body.primaryColour, body.secondaryColour,
      Object.hasOwn(body, 'logoUrl'), body.logoUrl,
      Object.hasOwn(body, 'heroImageUrl'), body.heroImageUrl,
      Object.hasOwn(body, 'termsText'), body.termsText]
  );
  await audit(req.auth.sub, 'UPDATE_CAMPAIGN', 'campaign', req.params.campaignId, old.rows[0], result.rows[0]);
  res.json({ success: true, data: result.rows[0] });
}

export async function participants(req, res) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const offset = (page - 1) * limit;
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const result = await query(
    `SELECT p.id, p.full_name, p.gender, p.mobile, p.email, p.status, p.registered_at,
            rp.review_opened_at, rp.returned_at, rp.confirmed_at,
            r.name AS reward_name, pl.result, pl.claim_code, pl.claim_status, pl.played_at,
            COUNT(*) OVER()::int AS total_count
     FROM participants p
     LEFT JOIN review_progress rp ON rp.participant_id = p.id
     LEFT JOIN plays pl ON pl.participant_id = p.id
     LEFT JOIN rewards r ON r.id = pl.reward_id
     WHERE p.campaign_id = $1
       AND ($2 = '' OR p.full_name ILIKE '%' || $2 || '%' OR p.mobile ILIKE '%' || $2 || '%' OR p.email ILIKE '%' || $2 || '%')
       AND ($3 = '' OR p.status::text = $3)
     ORDER BY p.registered_at DESC LIMIT $4 OFFSET $5`,
    [req.params.campaignId, search, status, limit, offset]
  );
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.rows[0]?.total_count ?? 0 } });
}

export async function listRewards(req, res) {
  const result = await query('SELECT * FROM rewards WHERE campaign_id = $1 ORDER BY display_order', [req.params.campaignId]);
  res.json({ success: true, data: result.rows });
}

export async function updateReward(req, res) {
  const body = rewardUpdateSchema.parse(req.body);
  const old = await query(
    'SELECT * FROM rewards WHERE id = $1 AND campaign_id = $2',
    [req.params.rewardId, req.params.campaignId]
  );
  if (!old.rowCount) throw new ApiError(404, 'Reward not found', 'REWARD_NOT_FOUND');
  if (old.rows[0].reward_type === 'better_luck' && (body.initialStock !== undefined || body.addStock !== undefined)) {
    throw new ApiError(400, 'Better Luck does not use stock', 'INVALID_STOCK');
  }
  const current = old.rows[0];
  let initialStock = current.initial_stock;
  let remainingStock = current.remaining_stock;
  if (body.initialStock !== undefined) {
    const alreadyAwarded = current.initial_stock - current.remaining_stock;
    if (body.initialStock < alreadyAwarded) {
      throw new ApiError(400, `Stock cannot be below ${alreadyAwarded}, because those gifts are already awarded`, 'STOCK_TOO_LOW');
    }
    initialStock = body.initialStock;
    remainingStock = body.initialStock - alreadyAwarded;
  } else if (body.addStock !== undefined) {
    initialStock += body.addStock;
    remainingStock += body.addStock;
  }
  const imageUrl = req.file ? await uploadImage(req.file.buffer) : body.imageUrl;
  const result = await query(
    `UPDATE rewards SET
       name = COALESCE($3, name),
       description = CASE WHEN $4::boolean THEN $5 ELSE description END,
       image_url = CASE WHEN $6::boolean THEN $7 ELSE image_url END,
       initial_stock = $8, remaining_stock = $9,
       selection_weight = COALESCE($10, selection_weight),
       display_order = COALESCE($11, display_order),
       is_active = COALESCE($12, is_active)
     WHERE id = $1 AND campaign_id = $2 RETURNING *`,
    [req.params.rewardId, req.params.campaignId, body.name,
      Object.hasOwn(body, 'description'), body.description,
      Boolean(req.file) || Object.hasOwn(body, 'imageUrl'), imageUrl,
      initialStock, remainingStock, body.selectionWeight, body.displayOrder, body.isActive]
  );
  await audit(req.auth.sub, 'UPDATE_REWARD', 'reward', req.params.rewardId, current, result.rows[0]);
  res.json({ success: true, data: result.rows[0] });
}

export async function claimReward(req, res) {
  const claimCode = String(req.params.claimCode).trim().toUpperCase();
  const old = await query(
    `SELECT pl.*, r.name AS reward_name, p.full_name, p.mobile
     FROM plays pl JOIN rewards r ON r.id = pl.reward_id JOIN participants p ON p.id = pl.participant_id
     WHERE pl.claim_code = $1`,
    [claimCode]
  );
  if (!old.rowCount) throw new ApiError(404, 'Claim code not found', 'CLAIM_NOT_FOUND');
  if (old.rows[0].claim_status === 'claimed') throw new ApiError(409, 'This reward was already claimed', 'ALREADY_CLAIMED');
  const result = await query(
    `UPDATE plays SET claim_status = 'claimed', claimed_at = NOW(), claimed_by_admin_id = $2
     WHERE claim_code = $1 AND claim_status = 'pending'
     RETURNING *`,
    [claimCode, req.auth.sub]
  );
  await audit(req.auth.sub, 'CLAIM_REWARD', 'play', old.rows[0].id, old.rows[0], result.rows[0]);
  res.json({ success: true, data: { ...result.rows[0], rewardName: old.rows[0].reward_name, customerName: old.rows[0].full_name, mobile: old.rows[0].mobile } });
}

export async function auditLogs(req, res) {
  const result = await query(
    `SELECT l.*, a.full_name AS admin_name
     FROM admin_audit_logs l LEFT JOIN admin_users a ON a.id = l.admin_user_id
     ORDER BY l.created_at DESC LIMIT 200`
  );
  res.json({ success: true, data: result.rows });
}
