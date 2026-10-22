# ADR 005: CAPTCHA Provider for the Embeddable Widget

- **Status:** Proposed
- **Deciders:** Wan
- **Date:** 2026-10-22

## 1. Context & Problem Statement

The widget lets anyone on a partner site submit a ticket without an ITS account (REQ-F-13). This makes the submission endpoint an easy target for bots that send many fake tickets.

Rate limits and a honeypot will be covered in the API protection ADR. On top of that, we want a CAPTCHA to check that the person submitting is a human. We need to choose a provider that is free, works on many partner domains, and works inside our widget's Shadow DOM.

## 2. Decision Drivers (Goals & Constraints)

- **Free:** The project has no budget, so the provider must have a free tier that covers our traffic.
- **Many partner domains:** Every EPICS project that uses the widget has its own domain, and new projects join every semester. Adding a partner should not require extra setup outside ITS.
- **Easy to maintain:** EPICS team members change every semester, so we want as few external accounts and dashboards as possible.
- **Works in our widget:** It must render inside the Shadow DOM, and tokens must be verified on the ITS server.

## 3. Options Considered

### Option 1: Google reCAPTCHA v3 (Essentials tier)

reCAPTCHA v3 watches the user's behavior in the background and gives a score from 0.0 (bot) to 1.0 (human). Our server sends the token to Google to verify it.

- reCAPTCHA tier comparison: https://docs.cloud.google.com/recaptcha/docs/compare-tiers
- reCAPTCHA billing: https://docs.cloud.google.com/recaptcha/docs/billing-information

**Pros:**

- It is the most well-known option and has strong bot detection.
- It is invisible, so users don't solve puzzles.
- Domain checking can be turned off. Then our server checks the `hostname` in Google's response against the project's domain in the ITS database, so adding a partner only happens in ITS.

**Cons:**

- The free tier is 10,000 requests per month. If a bot attack uses it up, real users can't submit tickets until next month.
- It needs a Google Cloud project owned by NPTS.
- User data is sent to Google, which is a privacy concern for the public.

### Option 2: Cloudflare Turnstile (Free plan)

Turnstile checks the browser in the background and sometimes asks for one click. Our server verifies the token with Cloudflare's Siteverify API.

- Cloudflare Turnstile plans: https://developers.cloudflare.com/turnstile/plans/

**Pros:**

- Unlimited free requests.
- Strong bot detection and usually invisible.

**Cons:**

- Every partner domain must be registered in the Cloudflare dashboard. Each widget allows only 10 domains, so we would need a new widget (and new keys) for every 10 partners.
- It needs a Cloudflare account owned by NPTS.

### Option 3: ALTCHA (open source, self-hosted)

ITS gives the browser a small math problem (proof-of-work). The browser solves it in the background, and ITS checks the answer. No third-party service is involved.

- ALTCHA open-source CAPTCHA: https://altcha.org/open-source-captcha/

**Pros:**

- Free with no limits (MIT license).
- No external account, no keys from another company, and no domain registration. Adding a partner only happens in ITS.
- Visitor data stays on our server.
- ALTCHA itself is a web component, so it is likely to work inside our Shadow DOM.

**Cons:**

- It does not detect bots. It only makes each submission cost some computing time, so a bot can still pass if it does the work.
- We have to build and maintain the challenge endpoint and the verification code ourselves (an official Node.js library helps).
- It is less known, so there are fewer examples and answers online.

## 4. Decision & Justification

**Chosen Option:** Option 3 — ALTCHA (to be confirmed with the mentor). Option 2 — Turnstile is the fallback.

The hardest constraints for us are many partner domains and rotating team members. ALTCHA has no account and no domain list to manage outside ITS, and it is free at any volume. Its weaker bot detection is acceptable because our traffic is expected to be low and the CAPTCHA is not the only protection: the API also uses site tag checks and rate limits with cooldown.

reCAPTCHA is not chosen because its monthly limit can be used up by an attack, and it sends user data to Google. If ALTCHA is not enough, Turnstile is the next choice, since it is free with no limit and has strong detection.

## 5. Consequences & Next Steps

### Positive Consequences

- Partners don't need to set anything up for the CAPTCHA. They still embed the widget with one line.
- No external CAPTCHA account needs to be handed over between semesters.

### Negative Consequences / Trade-offs

- We add a challenge endpoint (for example, `GET /api/widget/challenge`) and server-side verification. A solved challenge must not be accepted twice.
- The HMAC secret key for ALTCHA must be kept in ITS `.env` and never in the widget bundle.

### Action Items

- Test ALTCHA and Turnstile inside the widget's Shadow DOM on the sample site before accepting this ADR.
- Implement the challenge endpoint and verification in #32, with tests.
- Explain in the integration guide (#33) that partners don't need to configure the CAPTCHA.
