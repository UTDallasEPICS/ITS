# ADR 006: Rate Limiting for the Widget API

- **Status:** Proposed
- **Deciders:** Wan
- **Date:** 2026-10-22

## 1. Context & Problem Statement

The widget submission endpoint (`POST /api/widget/tickets`, #32) is public. Anyone on a partner site can submit a ticket without an ITS account. A bot could send hundreds of tickets in a few minutes and flood NPTS and the project repositories. The CAPTCHA (ADR 005) makes each submission cost the bot some work, but it does not stop a bot that keeps solving challenges. We also need to limit how many tickets can be sent in a short time.

## 2. Decision Drivers (Goals & Constraints)

- **Stop floods:** Many submissions in a short time should be blocked before a ticket is created.
- **Don't block real users:** Several people may share one IP (for example, a school or an office). Real users rarely send more than one or two tickets.
- **Easy to maintain:** EPICS team members change every semester, so the solution should be simple and should not need new infrastructure or paid services.
- **Anonymous users:** We can't limit per account, so we have to use the site tag and the client IP.

## 3. Options Considered

### Option 1: Rate limiter in the ITS API (in-memory)

We write a small helper (`server/utils/rateLimit.ts`) and call it in the submission handler. It keeps recent request times in server memory, keyed by site tag + IP.

**Pros:**

- No new dependency or infrastructure, and it is free.
- We control the rules (limits, cooldown, keys) and can use the site tag.
- Easy to test with Vitest without a database or network.
- Works the same on dev, stage, and prod.

**Cons:**

- Counts are lost when the server restarts.
- If ITS runs on more than one ECS instance, each instance counts separately, so the real limit becomes looser.

### Option 2: `nuxt-security` module

A community Nuxt module that includes a rate limiter, configured in `nuxt.config.ts`.

**Pros:**

- Ready-made, with only configuration needed.

**Cons:**

- It adds a dependency to the whole app, and its other default settings (security headers) could affect other workstreams.
- Less control over the cooldown and over using the site tag as a key.
- It still needs shared storage to work across multiple instances.

### Option 3: AWS WAF rate-based rules

A rule in front of ITS that blocks an IP after too many requests.

**Pros:**

- Blocks floods before they reach our server, and works across all instances.

**Cons:**

- It is infrastructure work outside this workstream.
- It only counts by IP, so it can't use the site tag. It also can't send a friendly message to the widget.
- It may add AWS cost.

## 4. Decision & Justification

**Chosen Option:** Option 1 — Rate limiter in the ITS API (in-memory)

Our traffic is expected to be low (a few tickets per project), so a simple limiter in server memory is enough for now. It needs no new infrastructure, costs nothing, and is easy for the next team to read and test. Option 2 adds an app-wide dependency for one route, and Option 3 depends on AWS access and can't use site tags.

The limiter works like this:

- **Sliding window:** For each site tag + IP, count requests in the last 10 seconds. More than 3 is blocked. A sliding window avoids the gap of a fixed window, where 3 requests at 9 s and 3 at 11 s would all pass.
- **Cooldown:** Once blocked, the same site tag + IP is blocked for 5 minutes. Without a cooldown, a bot could keep sending 3 tickets every 10 seconds.
- **Site tag limit:** Each site tag allows at most 50 tickets per hour, so a bot using many IPs still can't flood one project.
- **Response:** A blocked request gets `429 Too Many Requests` with a `Retry-After` header, and the widget shows "Please try again in N minutes."

Using site tag + IP instead of only IP means people who share an IP on different partner sites don't block each other.

## 5. Consequences & Next Steps

### Positive Consequences

- Floods are stopped before a ticket is created.
- Users get a clear message about when they can try again.
- The rules are covered by unit tests.

### Negative Consequences / Trade-offs

- The rate limit is not exact. Counts are kept separately on each server and are lost when a server restarts, so a bot may get a few more requests than the limit allows.
  - To fix this later, all rate limit code is in one helper (`server/utils/rateLimit.ts`), so we can move the counts to shared storage like Redis by changing only that file.
- Behind the AWS load balancer, the client IP must be read from the `X-Forwarded-For` header (`getRequestIP(event, { xForwardedFor: true })`), or every request would look like it came from the load balancer.
- The limits (3 per 10 s, 5-minute cooldown, 50 per site tag per hour) are starting values and will need tuning with real traffic.

### Action Items

- Implement the rate limiter, `429` + `Retry-After`, and tests in #32.
- Show the `Retry-After` message in the widget, and disable the submit button while sending (UX only).
- Check with the team how many ECS instances ITS runs on.
- Revisit shared storage or AWS WAF if ITS runs on more than one instance or traffic grows.
