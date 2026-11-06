export const reportDefinitions = {
  transactions: {
    title: "Contributions & expenses",
    question: "What was received, spent or awaiting approval?",
    note: "Cash, estimated in-kind value and budgets are separate measures. Only posted entries enter the cash totals.",
    roles: ["admin", "finance", "fundraising", "coordinator"],
  },
  sales: {
    title: "Asset sales",
    question: "What did we sell in the previous two months?",
    note: "Sales of donated assets are separate from new cash donations. The original asset and donor remain linked.",
    roles: ["admin", "finance", "fundraising"],
  },
  expenses: {
    title: "Expense categories",
    question: "How much went to salaries, rent, utilities and transport?",
    note: "Filter by category and fund. Unclassified historical entries remain visible as Uncategorized.",
    roles: ["admin", "finance", "coordinator"],
  },
  allocations: {
    title: "Fund allocations",
    question: "How was support divided between programmes?",
    note: "Transfers move existing money between funds. They are not new income or expenditure.",
    roles: ["admin", "finance"],
  },
  source_impact: {
    title: "Donor-funded services",
    question: "Which services and people are linked to a donor’s contribution?",
    note: "Uses recorded source-lot expenditure. People are counted once and only completed services count as delivered support. Shared costs have no invented beneficiary.",
    roles: ["admin", "finance", "fundraising"],
  },
  donors: {
    title: "Donor history",
    question: "Who gave, how often and in what form?",
    note: "Only posted cash and in-kind donations are counted. Asset-sale proceeds are excluded to avoid counting the same gift twice.",
    roles: ["admin", "finance", "fundraising"],
  },
  services: {
    title: "Services & outcomes",
    question: "Who received which support, when and through whom?",
    note: "Uses service dates. Completed services require an outcome. Distinct people are not the sum of programme counts.",
    roles: ["admin", "coordinator"],
  },
  hours: {
    title: "Employee & volunteer hours",
    question: "How much employee and volunteer time was approved?",
    note: "Employee and volunteer engagements stay separate. Submitted or rejected hours are excluded from approved-hour totals.",
    roles: ["admin", "coordinator", "finance", "fundraising"],
  },
  inventory: {
    title: "Donated items",
    question: "What was received, distributed, sold or still available?",
    note: "Opening and closing quantities use posted stock movements by business date. Valuation is not cash income.",
    roles: ["admin", "finance", "coordinator", "fundraising"],
  },
} as const;
export type ReportId = keyof typeof reportDefinitions;
export type ReportColumn = {
  key: string;
  label: string;
  type?: "money" | "date" | "number";
};
export type ReportMetric = {
  key: string;
  label: string;
  value: number;
  previous: number | null;
  type: "money" | "number";
};
export type ReportResult = {
  report: ReportId;
  title: string;
  note: string;
  scope: string;
  period: {
    preset: string;
    start: string;
    end: string;
    previous_start: string | null;
    previous_end: string | null;
    comparison_basis: string;
  };
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  metrics: ReportMetric[];
  total: number;
  page: number;
  page_size: number;
  months: {
    month: string;
    records: number;
    cash_in: number;
    cash_out: number;
    hours: number;
    completed: number;
  }[];
  breakdown: {
    label: string;
    records: number;
    cash_in: number;
    cash_out: number;
    in_kind: number;
  }[];
  options: {
    funds: { id: string; name: string }[];
    programs: { id: string; name: string }[];
    people: { id: string; name: string }[];
  };
};
export const expenseCategories: Record<string, string> = {
  uncategorized: "Uncategorized",
  salary: "Salaries & staff time",
  rent: "Rent & premises",
  utilities: "Utilities",
  transport: "Transport",
  supplies: "Supplies",
  external_service: "External service fees",
  events: "Events",
  other: "Other expenses",
};
