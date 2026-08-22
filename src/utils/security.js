import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const hashIp = (ip) =>
  crypto.createHmac('sha256', env.IP_HASH_SALT).update(ip || 'unknown').digest('hex');

export function signParticipantToken(participant) {
  return jwt.sign(
    { sub: participant.id, campaignId: participant.campaign_id, role: 'participant' },
    env.JWT_SECRET,
    { expiresIn: env.PARTICIPANT_TOKEN_TTL }
  );
}

export function signAdminToken(admin) {
  return jwt.sign(
    { sub: admin.id, role: 'admin', email: admin.email },
    env.JWT_SECRET,
    { expiresIn: env.ADMIN_TOKEN_TTL }
  );
}

export const verifyToken = (token) => jwt.verify(token, env.JWT_SECRET);
