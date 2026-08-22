import { ApiError } from '../utils/api-error.js';
import { verifyToken } from '../utils/security.js';

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
