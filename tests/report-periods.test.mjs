import test from "node:test";
import assert from "node:assert/strict";
import { reportPeriod, validDate, csvCell } from "../lib/report-periods.mjs";
test("previous two months use complete calendar months and the preceding two calendar months", () => {
  const p = reportPeriod(
    "previous_2_months",
    undefined,
    undefined,
    "2026-11-06",
  );
  assert.deepEqual(
    [p.start, p.end, p.previous_start, p.previous_end],
    ["2026-09-01", "2026-10-31", "2026-07-01", "2026-08-31"],
  );
});
test("calendar periods cross year boundaries correctly", () => {
  const p = reportPeriod(
    "previous_2_months",
    undefined,
    undefined,
    "2026-01-01",
  );
  assert.deepEqual(
    [p.start, p.end, p.previous_start, p.previous_end],
    ["2025-11-01", "2025-12-31", "2025-09-01", "2025-10-31"],
  );
});
test("last complete month preserves leap day", () => {
  const p = reportPeriod("last_month", undefined, undefined, "2024-03-31");
  assert.deepEqual(
    [p.start, p.end, p.previous_start, p.previous_end],
    ["2024-02-01", "2024-02-29", "2024-01-01", "2024-01-31"],
  );
});
test("rolling two months clamp month end without rolling into the next month", () => {
  const p = reportPeriod(
    "rolling_2_months",
    undefined,
    undefined,
    "2026-04-30",
  );
  assert.equal(p.start, "2026-02-28");
  assert.equal(p.end, "2026-04-30");
});
test("custom dates include both boundary dates and compare equal days", () => {
  const p = reportPeriod("custom", "2026-10-01", "2026-10-31", "2026-11-06");
  assert.deepEqual(
    [p.previous_start, p.previous_end],
    ["2026-08-31", "2026-09-30"],
  );
});
test("invalid, future and reversed dates are rejected instead of silently normalized", () => {
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(validDate("2024-02-29"), true);
  for (const [start, end] of [
    ["2026-02-30", "2026-03-01"],
    ["2026-11-07", "2026-11-08"],
    ["2026-10-05", "2026-10-04"],
    ["1999-12-31", "2026-10-01"],
  ])
    assert.throws(() => reportPeriod("custom", start, end, "2026-11-06"));
});
test("all time has no artificial comparison", () => {
  const p = reportPeriod("all_time", undefined, undefined, "2026-11-06");
  assert.equal(p.previous_start, null);
  assert.equal(p.previous_end, null);
});
test("CSV preserves quotes and newlines and neutralizes formula prefixes including whitespace", () => {
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  assert.equal(csvCell('  =HYPERLINK("x")'), '"\'  =HYPERLINK(""x"")"');
});
