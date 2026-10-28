import { NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/lib/db";
import { currentUser, sameOrigin } from "@/lib/auth";
import { canAccess, canWrite } from "@/lib/permissions.mjs";
const kinds = [
  "clients",
  "donors",
  "referrals",
  "partners",
  "volunteers",
  "tasks",
] as const;
const recordSchema = z.object({
  kind: z.enum(kinds),
  name: z.string().trim().min(2).max(100),
  email: z.union([z.email().max(254), z.literal("")]).optional(),
  category: z.string().trim().min(1).max(100),
  status: z.enum([
    "New",
    "Active",
    "Pending",
    "In progress",
    "Completed",
    "Pledged",
    "Received",
    "Contacted",
    "Archived",
  ]),
  detail: z.string().trim().max(1000).default(""),
  amount: z.number().min(0).max(1000000).nullable().optional(),
  assigned_to: z.uuid().nullable().optional(),
});
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const sql = database();
  const data: Record<string, unknown> = {};
  for (const kind of kinds) {
    if (!canAccess(user.role, kind)) {
      data[kind] = [];
      continue;
    }
    data[kind] =
      user.role === "volunteer" && kind === "tasks"
        ? await sql`SELECT id,name,category,status,detail,assigned_to,created_at FROM records WHERE kind=${kind} AND assigned_to=${user.id} ORDER BY created_at DESC LIMIT 500`
        : await sql`SELECT id,name,email,category,status,detail,amount,assigned_to,created_at FROM records WHERE kind=${kind} ORDER BY created_at DESC LIMIT 500`;
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const body = await request.json();
    const sql = database();
    if (body.id) {
      const data = z
        .object({
          id: z.uuid(),
          kind: z.enum(kinds),
          status: z.enum([
            "New",
            "Active",
            "Pending",
            "In progress",
            "Completed",
            "Pledged",
            "Received",
            "Contacted",
            "Archived",
          ]),
        })
        .parse(body);
      if (!canWrite(user.role, data.kind))
        return NextResponse.json(
          { error: "You do not have permission." },
          { status: 403 },
        );
      const rows =
        user.role === "volunteer"
          ? await sql`UPDATE records SET status=${data.status},updated_at=NOW() WHERE id=${data.id} AND kind='tasks' AND assigned_to=${user.id} RETURNING id`
          : await sql`UPDATE records SET status=${data.status},updated_at=NOW() WHERE id=${data.id} AND kind=${data.kind} RETURNING id`;
      if (!rows[0])
        return NextResponse.json(
          { error: "Record not found." },
          { status: 404 },
        );
      await sql`INSERT INTO audit_log(user_id,action,record_id) VALUES(${user.id},${"Updated " + data.kind + " status to " + data.status},${data.id})`;
      return NextResponse.json({ ok: true });
    }
    const data = recordSchema.parse(body);
    if (!canWrite(user.role, data.kind) || user.role === "volunteer")
      return NextResponse.json(
        { error: "You do not have permission to create this record." },
        { status: 403 },
      );
    const rows =
      await sql`INSERT INTO records(kind,name,email,category,status,detail,amount,assigned_to,created_by) VALUES(${data.kind},${data.name},${data.email || null},${data.category},${data.status},${data.detail},${data.kind === "donors" ? data.amount || null : null},${data.assigned_to || null},${user.id}) RETURNING id`;
    await sql`INSERT INTO audit_log(user_id,action,record_id) VALUES(${user.id},${"Created " + data.kind},${rows[0].id})`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Please check the record fields." },
        { status: 400 },
      );
    console.error("Record mutation failed");
    return NextResponse.json(
      { error: "Unable to save this record." },
      { status: 500 },
    );
  }
}
