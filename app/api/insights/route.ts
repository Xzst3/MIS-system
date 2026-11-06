import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { database } from "@/lib/db";
export async function GET() {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const sql = database();
  const financial = ["admin", "finance", "fundraising"].includes(user.role);
  const serviceOwner = ["admin", "coordinator"].includes(user.role);
  const [money, services, programs, months, queue] = await Promise.all([
    financial
      ? sql.query(`SELECT COALESCE((SELECT sum(delta_cents) FROM finance_postings),0)::text AS available,
   COALESCE((SELECT sum(amount_cents) FROM finance_requests WHERE kind IN ('cash_donation','asset_sale') AND status='Posted'),0)::text AS received,
   COALESCE((SELECT sum(amount_cents) FROM finance_requests WHERE kind='expense' AND status='Posted' AND EXTRACT(YEAR FROM event_date)=EXTRACT(YEAR FROM CURRENT_DATE)),0)::text AS spent,
   (SELECT count(*)::int FROM finance_requests WHERE status='Submitted') AS pending,
   (SELECT count(DISTINCT person_id)::int FROM finance_requests WHERE status='Posted' AND kind IN ('cash_donation','in_kind')) AS donors,
   (SELECT count(*)::int FROM(SELECT person_id FROM finance_requests WHERE status='Posted' AND kind IN ('cash_donation','in_kind') GROUP BY person_id HAVING count(*)>1) d) AS returning_donors,
   COALESCE((SELECT sum(amount_cents) FROM finance_requests WHERE kind='in_kind' AND status='Posted'),0)::text AS in_kind_value`)
      : Promise.resolve([]),
    sql.query(
      `SELECT count(DISTINCT beneficiary_id) FILTER(WHERE status='Completed')::int AS beneficiaries,count(*) FILTER(WHERE status IN ('Planned','In progress'))::int AS open,count(*) FILTER(WHERE status='Completed')::int AS completed FROM service_records ${serviceOwner || financial ? "" : "WHERE assigned_to=$1"}`,
      serviceOwner || financial ? [] : [user.id],
    ),
    serviceOwner || financial
      ? sql.query(
          `SELECT p.id,p.name,p.service_area,(SELECT count(*)::int FROM service_records s WHERE s.program_id=p.id AND status='Completed') AS completed,(SELECT count(DISTINCT beneficiary_id)::int FROM service_records s WHERE s.program_id=p.id AND status='Completed') AS beneficiaries,COALESCE((SELECT sum(r.amount_cents) FROM finance_requests r JOIN funds f ON f.id=r.fund_id WHERE f.program_id=p.id AND r.kind='expense' AND r.status='Posted'),0)::text AS spent FROM programs p ORDER BY p.code`,
        )
      : Promise.resolve([]),
    sql.query(
      `SELECT to_char(m,'YYYY-MM') AS month,
   (SELECT count(*)::int FROM service_records s WHERE date_trunc('month',s.service_date)=m ${serviceOwner || financial ? "" : "AND s.assigned_to=$1"}) AS services,
   (SELECT count(*)::int FROM service_records s WHERE date_trunc('month',s.service_date)=m AND status='Completed' ${serviceOwner || financial ? "" : "AND s.assigned_to=$1"}) AS completed,
   ${financial ? "COALESCE((SELECT sum(amount_cents) FROM finance_requests r WHERE date_trunc('month',r.event_date)=m AND status='Posted' AND kind IN ('cash_donation','asset_sale')),0)::text" : "'0'"} AS received
   FROM generate_series(date_trunc('month',CURRENT_DATE)-interval '5 months',date_trunc('month',CURRENT_DATE),interval '1 month') m`,
      serviceOwner || financial ? [] : [user.id],
    ),
    sql.query(
      `SELECT h.id,h.hours::text,h.status,e.role FROM service_hours h JOIN person_engagements e ON e.id=h.engagement_id ${serviceOwner ? "" : "WHERE h.submitted_by=$1"}`,
      serviceOwner ? [] : [user.id],
    ),
  ]);
  const summary = money[0]
    ? Object.fromEntries(
        Object.entries(money[0]).map(([k, v]) => [k, Number(v)]),
      )
    : null;
  return NextResponse.json(
    {
      financial: summary,
      services: services[0],
      programs: programs.map((p) => ({
        ...p,
        spent: financial ? Number(p.spent) : null,
      })),
      months: months.map((m) => ({
        ...m,
        received: financial ? Number(m.received) : null,
      })),
      approved_volunteer_hours: queue
        .filter((h) => h.role === "volunteer" && h.status === "Approved")
        .reduce((n, h) => n + Number(h.hours), 0),
      submitted_hours: queue.filter((h) => h.status === "Submitted").length,
      year: new Date().getUTCFullYear(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
