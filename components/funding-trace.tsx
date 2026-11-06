"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  dateText,
  dollars,
  LoadState,
  timeText,
  useRemote,
} from "./business-ui";
import { financeLabels, type FinanceKind } from "@/lib/finance-types";
type Trace = {
  origin: {
    reference: string;
    kind: FinanceKind;
    donor: string;
    event_date: string;
    amount_cents: number;
    item_name: string;
    description: string;
    status: string;
  };
  summary: {
    received: number;
    spent: number;
    remaining: number;
    reconciled: boolean;
    people: number;
    services: number;
  };
  balances: { fund_id: string; fund_name: string; balance: number }[];
  movements: {
    posting_id: number;
    transaction_reference: string;
    kind: FinanceKind;
    event_date: string;
    fund_name: string;
    delta_cents: number;
    description: string;
    original_donation_reference: string;
    cash_source_reference: string;
    service_title: string | null;
    beneficiary_name: string | null;
    submitter_name: string | null;
    reviewer_name: string;
    reviewed_at: string;
    review_note: string;
  }[];
  inventory: {
    reference: string;
    kind: FinanceKind;
    event_date: string;
    quantity: number;
    description: string;
    beneficiary: string | null;
    service: string | null;
    reviewer: string;
  }[];
  sales: {
    id: string;
    reference: string;
    event_date: string;
    amount_cents: number;
  }[];
  page: number;
  page_size: number;
  total: number;
  basis: string;
};
export function FundingTrace({ source }: { source: string }) {
  const [page, setPage] = useState(1);
  const remote = useRemote<Trace>(
    `/api/funding-trace?source=${encodeURIComponent(source)}&page=${page}`,
  );
  const { data } = remote;
  if (!data)
    return (
      <LoadState
        error={remote.error}
        loading={remote.loading}
        onRetry={remote.refresh}
      />
    );
  const { origin, summary } = data;
  return (
    <div className="funding-trace-detail" aria-busy={remote.loading}>
      <LoadState
        error={remote.error}
        loading={false}
        onRetry={remote.refresh}
      />
      <p className="trace-origin">
        <strong>{origin.reference}</strong>
        <span>
          {origin.donor} · {dateText(origin.event_date)} ·{" "}
          {financeLabels[origin.kind]}
        </span>
      </p>
      <p>{origin.description}</p>
      <div className="trace-summary">
        {origin.kind === "in_kind" && (
          <div>
            <span>Original estimated asset value</span>
            <strong>{dollars(origin.amount_cents)}</strong>
            <small>Separate from cash received</small>
          </div>
        )}
        <div>
          <span>
            {origin.kind === "in_kind"
              ? "Posted sale proceeds"
              : "Original cash received"}
          </span>
          <strong>{dollars(summary.received)}</strong>
        </div>
        <div>
          <span>Used in posted expenses</span>
          <strong>{dollars(summary.spent)}</strong>
        </div>
        <div>
          <span>Remaining across funds</span>
          <strong>{dollars(summary.remaining)}</strong>
        </div>
      </div>
      {origin.status === "Posted" && (
        <p
          className={summary.reconciled ? "trace-reconciled" : "business-error"}
        >
          <CheckCircle2 size={19} />
          {summary.reconciled
            ? "Reconciled: cash received − expenses = remaining funds."
            : "Reconciliation needs finance review."}
        </p>
      )}
      <p className="report-definition">
        {data.basis} Linked delivered support: {summary.people} distinct people
        across {summary.services} completed services. Shared operational costs
        do not create beneficiary links.
      </p>
      {data.balances.length > 0 && (
        <>
          <h3>Where the remaining money is held</h3>
          <div className="trace-fund-balances">
            {data.balances.map((f) => (
              <div key={f.fund_id}>
                <span>{f.fund_name}</span>
                <strong>{dollars(f.balance)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
      {data.inventory.length > 0 && (
        <>
          <h3>Physical gift history</h3>
          <div className="trace-history">
            {data.inventory.map((i) => (
              <article key={i.reference}>
                <strong>
                  {financeLabels[i.kind]} · {i.quantity > 0 ? "+" : ""}
                  {i.quantity} units
                </strong>
                <span>
                  {dateText(i.event_date)} · {i.reference}
                </span>
                <p>{i.description}</p>
                {i.beneficiary && (
                  <span>
                    {i.beneficiary} · {i.service}
                  </span>
                )}
                <small>Reviewed by {i.reviewer}</small>
              </article>
            ))}
          </div>
        </>
      )}
      <h3>Source-linked ledger movements</h3>
      <p className="report-definition">
        Complete history, including dates outside the report filter. Each
        transfer has an outgoing and incoming line.
      </p>
      <div className="trace-history">
        {data.movements.map((m) => (
          <article key={m.posting_id}>
            <div className="trace-movement-heading">
              <strong>
                {financeLabels[m.kind]} · {m.fund_name}
              </strong>
              <b>
                {m.delta_cents > 0 ? "+" : ""}
                {dollars(m.delta_cents)}
              </b>
            </div>
            <span>
              {dateText(m.event_date)} · {m.transaction_reference}
            </span>
            <small>
              Original donation {m.original_donation_reference} · Cash source{" "}
              {m.cash_source_reference}
            </small>
            <p>{m.description}</p>
            {m.beneficiary_name && (
              <p>
                {m.beneficiary_name} · {m.service_title}
              </p>
            )}
            <small>
              Entered by {m.submitter_name || "Website checkout"} · Reviewed by{" "}
              {m.reviewer_name} · {timeText(m.reviewed_at)}
            </small>
            {m.review_note && <small>Approval note: {m.review_note}</small>}
          </article>
        ))}
      </div>
      {data.total === 0 && (
        <p>
          No posted cash movements. Unreviewed receipts and in-kind valuation do
          not increase the ledger balance.
        </p>
      )}
      {data.total > 25 && (
        <div className="report-pagination">
          <button
            className="button button-outline"
            disabled={page === 1 || remote.loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ArrowLeft size={17} /> Previous
          </button>
          <span>
            Page {page} of {Math.ceil(data.total / 25)}
          </span>
          <button
            className="button button-outline"
            disabled={page * 25 >= data.total || remote.loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ArrowRight size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
