import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { currentUser, digest, sameOrigin } from "@/lib/auth";
import { database } from "@/lib/db";
export async function GET() {
  const user = await currentUser();
  if (user?.role !== "admin")
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  const sql = database();
  const rows =
    await sql`SELECT id,name,email,role,active,(password_hash IS NOT NULL) AS activated FROM users ORDER BY created_at`;
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const user = await currentUser();
  if (user?.role !== "admin")
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  try {
    const body = await request.json();
    const sql = database();
    if (body.action === "disable") {
      const id = z.uuid().parse(body.id);
      if (id === user.id)
        return NextResponse.json(
          { error: "You cannot deactivate your own account." },
          { status: 400 },
        );
      await sql.transaction([
        sql`UPDATE users SET active=false WHERE id=${id}`,
        sql`DELETE FROM sessions WHERE user_id=${id}`,
        sql`DELETE FROM invitations WHERE user_id=${id}`,
        sql`INSERT INTO audit_log(user_id,action,record_id) VALUES(${user.id},'Deactivated account',${id})`,
      ]);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "reinvite") {
      const id = z.uuid().parse(body.id);
      const rows =
        await sql`SELECT id FROM users WHERE id=${id} AND active=true`;
      if (!rows[0])
        return NextResponse.json(
          { error: "Active account not found." },
          { status: 404 },
        );
      const token = randomBytes(32).toString("hex");
      await sql.transaction([
        sql`DELETE FROM invitations WHERE user_id=${id}`,
        sql`INSERT INTO invitations(token_hash,user_id,expires_at) VALUES(${digest(token)},${id},NOW()+INTERVAL '24 hours')`,
        sql`INSERT INTO audit_log(user_id,action,record_id) VALUES(${user.id},'Reissued account invitation',${id})`,
      ]);
      return NextResponse.json({
        ok: true,
        invitation:
          new URL(request.headers.get("origin")!).origin +
          "/activate#token=" +
          token,
      });
    }
    const data = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email().max(254),
        role: z.enum(["admin", "coordinator", "fundraising", "volunteer"]),
      })
      .parse(body);
    const token = randomBytes(32).toString("hex");
    const rows = await sql`WITH invited AS (
      INSERT INTO users(name,email,role) VALUES(${data.name},${data.email.toLowerCase()},${data.role})
      ON CONFLICT(email) DO NOTHING RETURNING id
    ), issued AS (
      INSERT INTO invitations(token_hash,user_id,expires_at)
      SELECT ${digest(token)},id,NOW()+INTERVAL '24 hours' FROM invited RETURNING user_id
    )
    INSERT INTO audit_log(user_id,action,record_id)
    SELECT ${user.id},${"Invited " + data.role + " account"},user_id FROM issued RETURNING record_id`;
    if (!rows[0])
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    return NextResponse.json({
      ok: true,
      invitation:
        new URL(request.headers.get("origin")!).origin +
        "/activate#token=" +
        token,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Please check the account details." },
        { status: 400 },
      );
    console.error("Account administration failed");
    return NextResponse.json(
      { error: "Unable to update the account." },
      { status: 500 },
    );
  }
}
