import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { database, databaseReady } from "@/lib/db";
import {
  createSession,
  currentUser,
  digest,
  hashPassword,
  rateLimit,
  sameOrigin,
  verifyPassword,
} from "@/lib/auth";
export async function GET() {
  return NextResponse.json(
    { user: await currentUser() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  if (!databaseReady())
    return NextResponse.json(
      { error: "The workspace is being set up. Please try again later." },
      { status: 503 },
    );
  try {
    const body = await request.json();
    const sql = database();
    if (body.action === "logout") {
      const token = (await cookies()).get("ecf_session")?.value;
      if (token)
        await sql`DELETE FROM sessions WHERE token_hash=${digest(token)}`;
      (await cookies()).delete("ecf_session");
      return NextResponse.json({ ok: true });
    }
    const ip =
      request.headers.get("x-vercel-forwarded-for") ||
      request.headers.get("x-forwarded-for") ||
      "local";
    if (!(await rateLimit(`auth:${ip}`, 15)))
      return NextResponse.json(
        { error: "Too many attempts. Please try again in 15 minutes." },
        { status: 429 },
      );
    if (body.action === "activate") {
      const data = z
        .object({
          token: z.string().regex(/^[a-f0-9]{64}$/),
          password: z.string().min(12).max(128),
        })
        .parse(body);
      const rows =
        await sql`SELECT i.user_id FROM invitations i JOIN users u ON u.id=i.user_id WHERE i.token_hash=${digest(data.token)} AND i.expires_at>NOW() AND u.active=true`;
      if (!rows[0])
        return NextResponse.json(
          { error: "This invitation has expired or has already been used." },
          { status: 400 },
        );
      const hash = await hashPassword(data.password);
      const result =
        await sql`WITH consumed AS (DELETE FROM invitations WHERE token_hash=${digest(data.token)} AND expires_at>NOW() RETURNING user_id) UPDATE users SET password_hash=${hash} WHERE id IN (SELECT user_id FROM consumed) RETURNING id`;
      if (!result[0])
        return NextResponse.json(
          { error: "This invitation has already been used." },
          { status: 400 },
        );
      await sql`DELETE FROM sessions WHERE user_id=${result[0].id}`;
      await createSession(String(result[0].id));
      return NextResponse.json({ ok: true });
    }
    const data = z
      .object({
        username: z
          .string()
          .trim()
          .min(3)
          .max(32)
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]+$/),
        password: z.string().min(1).max(128),
      })
      .parse(body);
    if (!(await rateLimit(`login:${data.username.toLowerCase()}`, 10)))
      return NextResponse.json(
        { error: "Too many attempts. Please try again in 15 minutes." },
        { status: 429 },
      );
    const rows =
      await sql`SELECT id,password_hash FROM users WHERE username=${data.username.toLowerCase()} AND active=true`;
    const valid = await verifyPassword(
      data.password,
      rows[0]?.password_hash ||
        "00000000000000000000000000000000:" + "0".repeat(128),
    );
    if (!rows[0] || !valid)
      return NextResponse.json(
        { error: "The username or password is incorrect." },
        { status: 401 },
      );
    await createSession(String(rows[0].id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error:
            "Enter a valid username and password. Passwords must be at least 12 characters when activating an account.",
        },
        { status: 400 },
      );
    console.error("Authentication request failed");
    return NextResponse.json(
      { error: "Unable to sign in right now. Please try again." },
      { status: 500 },
    );
  }
}
