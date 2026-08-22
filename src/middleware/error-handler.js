import multer from 'multer';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error.js';

export function notFound(req, _res, next) {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} was not found`, 'NOT_FOUND'));
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted details', details: error.flatten() }
    });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: error.message } });
  }

  if (error?.code === '23505') {
    const duplicateMobile = error.constraint === 'participants_campaign_id_mobile_normalized_key';
    return res.status(409).json({
      success: false,
      error: {
        code: duplicateMobile ? 'MOBILE_ALREADY_REGISTERED' : 'DUPLICATE_RECORD',
        message: duplicateMobile ? 'This mobile number has already participated' : 'This record already exists'
      }
    });
  }

  const status = error instanceof ApiError ? error.status : 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: status === 500 ? 'Something went wrong. Please try again.' : error.message,
      ...(error.details ? { details: error.details } : {})
    }
  });
}
