CREATE TABLE IF NOT EXISTS saved_reports (
 id UUID PRIMARY KEY,owner_id UUID NOT NULL REFERENCES users(id),name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=500),definition JSONB NOT NULL CHECK(jsonb_typeof(definition)='object'),
 version INT NOT NULL DEFAULT 1 CHECK(version>0),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),archived_at TIMESTAMPTZ
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS saved_report_owner ON saved_reports(owner_id,archived_at,updated_at DESC);
