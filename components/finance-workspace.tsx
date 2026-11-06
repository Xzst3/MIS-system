"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileCheck2,
  RefreshCw,
  Heart,
  Plus,
  Search,
  ShieldCheck,
  Wallet,
  Waypoints,
} from "lucide-react";
import type { User } from "@/lib/types";
import type {
  FinanceData,
  FinanceKind,
  FinanceRequest,
} from "@/lib/finance-types";
import { financeLabels } from "@/lib/finance-types";
import {
  BusinessModal,
  LoadState,
  Status,
  Empty,
  dollars,
  dateText,
  timeText,
  today,
  send,
  useRemote,
} from "./business-ui";
const allKinds = Object.keys(financeLabels) as FinanceKind[];
export function FinanceWorkspace({
  user,
  transparent = false,
}: {
  user: User;
  transparent?: boolean;
}) {
  const remote = useRemote<FinanceData>("/api/finance");
  const params = useSearchParams();
  const { data } = remote;
  const [tab, setTab] = useState(transparent ? "trace" : "funds");
  const [form, setForm] = useState(false);
  const [selected, setSelected] = useState<FinanceRequest | null>(null);
  const [trace, setTrace] = useState("");
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [requestKind, setRequestKind] = useState<FinanceKind>(
    user.role === "coordinator" ? "expense" : "cash_donation",
  );
  const [clientReference, setClientReference] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [rules, setRules] = useState(false);
  useEffect(() => {
    const target = params.get("tab");
    if (
      target &&
      ["funds", "approvals", "transactions", "inventory", "trace"].includes(
        target,
      )
    )
      setTab(target);
    const name = params.get("person");
    if (name) {
      setQuery(name);
      setTab("transactions");
    }
  }, [params]);
  const canReview = ["admin", "finance"].includes(user.role);
  async function review(
    event: React.FormEvent<HTMLFormElement>,
    decision: "approve" | "reject",
  ) {
    event.preventDefault();
    if (!selected) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setDialogError("");
    try {
      await send("/api/finance", {
        action: "review",
        id: selected.id,
        decision,
        note: fields.get("note") || "",
      });
      setSelected(null);
      setMessage(
        decision === "approve"
          ? "Approved and posted. Fund balances and trace records are updated."
          : "Request rejected. No fund balance was changed.",
      );
      await remote.refresh();
    } catch (e) {
      setDialogError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const body = Object.fromEntries(fields);
    setBusy(true);
    setDialogError("");
    try {
      await send("/api/finance", {
        ...body,
        action: "submit",
        kind: requestKind,
        client_reference: clientReference,
        amount: body.amount || "0",
        to_fund_id: body.to_fund_id || null,
        person_id: body.person_id || null,
        service_id: body.service_id || null,
        item_id: body.item_id || null,
        quantity: body.quantity ? Number(body.quantity) : null,
        settlement_confirmed: fields.get("settlement_confirmed") === "on",
      });
      setForm(false);
      setMessage(
        "Request submitted for independent review. It has not changed the posted balance.",
      );
      await remote.refresh();
    } catch (e) {
      setDialogError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <LoadState
        error={remote.error}
        loading={remote.loading}
        onRetry={remote.refresh}
      />
    );
  const posted = data.requests.filter((r) => r.status === "Posted");
  const pending = data.requests.filter((r) => r.status === "Submitted");
  const received = data.funds.reduce((n, f) => n + f.received_cents, 0);
  const balance = data.funds.reduce((n, f) => n + f.balance_cents, 0);
  const expenses = data.funds.reduce((n, f) => n + f.spent_cents, 0);
  const eligibleKinds =
    user.role === "coordinator"
      ? (["expense", "distribution"] as FinanceKind[])
      : user.role === "fundraising"
        ? (["cash_donation", "in_kind"] as FinanceKind[])
        : allKinds;
  const rows = data.requests.filter(
    (r) =>
      (!itemFilter ||
        tab !== "transactions" ||
        r.id === itemFilter ||
        r.item_id === itemFilter) &&
      (!filter || r.status === filter) &&
      (!query ||
        (
          r.reference +
          " " +
          r.description +
          " " +
          r.person_name +
          " " +
          r.fund_name
        )
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (tab !== "approvals" || r.status === "Submitted"),
  );
  const gifts = posted.filter((r) =>
    ["cash_donation", "asset_sale"].includes(r.kind),
  );
  const gift = gifts.find((r) => r.id === trace) || gifts[0];
  const path = gift ? data.postings.filter((p) => p.lot_id === gift.id) : [];
  function exportRows() {
    if (!data) return;
    const headers = [
      "Reference",
      "Type",
      "Date",
      "Fund",
      "Destination",
      "Amount USD",
      "Status",
      "External reference",
      "Submitted by",
      "Reviewed by",
      "Review note",
    ];
    const safe = (v: unknown) => {
      let value = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(value)) value = "'" + value;
      return '"' + value.replaceAll('"', '""') + '"';
    };
    const csv = [
      headers,
      ...data.requests.map((r) => [
        r.reference,
        financeLabels[r.kind],
        r.event_date.slice(0, 10),
        r.fund_name,
        r.target_fund,
        (r.amount_cents / 100).toFixed(2),
        r.status,
        r.external_reference,
        r.submitter,
        r.reviewer,
        r.review_note,
      ]),
    ]
      .map((row) => row.map(safe).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ecf-financial-records.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="finance-workspace">
      <LoadState
        error={remote.error}
        loading={false}
        onRetry={remote.refresh}
      />
      {message && (
        <div className="business-success" role="status">
          <CheckCircle2 size={20} />
          {message}
        </div>
      )}
      <div className="business-toolbar">
        <p>
          {data.scope === "own"
            ? "Your requests are shown below. Finance officers review expenditure and fund availability."
            : "Every posted amount connects to an independently reviewed source record."}
        </p>
        <div>
          {user.role === "admin" && (
            <button
              className="button button-outline"
              onClick={() => {
                setDialogError("");
                setRules(true);
              }}
            >
              <ShieldCheck size={17} />
              Approval rules
            </button>
          )}
          <button className="button button-outline" onClick={exportRows}>
            <Download size={17} /> Export
          </button>
          <button
            className="button button-outline"
            disabled={remote.loading}
            onClick={remote.refresh}
          >
            <RefreshCw size={17} />
            Refresh
          </button>
          <button
            className="button button-dark"
            onClick={() => {
              setRequestKind(eligibleKinds[0]);
              setClientReference(crypto.randomUUID());
              setDialogError("");
              setForm(true);
            }}
          >
            <Plus size={18} /> New request
          </button>
        </div>
      </div>
      {data.scope !== "own" && (
        <div className="business-metrics">
          <Metric
            label="Posted contributions"
            value={dollars(received)}
            note="Cash and asset-sale proceeds"
            icon={<Heart />}
          />
          <Metric
            label="Available funds"
            value={dollars(balance)}
            note="After allocations and expenditure"
            icon={<Wallet />}
          />
          <Metric
            label={`${data.year} expenditure`}
            value={dollars(expenses)}
            note="Posted expenses only"
            icon={<Waypoints />}
          />
          <Metric
            label="Awaiting review"
            value={String(pending.length)}
            note="Excluded from posted balances"
            icon={<FileCheck2 />}
          />
        </div>
      )}
      <div
        className="business-tabs"
        role="tablist"
        aria-label="Finance sections"
      >
        {[
          ["funds", "Funds & budgets"],
          ["approvals", "Approval queue"],
          ["transactions", "Transactions"],
          ["inventory", "Inventory"],
          ...(data.scope !== "own" ? [["trace", "Trace a gift"]] : []),
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
            {value === "approvals" && pending.length > 0 && (
              <span>{pending.length}</span>
            )}
          </button>
        ))}
      </div>
      {tab === "funds" ? (
        <>
          <div className="business-section-intro">
            <h2>Where the resources go.</h2>
            <p>
              Contributions + allocations in − allocations out − all posted
              expenses = available balance. Budget use below covers {data.year}.
            </p>
          </div>
          <div className="fund-grid">
            {data.funds.map((f) => (
              <article className="fund-card" key={f.id}>
                <div>
                  <span className="eyebrow">
                    {f.program_id ? "DESIGNATED PURPOSE" : "UNRESTRICTED"}
                  </span>
                  <h3>{f.name}</h3>
                </div>
                <strong className="fund-balance">
                  {dollars(f.balance_cents)}
                </strong>
                <span className="field-hint">Available</span>
                <div className="fund-reconciliation">
                  <span>
                    Contributions <b>{dollars(f.received_cents)}</b>
                  </span>
                  <span>
                    Allocated in <b>{dollars(f.allocated_in_cents)}</b>
                  </span>
                  <span>
                    Allocated out <b>−{dollars(f.allocated_out_cents)}</b>
                  </span>
                  <span>
                    Posted expenses <b>−{dollars(f.total_spent_cents)}</b>
                  </span>
                </div>
                <div className="fund-budget">
                  <span>
                    {data.year} spent <b>{dollars(f.spent_cents)}</b>
                  </span>
                  <div className="business-progress">
                    <i
                      style={{
                        width:
                          Math.min(
                            100,
                            f.budget_cents
                              ? (f.spent_cents / f.budget_cents) * 100
                              : 0,
                          ) + "%",
                      }}
                    />
                  </div>
                  <small>
                    {f.budget_cents
                      ? `${dollars(f.budget_cents)} approved annual budget`
                      : "No approved annual budget"}
                  </small>
                </div>
                <p className="fund-restriction">
                  {f.restriction ||
                    "Allocate to a service or operations fund before expenditure."}
                </p>
                <button
                  className="text-link"
                  onClick={() => {
                    setQuery(f.name);
                    setFilter("Posted");
                    setTab("transactions");
                  }}
                >
                  View underlying transactions <ArrowUpRight size={16} />
                </button>
              </article>
            ))}
          </div>
        </>
      ) : tab === "transactions" || tab === "approvals" ? (
        <>
          {tab === "transactions" && itemFilter && (
            <div className="business-info">
              History for {data.items.find((i) => i.id === itemFilter)?.name}.{" "}
              <button className="text-link" onClick={() => setItemFilter("")}>
                Show all transactions
              </button>
            </div>
          )}
          <div className="business-filters">
            <label className="business-search">
              <Search size={19} />
              <input
                aria-label="Search financial records"
                placeholder="Search reference, donor, fund or description"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {tab === "transactions" && (
              <select
                aria-label="Financial status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {["Submitted", "Posted", "Rejected"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
          </div>
          {tab === "approvals" && (
            <div className="business-info">
              <ShieldCheck size={21} />
              <span>
                {canReview
                  ? `Review evidence, designation and budget before posting. You cannot approve your own request. Finance officer authority: ${dollars(data.officer_limit_cents)}; larger amounts require an administrator.`
                  : "Requests stay here until another authorized team member reviews them."}
              </span>
            </div>
          )}
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Reference / type</th>
                  <th>Purpose</th>
                  <th>Amount / quantity</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.reference}</strong>
                      <small>
                        {financeLabels[r.kind]} · {dateText(r.event_date)}
                      </small>
                    </td>
                    <td>
                      <strong>
                        {r.person_name || r.beneficiary || r.submitter}
                      </strong>
                      <small>
                        {r.fund_name}
                        {r.target_fund ? " → " + r.target_fund : ""}
                      </small>
                    </td>
                    <td>
                      <strong>
                        {r.kind === "distribution"
                          ? `${r.quantity} item(s)`
                          : dollars(r.amount_cents)}
                      </strong>
                      {r.kind === "in_kind" && (
                        <small>
                          {r.quantity} · {r.item_name}
                          <br />
                          Estimated value, not cash
                        </small>
                      )}
                    </td>
                    <td>
                      <Status value={r.status} />
                    </td>
                    <td>
                      <button
                        className="business-detail-button"
                        onClick={() => {
                          setDialogError("");
                          setSelected(r);
                        }}
                        aria-label={"View " + r.reference}
                      >
                        View <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty>No matching requests.</Empty>}
          </div>
          <p className="field-hint">
            {rows.length} records shown. Submitted requests do not change the
            ledger; approval and posting happen together.
          </p>
        </>
      ) : tab === "inventory" ? (
        <>
          <div className="business-section-intro">
            <h2>Physical gifts, with a history.</h2>
            <p>
              Approved receipts add stock. Approved distributions and asset
              sales reduce it. Estimated values are kept separate from cash.
            </p>
          </div>
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Item / asset</th>
                  <th>Source</th>
                  <th>Available quantity</th>
                  <th>Estimated receipt value</th>
                  <th>History</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>
                        {data.funds.find((f) => f.id === item.fund_id)?.name}
                      </small>
                    </td>
                    <td>{item.donor}</td>
                    <td>{item.quantity}</td>
                    <td>{dollars(item.estimated_value_cents)}</td>
                    <td>
                      <button
                        className="business-detail-button"
                        onClick={() => {
                          setQuery("");
                          setItemFilter(item.id);
                          setFilter("");
                          setTab("transactions");
                        }}
                      >
                        View transactions <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && (
              <Empty>No posted inventory receipts yet.</Empty>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="business-section-intro">
            <h2>From a gift to a next step.</h2>
            <p>
              Follow the original contribution through fund transfers and
              expenditure. Shared operational costs retain their purpose without
              inventing a beneficiary.
            </p>
          </div>
          <label className="field trace-gift-select">
            Choose a posted contribution
            <select
              value={gift?.id || ""}
              onChange={(e) => setTrace(e.target.value)}
            >
              {gifts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.person_name ||
                    data.postings.find((p) => p.lot_id === r.id)?.donor}{" "}
                  · {r.reference} · {dollars(r.amount_cents)}
                </option>
              ))}
            </select>
          </label>
          {gift ? (
            <>
              <div className="trace-origin">
                <Heart size={30} />
                <div>
                  <span className="eyebrow">ORIGINAL CONTRIBUTION</span>
                  <h3>{gift.person_name || path[0]?.donor}</h3>
                  <p>
                    {gift.reference} · {dollars(gift.amount_cents)} ·{" "}
                    {gift.fund_name}
                  </p>
                </div>
                <Status value={gift.status} />
              </div>
              <div className="business-table-wrap">
                <table className="business-table">
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Fund</th>
                      <th>Movement</th>
                      <th>Service / beneficiary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {path
                      .slice()
                      .reverse()
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <button
                              className="business-detail-button"
                              onClick={() => {
                                const r = data.requests.find(
                                  (r) => r.id === p.request_id,
                                );
                                if (r) setSelected(r);
                              }}
                            >
                              {p.request_reference}
                              <ArrowUpRight size={15} />
                            </button>
                            <small>
                              {financeLabels[p.kind as FinanceKind]}
                            </small>
                          </td>
                          <td>{p.fund_name}</td>
                          <td
                            className={
                              p.delta_cents < 0 ? "negative" : "positive"
                            }
                          >
                            {p.delta_cents > 0 ? "+" : ""}
                            {dollars(p.delta_cents)}
                          </td>
                          <td>
                            {p.service_title ||
                              (p.kind === "expense"
                                ? "Shared / operational support"
                                : "Fund movement")}
                            <small>
                              {p.beneficiary ||
                                "Purpose recorded at fund level"}
                            </small>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="business-info">
                <Waypoints size={21} />
                <span>
                  Remaining from this contribution:{" "}
                  <strong>
                    {dollars(path.reduce((n, p) => n + p.delta_cents, 0))}
                  </strong>
                  . Transfers conserve the amount; only expenses consume it. The
                  oldest posted contribution available on the transaction date
                  is used first, with its original donor reference retained.
                  In-kind stock and distributions remain separately traceable in
                  inventory.
                </span>
              </div>
            </>
          ) : (
            <Empty>
              A posted contribution will appear here after independent approval.
            </Empty>
          )}
        </>
      )}
      {rules && (
        <BusinessModal
          title="Approval authority"
          onClose={() => {
            if (!busy) setRules(false);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fields = new FormData(e.currentTarget);
              setBusy(true);
              setDialogError("");
              try {
                await send("/api/finance", {
                  action: "policy",
                  limit: fields.get("limit"),
                });
                setRules(false);
                setMessage(
                  "Approval authority updated and recorded in the audit history.",
                );
                await remote.refresh();
              } catch (error) {
                setDialogError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="business-info">
              Finance officers can review requests up to this amount. Larger
              requests require an administrator. Nobody can approve their own
              request.
            </p>
            <label className="field">
              Finance officer limit (USD)
              <input
                name="limit"
                type="number"
                min="0.01"
                max="100000000"
                step="0.01"
                required
                defaultValue={(data.officer_limit_cents / 100).toFixed(2)}
              />
            </label>
            {dialogError && (
              <div className="form-error" role="alert">
                {dialogError}
              </div>
            )}
            <button className="button button-dark" disabled={busy}>
              Save authority <CheckCircle2 size={18} />
            </button>
          </form>
        </BusinessModal>
      )}
      {form && (
        <BusinessModal
          title="New financial request"
          onClose={() => {
            if (!busy) setForm(false);
          }}
        >
          <form onSubmit={create}>
            <fieldset disabled={busy}>
              <div className="business-form-grid">
                <label className="field">
                  Transaction type
                  <select
                    value={requestKind}
                    onChange={(e) => {
                      setRequestKind(e.target.value as FinanceKind);
                      setClientReference(crypto.randomUUID());
                    }}
                  >
                    {eligibleKinds.map((k) => (
                      <option value={k} key={k}>
                        {financeLabels[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Date
                  <input
                    type="date"
                    name="event_date"
                    required
                    defaultValue={today()}
                    max={today()}
                  />
                </label>
                <label className="field">
                  {requestKind === "allocation"
                    ? "Source fund"
                    : "Designation / fund"}
                  <select name="fund_id" required>
                    {data.funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                {requestKind === "allocation" && (
                  <label className="field">
                    Destination fund
                    <select name="to_fund_id" required>
                      <option value="">Choose a destination</option>
                      {data.funds
                        .filter((f) => f.code !== "general")
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {requestKind !== "distribution" && (
                  <label className="field">
                    {requestKind === "in_kind"
                      ? "Estimated total value (USD)"
                      : requestKind === "budget"
                        ? "Annual budget limit (USD)"
                        : "Amount (USD)"}
                    <input
                      name="amount"
                      type="number"
                      min={requestKind === "in_kind" ? "0" : "0.01"}
                      step="0.01"
                      max="100000000"
                      required
                    />
                  </label>
                )}
                {["cash_donation", "in_kind"].includes(requestKind) && (
                  <label className="field">
                    Donor
                    <select name="person_id" required>
                      <option value="">Choose a donor profile</option>
                      {data.people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <span className="field-hint">
                      Add or link a donor in People & engagements.
                    </span>
                  </label>
                )}
                {requestKind === "in_kind" && (
                  <label className="field">
                    Item / asset name
                    <input
                      name="item_name"
                      minLength={2}
                      maxLength={150}
                      required
                    />
                  </label>
                )}
                {["distribution", "asset_sale"].includes(requestKind) && (
                  <label className="field">
                    Inventory item
                    <select name="item_id" required>
                      <option value="">Choose available stock</option>
                      {data.items
                        .filter((i) => i.quantity > 0)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} · {i.quantity} available
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {["in_kind", "distribution", "asset_sale"].includes(
                  requestKind,
                ) && (
                  <label className="field">
                    Quantity
                    <input
                      name="quantity"
                      type="number"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      required
                    />
                  </label>
                )}
                {["expense", "distribution"].includes(requestKind) && (
                  <label className="field">
                    Beneficiary service{" "}
                    {requestKind === "expense"
                      ? "(optional for shared costs)"
                      : ""}
                    <select
                      name="service_id"
                      required={requestKind === "distribution"}
                    >
                      <option value="">
                        {requestKind === "expense"
                          ? "Shared / operational cost"
                          : "Choose a receiving service"}
                      </option>
                      {data.services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.beneficiary} · {s.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {["cash_donation", "asset_sale", "expense"].includes(
                  requestKind,
                ) && (
                  <label className="field">
                    {requestKind === "expense"
                      ? "Invoice / expense reference"
                      : "Bank / provider reference"}
                    <input name="external_reference" required maxLength={150} />
                  </label>
                )}
              </div>
              <label className="field">
                Purpose, payee and supporting evidence
                <textarea
                  name="description"
                  required
                  minLength={5}
                  maxLength={1000}
                  placeholder="Explain the source or destination, supporting document reference and why this is needed."
                />
              </label>
              {["cash_donation", "asset_sale"].includes(requestKind) && (
                <label className="check-field">
                  <input name="settlement_confirmed" type="checkbox" />
                  <span>
                    I checked the receipt against bank or provider evidence.
                    Unconfirmed receipts cannot be posted.
                  </span>
                </label>
              )}
              <div className="business-info">
                {requestKind === "budget"
                  ? "The date selects the fiscal year. This replaces that fund’s annual limit after independent approval."
                  : "This submits a request. Another authorized employee must review it before it changes balances or stock."}
              </div>
              {dialogError && (
                <div className="form-error" role="alert">
                  {dialogError}
                </div>
              )}
              <button className="button button-dark" disabled={busy}>
                {busy ? "Submitting…" : "Submit for review"}
                <ArrowRight size={18} />
              </button>
            </fieldset>
          </form>
        </BusinessModal>
      )}
      {selected && (
        <BusinessModal
          title={selected.reference}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          <div className="transaction-summary">
            <Status value={selected.status} />
            <h3>
              {financeLabels[selected.kind]} · {dollars(selected.amount_cents)}
            </h3>
            <p>{selected.description}</p>
          </div>
          <dl className="business-definition">
            <dt>Transaction date</dt>
            <dd>{dateText(selected.event_date)}</dd>
            <dt>Source / purpose</dt>
            <dd>{selected.person_name || selected.submitter}</dd>
            {selected.submitted_name && (
              <>
                <dt>Submitted contact</dt>
                <dd>
                  {selected.submitted_name} · {selected.submitted_email}
                </dd>
                <dt>Consent recorded</dt>
                <dd>
                  {selected.consent_at
                    ? timeText(selected.consent_at)
                    : "See original website receipt"}
                </dd>
              </>
            )}
            <dt>Fund</dt>
            <dd>
              {selected.fund_name}
              {selected.target_fund ? " → " + selected.target_fund : ""}
            </dd>
            <dt>External reference</dt>
            <dd>
              {selected.external_reference ||
                "Internal allocation / budget / stock movement"}
            </dd>
            <dt>Receipt evidence</dt>
            <dd>
              {selected.source === "website_preview"
                ? "Website checkout preview · no external bank charge"
                : selected.settlement_confirmed
                  ? "Receipt checked against evidence"
                  : "Not confirmed"}
            </dd>
            {selected.quantity && (
              <>
                <dt>Quantity</dt>
                <dd>
                  {selected.quantity} {selected.item_name || "item(s)"}
                </dd>
              </>
            )}
            <dt>Service / beneficiary</dt>
            <dd>
              {selected.service_title || "Fund / operational purpose"}
              {selected.beneficiary ? " · " + selected.beneficiary : ""}
            </dd>
            <dt>Submitted by</dt>
            <dd>{selected.submitter}</dd>
            <dt>Reviewed by</dt>
            <dd>{selected.reviewer || "Awaiting independent review"}</dd>
            {selected.reviewed_at && (
              <>
                <dt>Review time</dt>
                <dd>{timeText(selected.reviewed_at)}</dd>
              </>
            )}
            {selected.review_note && (
              <>
                <dt>Review note</dt>
                <dd>{selected.review_note}</dd>
              </>
            )}
          </dl>
          {selected.status === "Submitted" && canReview ? (
            selected.submitted_by === user.id ? (
              <div className="business-info">
                <ShieldCheck size={21} />
                Another authorized person must review your request.
              </div>
            ) : (
              <form onSubmit={(e) => review(e, "approve")}>
                <label className="field">
                  Review note / rejection reason
                  <textarea
                    name="note"
                    maxLength={1000}
                    placeholder="Record what you checked, or explain why this needs revision."
                  />
                </label>
                {dialogError && (
                  <div className="form-error" role="alert">
                    {dialogError}
                  </div>
                )}
                <div className="business-action-row">
                  <button className="button button-dark" disabled={busy}>
                    Approve & post <CheckCircle2 size={18} />
                  </button>
                  <button
                    className="button button-outline"
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      const form = e.currentTarget.form;
                      if (form)
                        review(
                          {
                            preventDefault: () => {},
                            currentTarget: form,
                          } as React.FormEvent<HTMLFormElement>,
                          "reject",
                        );
                    }}
                  >
                    Reject request
                  </button>
                </div>
              </form>
            )
          ) : null}
          {selected.status === "Posted" && (
            <div className="business-info">
              <CheckCircle2 size={21} />
              Posted records are retained with their reviewer and source.
              Pending requests are not included in this amount.
            </div>
          )}
        </BusinessModal>
      )}
    </div>
  );
}
export function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="business-metric">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
