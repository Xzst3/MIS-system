import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { database } from "@/lib/db";
import { csvCell } from "@/lib/report-periods.mjs";
import {
  reportDefinitions,
  expenseCategories,
  type ReportId,
  type ReportColumn,
} from "@/lib/report-config";
import { financeLabels } from "@/lib/finance-types";
import {
  buildReportSource,
  paramsSchema,
  column,
  ReportAccessError,
} from "@/lib/report-source";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const search = Object.fromEntries(new URL(request.url).searchParams);
    const input = paramsSchema.parse(search);
    const report = input.report;
    if (
      !(reportDefinitions[report].roles as readonly string[]).includes(
        user.role,
      )
    )
      return NextResponse.json(
        { error: "Your role cannot open this report." },
        { status: 403 },
      );
    const sql = database();
    const {
      source,
      values,
      period,
      scope,
      columns: sourceColumns,
    } = buildReportSource(user, input);
    let columns = sourceColumns;
    const withBase = `WITH base AS (${source}), marked AS (SELECT *,${report === "inventory" ? "inventory_period" : "CASE WHEN date BETWEEN $1::date AND $2::date THEN 'current' WHEN date BETWEEN $3::date AND $4::date THEN 'previous' END"} period FROM base), selected AS (SELECT * FROM marked WHERE period IS NOT NULL)`;
    const donorSelect = `SELECT min(id) id,person_id,person,count(*)::int gift_count,sum(cash_in)::numeric cash_in,sum(in_kind)::numeric in_kind,min(date) first_date,max(date) last_date,0::numeric cash_out,0::numeric hours,0::int completed,NULL::text beneficiary_id,NULL::text service_id,period FROM selected GROUP BY period,person_id,person`;
    const rowSource =
      report === "donors" ? `(${donorSelect}) grouped` : "selected";
    if (report === "donors")
      columns = [
        column("person", "Donor"),
        column("gift_count", "Posted gifts in period", "number"),
        column("cash_in", "Cash donations (USD)", "money"),
        column("in_kind", "Estimated in-kind value (USD)", "money"),
        column("first_date", "First gift in period", "date"),
        column("last_date", "Last gift in period", "date"),
      ];
    const aggregate = `SELECT period,count(*)::int records,COALESCE(sum(cash_in),0)::text cash_in,COALESCE(sum(cash_out),0)::text cash_out,COALESCE(sum(in_kind),0)::text in_kind,
   count(DISTINCT person_id)::int people,count(DISTINCT beneficiary_id)::int beneficiaries,count(DISTINCT service_id)::int completed,
   COALESCE(sum(hours) FILTER(WHERE ${report === "hours" ? "status='Approved' AND kind='volunteer'" : "false"}),0)::text volunteer_hours,
   COALESCE(sum(hours) FILTER(WHERE ${report === "hours" ? "status='Approved' AND kind='employee'" : "false"}),0)::text employee_hours,
   ${report === "allocations" ? "COALESCE(sum(amount) FILTER(WHERE status='Posted'),0)" : "0"}::text transferred,
   ${report === "sales" ? "COALESCE(sum(quantity) FILTER(WHERE status='Posted'),0)" : report === "inventory" ? "COALESCE(sum(quantity),0)" : "0"}::text units,
   ${report === "inventory" ? "COALESCE(sum(distributed_units),0)" : "0"}::text distributed,
   ${report === "donors" ? "count(*) FILTER(WHERE gift_count>1)" : "0"}::int returning_donors,
   ${report === "transactions" || report === "expenses" || report === "allocations" || report === "sales" ? "count(*) FILTER(WHERE status='Submitted')" : "0"}::int pending
   FROM ${rowSource} GROUP BY period`;
    const countQuery = `${withBase} SELECT count(*)::int total FROM ${rowSource} WHERE period='current'`;
    const pageSize = 25,
      exportLimit = 20000;
    const rowQuery = `${withBase} SELECT * FROM ${rowSource} WHERE period='current' ORDER BY ${report === "donors" ? "cash_in DESC,person,id" : "date DESC,id"} LIMIT ${input.format === "csv" ? exportLimit + 1 : pageSize} OFFSET ${input.format === "csv" ? 0 : (input.page - 1) * pageSize}`;
    const [stats, rows, counts, months, breakdown] = await sql.transaction(
      [
        sql.query(`${withBase} ${aggregate}`, values),
        sql.query(rowQuery, values),
        sql.query(countQuery, values),
        sql.query(
          `${withBase} SELECT to_char(date,'YYYY-MM') AS month,count(*)::int records,sum(cash_in)::text cash_in,sum(cash_out)::text cash_out,sum(hours)::text hours,sum(completed)::int completed FROM selected WHERE period='current' GROUP BY to_char(date,'YYYY-MM') ORDER BY month`,
          values,
        ),
        sql.query(
          `${withBase} SELECT COALESCE(category,'Unassigned') label,count(*)::int records,sum(cash_in)::text cash_in,sum(cash_out)::text cash_out,sum(in_kind)::text in_kind FROM selected WHERE period='current' GROUP BY category ORDER BY sum(cash_out) DESC,count(*) DESC`,
          values,
        ),
      ],
      { isolationLevel: "RepeatableRead", readOnly: true },
    );
    const numericKeys = new Set([
      "amount",
      "quantity",
      "opening",
      "received_units",
      "distributed_units",
      "sold_units",
      "hours",
      "gift_count",
      "cash_in",
      "cash_out",
      "in_kind",
      "completed",
    ]);
    const visibleKeys = new Set([
      ...columns.map((c) => c.key),
      "id",
      "kind",
      ...(report === "donors" ? ["person_id"] : []),
      "source_id",
      "asset_id",
      "original_receipt",
      "description",
      "submitter",
      "reviewer",
      "reviewed_at",
      "review_note",
      "external_reference",
      "source",
      "settlement_confirmed",
      "service",
      "beneficiary",
      "outcome",
      "provider",
      "expense_category",
    ]);
    const visibleRows = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row)
          .filter(([k]) => visibleKeys.has(k))
          .map(([k, v]) => [
            k,
            numericKeys.has(k) && v !== null ? Number(v) : v,
          ]),
      ),
    );
    const labels = (value: unknown) =>
      financeLabels[value as keyof typeof financeLabels] ||
      expenseCategories[String(value)] ||
      value;
    if (input.format === "csv") {
      if (counts[0].total > exportLimit)
        return NextResponse.json(
          {
            error:
              "More than 20,000 records match. Narrow the dates or filters before exporting.",
          },
          { status: 422 },
        );
      const lines = [
        columns.map((c) => csvCell(c.label)).join(","),
        ...visibleRows.map((row) =>
          columns
            .map((c) =>
              csvCell(
                c.type === "money" && row[c.key] !== null
                  ? (Number(row[c.key]) / 100).toFixed(2)
                  : labels(row[c.key]),
              ),
            )
            .join(","),
        ),
      ];
      return new Response("\ufeff" + lines.join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ecf-${report}-${period.start}-to-${period.end}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const current = stats.find((s) => s.period === "current") || {},
      previous = stats.find((s) => s.period === "previous") || {};
    const definitions: [string, string, "money" | "number"][] =
      report === "sales"
        ? [
            ["records", "Sale records", "number"],
            ["cash_in", "Posted sale proceeds", "money"],
            ["units", "Posted units sold", "number"],
            ["pending", "Awaiting approval", "number"],
          ]
        : report === "expenses"
          ? [
              ["records", "Expense records", "number"],
              ["cash_out", "Posted expenses", "money"],
              ["pending", "Awaiting approval", "number"],
            ]
          : report === "allocations"
            ? [
                ["records", "Allocation records", "number"],
                ["transferred", "Posted transfers", "money"],
                ["pending", "Awaiting approval", "number"],
              ]
            : report === "source_impact"
              ? [
                  ["cash_out", "Source-funded expenses", "money"],
                  [
                    "beneficiaries",
                    "People linked to completed services",
                    "number",
                  ],
                  ["completed", "Completed services linked", "number"],
                ]
              : report === "services"
                ? [
                    ["records", "Service records", "number"],
                    ["completed", "Completed services", "number"],
                    ["beneficiaries", "Distinct people supported", "number"],
                  ]
                : report === "hours"
                  ? [
                      ["records", "Hour entries", "number"],
                      ["volunteer_hours", "Approved volunteer hours", "number"],
                      ["employee_hours", "Approved employee hours", "number"],
                    ]
                  : report === "donors"
                    ? [
                        ["records", "Distinct donors", "number"],
                        ["cash_in", "Cash donations", "money"],
                        ["in_kind", "Estimated in-kind value", "money"],
                        [
                          "returning_donors",
                          "Donors with multiple gifts in period",
                          "number",
                        ],
                      ]
                    : report === "inventory"
                      ? [
                          ["records", "Item receipt lots at closing", "number"],
                          ["units", "Closing units available", "number"],
                          [
                            "distributed",
                            "Units distributed in period",
                            "number",
                          ],
                        ]
                      : [
                          ["records", "Transaction records", "number"],
                          ["cash_in", "Posted cash receipts", "money"],
                          ["cash_out", "Posted expenses", "money"],
                          ["in_kind", "Estimated in-kind value", "money"],
                        ];
    const [funds, programs, people] = await Promise.all([
      sql.query("SELECT id,name FROM funds WHERE active=true ORDER BY name"),
      sql.query("SELECT id,name FROM programs ORDER BY name"),
      sql.query(
        `${withBase} SELECT DISTINCT person_id id,person name FROM selected WHERE person_id IS NOT NULL AND person IS NOT NULL ORDER BY person`,
        values,
      ),
    ]);
    // A person filter must not expose a beneficiary through finance/fundraising metadata.
    return NextResponse.json(
      {
        report,
        title: reportDefinitions[report].title,
        note: reportDefinitions[report].note,
        scope,
        period,
        columns,
        rows: visibleRows,
        metrics: definitions.map(([key, label, type]) => ({
          key,
          label,
          type,
          value: Number(current[key] || 0),
          previous: period.previous_start ? Number(previous[key] || 0) : null,
        })),
        total: counts[0].total,
        page: input.page,
        page_size: pageSize,
        months: months.map((m) =>
          Object.fromEntries(
            Object.entries(m).map(([k, v]) => [
              k,
              k === "month" ? v : Number(v),
            ]),
          ),
        ),
        breakdown: breakdown.map((m) =>
          Object.fromEntries(
            Object.entries(m).map(([k, v]) => [
              k,
              k === "label" ? labels(v) : Number(v),
            ]),
          ),
        ),
        options: { funds, programs, people },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const validation = error instanceof z.ZodError;
    const message =
      error instanceof ReportAccessError
        ? error.message
        : validation
          ? error.issues[0]?.message
          : error instanceof Error &&
              /^(Choose|Use|Invalid|This|Transaction|Expense|Contribution|Engagement)/.test(
                error.message,
              )
            ? error.message
            : "Unable to load this report. Please retry.";
    if (!validation)
      console.error(
        "Report query failed",
        (error as { code?: string }).code || "validation",
      );
    return NextResponse.json(
      { error: message },
      { status: error instanceof ReportAccessError ? 403 : 400 },
    );
  }
}
