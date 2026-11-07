"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  Play,
  Save,
  Copy,
  Archive,
  RotateCcw,
  Download,
  Waypoints,
  FolderOpen,
  LayoutTemplate,
  Settings2,
} from "lucide-react";
import type { User } from "@/lib/types";
import type {
  BuilderCatalogue,
  BuilderDataset,
  BuilderDefinition,
  BuilderResult,
  BuilderRow,
  SavedReport,
} from "@/lib/report-builder-types";
import { reportPeriod, reportToday } from "@/lib/report-periods.mjs";
import {
  BusinessModal,
  LoadState,
  dateText,
  timeText,
  dollars,
  send,
} from "./business-ui";
import { FundingTrace } from "./funding-trace";
function fresh(ds: BuilderDataset): BuilderDefinition {
  return {
    version: 1,
    dataset: ds.key,
    mode: "details",
    columns: [...ds.defaults],
    metrics: [...ds.defaultMetrics],
    groupBy: [],
    period: "previous_2_months",
    filters: [],
    match: "all",
    display: "table",
    chartMetric: ds.defaultMetrics[0],
    sort: {
      key: ds.defaults.includes("date") ? "date" : ds.defaults[0],
      direction: ds.defaults.includes("date") ? "desc" : "asc",
    },
    drill: [],
  };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) || "null";
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const fmt = (
  value: unknown,
  type?: string,
  ds?: BuilderDataset,
  key?: string,
) => {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "money") return dollars(Number(value));
  if (type === "number")
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
      Number(value),
    );
  if (type === "date") return dateText(String(value));
  if (type === "timestamp") return timeText(String(value));
  const field = ds?.fields.find((f) => f.key === key?.replace(/^g_/, ""));
  return field?.values?.[String(value)] || String(value);
};
function operations(type: string) {
  return ["number", "money", "date", "timestamp"].includes(type)
    ? [
        ["is", "Equals"],
        ["is_not", "Does not equal"],
        ["gt", "Greater than"],
        ["gte", "At least"],
        ["lt", "Less than"],
        ["lte", "At most"],
        ["between", "Between"],
        ["empty", "Is empty"],
        ["not_empty", "Is not empty"],
      ]
    : [
        ["contains", "Contains"],
        ["is", "Is exactly"],
        ["is_not", "Is different from"],
        ["empty", "Is empty"],
        ["not_empty", "Is not empty"],
      ];
}
export function CustomReportBuilder({ user }: { user: User }) {
  const params = useSearchParams(),
    [catalog, setCatalog] = useState<BuilderCatalogue | null>(null),
    [reports, setReports] = useState<SavedReport[]>([]),
    [draft, setDraft] = useState<BuilderDefinition | null>(null);
  const [tab, setTab] = useState<"build" | "saved" | "templates">("build"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [init, setInit] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<BuilderResult | null>(null),
    [current, setCurrent] = useState<SavedReport | null>(null),
    [parent, setParent] = useState<BuilderDefinition | null>(null),
    [showArchived, setShowArchived] = useState(false),
    [savedSearch, setSavedSearch] = useState("");
  const [saveDialog, setSaveDialog] = useState<{
      id: string;
      expected: number;
      name: string;
      description: string;
    } | null>(null),
    [saveError, setSaveError] = useState(""),
    [saving, setSaving] = useState(false),
    [record, setRecord] = useState<BuilderRow | null>(null),
    [trace, setTrace] = useState("");
  const requestRef = useRef<AbortController | null>(null),
    resultHeading = useRef<HTMLHeadingElement>(null),
    opened = useRef("");
  const ds = catalog?.datasets.find((d) => d.key === draft?.dataset),
    stale = Boolean(
      result && draft && canonical(result.definition) !== canonical(draft),
    );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/report-builder", {
        cache: "no-store",
        signal: controller.signal,
      }),
      fetch("/api/saved-reports?archived=1", {
        cache: "no-store",
        signal: controller.signal,
      }),
    ])
      .then(async ([a, b]) => {
        if (a.status === 401 || b.status === 401) {
          window.location.assign("/login");
          return;
        }
        const [ca, sa] = await Promise.all([a.json(), b.json()]);
        if (!a.ok || !b.ok)
          throw new Error(
            ca.error || sa.error || "Unable to open the report builder.",
          );
        setCatalog(ca);
        setReports(sa.reports);
        setDraft((d) => d || fresh(ca.datasets[0]));
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [init]);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    const saved = params.get("saved");
    if (!catalog || !saved || opened.current === saved) return;
    opened.current = saved;
    const found = reports.find((r) => r.id === saved && !r.archived_at);
    if (found?.available && found.definition) openSaved(found);
    else
      setError(
        "This saved report is unavailable or is not owned by your account.",
      );
  }, [catalog, reports, params]);
  async function reloadSaved() {
    const r = await fetch("/api/saved-reports?archived=1", {
      cache: "no-store",
    });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error || "Unable to load saved reports.");
    setReports(b.reports);
  }
  async function run(definition: BuilderDefinition, page = 1, scroll = true) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/report-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition, page }),
        signal: controller.signal,
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const b = await response.json();
      if (!response.ok)
        throw new Error(b.error || "Unable to preview the report.");
      setResult(b);
      if (scroll)
        requestAnimationFrame(() =>
          resultHeading.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        );
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (requestRef.current === controller) setBusy(false);
    }
  }
  function setDefinition(next: BuilderDefinition) {
    setDraft(next);
    setNotice("");
  }
  function changeTopic(key: string) {
    const next = catalog!.datasets.find((d) => d.key === key)!;
    setDraft(fresh(next));
    setCurrent(null);
    setResult(null);
    setParent(null);
    setNotice("");
    setError("");
  }
  function selectMode(mode: "details" | "summary") {
    if (!draft || !ds) return;
    const group = draft.groupBy.length
      ? draft.groupBy
      : [
          ds.dimensions.find((d) => d.key === "month")?.key ||
            ds.dimensions[0].key,
        ];
    setDefinition({
      ...draft,
      mode,
      groupBy: mode === "summary" ? group : draft.groupBy,
      display: "table",
      sort: {
        key: mode === "summary" ? group[0] : draft.columns[0],
        direction: "asc",
      },
    });
  }
  function moveColumn(index: number, delta: number) {
    const columns = [...draft!.columns];
    [columns[index], columns[index + delta]] = [
      columns[index + delta],
      columns[index],
    ];
    setDefinition({ ...draft!, columns });
  }
  function removeColumn(key: string) {
    const columns = draft!.columns.filter((k) => k !== key);
    setDefinition({
      ...draft!,
      columns,
      sort:
        draft!.sort.key === key
          ? { key: columns[0], direction: "asc" }
          : draft!.sort,
    });
  }
  function updateGroups(groupBy: string[]) {
    const allowed = [...groupBy, ...draft!.metrics];
    setDefinition({
      ...draft!,
      groupBy,
      display:
        groupBy.length !== 1
          ? "table"
          : draft!.display === "line" &&
              !ds?.dimensions.find((d) => d.key === groupBy[0])?.temporal
            ? "table"
            : draft!.display,
      sort: allowed.includes(draft!.sort.key)
        ? draft!.sort
        : { key: groupBy[0] || draft!.metrics[0], direction: "asc" },
    });
  }
  function toggleMetric(key: string) {
    const metrics = draft!.metrics.includes(key)
      ? draft!.metrics.filter((k) => k !== key)
      : [...draft!.metrics, key];
    setDefinition({
      ...draft!,
      metrics,
      chartMetric: metrics.includes(draft!.chartMetric)
        ? draft!.chartMetric
        : metrics[0],
      sort:
        draft!.mode === "summary" &&
        ![...draft!.groupBy, ...metrics].includes(draft!.sort.key)
          ? { key: draft!.groupBy[0], direction: "asc" }
          : draft!.sort,
    });
  }
  function setPeriod(period: string) {
    let p;
    try {
      p = reportPeriod(period, draft?.start, draft?.end);
    } catch {
      p = reportPeriod();
    }
    setDefinition({
      ...draft!,
      period,
      ...(period === "custom"
        ? { start: p.start, end: p.end }
        : { start: undefined, end: undefined }),
    });
  }
  function updateFilter(
    index: number,
    patch: Partial<BuilderDefinition["filters"][number]>,
  ) {
    setDefinition({
      ...draft!,
      filters: draft!.filters.map((f, i) =>
        i === index ? { ...f, ...patch } : f,
      ),
    });
  }
  function openSaved(saved: SavedReport, duplicate = false) {
    if (!saved.definition) return;
    const c = clone(saved.definition);
    setDraft(c);
    setCurrent(duplicate ? null : saved);
    setParent(null);
    setTab("build");
    setNotice(
      duplicate
        ? "A separate copy is ready. Save it under a new name."
        : "Loaded saved settings. The preview queries current foundation data.",
    );
    setError("");
    void run(c, 1, false);
  }
  function openTemplate(template: BuilderCatalogue["templates"][number]) {
    const c = clone(template.definition);
    setDraft(c);
    setCurrent(null);
    setParent(null);
    setTab("build");
    setNotice(
      "Started from a foundation template. Save your own version when ready.",
    );
    void run(c, 1, false);
  }
  function beginSave(copy = false) {
    setSaveError("");
    setSaveDialog({
      id: !copy && current && !parent ? current.id : crypto.randomUUID(),
      expected: !copy && current && !parent ? current.version : 0,
      name: current
        ? copy || parent
          ? current.name + " copy"
          : current.name
        : "",
      description: current?.description || "",
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!saveDialog || !draft) return;
    setSaving(true);
    setSaveError("");
    try {
      const body = await send("/api/saved-reports", {
        action: "save",
        id: saveDialog.id,
        expected_version: saveDialog.expected,
        name: saveDialog.name,
        description: saveDialog.description,
        definition: draft,
      });
      setCurrent(body.report);
      setSaveDialog(null);
      setParent(null);
      setNotice(
        "Saved to your reports. Opening it again will query current data.",
      );
      await reloadSaved().catch((e) => setError((e as Error).message));
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function archive(saved: SavedReport, restore = false) {
    setError("");
    setBusy(true);
    try {
      await send("/api/saved-reports", {
        action: restore ? "restore" : "archive",
        id: saved.id,
        expected_version: saved.version,
      });
      if (!restore && current?.id === saved.id) setCurrent(null);
      setNotice(
        restore
          ? "Report restored."
          : "Report archived. Show archived reports to restore it.",
      );
      await reloadSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!result || stale) return;
    setExporting(true);
    setError("");
    try {
      const r = await fetch("/api/report-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition: result.definition, format: "csv" }),
      });
      if (!r.ok) {
        const b = await r.json();
        throw new Error(b.error || "Unable to export.");
      }
      const href = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = href;
      a.download = `ecf-custom-${result.definition.dataset}-${result.period.start}-to-${result.period.end}.csv`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  function drill(row: BuilderRow) {
    if (!result || !ds) return;
    const group = row.__drill as BuilderDefinition["drill"];
    if (!Array.isArray(group)) return;
    const merged = [
      ...new Map(
        [...result.definition.drill, ...group].map((d) => [d.field, d]),
      ).values(),
    ];
    const next = {
      ...result.definition,
      mode: "details" as const,
      columns: [...ds.defaults],
      display: "table" as const,
      groupBy: [],
      sort: {
        key: ds.defaults.includes("date") ? "date" : ds.defaults[0],
        direction: "asc" as const,
      },
      drill: merged,
    };
    setParent(clone(result.definition));
    setDraft(next);
    void run(next);
  }
  if (!catalog || !draft || !ds)
    return (
      <LoadState
        error={error}
        loading={loading}
        onRetry={() => setInit((i) => i + 1)}
      />
    );
  const dates =
      draft.period === "custom"
        ? { start: draft.start || "", end: draft.end || "" }
        : reportPeriod(draft.period),
    sorts =
      draft.mode === "details"
        ? draft.columns.map((k) => ({
            key: k,
            label: ds.fields.find((f) => f.key === k)!.label,
          }))
        : [
            ...draft.groupBy.map((k) => ({
              key: k,
              label: ds.dimensions.find((d) => d.key === k)!.label,
            })),
            ...draft.metrics.map((k) => ({
              key: k,
              label: ds.metrics.find((m) => m.key === k)!.label,
            })),
          ];
  const lineAvailable =
    draft.mode === "summary" &&
    draft.groupBy.length === 1 &&
    ds.dimensions.find((d) => d.key === draft.groupBy[0])?.temporal;
  const shownReports = reports.filter(
    (r) =>
      (showArchived || !r.archived_at) &&
      (!savedSearch ||
        (r.name + " " + r.description)
          .toLowerCase()
          .includes(savedSearch.toLowerCase())),
  );
  const resultDataset =
    catalog.datasets.find((d) => d.key === result?.definition.dataset) || ds;
  return (
    <div className="custom-report-builder">
      <div className="builder-topline">
        <div>
          <span className="eyebrow">YOUR QUESTIONS, YOUR VIEW</span>
          <h2>Custom reports</h2>
          <p>Choose the records, measures and layout you need.</p>
        </div>
        <Link className="button button-outline" href="/workspace/reports">
          <ArrowLeft size={18} /> Standard reports
        </Link>
      </div>
      <nav className="builder-tabs" aria-label="Custom report sections">
        {[
          ["build", "Build report", Settings2],
          ["saved", "My reports", FolderOpen],
          ["templates", "Foundation templates", LayoutTemplate],
        ].map(([key, label, Icon]) => {
          const I = Icon as typeof Settings2;
          return (
            <button
              type="button"
              key={String(key)}
              aria-current={tab === key ? "page" : undefined}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key as typeof tab);
                if (key === "saved")
                  void reloadSaved().catch((e) =>
                    setError((e as Error).message),
                  );
              }}
            >
              <I size={19} />
              {String(label)}
            </button>
          );
        })}
      </nav>
      <LoadState error={error} loading={false} onRetry={() => setError("")} />
      {notice && (
        <p className="builder-notice" role="status">
          {notice}
        </p>
      )}

      {tab === "saved" && (
        <section className="business-panel builder-library">
          <div className="builder-section-heading">
            <div>
              <h3>My reports</h3>
              <p>
                Private to your account. Saved settings run against current
                data.
              </p>
            </div>
            <button
              className="button button-dark"
              onClick={() => {
                changeTopic(catalog.datasets[0].key);
                setTab("build");
              }}
            >
              <Plus size={18} /> New report
            </button>
          </div>
          <div className="builder-library-controls">
            <label className="field">
              Find a saved report
              <input
                type="search"
                value={savedSearch}
                onChange={(e) => setSavedSearch(e.target.value)}
                placeholder="Search by report name"
              />
            </label>
            <label className="builder-check">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />{" "}
              Show archived reports
            </label>
          </div>
          <div className="builder-library-grid">
            {shownReports.map((r) => (
              <article className={r.archived_at ? "archived" : ""} key={r.id}>
                <span className="eyebrow">
                  {r.archived_at ? "ARCHIVED" : "SAVED REPORT"}
                </span>
                <h4>{r.name}</h4>
                <p>
                  {r.description ||
                    catalog.datasets.find(
                      (d) => d.key === r.definition?.dataset,
                    )?.grain ||
                    "Personal report settings."}
                </p>
                <small>Updated {timeText(r.updated_at)}</small>
                <div className="builder-card-actions">
                  {r.archived_at ? (
                    <button
                      className="button button-outline"
                      disabled={busy}
                      onClick={() => archive(r, true)}
                    >
                      <RotateCcw size={17} /> Restore
                    </button>
                  ) : (
                    <>
                      <button
                        className="button button-dark"
                        disabled={busy || !r.available}
                        onClick={() => openSaved(r)}
                      >
                        <FolderOpen size={17} /> Open
                      </button>
                      <button
                        className="button button-outline"
                        disabled={busy || !r.available}
                        onClick={() => openSaved(r, true)}
                      >
                        <Copy size={17} /> Duplicate
                      </button>
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={"Archive " + r.name}
                        onClick={() => archive(r)}
                      >
                        <Archive size={19} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!shownReports.length && (
            <div className="report-empty">
              {savedSearch
                ? "No saved reports match your search."
                : "Your saved reports will appear here. Start with a foundation template or create a report."}
            </div>
          )}
        </section>
      )}
      {tab === "templates" && (
        <section className="business-panel builder-library">
          <div className="builder-section-heading">
            <div>
              <h3>Foundation templates</h3>
              <p>
                Start with a familiar question, then choose your own fields and
                measures.
              </p>
            </div>
          </div>
          <div className="builder-library-grid">
            {catalog.templates.map((t) => (
              <article key={t.id}>
                <span className="eyebrow">FOUNDATION TEMPLATE</span>
                <h4>{t.name}</h4>
                <p>{t.description}</p>
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => openTemplate(t)}
                >
                  Use template <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {tab === "build" && (
        <>
          <div className="builder-current">
            <strong>{current?.name || "Untitled report"}</strong>
            <span>
              {current
                ? `Saved ${timeText(current.updated_at)}`
                : "Save your choices to reuse this report."}
            </span>
            {parent && (
              <button
                className="button button-outline"
                onClick={() => {
                  const next = parent;
                  setDraft(next);
                  setParent(null);
                  void run(next);
                }}
              >
                <ArrowLeft size={17} /> Back to summary
              </button>
            )}
          </div>
          <fieldset className="builder-form" disabled={busy || saving}>
            <section className="business-panel builder-section">
              <div className="builder-section-heading">
                <div>
                  <span className="eyebrow">STEP 1</span>
                  <h3>Choose the data</h3>
                </div>
              </div>
              <div className="builder-fields-grid">
                <label className="field">
                  Reporting topic
                  <select
                    value={draft.dataset}
                    onChange={(e) => changeTopic(e.target.value)}
                  >
                    {catalog.datasets.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <span className="builder-field-label">Report layout</span>
                  <div className="builder-segment">
                    <button
                      type="button"
                      aria-pressed={draft.mode === "details"}
                      onClick={() => selectMode("details")}
                    >
                      Detailed records
                    </button>
                    <button
                      type="button"
                      aria-pressed={draft.mode === "summary"}
                      onClick={() => selectMode("summary")}
                    >
                      Grouped summary
                    </button>
                  </div>
                </div>
                <label className="field">
                  Reporting period
                  <select
                    value={draft.period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    {Object.entries(catalog.periods).map(([k, v]) => (
                      <option key={k} value={k}>
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
                    value={dates.start}
                    onChange={(e) => {
                      if (e.target.value)
                        setDefinition({
                          ...draft,
                          period: "custom",
                          start: e.target.value,
                          end: dates.end,
                        });
                    }}
                  />
                </label>
                <label className="field">
                  Through
                  <input
                    type="date"
                    min={dates.start}
                    max={reportToday()}
                    value={dates.end}
                    onChange={(e) => {
                      if (e.target.value)
                        setDefinition({
                          ...draft,
                          period: "custom",
                          start: dates.start,
                          end: e.target.value,
                        });
                    }}
                  />
                </label>
              </div>
              <p className="builder-grain">{ds.grain}</p>
              {draft.drill.length > 0 && (
                <div className="builder-drill">
                  <strong>Viewing matching group:</strong>
                  {draft.drill.map((d) => (
                    <span key={d.field}>
                      {ds.dimensions.find((f) => f.key === d.field)?.label}:{" "}
                      {d.value || "Unassigned"}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDefinition({ ...draft, drill: [] })}
                  >
                    Clear group filter <X size={15} />
                  </button>
                </div>
              )}
            </section>
            <div className="builder-two-columns">
              <section className="business-panel builder-section">
                <div className="builder-section-heading">
                  <div>
                    <span className="eyebrow">STEP 2</span>
                    <h3>
                      {draft.mode === "details"
                        ? "Select and order columns"
                        : "Choose how to group"}
                    </h3>
                    <p>
                      {draft.mode === "details"
                        ? "Up to 12 fields, in the order you choose."
                        : "Use one or two groupings. People with the same name retain separate identities."}
                    </p>
                  </div>
                </div>
                {draft.mode === "details" ? (
                  <>
                    <ol className="builder-column-list">
                      {draft.columns.map((key, i) => (
                        <li key={key}>
                          <span>
                            <i>{i + 1}</i>
                            {ds.fields.find((f) => f.key === key)?.label}
                          </span>
                          <div>
                            <button
                              type="button"
                              className="icon-button"
                              disabled={i === 0}
                              aria-label={
                                "Move " +
                                ds.fields.find((f) => f.key === key)?.label +
                                " up"
                              }
                              onClick={() => moveColumn(i, -1)}
                            >
                              <ArrowUp size={17} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              disabled={i === draft.columns.length - 1}
                              aria-label={
                                "Move " +
                                ds.fields.find((f) => f.key === key)?.label +
                                " down"
                              }
                              onClick={() => moveColumn(i, 1)}
                            >
                              <ArrowDown size={17} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              disabled={draft.columns.length === 1}
                              aria-label={
                                "Remove " +
                                ds.fields.find((f) => f.key === key)?.label +
                                " column"
                              }
                              onClick={() => removeColumn(key)}
                            >
                              <X size={17} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <label className="field builder-add-control">
                      Add a column
                      <select
                        value=""
                        disabled={draft.columns.length >= 12}
                        onChange={(e) => {
                          if (e.target.value)
                            setDefinition({
                              ...draft,
                              columns: [...draft.columns, e.target.value],
                            });
                        }}
                      >
                        <option value="">Choose another field</option>
                        {ds.fields
                          .filter((f) => !draft.columns.includes(f.key))
                          .map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <div className="builder-group-controls">
                    {draft.groupBy.map((key, i) => (
                      <label className="field" key={i}>
                        Group {i + 1}
                        <div className="builder-inline-control">
                          <select
                            value={key}
                            onChange={(e) =>
                              updateGroups(
                                draft.groupBy.map((g, j) =>
                                  i === j ? e.target.value : g,
                                ),
                              )
                            }
                          >
                            {ds.dimensions
                              .filter(
                                (d) =>
                                  d.key === key ||
                                  !draft.groupBy.includes(d.key),
                              )
                              .map((d) => (
                                <option key={d.key} value={d.key}>
                                  {d.label}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={"Remove grouping " + (i + 1)}
                            disabled={draft.groupBy.length === 1}
                            onClick={() =>
                              updateGroups(
                                draft.groupBy.filter((_, j) => j !== i),
                              )
                            }
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </label>
                    ))}
                    {draft.groupBy.length < 2 && (
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() =>
                          updateGroups([
                            ...draft.groupBy,
                            ds.dimensions.find(
                              (d) => !draft.groupBy.includes(d.key),
                            )!.key,
                          ])
                        }
                      >
                        <Plus size={17} /> Add second grouping
                      </button>
                    )}
                  </div>
                )}
              </section>
              <section className="business-panel builder-section">
                <div className="builder-section-heading">
                  <div>
                    <span className="eyebrow">STEP 3</span>
                    <h3>Select measures</h3>
                    <p>
                      Choose up to four totals. Summaries calculate these over
                      all matching records.
                    </p>
                  </div>
                </div>
                <div className="builder-measures">
                  {ds.metrics.map((m) => (
                    <label className="builder-measure" key={m.key}>
                      <input
                        type="checkbox"
                        checked={draft.metrics.includes(m.key)}
                        disabled={
                          draft.metrics.includes(m.key)
                            ? draft.metrics.length === 1
                            : draft.metrics.length >= 4
                        }
                        onChange={() => toggleMetric(m.key)}
                      />
                      <span>
                        <strong>{m.label}</strong>
                        {m.description && <small>{m.description}</small>}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <section className="business-panel builder-section">
              <div className="builder-section-heading">
                <div>
                  <span className="eyebrow">STEP 4</span>
                  <h3>Filter the records</h3>
                  <p>
                    Conditions apply to individual records before totals and
                    groups are calculated.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-outline"
                  disabled={draft.filters.length >= 8}
                  onClick={() =>
                    setDefinition({
                      ...draft,
                      filters: [
                        ...draft.filters,
                        {
                          field: ds.fields[0].key,
                          op: ds.fields[0].type === "text" ? "contains" : "is",
                          value: "",
                        },
                      ],
                    })
                  }
                >
                  <Plus size={17} /> Add condition
                </button>
              </div>
              {draft.filters.length > 1 && (
                <label className="field builder-match">
                  Match
                  <select
                    value={draft.match}
                    onChange={(e) =>
                      setDefinition({
                        ...draft,
                        match: e.target.value as "all" | "any",
                      })
                    }
                  >
                    <option value="all">All conditions</option>
                    <option value="any">Any condition</option>
                  </select>
                </label>
              )}
              <div className="builder-filters">
                {draft.filters.map((filter, i) => {
                  const f = ds.fields.find((f) => f.key === filter.field)!,
                    empty = ["empty", "not_empty"].includes(filter.op);
                  return (
                    <div className="builder-filter" key={i}>
                      <label className="field">
                        Field {i + 1}
                        <select
                          value={filter.field}
                          onChange={(e) => {
                            const next = ds.fields.find(
                              (f) => f.key === e.target.value,
                            )!;
                            updateFilter(i, {
                              field: next.key,
                              op: next.type === "text" ? "contains" : "is",
                              value: "",
                              to: undefined,
                            });
                          }}
                        >
                          {ds.fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Condition
                        <select
                          value={filter.op}
                          onChange={(e) =>
                            updateFilter(i, { op: e.target.value })
                          }
                        >
                          {operations(f.type).map(([k, v]) => (
                            <option value={k} key={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!empty && (
                        <label className="field">
                          {filter.op === "between"
                            ? "Minimum / from"
                            : f.type === "money"
                              ? "Value (USD)"
                              : f.type === "timestamp"
                                ? "Review date (UTC+8)"
                                : "Value"}
                          {f.values && ["is", "is_not"].includes(filter.op) ? (
                            <select
                              value={filter.value}
                              onChange={(e) =>
                                updateFilter(i, { value: e.target.value })
                              }
                            >
                              <option value="">Choose a value</option>
                              {Object.entries(f.values).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={
                                ["date", "timestamp"].includes(f.type)
                                  ? "date"
                                  : ["money", "number"].includes(f.type)
                                    ? "number"
                                    : "text"
                              }
                              min={
                                ["money", "number"].includes(f.type)
                                  ? "0"
                                  : undefined
                              }
                              step={
                                ["money", "number"].includes(f.type)
                                  ? "0.01"
                                  : undefined
                              }
                              maxLength={200}
                              value={filter.value}
                              onChange={(e) =>
                                updateFilter(i, { value: e.target.value })
                              }
                            />
                          )}
                        </label>
                      )}
                      {filter.op === "between" && (
                        <label className="field">
                          Maximum / through
                          <input
                            type={
                              ["date", "timestamp"].includes(f.type)
                                ? "date"
                                : "number"
                            }
                            min={filter.value || undefined}
                            step="0.01"
                            value={filter.to || ""}
                            onChange={(e) =>
                              updateFilter(i, { to: e.target.value })
                            }
                          />
                        </label>
                      )}
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={"Remove condition " + (i + 1)}
                        onClick={() =>
                          setDefinition({
                            ...draft,
                            filters: draft.filters.filter((_, j) => j !== i),
                          })
                        }
                      >
                        <X size={20} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {draft.filters.length === 0 && (
                <p className="builder-no-filter">
                  All permitted records in the selected period are included.
                </p>
              )}
            </section>
            <section className="business-panel builder-section">
              <div className="builder-section-heading">
                <div>
                  <span className="eyebrow">STEP 5</span>
                  <h3>Presentation and order</h3>
                </div>
              </div>
              <div className="builder-fields-grid">
                <label className="field">
                  Display
                  <select
                    value={draft.display}
                    onChange={(e) =>
                      setDefinition({
                        ...draft,
                        display: e.target.value as BuilderDefinition["display"],
                      })
                    }
                  >
                    <option value="table">Table</option>
                    <option
                      value="bar"
                      disabled={
                        draft.mode !== "summary" || draft.groupBy.length !== 1
                      }
                    >
                      Bar chart and table
                    </option>
                    <option value="line" disabled={!lineAvailable}>
                      Trend line and table
                    </option>
                  </select>
                  <small>
                    Charts use one grouping. Trend lines require a time
                    grouping.
                  </small>
                </label>
                {draft.display !== "table" && (
                  <label className="field">
                    Chart measure
                    <select
                      value={draft.chartMetric}
                      onChange={(e) =>
                        setDefinition({ ...draft, chartMetric: e.target.value })
                      }
                    >
                      {draft.metrics.map((key) => (
                        <option value={key} key={key}>
                          {ds.metrics.find((m) => m.key === key)?.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  Sort by
                  <select
                    value={draft.sort.key}
                    onChange={(e) =>
                      setDefinition({
                        ...draft,
                        sort: { ...draft.sort, key: e.target.value },
                      })
                    }
                  >
                    {sorts.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Direction
                  <select
                    value={draft.sort.direction}
                    onChange={(e) =>
                      setDefinition({
                        ...draft,
                        sort: {
                          ...draft.sort,
                          direction: e.target.value as "asc" | "desc",
                        },
                      })
                    }
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </label>
              </div>
            </section>
          </fieldset>
          <div className="builder-run">
            <button
              className="button button-dark"
              disabled={busy || saving}
              onClick={() => run(draft)}
            >
              <Play size={18} />
              {busy ? "Querying records…" : "Preview report"}
            </button>
            <button
              className="button button-outline"
              disabled={busy || saving}
              onClick={() => beginSave()}
            >
              <Save size={18} />
              {current && !parent ? "Save changes" : "Save report"}
            </button>
            {current && !parent && (
              <button
                className="button button-outline"
                disabled={busy || saving}
                onClick={() => beginSave(true)}
              >
                <Copy size={17} /> Save a copy
              </button>
            )}
            <span>
              Templates save settings. Financial and service records remain
              governed by their own workflows.
            </span>
          </div>
          {result && (
            <section
              className={"builder-preview " + (stale ? "is-stale" : "")}
              aria-busy={busy}
            >
              <div className="builder-preview-heading">
                <div>
                  <span className="eyebrow">LIVE QUERY RESULT</span>
                  <h3 ref={resultHeading} tabIndex={-1}>
                    Report preview
                  </h3>
                  <p>
                    {dateText(result.period.start)} –{" "}
                    {dateText(result.period.end)} · {result.matching_records}{" "}
                    matching source records
                  </p>
                  <small>
                    {result.scope} · Queried {timeText(result.computed_at)}
                  </small>
                </div>
                <button
                  className="button button-outline"
                  disabled={busy || stale || exporting || result.total === 0}
                  onClick={download}
                >
                  <Download size={18} />
                  {exporting ? "Exporting…" : "Export all matches"}
                </button>
              </div>
              {stale && (
                <p className="builder-stale" role="status">
                  Settings changed. Preview again to apply them; the results
                  below show the previous settings.
                </p>
              )}
              <div className="business-metrics builder-total-cards">
                {result.totals.map((m) => (
                  <article className="business-metric" key={m.key}>
                    <span>{m.label}</span>
                    <strong>{fmt(m.value, m.type)}</strong>
                    <small>
                      {m.previous === null
                        ? "Whole selected period"
                        : `Previous period: ${fmt(m.previous, m.type)}`}
                    </small>
                  </article>
                ))}
              </div>
              {result.period.previous_start &&
                !result.definition.drill.length && (
                  <p className="report-definition">
                    Comparison: {dateText(result.period.previous_start)} –{" "}
                    {dateText(result.period.previous_end!)}.{" "}
                    {result.period.comparison_basis}.
                  </p>
                )}
              <p className="builder-grain">
                {result.grain} Totals are calculated independently across all
                matching records. Distinct counts can overlap between groups; do
                not add them to obtain the overall count.
              </p>
              {result.definition.display !== "table" && (
                <BuilderChart
                  result={result}
                  ds={resultDataset}
                  onDrill={drill}
                  disabled={busy || stale}
                />
              )}
              <div className="business-panel builder-result-table">
                <div className="builder-section-heading">
                  <div>
                    <h4>
                      {result.definition.mode === "summary"
                        ? "Grouped results"
                        : "Detailed records"}
                    </h4>
                    <p>
                      {result.total}{" "}
                      {result.definition.mode === "summary" ? "groups" : "rows"}{" "}
                      ·{" "}
                      {result.total
                        ? Math.min((result.page - 1) * 25 + 1, result.total)
                        : 0}
                      –{Math.min(result.page * 25, result.total)} shown
                    </p>
                  </div>
                </div>
                <div className="business-table-wrap">
                  <table className="business-table">
                    <caption className="sr-only">Custom report preview</caption>
                    <thead>
                      <tr>
                        {result.columns.map((c) => (
                          <th key={c.key} scope="col">
                            {c.label}
                          </th>
                        ))}
                        <th scope="col">Explore</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr
                          key={String(
                            row.__id || JSON.stringify(row.__drill) || i,
                          )}
                        >
                          {result.columns.map((c) => (
                            <td key={c.key}>
                              {fmt(
                                row[c.key],
                                c.type ||
                                  resultDataset.fields.find(
                                    (f) => f.key === c.key,
                                  )?.type,
                                resultDataset,
                                c.key,
                              )}
                            </td>
                          ))}
                          <td>
                            <button
                              className="business-detail-button"
                              disabled={busy || stale}
                              onClick={() =>
                                result.definition.mode === "summary"
                                  ? drill(row)
                                  : setRecord(row)
                              }
                            >
                              {result.definition.mode === "summary"
                                ? "View records"
                                : "View details"}{" "}
                              <ArrowRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!result.rows.length && (
                  <p className="report-empty">
                    No matching records. Adjust the dates or conditions and
                    preview again.
                  </p>
                )}
                <div className="report-pagination">
                  <button
                    className="button button-outline"
                    disabled={busy || stale || result.page <= 1}
                    onClick={() => run(result.definition, result.page - 1)}
                  >
                    <ArrowLeft size={17} /> Previous
                  </button>
                  <span>
                    Page {result.page} of{" "}
                    {Math.max(1, Math.ceil(result.total / 25))}
                  </span>
                  <button
                    className="button button-outline"
                    disabled={busy || stale || result.page * 25 >= result.total}
                    onClick={() => run(result.definition, result.page + 1)}
                  >
                    Next <ArrowRight size={17} />
                  </button>
                </div>
                <p className="report-definition">
                  Export uses the selected column order and all matching rows,
                  up to 20,000 per file. Money is exported in USD units.
                </p>
              </div>
            </section>
          )}
          {!result && (
            <div className="builder-empty">
              <Settings2 size={30} />
              <h3>Build the view you need.</h3>
              <p>
                Choose fields and measures, then preview live records. You can
                also start from a foundation template.
              </p>
            </div>
          )}
        </>
      )}
      {saveDialog && (
        <BusinessModal
          title={saveDialog.expected ? "Save report changes" : "Save a report"}
          onClose={() => {
            if (!saving) setSaveDialog(null);
          }}
        >
          <form onSubmit={save}>
            <fieldset disabled={saving}>
              <label className="field">
                Report name
                <input
                  autoFocus
                  required
                  minLength={1}
                  maxLength={120}
                  value={saveDialog.name}
                  onChange={(e) =>
                    setSaveDialog({ ...saveDialog, name: e.target.value })
                  }
                  placeholder="e.g. Monthly transport spending"
                />
              </label>
              <label className="field">
                Description (optional)
                <textarea
                  maxLength={500}
                  value={saveDialog.description}
                  onChange={(e) =>
                    setSaveDialog({
                      ...saveDialog,
                      description: e.target.value,
                    })
                  }
                />
              </label>
              <p className="report-definition">
                Saved privately to {user.name}'s account. Each preview rechecks
                permissions and queries current records.
              </p>
              {saveError && (
                <p className="form-error" role="alert">
                  {saveError}
                </p>
              )}
              <button className="button button-dark" disabled={saving}>
                {saving ? "Saving…" : "Save report"} <Save size={18} />
              </button>
            </fieldset>
          </form>
        </BusinessModal>
      )}
      {record && result && (
        <BusinessModal title="Selected record" onClose={() => setRecord(null)}>
          <dl className="report-record-details">
            {result.columns.map((c) => (
              <div key={c.key}>
                <dt>{c.label}</dt>
                <dd>
                  {fmt(
                    record[c.key],
                    c.type ||
                      resultDataset.fields.find((f) => f.key === c.key)?.type,
                    resultDataset,
                    c.key,
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {typeof record.__trace_source === "string" && (
            <button
              className="button button-dark"
              onClick={() => {
                setTrace(record.__trace_source as string);
                setRecord(null);
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
    </div>
  );
}
function BuilderChart({
  result,
  ds,
  onDrill,
  disabled,
}: {
  result: BuilderResult;
  ds: BuilderDataset;
  onDrill: (row: BuilderRow) => void;
  disabled: boolean;
}) {
  const c = result.definition,
    rows = result.chart.rows,
    dimension = "g_" + c.groupBy[0],
    metric = "m_" + c.chartMetric,
    m = ds.metrics.find((m) => m.key === c.chartMetric)!,
    max = Math.max(1, ...rows.map((r) => Number(r[metric])));
  const label = (r: BuilderRow) =>
    fmt(
      r[dimension],
      result.columns.find((c) => c.key === dimension)?.type,
      ds,
      dimension,
    );
  const points = rows
    .map(
      (r, i) =>
        `${45 + (rows.length <= 1 ? 0 : i / (rows.length - 1)) * 600},${215 - (Number(r[metric]) / max) * 170}`,
    )
    .join(" ");
  return (
    <section className="business-panel builder-chart">
      <div className="builder-section-heading">
        <div>
          <h4>{m.label}</h4>
          <p>
            By{" "}
            {ds.dimensions
              .find((d) => d.key === c.groupBy[0])
              ?.label.toLowerCase()}
            .{" "}
            {result.chart.total > 50
              ? "First 50 matching groups are shown; use the table or export for the full result."
              : "Click a bar or use the table to open matching records."}
            {c.display === "line"
              ? " Time intervals without matching activity are shown as zero."
              : ""}
          </p>
        </div>
      </div>
      {!rows.length ? (
        <p className="report-empty">No chart data for these filters.</p>
      ) : c.display === "line" ? (
        <div className="builder-line-wrap">
          <svg
            viewBox="0 0 690 270"
            role="img"
            aria-label={
              m.label +
              " over time: " +
              rows
                .map((r) => label(r) + " " + fmt(r[metric], m.type))
                .join("; ")
            }
          >
            <line x1="45" y1="215" x2="645" y2="215" stroke="#ccd5c3" />
            <text x="42" y="26" fill="#66735c" fontSize="14">
              {fmt(max, m.type)}
            </text>
            <polyline
              points={points}
              fill="none"
              stroke="#6f875b"
              strokeWidth="3"
            />
            {rows.map((r, i) => (
              <circle
                key={i}
                cx={45 + (rows.length <= 1 ? 0 : i / (rows.length - 1)) * 600}
                cy={215 - (Number(r[metric]) / max) * 170}
                r="4"
                fill="#304c38"
              >
                <title>{label(r) + ": " + fmt(r[metric], m.type)}</title>
              </circle>
            ))}
            {rows
              .filter(
                (_, i) =>
                  i === 0 ||
                  i === rows.length - 1 ||
                  i % Math.max(1, Math.ceil(rows.length / 5)) === 0,
              )
              .map((r) => {
                const i = rows.indexOf(r);
                return (
                  <text
                    key={i}
                    x={
                      45 + (rows.length <= 1 ? 0 : i / (rows.length - 1)) * 600
                    }
                    y="248"
                    textAnchor={
                      i === 0
                        ? "start"
                        : i === rows.length - 1
                          ? "end"
                          : "middle"
                    }
                    fill="#66735c"
                    fontSize="13"
                  >
                    {label(r)}
                  </text>
                );
              })}
          </svg>
        </div>
      ) : (
        <div className="builder-bar-chart">
          {rows.map((r, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onDrill(r)}
              aria-label={"View records for " + label(r)}
            >
              <span>{label(r)}</span>
              <div>
                <i style={{ width: `${(Number(r[metric]) / max) * 100}%` }} />
              </div>
              <strong>{fmt(r[metric], m.type)}</strong>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
