// Localhost-only checks against Neon. Test-created report settings are removed in finally.
// Does not create donations, postings, people, services, or other business records.
import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  defaultDefinition,
  builderCatalog,
  builderTemplates,
} from "../lib/report-builder-model.mjs";
const origin = process.env.ECF_TEST_ORIGIN || "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Only localhost is permitted.");
const sql = neon(process.env.DATABASE_URL),
  accounts = JSON.parse(
    fs.readFileSync(
      new URL("../.local/virtual-account-seed.json", import.meta.url),
      "utf8",
    ),
  );
const cookies = {},
  ids = [],
  tag = "builder-test-" + Date.now();
let checks = 0;
function check(name, ok) {
  assert.ok(ok, name);
  console.log("PASS " + name);
  checks++;
}
async function request(path, role = "admin", body, extra = {}) {
  const r = await fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(cookies[role] ? { Cookie: cookies[role] } : {}),
      ...(body ? { "Content-Type": "application/json", Origin: origin } : {}),
      "X-Forwarded-For": tag,
      ...extra,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  return {
    status: r.status,
    headers: r.headers,
    body: r.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : text,
  };
}
const config = (dataset, role = "admin") => ({
  ...defaultDefinition(dataset, role),
  period: "all_time",
});
const preview = (definition, role = "admin", extra = {}) =>
  request("/api/report-builder", role, { definition, ...extra });
const metric = (r, key) => r.body.totals.find((m) => m.key === key)?.value;
function csvRows(value) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"') {
      if (quoted && value[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.replace(/\r$/, ""));
  rows.push(row);
  return rows;
}
try {
  check(
    "builder requires sign-in",
    (await request("/api/report-builder", "none")).status === 401,
  );
  check(
    "saved settings require sign-in",
    (await request("/api/saved-reports", "none")).status === 401,
  );
  for (const role of [
    "admin",
    "finance",
    "coordinator",
    "fundraising",
    "volunteer",
  ]) {
    const a = accounts.find((a) => a.username === role),
      r = await request("/api/auth", role, {
        action: "login",
        username: a.username,
        password: a.password,
      });
    check(role + " sign-in", r.status === 200);
    cookies[role] = r.headers.get("set-cookie")?.split(";")[0];
  }
  check(
    "volunteer cannot open builder",
    (await request("/api/report-builder", "volunteer")).status === 403,
  );
  check(
    "volunteer cannot list settings",
    (await request("/api/saved-reports", "volunteer")).status === 403,
  );
  check(
    "volunteer cannot execute reports",
    (await preview(config("sales"), "volunteer")).status === 403,
  );
  const all = {};
  for (const ds of builderCatalog("admin")) {
    const c = config(ds.key),
      r = await preview(c);
    check(ds.key + " detailed preview", r.status === 200);
    all[ds.key] = r;
    check(
      ds.key + " configured column order",
      r.body.columns.map((c) => c.key).join("|") === c.columns.join("|"),
    );
    const summary = {
        ...builderTemplates("admin").find(
          (t) => t.definition.dataset === ds.key,
        ).definition,
        period: "all_time",
      },
      s = await preview(summary);
    check(
      ds.key + " grouped preview",
      s.status === 200 && s.body.rows.every((r) => Array.isArray(r.__drill)),
    );
    check(
      ds.key + " detail and summary totals agree",
      JSON.stringify(r.body.totals.map((m) => [m.key, m.value])) ===
        JSON.stringify(s.body.totals.map((m) => [m.key, m.value])),
    );
  }
  const financial = await sql.query(
    `SELECT COALESCE(sum(amount_cents) FILTER(WHERE status='Posted' AND kind IN ('cash_donation','asset_sale')),0)::text cash,COALESCE(sum(amount_cents) FILTER(WHERE status='Posted' AND kind='expense'),0)::text spent,COALESCE(sum(amount_cents) FILTER(WHERE status='Posted' AND kind='in_kind'),0)::text goods FROM finance_requests WHERE event_date<=CURRENT_DATE`,
  );
  check(
    "cash totals reconcile to Neon",
    metric(all.transactions, "cash_in") === Number(financial[0].cash),
  );
  check(
    "expense totals reconcile to Neon",
    metric(all.expenses, "cash_out") === Number(financial[0].spent),
  );
  check(
    "donor-funded shares reconcile to posted expenses",
    metric(all.source_impact, "cash_out") === Number(financial[0].spent),
  );
  check(
    "in-kind is separate from cash",
    metric(all.donors, "in_kind") === Number(financial[0].goods),
  );
  check(
    "asset sales are excluded from fresh donations",
    metric(all.donors, "cash_in") ===
      metric(all.transactions, "cash_in") - metric(all.sales, "cash_in"),
  );
  const reordered = {
    ...config("transactions"),
    columns: ["amount", "reference", "status"],
    sort: { key: "amount", direction: "desc" },
  };
  const first = await preview(reordered),
    second = await preview(reordered, "admin", { page: 2 }),
    csv = await preview(reordered, "admin", { format: "csv" }),
    parsed = csvRows(csv.body.replace(/^\ufeff/, ""));
  check(
    "pagination spans all financial requests",
    first.body.rows.length === 25 &&
      second.body.rows.length === first.body.total - 25,
  );
  check(
    "pages have no repeated identities",
    new Set([...first.body.rows, ...second.body.rows].map((r) => r.__id))
      .size === first.body.total,
  );
  check(
    "export includes all matches and only selected fields",
    csv.status === 200 &&
      parsed.length === first.body.total + 1 &&
      parsed.every((r) => r.length === 3),
  );
  check(
    "export follows chosen column order",
    parsed[0][0] === "Recorded amount / estimated value (USD)" &&
      parsed[0][1] === "Transaction reference",
  );
  check(
    "money exports USD rather than cents",
    parsed[1][0] === (first.body.rows[0].amount / 100).toFixed(2),
  );
  check(
    "unselected donor fields never appear in rows",
    first.body.rows.every(
      (r) => !Object.hasOwn(r, "person") && !Object.hasOwn(r, "beneficiary"),
    ),
  );
  const exact = await preview({
    ...reordered,
    filters: [
      { field: "amount", op: "between", value: "120.00", to: "120.00" },
    ],
  });
  check(
    "decimal currency bounds convert exactly to cents",
    exact.status === 200 &&
      exact.body.rows.length > 0 &&
      exact.body.rows.every((r) => r.amount === 12000),
  );
  const none = await preview({
    ...config("donors"),
    filters: [{ field: "person", op: "contains", value: "' OR 1=1; --" }],
  });
  check(
    "text values are parameterized",
    none.status === 200 && none.body.total === 0,
  );
  const protectedConfig = {
    ...config("source_impact", "fundraising"),
    columns: ["beneficiary"],
  };
  check(
    "forbidden selected columns denied",
    (await preview(protectedConfig, "fundraising")).status === 403,
  );
  check(
    "forbidden filter fields denied",
    (
      await preview(
        {
          ...config("source_impact", "fundraising"),
          filters: [{ field: "beneficiary", op: "not_empty", value: "" }],
        },
        "fundraising",
      )
    ).status === 403,
  );
  check(
    "forbidden datasets denied",
    (await preview(config("services"), "finance")).status === 403,
  );
  check(
    "arbitrary definition keys rejected",
    (await preview({ ...config("sales"), sql: "SELECT * FROM users" }))
      .status === 400,
  );
  check(
    "invalid calendar date rejected",
    (
      await preview({
        ...config("sales"),
        period: "custom",
        start: "2026-02-30",
        end: "2026-03-02",
      })
    ).status === 400,
  );
  check(
    "invalid metric rejected",
    (await preview({ ...config("sales"), metrics: ["password_hash"] }))
      .status === 400,
  );
  check(
    "cross-origin preview denied",
    (
      await request(
        "/api/report-builder",
        "admin",
        { definition: config("sales") },
        { Origin: "https://outside.invalid" },
      )
    ).status === 403,
  );
  const donorSummary = {
    ...config("donors"),
    metrics: ["cash_in", "in_kind", "people", "records"],
    mode: "summary",
    groupBy: ["person"],
    sort: { key: "cash_in", direction: "desc" },
  };
  const donorGroups = await preview(donorSummary),
    values = donorGroups.body.rows.map((r) => r.m_cash_in);
  check(
    "group measures sort numerically",
    donorGroups.status === 200 &&
      values.every((n, i) => i === 0 || values[i - 1] >= n),
  );
  const group = donorGroups.body.rows.find((r) => r.m_cash_in > 0),
    drilled = await preview({ ...config("donors"), drill: group.__drill });
  check(
    "drill-down uses stable person identity",
    drilled.status === 200 &&
      metric(drilled, "cash_in") === group.m_cash_in &&
      drilled.body.total === group.m_records,
  );
  check(
    "identity-based drill rejects missing identity",
    (
      await preview({
        ...config("donors"),
        drill: [{ field: "person", value: group.g_person }],
      })
    ).status === 400,
  );
  const svc = {
      ...config("services"),
      mode: "summary",
      groupBy: ["programme"],
      sort: { key: "programme", direction: "asc" },
    },
    services = await preview(svc);
  const direct = await sql.query(
    `SELECT count(DISTINCT beneficiary_id) FILTER(WHERE status='Completed')::int people,count(*) FILTER(WHERE status='Completed')::int completed FROM service_records WHERE service_date<=CURRENT_DATE`,
  );
  check(
    "overall beneficiary counts are distinct across programmes",
    services.status === 200 &&
      metric(services, "beneficiaries") === direct[0].people &&
      metric(services, "completed") === direct[0].completed,
  );
  const line = await preview({
    ...config("sales"),
    period: "previous_2_months",
    mode: "summary",
    groupBy: ["month"],
    display: "line",
    sort: { key: "month", direction: "asc" },
  });
  check(
    "trend includes an empty month as zero",
    line.status === 200 &&
      line.body.chart.rows.length === 2 &&
      line.body.chart.rows[0].m_cash_in === 0 &&
      line.body.chart.rows[1].m_cash_in === 550000,
  );
  const history = await preview({
    ...config("sales"),
    mode: "summary",
    groupBy: ["month"],
    display: "line",
    sort: { key: "month", direction: "asc" },
  });
  check(
    "all-history trend starts at actual activity",
    history.status === 200 &&
      history.body.chart.rows[0].g_month === "2026-10" &&
      history.body.chart.rows.length < 50,
  );
  const two = await preview({
    ...config("source_impact"),
    mode: "summary",
    groupBy: ["person", "programme"],
    sort: { key: "cash_out", direction: "desc" },
  });
  check(
    "two-dimensional source use groups preserve expense amount",
    two.status === 200 &&
      two.body.rows.reduce((n, r) => n + r.m_cash_out, 0) ===
        metric(two, "cash_out"),
  );
  for (const role of ["finance", "coordinator", "fundraising"]) {
    const cat = await request("/api/report-builder", role);
    check(
      role + " catalogue respects role",
      cat.status === 200 &&
        cat.body.datasets.every((d) =>
          builderCatalog(role).some((c) => c.key === d.key),
        ),
    );
    for (const ds of cat.body.datasets) {
      const r = await preview(config(ds.key, role), role);
      check(role + " can execute permitted " + ds.key, r.status === 200);
      if (role === "coordinator")
        check(
          "coordinator " + ds.key + " hides donor provenance",
          r.body.rows.every(
            (r) =>
              (!r.__trace_source && !Object.hasOwn(r, "person")) ||
              ds.key === "services" ||
              ds.key === "hours",
          ),
        );
    }
  }
  const coordinator = await preview(
    {
      ...config("transactions", "coordinator"),
      columns: ["reference", "kind"],
      sort: { key: "reference", direction: "asc" },
      match: "any",
      filters: [
        { field: "reference", op: "not_empty", value: "" },
        { field: "kind", op: "contains", value: "" },
      ],
    },
    "coordinator",
  );
  check("empty text filter rejected before query", coordinator.status === 400);
  const or = await preview(
    {
      ...config("transactions", "coordinator"),
      columns: ["reference", "kind"],
      sort: { key: "reference", direction: "asc" },
      match: "any",
      filters: [
        { field: "reference", op: "not_empty", value: "" },
        { field: "kind", op: "contains", value: "cash" },
      ],
    },
    "coordinator",
  );
  check(
    "OR conditions cannot bypass row restrictions",
    or.status === 200 &&
      or.body.rows.every((r) => ["expense", "distribution"].includes(r.kind)),
  );
  const reviewed = await preview({
    ...reordered,
    filters: [
      {
        field: "reviewed_at",
        op: "between",
        value: "2026-01-01",
        to: "2026-12-31",
      },
    ],
  });
  check(
    "review timestamp accepts business-date bounds",
    reviewed.status === 200 && reviewed.body.total > 0,
  );
  const id = randomUUID();
  ids.push(id);
  const save = {
    action: "save",
    id,
    expected_version: 0,
    name: tag,
    description: "Integration-test configuration only",
    definition: donorSummary,
  };
  const saved = await request("/api/saved-reports", "admin", save);
  check(
    "save report in Neon",
    saved.status === 200 && saved.body.report.version === 1,
  );
  const again = await request("/api/saved-reports", "admin", save);
  check(
    "identical save retry does not duplicate",
    again.status === 200 && again.body.already_saved,
  );
  const persisted = await sql.query(
    "SELECT definition,owner_id,version FROM saved_reports WHERE id=$1",
    [id],
  );
  check(
    "saved data contains rules, not query results",
    persisted[0].definition.dataset === "donors" &&
      !Object.hasOwn(persisted[0].definition, "rows"),
  );
  check(
    "other owner cannot list report",
    !(await request("/api/saved-reports", "finance")).body.reports.some(
      (r) => r.id === id,
    ),
  );
  check(
    "other owner cannot overwrite report",
    (
      await request("/api/saved-reports", "finance", {
        ...save,
        expected_version: 1,
      })
    ).status === 404,
  );
  const updated = await request("/api/saved-reports", "admin", {
    ...save,
    expected_version: 1,
    name: tag + " renamed",
  });
  check(
    "rename and update increments version",
    updated.status === 200 && updated.body.report.version === 2,
  );
  check(
    "stale concurrent edit is rejected",
    (
      await request("/api/saved-reports", "admin", {
        ...save,
        expected_version: 1,
        name: "Conflicting title",
      })
    ).status === 409,
  );
  const live = await preview(updated.body.report.definition);
  check(
    "reopened rules query live records",
    live.status === 200 &&
      metric(live, "cash_in") === metric(all.donors, "cash_in"),
  );
  const copyId = randomUUID();
  ids.push(copyId);
  check(
    "save a separate copy",
    (
      await request("/api/saved-reports", "admin", {
        ...save,
        id: copyId,
        name: tag + " copy",
      })
    ).status === 200,
  );
  const archived = await request("/api/saved-reports", "admin", {
    action: "archive",
    id,
    expected_version: 2,
  });
  check(
    "archive is reversible and minimizes returned fields",
    archived.status === 200 &&
      archived.body.report.archived_at &&
      !archived.body.report.definition,
  );
  check(
    "archived report hidden from default library",
    !(await request("/api/saved-reports")).body.reports.some(
      (r) => r.id === id,
    ),
  );
  check(
    "archived report visible when requested",
    (await request("/api/saved-reports?archived=1")).body.reports.some(
      (r) => r.id === id && r.archived_at,
    ),
  );
  check(
    "archived report cannot be overwritten",
    (
      await request("/api/saved-reports", "admin", {
        ...save,
        expected_version: 3,
      })
    ).status === 409,
  );
  check(
    "restore archived report",
    (
      await request("/api/saved-reports", "admin", {
        action: "restore",
        id,
        expected_version: 3,
      })
    ).status === 200,
  );
  check(
    "restored report returns to active library",
    (await request("/api/saved-reports")).body.reports.some(
      (r) => r.id === id && !r.archived_at && r.version === 4,
    ),
  );
  check(
    "other owner cannot archive report",
    (
      await request("/api/saved-reports", "finance", {
        action: "archive",
        id,
        expected_version: 4,
      })
    ).status === 404,
  );
  check(
    "invalid protected definition cannot be saved",
    (
      await request("/api/saved-reports", "fundraising", {
        ...save,
        id: randomUUID(),
        definition: protectedConfig,
      })
    ).status === 403,
  );
  const audits = await sql.query(
    "SELECT count(*)::int n FROM audit_log WHERE record_id=$1",
    [id],
  );
  check(
    "one attributable audit event per real setting change",
    audits[0].n === 4,
  );
  console.log(
    "Custom report integration checks passed: " +
      checks +
      "; no business records created.",
  );
} finally {
  if (ids.length)
    await sql.transaction([
      sql.query("DELETE FROM audit_log WHERE record_id=ANY($1::uuid[])", [ids]),
      sql.query("DELETE FROM saved_reports WHERE id=ANY($1::uuid[])", [ids]),
    ]);
  for (const role of Object.keys(cookies))
    await request("/api/auth", role, { action: "logout" });
  console.log("Test-created report settings and sign-in sessions cleared.");
}
