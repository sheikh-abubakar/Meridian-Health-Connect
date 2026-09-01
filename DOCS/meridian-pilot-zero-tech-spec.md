# Meridian Health Connect — Pilot Zero POC
## Technical Specification (for implementation reference)

> This document defines the exact scope, architecture, data model, and feature
> breakdown for the Pilot Zero POC, derived from Section 9.1 of the Meridian
> Health Connect RFP (Doc ID: MC-RFP-SCOPE-0001). Use this as the single
> source of truth during implementation — do not add features beyond what is
> listed here without updating this document first.

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express |
| Database | MongoDB (Mongoose ODM) |
| Auth | JWT (access token), bcrypt for password hashing |
| AI (optional, low priority) | Groq API — note summarization only, draft + human accept |

Architecture pattern: **standard client-server**, two separate apps
(`backend/`, `frontend/`) talking over a REST API.

---

## 2. Repository Structure

```
meridian-pilot-zero/
├── backend/
│   ├── src/
│   │   ├── models/          (Mongoose schemas)
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/      (auth, tenant resolution, role guard)
│   │   ├── services/        (mockEligibility, mockNotify, aiSummary)
│   │   ├── seed/            (seed script)
│   │   └── app.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api/
│   │   └── context/         (auth context)
│   └── package.json
└── README.md
```

---

## 3. Multi-Tenancy & Multi-Location Strategy

- **Slug-based tenant resolution.** Every tenant has a unique `slug`
  (e.g. `city-care`, `green-valley`).
- **Slug-based location resolution, nested under tenant.** Every tenant
  can have multiple `Location` documents (separate collection, not
  nested fields — see Section 5), each with its own `slug`, unique
  *within* that tenant (e.g. `city-care` tenant has locations `gulberg`
  and `dha`).
- Backend routes are scoped in two tiers:
  - Tenant-level only (auth, tenant-wide overview/analytics):
    `/api/:tenantSlug/...`
  - Location-level (staff, patients, appointments, encounters, care
    plans, tasks — everything operational): `/api/:tenantSlug/:locationSlug/...`
- Frontend mirrors this: after login, Admin lands on
  `/:tenantSlug/overview` (a tenant-wide analytics view showing each
  location's basic stats). Selecting a location navigates into
  `/:tenantSlug/:locationSlug/dashboard`, and everything done from there
  (staff management, scheduling, etc.) is scoped to that location only.
  A persistent indicator (e.g. in the top bar) always shows which
  tenant + location scope is currently active.
- Middleware chain: `resolveTenant` (from `:tenantSlug`) runs first and
  sets `req.tenantId`; `resolveLocation` (from `:locationSlug`) runs next
  and looks up the location **scoped to the already-resolved tenantId**
  (a location slug must never resolve across tenants), setting
  `req.locationId`.
- **Every query on every location-scoped collection must filter by both
  `tenantId` AND `locationId`.** This is the core isolation guarantee,
  extending the same principle used for tenant isolation.
- No tenant/location self-signup in POC. Tenants, their locations, and
  each tenant's first Clinic Admin are created via a seed script
  (`backend/src/seed/seed.js`), simulating the "Meridian Super Admin
  onboards a clinic" process described in the RFP (Section 4, Section
  7.1). This simulation should be one sentence in the final project plan
  doc, not built as a feature.

---

## 4. Roles

| Role | Scope | Key permissions |
|---|---|---|
| Clinic Admin | Tenant-scoped | Add/manage staff users within their tenant |
| Front-desk Staff | Tenant-scoped | Create patients, book appointments, check-in |
| Doctor | Tenant-scoped | Document encounters, create care plans, assign tasks |
| Care Coordinator | Tenant-scoped | View/complete assigned tasks, view care plans |

No platform-level "Super Admin" UI is built in POC — mention it exists
conceptually in the doc, but tenants are seeded directly.

No patient login/self-booking in POC (RFP D01 self-scheduling is deferred
to a future phase — see Section 9 in this doc).

---

## 5. Data Model (MongoDB Collections)

### Tenant
```
{ _id, name, slug, createdAt }
```

### Location
```
{ _id, tenantId, name, slug, address, createdAt }
```
A tenant can have one or more locations (RFP Section 4: multi-location
groups). `slug` is unique within a tenant (e.g. `gulberg`, `dha`), used for
`/:tenantSlug/:locationSlug/...` URL scoping (see Section 3). Every
location-scoped collection (User, Patient, Appointment, Encounter,
CarePlan, Task) references `locationId`. For POC, seed 2 locations per
tenant.

### User
```
{ _id, tenantId, locationId (null for Admin, required for other roles),
  name, email, passwordHash, isActive,
  role: ["admin","frontdesk","doctor","care_coordinator"], createdAt }
```
Clinic Admin is tenant-wide (`locationId: null`) and can access every
location's Overview and drill into any of them. Doctor, Front-desk, and
Care Coordinator are created from within a specific location's scope and
are tied to that `locationId` — they only ever operate within their
assigned branch.

All authenticated roles have a tenant-scoped profile/security view and may
change their password after confirming the current password. Admin staff
removal is implemented as audited account deactivation (`isActive: false`),
not destructive deletion, so historical clinical and audit references remain
intact.

### Patient
```
{ _id, tenantId, locationId, name, contact: { phone, email }, address,
  insuranceInfo: { provider, policyNumber } (optional), createdAt }
```

### Availability
```
{ _id, tenantId, locationId, doctorId,
  slots: [{ dayOfWeek: 0-6, startTime: "HH:mm", endTime: "HH:mm" }],
  createdAt }
```
Simple weekly recurring schedule per doctor per location (no
date-specific overrides/holidays in POC). Doctor sets this from their own
dashboard; Front-desk's booking flow validates against it and enforces
double-booking prevention (RFP Section 6.1).

### Appointment
```
{ _id, tenantId, locationId, patientId, doctorId, visitType, scheduledAt,
  status: ["scheduled","checked_in","completed","cancelled"],
  eligibilityStatus: ["verified","pending"],   // from mock service
  createdBy, createdAt }
```

### Encounter
```
{ _id, tenantId, locationId, appointmentId, patientId, doctorId,
  notes: { symptoms, observations, diagnosis },
  aiSummary (optional, string),
  status: ["draft","finalized"],
  finalizedAt, amendments: [{ text, actor, timestamp }],
  createdAt }
```

### CarePlan
```
{ _id, tenantId, locationId, patientId, createdByDoctorId, goal, targetMeasure,
  reviewCadence, owningCareTeamMemberId,
  history: [{ change, actor, timestamp, reason }],
  createdAt }
```

### Task
```
{ _id, tenantId, carePlanId, description, assignedToUserId,
  assignedByUserId, dueDate, status: ["open","completed"], createdAt }
```

### AuditLog
```
{ _id, tenantId, actorUserId, action, targetType, targetId,
  timestamp }
```
Write an audit entry on: login, user created, encounter finalized,
care plan created, task assigned/completed.

---

## 6. Feature Breakdown — Mapped Directly to RFP Section 9.1

Each item below is one Section 9.1 requirement translated into what to
actually build. Build in this order.

### 6.1 Tenant isolation (9.1 bullet 1)
- Seed 2 tenants: `city-care`, `green-valley`.
- Slug middleware + `tenantId` filtering on every query.
- Acceptance check: logging into one tenant must never surface the other
  tenant's patients, appointments, or staff.

### 6.2 Auth, roles, staff management (9.1 bullet 4 — identity/role/permission)
- JWT login (`POST /api/:tenantSlug/auth/login`).
- Role-guard middleware per route.
- Clinic Admin "Add Staff" (`POST /api/:tenantSlug/users`) — create Doctor,
  Front-desk, Care Coordinator accounts.

### 6.3 Scheduling → Check-in → Encounter (9.1 bullet 2)
- Front-desk creates a `Patient`.
- Front-desk books an `Appointment` (patient, doctor, visit type, time).
  On creation, call the mock eligibility service (Section 7 below) and
  store the result on the appointment.
- Front-desk marks appointment `checked_in`.
- Doctor opens their queue (appointments with status `checked_in`),
  selects a patient, writes an `Encounter` (structured note), finalizes it
  (`status: finalized` — becomes immutable; further changes are
  `amendments`, never overwrites).

### 6.4 Care Plan + Task assignment (9.1 bullet 3)
- After finalizing an encounter, Doctor (or Care Coordinator) can create a
  `CarePlan` for that patient: goal, target measure, review cadence.
- Doctor creates a `Task` linked to the care plan and assigns it to a
  **staff member** (typically Care Coordinator) — never to the patient.
- Care Coordinator sees assigned tasks on their dashboard and marks them
  complete.

### 6.5 Audit trail (9.1 bullet 4 — audit)
- Every key action (login, user creation, encounter finalized, care plan
  created, task assigned/completed) writes an `AuditLog` entry.
- Simple read-only audit view for Admin (who did what, when).

### 6.6 Mocked external dependencies (9.1 bullets 5 & 6)
These are **not real integrations** — they are deterministic mock
functions so the workflow behaves as if integrations existed:
- `mockEligibilityCheck(patient)` → returns `"verified"` or `"pending"`
  (e.g. deterministic based on a field, not random, to satisfy the
  "deterministic" requirement).
- `mockNotify(type, recipient, message)` → logs to console/DB instead of
  actually sending SMS/email — simulates the communications provider.
- **Payer communications (authorization requests to insurers) and
  e-signature (patient consent forms) are not built as features at all** —
  no consent-form or authorization-request flow exists anywhere in this
  POC's scope (scheduling, encounter, care plan/task). Both depend on
  contracted external providers (RFP Section 11) that are gated for later
  phases. Document this as a conceptual/simulated item in the project plan,
  not as code.
- No real payer API, no payment processing — out of scope.

### 6.7 AI (9.1 bullet 7)
Implement after the core workflow (6.1–6.6) is working and tested — it
depends on encounter notes existing, so it naturally comes last. If
development time runs out before reaching it, document the design here
(already specified below) instead of building it, and note in the project
plan that it is designed but not yet implemented in this POC iteration.
- One endpoint: Doctor's encounter note text → Groq API → returns a draft
  summary string.
- Summary is shown to Doctor as **suggested text only**; Doctor must
  explicitly accept/edit before the encounter can be finalized.
- Never auto-finalizes anything.

### 6.8 Tests / evidence (9.1 bullet 8) — minimum viable
- A handful of automated tests are enough, not a full suite:
  - Tenant isolation test (Tenant A cannot fetch Tenant B's patients).
  - Auth/role guard test (Front-desk cannot access Doctor-only route).
  - Appointment status transition test (can't skip from `scheduled`
    straight to `completed` without `checked_in`).
- Backup/restore, rollback, load testing etc. are **not built** — describe
  the intended approach in the project plan document instead.

---

## 7. Explicitly Out of Scope for POC (RFP Section 9.2)

Do not build any of the following — they belong to later phases:
- Chronic care management depth, remote patient monitoring, behavioral
  health module.
- Real payer/insurance connectivity (only mocked, see 6.6).
- Payment/billing processing (not in RFP scope at all).
- Patient self-scheduling / patient portal login.
- Cross-tenant patient-transfer workflow.
- National jurisdiction compliance packs, benchmarking, advanced predictive
  AI.

If asked "why isn't X built," the answer is: it's a named exclusion or
later-phase item per Section 9 of the RFP, not an oversight.

---

## 8. Build Order (for Codex, feature by feature)

1. Backend skeleton: Express app, MongoDB connection, `Tenant` + `User`
   models, slug resolution middleware, JWT auth, role-guard middleware.
2. Seed script: 2 tenants, 1–2 locations per tenant, 1 Clinic Admin each.
3. Staff management: Clinic Admin can create Doctor / Front-desk / Care
   Coordinator users.
4. `Patient` model + create-patient endpoint (Front-desk).
5. `Appointment` model + book / check-in endpoints + mock eligibility
   service.
6. `Encounter` model + create/finalize/amend endpoints (Doctor).
7. `CarePlan` + `Task` models + create/assign/complete endpoints.
8. `AuditLog` — write on the actions listed in 6.5, plus a read endpoint.
9. Frontend: login, Admin dashboard (staff mgmt), Front-desk dashboard
   (patients/scheduling/check-in), Doctor dashboard (queue, encounter,
   care plan/task), Care Coordinator dashboard (task list).
10. (Optional, only if time remains) AI summary endpoint + UI hook.
11. Minimal automated tests (Section 6.8).

---

## 9. Naming

Project name: **Meridian Health Connect — Pilot Zero POC** (per RFP
terminology; "Pilot Zero" is the RFP's own term for this exact phase,
Section 9 of MC-RFP-SCOPE-0001).
