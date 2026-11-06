# The Elder Care Foundation

Two English web experiences with a connected Neon Postgres database: a public foundation portal and a protected team workspace. The repository is located at `C:\Users\Asus\Desktop\system\MIS-system`.

Public site: https://mis-ecru-sigma.vercel.app/
Team login: https://mis-ecru-sigma.vercel.app/login
GitHub: Xzst3/MIS-system · Vercel: xzst333/mis

## Current experience

The public site introduces the foundation and its seven service areas with original editorial images. Visitors can leave an email request for a conversation, express volunteer/partnership interest, browse introductory resources and use an interactive giving checkout. Giving displays processing then a completion reference, records the donor/designation/consent and creates a financial review request. It does not charge money or issue a tax receipt. There is no public pledge workflow.

The connected workspace includes beneficiary journeys, service records, a shared people directory, employee/volunteer/donor engagements, hours review, fund balances, independently reviewed financial requests, restricted allocations, annual budgets, inventory and gift-to-expenditure traceability. The dashboard distinguishes posted amounts, pending requests, estimated in-kind value, completed services and approved volunteer hours.

The selected requirements, business rules, source/status, owners, priorities, acceptance evidence and provisional boundaries are recorded in [docs/ECF_REQUIREMENTS.md](docs/ECF_REQUIREMENTS.md). The group's forthcoming ER design may refine these structures.

## Development

Use Node 22 or later.

1. `npm install --cache .local/npm-cache --registry=https://registry.npmjs.org`
2. Set DATABASE_URL in the ignored `.env.local` (already configured in the working checkout).
3. `npm run db:migrate`
4. `npm run dev`
5. Open http://localhost:3000.

`npm run build` applies idempotent schema changes when DATABASE_URL is present, then compiles Next.js. Vercel supplies this variable through its Neon integration. For a local production preview use `npm run build` and `npm run start`. Windows compiler path resolution may need an unsandboxed execution context.

## Data model

- `people`: shared person/organization identity, contact preferences and coordination details.
- `person_engagements`: separately dated employee, volunteer, donor and beneficiary relationships, weekday availability and verification flags.
- `users`, `sessions`, `invitations`: username-based functional access, hashed credentials, sessions and activation.
- `service_records`: dated beneficiary support, programme, provider, assignment, status and outcome.
- `service_hours`: engagement-specific work and independent review.
- `programs`, `funds`, `fund_budgets`, `finance_policy`: purposes, restrictions, annual limits and delegation.
- `finance_requests`: unique business references, amount in USD cents, source, dates, evidence, review and purpose.
- `finance_lots`, `finance_postings`: original donor provenance and atomic fund movements.
- `inventory_items`, `inventory_movements`: physical donation source, quantities, distributions and sales.
- `submissions`: public contact/consent receipts and links into the workflow.
- `audit_log`: attributable decisions and changes; shared contact edits retain before/after JSON details.
- `records`: retained first-phase contacts, partner directory and task records. Monetary values in this legacy table are not the new financial ledger.
- `rate_limits`: persistent request counters.

Schema sources are `db/schema.sql`, `db/operations.sql` and `db/finance.sql`. The latter files use explicit statement breakpoints to preserve database functions. Calendar DATE values stay as YYYY-MM-DD strings; timestamps remain timestamps.

## Roles

| Account role | Principal access                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| admin        | All operational sections, independent financial decisions, delegation and account administration                              |
| finance      | Financial records, review within delegated authority, fund trace, donor relationships, own service assignments/hours          |
| coordinator  | Beneficiaries, services/referrals, people/workforce coordination, independent hours review, own expense/distribution requests |
| fundraising  | Donor and volunteer relationships, giving records, programme-level financial trace, own assignments/hours                     |
| volunteer    | Read-only partner directory, own tasks, assigned services and own eligible hours                                              |

Business engagements do not grant login permissions. Fundraising does not receive other beneficiaries' service details through financial responses. Coordinator finance views show their own requests and omit donor lookup data. A person who volunteers at weekends uses a separate engagement from weekday employment; hours are approved independently and do not trigger payroll.

## Financial flow

Record receipt/request → independent review → atomic posting → fund/stock update and audit history.

Cash and in-kind receipts are separate. Manually entered cash receipts require confirmation against external evidence; website checkout records carry `source=website_preview` and `settlement_confirmed=false`. Both require explicit review before entering the prototype ledger. No financial API initiates a bank transfer.

Fund transfers retain original donor lots and restrictions. Expenditure requires an approved annual budget and eligible available resources. A request cannot approve itself, and person-linked conflicts are also rejected. Concurrent decisions are serialized with database locks; idempotent references prevent duplicate results. Original bank/provider and invoice references are checked for duplication.

## Accounts and seed data

Private virtual credentials are in `.local/TEST_ACCOUNTS.md`; no real email address is required. Existing usernames and passwords were preserved. The finance username is included in that private file.

- `npm run accounts:seed`: resumable initial virtual account creation.
- `npm run workspace:seed`: original 27-record preview batch; never run by builds.
- `node --env-file=.env.local scripts/upgrade-workspace.mjs`: explicit, idempotent connected-workspace bootstrap. It links the original contacts, adds the finance account and a shared employee/volunteer/donor example, then creates dated service and financial examples with source provenance. It is never run automatically by deployment.

Private batch manifests are saved under `.local/`. Existing operational records are not overwritten by rerunning the bootstrap. Do not use the old batch-clear command to clear the connected model: it only identifies the original `records` rows. Future cleanup/migration should use the exact manifests and preserve separately created public requests, receipts and financial provenance.

Additional administrators can be invited with `npm run admin:create -- --username=new.admin --origin=https://your-deployment.example --name="Your Name"`. The administrator may also invite teammates in Team & permissions, then link their person and engagements in People & engagements. Activation is one-time and expires after 24 hours. No emails are automatically sent.

## Validation

- `npm run typecheck`
- `npm test`
- `npm run build`
- With a local server: `node --env-file=.env.local scripts/integration-test.mjs`
- With a local server: `node --env-file=.env.local scripts/business-integration-test.mjs`

Integration scripts reject non-localhost targets. They exercise the actual connected database with random temporary identities and exact scoped cleanup. Business checks include concurrent approval/overspend, designation restrictions, budget authority, inventory, asset-sale provenance, public checkout idempotence, separate engagements and hours, privacy filtering and intake visibility. Real prototype/example records remain intact.

## Images and deployment

Seven new service photographs were generated with the built-in image generation tool and saved as optimized WebP in `public/images/service-*.webp`. Exact prompts and reviews are in [docs/SERVICE_IMAGE_ASSETS.md](docs/SERVICE_IMAGE_ASSETS.md). Earlier image provenance is in docs/IMAGE_ASSETS.md. Editorial images illustrate service navigation and do not identify actual clients or staff.

Push `main` to the connected GitHub repository to trigger Vercel. Keep `.env.local`, `.local`, dependencies, build files and private credentials out of Git. The application remains an interim prototype: real payment-provider/bank reconciliation, payroll, international FX, procurement and a complete statutory accounting model are outside this release.
