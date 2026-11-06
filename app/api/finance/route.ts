import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentUser, sameOrigin } from "@/lib/auth";
import { database } from "@/lib/db";
import type { Role } from "@/lib/types";
import { expenseCategories } from "@/lib/report-config";
const canEnter = (role: Role) =>
  ["admin", "finance", "coordinator", "fundraising"].includes(role);
const kinds = [
  "cash_donation",
  "allocation",
  "expense",
  "budget",
  "in_kind",
  "distribution",
  "asset_sale",
] as const;
const date = z.iso
  .date()
  .refine(
    (s) =>
      s >= "2000-01-01" &&
      s <=
        new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }),
    "Use a date between 2000 and today.",
  );
const input = z.object({
  action: z.literal("submit"),
  client_reference: z.uuid(),
  kind: z.enum(kinds),
  amount: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,2})?$/)
    .default("0"),
  currency: z.literal("USD").default("USD"),
  event_date: date,
  fund_id: z.uuid(),
  to_fund_id: z.uuid().nullable().optional(),
  person_id: z.uuid().nullable().optional(),
  service_id: z.uuid().nullable().optional(),
  item_id: z.uuid().nullable().optional(),
  quantity: z.coerce
    .number()
    .positive()
    .max(1000000)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001)
    .nullable()
    .optional(),
  item_name: z.string().trim().max(150).optional(),
  external_reference: z.string().trim().max(150).optional(),
  settlement_confirmed: z.boolean().default(false),
  description: z.string().trim().min(5).max(1000),
  expense_category: z
    .enum(Object.keys(expenseCategories) as [string, ...string[]])
    .default("uncategorized"),
});
function cents(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export async function GET() {
  const user = await currentUser();
  if (!user || !canEnter(user.role))
    return NextResponse.json(
      { error: "Financial access required." },
      { status: 403 },
    );
  const sql = database();
  const scope =
    user.role === "coordinator"
      ? "own"
      : user.role === "fundraising"
        ? "giving"
        : "all";
  const filter =
    scope === "own"
      ? "WHERE r.submitted_by=$1"
      : scope === "giving"
        ? "WHERE r.kind IN ('cash_donation','in_kind','asset_sale') OR r.submitted_by=$1"
        : "";
  const results = await Promise.all([
    sql.query(`SELECT f.*,COALESCE((SELECT sum(delta_cents) FROM finance_postings p WHERE p.fund_id=f.id),0)::text AS balance_cents,
   COALESCE((SELECT limit_cents FROM fund_budgets b WHERE b.fund_id=f.id AND fiscal_year=EXTRACT(YEAR FROM CURRENT_DATE)::int),0)::text AS budget_cents,
   COALESCE((SELECT sum(amount_cents) FROM finance_requests r WHERE r.fund_id=f.id AND kind='expense' AND status='Posted' AND EXTRACT(YEAR FROM event_date)=EXTRACT(YEAR FROM CURRENT_DATE)),0)::text AS spent_cents,
   COALESCE((SELECT sum(amount_cents) FROM finance_requests r WHERE r.fund_id=f.id AND kind='expense' AND status='Posted'),0)::text AS total_spent_cents,
   COALESCE((SELECT sum(amount_cents) FROM finance_requests r WHERE r.fund_id=f.id AND kind IN ('cash_donation','asset_sale') AND status='Posted'),0)::text AS received_cents,
   COALESCE((SELECT sum(amount_cents) FROM finance_requests r WHERE r.to_fund_id=f.id AND kind='allocation' AND status='Posted'),0)::text AS allocated_in_cents,
   COALESCE((SELECT sum(amount_cents) FROM finance_requests r WHERE r.fund_id=f.id AND kind='allocation' AND status='Posted'),0)::text AS allocated_out_cents
   FROM funds f WHERE active=true ORDER BY f.code='general' DESC,f.name`),
    sql.query(
      `SELECT r.*,COALESCE(u.name,'Website checkout') AS submitter,v.name AS reviewer,f.name AS fund_name,t.name AS target_fund,p.name AS person_name,receipt.name AS submitted_name,receipt.email AS submitted_email,receipt.consent_at,${scope === "giving" ? "NULL AS service_title,NULL AS beneficiary" : "s.title AS service_title,b.name AS beneficiary"}
   FROM finance_requests r LEFT JOIN users u ON u.id=r.submitted_by LEFT JOIN users v ON v.id=r.reviewed_by JOIN funds f ON f.id=r.fund_id LEFT JOIN funds t ON t.id=r.to_fund_id LEFT JOIN people p ON p.id=r.person_id LEFT JOIN service_records s ON s.id=r.service_id LEFT JOIN people b ON b.id=s.beneficiary_id LEFT JOIN submissions receipt ON receipt.id=r.submission_id ${filter} ORDER BY r.created_at DESC LIMIT 1000`,
      scope === "all" ? [] : [user.id],
    ),
    scope === "own"
      ? Promise.resolve([])
      : sql.query(
          "SELECT DISTINCT p.id,p.name FROM people p JOIN person_engagements e ON e.person_id=p.id WHERE e.role='donor' AND e.status='Active' ORDER BY p.name",
        ),
    scope === "giving"
      ? Promise.resolve([])
      : sql.query(
          "SELECT s.id,s.title,s.program_id,b.name AS beneficiary FROM service_records s JOIN people b ON b.id=s.beneficiary_id WHERE s.status<>'Cancelled' ORDER BY s.service_date DESC LIMIT 500",
        ),
    sql.query(
      `SELECT i.*,${scope === "own" ? "'Inventory source'" : "p.name"} AS donor,COALESCE((SELECT sum(quantity) FROM inventory_movements m WHERE m.item_id=i.id),0)::text AS quantity FROM inventory_items i JOIN people p ON p.id=i.donor_id ORDER BY i.created_at DESC`,
    ),
    scope === "own"
      ? Promise.resolve([])
      : sql.query(`SELECT p.*,d.reference AS donation_reference,person.name AS donor,r.reference AS request_reference,r.kind,${scope === "giving" ? "NULL AS service_title,NULL AS beneficiary" : "s.title AS service_title,b.name AS beneficiary"},f.name AS fund_name
   FROM finance_postings p JOIN finance_requests r ON r.id=p.request_id JOIN finance_lots l ON l.id=p.lot_id JOIN finance_requests d ON d.id=l.id JOIN people person ON person.id=l.donor_id JOIN funds f ON f.id=p.fund_id LEFT JOIN service_records s ON s.id=r.service_id LEFT JOIN people b ON b.id=s.beneficiary_id ORDER BY p.id DESC LIMIT 3000`),
    sql.query("SELECT officer_limit_cents FROM finance_policy WHERE id=1"),
  ]);
  const numeric = (rows: Record<string, unknown>[], keys: string[]) =>
    rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          keys.includes(k) && v !== null ? Number(v) : v,
        ]),
      ),
    );
  return NextResponse.json(
    {
      funds: numeric(results[0], [
        "balance_cents",
        "budget_cents",
        "spent_cents",
        "total_spent_cents",
        "received_cents",
        "allocated_in_cents",
        "allocated_out_cents",
      ]),
      requests: numeric(results[1], ["amount_cents", "quantity"]),
      people: results[2],
      services: results[3],
      items: numeric(results[4], ["quantity", "estimated_value_cents"]),
      postings: numeric(results[5], ["id", "delta_cents"]),
      officer_limit_cents: Number(results[6][0].officer_limit_cents),
      scope,
      year: new Date().getUTCFullYear(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const user = await currentUser();
  if (!user || !canEnter(user.role))
    return NextResponse.json(
      { error: "Financial access required." },
      { status: 403 },
    );
  try {
    const body = await request.json();
    const sql = database();
    if (body.action === "review") {
      const data = z
        .object({
          id: z.uuid(),
          decision: z.enum(["approve", "reject"]),
          note: z.string().trim().max(1000).default(""),
        })
        .parse(body);
      if (!["admin", "finance"].includes(user.role))
        return NextResponse.json(
          { error: "Finance approval access required." },
          { status: 403 },
        );
      const result = await sql.query(
        "SELECT ecf_review_finance($1,$2,$3,$4) AS result",
        [data.id, user.id, data.decision, data.note],
      );
      return NextResponse.json(result[0].result);
    }
    if (body.action === "policy") {
      if (user.role !== "admin")
        return NextResponse.json(
          { error: "Administrator access required." },
          { status: 403 },
        );
      const data = z
        .object({ limit: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/) })
        .parse(body);
      const amount = cents(data.limit);
      if (amount <= 0) throw new Error("Authority must be greater than zero.");
      await sql.transaction([
        sql.query(
          "UPDATE finance_policy SET officer_limit_cents=$1 WHERE id=1",
          [amount],
        ),
        sql.query("INSERT INTO audit_log(user_id,action) VALUES($1,$2)", [
          user.id,
          "Changed finance approval authority to USD " + data.limit,
        ]),
      ]);
      return NextResponse.json({ ok: true });
    }
    const data = input.parse(body);
    const amount = cents(data.amount);
    const permitted =
      user.role === "coordinator"
        ? ["expense", "distribution"]
        : user.role === "fundraising"
          ? ["cash_donation", "in_kind"]
          : kinds;
    if (!permitted.includes(data.kind as never))
      return NextResponse.json(
        { error: "Your role cannot submit this transaction type." },
        { status: 403 },
      );
    if (!["in_kind", "distribution"].includes(data.kind) && amount <= 0)
      throw new Error("Enter an amount greater than zero.");
    if (["cash_donation", "in_kind"].includes(data.kind) && !data.person_id)
      throw new Error("Choose a donor profile.");
    if (
      ["cash_donation", "asset_sale", "expense"].includes(data.kind) &&
      !data.external_reference
    )
      throw new Error("A bank, provider or invoice reference is required.");
    if (
      data.kind === "allocation" &&
      (!data.to_fund_id || data.to_fund_id === data.fund_id)
    )
      throw new Error("Choose a different destination fund.");
    if (
      ["in_kind", "distribution", "asset_sale"].includes(data.kind) &&
      !data.quantity
    )
      throw new Error("Enter an item quantity.");
    if (["distribution", "asset_sale"].includes(data.kind) && !data.item_id)
      throw new Error("Choose an inventory item.");
    if (data.kind === "distribution" && !data.service_id)
      throw new Error("Choose the receiving beneficiary service record.");
    if (
      data.kind === "in_kind" &&
      (!data.item_name || data.item_name.length < 2)
    )
      throw new Error("Enter the item or asset name.");
    if (data.person_id) {
      const p = await sql.query(
        "SELECT id FROM person_engagements WHERE person_id=$1 AND role='donor' AND status='Active' AND starts_on<=$2 AND (ends_on IS NULL OR ends_on>=$2)",
        [data.person_id, data.event_date],
      );
      if (!p.length)
        throw new Error(
          "An active donor engagement on the transaction date is required.",
        );
    }
    if (data.service_id) {
      const s = await sql.query(
        "SELECT id FROM service_records WHERE id=$1 AND status<>'Cancelled'",
        [data.service_id],
      );
      if (!s.length) throw new Error("Choose an active service record.");
    }
    const id = randomUUID();
    const reference =
      "ECF-" +
      data.event_date.replaceAll("-", "") +
      "-" +
      id.slice(0, 8).toUpperCase();
    const inserted = await sql.transaction([
      sql.query(
        `INSERT INTO finance_requests(id,reference,client_reference,kind,amount_cents,currency,event_date,fund_id,to_fund_id,person_id,service_id,item_id,quantity,item_name,external_reference,settlement_confirmed,description,submitted_by,expense_category)
    VALUES($1,$2,$3,$4,$5,'USD',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT(client_reference) DO NOTHING RETURNING id`,
        [
          id,
          reference,
          data.client_reference,
          data.kind,
          amount,
          data.event_date,
          data.fund_id,
          data.kind === "allocation" ? data.to_fund_id : null,
          data.person_id || null,
          data.service_id || null,
          data.item_id || null,
          data.quantity || null,
          data.item_name || null,
          data.external_reference || null,
          data.settlement_confirmed,
          data.description,
          user.id,
          data.kind === "expense" ? data.expense_category : "uncategorized",
        ],
      ),
      sql.query(
        "INSERT INTO audit_log(user_id,action,record_id) SELECT $1,'Submitted financial request: '||reference,id FROM finance_requests WHERE id=$2",
        [user.id, id],
      ),
    ]);
    if (!inserted[0].length) {
      const existing = await sql.query(
        "SELECT * FROM finance_requests WHERE client_reference=$1",
        [data.client_reference],
      );
      if (existing[0]?.submitted_by !== user.id)
        return NextResponse.json(
          { error: "Request reference already exists." },
          { status: 409 },
        );
      const prior = existing[0];
      if (
        prior.kind !== data.kind ||
        Number(prior.amount_cents) !== amount ||
        prior.fund_id !== data.fund_id ||
        (prior.to_fund_id || null) !==
          (data.kind === "allocation" ? data.to_fund_id : null) ||
        (prior.person_id || null) !== (data.person_id || null) ||
        (prior.service_id || null) !== (data.service_id || null) ||
        (prior.item_id || null) !== (data.item_id || null) ||
        Number(prior.quantity || 0) !== Number(data.quantity || 0) ||
        (prior.event_date instanceof Date
          ? prior.event_date.toISOString()
          : String(prior.event_date)
        ).slice(0, 10) !== data.event_date ||
        prior.description !== data.description ||
        prior.expense_category !==
          (data.kind === "expense" ? data.expense_category : "uncategorized") ||
        (prior.external_reference || "") !== (data.external_reference || "") ||
        prior.settlement_confirmed !== data.settlement_confirmed
      )
        return NextResponse.json(
          {
            error:
              "This request reference was used for different transaction details. Start a new request.",
          },
          { status: 409 },
        );
      return NextResponse.json({
        ok: true,
        id: existing[0].id,
        reference: existing[0].reference,
        already_submitted: true,
      });
    }
    return NextResponse.json({ ok: true, id, reference });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message || "Check the transaction fields." },
        { status: 400 },
      );
    const e = error as Error & { code?: string };
    if (e.code === "23505")
      return NextResponse.json(
        {
          error:
            "This bank, provider or invoice reference is already recorded. Review the existing entry.",
        },
        { status: 409 },
      );
    const allowed = [
      "required",
      "must",
      "cannot",
      "Insufficient",
      "exceeds",
      "already",
      "Choose",
      "Enter",
      "match",
      "Restricted",
      "Amount",
      "different",
      "Allocate",
      "Confirm",
      "Use",
      "active",
      "not found",
      "revised",
      "Invalid",
    ];
    const message = allowed.some((word) => e.message?.includes(word))
      ? e.message
      : "Unable to save the financial request. Please try again.";
    console.error("Financial request failed", e.code || "validation");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
