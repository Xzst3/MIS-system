# The Elder Care Foundation

Two English web experiences, one shared Neon Postgres database:

- Public portal: mission, seven service areas, resource library, support requests, volunteer/partner interest and donation pledges.
- Team workspace: username/password login, role-based access, client pathways, referrals, donors, partners, volunteers, tasks, CSV exports and reports.
- Demo workspace: fictional records in browser storage, completely separate from live database records.

## Project location

The working repository is C:\Users\Asus\Desktop\system\MIS-system. Source, dependencies, local secrets and build files live here. There is no development copy in Documents/Codex.

## Stack

Next.js App Router, React, TypeScript, custom responsive CSS, Lucide icons and the Neon serverless Postgres driver. Public and internal pages share the same server-side API and database. Vercel hosts the application; the Neon Free resource is connected through Vercel Marketplace.

## Local development

Use Node 22 or later. From this directory:

1. npm install --registry=https://registry.npmjs.org
2. Copy .env.example to .env.local and set DATABASE_URL, or use the already configured ignored .env.local.
3. npm run db:migrate
4. npm run dev
5. Open http://localhost:3000.

For production verification: npm run build then npm run start.
Next.js loads .env.local for serving. The migration command loads it explicitly. On Vercel the database integration supplies DATABASE_URL, and the build applies idempotent schema creation before compiling.

## Entry points

| URL                 | Purpose                                     |
| ------------------- | ------------------------------------------- |
| /                   | Public foundation portal                    |
| /services           | Seven information and navigation areas      |
| /resources          | Searchable introductory articles            |
| /get-support        | Initial support request                     |
| /get-involved       | Volunteer and professional partner interest |
| /donate             | Donation pledge, without charging money     |
| /login              | Staff and volunteer login                   |
| /activate#token=... | One-time invited account activation         |
| /workspace          | Protected operational workspace             |
| /demo               | Interactive fictional preview               |

## Virtual demonstration accounts

Run npm run accounts:seed once after configuring the database. This creates four fictional username/password accounts: admin, coordinator, fundraising and volunteer. Private generated passwords are saved in .local/TEST_ACCOUNTS.md and are never committed. No real email address is required. The bootstrap is resumable and never changes existing account passwords.

## Additional administrator invitations

Run this after a deployment URL is known:
npm run admin:create -- --username=new.admin --origin=https://your-deployment.example --name="Your Name"

This creates a username-based administrator with no password and saves a private, 24-hour activation link in .local/admin-invitation.txt. Open the link and choose a password of at least 12 characters. Never commit or publicly share the link. The administrator can invite teammates, choose roles, reissue activation links for password resets and deactivate accounts. Invitations are shared privately; usernames do not need an email address.

## Access model

| Role          | Access                                                           |
| ------------- | ---------------------------------------------------------------- |
| Administrator | All sections and team administration                             |
| Coordinator   | Clients, referrals, partners, tasks, coordination reports        |
| Fundraising   | Donors, volunteers, tasks, fundraising reports                   |
| Volunteer     | Read-only partner directory and only tasks assigned to that user |

Every data request checks the authenticated user on the server. Changing the UI or visiting another URL cannot grant access. Volunteers can update only their own assigned tasks. Unauthenticated users cannot read any operational records.

## Database and initial data flow

- users: virtual usernames, display names, roles, salted password hashes and active state.
- sessions: hashed opaque session tokens with eight-hour expiry.
- invitations: hashed one-time tokens with 24-hour expiry.
- records: clients, referrals, donors, partners, volunteers and tasks.
- submissions: public request and consent receipts.
- audit_log: staff record mutations and account administration.
- rate_limits: shared persistent request counters.

A support request creates a client record marked New. Volunteer/partner interest creates a volunteer interest record marked New. A donation pledge creates a donor record marked Pledged. Staff can review and edit record details and coordination notes, update status, assign tasks and export authorized records. Public submission receipt and business record are inserted in one database transaction.

This first phase deliberately uses a compact shared records model. A subsequent business analysis can normalize client assessments, referral relationships, provider vetting, household contacts, recurring gifts and product fulfillment without changing the two-entry-point approach.

## Implemented safeguards

Passwords use Node scrypt with a unique random salt. Session cookies are HttpOnly, SameSite=Lax and Secure in production. Session and invitation tokens are random and stored only as SHA-256 digests. Activation tokens use URL fragments, then are removed from the address bar. Password activation invalidates existing sessions. Deactivation revokes sessions and outstanding invitations.

Mutations require a matching Origin header. Inputs use Zod validation. Public forms require consent and include a honeypot. Login and public submissions are rate limited in Postgres. CSV export neutralizes spreadsheet formula prefixes. Private API responses disable caching. No credentials or real example data are committed.

## Validation

- npm run typecheck
- npm test
- npm run build
- With a local production server running: node --env-file=.env.local scripts/integration-test.mjs

The integration script only targets localhost. It creates randomly named temporary test identities and checks actual authentication, server-side permissions, assignment isolation, public-to-internal persistence, invitation replay protection, deactivation and logout. Its finally block removes its test users, records, submissions and rate counters. It does not insert demo records.

## Scope boundaries for phase one

- Donations are pledges and manual staff records. No online payment is charged. An approved HTTPS hosted checkout may optionally be linked through NEXT_PUBLIC_DONATION_URL.
- Resource articles are readable now. Paid e-guides, automatic delivery, auctions and event checkout are future work; none are presented as active.
- Self-service password recovery and automated scheduling are not configured. Administrators share activation links privately.
- No real partner names, testimonials, impact metrics or events are fabricated on the public portal.
- The foundation must confirm its privacy contact, retention schedule and detailed operating workflows before using this as a complete production case-management service.
- List pages currently return the latest 500 records in each authorized section. Reports and exports reflect these loaded records.

## Image assets

Two original editorial images were made with the built-in imagegen tool and converted to optimized WebP. They illustrate the mission and do not represent actual clients, staff or testimonials. Their prompts and paths are recorded in docs/IMAGE_ASSETS.md.

## Deployment

The GitHub repository is Xzst3/MIS-system and the connected Vercel project is xzst333/mis. Push main to trigger deployment. Keep .env.local, .local, node_modules and .next out of Git. Use Vercel environment variables for production secrets. Do not put the PDF, private invitations, database URLs or operational exports in the public repository.
