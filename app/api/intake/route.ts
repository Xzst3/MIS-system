import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { database, databaseReady } from "@/lib/db";
import { rateLimit, sameOrigin } from "@/lib/auth";
const schema = z.object({
  kind: z.enum(["support", "volunteer", "resource"]),
  client_reference: z.uuid().optional(),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  category: z.string().trim().min(1).max(100),
  amount: z.number().min(1).max(1000000).optional(),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
});
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  if (!databaseReady())
    return NextResponse.json(
      {
        error:
          "Online requests are not available yet. Please return soon; no information has been saved.",
      },
      { status: 503 },
    );
  try {
    const body = await request.json();
    const data = schema.parse(body);
    const ip =
      request.headers.get("x-vercel-forwarded-for") ||
      request.headers.get("x-forwarded-for") ||
      "local";
    if (!(await rateLimit(`intake:${ip}`, 5, 3600)))
      return NextResponse.json(
        { error: "Too many requests. Please try again in an hour." },
        { status: 429 },
      );
    const sql = database();
    const reference = data.client_reference || randomUUID();
    const exists = await sql.query(
      "SELECT id FROM submissions WHERE client_reference=$1",
      [reference],
    );
    if (!exists.length)
      await sql.query(
        `WITH person AS (
      INSERT INTO people(name,email,notes) VALUES($1,$2,$3)
      ON CONFLICT(lower(email)) WHERE email IS NOT NULL DO UPDATE SET updated_at=people.updated_at RETURNING id,merged_into
    ), identity AS (SELECT COALESCE(merged_into,id) AS id FROM person), engagement AS (
      INSERT INTO person_engagements(person_id,role,status)
      SELECT id,$4,$5 FROM identity WHERE NOT EXISTS(SELECT 1 FROM person_engagements e WHERE e.person_id=identity.id AND e.role=$4) RETURNING id
    ), receipt AS (
      INSERT INTO submissions(kind,name,email,category,person_id,client_reference) SELECT $6,$1,$2,$7,id,$8 FROM identity RETURNING id
    ) INSERT INTO records(kind,name,email,category,status,detail,person_id) SELECT $9,$1,$2,$7,'New',$3,id FROM identity`,
        [
          data.name,
          data.email.toLowerCase(),
          "Website " +
            data.kind +
            " request: " +
            data.category +
            ". Consent recorded.",
          data.kind === "volunteer" ? "volunteer" : "beneficiary",
          data.kind === "volunteer" ? "Pending" : "Active",
          data.kind,
          data.category,
          reference,
          data.kind === "volunteer" ? "volunteers" : "clients",
        ],
      );
    return NextResponse.json({
      ok: true,
      message: "Thank you. Your request has been received by our team.",
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Please complete all fields and give your consent." },
        { status: 400 },
      );
    console.error("Public intake failed");
    return NextResponse.json(
      { error: "We could not save your request. Please try again." },
      { status: 500 },
    );
  }
}
