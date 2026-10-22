# ADR 002: Shared ticket routes and screens

- Status: accepted route/ownership decision; implementation added locally on 2026-10-22
- Workstreams: [Partner #5](https://github.com/UTDallasEPICS/ITS/issues/5) and [NPTS #6](https://github.com/UTDallasEPICS/ITS/issues/6)
- Decision source: [Aryan/Seth agreement on #37](https://github.com/UTDallasEPICS/ITS/issues/37#issuecomment-6197699350), mirrored by #49

## Context and decision

Both workstreams read the same tickets. Use shared routes and screens with server-enforced
project scoping. Aryan implements the shared reads, content editing, screens, form, list,
status display and filters. Seth owns NPTS status mutations (#48) and is the proposed NPTS reviewer.

| Route                           | Behavior                                               | Owner     |
| ------------------------------- | ------------------------------------------------------ | --------- |
| `GET /api/projects`             | Accessible projects                                    | Aryan     |
| `POST /api/tickets`             | Create in an accessible project                        | Aryan     |
| `GET /api/tickets`              | Organization-scoped partner list; all tickets for NPTS | Aryan     |
| `GET /api/tickets/:id`          | Detail with the same scope                             | Aryan     |
| `PATCH /api/tickets/:id`        | Author edits title/description of an open ticket       | Aryan     |
| `PATCH /api/tickets/:id/status` | NPTS-only status mutations; not implemented here       | Seth, #48 |

Use `/tickets`, `/tickets/:id` and `/tickets/new`, with `TicketForm`, `TicketList` and
`TicketStatusBadge`. The detail header marks where #48's status control belongs; it must
refresh the detail/list after saving and enforce NPTS access on the server.

## Access and contracts

`server/utils/ticket-access.ts` reads the current database account on every request.
Existing accounts with `orgId === null` are NPTS. Partners see tickets in every project
owned by their organization, including tickets created by colleagues. Deleted accounts
receive 403, signed-out requests 401, and missing/inaccessible tickets both 404.
A project filter cannot widen access. Caller-supplied role or organization fields are rejected.
The Identity/Roles workstream should retain these behaviors when replacing the helper.

The list returns `{ id, title, status, projectId, projectName, timestamp }[]`, ordered by
creation timestamp descending then ID descending. Optional API query parameters are
`projectId` (positive decimal integer) and `status` (nonblank exact string). Invalid or
unknown parameters return 400; an inaccessible/missing project filter returns 404.
The current UI filters the already scoped array locally. Pagination remains future work.

Detail adds `description`, nullable `userId`, `submitterName`, `githubIssueId`,
`githubIssueUrl`, and `canEdit`. Only validated repository/issue-number pairs produce a
GitHub URL. No user email, session, or credential fields are returned. Shared response
types derive ticket fields from the existing Drizzle schema in `shared/tickets.ts`.

The author may edit only title and description while status is exactly `open`; this
implementation policy was selected by Aryan on 2026-10-22. NPTS does not gain an override
for content edits. The transaction checks current access, author and status before writing.
Status, author, project, timestamps and GitHub identifiers cannot be edited through this API.

## Consequences and outstanding integrations

- `timestamp` means creation time. There is no last-updated column; neither screen labels
  it as an update time. Coordinate a migration with #3/#48 before adding that field.
- Status is free text in the current schema. Display/filter existing values without defining
  a competing status enum. #3/#48 must agree allowed values and transitions.
- Refresh and subsequent navigation read current status. This slice does not provide live push.
- `shared/tickets.ts` provides creation/content validation for form and API. Authenticated
  creation goes through `server/utils/create-ticket.ts`; the widget's public identity/site-tag
  contract and shared persistence integration remain with #3/#7.
- GitHub creation/edit synchronization remains with #8. Open PR #66 touches the create route;
  reconcile it with the extracted helper so integration is not bypassed by future callers.
- Nuxt UI remains a widget dependency; #7 still needs to confirm the form in its actual bundle.
- The milestone requires an owner demonstration. Passing local tests is implementation
  evidence, not a claim that the demonstration, merge, deployment or issue closure happened.
