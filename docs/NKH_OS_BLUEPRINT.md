# NKH OS — approved architecture / Sprint 1
Four primary departments:
- Operations: hotel calendars, reservations, arrivals/departures, audit, shifts, tasks, guest communication, FAQs.
- Finance: Service Fees 2026 and Monthly Accounts, agreements-based billing, invoices, receipts, expenses, payroll, advances, OTA settlements, profit and cash flow.
- Sales & Revenue: occupancy, pricing, competitors, promotions, OTA listings, marketing and sales pipeline.
- Administration: staff, roster, performance, client/property profiles, agreements, documents, academy.
Executive overview, AI, reports, notifications and settings are global, not extra departments.

## Data and migration
Reuse existing property/staff UUIDs, task and calendar structures. Master Work maps to Operations and Administration. Hotel calendars start read-only, with per-property mapping, sync timestamps and exception handling. Finance imports are read-only and retain source row provenance, effective-dated fee/payroll rules, decimal money, reconciliation and approval. Separate client OTA funds from company revenue. Do not change source files or live database. No financial figures or credentials belong in this repository.

## Security foundation
New modules use deny-by-default capability policy and server authorization with current active staff record, login enabled and role agreement. Master alone gets finance and executive access by default. Supervisor operational and revenue management; Team assigned operations and own payroll only. Resource-level ownership is mandatory; a capability alone does not grant access to every row. Legacy routes are unchanged pending caller inventory and regression testing. Do not use legacy broad property helper for new finance routes.
Next: immutable session identity, independent session secret, revocation, rate limiting, MFA, endpoint migration, RLS/grants review, audit logs, isolated staging database and test fixtures. No production migrations or deployment until approved.
## Release gate
Branch only. Vercel branch auto-deployment disabled in branch configuration; verify external integration settings separately. Run typecheck, lint, build, permission tests and operational regression tests before any merge. Confirm staging has no production write credentials. Reconcile all imported financial records before cutover.
