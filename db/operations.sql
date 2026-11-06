ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- statement-breakpoint
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('admin','finance','coordinator','fundraising','volunteer'));
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS people (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL,
 entity_type TEXT NOT NULL DEFAULT 'person' CHECK(entity_type IN ('person','organization')),
 email TEXT, phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 communication_consent BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS people_email_unique ON people(lower(email)) WHERE email IS NOT NULL;
-- statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS users_person_unique ON users(person_id) WHERE person_id IS NOT NULL;
-- statement-breakpoint
ALTER TABLE records ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS person_engagements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), person_id UUID NOT NULL REFERENCES people(id),
 role TEXT NOT NULL CHECK(role IN ('employee','volunteer','donor','beneficiary')),
 status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Active','Ended')),
 starts_on DATE NOT NULL DEFAULT CURRENT_DATE, ends_on DATE,
 weekdays INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7],
 onboarding_complete BOOLEAN NOT NULL DEFAULT false, screening_complete BOOLEAN NOT NULL DEFAULT false,
 training_complete BOOLEAN NOT NULL DEFAULT false, qualification_expires_on DATE,
 notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(ends_on IS NULL OR ends_on>=starts_on), CHECK(cardinality(weekdays)>0 AND weekdays <@ ARRAY[1,2,3,4,5,6,7])
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS engagement_person ON person_engagements(person_id,role);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS one_active_donor_engagement ON person_engagements(person_id) WHERE role='donor' AND status='Active';
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS programs (
 id UUID PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, service_area BOOLEAN NOT NULL DEFAULT true
);
-- statement-breakpoint
INSERT INTO programs(id,code,name,service_area) VALUES
 ('10000000-0000-4000-8000-000000000001','nutrition','Nutrition navigation',true),
 ('10000000-0000-4000-8000-000000000002','financial','Financial guidance',true),
 ('10000000-0000-4000-8000-000000000003','wellbeing','Mental wellbeing connections',true),
 ('10000000-0000-4000-8000-000000000004','healthcare','Healthcare navigation',true),
 ('10000000-0000-4000-8000-000000000005','welfare','Social welfare support',true),
 ('10000000-0000-4000-8000-000000000006','planning','Later-life planning',true),
 ('10000000-0000-4000-8000-000000000007','transport','Transport & accompaniment',true),
 ('10000000-0000-4000-8000-000000000008','operations','Foundation operations',false)
 ON CONFLICT(id) DO NOTHING;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS service_records (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), beneficiary_id UUID NOT NULL REFERENCES people(id),
 program_id UUID NOT NULL REFERENCES programs(id),
 service_type TEXT NOT NULL CHECK(service_type IN ('Guidance','Referral','Appointment coordination','Transport','Administrative assistance','Distribution')),
 title TEXT NOT NULL, service_date DATE NOT NULL, assigned_to UUID REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'Planned' CHECK(status IN ('Planned','In progress','Completed','Cancelled')),
 provider TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL DEFAULT '',
 created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS service_beneficiary ON service_records(beneficiary_id,service_date);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS service_hours (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), engagement_id UUID NOT NULL REFERENCES person_engagements(id),
 service_id UUID REFERENCES service_records(id), service_date DATE NOT NULL,
 hours NUMERIC(5,2) NOT NULL CHECK(hours>0 AND hours<=24), description TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','Approved','Rejected')),
 submitted_by UUID NOT NULL REFERENCES users(id), reviewed_by UUID REFERENCES users(id),
 reviewed_at TIMESTAMPTZ, review_note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(reviewed_by IS NULL OR reviewed_by<>submitted_by)
);
-- statement-breakpoint
ALTER TABLE people ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES people(id);
-- statement-breakpoint
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id);
-- statement-breakpoint
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES service_records(id);
-- statement-breakpoint
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
-- statement-breakpoint
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS client_reference UUID;
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS intake_client_reference ON submissions(client_reference) WHERE client_reference IS NOT NULL;
-- statement-breakpoint
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS communication_consent BOOLEAN NOT NULL DEFAULT false;
-- statement-breakpoint
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;
