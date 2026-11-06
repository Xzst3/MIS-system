// Read-only business checks against a localhost app and its configured Neon database.
// Reuses explicitly authorized virtual users; logs out every test-created session.
import fs from "node:fs";
import assert from "node:assert/strict";
import { neon, types } from "@neondatabase/serverless";
import { reportPeriod, reportToday } from "../lib/report-periods.mjs";
const origin = process.env.ECF_TEST_ORIGIN || "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Reports integration tests only target localhost.");
types.setTypeParser(1082, (v) => v);
const sql = neon(process.env.DATABASE_URL),
  accounts = JSON.parse(
    fs.readFileSync(
      new URL("../.local/virtual-account-seed.json", import.meta.url),
      "utf8",
    ),
  );
const cookies = {},
  tag = "report-test-" + Date.now();
let checks = 0;
function check(name, condition) {
  assert.ok(condition, name);
  checks++;
  console.log("PASS " + name);
}
async function request(path, role = "admin", body) {
  const r = await fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(cookies[role] ? { Cookie: cookies[role] } : {}),
      ...(body ? { "Content-Type": "application/json", Origin: origin } : {}),
      "X-Forwarded-For": tag,
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
const report = (id, query = "", role = "admin") =>
  request("/api/reports?report=" + id + "&" + query, role);
const metric = (r, key) => r.body.metrics.find((m) => m.key === key)?.value;
const countRows = (csv) => {
  let inQuote = false,
    rows = 0;
  for (let i = 0; i < csv.length; i++) {
    if (csv[i] === '"') {
      if (inQuote && csv[i + 1] === '"') i++;
      else inQuote = !inQuote;
    } else if (csv[i] === "\n" && !inQuote) rows++;
  }
  return rows;
};
try {
  check(
    "unauthenticated reports denied",
    (await request("/api/reports", "none")).status === 401,
  );
  check(
    "unauthenticated funding trace denied",
    (await request("/api/funding-trace", "none")).status === 401,
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
  const period = reportPeriod(),
    results = {};
  for (const id of [
    "transactions",
    "sales",
    "expenses",
    "allocations",
    "source_impact",
    "donors",
    "services",
    "hours",
    "inventory",
  ]) {
    const r = await report(id);
    check("load " + id, r.status === 200);
    check(
      id + " complete calendar bounds",
      r.body.period.start === period.start &&
        r.body.period.end === period.end &&
        r.body.period.previous_start === period.previous_start,
    );
    results[id] = r;
  }
  const expected = await sql.query(
    `SELECT COALESCE(sum(amount_cents) FILTER(WHERE kind IN ('cash_donation','asset_sale') AND status='Posted'),0)::text received,COALESCE(sum(amount_cents) FILTER(WHERE kind='expense' AND status='Posted'),0)::text spent,COALESCE(sum(amount_cents) FILTER(WHERE kind='in_kind' AND status='Posted'),0)::text in_kind FROM finance_requests WHERE event_date BETWEEN $1 AND $2`,
    [period.start, period.end],
  );
  check(
    "cash summary reconciles to all matching Neon records",
    metric(results.transactions, "cash_in") === Number(expected[0].received),
  );
  check(
    "expense summary reconciles to posted expenses",
    metric(results.expenses, "cash_out") === Number(expected[0].spent),
  );
  check(
    "in-kind is reported separately",
    metric(results.transactions, "in_kind") === Number(expected[0].in_kind),
  );
  check(
    "source-lot expenditure reconciles to expenses",
    metric(results.source_impact, "cash_out") === Number(expected[0].spent),
  );
  const sale = results.sales.body.rows.find(
    (r) => r.reference === "ECF-2026-SALE-VEHICLE",
  );
  check(
    "vehicle sale links original gift and asset",
    sale?.original_receipt === "ECF-2026-ASSET-VEHICLE" &&
      !!sale.asset_id &&
      sale.amount === 550000,
  );
  const asset = await request("/api/funding-trace?source=" + sale.asset_id);
  check(
    "physical gift retains separate valuation and sale cash",
    asset.status === 200 &&
      asset.body.origin.amount_cents === 800000 &&
      asset.body.summary.received === 550000,
  );
  check(
    "physical gift has receipt and sale movements",
    asset.body.inventory.some((m) => m.kind === "in_kind") &&
      asset.body.inventory.some((m) => m.kind === "asset_sale"),
  );
  check(
    "asset source reconciles",
    asset.body.summary.reconciled &&
      asset.body.summary.received - asset.body.summary.spent ===
        asset.body.summary.remaining,
  );
  const cash = await report(
    "transactions",
    "period=all_time&kind=cash_donation",
  );
  for (const gift of cash.body.rows) {
    const t = await request("/api/funding-trace?source=" + gift.id);
    check(
      "source reference " + gift.reference + " reconciles",
      t.status === 200 &&
        t.body.summary.reconciled &&
        t.body.summary.received === gift.amount,
    );
    check(
      "every movement retains independent approval and source IDs " +
        gift.reference,
      t.body.movements.every(
        (m) =>
          m.original_donation_reference &&
          m.cash_source_reference &&
          m.reviewer_name &&
          m.reviewed_at,
      ),
    );
  }
  const aided = results.inventory.body.rows.find(
    (r) => r.reference === "ECF-2026-ITEMS-MOBILITY",
  );
  check(
    "stock roll-forward reconciles",
    aided.opening +
      aided.received_units -
      aided.distributed_units -
      aided.sold_units ===
      aided.quantity,
  );
  const aidTrace = await request("/api/funding-trace?source=" + aided.id);
  check(
    "physical distribution contributes a completed-service link",
    aidTrace.body.summary.people === 1 && aidTrace.body.summary.services === 1,
  );
  const year = await report("transactions", "period=all_time"),
    page2 = await report("transactions", "period=all_time&page=2");
  check(
    "report pagination preserves full total and has no duplicate rows",
    year.status === 200 &&
      page2.status === 200 &&
      year.body.total === page2.body.total &&
      !page2.body.rows.some((r) => year.body.rows.some((a) => a.id === r.id)),
  );
  const csv = await report("transactions", "period=all_time&format=csv");
  check(
    "export returns downloadable CSV",
    csv.status === 200 &&
      csv.headers.get("content-type").includes("text/csv") &&
      csv.headers.get("content-disposition").includes("all_time") === false,
  );
  check(
    "CSV includes all matches beyond first page",
    countRows(csv.body) === year.body.total,
  );
  const donors = await report("donors", "period=all_time");
  const donations = await sql.query(
    "SELECT COALESCE(sum(amount_cents),0)::text n FROM finance_requests WHERE kind='cash_donation' AND status='Posted'",
  );
  check(
    "donor cash excludes sale proceeds and in-kind valuation",
    metric(donors, "cash_in") === Number(donations[0].n),
  );
  const hours = await report("hours", "period=all_time");
  check(
    "employee and volunteer approved hours stay separate",
    metric(hours, "volunteer_hours") === 3 &&
      metric(hours, "employee_hours") === 7.5,
  );
  const empty = await report(
    "sales",
    "period=custom&start=2026-01-01&end=2026-01-01",
  );
  check(
    "empty period has zero records and no fabricated sale",
    empty.status === 200 &&
      empty.body.total === 0 &&
      metric(empty, "cash_in") === 0,
  );
  const exact = await report(
    "sales",
    "period=custom&start=2026-10-28&end=2026-10-28",
  );
  check(
    "both date boundaries included",
    exact.status === 200 && exact.body.rows.some((r) => r.id === sale.id),
  );
  const before = await report(
    "inventory",
    "period=custom&start=2026-01-01&end=2026-01-31",
  );
  check(
    "as-of inventory excludes future gifts",
    before.status === 200 && before.body.total === 0,
  );
  const current = await report("inventory", "period=this_month");
  check(
    "as-of stock includes gifts before the selected period",
    current.status === 200 &&
      current.body.rows.some(
        (r) =>
          r.id === aided.id &&
          r.opening === 3 &&
          r.quantity === 3 &&
          r.received_units === 0,
      ),
  );
  for (const query of [
    "period=custom&start=2026-02-30&end=2026-03-01",
    "period=custom&start=2026-10-20&end=2026-10-01",
    "period=bogus",
    "period=custom",
    "period=all_time&page=0",
    "period=all_time&fund=bad",
  ])
    check(
      "invalid filter rejected: " + query,
      (await report("sales", query)).status === 400,
    );
  const injection = await report(
    "sales",
    "period=all_time&q=" + encodeURIComponent("' OR 1=1 --"),
  );
  check(
    "search is parameterized literal text",
    injection.status === 200 && injection.body.total === 0,
  );
  const coord = await report("transactions", "period=all_time", "coordinator");
  check(
    "coordinator report uses own request scope",
    coord.status === 200 && coord.body.scope.includes("Your submitted"),
  );
  check(
    "coordinator financial report redacts donor identity",
    coord.body.rows.every((r) => r.person === null) &&
      coord.body.options.people.length === 0,
  );
  check(
    "coordinator cannot filter by donor",
    (
      await report(
        "transactions",
        "period=all_time&person=00000000-0000-4000-8000-000000000001",
        "coordinator",
      )
    ).status === 403,
  );
  check(
    "coordinator cannot trace donor funding",
    (
      await request(
        "/api/funding-trace?source=" + cash.body.rows[0].id,
        "coordinator",
      )
    ).status === 403,
  );
  check(
    "fundraising cannot query beneficiary histories",
    (await report("services", "period=all_time", "fundraising")).status === 403,
  );
  const fr = await report("source_impact", "period=all_time", "fundraising");
  check(
    "fundraising source impact hides beneficiary details",
    fr.status === 200 &&
      fr.body.rows.every(
        (r) =>
          r.beneficiary === null &&
          r.service === null &&
          !("beneficiary_id" in r),
      ),
  );
  const ft = await request(
    "/api/funding-trace?source=" + cash.body.rows[0].id,
    "fundraising",
  );
  check(
    "fundraising trace hides beneficiary identities",
    ft.status === 200 &&
      ft.body.movements.every(
        (m) => m.beneficiary_name === null && m.service_title === null,
      ),
  );
  check(
    "finance cannot open whole beneficiary report",
    (await report("services", "period=all_time", "finance")).status === 403,
  );
  const fh = await report("hours", "period=all_time", "finance");
  check(
    "finance hours limited to own entries",
    fh.status === 200 && fh.body.scope.includes("Your employee"),
  );
  for (const id of ["sales", "transactions", "services", "inventory"])
    check(
      "volunteer denied " + id,
      (await report(id, "period=all_time", "volunteer")).status === 403,
    );
  const category = await report("expenses", "period=all_time&category=rent");
  check(
    "rent category comes from recorded field",
    category.status === 200 &&
      metric(category, "cash_out") === 45000 &&
      category.body.rows.every((r) => r.expense_category === "rent"),
  );
  const fund = await sql.query("SELECT id FROM funds WHERE code='nutrition'");
  const filtered = await report(
    "transactions",
    "period=all_time&fund=" + fund[0].id,
  );
  check(
    "fund filter includes incoming allocations and designated transactions",
    filtered.status === 200 &&
      filtered.body.rows.some((r) => r.kind === "allocation") &&
      filtered.body.rows.some((r) => r.kind === "cash_donation"),
  );
  console.log(
    "Reports integration checks passed: " +
      checks +
      "; no business records created.",
  );
} finally {
  for (const role of Object.keys(cookies))
    await request("/api/auth", role, { action: "logout" });
  console.log("Test sign-in sessions closed.");
}
