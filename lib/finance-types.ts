export type FinanceKind =
  | "cash_donation"
  | "allocation"
  | "expense"
  | "budget"
  | "in_kind"
  | "distribution"
  | "asset_sale";
export type Fund = {
  id: string;
  name: string;
  code: string;
  program_id: string | null;
  restriction: string;
  balance_cents: number;
  budget_cents: number;
  spent_cents: number;
  total_spent_cents: number;
  received_cents: number;
  allocated_in_cents: number;
  allocated_out_cents: number;
};
export type FinanceRequest = {
  id: string;
  reference: string;
  kind: FinanceKind;
  amount_cents: number;
  currency: string;
  event_date: string;
  fund_id: string;
  to_fund_id: string | null;
  person_id: string | null;
  service_id: string | null;
  item_id: string | null;
  quantity: number | null;
  item_name: string | null;
  external_reference: string | null;
  settlement_confirmed: boolean;
  source: string;
  description: string;
  status: "Submitted" | "Posted" | "Rejected";
  submitted_by: string | null;
  reviewed_by: string | null;
  review_note: string;
  expense_category: string;
  reviewed_at: string | null;
  created_at: string;
  submitter: string;
  reviewer: string | null;
  fund_name: string;
  target_fund: string | null;
  person_name: string | null;
  submitted_name: string | null;
  submitted_email: string | null;
  consent_at: string | null;
  service_title: string | null;
  beneficiary: string | null;
};
export type FinanceData = {
  funds: Fund[];
  requests: FinanceRequest[];
  people: { id: string; name: string }[];
  services: {
    id: string;
    title: string;
    beneficiary: string;
    program_id: string;
  }[];
  items: {
    id: string;
    name: string;
    donor: string;
    fund_id: string;
    quantity: number;
    estimated_value_cents: number;
  }[];
  postings: {
    id: number;
    request_id: string;
    fund_id: string;
    lot_id: string;
    delta_cents: number;
    donation_reference: string;
    donor: string;
    request_reference: string;
    kind: string;
    service_title: string | null;
    beneficiary: string | null;
    fund_name: string;
  }[];
  officer_limit_cents: number;
  scope: "all" | "giving" | "own";
  year: number;
};
export const financeLabels: Record<FinanceKind, string> = {
  cash_donation: "Cash donation",
  allocation: "Fund allocation",
  expense: "Expense",
  budget: "Annual budget",
  in_kind: "In-kind donation",
  distribution: "Item distribution",
  asset_sale: "Asset sale",
};
