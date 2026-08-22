import multer from 'multer';
import { ApiError } from '../utils/api-error.js';

export const uploadRewardImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new ApiError(400, 'Only JPG, PNG and WebP images are allowed', 'INVALID_IMAGE'));
    }
    callback(null, true);
  }
});
