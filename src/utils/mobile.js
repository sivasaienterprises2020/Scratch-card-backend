import { ApiError } from './api-error.js';

export function normalizeMobile(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number', 'INVALID_MOBILE');
  }
  return digits;
}
