import test from "node:test";
import assert from "node:assert/strict";
import {
  builderCatalog,
  builderTemplates,
  defaultDefinition,
  validateDefinition,
  numericFilterValue,
} from "../lib/report-builder-model.mjs";
const check = (c, role = "admin") => validateDefinition(c, role);
test("all role-specific defaults and foundation templates are valid", () => {
  for (const role of ["admin", "finance", "coordinator", "fundraising"]) {
    for (const ds of builderCatalog(role))
      check(defaultDefinition(ds.key, role), role);
    for (const t of builderTemplates(role)) check(t.definition, role);
  }
  assert.deepEqual(builderCatalog("volunteer"), []);
  assert.deepEqual(builderCatalog("unknown"), []);
});
test("coordinator and fundraising catalogues exclude protected data fields", () => {
  assert.ok(
    !builderCatalog("coordinator")
      .find((d) => d.key === "transactions")
      .fields.some((f) => f.key === "person"),
  );
  assert.ok(
    !builderCatalog("fundraising")
      .find((d) => d.key === "source_impact")
      .fields.some((f) => ["service", "beneficiary"].includes(f.key)),
  );
  assert.ok(!builderCatalog("finance").some((d) => d.key === "services"));
});
test("role protection applies to columns, filters and groupings, not just the UI", () => {
  const c = defaultDefinition("source_impact", "fundraising");
  for (const patch of [
    { columns: [...c.columns, "beneficiary"] },
    { filters: [{ field: "service", op: "contains", value: "secret" }] },
    {
      mode: "summary",
      groupBy: ["beneficiary"],
      sort: { key: "beneficiary", direction: "asc" },
    },
  ])
    assert.throws(
      () => check({ ...c, ...patch }, "fundraising"),
      (e) => e.code === "FORBIDDEN",
    );
  assert.throws(
    () => check(defaultDefinition("services", "admin"), "finance"),
    (e) => e.code === "FORBIDDEN",
  );
});
test("financial measures cannot be replaced with an arbitrary sum or SQL expression", () => {
  const c = defaultDefinition("transactions", "admin");
  for (const key of ["sum(amount)", "amount", "cash_in);DROP TABLE users;--"])
    assert.throws(() => check({ ...c, metrics: [key], chartMetric: key }));
  assert.throws(() => check({ ...c, sql: "SELECT * FROM users" }));
  assert.throws(() => check({ ...c, columns: ["name FROM users"] }));
});
test("numeric filter values use exact cents and reject unsupported precision", () => {
  assert.equal(numericFilterValue("0.01", "money"), 1);
  assert.equal(numericFilterValue("100.25", "money"), 10025);
  assert.equal(numericFilterValue("0", "money"), 0);
  assert.equal(numericFilterValue("2.50", "number"), 2.5);
  for (const value of ["1.005", "-1", "1e5", "NaN", "0 OR true", ""])
    assert.throws(() => numericFilterValue(value, "money"));
});
test("duplicate fields and measures and invalid sorting are rejected", () => {
  const c = defaultDefinition("sales", "admin");
  assert.throws(() => check({ ...c, columns: ["date", "date"] }));
  assert.throws(() => check({ ...c, metrics: ["cash_in", "cash_in"] }));
  assert.throws(() =>
    check({ ...c, sort: { key: "reviewer", direction: "asc" } }),
  );
  assert.throws(() => check({ ...c, columns: [] }));
});
test("chart compatibility is validated on the server", () => {
  const c = builderTemplates("admin").find(
    (t) => t.definition.dataset === "sales",
  ).definition;
  check({ ...c, display: "line" });
  assert.throws(() =>
    check({ ...c, groupBy: ["month", "person"], display: "bar" }),
  );
  assert.throws(() =>
    check({
      ...c,
      groupBy: ["person"],
      sort: { key: "person", direction: "asc" },
      display: "line",
    }),
  );
  assert.throws(() =>
    check({
      ...c,
      mode: "details",
      sort: { key: "date", direction: "asc" },
      display: "bar",
    }),
  );
});
test("date ranges and between filters are validated before execution", () => {
  const c = defaultDefinition("sales", "admin");
  assert.throws(() =>
    check({ ...c, period: "custom", start: "2026-02-30", end: "2026-03-01" }),
  );
  assert.throws(() =>
    check({
      ...c,
      filters: [{ field: "amount", op: "between", value: "500", to: "100" }],
    }),
  );
  assert.throws(() =>
    check({
      ...c,
      filters: [
        { field: "date", op: "between", value: "2026-10-31", to: "2026-10-01" },
      ],
    }),
  );
  check({
    ...c,
    filters: [{ field: "reviewed_at", op: "is", value: "2026-11-06" }],
  });
});
test("filter operators match field types and empty filters require no value", () => {
  const c = defaultDefinition("sales", "admin");
  assert.throws(() =>
    check({ ...c, filters: [{ field: "amount", op: "contains", value: "5" }] }),
  );
  assert.throws(() =>
    check({ ...c, filters: [{ field: "person", op: "gt", value: "A" }] }),
  );
  check({ ...c, filters: [{ field: "reviewer", op: "empty", value: "" }] });
  assert.throws(() =>
    check({ ...c, filters: [{ field: "status", op: "is", value: "Paid" }] }),
  );
});
test("drill-down rejects invalid identities and unavailable dimensions", () => {
  const c = defaultDefinition("source_impact", "fundraising");
  assert.throws(() =>
    check(
      {
        ...c,
        drill: [{ field: "person", value: "Someone", identity: "not-a-uuid" }],
      },
      "fundraising",
    ),
  );
  assert.throws(() =>
    check(
      { ...c, drill: [{ field: "beneficiary", value: "Someone" }] },
      "fundraising",
    ),
  );
  assert.throws(() =>
    check(
      { ...c, drill: [{ field: "month", value: "2026-99" }] },
      "fundraising",
    ),
  );
});
