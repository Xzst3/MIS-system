import { NextResponse } from "next/server";
import { z } from "zod";
import { database, databaseReady } from "@/lib/db";
import { rateLimit, sameOrigin } from "@/lib/auth";
const schema = z.object({
  kind: z.enum(["support", "volunteer", "donation", "resource"]),
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
    const kind = {
      support: "clients",
      volunteer: "volunteers",
      donation: "donors",
      resource: "clients",
    }[data.kind];
    const detail =
      data.kind === "donation"
        ? "Unpaid donation pledge from public portal."
        : data.kind === "resource"
          ? "Resource interest from public portal."
          : "Request from public portal. Consent recorded.";
    await sql.transaction([
      sql`INSERT INTO submissions(kind,name,email,category,amount) VALUES(${data.kind},${data.name},${data.email.toLowerCase()},${data.category},${data.amount || null})`,
      sql`INSERT INTO records(kind,name,email,category,status,detail,amount) VALUES(${kind},${data.name},${data.email.toLowerCase()},${data.category},${data.kind === "donation" ? "Pledged" : "New"},${detail},${data.amount || null})`,
    ]);
    return NextResponse.json({
      ok: true,
      message:
        data.kind === "donation"
          ? "Thank you. Your pledge has been recorded. No payment has been taken."
          : "Thank you. Your request has been received by our team.",
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
