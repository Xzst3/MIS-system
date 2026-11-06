-- Additive reporting attributes. Existing UUIDs, approvals and ledger values are preserved.
ALTER TABLE finance_requests ADD COLUMN IF NOT EXISTS expense_category TEXT NOT NULL DEFAULT 'uncategorized'
 CHECK(expense_category IN ('uncategorized','salary','rent','utilities','transport','supplies','external_service','events','other'));
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS finance_reporting_date ON finance_requests(event_date,kind,status);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS service_reporting_date ON service_records(service_date,status,program_id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS hours_reporting_date ON service_hours(service_date,status);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS posting_source_history ON finance_postings(lot_id,id);
-- statement-breakpoint
-- Read-through provenance, not a duplicate ledger: every amount retains original donor,
-- receipt/asset, cash source, movement, beneficiary/service and accountable actors.
CREATE OR REPLACE VIEW ecf_funding_provenance AS
 SELECT p.id posting_id,l.id cash_source_id,COALESCE(l.origin_asset_id,l.id) origin_receipt_id,
 l.donor_id donor_person_id,donor.name donor_name,origin.reference original_donation_reference,
 cash.reference cash_source_reference,cash.amount_cents source_amount_cents,
 p.request_id,r.reference transaction_reference,r.kind,r.event_date,r.status,p.fund_id,f.name fund_name,
 p.delta_cents,r.description,r.service_id,s.title service_title,s.status service_status,s.beneficiary_id,
 beneficiary.name beneficiary_name,r.submitted_by,submitter.name submitter_name,
 r.reviewed_by,reviewer.name reviewer_name,r.reviewed_at,r.review_note,p.created_at
 FROM finance_postings p JOIN finance_lots l ON l.id=p.lot_id
 JOIN finance_requests cash ON cash.id=l.id JOIN finance_requests origin ON origin.id=COALESCE(l.origin_asset_id,l.id)
 JOIN finance_requests r ON r.id=p.request_id JOIN people donor ON donor.id=l.donor_id
 JOIN funds f ON f.id=p.fund_id LEFT JOIN service_records s ON s.id=r.service_id
 LEFT JOIN people beneficiary ON beneficiary.id=s.beneficiary_id
 LEFT JOIN users submitter ON submitter.id=r.submitted_by LEFT JOIN users reviewer ON reviewer.id=r.reviewed_by;
-- statement-breakpoint
-- Classify only the known, user-authorized example entries, with an audit trail. Never infer real costs from free text.
WITH changed AS (
 UPDATE finance_requests r SET expense_category=m.category FROM (VALUES
 ('ECF-2026-EXPENSE-MEALS','external_service'),('ECF-2026-EXPENSE-TRANSPORT','transport'),
 ('ECF-2026-EXPENSE-RENT','rent'),('ECF-2026-EXPENSE-TEAM','salary'),
 ('ECF-2026-PENDING-TRANSPORT','transport'),('ECF-2026-PENDING-HEALTHCARE','external_service')
 ) AS m(reference,category) WHERE r.reference=m.reference AND r.kind='expense' AND r.expense_category='uncategorized'
 RETURNING r.id,r.expense_category
) INSERT INTO audit_log(action,record_id,details) SELECT 'Classified existing example expense for period reporting',id,
 jsonb_build_object('before','uncategorized','after',expense_category,'reason','Known bootstrap entry; no amount, approval or posting changed') FROM changed;
