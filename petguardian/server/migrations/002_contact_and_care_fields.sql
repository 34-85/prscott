-- Owner contact details (needed for a usable emergency card) and richer
-- per-animal care fields.
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS settlor_phone TEXT,
  ADD COLUMN IF NOT EXISTS settlor_email TEXT;

ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS allergies          TEXT,
  ADD COLUMN IF NOT EXISTS emergency_vet_name  TEXT,
  ADD COLUMN IF NOT EXISTS emergency_vet_phone TEXT,
  ADD COLUMN IF NOT EXISTS grooming_exercise   TEXT;
