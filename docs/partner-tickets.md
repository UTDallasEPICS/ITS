# Partner ticket API

From the dashboard, choose **New ticket** to open `/tickets/new`. The page loads
the partner's projects and submits the reusable form to the ticket API. On success
it shows the saved ticket number and status; on failure it keeps the draft for retry.
**Submit another ticket** starts a fresh form after a successful save.

These endpoints require the session provided by the existing authentication middleware.
They read the user's current organization from the database. A user without an
organization receives HTTP 403; this API does not provide NPTS-wide project access.

- `GET /api/projects`: returns the partner organization's project IDs and names, sorted by name.
- `POST /api/tickets`: accepts a JSON object containing only `projectId` (a positive
  integer), `title`, and `description` (nonblank strings). Text is trimmed before saving.
  Returns HTTP 201 with the saved ticket. The server assigns its author from the session,
  initial status `open`, and an ISO 8601 timestamp. Missing or inaccessible projects
  both return HTTP 404; invalid input or extra fields return HTTP 400.

`open` is the initial status convention for this submission slice. Coordinate later
status transitions with the NPTS ticket workstream.

GitHub issue creation (REQ-F-14) is not implemented by this endpoint yet:
`githubIssueId` remains null. Connecting the GitHub integration is remaining work;
local ticket creation alone does not fulfill that requirement.

The reusable `TicketForm` receives `{ id, name }[]` through its `projects` prop and
emits a `submit` event with `{ projectId, title, description }`. Its parent must handle
the API request, set the `submitting` prop while saving, and display success or failure.
The form retains its draft so a failed request does not erase the user's input.
