CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','coordinator','fundraising','volunteer')),
 password_hash TEXT, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS invitations (token_hash TEXT PRIMARY KEY,user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS records (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kind TEXT NOT NULL CHECK(kind IN ('clients','donors','referrals','partners','volunteers','tasks')),
 name TEXT NOT NULL,email TEXT,category TEXT NOT NULL,status TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',
 amount NUMERIC(12,2) CHECK(amount IS NULL OR amount>=0),assigned_to UUID REFERENCES users(id),created_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS records_kind ON records(kind,created_at DESC);
CREATE INDEX IF NOT EXISTS records_assignment ON records(assigned_to);
CREATE TABLE IF NOT EXISTS submissions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),kind TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,category TEXT NOT NULL,amount NUMERIC(12,2),consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS audit_log (id BIGSERIAL PRIMARY KEY,user_id UUID REFERENCES users(id),action TEXT NOT NULL,record_id UUID,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,attempts INTEGER NOT NULL DEFAULT 1,expires_at TIMESTAMPTZ NOT NULL);
