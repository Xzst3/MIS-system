import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { database } from "@/lib/db";
export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "volunteer")
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  const sql = database();
  return NextResponse.json(
    await sql`SELECT id,name,role FROM users WHERE active=true ORDER BY name`,
    { headers: { "Cache-Control": "no-store" } },
  );
}
