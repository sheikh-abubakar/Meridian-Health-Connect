# Meridian Health Connect — Pilot Zero POC

Step 1 provides the tenant-aware Express/MongoDB foundation and a working React login flow.

## Local setup

1. Copy `backend/.env.example` to `backend/.env`. Replace `YOUR_URL_ENCODED_PASSWORD` and `JWT_SECRET` locally.
2. Optionally copy `frontend/.env.example` to `frontend/.env`.
3. Run `npm run install:all` from the repository root.
4. Run `npm run seed --prefix backend`.
5. In separate terminals, run `npm run dev:backend` and `npm run dev:frontend`.
6. Open `http://localhost:5173/login`. An Admin is redirected to `/:tenantSlug/overview`; branch staff are redirected to `/:tenantSlug/:locationSlug/dashboard`.

## Production deployment

The frontend is prepared for Vercel and the persistent Socket.IO backend for AWS/DuckDNS. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for the exact environment variables, Vercel project settings, AWS process configuration, HTTPS reverse proxy, and post-deployment checks.

Seeded admin emails are `admin@citycare.test` and `admin@greenvalley.test`. Their password is the local `SEED_ADMIN_PASSWORD` value.

## Implemented API

- `GET /api/health`
- `POST /api/auth/login` (public login with tenant discovery)
- `POST /api/:tenantSlug/auth/login`
- `GET /api/:tenantSlug/auth/me` (Bearer token required)
- `GET /api/:tenantSlug/overview` (tenant Admin only)
- `GET /api/:tenantSlug/:locationSlug/context`
- `GET /api/:tenantSlug/:locationSlug/analytics` (tenant Admin only, read-only)
- `GET /api/:tenantSlug/:locationSlug/users` (tenant Admin only)
- `POST /api/:tenantSlug/:locationSlug/users` (tenant Admin only)
- `DELETE /api/:tenantSlug/:locationSlug/users/:id` (tenant Admin only; safe deactivation)
- `GET /api/:tenantSlug/profile`
- `PATCH /api/:tenantSlug/profile/password`
- `GET|POST /api/:tenantSlug/:locationSlug/patients` (Front-desk only)
- `POST|PUT /api/:tenantSlug/:locationSlug/availability` (Doctor, own schedule)
- `GET /api/:tenantSlug/:locationSlug/availability/:doctorId`
- `GET /api/:tenantSlug/:locationSlug/doctors` (Admin or Front-desk)
- `GET /api/:tenantSlug/:locationSlug/appointments` (Front-desk or Doctor; Admin read access remains available for oversight)
- `POST /api/:tenantSlug/:locationSlug/appointments` (Front-desk only)
- `PATCH /api/:tenantSlug/:locationSlug/appointments/:id/check-in` (Front-desk only)
- `POST /api/:tenantSlug/:locationSlug/encounters` (Doctor starts from checked-in appointment)
- `GET /api/:tenantSlug/:locationSlug/encounters/:id`
- `GET /api/:tenantSlug/:locationSlug/encounters/patient/:patientId`
- `PATCH /api/:tenantSlug/:locationSlug/encounters/:id` (draft notes only)
- `PATCH /api/:tenantSlug/:locationSlug/encounters/:id/finalize`
- `POST /api/:tenantSlug/:locationSlug/encounters/:id/amend` (finalized encounters only)

Tenants and their first Clinic Admin are created by the seed script, simulating Meridian Super Admin onboarding without adding an out-of-scope Super Admin UI.

## Automated acceptance tests

Run the focused RFP guarantee suite with:

```powershell
npm test --prefix backend
```

The suite uses Node's built-in test runner and the real Express API stack. It connects using `TEST_MONGODB_URI` when provided, otherwise the configured MongoDB cluster, but always overrides the database name with a unique `meridian_test_<pid>_<time>` database. The name is validated before use and before teardown; the disposable database is dropped after the run, so seeded development data is never queried, changed, or deleted.

The seven tests cover tenant isolation, location isolation, role guards, appointment state transitions, finalized-note immutability, task-assignee validation, and care-plan version history. Full combinatorial negative/boundary coverage, load and performance testing, backup/restore drills, deployment rollback, and disaster recovery remain documented production-readiness approaches rather than implemented POC automation.
