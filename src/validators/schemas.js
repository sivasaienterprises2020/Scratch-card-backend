import { z } from 'zod';

export const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  mobile: z.string().min(10).max(20),
  email: z.email().max(254),
  consentAccepted: z.literal(true)
});

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128)
});

export const setupAdminSchema = loginSchema.extend({
  fullName: z.string().trim().min(2).max(120)
});

export const rewardUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  initialStock: z.coerce.number().int().min(0).optional(),
  addStock: z.coerce.number().int().min(1).optional(),
  selectionWeight: z.coerce.number().int().min(0).max(100000).optional(),
  displayOrder: z.coerce.number().int().min(0).max(32767).optional(),
  isActive: z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]).optional(),
  imageUrl: z.url().nullable().optional()
}).refine((data) => !(data.initialStock !== undefined && data.addStock !== undefined), {
  message: 'Use either initialStock or addStock, not both'
});

export const campaignUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  googleReviewUrl: z.url().optional(),
  game: z.enum(['spin', 'scratch']).optional(),
  status: z.enum(['draft', 'active', 'paused', 'ended']).optional(),
  primaryColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.url().nullable().optional(),
  heroImageUrl: z.url().nullable().optional(),
  termsText: z.string().max(5000).nullable().optional()
});
