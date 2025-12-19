-- Migration: align database with new schema fields used by auth + invoices + invitations
-- Safe/idempotent where possible.

-- 1) users.disabled (required for auth deserialize)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) invoices.dirty (used for QBO guard / reconciliation)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS dirty BOOLEAN NOT NULL DEFAULT FALSE;

-- 3) invitations (Phase A)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN
    CREATE TYPE invitation_status AS ENUM ('pending','accepted','expired','revoked');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitations_company_email_idx
ON invitations(company_id, email)
WHERE status = 'pending';

-- 4) company_audit_logs (Phase 2 auditing)
CREATE TABLE IF NOT EXISTS company_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(64) NOT NULL,
  entity VARCHAR(64) NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_audit_logs_company_created_idx
ON company_audit_logs(company_id, created_at);

-- 5) technicians + labor_entries (Phase C)
CREATE TABLE IF NOT EXISTS technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS technicians_company_idx
ON technicians(company_id);

CREATE TABLE IF NOT EXISTS labor_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES technicians(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  minutes INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS labor_entries_job_idx
ON labor_entries(job_id);

CREATE INDEX IF NOT EXISTS labor_entries_tech_idx
ON labor_entries(technician_id);
