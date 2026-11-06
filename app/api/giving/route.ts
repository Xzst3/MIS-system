import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sameOrigin, rateLimit } from "@/lib/auth";
import { database } from "@/lib/db";
const schema = z.object({
  client_reference: z.uuid(),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  amount: z.string().regex(/^\d{1,5}(\.\d{1,2})?$/),
  fund_code: z.enum([
    "general",
    "nutrition",
    "financial",
    "wellbeing",
    "healthcare",
    "welfare",
    "planning",
    "transport",
    "operations",
  ]),
  consent: z.literal(true),
  communication_consent: z.boolean().default(false),
  website: z.string().max(0).default(""),
});
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const data = schema.parse(await request.json());
    const [whole, fraction = ""] = data.amount.split(".");
    const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    if (amount < 100 || amount > 1000000)
      return NextResponse.json(
        { error: "Choose an amount between $1 and $10,000." },
        { status: 400 },
      );
    const ip =
      request.headers.get("x-vercel-forwarded-for") ||
      request.headers.get("x-forwarded-for") ||
      "local";
    if (!(await rateLimit("giving:" + ip, 10, 3600)))
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    const sql = database();
    const email = data.email.toLowerCase();
    const fund = await sql.query(
      "SELECT id FROM funds WHERE code=$1 AND active=true",
      [data.fund_code],
    );
    if (!fund.length) throw new Error("Giving designation unavailable.");
    const existing = await sql.query(
      "SELECT r.reference,r.amount_cents,r.fund_id,p.email FROM finance_requests r JOIN people p ON p.id=r.person_id WHERE r.client_reference=$1 AND r.source='website_preview'",
      [data.client_reference],
    );
    if (existing.length) {
      if (
        existing[0].email !== email ||
        Number(existing[0].amount_cents) !== amount ||
        existing[0].fund_id !== fund[0].id
      )
        return NextResponse.json(
          { error: "This checkout reference has already been used." },
          { status: 409 },
        );
      return NextResponse.json({ ok: true, reference: existing[0].reference });
    }
    const id = randomUUID();
    const reference = "ECF-WEB-" + id.slice(0, 8).toUpperCase();
    await sql.query(
      `WITH person AS (
   INSERT INTO people(name,email,communication_consent) VALUES($1,$2,$3)
   ON CONFLICT(lower(email)) WHERE email IS NOT NULL DO UPDATE SET updated_at=people.updated_at RETURNING id,merged_into
  ), identity AS (SELECT COALESCE(merged_into,id) AS id FROM person), engagement AS (
   INSERT INTO person_engagements(person_id,role,status)
   SELECT id,'donor','Active' FROM identity WHERE NOT EXISTS(SELECT 1 FROM person_engagements e WHERE e.person_id=identity.id AND role='donor' AND status='Active') ON CONFLICT DO NOTHING RETURNING id
  ), receipt AS (
   INSERT INTO submissions(kind,name,email,category,amount,person_id,communication_consent) SELECT 'giving',$1,$2,$4,$5::numeric/100,id,$3 FROM identity RETURNING id
  ) INSERT INTO finance_requests(id,reference,client_reference,kind,amount_cents,event_date,fund_id,person_id,external_reference,settlement_confirmed,description,source,submission_id)
   SELECT $6,$7,$8,'cash_donation',$5,(NOW() AT TIME ZONE 'Asia/Shanghai')::date,$9,identity.id,$7,false,'Website giving checkout; no external payment processor was charged. Contact and consent retained for review.','website_preview',(SELECT id FROM receipt) FROM identity`,
      [
        data.name,
        email,
        data.communication_consent,
        data.fund_code,
        amount,
        id,
        reference,
        data.client_reference,
        fund[0].id,
      ],
    );
    return NextResponse.json({ ok: true, reference });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Please check your details and give consent." },
        { status: 400 },
      );
    const e = error as { code?: string };
    if (e.code === "23505")
      return NextResponse.json(
        {
          error:
            "This checkout is already being processed. Retry with the same details.",
        },
        { status: 409 },
      );
    console.error("Giving checkout failed", e.code || "request");
    return NextResponse.json(
      {
        error:
          "We could not complete this checkout. Your details remain in the form; please try again.",
      },
      { status: 500 },
    );
  }
}
