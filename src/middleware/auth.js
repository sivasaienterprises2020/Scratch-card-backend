import { ApiError } from '../utils/api-error.js';
import { verifyToken } from '../utils/security.js';
import { query } from '../config/database.js';

function tokenFromHeader(req) {
  const value = req.headers.authorization;
  if (!value?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication token is required', 'AUTH_REQUIRED');
  }
  return value.slice(7);
}

function authenticate(role) {
  return (req, _res, next) => {
    try {
      const payload = verifyToken(tokenFromHeader(req));
      if (payload.role !== role) throw new ApiError(403, 'Access denied', 'FORBIDDEN');
      req.auth = payload;
      next();
    } catch (error) {
      if (error instanceof ApiError) return next(error);
      next(new ApiError(401, 'Token is invalid or expired', 'INVALID_TOKEN'));
    }
  };
}

export const requireParticipant = authenticate('participant');
export const requireAdmin = authenticate('admin');

// Admin access is intentionally passwordless for this private admin app.
// Use the first active admin as the database actor so audit logs and claims
// continue to satisfy their admin-user foreign keys.
export async function useSystemAdmin(req, _res, next) {
  try {
    const result = await query(
      `SELECT id, full_name, email
       FROM admin_users
       WHERE is_active = TRUE
       ORDER BY created_at ASC
       LIMIT 1`
    );
    if (!result.rowCount) {
      throw new ApiError(503, 'No active admin is configured', 'ADMIN_NOT_CONFIGURED');
    }
    req.auth = { sub: result.rows[0].id, role: 'admin' };
    req.admin = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}
