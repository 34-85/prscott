# 🛡️🐾 PetGuardian

**A nationwide pet estate-planning platform.** PetGuardian solves the problem a
pet owner faces when they die (or become incapacitated) without a valid
directive and a *funded* mechanism for their animal's care.

A pet is legally **property, not an heir** — it cannot inherit money or enforce
care instructions. Without a plan there is an immediate **custody gap** (who
takes the animal *now*?) and a separate **funding gap** (who *pays* for food,
boarding, medication, and vet bills?). PetGuardian walks an owner through
building a **funded, enforceable animal-care trust**, a detailed **care
memorandum**, and an **emergency caregiver card** — tailored to the pet-trust
statute of any U.S. state or D.C.

> ⚠️ **Not legal advice.** PetGuardian provides general educational information
> and self-help document preparation. It is not a law firm. The generated
> documents are drafts meant for review with a licensed attorney in your state
> before signing or funding.

---

## What it does

Every U.S. state + D.C. now recognizes a trust for the care of an animal (most
modeled on **Uniform Trust Code § 408** or **UPC § 2-907**; e.g. Georgia's
**O.C.G.A. § 53-12-28**). PetGuardian turns that legal framework into a guided
product:

- **Accounts** — each owner (or attorney) signs in; plans are saved server-side.
- **Plan builder** — capture the settlor, one or more **pets**, a **primary +
  alternate caregiver**, a separate **trustee/enforcer**, **funding sources**,
  a **remainder beneficiary**, and **disposition/incapacity instructions**.
- **Readiness score** — a live 0–100 checklist scores the plan against what a
  durable plan actually needs, including a check that the **trustee is a
  different person from the caregiver** (separating money-control from custody).
- **State-law knowledge base** — browse the pet-trust statute, duration rule,
  enforcement, and remainder default for all **51 jurisdictions**.
- **Print-ready PDFs** — generate a state-specific **Animal Care Trust
  Directive**, a **Pet Care Memorandum**, and an **Emergency Wallet Card**.

This maps directly onto the seven legal issues that arise with no plan:
no designated caregiver, no funded care, pets can't inherit, probate delay,
heir conflict, unrestricted gifts to a caregiver, and no disposition standard.

---

## Tech stack

| Layer     | Choice                                                            |
|-----------|-------------------------------------------------------------------|
| Frontend  | React 18 + Vite + TypeScript + Tailwind + React Router            |
| Backend   | Node + Express + TypeScript                                       |
| Database  | PostgreSQL (via `pg`, plain SQL migrations)                       |
| Auth      | JWT (bcrypt-hashed passwords)                                     |
| PDFs      | `pdfkit` (server-side, streamed as `application/pdf`)             |
| Tests     | Vitest + Supertest (integration tests against Postgres)          |

```
petguardian/
├─ server/                 # Express API
│  ├─ migrations/          # SQL schema (001_init.sql)
│  ├─ src/
│  │  ├─ data/states.ts    # 50 states + DC pet-trust statute dataset
│  │  ├─ db/               # pg pool + migration runner
│  │  ├─ middleware/       # auth, error handling
│  │  ├─ modules/          # auth, plans (+ nested), states, documents
│  │  ├─ services/         # readiness scoring + pdf generators
│  │  ├─ app.ts / index.ts
│  └─ tests/               # auth, plans, states, documents, readiness
└─ client/                 # React app
   └─ src/
      ├─ api/              # fetch client + auth token handling
      ├─ auth/             # AuthContext
      ├─ components/       # layout, shared UI, plan tabs
      └─ pages/            # landing, login, register, dashboard, plan, learn
```

---

## Getting started

Requires **Node 18+** and **PostgreSQL 14+**.

### 1. Create the databases

```bash
createdb pettrust
createdb pettrust_test        # only needed to run the test suite
```

### 2. Configure the server

```bash
cd server
cp .env.example .env
# edit DATABASE_URL / TEST_DATABASE_URL / JWT_SECRET as needed
```

Defaults expect Postgres on `127.0.0.1:5432` with user `postgres`:

```
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/pettrust
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/pettrust_test
```

### 3. Install & run

From the repo root (npm workspaces installs both packages):

```bash
npm install
```

Run the API (auto-applies migrations on boot):

```bash
npm run dev --workspace server      # http://localhost:4000
```

Run the client (Vite proxies /api → :4000):

```bash
npm run dev --workspace client      # http://localhost:5173
```

Open **http://localhost:5173**, create an account, and build a plan.

---

## Testing

The backend has an integration test suite that runs against
`TEST_DATABASE_URL` (migrations are applied automatically):

```bash
npm test --workspace server
```

Covers registration/login/authz, plan + nested-entity CRUD, cross-user access
isolation, the readiness scoring engine, the 51-jurisdiction dataset, and
valid PDF generation for all three document types. Type-check the client with
`npm run lint --workspace client`.

---

## Deployment (Docker)

PetGuardian ships as a **single production container**: a multi-stage
`Dockerfile` builds the client and server, then a lean runtime image serves the
compiled API *and* the built React app from the same origin. Migrations are
applied automatically on boot.

```bash
cd petguardian
cp .env.production.example .env      # set JWT_SECRET + POSTGRES_PASSWORD
docker compose up --build            # starts Postgres + the app
# open http://localhost:4000
```

`docker-compose.yml` runs Postgres 16 (with a persistent volume and health
check) alongside the app, wiring `DATABASE_URL` to the `db` service. Because the
app is same-origin, no CORS or separate static host is needed.

**Deploy anywhere.** The image is a standard OCI container, so it runs on any
host that takes a Dockerfile — a VPS, Fly.io, Render, Railway, ECS, Cloud Run,
etc. Point `DATABASE_URL` at your managed Postgres and set a strong `JWT_SECRET`
(the server refuses to start in production with the default secret). Build and
run directly, without compose, like so:

```bash
docker build -t petguardian ./petguardian
docker run -p 4000:4000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/pettrust \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  petguardian
```

### Production runtime env

| Variable        | Required | Notes                                              |
|-----------------|----------|----------------------------------------------------|
| `DATABASE_URL`  | yes      | Postgres connection string.                        |
| `JWT_SECRET`    | yes      | Long random string; server refuses the default.    |
| `PORT`          | no       | Defaults to `4000`.                                |
| `CLIENT_DIST`   | no       | Set by the image to serve the built SPA.           |
| `JWT_EXPIRES_IN`| no       | Token lifetime, default `7d`.                      |

## Continuous integration

`.github/workflows/petguardian-ci.yml` runs on any change under `petguardian/**`
(independent of the root project's Pages workflow). It:

1. spins up a Postgres 16 service, installs the workspaces, runs the API test
   suite, and builds the client; then
2. builds the production Docker image to confirm it assembles.

---

## API overview

| Method | Path                                          | Purpose                              |
|--------|-----------------------------------------------|--------------------------------------|
| POST   | `/api/auth/register` · `/login`               | Create account / sign in (JWT)       |
| GET    | `/api/auth/me`                                | Current user                         |
| GET    | `/api/states` · `/api/states/:code`           | State-law knowledge base             |
| GET/POST | `/api/plans`                                | List / create plans (with readiness) |
| GET/PUT/DELETE | `/api/plans/:id`                      | Full plan (+ state law + readiness)  |
| POST/PUT/DELETE | `/api/plans/:id/pets`                | Manage pets                          |
| POST/PUT/DELETE | `/api/plans/:id/caregivers`          | Manage caregivers                    |
| POST/PUT/DELETE | `/api/plans/:id/trustees`            | Manage trustees / enforcers          |
| POST/PUT/DELETE | `/api/plans/:id/funding`             | Manage funding sources               |
| GET    | `/api/plans/:id/documents/:type`              | Stream a generated PDF               |

`:type` is one of `trust-directive`, `care-memorandum`, `emergency-card`.

---

## Roadmap (post-MVP)

- ~~Deployment (managed Postgres + container host) and CI.~~ ✅ Docker image,
  compose stack, and GitHub Actions CI are in place.
- Attorney workspace: multiple clients, shared drafts, review notes.
- E-signature / notarization guidance per state.
- Life-insurance funding calculator and reminders to confirm caregivers.
- Editable inline document preview before download.

---

*Legal citations in the state dataset are for general reference and are not
guaranteed current. Always verify with counsel in the relevant jurisdiction.*
