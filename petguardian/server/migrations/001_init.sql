-- PetGuardian schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER', 'ATTORNEY')),
  state         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A plan is a single household's pet-care estate plan.
CREATE TABLE IF NOT EXISTS plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  state                 TEXT NOT NULL,
  settlor_full_name     TEXT,
  settlor_address       TEXT,
  funding_target        NUMERIC(12,2),
  funding_notes         TEXT,
  remainder_beneficiary TEXT,
  disposition_instructions TEXT,
  incapacity_instructions  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id);

CREATE TABLE IF NOT EXISTS pets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  species        TEXT,
  breed          TEXT,
  color          TEXT,
  sex            TEXT,
  birthdate      DATE,
  microchip      TEXT,
  vet_name       TEXT,
  vet_phone      TEXT,
  insurance      TEXT,
  medications    TEXT,
  diet           TEXT,
  routine        TEXT,
  behavior       TEXT,
  placement_preference TEXT,
  medical_directives   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pets_plan ON pets(plan_id);

CREATE TABLE IF NOT EXISTS caregivers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'PRIMARY' CHECK (role IN ('PRIMARY', 'ALTERNATE')),
  full_name     TEXT NOT NULL,
  relationship  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_caregivers_plan ON caregivers(plan_id);

CREATE TABLE IF NOT EXISTS trustees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'TRUSTEE' CHECK (role IN ('TRUSTEE', 'SUCCESSOR_TRUSTEE', 'ENFORCER')),
  full_name     TEXT NOT NULL,
  relationship  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trustees_plan ON trustees(plan_id);

CREATE TABLE IF NOT EXISTS funding_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('LIFE_INSURANCE','BANK','BROKERAGE','RETIREMENT','TRUST','WILL_BEQUEST','CASH','OTHER')),
  description   TEXT,
  amount        NUMERIC(12,2),
  beneficiary_designation TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funding_plan ON funding_sources(plan_id);
