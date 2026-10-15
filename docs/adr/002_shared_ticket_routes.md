# ADR 002: Shared partner and NPTS ticket routes

- **Status:** Accepted for shared routes, screens, and implementation ownership; detailed implementation questions below remain open
- **Agreement record:** Aryan confirmed on 2026-10-15 that he and Seth reviewed and agreed that Aryan will implement all shared ticket routes, screens, and components.
- **Deciders:** Aryan (Partner Ticket User Flows), Seth (NPTS Ticket User Flows)
- **Date:** 2026-10-15
- **Coordination:** [#37](https://github.com/UTDallasEPICS/ITS/issues/37), [#49](https://github.com/UTDallasEPICS/ITS/issues/49)
- **Workstreams:** [#5](https://github.com/UTDallasEPICS/ITS/issues/5), [#6](https://github.com/UTDallasEPICS/ITS/issues/6)
- **Published agreement:** [#37 decision](https://github.com/UTDallasEPICS/ITS/issues/37#issuecomment-6197699350), [#49 mirror](https://github.com/UTDallasEPICS/ITS/issues/49#issuecomment-6197704214)

## 1. Context & Problem Statement

Partners and NPTS both need ticket lists, details, and status displays. Separate
implementations would duplicate queries, access checks, and components. Partners
must see only tickets belonging to their organization's projects; NPTS can see all
projects and change ticket status.

PR #54 already provides ticket creation, project selection, and `TicketForm`.
There is also an uncommitted list-endpoint implementation on Aryan's local branch.
The agreement recorded here determines ownership of the remaining shared work;
it does not imply that the feature implementations are complete.

## 2. Decision Drivers

- Meet the partner and NPTS list milestones due October 18 without duplicate work.
- Enforce access on the server, using current database assignments.
- Share read routes and presentation while keeping status changes NPTS-only.
- Reuse the identity workstream's guards and data workstream's contracts when available.

## 3. Options Considered

1. **Shared routes and pages with permission-dependent controls.** One implementation
   for each read operation; requires tests for both partner and NPTS access.
2. **Separate partner and NPTS routes and pages.** Independent layouts, but duplicated
   queries, components, and permission logic can drift.

## 4. Decision

Use option 1. Aryan owns implementation of all shared ticket routes, screens, and
components. Aryan confirmed this ownership split was agreed with Seth. Seth is the
proposed NPTS reviewer for these shared pieces. Detailed response contracts and
editing rules remain proposals where explicitly marked below.

Issue #37 records the coordination decision. Feature implementation belongs in #35
(partner flow), #45 (NPTS list), and #46 (NPTS detail). NPTS-only status changes
remain in #48 under workstream #6; taking ownership of #37 does not reassign that work.

### API routes and ownership

| Route | Classification and access | Implementation owner |
| --- | --- | --- |
| `GET /api/projects` | Shared, scoped to accessible projects; already merged | Aryan |
| `POST /api/tickets` | Shared, create only in accessible projects; already merged | Aryan |
| `GET /api/tickets` | Shared; partners get their organization's tickets, NPTS gets all | Aryan |
| `GET /api/tickets/:id` | Shared; same project access rule as list | Aryan |
| `PATCH /api/tickets/:id` | Content editing; proposed title/description only; partner ownership and edit rules need agreement | Aryan |
| `PATCH /api/tickets/:id/status` | NPTS-only; allowed statuses/transitions need agreement | Seth |

Do not permit content updates to change status, project, author, or GitHub linkage.
For list/detail access, ownership means project organization, not ticket author.
For editing, confirm whether any member of that organization or only the submitter
may change the ticket, and whether closed tickets remain editable.

### Proposed read contracts

- List returns an array of `{ id, title, status, projectId, projectName, timestamp }`,
  ordered by creation timestamp descending, then ID descending. No matches returns `[]`.
- Detail returns those fields plus `description`, `userId` (nullable), and
  `githubIssueId` (nullable). Confirm any additional display fields with Seth before
  implementation; a GitHub identifier must not be assumed to be a URL.
- `timestamp` currently means creation time. The schema has no ticket `updatedAt`;
  agree a change with the data owner before promising last-updated information.
- List filtering by project/status and pagination are unresolved. Agree query
  parameters and response shape before wiring the NPTS filters; the local list
  implementation currently returns an unfiltered array within the caller's access.
- Read the saved status on each request. Provide a Refresh action in the UI; no
  automatic live-update guarantee is proposed here.

### Shared screens and components

| Page or component | Behavior | Implementation owner |
| --- | --- | --- |
| `/tickets` | Shared list; server-scoped data, status, loading/error/empty states, and agreed project/status filters | Aryan |
| `/tickets/:id` | Shared detail; status display, partner editing, and an integration point for Seth's NPTS status control | Aryan |
| `/tickets/new` | Existing shared creation page | Aryan |
| `app/components/TicketForm.vue` | Existing creation form, reusable by widget; edit/fixed-project support to agree | Aryan |
| `app/components/TicketList.vue` | Shared ticket rows with links to details | Aryan |
| `app/components/TicketStatusBadge.vue` | Shared display of saved status | Aryan |
| `app/components/TicketStatusControl.vue` | NPTS status change control; endpoint independently enforces access | Seth |

### Access checks

Use the existing session middleware and `requireUser()`. An existing account with
`orgId === null` is NPTS; a non-null organization restricts project access. A missing
account must never be treated as NPTS. Check the current account and project
assignment on every request, not caller-supplied role/organization fields.

Unauthenticated requests return 401; missing accounts return 403. Missing and
inaccessible ticket IDs should both return 404 to avoid disclosing other projects'
tickets. Hiding an edit control is not a substitute for API authorization.

PR #53 proposes reusable authorization guards but is not merged as of this draft.
Coordinate adoption with the identity owner when available. Keep access behavior
consistent across list, detail, creation, and updates.

Aryan will own a shared server query helper in `server/utils/ticket-access.ts` for
list/detail scoping so those handlers do not grow separate permission rules. It
will use the identity workstream's current-account guard when available, with the
same missing-account behavior described above. Mutations must check authorization
within the write transaction. The helper is proposed here, not implemented by this ADR.

## 5. Consequences & Next Steps

Shared routes reduce duplicate work. Aryan implements the shared pieces, while Seth
can add the NPTS-only status workflow to the shared detail screen. The detailed
response contracts must be settled before consumers depend on them.

- [x] Aryan reviews the proposal and volunteers to own every shared implementation piece.
- [x] Aryan confirms both owners reviewed and agreed on shared routes, screens, and ownership.
- [ ] Settle editing permissions, allowed statuses, read fields, filters, and pagination.
- [ ] Confirm the shared guard and data-contract integration with their owners.
- [x] Record the confirmed agreement, deciders, and date, with its accepted scope and open questions.
- [x] Post the agreement on #37 and link it from #49, referencing workstreams #5 and #6.
- [ ] Update implementation issues #35, #45, #46, and #48 to match the agreement.
- [ ] Verify resulting implementations follow the agreed routes before closing #37.

The agreement above is recorded based on Aryan's confirmation. Implementation
verification remains outstanding; this ADR does not claim completion of #35, #45,
#46, #48, or the semester workstreams.
