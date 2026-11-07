import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, sameOrigin } from "@/lib/auth";
import {
  builderCatalog,
  builderTemplates,
  periodChoices,
} from "@/lib/report-builder-model.mjs";
import { runBuilder } from "@/lib/report-builder-query";
import { ReportAccessError } from "@/lib/report-source";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const datasets = builderCatalog(user.role);
  if (!datasets.length)
    return NextResponse.json(
      { error: "Report access required." },
      { status: 403 },
    );
  return NextResponse.json(
    {
      datasets,
      templates: builderTemplates(user.role),
      periods: periodChoices,
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
  if (!user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!builderCatalog(user.role).length)
    return NextResponse.json(
      { error: "Report access required." },
      { status: 403 },
    );
  try {
    const text = await request.text();
    if (text.length > 25000)
      return NextResponse.json(
        { error: "Report configuration is too large." },
        { status: 413 },
      );
    const body = z
      .object({
        definition: z.unknown(),
        page: z.number().int().min(1).max(100000).default(1),
        format: z.enum(["json", "csv"]).default("json"),
      })
      .strict()
      .parse(JSON.parse(text));
    const result = await runBuilder(
      user,
      body.definition,
      body.page,
      body.format,
    );
    if ("tooLarge" in result)
      return NextResponse.json(
        {
          error:
            "More than 20,000 rows match. Narrow the filters before exporting.",
        },
        { status: 422 },
      );
    if ("csv" in result)
      return new Response(result.csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const e = error as Error & { code?: string };
    const forbidden =
      error instanceof ReportAccessError || e.code === "FORBIDDEN";
    const databaseError = e.code && e.code !== "FORBIDDEN";
    if (databaseError) console.error("Custom report query failed", e.code);
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : databaseError
          ? "Unable to query this report. Please retry."
          : e instanceof SyntaxError
            ? "Check the report configuration."
            : e.message;
    return NextResponse.json(
      { error: message || "Check the report configuration." },
      { status: forbidden ? 403 : databaseError ? 500 : 400 },
    );
  }
}
