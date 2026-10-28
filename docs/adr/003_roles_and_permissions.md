# ADR 003: Roles and Permissions

- **Status:** Proposed
- **Deciders:** Jin Jeong, Tushar Wani
- **Date:** 2026-10-27
- **Related:** Issue #41

---

## 1. Context & Problem Statement

The ITS application needs a consistent authorization model for the permission-management work described in issue #41. The model must distinguish internal NPTS users from partner users, constrain partner access to the projects assigned to their organization, and provide one policy that can be applied consistently across tickets, chat, users, projects and organizations, and public routes.

The team has agreed on the following identity and project-scope rules:

- A user whose `orgId` is `null` is an **NPTS member**.
- A user whose `orgId` is non-null is a **partner member** of that organization.
- A partner obtains access to a project through the relationship between the user's organization and `project.projectPartnerId`.
- Therefore, a partner is in scope for a project only when `user.orgId === project.projectPartnerId`.

These rules establish resource scope, but they do not by themselves settle every action-level permission. Issue #41 must not be implemented as a collection of UI-only checks or assumptions that are inconsistent across routes. Server-side authorization remains authoritative; the UI may mirror it for usability but must not be the security boundary.

---

## 2. Decision Drivers (Goals & Constraints)

- **Consistent enforcement:** The same authorization rules must apply to pages, APIs, server actions, and other protected entry points.
- **Tenant isolation:** A partner must not read or mutate data belonging to another partner organization.
- **Clear internal/partner classification:** Membership is derived from `orgId`, using the team-agreed null/non-null meaning.
- **Project-based partner scope:** Partner project access is derived through `project.projectPartnerId`, not through a separate, implicit client-side mapping.
- **Least privilege:** Missing or unresolved permissions must default to deny until the team explicitly approves them.
- **Traceability:** Permission decisions must be reviewable against issue #41 and this ADR.
- **Maintainability:** Authorization logic should be centralized enough to avoid route-by-route drift.
- **Defense in depth:** Hiding a button is not authorization; protected operations require server-side checks.
- **MVP focus:** The initial model should avoid introducing a general-purpose RBAC/ABAC administration system before its requirements are known.

---

## 3. Options Considered

### Option 1: UI-only permission checks

Conditionally show pages, navigation items, and actions based on the current user's `orgId` and the selected project.

- **Pros:**
  - Fast to implement for the permission-management screen.
  - Gives users immediate visual feedback.
- **Cons:**
  - Does not protect APIs or server actions.
  - Can be bypassed by direct requests.
  - Encourages duplicated and inconsistent rules.

### Option 2: Centralized server-side policy using membership and project relationships

Classify users from `orgId`, resolve project scope through `project.projectPartnerId`, and evaluate action permissions in a shared server-side authorization layer. The UI consumes or mirrors the resulting capabilities.

- **Pros:**
  - Enforces tenant isolation at the security boundary.
  - Uses the team-agreed data relationships without adding a parallel source of truth.
  - Supports consistent rules across tickets, chat, users, and project/organization resources.
  - Can evolve from MVP rules into more granular policies later.
- **Cons:**
  - Requires authorization checks to be integrated into every protected operation.
  - Action-level permissions still require explicit product and team decisions.
  - Policy tests and audit-friendly error handling add implementation work.

### Option 3: Full configurable RBAC/ABAC system

Introduce stored roles, permissions, assignments, policy expressions, and an administration interface.

- **Pros:**
  - Supports fine-grained and configurable permissions.
  - Can accommodate future roles without changing every endpoint.
- **Cons:**
  - Adds schema, UI, migration, and operational complexity.
  - Exceeds the currently agreed requirements.
  - Risks encoding unresolved permissions as premature product decisions.

---

## 4. Decision & Justification

**Chosen Option:** Option 2 — Centralized server-side policy using membership and project relationships

### Rationale

ITS will derive the user's membership class from `orgId` and determine partner project scope by comparing the user's organization with `project.projectPartnerId`.

The minimum agreed policy is:

1. `user.orgId === null` identifies an NPTS member.
2. `user.orgId !== null` identifies a partner member of that organization.
3. For a project-scoped resource, a partner is in scope only when the resource resolves to a project for which `user.orgId === project.projectPartnerId`.
4. A partner request that cannot be resolved to an in-scope project is denied.
5. Scope does not automatically grant every action. The permission matrix below distinguishes agreed scope rules from unresolved action permissions.
6. Unauthenticated access is denied except for routes explicitly designated as public.
7. Server-side policy checks are authoritative. Client-side checks are only a presentation aid.
8. Any permission marked **Open / TBD** is denied in the MVP until a team decision is recorded and reviewed.

This option is preferable because it enforces the agreed organization-to-project boundary without the complexity of a configurable authorization platform. It also leaves unresolved product decisions visible rather than silently inventing them.

### Authorization evaluation order

For a protected request, the implementation should evaluate:

1. Is the user authenticated?
2. Is the route or operation explicitly public?
3. Is the user an NPTS member or a partner member, based on `orgId`?
4. If the resource is project-scoped, what project owns it?
5. For a partner, does `user.orgId` equal that project's `projectPartnerId`?
6. Is the requested action explicitly allowed for that membership class?

Failure at any required step results in denial. The application should avoid revealing the existence of out-of-scope tenant data.

### Permission matrix

Legend:

- **In scope:** The agreed relationship permits the request to proceed to an action-level permission check; it does not itself grant the action.
- **Open / TBD (deny):** No team agreement is recorded. Deny for MVP until resolved.
- **Public:** Authentication is not required, subject to route-specific validation and abuse controls.
- **N/A:** The operation does not apply to that actor.

| Area            | Resource / action                          |       NPTS member |                                                                                                               Partner member |   Unauthenticated | Notes                                                                                                             |
| --------------- | ------------------------------------------ | ----------------: | ---------------------------------------------------------------------------------------------------------------------------: | ----------------: | ----------------------------------------------------------------------------------------------------------------- |
| Tickets         | List/search tickets                        | Open / TBD (deny) | In scope only when ticket resolves to a project where `orgId === project.projectPartnerId`; action remains Open / TBD (deny) |              Deny | Query filtering must occur server-side.                                                                           |
| Tickets         | View ticket details                        | Open / TBD (deny) |                                                                  In-scope project required; action remains Open / TBD (deny) |              Deny | Do not disclose out-of-scope ticket existence.                                                                    |
| Tickets         | Create ticket                              | Open / TBD (deny) |                                                                  In-scope project required; action remains Open / TBD (deny) |              Deny | Project selection must be validated, not trusted from the client.                                                 |
| Tickets         | Edit ticket fields                         | Open / TBD (deny) |                                                                  In-scope project required; action remains Open / TBD (deny) |              Deny | Field-level restrictions are unresolved.                                                                          |
| Tickets         | Change status/assignment/priority          | Open / TBD (deny) |                                                                  In-scope project required; action remains Open / TBD (deny) |              Deny | Workflow-transition permissions are unresolved.                                                                   |
| Tickets         | Delete/archive ticket                      | Open / TBD (deny) |                                                                  In-scope project required; action remains Open / TBD (deny) |              Deny | Retention and soft-delete behavior are unresolved.                                                                |
| Tickets         | Add/view attachments                       | Open / TBD (deny) |                                                                  In-scope project required; action remains Open / TBD (deny) |              Deny | Storage URLs must not bypass authorization.                                                                       |
| Chat            | View ticket/project chat history           | Open / TBD (deny) |                                                                  In-scope project required; action remains Open / TBD (deny) |              Deny | Chat inherits project scope from its owning ticket/project.                                                       |
| Chat            | Send message                               | Open / TBD (deny) |                                                                  In-scope project required; action remains Open / TBD (deny) |              Deny | Message authorship and rate limits still apply.                                                                   |
| Chat            | Edit/delete own message                    | Open / TBD (deny) |                                                                  In-scope project required; action remains Open / TBD (deny) |              Deny | Edit window and deletion semantics are unresolved.                                                                |
| Chat            | Moderate another user's message            | Open / TBD (deny) |                                                                                                            Open / TBD (deny) |              Deny | No moderator role has been agreed.                                                                                |
| Users           | View own profile                           | Open / TBD (deny) |                                                                                                            Open / TBD (deny) |              Deny | Authentication alone does not document the product decision.                                                      |
| Users           | Edit own profile                           | Open / TBD (deny) |                                                                                                            Open / TBD (deny) |              Deny | Editable fields are unresolved.                                                                                   |
| Users           | List/view NPTS users                       | Open / TBD (deny) |                                                                                                            Open / TBD (deny) |              Deny | Directory visibility is unresolved.                                                                               |
| Users           | List/view partner users                    | Open / TBD (deny) |                                                                                                            Open / TBD (deny) |              Deny | Whether partners may see users in their own organization is unresolved. Cross-organization access must be denied. |
| Users           | Invite/create user                         | Open / TBD (deny) |                                                                                                            Open / TBD (deny) |              Deny | No administrator or inviter role has been agreed.                                                                 |
| Users           | Change membership, organization, or role   | Open / TBD (deny) |                                                                                                            Open / TBD (deny) |              Deny | High-impact operation; requires an explicit decision and audit requirements.                                      |
| Users           | Disable/delete user                        | Open / TBD (deny) |                                                                                                            Open / TBD (deny) |              Deny | Lifecycle and ownership-transfer rules are unresolved.                                                            |
| Projects / orgs | List/view projects                         | Open / TBD (deny) |                      Only projects where `orgId === project.projectPartnerId` are in scope; action remains Open / TBD (deny) |              Deny | Partner queries must be filtered at the data-access boundary.                                                     |
| Projects / orgs | Create project                             | Open / TBD (deny) |                                                                                                            Open / TBD (deny) |              Deny | No creator role has been agreed.                                                                                  |
| Projects / orgs | Edit/archive/delete project                | Open / TBD (deny) |                                                                                                            Open / TBD (deny) |              Deny | Project administration permissions are unresolved.                                                                |
| Projects / orgs | Assign/change `projectPartnerId`           | Open / TBD (deny) |                                                                           Deny unless a future decision explicitly allows it |              Deny | Changing this value changes tenant access and must be tightly controlled and audited.                             |
| Projects / orgs | View partner organization                  | Open / TBD (deny) |                                         Own organization is the only organization in scope; action remains Open / TBD (deny) |              Deny | Cross-organization access is denied.                                                                              |
| Projects / orgs | Create/edit/delete organization            | Open / TBD (deny) |                                                                                                            Open / TBD (deny) |              Deny | Organization administration is unresolved.                                                                        |
| Public routes   | Sign-in and authentication callback routes |               N/A |                                                                                                                          N/A |            Public | Exact route list must be enumerated in code/config; public status must not be inferred from URL shape alone.      |
| Public routes   | Health/readiness endpoint                  |               N/A |                                                                                                                          N/A | Open / TBD (deny) | Decide whether the endpoint is public and what information it may expose.                                         |
| Public routes   | Static assets required by public pages     |               N/A |                                                                                                                          N/A |            Public | Assets must not contain tenant or user data.                                                                      |
| Public routes   | Password reset / invitation acceptance     |               N/A |                                                                                                                          N/A | Open / TBD (deny) | Token design, expiry, and enumeration protections must be agreed.                                                 |
| Public routes   | All other application routes and APIs      | Subject to policy |                                                                                                            Subject to policy |              Deny | Default-deny rule.                                                                                                |

The matrix is deliberately conservative. It records the complete surface that needs a decision while treating the only confirmed agreement—membership classification and partner project scope—as a scope rule rather than an implicit grant of CRUD permissions.

---

## 5. Consequences & Next Steps

### Positive Consequences

- Partner isolation has one explicit, testable rule based on existing domain relationships.
- Authorization can be enforced consistently across UI and server operations.
- Unresolved permissions remain visible and default to deny instead of becoming accidental behavior.
- The model can later add roles or capabilities without changing the agreed organization/project boundary.
- Permission tests can be organized by actor, project scope, and action.

### Negative Consequences / Trade-offs

- The current decision is insufficient to enable most actions until the team resolves the Open / TBD entries.
- Every project-scoped resource must reliably resolve to its owning project.
- Central policy integration and test coverage require more initial work than UI-only gating.
- Using `orgId === null` as the NPTS discriminator couples membership meaning to nullability; schema changes must preserve or deliberately replace that invariant.
- Changes to `project.projectPartnerId` can immediately change partner access and therefore require validation and auditability.

### MVP Exclusions

The following are outside the scope of this ADR's MVP decision unless issue #41 is updated and the team explicitly agrees otherwise:

- A configurable role and permission administration UI.
- Custom roles or per-user permission overrides.
- Field-level permissions.
- Multiple partner organizations assigned to one project.
- A user belonging to multiple organizations.
- Temporary, delegated, or time-bound access.
- Cross-organization partner collaboration.
- External identity-provider group-to-role synchronization.
- Formal moderator, auditor, super-admin, or read-only roles.
- Approval workflows for privileged actions.
- A complete audit-log product; however, security-sensitive mutations should not be implemented without deciding their audit requirements.

### Open Questions

These questions require team review. They are not decisions made by this ADR:

1. Which ticket actions may NPTS members perform, and are there separate internal roles?
2. Which ticket actions may partner members perform on an in-scope project?
3. Are ticket permissions affected by reporter, assignee, watcher, status, or ticket type?
4. May partners see all tickets for an in-scope project or only tickets they created or participate in?
5. Who may change ticket status, assignment, priority, attachments, or delete/archive a ticket?
6. Who may view, post, edit, delete, or moderate chat messages?
7. Who may assign or change `project.projectPartnerId`, and what audit trail is required?
8. What is the exact allowlist of public routes, including health checks, password reset, and invitation acceptance?
9. Should denied access return `403`, `404`, or a context-dependent response to minimize resource enumeration?
10. What logging, alerting, and audit retention are required for denied requests and privileged mutations?
11. Are service accounts, background jobs, or API integrations actors in the same policy model?
12. Does issue #41 require a read-only permission-matrix UI, an editable administration UI, or only enforcement and navigation gating?

### Action Items

- Review every **Open / TBD** matrix entry with the team and record the approved outcome in issue #41 or a follow-up ADR.
- Confirm and record the deciders; do not move this ADR to Accepted without them.
- Enumerate the exact public-route allowlist.
- Define shared server-side authorization helpers/policies for actor classification, project resolution, partner scope, and action checks.
- Add tests for NPTS users, matching partner organizations, non-matching partner organizations, missing projects, unauthenticated users, and attempts to change `projectPartnerId`.
- Ensure list queries are scope-filtered server-side and detail/mutation operations re-check scope.
- Mirror effective capabilities in the UI without relying on UI state for enforcement.
- Request team review of this Proposed ADR and the permission matrix.
- After team approval, update the ADR status and deciders, implement the approved matrix, and merge through the normal development review process. Do not merge unresolved permission assumptions as team decisions.
