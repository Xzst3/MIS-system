"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Filter,
  RefreshCw,
  Search,
  Waypoints,
  Plus,
} from "lucide-react";
import type { User } from "@/lib/types";
import {
  reportDefinitions,
  expenseCategories,
  type ReportId,
  type ReportResult,
  type ReportColumn,
} from "@/lib/report-config";
import { financeLabels } from "@/lib/finance-types";
import { reportPeriod, reportToday } from "@/lib/report-periods.mjs";
import {
  BusinessModal,
  dateText,
  dollars,
  LoadState,
  timeText,
} from "./business-ui";
import { FundingTrace } from "./funding-trace";
import { CustomReportBuilder } from "./custom-report-builder";
import Link from "next/link";
const periods = {
  previous_2_months: "Previous 2 complete months",
  rolling_2_months: "Last 2 months to today",
  this_month: "This month to date",
  last_month: "Previous complete month",
  year_to_date: "Year to date",
  all_time: "All recorded history",
  custom: "Custom dates",
};
const labels = (value: unknown) =>
  financeLabels[value as keyof typeof financeLabels] ||
  expenseCategories[String(value)] ||
  String(value ?? "—");
const format = (value: unknown, type?: ReportColumn["type"]) =>
  value === null || value === undefined || value === ""
    ? "—"
    : type === "money"
      ? dollars(Number(value))
      : type === "date"
        ? dateText(String(value))
        : type === "number"
          ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
              Number(value),
            )
          : labels(value);
type Fields = {
  period: string;
  start: string;
  end: string;
  fund: string;
  program: string;
  person: string;
  kind: string;
  category: string;
  status: string;
  engagement: string;
  q: string;
};
export function ReportsWorkspace({ user }: { user: User }) {
  const params = useSearchParams();
  return params.get("mode") === "custom" ? (
    <CustomReportBuilder user={user} />
  ) : (
    <StandardReportsWorkspace user={user} />
  );
}
function StandardReportsWorkspace({ user }: { user: User }) {
  const params = useSearchParams(),
    router = useRouter();
  const allowed = (Object.keys(reportDefinitions) as ReportId[]).filter((r) =>
    (reportDefinitions[r].roles as readonly string[]).includes(user.role),
  );
  const selected = params.get("report") as ReportId;
  const report = allowed.includes(selected) ? selected : allowed[0];
  const preset = params.get("period") || "previous_2_months";
  const initial = () => {
    let dates;
    try {
      dates = reportPeriod(
        preset,
        params.get("start") || undefined,
        params.get("end") || undefined,
      );
    } catch {
      dates = reportPeriod();
    }
    return Object.fromEntries(
      [
        "period",
        "start",
        "end",
        "fund",
        "program",
        "person",
        "kind",
        "category",
        "status",
        "engagement",
        "q",
      ].map((k) => [
        k,
        params.get(k) ||
          (k === "period"
            ? preset
            : k === "start"
              ? dates.start
              : k === "end"
                ? dates.end
                : ""),
      ]),
    ) as Fields;
  };
  const [fields, setFields] = useState<Fields>(initial);
  const [data, setData] = useState<ReportResult | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [detail, setDetail] = useState<Record<
      string,
      string | number | null
    > | null>(null),
    [trace, setTrace] = useState(""),
    [exporting, setExporting] = useState(false);
  const query = new URLSearchParams(params.toString());
  query.set("report", report);
  query.delete("format");
  const queryText = query.toString();
  useEffect(() => {
    setFields(initial());
    setDetail(null);
    setTrace("");
  }, [params]); // URL is the committed report state, including browser Back.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    fetch("/api/reports?" + queryText, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Unable to load report.");
        setData(result);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [queryText, refresh]);
  const change = (key: keyof Fields, value: string) =>
    setFields((f) => ({ ...f, [key]: value }));
  function openReport(next: ReportId) {
    router.push(
      "/workspace/reports?" +
        new URLSearchParams({
          report: next,
          period: params.get("period") || "previous_2_months",
          ...(params.get("period") === "custom"
            ? { start: params.get("start") || "", end: params.get("end") || "" }
            : {}),
        }),
    );
  }
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams({ report });
    Object.entries(fields).forEach(([k, v]) => {
      if (v && (fields.period === "custom" || !["start", "end"].includes(k)))
        next.set(k, v);
    });
    router.push("/workspace/reports?" + next.toString());
  }
  function paginate(page: number) {
    const next = new URLSearchParams(queryText);
    next.set("page", String(page));
    router.push("/workspace/reports?" + next.toString());
  }
  function resetFilters() {
    const dates = reportPeriod();
    setFields({
      period: "previous_2_months",
      start: dates.start,
      end: dates.end,
      fund: "",
      program: "",
      person: "",
      kind: "",
      category: "",
      status: "",
      engagement: "",
      q: "",
    });
    router.push(
      "/workspace/reports?report=" + report + "&period=previous_2_months",
    );
  }
  async function download() {
    setExporting(true);
    setError("");
    try {
      const next = new URLSearchParams(queryText);
      next.set("format", "csv");
      next.delete("page");
      const response = await fetch("/api/reports?" + next, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Unable to export.");
      }
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = `ecf-${report}-${data?.period.start}-to-${data?.period.end}.csv`;
      link.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  const fullFinance = ["admin", "finance"].includes(user.role),
    giving = ["admin", "finance", "fundraising"].includes(user.role);
  const statusOptions =
    report === "services"
      ? ["Planned", "In progress", "Completed", "Cancelled"]
      : report === "hours"
        ? ["Submitted", "Approved", "Rejected"]
        : ["Submitted", "Posted", "Rejected"];
  const showStatus = !["inventory", "source_impact", "donors"].includes(report);
  const choosePreset = (value: string) => {
    let range;
    try {
      range = reportPeriod(value, fields.start, fields.end);
    } catch {
      range = reportPeriod();
    }
    setFields((f) => ({
      ...f,
      period: value,
      start: range.start,
      end: range.end,
    }));
  };
  return (
    <>
      <div className="report-mode-toolbar">
        <p>Start with a standard question or build your own report.</p>
        <Link
          className="button button-dark"
          href="/workspace/reports?mode=custom"
        >
          <Plus size={18} /> Create report
        </Link>
      </div>
      <div className="report-navigation">
        <label className="field">
          Choose a report
          <select
            value={report}
            onChange={(e) => openReport(e.target.value as ReportId)}
          >
            {allowed.map((r) => (
              <option value={r} key={r}>
                {reportDefinitions[r].title}
              </option>
            ))}
          </select>
        </label>
        <details className="report-question-picker">
          <summary>Browse business questions</summary>
          <section
            className="report-question-grid"
            aria-label="Choose a business question"
          >
            {allowed.map((r) => (
              <button
                className={r === report ? "active" : ""}
                key={r}
                aria-pressed={r === report}
                onClick={() => openReport(r)}
              >
                <strong>{reportDefinitions[r].title}</strong>
                <span>{reportDefinitions[r].question}</span>
                <ArrowRight size={18} />
              </button>
            ))}
          </section>
        </details>
      </div>
      <section className="business-panel report-controls">
        <div className="business-panel-heading">
          <span className="eyebrow">ASK, FILTER, FOLLOW THE RECORD</span>
          <h2>{reportDefinitions[report].question}</h2>
          <p>{reportDefinitions[report].note}</p>
        </div>
        <form onSubmit={apply}>
          <div className="report-filter-grid">
            <label className="field">
              Reporting period
              <select
                value={fields.period}
                onChange={(e) => choosePreset(e.target.value)}
              >
                {Object.entries(periods).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              From
              <input
                type="date"
                min="2000-01-01"
                max={reportToday()}
                required
                value={fields.start}
                onChange={(e) =>
                  setFields((f) => ({
                    ...f,
                    start: e.target.value,
                    period: "custom",
                  }))
                }
              />
            </label>
            <label className="field">
              Through
              <input
                type="date"
                min={fields.start}
                max={reportToday()}
                required
                value={fields.end}
                onChange={(e) =>
                  setFields((f) => ({
                    ...f,
                    end: e.target.value,
                    period: "custom",
                  }))
                }
              />
            </label>
            {!["services", "hours"].includes(report) && (
              <label className="field">
                Fund
                <select
                  value={fields.fund}
                  onChange={(e) => change("fund", e.target.value)}
                >
                  <option value="">All permitted funds</option>
                  {data?.options.funds.map((f) => (
                    <option value={f.id} key={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              Programme
              <select
                value={fields.program}
                onChange={(e) => change("program", e.target.value)}
              >
                <option value="">All programmes</option>
                {data?.options.programs.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {(giving || ["services", "hours"].includes(report)) && (
              <label className="field">
                {report === "services"
                  ? "Beneficiary"
                  : report === "hours"
                    ? "Person"
                    : "Donor / original donor"}
                <select
                  value={fields.person}
                  onChange={(e) => change("person", e.target.value)}
                >
                  <option value="">All permitted people</option>
                  {data?.options.people.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {report === "transactions" && (
              <label className="field">
                Transaction type
                <select
                  value={fields.kind}
                  onChange={(e) => change("kind", e.target.value)}
                >
                  <option value="">All permitted types</option>
                  {Object.entries(financeLabels)
                    .filter(([k]) =>
                      fullFinance || user.role === "fundraising"
                        ? fullFinance ||
                          ["cash_donation", "in_kind", "asset_sale"].includes(k)
                        : ["expense", "distribution"].includes(k),
                    )
                    .map(([k, v]) => (
                      <option value={k} key={k}>
                        {v}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {report === "expenses" && (
              <label className="field">
                Expense category
                <select
                  value={fields.category}
                  onChange={(e) => change("category", e.target.value)}
                >
                  <option value="">All categories</option>
                  {Object.entries(expenseCategories).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {showStatus && (
              <label className="field">
                Status
                <select
                  value={fields.status}
                  onChange={(e) => change("status", e.target.value)}
                >
                  <option value="">All statuses</option>
                  {statusOptions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
            {report === "hours" && (
              <label className="field">
                Engagement
                <select
                  value={fields.engagement}
                  onChange={(e) => change("engagement", e.target.value)}
                >
                  <option value="">Employee and volunteer</option>
                  <option value="employee">Employee</option>
                  <option value="volunteer">Volunteer</option>
                </select>
              </label>
            )}
            <label className="field report-search">
              Search references, names or descriptions
              <div>
                <Search size={18} />
                <input
                  type="search"
                  maxLength={150}
                  value={fields.q}
                  onChange={(e) => change("q", e.target.value)}
                  placeholder={
                    report === "source_impact"
                      ? "Donor or original contribution reference"
                      : "Find a record"
                  }
                />
              </div>
            </label>
          </div>
          <div className="report-action-row">
            <button className="button button-dark" type="submit">
              <Filter size={18} /> Apply filters
            </button>
            <button
              className="button button-outline"
              type="button"
              onClick={resetFilters}
            >
              Reset filters
            </button>
            <button
              className="icon-button"
              aria-label="Refresh report"
              type="button"
              onClick={() => setRefresh((r) => r + 1)}
              disabled={loading}
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </form>
      </section>
      <LoadState
        error={error}
        loading={loading}
        onRetry={() => setRefresh((r) => r + 1)}
      />
      {data && (
        <>
          <div className="report-period-summary">
            <strong>
              {dateText(data.period.start)} – {dateText(data.period.end)}
            </strong>
            <span>
              {data.period.previous_start
                ? `Compared with ${dateText(data.period.previous_start)} – ${dateText(data.period.previous_end!)}. ${data.period.comparison_basis}.`
                : "All recorded history; no earlier comparison."}
            </span>
            <small>{data.scope}</small>
          </div>
          <div className="business-metrics report-metrics">
            {data.metrics.map((m) => (
              <article className="business-metric" key={m.key}>
                <span>{m.label}</span>
                <strong>{format(m.value, m.type)}</strong>
                <small>
                  {m.previous === null
                    ? "All-time measure"
                    : `Previous: ${format(m.previous, m.type)} · Change: ${m.value - m.previous > 0 ? "+" : ""}${format(m.value - m.previous, m.type)}`}
                </small>
              </article>
            ))}
          </div>
          <div className="report-analysis-grid">
            <section className="business-panel">
              <div className="business-panel-heading">
                <h2>Monthly activity</h2>
                <p>
                  {report === "hours"
                    ? "Entries by work date. Approval is shown in the totals above."
                    : report === "inventory"
                      ? "Stock position at the selected closing date."
                      : "Records by business date, using the same filters."}
                </p>
              </div>
              <div className="report-months">
                {data.months.map((m) => (
                  <div key={m.month}>
                    <span>
                      {new Date(m.month + "-15T12:00:00Z").toLocaleDateString(
                        "en-US",
                        { month: "short", year: "numeric", timeZone: "UTC" },
                      )}
                    </span>
                    <div className="report-bar">
                      <i
                        style={{
                          width: `${Math.max(2, (m.records / Math.max(1, ...data.months.map((v) => v.records))) * 100)}%`,
                        }}
                      />
                    </div>
                    <strong>{m.records}</strong>
                    {giving && ["transactions", "sales"].includes(report) && (
                      <small>{dollars(m.cash_in)} received</small>
                    )}
                  </div>
                ))}
                {!data.months.length && (
                  <p>No matching activity in this period.</p>
                )}
              </div>
            </section>
            <section className="business-panel">
              <div className="business-panel-heading">
                <h2>
                  {report === "expenses"
                    ? "Expense breakdown"
                    : "Activity breakdown"}
                </h2>
                <p>
                  Matching records, grouped without changing the selected dates.
                </p>
              </div>
              <div className="report-breakdown">
                {data.breakdown.map((b) => (
                  <div key={b.label}>
                    <span>{b.label}</span>
                    <strong>
                      {report === "expenses"
                        ? dollars(b.cash_out)
                        : `${b.records} ${b.records === 1 ? "record" : "records"}`}
                    </strong>
                  </div>
                ))}
                {!data.breakdown.length && <p>No matching records.</p>}
              </div>
            </section>
          </div>
          <section className="business-panel report-results">
            <div className="report-results-heading">
              <div>
                <h2>{data.title}</h2>
                <p role="status">
                  {data.total} matching{" "}
                  {data.total === 1 ? "record" : "records"} ·{" "}
                  {data.total
                    ? Math.min((data.page - 1) * data.page_size + 1, data.total)
                    : 0}
                  –{Math.min(data.page * data.page_size, data.total)} shown
                </p>
              </div>
              <button
                className="button button-outline"
                onClick={download}
                disabled={exporting || loading || data.total === 0}
              >
                <Download size={18} />
                {exporting ? "Exporting…" : "Export all matches"}
              </button>
            </div>
            <div className="business-table-wrap">
              <table className="business-table">
                <caption className="sr-only">
                  {data.title}: {data.period.start} through {data.period.end}
                </caption>
                <thead>
                  <tr>
                    {data.columns.map((c) => (
                      <th scope="col" key={c.key}>
                        {c.label}
                      </th>
                    ))}
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={String(row.id || i)}>
                      {data.columns.map((c) => (
                        <td key={c.key}>{format(row[c.key], c.type)}</td>
                      ))}
                      <td>
                        <button
                          className="business-detail-button"
                          onClick={() => setDetail(row)}
                        >
                          View record <ArrowRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.rows.length && (
              <div className="report-empty">
                No records match these dates and filters. Try another period or
                reset the filters.
              </div>
            )}
            <div className="report-pagination">
              <button
                className="button button-outline"
                disabled={data.page <= 1}
                onClick={() => paginate(data.page - 1)}
              >
                <ArrowLeft size={17} /> Previous
              </button>
              <span>
                Page {data.page} of{" "}
                {Math.max(1, Math.ceil(data.total / data.page_size))}
              </span>
              <button
                className="button button-outline"
                disabled={data.page * data.page_size >= data.total}
                onClick={() => paginate(data.page + 1)}
              >
                Next <ArrowRight size={17} />
              </button>
            </div>
            <p className="report-definition">
              Exports include all matching records, up to 20,000 per file.
              Narrow the filters for larger sets. Values use USD; estimated
              assets and cash are never combined.
            </p>
          </section>
        </>
      )}
      {detail && data && (
        <BusinessModal title="Record details" onClose={() => setDetail(null)}>
          <dl className="report-record-details">
            {Object.entries(detail)
              .filter(
                ([key, value]) =>
                  !["id", "person_id", "source_id", "asset_id"].includes(key) &&
                  value !== null &&
                  value !== "",
              )
              .map(([key, value]) => {
                const col = data.columns.find((c) => c.key === key);
                return (
                  <div key={key}>
                    <dt>{col?.label || key.replaceAll("_", " ")}</dt>
                    <dd>
                      {key === "reviewed_at"
                        ? timeText(String(value))
                        : key === "settlement_confirmed"
                          ? value
                            ? "Confirmed"
                            : "Not externally settled"
                          : format(value, col?.type)}
                    </dd>
                  </div>
                );
              })}
          </dl>
          {report === "donors" && detail.person_id && (
            <button
              className="button button-dark"
              onClick={() => {
                const next = new URLSearchParams(queryText);
                next.set("report", "transactions");
                next.set("person", String(detail.person_id));
                next.delete("page");
                router.push("/workspace/reports?" + next);
              }}
            >
              Open contribution history <ArrowRight size={18} />
            </button>
          )}
          {giving &&
            (detail.source_id ||
              ["cash_donation", "asset_sale", "in_kind", "inventory"].includes(
                String(detail.kind || "") ||
                  (report === "inventory" ? "inventory" : ""),
              )) && (
              <button
                className="button button-dark"
                onClick={() => {
                  setTrace(String(detail.source_id || detail.id));
                  setDetail(null);
                }}
              >
                <Waypoints size={18} /> Trace original contribution
              </button>
            )}
        </BusinessModal>
      )}
      {trace && (
        <BusinessModal
          title="From donor to recorded use"
          onClose={() => setTrace("")}
        >
          <FundingTrace source={trace} />
        </BusinessModal>
      )}
    </>
  );
}
