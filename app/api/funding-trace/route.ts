import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { database } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!["admin", "finance", "fundraising"].includes(user.role))
    return NextResponse.json(
      { error: "Funding trace access required." },
      { status: 403 },
    );
  try {
    const { source, page } = z
      .object({
        source: z.uuid(),
        page: z.coerce.number().int().min(1).max(100000).default(1),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const sql = database();
    const beneficiaryAccess = user.role !== "fundraising";
    const [origins, summary, balances, movements, inventory, receipts] =
      await sql.transaction(
        [
          sql.query(
            `SELECT r.id,r.reference,r.kind,r.event_date,r.amount_cents::text,r.status,r.description,p.name donor,r.source,r.settlement_confirmed,r.quantity,r.item_name
    FROM finance_requests r LEFT JOIN finance_lots l ON l.id=r.id LEFT JOIN people p ON p.id=COALESCE(l.donor_id,r.person_id)
    WHERE r.id=$1 AND r.kind IN ('cash_donation','asset_sale','in_kind')`,
            [source],
          ),
          sql.query(
            `WITH links AS (
    SELECT beneficiary_id,service_id FROM ecf_funding_provenance WHERE (cash_source_id=$1 OR origin_receipt_id=$1) AND status='Posted' AND kind='expense' AND service_status='Completed'
    UNION SELECT s.beneficiary_id,s.id FROM inventory_movements m JOIN finance_requests r ON r.id=m.request_id JOIN service_records s ON s.id=r.service_id
    WHERE m.item_id=COALESCE((SELECT origin_asset_id FROM finance_lots WHERE id=$1),$1) AND r.status='Posted' AND r.kind='distribution' AND s.status='Completed'
    ) SELECT COALESCE(sum(delta_cents),0)::text remaining,
    (-COALESCE(sum(delta_cents) FILTER(WHERE kind='expense'),0))::text spent,
    COALESCE(sum(delta_cents) FILTER(WHERE kind IN ('cash_donation','asset_sale')),0)::text received,
    count(*)::int posting_count,(SELECT count(DISTINCT beneficiary_id)::int FROM links) people,
    (SELECT count(DISTINCT service_id)::int FROM links) services
    FROM ecf_funding_provenance WHERE (cash_source_id=$1 OR origin_receipt_id=$1) AND status='Posted'`,
            [source],
          ),
          sql.query(
            `SELECT fund_id,fund_name,sum(delta_cents)::text balance FROM ecf_funding_provenance
    WHERE (cash_source_id=$1 OR origin_receipt_id=$1) AND status='Posted' GROUP BY fund_id,fund_name ORDER BY fund_name`,
            [source],
          ),
          sql.query(
            `SELECT posting_id,transaction_reference,kind,event_date,fund_name,delta_cents::text,description,
    original_donation_reference,cash_source_reference,${beneficiaryAccess ? "service_title,beneficiary_name" : "NULL::text service_title,NULL::text beneficiary_name"},
    submitter_name,reviewer_name,reviewed_at,review_note
    FROM ecf_funding_provenance WHERE (cash_source_id=$1 OR origin_receipt_id=$1) AND status='Posted'
    ORDER BY event_date,posting_id LIMIT 25 OFFSET $2`,
            [source, (page - 1) * 25],
          ),
          sql.query(
            `SELECT r.reference,r.kind,r.event_date,m.quantity::text,r.description,r.status,
    ${beneficiaryAccess ? "b.name beneficiary,s.title service" : "NULL::text beneficiary,NULL::text service"},u.name reviewer
    FROM inventory_movements m JOIN finance_requests r ON r.id=m.request_id LEFT JOIN service_records s ON s.id=r.service_id
    LEFT JOIN people b ON b.id=s.beneficiary_id LEFT JOIN users u ON u.id=r.reviewed_by
    WHERE m.item_id=COALESCE((SELECT origin_asset_id FROM finance_lots WHERE id=$1),$1) AND r.status='Posted' ORDER BY r.event_date,m.id`,
            [source],
          ),
          sql.query(
            `SELECT r.id,r.reference,r.event_date,r.amount_cents::text FROM finance_requests r JOIN finance_lots l ON l.id=r.id
    WHERE l.origin_asset_id=$1 AND r.status='Posted' ORDER BY r.event_date,r.id`,
            [source],
          ),
        ],
        { isolationLevel: "RepeatableRead", readOnly: true },
      );
    if (!origins.length)
      return NextResponse.json(
        { error: "Contribution not found." },
        { status: 404 },
      );
    const s = summary[0],
      numeric = (value: unknown) => Number(value || 0);
    const received = numeric(s.received),
      spent = numeric(s.spent),
      remaining = numeric(s.remaining);
    return NextResponse.json(
      {
        origin: {
          ...origins[0],
          amount_cents: numeric(origins[0].amount_cents),
        },
        summary: {
          received,
          spent,
          remaining,
          reconciled: received - spent === remaining,
          people: s.people,
          services: s.services,
        },
        balances: balances.map((b) => ({ ...b, balance: numeric(b.balance) })),
        movements: movements.map((m) => ({
          ...m,
          delta_cents: numeric(m.delta_cents),
        })),
        inventory: inventory.map((i) => ({
          ...i,
          quantity: numeric(i.quantity),
        })),
        sales: receipts.map((r) => ({
          ...r,
          amount_cents: numeric(r.amount_cents),
        })),
        page,
        page_size: 25,
        total: s.posting_count,
        basis:
          "Full recorded history. Transfers conserve value. Expenses use approved source-lot attribution, not evidence that a particular physical dollar was spent.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (!(error instanceof z.ZodError))
      console.error(
        "Funding trace failed",
        (error as { code?: string }).code || "query",
      );
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Use a valid contribution and page."
            : "Unable to load the contribution history. Please retry.",
      },
      { status: 400 },
    );
  }
}
