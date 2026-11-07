# Custom reports

Open **Reports & impact → Create report**. The existing nine standard reports remain available through **Standard reports**.

## Build a report

1. Choose a topic: contributions, asset sales, expenditure, fund allocations, donor-funded use, donor contributions, services, hours or donated stock. Available topics depend on your account role.
2. Choose **Detailed records** or **Grouped summary**, then select a calendar preset or custom dates. The default is the previous two complete calendar months; exact dates and the comparison period appear in the preview.
3. For details, choose up to 12 columns and use the arrows to order them. For a summary, choose one or two groupings, such as donor, programme, fund, category or month.
4. Select one to four compatible measures. Add up to eight filters, matching all or any condition. Amount filters use USD, for example `120.50`, rather than cents. Review-date filters use UTC+8.
5. Choose the display and sorting. A bar chart requires one grouping; a trend line requires one time grouping. A table is always available.
6. Click **Preview report**. Changing settings marks the previous preview as out of date and disables its export until you preview again.

A summary's **View records** button or chart bar opens its matching details. **Back to summary** restores the original view. **View details** shows selected fields; eligible receipt/source records can open **Trace original contribution**, including original donor, allocations, asset-sale proceeds and recorded use.

## Save and reopen

**Save report** stores a name, optional description and configuration in Neon. It does not store a frozen copy of financial or service results. Opening a saved report runs a fresh query with the current user's permissions.

Use **My reports** to open, duplicate, search or archive configurations. **Show archived reports → Restore** recovers an archived configuration. Open an existing report and use **Save changes** to rename it or update its rules, or **Save a copy** for a separate version. Conflicting simultaneous edits are rejected with a prompt to reopen or save a copy.

Saved reports are private to their owner. The foundation templates are starting configurations; modifying one does not alter another user's reports. If an account's role changes, saved definitions are revalidated and inaccessible configurations are redacted.

The administrator account has an initial **Expenditure by category** report using the previous two complete months and a bar chart.

## Interpretation and export

- Cash donations and asset-sale proceeds enter cash receipts only when posted. Sale proceeds are excluded from new-donation totals. Estimated in-kind value stays separate.
- Allocations move existing resources; they are neither new income nor expenditure.
- Donor-funded use has one row per original-source share of an expense. One expense may have several shares. Its expense and completed-service counts use distinct identities.
- Distinct beneficiaries and donors are calculated independently across all matching records. A person can occur in multiple groups, so adding group counts does not produce the overall distinct count. People with the same display name retain separate stable identities.
- Employee and volunteer hours remain separate. Unapproved hours are excluded from approved totals.
- Stock shows opening units, receipts, distributions, sales and closing units at the selected end date.
- Trends include zero-activity intervals within the selected dates. All-history trends begin at the first matching activity, avoiding years of empty chart intervals.
- Tables show 25 rows per page. **Export all matches** uses the selected fields, their order, all conditions and the same authorization rules, including rows beyond the current page. It exports CSV with USD amounts in currency units and protects spreadsheet formula cells.
- Exports above 20,000 rows require narrower dates or filters. Charts show at most 50 groups/intervals and disclose truncation. Tables and exports retain the full result.

These reports cover the current connected operational model. They do not introduce payroll, statutory accounting, grant management, supplier purchasing or bank settlement integrations.

## Technical implementation

- `lib/report-source.ts`: shared authorized SQL sources for standard and custom reports; identity keys and business grains are retained.
- `lib/report-builder-model.mjs`: role-specific catalogue, typed filters, measures, dimensions and strict versioned configuration validation. No user-provided SQL is accepted.
- `lib/report-builder-query.ts`: parameterized filtering, distinct measures, stable-identity grouping/drill-down, repeatable-read snapshots, pagination, zero-filled time charts and CSV.
- `GET /api/report-builder`: authorized catalogue and starting templates.
- `POST /api/report-builder`: `{definition,page?,format?}`; format is `json` or `csv`. Field, filter, measure, grouping and drill rules are revalidated on every call.
- `GET /api/saved-reports?archived=1`: current owner's configurations, optionally including archived ones.
- `POST /api/saved-reports`: save, archive or restore, with expected version, ownership checks and attributable audit events. Client-generated UUIDs and exact retries prevent duplicated configurations.
- `db/custom-reports.sql`: `saved_reports` table (`owner_id`, name, description, JSONB definition, version, timestamps and `archived_at`); the standard migration applies this idempotently.

Validation: `npm test`, `npm run typecheck`, `npm run build`; with a local server, `node --env-file=.env.local scripts/custom-reports-integration-test.mjs` and `node --env-file=.env.local scripts/reports-integration-test.mjs`. The builder integration script creates only its own report settings, verifies persistence/ownership/version/audit/restore, and removes its exact UUIDs and test sessions in `finally`. It does not create business transactions.
