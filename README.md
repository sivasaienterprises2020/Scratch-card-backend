# Reward Campaign Backend

Backend API for the three-step customer campaign:

1. Customer registration
2. Google review-link visit and customer confirmation
3. Spin wheel or scratch-card reward

## Windows installation

Extract this project so the folder is:

```text
D:\asian-paints\backend
```

Open Command Prompt:

```bat
cd /d D:\asian-paints\backend
copy .env.example .env
npm install
```

Edit `.env` and add the rotated Neon connection string, JWT secret and IP hash salt.

Generate two secure random values in PowerShell:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Use one output for `JWT_SECRET` and another for `IP_HASH_SALT`.

Start the API:

```bat
npm run dev
```

Check:

```text
http://localhost:5000/
http://localhost:5000/api/health
```

## Initial setup

Create the first admin once:

```http
POST /api/admin/auth/setup
Content-Type: application/json

{
  "fullName": "Administrator",
  "email": "admin@example.com",
  "password": "ChangeThisStrongPassword"
}
```

Then log in through `POST /api/admin/auth/login` and update the campaign:

- Replace the placeholder Google review URL.
- Set the campaign status from `draft` to `active`.
- Choose `spin` or `scratch`.
- Update gift names, images, stock and selection weights.

## Main API routes

### Public

- `GET /api/public/campaigns/:slug`
- `POST /api/public/campaigns/:slug/register`
- `GET /api/public/participants/me`
- `POST /api/public/participants/review/open`
- `POST /api/public/participants/review/return`
- `POST /api/public/participants/review/confirm`
- `POST /api/public/participants/play`

Participant routes after registration require `Authorization: Bearer <participant-token>`.

### Admin

- `POST /api/admin/auth/setup`
- `POST /api/admin/auth/login`
- `GET /api/admin/auth/me`
- `GET /api/admin/campaigns`
- `PATCH /api/admin/campaigns/:campaignId`
- `GET /api/admin/campaigns/:campaignId/dashboard`
- `GET /api/admin/campaigns/:campaignId/participants`
- `GET /api/admin/campaigns/:campaignId/rewards`
- `PATCH /api/admin/campaigns/:campaignId/rewards/:rewardId`
- `POST /api/admin/claims/:claimCode/complete`
- `GET /api/admin/audit-logs`

Protected admin routes require `Authorization: Bearer <admin-token>`.

## Reward image uploads

Add Cloudinary credentials to `.env`. The reward update endpoint accepts either:

- JSON with an `imageUrl`, or
- `multipart/form-data` with a file field named `image`.

Accepted formats: JPG, PNG and WebP, maximum 5 MB.

## Google review limitation

Google does not provide a normal API that proves an individual customer submitted a public review. This backend records that the link was opened, the customer returned, and the customer confirmed completion. The frontend and backend must not claim independent verification of the review itself.
