import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const configured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
if (configured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

export function uploadImage(buffer) {
  if (!configured) {
    throw new ApiError(503, 'Image storage is not configured. Add Cloudinary credentials.', 'STORAGE_NOT_CONFIGURED');
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: env.CLOUDINARY_FOLDER, resource_type: 'image', overwrite: false },
      (error, result) => error ? reject(error) : resolve(result.secure_url)
    );
    stream.end(buffer);
  });
}
