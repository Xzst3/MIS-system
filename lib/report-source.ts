import "server-only";
import { z } from "zod";
import { reportPeriod } from "./report-periods.mjs";
import {
  reportDefinitions,
  expenseCategories,
  type ReportId,
  type ReportColumn,
} from "./report-config";
import { financeLabels } from "./finance-types";
import type { User } from "./types";
export class ReportAccessError extends Error {}
export const column = (
  key: string,
  label: string,
  type?: ReportColumn["type"],
): ReportColumn => ({ key, label, type });
const common = [
  column("date", "Date", "date"),
  column("reference", "Reference"),
  column("status", "Status"),
];
export const paramsSchema = z.object({
  report: z
    .enum(Object.keys(reportDefinitions) as [ReportId, ...ReportId[]])
    .default("transactions"),
  period: z.string().default("previous_2_months"),
  start: z.string().optional(),
  end: z.string().optional(),
  fund: z.uuid().optional(),
  program: z.uuid().optional(),
  person: z.uuid().optional(),
  source: z.uuid().optional(),
  kind: z.enum(Object.keys(financeLabels) as [string, ...string[]]).optional(),
  category: z
    .enum(Object.keys(expenseCategories) as [string, ...string[]])
    .optional(),
  status: z.string().max(25).optional(),
  engagement: z.enum(["employee", "volunteer"]).optional(),
  q: z.string().trim().max(150).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  format: z.enum(["json", "csv"]).default("json"),
});
export function buildReportSource(
  user: User,
  input: z.infer<typeof paramsSchema>,
) {
  const report = input.report;
  if (
    !(reportDefinitions[report].roles as readonly string[]).includes(user.role)
  )
    throw new ReportAccessError("Your role cannot open this report.");
  const period = reportPeriod(input.period, input.start, input.end);
  const values: (string | number | null)[] = [
    period.start,
    period.end,
    period.previous_start,
    period.previous_end,
  ];
  const bind = (v: string | number) => {
    values.push(v);
    return "$" + values.length;
  };
  const filters: string[] = [];
  let columns: ReportColumn[] = [],
    source = "",
    scope = "Foundation records permitted by your role";
  const privateServices = user.role !== "fundraising";
  const financial = ["admin", "finance", "fundraising"].includes(user.role);
  const ownFinance = user.role === "coordinator";
  const ownHours = !["admin", "coordinator"].includes(user.role);
  const financialReport = [
    "transactions",
    "sales",
    "expenses",
    "allocations",
    "donors",
  ].includes(report);
  const allowedStatuses =
    report === "services"
      ? ["Planned", "In progress", "Completed", "Cancelled"]
      : report === "hours"
        ? ["Submitted", "Approved", "Rejected"]
        : ["Submitted", "Posted", "Rejected"];
  if (input.status && !allowedStatuses.includes(input.status))
    throw new Error("Choose a status available for this report.");
  if (input.status && ["source_impact", "donors", "inventory"].includes(report))
    throw new Error("This report uses posted records only.");
  if (input.kind && !["transactions"].includes(report))
    throw new Error("Transaction type applies to the contributions report.");
  if (input.category && !["expenses", "transactions"].includes(report))
    throw new Error("Expense category applies to financial transactions.");
  if (input.source && report !== "source_impact")
    throw new Error("Contribution source applies to donor-funded services.");
  if (input.engagement && report !== "hours")
    throw new Error("Engagement type applies to hours.");
  if (input.fund && ["services", "hours"].includes(report))
    throw new Error("Use a programme filter for this report.");
  if (
    report === "inventory" &&
    (input.q || input.program || input.person || input.fund)
  ) {
    /* applied to normalized inventory rows below */
  }
  if (financialReport) {
    if (ownFinance && input.person)
      throw new ReportAccessError(
        "Donor filtering is not available to your role.",
      );
    if (user.role === "fundraising")
      filters.push("r.kind IN ('cash_donation','in_kind','asset_sale')");
    if (ownFinance) {
      filters.push("r.submitted_by=" + bind(user.id));
      scope = "Your submitted financial requests only";
    }
    if (report === "sales") filters.push("r.kind='asset_sale'");
    if (report === "expenses") filters.push("r.kind='expense'");
    if (report === "allocations") filters.push("r.kind='allocation'");
    if (report === "donors")
      filters.push(
        "r.kind IN ('cash_donation','in_kind') AND r.status='Posted'",
      );
    if (input.status) filters.push("r.status=" + bind(input.status));
    if (input.kind) filters.push("r.kind=" + bind(input.kind));
    if (input.category)
      filters.push("r.expense_category=" + bind(input.category));
    if (input.fund) {
      const p = bind(input.fund);
      filters.push(`(r.fund_id=${p} OR r.to_fund_id=${p})`);
    }
    if (input.program) filters.push("f.program_id=" + bind(input.program));
    if (input.person)
      filters.push("COALESCE(r.person_id,i.donor_id)=" + bind(input.person));
    if (input.q)
      filters.push(
        `strpos(lower(concat_ws(' ',r.reference,r.external_reference,r.description,${ownFinance ? "NULL" : "p.name"},i.name,f.name,t.name,origin.reference)),lower(${bind(input.q)}))>0`,
      );
    source = `SELECT r.id::text id,r.event_date date,r.reference,r.kind,r.status,r.amount_cents::numeric amount,
    ${ownFinance ? "NULL::text" : "COALESCE(p.name,'—')"} person,${ownFinance ? "NULL::text" : "COALESCE(r.person_id,i.donor_id)::text"} person_id,f.name fund,r.fund_id::text fund_id,t.name destination,r.to_fund_id::text destination_id,f.program_id::text program_id,
    COALESCE(pr.name,'General support') programme,r.description,COALESCE(i.name,r.item_name) item,r.quantity,
    origin.reference original_receipt,i.id::text asset_id,COALESCE(u.name,'Website checkout') submitter,v.name reviewer,r.reviewed_at,
    r.review_note,r.external_reference,r.source,r.settlement_confirmed,r.expense_category,
    ${privateServices ? "s.title" : "NULL::text"} service,${privateServices ? "b.name" : "NULL::text"} beneficiary,
    ${privateServices ? "s.beneficiary_id::text" : "NULL::text"} beneficiary_identity,${privateServices ? "s.id::text" : "NULL::text"} linked_service_id,NULL::text beneficiary_id,NULL::text service_id,0::numeric hours,0::int completed,
    CASE WHEN r.status='Posted' AND r.kind IN ('cash_donation','asset_sale') THEN r.amount_cents ELSE 0 END::numeric cash_in,
    CASE WHEN r.status='Posted' AND r.kind='expense' THEN r.amount_cents ELSE 0 END::numeric cash_out,
    CASE WHEN r.status='Posted' AND r.kind='in_kind' THEN r.amount_cents ELSE 0 END::numeric in_kind,
    CASE WHEN r.kind='expense' THEN r.expense_category ELSE r.kind END category
    FROM finance_requests r JOIN funds f ON f.id=r.fund_id LEFT JOIN funds t ON t.id=r.to_fund_id
    LEFT JOIN programs pr ON pr.id=f.program_id LEFT JOIN inventory_items i ON i.id=r.item_id
    LEFT JOIN finance_requests origin ON origin.id=i.id LEFT JOIN people p ON p.id=COALESCE(r.person_id,i.donor_id)
    LEFT JOIN users u ON u.id=r.submitted_by LEFT JOIN users v ON v.id=r.reviewed_by
    LEFT JOIN service_records s ON s.id=r.service_id LEFT JOIN people b ON b.id=s.beneficiary_id
    WHERE ${filters.join(" AND ") || "true"}`;
    columns = [
      ...common,
      column("kind", "Type"),
      column("person", "Donor / original donor"),
      column("fund", "Fund"),
      column("amount", "Amount / estimated value (USD)", "money"),
      column("description", "Description"),
    ];
    if (report === "sales")
      columns = [
        ...common,
        column("item", "Asset sold"),
        column("person", "Original donor"),
        column("original_receipt", "Original donation"),
        column("quantity", "Units sold", "number"),
        column("amount", "Sale proceeds (USD)", "money"),
        column("fund", "Fund"),
      ];
    if (report === "expenses")
      columns = [
        ...common,
        column("expense_category", "Category"),
        column("fund", "Fund"),
        column("amount", "Expense (USD)", "money"),
        column("description", "Purpose"),
        column("submitter", "Submitted by"),
        column("reviewer", "Reviewed by"),
      ];
    if (report === "allocations")
      columns = [
        ...common,
        column("fund", "From fund"),
        column("destination", "To fund"),
        column("amount", "Transferred (USD)", "money"),
        column("description", "Allocation basis"),
        column("reviewer", "Reviewed by"),
      ];
  } else if (report === "source_impact") {
    if (input.person) filters.push("l.donor_id=" + bind(input.person));
    if (input.source) filters.push("l.id=" + bind(input.source));
    if (input.fund) filters.push("p.fund_id=" + bind(input.fund));
    if (input.program) filters.push("f.program_id=" + bind(input.program));
    if (input.q)
      filters.push(
        `strpos(lower(concat_ws(' ',person.name,d.reference,r.reference,r.description,f.name)),lower(${bind(input.q)}))>0`,
      );
    source = `SELECT p.id::text id,r.event_date date,r.reference,'expense'::text kind,'Posted'::text status,
    -p.delta_cents::numeric amount,person.name person,l.donor_id::text person_id,f.name fund,f.id::text fund_id,pr.name programme,f.program_id::text program_id,
    r.description,d.reference original_receipt,l.id::text source_id,${privateServices ? "s.title" : "NULL::text"} service,
    ${privateServices ? "b.name" : "NULL::text"} beneficiary,
    ${privateServices ? "s.beneficiary_id::text" : "NULL::text"} beneficiary_identity,${privateServices ? "s.id::text" : "NULL::text"} linked_service_id,CASE WHEN s.status='Completed' THEN s.beneficiary_id::text END beneficiary_id,
    CASE WHEN s.status='Completed' THEN s.id::text END service_id,
    CASE WHEN s.status='Completed' THEN 1 ELSE 0 END completed,0::numeric hours,0::numeric cash_in,-p.delta_cents::numeric cash_out,0::numeric in_kind,pr.name category
    FROM finance_postings p JOIN finance_lots l ON l.id=p.lot_id JOIN people person ON person.id=l.donor_id
    JOIN finance_requests d ON d.id=l.id JOIN finance_requests r ON r.id=p.request_id
    JOIN funds f ON f.id=p.fund_id LEFT JOIN programs pr ON pr.id=f.program_id
    LEFT JOIN service_records s ON s.id=r.service_id LEFT JOIN people b ON b.id=s.beneficiary_id
    WHERE r.kind='expense' AND r.status='Posted' AND p.delta_cents<0 ${filters.length ? "AND " + filters.join(" AND ") : ""}`;
    columns = [
      column("date", "Expense date", "date"),
      column("person", "Original donor"),
      column("original_receipt", "Original contribution"),
      column("reference", "Expense reference"),
      column("fund", "Fund"),
      column("amount", "Source-funded amount (USD)", "money"),
      ...(privateServices
        ? [column("beneficiary", "Beneficiary"), column("service", "Service")]
        : []),
      column("description", "Purpose"),
    ];
  } else if (report === "services") {
    if (input.person) filters.push("s.beneficiary_id=" + bind(input.person));
    if (input.program) filters.push("s.program_id=" + bind(input.program));
    if (input.status) filters.push("s.status=" + bind(input.status));
    if (input.q)
      filters.push(
        `strpos(lower(concat_ws(' ',b.name,s.title,s.provider,s.outcome,u.name)),lower(${bind(input.q)}))>0`,
      );
    source = `SELECT s.id::text id,s.service_date date,s.title reference,s.service_type kind,s.status,0::numeric amount,b.name person,b.id::text person_id,
    pr.name programme,s.program_id::text program_id,s.provider,s.notes description,s.outcome,u.name assignee,
    CASE WHEN s.status='Completed' THEN b.id::text END beneficiary_id,CASE WHEN s.status='Completed' THEN s.id::text END service_id,
    CASE WHEN s.status='Completed' THEN 1 ELSE 0 END completed,0::numeric hours,0::numeric cash_in,0::numeric cash_out,0::numeric in_kind,pr.name category
    FROM service_records s JOIN people b ON b.id=s.beneficiary_id JOIN programs pr ON pr.id=s.program_id LEFT JOIN users u ON u.id=s.assigned_to
    WHERE ${filters.join(" AND ") || "true"}`;
    columns = [
      column("date", "Service date", "date"),
      column("person", "Beneficiary"),
      column("programme", "Programme"),
      column("reference", "Service"),
      column("status", "Status"),
      column("assignee", "Coordinator"),
      column("provider", "External provider"),
      column("outcome", "Recorded outcome"),
    ];
  } else if (report === "hours") {
    if (ownHours) {
      filters.push("h.submitted_by=" + bind(user.id));
      scope = "Your employee and volunteer hour entries only";
    }
    if (input.person) filters.push("e.person_id=" + bind(input.person));
    if (input.program) filters.push("s.program_id=" + bind(input.program));
    if (input.status) filters.push("h.status=" + bind(input.status));
    if (input.engagement) filters.push("e.role=" + bind(input.engagement));
    if (input.q)
      filters.push(
        `strpos(lower(concat_ws(' ',person.name,h.description,s.title)),lower(${bind(input.q)}))>0`,
      );
    source = `SELECT h.id::text id,h.service_date date,COALESCE(s.title,'General contribution') reference,e.role kind,h.status,
    0::numeric amount,person.name person,e.person_id::text person_id,s.program_id::text program_id,pr.name programme,h.description,u.name reviewer,h.review_note,
    NULL::text beneficiary_id,NULL::text service_id,0::int completed,h.hours::numeric hours,0::numeric cash_in,0::numeric cash_out,0::numeric in_kind,e.role category
    FROM service_hours h JOIN person_engagements e ON e.id=h.engagement_id JOIN people person ON person.id=e.person_id
    LEFT JOIN service_records s ON s.id=h.service_id LEFT JOIN programs pr ON pr.id=s.program_id LEFT JOIN users u ON u.id=h.reviewed_by
    WHERE ${filters.join(" AND ") || "true"}`;
    columns = [
      column("date", "Work date", "date"),
      column("person", "Person"),
      column("kind", "Engagement"),
      column("reference", "Service"),
      column("hours", "Hours", "number"),
      column("status", "Status"),
      column("description", "Work recorded"),
      column("reviewer", "Reviewed by"),
    ];
  } else {
    if (input.fund) filters.push("i.fund_id=" + bind(input.fund));
    if (input.program) filters.push("f.program_id=" + bind(input.program));
    if (input.person) {
      if (!financial)
        throw new ReportAccessError(
          "Donor filtering is not available to your role.",
        );
      filters.push("i.donor_id=" + bind(input.person));
    }
    if (input.q)
      filters.push(
        `strpos(lower(concat_ws(' ',i.name,r.reference,f.name${financial ? ",p.name" : ""})),lower(${bind(input.q)}))>0`,
      );
    source = `SELECT i.id::text id,bounds.end_date date,r.reference,'inventory'::text kind,'Posted'::text status,
    ${financial ? "i.estimated_value_cents" : "0"}::numeric amount,${financial ? "p.name" : "NULL::text"} person,${financial ? "i.donor_id::text" : "NULL::text"} person_id,
    f.name fund,f.id::text fund_id,pr.name programme,f.program_id::text program_id,i.name description,
    COALESCE(sum(m.quantity) FILTER(WHERE mr.event_date<bounds.start_date),0)::numeric opening,
    COALESCE(sum(m.quantity) FILTER(WHERE mr.event_date<=bounds.end_date),0)::numeric quantity,
    COALESCE(sum(m.quantity) FILTER(WHERE mr.event_date BETWEEN bounds.start_date AND bounds.end_date AND mr.kind='in_kind'),0)::numeric received_units,
    -COALESCE(sum(m.quantity) FILTER(WHERE mr.event_date BETWEEN bounds.start_date AND bounds.end_date AND mr.kind='distribution'),0)::numeric distributed_units,
    -COALESCE(sum(m.quantity) FILTER(WHERE mr.event_date BETWEEN bounds.start_date AND bounds.end_date AND mr.kind='asset_sale'),0)::numeric sold_units,
    NULL::text beneficiary_id,NULL::text service_id,0::int completed,0::numeric hours,0::numeric cash_in,0::numeric cash_out,0::numeric in_kind,f.name category,bounds.period inventory_period
    FROM inventory_items i JOIN finance_requests r ON r.id=i.id JOIN funds f ON f.id=i.fund_id LEFT JOIN programs pr ON pr.id=f.program_id
    JOIN people p ON p.id=i.donor_id CROSS JOIN (VALUES ('current',$1::date,$2::date),('previous',$3::date,$4::date)) AS bounds(period,start_date,end_date)
    LEFT JOIN inventory_movements m ON m.item_id=i.id LEFT JOIN finance_requests mr ON mr.id=m.request_id AND mr.status='Posted'
    WHERE r.event_date<=bounds.end_date ${filters.length ? "AND " + filters.join(" AND ") : ""}
    GROUP BY i.id,r.reference,f.id,f.name,pr.name,f.program_id,p.name,bounds.start_date,bounds.end_date,bounds.period`;
    columns = [
      column("reference", "Original donation"),
      column("description", "Item / asset"),
      ...(financial ? [column("person", "Original donor")] : []),
      column("fund", "Designation"),
      column("opening", "Opening units", "number"),
      column("received_units", "Received", "number"),
      column("distributed_units", "Distributed", "number"),
      column("sold_units", "Sold", "number"),
      column("quantity", "Closing units", "number"),
    ];
  }
  return { source, values, period, scope, columns };
}
