import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, sameOrigin } from "@/lib/auth";
import { database } from "@/lib/db";
import {
  builderCatalog,
  validateDefinition,
} from "@/lib/report-builder-model.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!builderCatalog(user.role).length)
    return NextResponse.json(
      { error: "Report access required." },
      { status: 403 },
    );
  const includeArchived =
    new URL(request.url).searchParams.get("archived") === "1";
  const rows = await database().query(
    `SELECT id,name,description,definition,version,updated_at,archived_at FROM saved_reports WHERE owner_id=$1 ${includeArchived ? "" : "AND archived_at IS NULL"} ORDER BY updated_at DESC,id`,
    [user.id],
  );
  const reports = rows.map((row) => {
    try {
      validateDefinition(row.definition, user.role);
      return { ...row, available: true };
    } catch {
      return {
        id: row.id,
        name: "Unavailable report",
        description:
          "This report uses a topic or field outside your current permissions.",
        version: row.version,
        updated_at: row.updated_at,
        archived_at: row.archived_at,
        definition: null,
        available: false,
      };
    }
  });
  return NextResponse.json(
    { reports },
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
  if (!user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!builderCatalog(user.role).length)
    return NextResponse.json(
      { error: "Report access required." },
      { status: 403 },
    );
  try {
    const text = await request.text();
    if (text.length > 30000)
      return NextResponse.json(
        { error: "Report configuration is too large." },
        { status: 413 },
      );
    const raw = JSON.parse(text),
      sql = database();
    if (raw.action === "save") {
      const body = z
        .object({
          action: z.literal("save"),
          id: z.uuid(),
          expected_version: z.number().int().min(0),
          name: z.string().trim().min(1).max(120),
          description: z.string().trim().max(500).default(""),
          definition: z.unknown(),
        })
        .strict()
        .parse(raw);
      const { definition } = validateDefinition(body.definition, user.role),
        json = JSON.stringify(definition);
      const rows = await sql.query(
        `WITH inserted AS (
    INSERT INTO saved_reports(id,owner_id,name,description,definition) SELECT $1,$2,$3,$4,$5::jsonb WHERE $6::int=0 ON CONFLICT(id) DO NOTHING RETURNING *
    ), updated AS (
    UPDATE saved_reports SET name=$3,description=$4,definition=$5::jsonb,version=version+1,updated_at=NOW()
    WHERE id=$1 AND owner_id=$2 AND version=$6::int AND $6::int>0 AND archived_at IS NULL RETURNING *
    ), changed AS (SELECT * FROM inserted UNION ALL SELECT * FROM updated), audited AS (
    INSERT INTO audit_log(user_id,action,record_id,details) SELECT $2,CASE WHEN $6::int=0 THEN 'Created saved report' ELSE 'Updated saved report' END,id,jsonb_build_object('name',name,'version',version,'dataset',definition->>'dataset') FROM changed
    ) SELECT id,name,description,definition,version,updated_at,archived_at FROM changed`,
        [
          body.id,
          user.id,
          body.name,
          body.description,
          json,
          body.expected_version,
        ],
      );
      if (rows.length)
        return NextResponse.json(
          { report: { ...rows[0], available: true } },
          { headers: { "Cache-Control": "no-store" } },
        );
      const prior = await sql.query(
        `SELECT id,name,description,definition,version,updated_at,archived_at,(name=$3 AND description=$4 AND definition=$5::jsonb) AS same_definition FROM saved_reports WHERE id=$1 AND owner_id=$2`,
        [body.id, user.id, body.name, body.description, json],
      );
      if (
        prior.length &&
        !prior[0].archived_at &&
        prior[0].version === body.expected_version + 1 &&
        prior[0].same_definition
      ) {
        const { same_definition, ...report } = prior[0];
        return NextResponse.json({
          report: { ...report, available: true },
          already_saved: true,
        });
      }
      if (body.expected_version > 0 && !prior.length)
        return NextResponse.json(
          { error: "Report not found." },
          { status: 404 },
        );
      return NextResponse.json(
        {
          error: prior[0]?.archived_at
            ? "Restore this archived report before updating it."
            : "This report changed in another session. Reopen it or save a new copy.",
        },
        { status: 409 },
      );
    }
    const body = z
      .object({
        action: z.enum(["archive", "restore"]),
        id: z.uuid(),
        expected_version: z.number().int().positive(),
      })
      .strict()
      .parse(raw);
    const archive = body.action === "archive";
    const rows = await sql.query(
      `WITH changed AS (
   UPDATE saved_reports SET archived_at=${archive ? "NOW()" : "NULL"},version=version+1,updated_at=NOW()
   WHERE id=$1 AND owner_id=$2 AND version=$3 AND archived_at IS ${archive ? "NULL" : "NOT NULL"} RETURNING *
   ),audited AS (INSERT INTO audit_log(user_id,action,record_id) SELECT $2,$4,id FROM changed)
   SELECT id,version,archived_at FROM changed`,
      [
        body.id,
        user.id,
        body.expected_version,
        archive ? "Archived saved report" : "Restored saved report",
      ],
    );
    if (!rows.length) {
      const existing = await sql.query(
        "SELECT version,archived_at FROM saved_reports WHERE id=$1 AND owner_id=$2",
        [body.id, user.id],
      );
      if (!existing.length)
        return NextResponse.json(
          { error: "Report not found." },
          { status: 404 },
        );
      if (
        existing[0].version === body.expected_version + 1 &&
        Boolean(existing[0].archived_at) === archive
      )
        return NextResponse.json({ ok: true, already_saved: true });
      return NextResponse.json(
        {
          error:
            "The report changed in another session. Refresh your saved reports.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, report: rows[0] });
  } catch (error) {
    const e = error as Error & { code?: string };
    const forbidden = e.code === "FORBIDDEN",
      databaseError = e.code && !forbidden;
    if (databaseError) console.error("Saved report update failed", e.code);
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : databaseError
          ? "Unable to save this report. Please retry."
          : e instanceof SyntaxError
            ? "Check the report configuration."
            : e.message;
    return NextResponse.json(
      { error: message || "Check the report configuration." },
      { status: forbidden ? 403 : databaseError ? 500 : 400 },
    );
  }
}
