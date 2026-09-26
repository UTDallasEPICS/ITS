# Requirements

These are the baseline requirements satisfied by this template. A team adopting the
template inherits everything below as **Verified**, then appends their own project
requirements as new rows.

## 1. Requirement Matrix

Use the matrix below to track requirements throughout the project lifecycle.

- **Category:** Functional (REQ-F), Non-Functional (REQ-NF)
- **Status:** Backlog, In-progress, Verified, Deferred, Deprecated
- **Mapping:** baseline requirements map to the source that implements them; project
  requirements you add should map to a GitHub issue.

| ID        | Description                                                                                      | Status   | Target Semester | Mapping (source / issue)                     |
| --------- | ------------------------------------------------------------------------------------------------ | -------- | --------------- | -------------------------------------------- |
| REQ-F-01  | Passwordless sign-in via email OTP (Better Auth + Nodemailer); OTP emailed to an existing user   | Verified | 2026F           | `server/utils/auth.ts`, `app/pages/auth.vue` |
| REQ-F-02  | Server API gateway rejects unauthenticated requests to non-public routes with HTTP 401           | Verified | 2026F           | `server/middleware/auth.ts`                  |
| REQ-F-03  | Client route guard redirects signed-out users to `/auth` and signed-in users away from `/auth`   | Verified | 2026F           | `app/middleware/auth.global.ts`              |
| REQ-F-04  | Authenticated user can upload a profile image, stored per-user under the configured storage path | Verified | 2026F           | `server/api/users/upload.post.ts`            |
| REQ-F-05  | Profile image is served with its `Content-Type` detected from file contents (magic bytes)        | Verified | 2026F           | `server/api/users/[id]/profile.get.ts`       |
| REQ-F-06  | User-list endpoint returns only non-sensitive fields and never leaks image storage paths         | Verified | 2026F           | `server/api/users/index.get.ts`              |
| REQ-F-07  | Unauthenticated `/api/health` endpoint returns HTTP 200 for load-balancer probes                 | Verified | 2026F           | `server/api/health.ts`                       |
| REQ-F-08  | Project partners can check ticket status through ITS                                             | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-09  | Project partners can submit tickets for their projects                                           | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-10  | NPTS members can view all tickets                                                                | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-11  | NPTS members can update ticket status                                                            | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-12  | EPICS students and mentors participate through GitHub issues without direct ITS access during the MVP | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-13  | An embeddable component lets project sites submit tickets through a script and site tag          | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-14  | ITS tickets can be linked to GitHub issues for user-submitted tickets                            | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-15  | Ticket creation can capture local debugging context, such as console output, errors, current route, screenshots, and available server information, alongside the user's description | Deferred | TBD             | GitHub issue: TBD                            |
| REQ-F-16  | Project partners and NPTS developers can communicate through persistent real-time chat threads - persistent, not tied to a specific issue (MVP stretch goal) | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-17  | Chat supports rich text and media uploads to assist with debugging                               | Deferred | TBD             | GitHub issue: TBD                            |
| REQ-F-18  | End users submitting tickets through in-site embeddable script can create temporary chat thread with NPTS developers tied to their ticket | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-19  | Product users can submit tickets through the web app for partner review before forwarding to NPTS | Deferred | TBD             | GitHub issue: TBD                            |
| REQ-F-20  | EPICS students and mentors sign in to ITS with GitHub OAuth; ITS access is granted only when the user has write permission to the relevant ITS-managed GitHub repositories | Deferred | TBD - next semester, after initial MVP | GitHub issue: TBD |
| REQ-F-21  | ITS access for EPICS students and mentors is provisioned automatically from GitHub repository permissions (e.g., periodic permission check), requiring no manual semester-based access grants | Deferred | TBD - next semester, after initial MVP | GitHub issue: TBD |
| REQ-F-22  | ITS access for EPICS students and mentors is revoked automatically when GitHub repository access is lost (project departure or semester rollover), requiring no manual deprovisioning or cleanup | Deferred | TBD - next semester, after initial MVP | GitHub issue: TBD |
| REQ-F-23  | Create documentation (public how to page, README, etc) on how to integrate the embeddable widget | Backlog | 2026F | GitHub issue: TBD |
| REQ-F-24  | NPTS members can add NPTS members and project partners to ITS by email, so they can sign in (sign-in requires an existing user, REQ-F-01) | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-25  | NPTS members can remove a user, immediately revoking their ITS access and ending their active sessions | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-26  | NPTS members can set a user's role (NPTS member or project partner) and assign project partners to the projects whose tickets they can access | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-F-27  | NPTS members can create and manage projects, including each project's partner organization, embeddable-widget site tag, and linked GitHub repository | Backlog  | 2026F           | GitHub issue: TBD                            |
| REQ-NF-01 | Persistence is type-safe: Drizzle ORM schema with generated Zod select/insert schemas            | Verified | 2026F           | `server/db/schema.ts`                        |
| REQ-NF-02 | CI runs lint, type-check, and the Vitest suite on every PR and on `dev`/`stage`/`prod` pushes    | Verified | 2026F           | `.github/workflows/test.yml`                 |
| REQ-NF-03 | Deploy pipeline order is build → migrate → push → deploy, so a failed migration never ships       | Verified | 2026F           | `.github/workflows/deploy.yml`               |
| REQ-NF-04 | `stage`/`prod` auto-deploy to AWS ECS via GitHub OIDC — no static AWS keys stored                | Verified | 2026F           | `.github/workflows/{stage,prod}.yml`         |
| REQ-NF-05 | App ships as a container image with the toolchain to compile native modules in the builder       | Verified | 2026F           | `Dockerfile`                                 |
| REQ-NF-06 | Test baseline runs with no `.env`, database, email, or browser (`pnpm test` works on clone)      | Verified | 2026F           | `vitest.config.ts`, `tests/`                 |
| REQ-NF-07 | Dependency versions are pinned for reproducible, deploy-safe builds                              | Verified | 2026F           | `package.json`                               |
| REQ-NF-08 | Only NPTS members and project partners interface directly with the ITS system; EPICS students and mentors participate only through GitHub issues during the MVP, and ad-hoc EPICS ↔ project-partner communication happens through the Project Liaison, not ITS | Backlog  | 2026F           | Project brief (Involved Parties & Notes) ^ move this to notes |

## 2. Change Log

Track major changes, additions, or deprecations to the project scope.

| Date       | Requirement ID | Change Description                                                                   | Author      | Approved By |
| ---------- | -------------- | ------------------------------------------------------------------------------------ | ----------- | ----------- |
| 2026-08-23 | REQ-F/NF-\*    | Established the initial requirements register from the template baseline             | @TusharW4ni | —           |
| 2026-08-23 | REQ-NF-07      | Pinned `better-auth@1.6.23` and `better-sqlite3@12.11.1` to keep the deploy build and migration Lambda working | @TusharW4ni | —           |
| 2026-08-23 | REQ-NF-05      | Added `python3`/`make`/`g++` to the Docker builder so native modules compile         | @TusharW4ni | —           |
| 2026-09-19 | REQ-F-08–14   | Added MVP project requirements for ticket submission, status tracking, NPTS access, GitHub issue integration, and EPICS access boundaries from the project brief | TBD         | —           |
| 2026-09-19 | REQ-F-15–19   | Recorded later-scope ideas for debugging context, chat, product-user tickets, and GitHub-based EPICS access | TBD         | —           |
| 2026-09-22 | REQ-F-16      | Revised real-time chat from Deferred/TBD to Backlog/2026F, since the project brief marks it an MVP stretch goal | TBD         | —           |
| 2026-09-22 | REQ-NF-08     | Added MVP access/communication constraint: only NPTS and project partners interface with ITS; EPICS participates via GitHub issues; ad-hoc partner communication stays on the Project Liaison | TBD         | —           |
| 2026-09-22 | REQ-F-15–19   | Recorded brief context, the 2026-09-17 chat answer, lifecycle note, and auto-provisioning rationale in Scope Decisions & Notes | TBD         | —           |
| 2026-09-22 | REQ-F-20–22   | Expanded GitHub-OAuth access scheme: permission-gated sign-in, automatic provisioning, and automatic deprovisioning synced to GitHub repo permissions — removes the manual semester provisioning/deprovisioning blocker | TBD         | —           |
| 2026-09-25 | REQ-F-18      | Moved end-user chat from Deferred/TBD to Backlog/2026F: it must be at least roughly working this semester | Jason Antwi-Appah | —           |
| 2026-09-25 | REQ-F-24–26   | Added user management: NPTS adds users, removes users, and sets roles and partner project assignments | Jason Antwi-Appah | —           |
| 2026-09-25 | REQ-F-27      | Added NPTS project management (partner organization, widget site tag, GitHub repository), which the widget and GitHub integration depend on | Jason Antwi-Appah | —           |
| 2026-09-25 | REQ-F-14, REQ-F-18 | Recorded answers on end-user chat identity and when GitHub issues are created in Scope Decisions & Notes | Jason Antwi-Appah | —           |

## 3. Scope Decisions & Notes

Context, answered questions, and design decisions from the project brief that
constrain the requirements above.

### 3.1 Involved parties and ITS access (MVP)

| Involved Party  | ITS access / role in project maintenance                                                          | Requirement |
| --------------- | ------------------------------------------------------------------------------------------------- | ----------- |
| EPICS Students  | None at all — participates only through GitHub issues                                             | REQ-F-12    |
| EPICS Mentor    | None at all — participates only through GitHub issues                                             | REQ-F-12    |
| Project Partner | Can make tickets for their projects and check ticket status                                       | REQ-F-08    |
| Product User    | Not in MVP. Future: can raise tickets via the web app; tickets are reviewed by the project partner to verify they need forwarding to NPTS | REQ-F-19    |
| NPTS Members    | See all tickets and update ticket status                                                          | REQ-F-10    |

### 3.2 Answered questions

| Date       | Question                                                                                  | Answer | Affected Requirements |
| ---------- | ----------------------------------------------------------------------------------------- | ------ | --------------------- |
| 2026-09-17 | Should EPICS students be able to access chat (so they can talk to clients)? How/what does that look like? | No     | REQ-F-16 (chat scoped to project partners and NPTS developers only) |
| 2026-09-25 | End users have no ITS account. How do they get back to a temporary chat? | A token stored in their browser. A temporary chat is one end user working with NPTS on one issue in one browser session; it is linked to a ticket but has its own lifecycle | REQ-F-18 |
| 2026-09-25 | Is a GitHub issue created for every submitted ticket, or only after NPTS review? | Every submitted ticket | REQ-F-14 |

### 3.3 Decisions & constraints

- Only NPTS and project partners directly interface with the ITS system; EPICS students and mentors do not get ITS access during the MVP — solely because manually provisioning (and deprovisioning, then re-provisioning) access every semester would be unmanageable. → REQ-NF-08, §3.4
- Ad-hoc EPICS team ↔ Project Partner communication should happen through the Project Liaison as it does today, **not** through ITS. → REQ-NF-08
- Project lifecycle: EPICS students build the project, EPICS then hands it off to NPTS, who maintains it after initial development.
- Real-time chat is an MVP stretch goal, not a committed MVP feature. → REQ-F-16
- Capturing "local context" for developer debugging (console output, errors, current route, screenshots, server-side info) is not MVP but is a strong nice-to-have. → REQ-F-15

### 3.4 Rationale for deferred GitHub-based access control

EPICS students and mentors are excluded from ITS in the MVP **solely** because manually
provisioning access every semester (150+ members, dozens of projects, high turnover) —
then deprovisioning it when the semester ends and doing it all over again — would be
unmanageable.

The future scheme uses GitHub as the access-control list: repository access is already
managed out of band (students and mentors already hold permissions on the ITS-managed
repositories), so ITS can sign users in with GitHub OAuth and check, via the GitHub API
(e.g., a cron job), whether they have write permission to those repositories. Access is
then granted and revoked automatically in sync with GitHub — no manual provisioning or
deprovisioning at semester boundaries. → REQ-F-20, REQ-F-21, REQ-F-22

(End of file - total 106 lines)