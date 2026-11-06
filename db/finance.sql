CREATE TABLE IF NOT EXISTS funds (
 id UUID PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
 program_id UUID REFERENCES programs(id), restriction TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT true
);
-- statement-breakpoint
INSERT INTO funds(id,code,name,program_id,restriction) VALUES
 ('20000000-0000-4000-8000-000000000000','general','General support',NULL,''),
 ('20000000-0000-4000-8000-000000000001','nutrition','Nutrition fund','10000000-0000-4000-8000-000000000001','Nutrition navigation and associated support only'),
 ('20000000-0000-4000-8000-000000000002','financial','Financial guidance fund','10000000-0000-4000-8000-000000000002','Financial guidance and associated support only'),
 ('20000000-0000-4000-8000-000000000003','wellbeing','Wellbeing fund','10000000-0000-4000-8000-000000000003','Mental wellbeing connections and associated support only'),
 ('20000000-0000-4000-8000-000000000004','healthcare','Healthcare navigation fund','10000000-0000-4000-8000-000000000004','Healthcare navigation and associated support only'),
 ('20000000-0000-4000-8000-000000000005','welfare','Social welfare fund','10000000-0000-4000-8000-000000000005','Social welfare support only'),
 ('20000000-0000-4000-8000-000000000006','planning','Later-life planning fund','10000000-0000-4000-8000-000000000006','Later-life planning support only'),
 ('20000000-0000-4000-8000-000000000007','transport','Transport fund','10000000-0000-4000-8000-000000000007','Transport and accompaniment only'),
 ('20000000-0000-4000-8000-000000000008','operations','Operations fund','10000000-0000-4000-8000-000000000008','Staff salaries, premises, utilities and operational costs')
 ON CONFLICT(id) DO NOTHING;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reference TEXT UNIQUE NOT NULL,
 client_reference UUID UNIQUE NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('cash_donation','allocation','expense','budget','in_kind','distribution','asset_sale')),
 amount_cents BIGINT NOT NULL DEFAULT 0 CHECK(amount_cents>=0 AND amount_cents<=10000000000),
 currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 event_date DATE NOT NULL, fund_id UUID NOT NULL REFERENCES funds(id), to_fund_id UUID REFERENCES funds(id),
 person_id UUID REFERENCES people(id), service_id UUID REFERENCES service_records(id),
 item_id UUID, quantity NUMERIC(12,2) CHECK(quantity IS NULL OR quantity>0), item_name TEXT,
 external_reference TEXT, settlement_confirmed BOOLEAN NOT NULL DEFAULT false,
 description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','Posted','Rejected')),
 source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','website_preview')),
 submitted_by UUID REFERENCES users(id), reviewed_by UUID REFERENCES users(id),
 review_note TEXT NOT NULL DEFAULT '', reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(reviewed_by IS NULL OR reviewed_by<>submitted_by),
 CHECK(kind IN ('in_kind','distribution') OR amount_cents>0),
 CHECK(kind<>'allocation' OR (to_fund_id IS NOT NULL AND fund_id<>to_fund_id)),
 CHECK(kind NOT IN ('cash_donation','in_kind') OR person_id IS NOT NULL),
 CHECK(kind NOT IN ('cash_donation','asset_sale','expense') OR length(trim(external_reference))>0),
 CHECK(kind NOT IN ('in_kind','distribution','asset_sale') OR quantity>0)
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS finance_external_receipt ON finance_requests(lower(external_reference)) WHERE kind IN ('cash_donation','asset_sale') AND status<>'Rejected';
-- statement-breakpoint
ALTER TABLE finance_requests ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS finance_external_expense ON finance_requests(lower(external_reference)) WHERE kind='expense' AND status<>'Rejected';
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_lots (
 id UUID PRIMARY KEY REFERENCES finance_requests(id), donor_id UUID NOT NULL REFERENCES people(id),
 origin_asset_id UUID, restricted_program_id UUID REFERENCES programs(id)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_postings (
 id BIGSERIAL PRIMARY KEY, request_id UUID NOT NULL REFERENCES finance_requests(id),
 fund_id UUID NOT NULL REFERENCES funds(id), lot_id UUID NOT NULL REFERENCES finance_lots(id),
 delta_cents BIGINT NOT NULL CHECK(delta_cents<>0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(request_id,fund_id,lot_id)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS posting_balance ON finance_postings(fund_id,lot_id);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS fund_budgets (
 fund_id UUID NOT NULL REFERENCES funds(id), fiscal_year INT NOT NULL,
 limit_cents BIGINT NOT NULL CHECK(limit_cents>0), request_id UUID NOT NULL REFERENCES finance_requests(id),
 PRIMARY KEY(fund_id,fiscal_year)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS inventory_items (
 id UUID PRIMARY KEY REFERENCES finance_requests(id), name TEXT NOT NULL,
 donor_id UUID NOT NULL REFERENCES people(id), fund_id UUID NOT NULL REFERENCES funds(id),
 estimated_value_cents BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS inventory_movements (
 id BIGSERIAL PRIMARY KEY, request_id UUID NOT NULL UNIQUE REFERENCES finance_requests(id),
 item_id UUID NOT NULL REFERENCES inventory_items(id), quantity NUMERIC(12,2) NOT NULL CHECK(quantity<>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_policy (
 id INT PRIMARY KEY CHECK(id=1), officer_limit_cents BIGINT NOT NULL CHECK(officer_limit_cents>0)
);
-- statement-breakpoint
INSERT INTO finance_policy(id,officer_limit_cents) VALUES(1,250000) ON CONFLICT DO NOTHING;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION ecf_review_finance(request_uuid UUID, actor_uuid UUID, decision TEXT, decision_note TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
 r finance_requests%ROWTYPE; actor_role TEXT; source_fund funds%ROWTYPE; target_fund funds%ROWTYPE;
 balance BIGINT; budget_limit BIGINT; spent BIGINT; remaining BIGINT; taken BIGINT; lot RECORD; actor_person UUID;
 stock NUMERIC; item inventory_items%ROWTYPE; service_program UUID; officer_limit BIGINT;
BEGIN
 -- A transaction-scoped lock serializes balance checks and lot consumption.
 PERFORM pg_advisory_xact_lock(410260028);
 SELECT role,person_id INTO actor_role,actor_person FROM users WHERE id=actor_uuid AND active=true;
 IF actor_role IS NULL OR actor_role NOT IN ('admin','finance') THEN RAISE EXCEPTION 'Finance approval access required'; END IF;
 SELECT * INTO r FROM finance_requests WHERE id=request_uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF r.submitted_by=actor_uuid THEN RAISE EXCEPTION 'A different authorized person must review this request'; END IF;
 IF actor_person IS NOT NULL AND (r.person_id=actor_person OR EXISTS(SELECT 1 FROM service_records s WHERE s.id=r.service_id AND s.beneficiary_id=actor_person)) THEN
   RAISE EXCEPTION 'A different authorized person must review a contribution or service connected to your own person profile';
 END IF;
 IF decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 IF r.status<>'Submitted' THEN
   IF (r.status='Posted' AND decision='approve') OR (r.status='Rejected' AND decision='reject') THEN
     RETURN jsonb_build_object('ok',true,'status',r.status,'already_reviewed',true);
   END IF;
   RAISE EXCEPTION 'This request has already been reviewed';
 END IF;
 SELECT officer_limit_cents INTO officer_limit FROM finance_policy WHERE id=1;
 IF actor_role='finance' AND r.amount_cents>officer_limit THEN RAISE EXCEPTION 'Amount exceeds finance officer authority; administrator review required'; END IF;
 IF decision='reject' THEN
   IF length(trim(decision_note))<3 THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
   UPDATE finance_requests SET status='Rejected',reviewed_by=actor_uuid,reviewed_at=NOW(),review_note=decision_note WHERE id=r.id;
   INSERT INTO audit_log(user_id,action,record_id) VALUES(actor_uuid,'Rejected financial request: '||decision_note,r.id);
   RETURN jsonb_build_object('ok',true,'status','Rejected');
 END IF;
 SELECT * INTO source_fund FROM funds WHERE id=r.fund_id AND active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active fund required'; END IF;
 IF r.service_id IS NOT NULL THEN
   SELECT program_id INTO service_program FROM service_records WHERE id=r.service_id AND status<>'Cancelled';
   IF service_program IS NULL THEN RAISE EXCEPTION 'An active service record is required'; END IF;
   IF source_fund.program_id IS NOT NULL AND service_program<>source_fund.program_id THEN RAISE EXCEPTION 'The service does not match the fund restriction'; END IF;
 END IF;
 IF r.kind IN ('cash_donation','asset_sale') AND NOT r.settlement_confirmed AND r.source<>'website_preview' THEN
   RAISE EXCEPTION 'Confirm receipt against external payment or bank evidence before posting';
 END IF;
 IF r.kind='allocation' THEN
   SELECT * INTO target_fund FROM funds WHERE id=r.to_fund_id AND active=true;
   IF NOT FOUND THEN RAISE EXCEPTION 'Active destination fund required'; END IF;
   IF source_fund.program_id IS NOT NULL AND target_fund.program_id IS DISTINCT FROM source_fund.program_id THEN
     RAISE EXCEPTION 'Restricted funds cannot be transferred to an ineligible destination';
   END IF;
 END IF;
 IF r.kind IN ('allocation','expense') THEN
   SELECT COALESCE(sum(p.delta_cents),0) INTO balance FROM finance_postings p JOIN finance_requests posted ON posted.id=p.request_id WHERE p.fund_id=r.fund_id AND posted.event_date<=r.event_date;
   IF r.amount_cents>balance THEN RAISE EXCEPTION 'Insufficient posted fund balance on the transaction date'; END IF;
 END IF;
 IF r.kind='expense' THEN
   IF source_fund.program_id IS NULL THEN RAISE EXCEPTION 'Allocate general support to a service or operations fund before recording expenditure'; END IF;
   SELECT limit_cents INTO budget_limit FROM fund_budgets WHERE fund_id=r.fund_id AND fiscal_year=EXTRACT(YEAR FROM r.event_date)::int;
   IF budget_limit IS NULL THEN RAISE EXCEPTION 'An approved annual budget is required'; END IF;
   SELECT COALESCE(sum(amount_cents),0) INTO spent FROM finance_requests WHERE kind='expense' AND status='Posted' AND fund_id=r.fund_id AND EXTRACT(YEAR FROM event_date)=EXTRACT(YEAR FROM r.event_date);
   IF spent+r.amount_cents>budget_limit THEN RAISE EXCEPTION 'Expense exceeds the approved annual budget; submit a budget revision first'; END IF;
 END IF;
 IF r.kind='budget' THEN
   SELECT COALESCE(sum(amount_cents),0) INTO spent FROM finance_requests WHERE kind='expense' AND status='Posted' AND fund_id=r.fund_id AND EXTRACT(YEAR FROM event_date)=EXTRACT(YEAR FROM r.event_date);
   IF r.amount_cents<spent THEN RAISE EXCEPTION 'A revised budget cannot be lower than already posted expenses'; END IF;
   INSERT INTO fund_budgets(fund_id,fiscal_year,limit_cents,request_id) VALUES(r.fund_id,EXTRACT(YEAR FROM r.event_date)::int,r.amount_cents,r.id)
   ON CONFLICT(fund_id,fiscal_year) DO UPDATE SET limit_cents=EXCLUDED.limit_cents,request_id=EXCLUDED.request_id;
 END IF;
 IF r.kind='in_kind' THEN
   IF r.item_name IS NULL OR length(trim(r.item_name))<2 THEN RAISE EXCEPTION 'An item name is required'; END IF;
   INSERT INTO inventory_items(id,name,donor_id,fund_id,estimated_value_cents) VALUES(r.id,r.item_name,r.person_id,r.fund_id,r.amount_cents);
   INSERT INTO inventory_movements(request_id,item_id,quantity) VALUES(r.id,r.id,r.quantity);
 END IF;
 IF r.kind IN ('distribution','asset_sale') THEN
   SELECT * INTO item FROM inventory_items WHERE id=r.item_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
   IF item.fund_id<>r.fund_id THEN RAISE EXCEPTION 'Use the original inventory designation fund'; END IF;
   SELECT LEAST(COALESCE(sum(m.quantity),0),COALESCE(sum(CASE WHEN posted.event_date<=r.event_date THEN m.quantity ELSE 0 END),0)) INTO stock FROM inventory_movements m JOIN finance_requests posted ON posted.id=m.request_id WHERE m.item_id=r.item_id;
   IF r.quantity>stock THEN RAISE EXCEPTION 'Insufficient available stock'; END IF;
   IF r.kind='distribution' AND r.service_id IS NULL THEN RAISE EXCEPTION 'Link the distribution to a beneficiary service record'; END IF;
   INSERT INTO inventory_movements(request_id,item_id,quantity) VALUES(r.id,r.item_id,-r.quantity);
 END IF;
 IF r.kind IN ('cash_donation','asset_sale') THEN
   INSERT INTO finance_lots(id,donor_id,origin_asset_id,restricted_program_id)
   VALUES(r.id,CASE WHEN r.kind='asset_sale' THEN item.donor_id ELSE r.person_id END,CASE WHEN r.kind='asset_sale' THEN item.id ELSE NULL END,source_fund.program_id);
   INSERT INTO finance_postings(request_id,fund_id,lot_id,delta_cents) VALUES(r.id,r.fund_id,r.id,r.amount_cents);
 END IF;
 IF r.kind IN ('allocation','expense') THEN
   remaining:=r.amount_cents;
   FOR lot IN SELECT p.lot_id,sum(p.delta_cents)::bigint AS available,sum(CASE WHEN posted.event_date<=r.event_date THEN p.delta_cents ELSE 0 END)::bigint AS dated_available,l.restricted_program_id,MIN(p.created_at) AS received
     FROM finance_postings p JOIN finance_lots l ON l.id=p.lot_id JOIN finance_requests posted ON posted.id=p.request_id
     WHERE p.fund_id=r.fund_id GROUP BY p.lot_id,l.restricted_program_id HAVING sum(p.delta_cents)>0 AND sum(CASE WHEN posted.event_date<=r.event_date THEN p.delta_cents ELSE 0 END)>0
     ORDER BY MIN(p.created_at),p.lot_id
   LOOP
     IF lot.restricted_program_id IS NOT NULL AND
       ((r.kind='allocation' AND target_fund.program_id IS DISTINCT FROM lot.restricted_program_id)
       OR (r.kind='expense' AND source_fund.program_id IS DISTINCT FROM lot.restricted_program_id)) THEN
       CONTINUE;
     END IF;
     taken:=LEAST(remaining,lot.available,lot.dated_available);
     INSERT INTO finance_postings(request_id,fund_id,lot_id,delta_cents) VALUES(r.id,r.fund_id,lot.lot_id,-taken);
     IF r.kind='allocation' THEN
       INSERT INTO finance_postings(request_id,fund_id,lot_id,delta_cents) VALUES(r.id,r.to_fund_id,lot.lot_id,taken);
     END IF;
     remaining:=remaining-taken;
     EXIT WHEN remaining=0;
   END LOOP;
   IF remaining<>0 THEN RAISE EXCEPTION 'Insufficient eligible funding under the original donor restrictions'; END IF;
 END IF;
 UPDATE finance_requests SET status='Posted',reviewed_by=actor_uuid,reviewed_at=NOW(),review_note=decision_note WHERE id=r.id;
 INSERT INTO audit_log(user_id,action,record_id) VALUES(actor_uuid,'Approved and posted '||r.kind||': '||r.reference,r.id);
 RETURN jsonb_build_object('ok',true,'status','Posted');
END $$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION ecf_protect_service_trace() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.beneficiary_id IS DISTINCT FROM OLD.beneficiary_id OR NEW.program_id IS DISTINCT FROM OLD.program_id)
 AND (EXISTS(SELECT 1 FROM finance_requests WHERE service_id=OLD.id AND status IN ('Submitted','Posted')) OR EXISTS(SELECT 1 FROM service_hours WHERE service_id=OLD.id AND status<>'Rejected')) THEN
   RAISE EXCEPTION 'Service identity and program cannot change after financial or hours records are linked; create a new service instead';
 END IF;
 IF NEW.service_date IS DISTINCT FROM OLD.service_date AND EXISTS(SELECT 1 FROM service_hours WHERE service_id=OLD.id AND status<>'Rejected') THEN
   RAISE EXCEPTION 'Service date cannot change after hours are submitted; retain the original dated record';
 END IF;
 RETURN NEW;
END $$;
-- statement-breakpoint
DROP TRIGGER IF EXISTS service_trace_protection ON service_records;
-- statement-breakpoint
CREATE TRIGGER service_trace_protection BEFORE UPDATE ON service_records FOR EACH ROW EXECUTE FUNCTION ecf_protect_service_trace();
