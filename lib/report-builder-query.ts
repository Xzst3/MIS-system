import "server-only";
import { database } from "./db";
import { buildReportSource, paramsSchema } from "./report-source";
import {
  validateDefinition,
  numericFilterValue,
} from "./report-builder-model.mjs";
import { csvCell } from "./report-periods.mjs";
import { expenseCategories, type ReportColumn } from "./report-config";
import { financeLabels } from "./finance-types";
import type { User } from "./types";
import type {
  BuilderDefinition,
  BuilderDataset,
  BuilderRow,
} from "./report-builder-types";
const identities: Record<string, string> = {
  person: "person_id",
  fund: "fund_id",
  destination: "destination_id",
  programme: "program_id",
  beneficiary: "beneficiary_identity",
  service: "linked_service_id",
};
const numericTypes = new Set(["money", "number"]);
const metricSQL: Record<string, string> = {
  records: "count(*)::text",
  cash_in: "COALESCE(sum(b.cash_in),0)::text",
  cash_out: "COALESCE(sum(b.cash_out),0)::text",
  in_kind: "COALESCE(sum(b.in_kind),0)::text",
  people: "count(DISTINCT b.person_id)::text",
  beneficiaries: "count(DISTINCT b.beneficiary_id)::text",
  completed: "count(DISTINCT b.service_id)::text",
  pending: "count(*) FILTER(WHERE b.status='Submitted')::text",
  transferred:
    "COALESCE(sum(b.amount) FILTER(WHERE b.status='Posted' AND b.kind='allocation'),0)::text",
  funded_expenses: "count(DISTINCT b.reference)::text",
  volunteer_hours:
    "COALESCE(sum(b.hours) FILTER(WHERE b.status='Approved' AND b.kind='volunteer'),0)::text",
  employee_hours:
    "COALESCE(sum(b.hours) FILTER(WHERE b.status='Approved' AND b.kind='employee'),0)::text",
  approved_people:
    "count(DISTINCT b.person_id) FILTER(WHERE b.status='Approved')::text",
  closing_units: "COALESCE(sum(b.quantity),0)::text",
  received_units: "COALESCE(sum(b.received_units),0)::text",
  distributed_units: "COALESCE(sum(b.distributed_units),0)::text",
};
export function builderValue(value: unknown, key: string, ds: BuilderDataset) {
  const field = ds.fields.find((f) => f.key === key);
  if (value === null || value === undefined) return null;
  if (field?.values) return field.values[String(value)] || String(value);
  return (
    financeLabels[value as keyof typeof financeLabels] ||
    expenseCategories[String(value)] ||
    value
  );
}
export async function runBuilder(
  user: User,
  raw: unknown,
  page = 1,
  format = "json",
) {
  const validated = validateDefinition(raw, user.role),
    c = validated.definition as BuilderDefinition,
    ds = validated.dataset as BuilderDataset;
  const source = buildReportSource(
    user,
    paramsSchema.parse({
      report: c.dataset,
      period: c.period,
      start: c.start,
      end: c.end,
    }),
  );
  const values = [...source.values],
    bind = (v: string | number | null) => {
      values.push(v);
      return "$" + values.length;
    };
  const field = (key: string) => `b."${key}"`;
  const dimension = (key: string) =>
    key === "month"
      ? `to_char(b."date",'YYYY-MM')`
      : key === "year"
        ? `to_char(b."date",'YYYY')`
        : key === "week"
          ? `to_char(date_trunc('week',b."date"),'YYYY-MM-DD')`
          : key === "date"
            ? `to_char(b."date",'YYYY-MM-DD')`
            : field(key);
  const conditions = c.filters.map((filter) => {
    const f = ds.fields.find((f) => f.key === filter.field)!,
      expr =
        f.type === "timestamp"
          ? `(${field(f.key)} AT TIME ZONE 'Asia/Shanghai')::date`
          : field(f.key);
    if (filter.op === "empty") return `(${expr} IS NULL OR ${expr}::text='')`;
    if (filter.op === "not_empty")
      return `(${expr} IS NOT NULL AND ${expr}::text<>'')`;
    if (filter.op === "contains")
      return `strpos(lower(COALESCE(${expr}::text,'')),lower(${bind(filter.value)}))>0`;
    const val = numericTypes.has(f.type)
      ? numericFilterValue(filter.value, f.type)
      : filter.value;
    const lower = bind(val),
      left = f.type === "text" ? `lower(${expr}::text)` : expr,
      right = f.type === "text" ? `lower(${lower})` : lower;
    if (filter.op === "between")
      return `${expr} BETWEEN ${lower} AND ${bind(numericTypes.has(f.type) ? numericFilterValue(filter.to || "", f.type) : filter.to || "")}`;
    const ops: Record<string, string> = {
      is: "=",
      is_not: "<>",
      gt: ">",
      gte: ">=",
      lt: "<",
      lte: "<=",
    };
    return `${left} ${ops[filter.op]} ${right}`;
  });
  const drill = c.drill.map((d) => {
    const identity = identities[d.field];
    const expr = identity ? field(identity) : dimension(d.field);
    if (identity && d.identity === undefined)
      throw new Error(
        "A stable grouping identity is required for this drill-down.",
      );
    const value = identity ? d.identity : d.value;
    return value === null ? `${expr} IS NULL` : `${expr}=${bind(value || "")}`;
  });
  const filters = [
    ...(conditions.length
      ? ["(" + conditions.join(c.match === "any" ? " OR " : " AND ") + ")"]
      : []),
    ...drill,
  ];
  const periodExpr =
    c.dataset === "inventory"
      ? "b.inventory_period"
      : `CASE WHEN b."date" BETWEEN $1::date AND $2::date THEN 'current' WHEN b."date" BETWEEN $3::date AND $4::date THEN 'previous' END`;
  const temporal =
    c.dataset === "inventory"
      ? "true"
      : `(b."date" BETWEEN $1::date AND $2::date OR b."date" BETWEEN $3::date AND $4::date)`;
  const withBase = `WITH base AS (${source.source}), selected AS (SELECT b.*,${periodExpr} AS period FROM base b WHERE ${[temporal, ...filters].join(" AND ")})`;
  const measure = (key: string) =>
    (key === "sold_units"
      ? c.dataset === "inventory"
        ? "COALESCE(sum(b.sold_units),0)::text"
        : "COALESCE(sum(b.quantity) FILTER(WHERE b.status='Posted'),0)::text"
      : metricSQL[key]
    ).replace(/::text$/, "");
  const metricSelect = c.metrics
    .map((key) => `${measure(key)} AS "m_${key}"`)
    .join(",");
  const selectedColumns = c.columns.map((k) =>
    ds.fields.find((f) => f.key === k)!,
  );
  const groupSelect = c.groupBy
    .map(
      (key) =>
        `${dimension(key)} AS "g_${key}"${identities[key] ? `,${field(identities[key])} AS "__identity_${key}"` : ""}`,
    )
    .join(",");
  const groupExpressions = c.groupBy.flatMap((key) => [
    dimension(key),
    ...(identities[key] ? [field(identities[key])] : []),
  ]);
  const traceAllowed = ["admin", "finance", "fundraising"].includes(user.role);
  const traceExpr = !traceAllowed
    ? "NULL::text"
    : c.dataset === "inventory"
      ? "b.id::text"
      : c.dataset === "source_impact"
        ? "b.source_id::text"
        : "CASE WHEN b.kind IN ('cash_donation','asset_sale','in_kind') THEN b.id::text ELSE NULL::text END";
  const rowDefinition =
    c.mode === "summary"
      ? `SELECT ${groupSelect},${metricSelect} FROM selected b WHERE period='current' GROUP BY ${groupExpressions.join(",")}`
      : `SELECT b.id AS __id,${traceExpr} AS __trace_source,${selectedColumns.map((f) => `${field(f.key)} AS "${f.key}"`).join(",")} FROM selected b WHERE period='current'`;
  const columnKeys =
    c.mode === "summary"
      ? [...c.groupBy.map((k) => "g_" + k), ...c.metrics.map((k) => "m_" + k)]
      : c.columns;
  const sortColumn =
    c.mode === "summary"
      ? (c.groupBy.includes(c.sort.key) ? "g_" : "m_") + c.sort.key
      : c.sort.key;
  const order = `"${sortColumn}" ${c.sort.direction.toUpperCase()} NULLS LAST${
    c.mode === "details"
      ? ",__id"
      : c.groupBy
          .filter((k) => "g_" + k !== sortColumn)
          .map((k) => `,"g_${k}"`)
          .join("")
  }${
    c.mode === "summary"
      ? c.groupBy
          .filter((k) => identities[k])
          .map((k) => `,"__identity_${k}"`)
          .join("")
      : ""
  }`;
  const sql = database(),
    rowCount =
      withBase +
      ` SELECT count(*)::int total FROM (${rowDefinition}) rows_to_count`;
  const rowsQuery =
    withBase +
    ` SELECT * FROM (${rowDefinition}) report_rows ORDER BY ${order} LIMIT ${format === "csv" ? 20001 : 25} OFFSET ${format === "csv" ? 0 : (page - 1) * 25}`;
  let chartSQL =
    c.mode === "summary"
      ? withBase +
        ` SELECT * FROM (${rowDefinition}) chart_rows ORDER BY ${order} LIMIT 50`
      : withBase + " SELECT 1 WHERE false";
  if (c.display === "line") {
    const key = c.groupBy[0],
      unit = { date: "day", week: "week", month: "month", year: "year" }[
        key as "date" | "week" | "month" | "year"
      ];
    const fmt =
      key === "month" ? "YYYY-MM" : key === "year" ? "YYYY" : "YYYY-MM-DD";
    chartSQL =
      withBase +
      `, grouped_chart AS (${rowDefinition}), intervals AS (
   SELECT generate_series(date_trunc('${unit}',${c.period === "all_time" ? "COALESCE((SELECT min(b.date)::date FROM selected b WHERE period='current'),$2::date)" : "$1::date"}),date_trunc('${unit}',$2::date),interval '1 ${unit}') AS bucket
   ) SELECT to_char(i.bucket,'${fmt}') AS "g_${key}",${c.metrics.map((m) => `COALESCE(g."m_${m}",0)::numeric AS "m_${m}"`).join(",")},count(*) OVER()::int AS __chart_total
   FROM intervals i LEFT JOIN grouped_chart g ON g."g_${key}"=to_char(i.bucket,'${fmt}') ORDER BY i.bucket LIMIT 50`;
  }
  const queries = [
    sql.query(
      withBase +
        ` SELECT b.period,count(*)::int matching_records,${metricSelect} FROM selected b WHERE b.period IS NOT NULL GROUP BY b.period`,
      values,
    ),
    sql.query(rowCount, values),
    sql.query(rowsQuery, values),
    sql.query(chartSQL, values),
  ];
  const [totals, counts, rows, chart] = await sql.transaction(queries, {
    isolationLevel: "RepeatableRead",
    readOnly: true,
  });
  const columns: ReportColumn[] =
    c.mode === "summary"
      ? [
          ...c.groupBy.map((key) => {
            const d = ds.dimensions.find((d) => d.key === key)!;
            return {
              key: "g_" + key,
              label: d.label,
              type: d.type === "date" ? ("date" as const) : undefined,
            };
          }),
          ...c.metrics.map((key) => {
            const m = ds.metrics.find((m) => m.key === key)!;
            return {
              key: "m_" + key,
              label: m.label,
              type:
                m.type === "money" ? ("money" as const) : ("number" as const),
            };
          }),
        ]
      : selectedColumns.map((f) => ({
          key: f.key,
          label: f.label,
          type:
            f.type === "money"
              ? "money"
              : f.type === "number"
                ? "number"
                : f.type === "date"
                  ? "date"
                  : undefined,
        }));
  const numeric = new Set(
    columns
      .filter((c) => ["money", "number"].includes(c.type || ""))
      .map((c) => c.key),
  );
  const clean = (row: Record<string, unknown>): BuilderRow => {
    const out = Object.fromEntries(
      columnKeys.map((key) => [
        key,
        row[key] === null
          ? null
          : numeric.has(key)
            ? Number(row[key])
            : row[key],
      ]),
    ) as BuilderRow;
    if (c.mode === "summary")
      out.__drill = c.groupBy.map((key) => ({
        field: key,
        value: row["g_" + key] === null ? null : String(row["g_" + key]),
        ...(identities[key]
          ? {
              identity:
                row["__identity_" + key] === null
                  ? null
                  : String(row["__identity_" + key]),
            }
          : {}),
      }));
    else {
      out.__id = String(row.__id);
      if (row.__trace_source) out.__trace_source = String(row.__trace_source);
    }
    return out;
  };
  const visibleRows = rows.map(clean);
  if (format === "csv") {
    if (Number(counts[0].total) > 20000) return { tooLarge: true as const };
    const label = (value: unknown, key: string) =>
      key.startsWith("g_")
        ? builderValue(value, key.slice(2), ds)
        : builderValue(value, key, ds);
    const csv =
      "\ufeff" +
      [
        columns.map((c) => csvCell(c.label)).join(","),
        ...visibleRows.map((row) =>
          columns
            .map((col) =>
              csvCell(
                col.type === "money" && row[col.key] !== null
                  ? (Number(row[col.key]) / 100).toFixed(2)
                  : label(row[col.key], col.key),
              ),
            )
            .join(","),
        ),
      ].join("\r\n");
    return {
      csv,
      filename: `ecf-custom-${c.dataset}-${source.period.start}-to-${source.period.end}.csv`,
    };
  }
  const current = totals.find((t) => t.period === "current"),
    previous = totals.find((t) => t.period === "previous");
  return {
    definition: c,
    period: source.period,
    scope: source.scope,
    grain: ds.grain,
    columns,
    rows: visibleRows,
    total: Number(counts[0].total),
    page,
    page_size: 25,
    matching_records: Number(current?.matching_records || 0),
    totals: c.metrics.map((key) => {
      const m = ds.metrics.find((m) => m.key === key)!;
      return {
        key,
        label: m.label,
        type: m.type,
        value: Number(current?.["m_" + key] || 0),
        previous:
          source.period.previous_start && !c.drill.length
            ? Number(previous?.["m_" + key] || 0)
            : null,
      };
    }),
    chart: {
      rows: chart.map(clean),
      limit: 50,
      total: Number(chart[0]?.__chart_total || counts[0].total),
    },
    computed_at: new Date().toISOString(),
  };
}
