import type { ReportId, ReportColumn } from "./report-config";
export type BuilderDefinition = {
  version: 1;
  dataset: ReportId;
  mode: "details" | "summary";
  columns: string[];
  metrics: string[];
  groupBy: string[];
  period: string;
  start?: string;
  end?: string;
  filters: { field: string; op: string; value: string; to?: string }[];
  match: "all" | "any";
  display: "table" | "bar" | "line";
  chartMetric: string;
  sort: { key: string; direction: "asc" | "desc" };
  drill: { field: string; value: string | null; identity?: string | null }[];
};
export type BuilderDataset = {
  key: ReportId;
  title: string;
  grain: string;
  fields: {
    key: string;
    label: string;
    type: string;
    group: boolean;
    values?: Record<string, string>;
  }[];
  dimensions: { key: string; label: string; type: string; temporal: boolean }[];
  metrics: { key: string; label: string; type: string; description: string }[];
  defaults: string[];
  defaultMetrics: string[];
};
export type BuilderCatalogue = {
  datasets: BuilderDataset[];
  templates: {
    id: string;
    name: string;
    description: string;
    definition: BuilderDefinition;
  }[];
  periods: Record<string, string>;
};
export type BuilderRow = Record<
  string,
  string | number | null | BuilderDefinition["drill"]
>;
export type BuilderResult = {
  definition: BuilderDefinition;
  period: {
    start: string;
    end: string;
    previous_start: string | null;
    previous_end: string | null;
    comparison_basis: string;
  };
  scope: string;
  grain: string;
  columns: ReportColumn[];
  rows: BuilderRow[];
  total: number;
  page: number;
  page_size: number;
  matching_records: number;
  totals: {
    key: string;
    label: string;
    type: string;
    value: number;
    previous: number | null;
  }[];
  chart: { rows: BuilderRow[]; limit: number; total: number };
  computed_at: string;
};
export type SavedReport = {
  id: string;
  name: string;
  description: string;
  definition: BuilderDefinition;
  version: number;
  updated_at: string;
  archived_at: string | null;
  available?: boolean;
  unavailable_reason?: string;
};
