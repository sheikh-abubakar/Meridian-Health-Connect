# Meridian Health Connect — Pilot Zero POC

Step 1 provides the tenant-aware Express/MongoDB foundation and a working React login flow.

## Local setup

1. Copy `backend/.env.example` to `backend/.env`. Replace `YOUR_URL_ENCODED_PASSWORD` and `JWT_SECRET` locally.
2. Optionally copy `frontend/.env.example` to `frontend/.env`.
3. Run `npm run install:all` from the repository root.
4. Run `npm run seed --prefix backend`.
5. In separate terminals, run `npm run dev:backend` and `npm run dev:frontend`.
6. Open `http://localhost:5173/login`. The authenticated account resolves its tenant and is redirected to `/:tenantSlug/dashboard`.

Seeded admin emails are `admin@citycare.test` and `admin@greenvalley.test`. Their password is the local `SEED_ADMIN_PASSWORD` value.

## Step 1 API

- `GET /api/health`
- `POST /api/auth/login` (public login with tenant discovery)
- `POST /api/:tenantSlug/auth/login`
- `GET /api/:tenantSlug/auth/me` (Bearer token required)

Tenants and their first Clinic Admin are created by the seed script, simulating Meridian Super Admin onboarding without adding an out-of-scope Super Admin UI.
