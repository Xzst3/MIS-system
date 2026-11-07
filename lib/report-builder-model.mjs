import { z } from "zod";
import { reportDefinitions, expenseCategories } from "./report-config.ts";
import { financeLabels } from "./finance-types.ts";
import { reportPeriod, validDate } from "./report-periods.mjs";

const f = (key, label, type = "text", group = false, values) => ({
  key,
  label,
  type,
  group,
  ...(values ? { values } : {}),
});
const m = (key, label, type = "number", description = "") => ({
  key,
  label,
  type,
  description,
});
const financeFields = [
  f("date", "Business date", "date", true),
  f("reference", "Transaction reference"),
  f("kind", "Transaction type", "text", true, financeLabels),
  f("status", "Processing status", "text", true, {
    Submitted: "Submitted",
    Posted: "Posted",
    Rejected: "Rejected",
  }),
  f("person", "Donor / original donor", "text", true),
  f("fund", "Source / designation fund", "text", true),
  f("destination", "Destination fund", "text", true),
  f("programme", "Source / designation programme", "text", true),
  f("amount", "Recorded amount / estimated value (USD)", "money"),
  f("description", "Purpose / description"),
  f("item", "Item / asset"),
  f("quantity", "Item quantity", "number"),
  f("original_receipt", "Original asset donation reference"),
  f("external_reference", "Bank / invoice reference"),
  f("submitter", "Entered by"),
  f("reviewer", "Reviewed by"),
  f("reviewed_at", "Review time", "timestamp"),
  f("review_note", "Review note"),
  f("expense_category", "Expense category", "text", true, expenseCategories),
  f("service", "Linked service"),
  f("beneficiary", "Linked beneficiary"),
];
const receiptMetrics = [
  m("records", "Transaction records"),
  m(
    "cash_in",
    "Posted cash receipts",
    "money",
    "Posted cash donations and asset-sale proceeds only.",
  ),
  m("cash_out", "Posted expenditure", "money", "Posted expenses only."),
  m(
    "in_kind",
    "Estimated in-kind receipt value",
    "money",
    "Noncash receipt valuation; never added to cash receipts.",
  ),
];
const data = {
  transactions: {
    title: "Contributions & expenses",
    grain:
      "One financial request. Cash receipts, expenditure and estimated assets remain separate.",
    fields: financeFields,
    metrics: receiptMetrics,
    defaults: [
      "date",
      "reference",
      "kind",
      "person",
      "fund",
      "amount",
      "status",
    ],
    defaultMetrics: ["records", "cash_in", "cash_out"],
  },
  sales: {
    title: "Asset sales",
    grain:
      "One asset-sale request, with the original asset and donor retained.",
    fields: financeFields.filter(
      (f) =>
        !["destination", "expense_category", "beneficiary", "service"].includes(
          f.key,
        ),
    ),
    metrics: [
      m("records", "Sale records"),
      m("cash_in", "Posted sale proceeds", "money"),
      m("sold_units", "Posted units sold"),
      m("people", "Distinct original donors"),
    ],
    defaults: [
      "date",
      "reference",
      "item",
      "person",
      "original_receipt",
      "quantity",
      "amount",
      "status",
    ],
    defaultMetrics: ["cash_in", "sold_units", "records"],
  },
  expenses: {
    title: "Expenditure",
    grain:
      "One expense request. Category and purpose are recorded facts; only posted requests enter expenditure.",
    fields: financeFields.filter(
      (f) =>
        ![
          "person",
          "destination",
          "item",
          "quantity",
          "original_receipt",
        ].includes(f.key),
    ),
    metrics: [
      m("records", "Expense records"),
      m("cash_out", "Posted expenditure", "money"),
      m("pending", "Requests awaiting approval"),
    ],
    defaults: [
      "date",
      "reference",
      "expense_category",
      "fund",
      "amount",
      "description",
      "status",
    ],
    defaultMetrics: ["cash_out", "records", "pending"],
  },
  allocations: {
    title: "Fund allocations",
    grain:
      "One allocation request. Transfers move existing money and do not create income or expenditure.",
    fields: financeFields.filter(
      (f) =>
        ![
          "person",
          "item",
          "quantity",
          "original_receipt",
          "service",
          "beneficiary",
          "expense_category",
        ].includes(f.key),
    ),
    metrics: [
      m("records", "Allocation records"),
      m("transferred", "Posted amount transferred", "money"),
      m("pending", "Requests awaiting approval"),
    ],
    defaults: [
      "date",
      "reference",
      "fund",
      "destination",
      "amount",
      "description",
      "status",
    ],
    defaultMetrics: ["transferred", "records"],
  },
  source_impact: {
    title: "Donor-funded use",
    grain:
      "One original-source share of an expense. Several shares may fund one expense; expense and beneficiary counts are distinct.",
    fields: [
      f("date", "Expense date", "date", true),
      f("reference", "Expense reference"),
      f("person", "Original donor", "text", true),
      f("original_receipt", "Original contribution"),
      f("fund", "Spending fund", "text", true),
      f("programme", "Spending programme", "text", true),
      f("amount", "Source-funded amount (USD)", "money"),
      f("service", "Linked service", "text", true),
      f("beneficiary", "Linked beneficiary", "text", true),
      f("description", "Actual purpose"),
    ],
    metrics: [
      m("cash_out", "Source-funded expenditure", "money"),
      m("funded_expenses", "Distinct expenses funded"),
      m("beneficiaries", "Distinct people with completed linked services"),
      m("completed", "Distinct completed services linked"),
      m("records", "Source allocation lines"),
    ],
    defaults: [
      "date",
      "person",
      "original_receipt",
      "reference",
      "fund",
      "amount",
      "beneficiary",
      "service",
    ],
    defaultMetrics: ["cash_out", "beneficiaries", "completed"],
  },
  donors: {
    title: "Donor contributions",
    grain:
      "One posted cash or in-kind gift. Group by donor to build giving history. Asset sales are excluded from new donations.",
    fields: financeFields.filter(
      (f) =>
        !["destination", "beneficiary", "service", "expense_category"].includes(
          f.key,
        ),
    ),
    metrics: [
      m("records", "Posted gifts"),
      m("cash_in", "Cash donations", "money"),
      m("in_kind", "Estimated in-kind value", "money"),
      m("people", "Distinct donors"),
    ],
    defaults: ["date", "reference", "person", "kind", "fund", "amount"],
    defaultMetrics: ["cash_in", "in_kind", "people"],
  },
  services: {
    title: "Services & outcomes",
    grain:
      "One service record. Overall distinct people must not be obtained by adding programme subtotals.",
    fields: [
      f("date", "Service date", "date", true),
      f("person", "Beneficiary", "text", true),
      f("programme", "Programme", "text", true),
      f("reference", "Service title"),
      f("kind", "Service type", "text", true),
      f("status", "Service status", "text", true, {
        Planned: "Planned",
        "In progress": "In progress",
        Completed: "Completed",
        Cancelled: "Cancelled",
      }),
      f("assignee", "Coordinator"),
      f("provider", "External provider"),
      f("outcome", "Recorded outcome"),
      f("description", "Coordination notes"),
    ],
    metrics: [
      m("records", "Service records"),
      m("completed", "Completed services"),
      m("beneficiaries", "Distinct people supported"),
    ],
    defaults: [
      "date",
      "person",
      "programme",
      "reference",
      "status",
      "provider",
      "outcome",
    ],
    defaultMetrics: ["records", "completed", "beneficiaries"],
  },
  hours: {
    title: "Employee & volunteer hours",
    grain:
      "One submitted hour entry. Approved employee and volunteer hours remain separate; access may be limited to your own entries.",
    fields: [
      f("date", "Work date", "date", true),
      f("person", "Person", "text", true),
      f("kind", "Engagement", "text", true, {
        employee: "Employee",
        volunteer: "Volunteer",
      }),
      f("status", "Hours status", "text", true, {
        Submitted: "Submitted",
        Approved: "Approved",
        Rejected: "Rejected",
      }),
      f("programme", "Programme", "text", true),
      f("reference", "Service / contribution"),
      f("hours", "Hours submitted", "number"),
      f("description", "Work description"),
      f("reviewer", "Reviewed by"),
      f("review_note", "Review note"),
    ],
    metrics: [
      m("records", "Hour entries"),
      m("volunteer_hours", "Approved volunteer hours"),
      m("employee_hours", "Approved employee hours"),
      m("approved_people", "Distinct people with approved hours"),
    ],
    defaults: [
      "date",
      "person",
      "kind",
      "reference",
      "hours",
      "status",
      "reviewer",
    ],
    defaultMetrics: ["volunteer_hours", "employee_hours", "records"],
  },
  inventory: {
    title: "Donated stock",
    grain:
      "One original stock-receipt lot, at the selected closing date. Opening + received − distributed − sold = closing units.",
    fields: [
      f("reference", "Original donation"),
      f("description", "Item / asset"),
      f("person", "Original donor", "text", true),
      f("fund", "Designation fund", "text", true),
      f("programme", "Designation programme", "text", true),
      f("opening", "Opening units", "number"),
      f("received_units", "Units received in period", "number"),
      f("distributed_units", "Units distributed in period", "number"),
      f("sold_units", "Units sold in period", "number"),
      f("quantity", "Closing units", "number"),
    ],
    metrics: [
      m("records", "Stock receipt lots"),
      m("closing_units", "Closing units available"),
      m("received_units", "Units received"),
      m("distributed_units", "Units distributed"),
      m("sold_units", "Units sold"),
    ],
    defaults: [
      "reference",
      "description",
      "person",
      "fund",
      "opening",
      "received_units",
      "distributed_units",
      "sold_units",
      "quantity",
    ],
    defaultMetrics: ["closing_units", "received_units", "distributed_units"],
  },
};
const temporal = [
  { key: "month", label: "Month", type: "text", temporal: true },
  { key: "week", label: "Week starting Monday", type: "date", temporal: true },
  { key: "year", label: "Year", type: "text", temporal: true },
];
export function builderCatalog(role) {
  return Object.entries(data)
    .filter(([key]) => reportDefinitions[key].roles.includes(role))
    .map(([key, ds]) => {
      let fields = ds.fields.filter(
        (f) =>
          !(
            role === "fundraising" && ["service", "beneficiary"].includes(f.key)
          ),
      );
      if (
        role === "coordinator" &&
        ["transactions", "expenses", "inventory"].includes(key)
      )
        fields = fields.filter((f) => f.key !== "person");
      if (key === "transactions" && role === "fundraising")
        fields = fields.map((f) =>
          f.key === "kind"
            ? {
                ...f,
                values: Object.fromEntries(
                  Object.entries(financeLabels).filter(([k]) =>
                    ["cash_donation", "in_kind", "asset_sale"].includes(k),
                  ),
                ),
              }
            : f,
        );
      if (key === "transactions" && role === "coordinator")
        fields = fields.map((f) =>
          f.key === "kind"
            ? {
                ...f,
                values: Object.fromEntries(
                  Object.entries(financeLabels).filter(([k]) =>
                    ["expense", "distribution"].includes(k),
                  ),
                ),
              }
            : f,
        );
      const dimensions = [
        ...fields
          .filter((f) => f.group)
          .map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            temporal: f.key === "date",
          })),
        ...(key === "inventory" ? [] : temporal),
      ];
      return {
        key,
        title: ds.title,
        grain: ds.grain,
        fields,
        dimensions,
        metrics: ds.metrics,
        defaults: ds.defaults.filter((k) => fields.some((f) => f.key === k)),
        defaultMetrics: ds.defaultMetrics,
      };
    });
}
export const periodChoices = {
  previous_2_months: "Previous 2 complete months",
  rolling_2_months: "Last 2 months to today",
  this_month: "This month to date",
  last_month: "Previous complete month",
  year_to_date: "Year to date",
  all_time: "All recorded history",
  custom: "Custom dates",
};
const definitionSchema = z
  .object({
    version: z.literal(1),
    dataset: z.enum(Object.keys(data)),
    mode: z.enum(["details", "summary"]),
    columns: z.array(z.string().max(50)).min(1).max(12),
    metrics: z.array(z.string().max(50)).min(1).max(4),
    groupBy: z.array(z.string().max(50)).max(2),
    period: z.enum(Object.keys(periodChoices)),
    start: z.string().optional(),
    end: z.string().optional(),
    filters: z
      .array(
        z
          .object({
            field: z.string().max(50),
            op: z.enum([
              "is",
              "is_not",
              "contains",
              "gt",
              "gte",
              "lt",
              "lte",
              "between",
              "empty",
              "not_empty",
            ]),
            value: z.string().max(200).default(""),
            to: z.string().max(200).optional(),
          })
          .strict(),
      )
      .max(8),
    match: z.enum(["all", "any"]),
    display: z.enum(["table", "bar", "line"]),
    chartMetric: z.string().max(50),
    sort: z
      .object({ key: z.string().max(50), direction: z.enum(["asc", "desc"]) })
      .strict(),
    drill: z
      .array(
        z
          .object({
            field: z.string().max(50),
            value: z.string().max(250).nullable(),
            identity: z.string().max(50).nullable().optional(),
          })
          .strict(),
      )
      .max(4)
      .default([]),
  })
  .strict();
function forbidden(message) {
  const e = new Error(message);
  e.code = "FORBIDDEN";
  throw e;
}
const unique = (a) => new Set(a).size === a.length;
export function numericFilterValue(value, type) {
  if (type === "money") {
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
      throw new Error(
        "Use a nonnegative USD amount with at most two decimal places.",
      );
    const [a, b = ""] = value.split(".");
    return Number(a) * 100 + Number(b.padEnd(2, "0"));
  }
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new Error(
      "Use a nonnegative number with at most two decimal places.",
    );
  return Number(value);
}
export function validateDefinition(raw, role) {
  const c = definitionSchema.parse(raw),
    ds = builderCatalog(role).find((d) => d.key === c.dataset);
  if (!ds) forbidden("Your role cannot use this reporting topic.");
  if (!unique(c.columns) || !unique(c.metrics) || !unique(c.groupBy))
    throw new Error("Select each column, measure and grouping only once.");
  for (const key of c.columns)
    if (!ds.fields.some((f) => f.key === key))
      forbidden("A selected column is unavailable to your current role.");
  for (const key of c.metrics)
    if (!ds.metrics.some((m) => m.key === key))
      throw new Error("Choose a measure available for this topic.");
  for (const key of c.groupBy)
    if (!ds.dimensions.some((d) => d.key === key))
      forbidden("A selected grouping is unavailable to your current role.");
  if (c.mode === "summary" && !c.groupBy.length)
    throw new Error("Select at least one grouping for a summary.");
  const sortKeys =
    c.mode === "details" ? c.columns : [...c.groupBy, ...c.metrics];
  if (!sortKeys.includes(c.sort.key))
    throw new Error("Sort using a displayed column, grouping or measure.");
  if (!c.metrics.includes(c.chartMetric))
    throw new Error("Select a displayed measure for the chart.");
  if (c.display !== "table" && (c.mode !== "summary" || c.groupBy.length !== 1))
    throw new Error("Charts require a summary with exactly one grouping.");
  if (
    c.display === "line" &&
    !ds.dimensions.find((d) => d.key === c.groupBy[0])?.temporal
  )
    throw new Error(
      "A trend line requires a date, week, month or year grouping.",
    );
  reportPeriod(c.period, c.start, c.end);
  for (const filter of c.filters) {
    const field = ds.fields.find((f) => f.key === filter.field);
    if (!field)
      forbidden("A filter field is unavailable to your current role.");
    if (["empty", "not_empty"].includes(filter.op)) continue;
    if (!filter.value.trim()) throw new Error("Enter a value for each filter.");
    if (["money", "number"].includes(field.type)) {
      if (filter.op === "contains")
        throw new Error("Numeric fields do not support text matching.");
      const v = numericFilterValue(filter.value, field.type);
      if (
        filter.op === "between" &&
        v > numericFilterValue(filter.to || "", field.type)
      )
        throw new Error(
          "The upper filter value must be at least the lower value.",
        );
    } else if (["date", "timestamp"].includes(field.type)) {
      if (filter.op === "contains" || !validDate(filter.value))
        throw new Error("Use a valid calendar date for the filter.");
      if (
        filter.op === "between" &&
        (!validDate(filter.to) || filter.value > filter.to)
      )
        throw new Error("Use valid dates in order for the filter.");
    } else {
      if (!["is", "is_not", "contains"].includes(filter.op))
        throw new Error(
          "Text fields support exact, different or contains filters.",
        );
      if (
        field.values &&
        filter.op !== "contains" &&
        !Object.hasOwn(field.values, filter.value)
      )
        throw new Error("Choose a value offered for this field.");
    }
  }
  for (const d of c.drill) {
    if (!ds.dimensions.some((f) => f.key === d.field))
      forbidden("The drill-down grouping is unavailable to your role.");
    if (
      d.identity !== undefined &&
      d.identity !== null &&
      !z.uuid().safeParse(d.identity).success
    )
      throw new Error("Invalid drill-down identity.");
    if (
      d.value !== null &&
      d.field === "month" &&
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(d.value)
    )
      throw new Error("Invalid drill-down month.");
    if (
      d.value !== null &&
      ["date", "week"].includes(d.field) &&
      !validDate(d.value)
    )
      throw new Error("Invalid drill-down date.");
    if (d.value !== null && d.field === "year" && !/^\d{4}$/.test(d.value))
      throw new Error("Invalid drill-down year.");
  }
  return { definition: c, dataset: ds };
}
export function defaultDefinition(dataset, role) {
  const ds = builderCatalog(role).find((d) => d.key === dataset);
  if (!ds) forbidden("Your role cannot use this reporting topic.");
  return {
    version: 1,
    dataset,
    mode: "details",
    columns: ds.defaults,
    metrics: ds.defaultMetrics,
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
export function builderTemplates(role) {
  return builderCatalog(role).map((ds) => {
    const c = defaultDefinition(ds.key, role),
      group =
        ds.key === "inventory"
          ? "fund"
          : ds.key === "source_impact"
            ? "person"
            : ds.key === "expenses"
              ? "expense_category"
              : ds.key === "donors"
                ? "person"
                : ds.key === "hours"
                  ? "kind"
                  : "month";
    c.mode = "summary";
    c.groupBy = [group];
    c.sort = { key: group, direction: "asc" };
    return {
      id: "foundation-" + ds.key,
      name: ds.title + " overview",
      description: ds.grain,
      definition: c,
    };
  });
}
