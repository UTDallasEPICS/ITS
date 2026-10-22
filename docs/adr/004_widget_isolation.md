# ADR 004: Embeddable Widget Isolation

- **Status:** Proposed
- **Deciders:** Wan, Tushar
- **Date:** 2026-10-17

## 1. Context & Problem Statement

Project sites need a way for their users to submit tickets to NPTS without an ITS account (REQ-F-13). The plan is an embeddable widget: a partner adds one `<script>` tag with their site tag, and a launcher button + popup shows up on their page.

Since the widget runs inside another partner's page, we need to decide how it’s isolated from the host page. The host’s CSS shouldn’t break the widget, but partners should still be able to customize how it looks.

## 2. Decision Drivers (Goals & Constraints)

- **CSS isolation:** host styles shouldn't accidentally break the widget, and widget styles shouldn't leak into the host page.
- **Reuse of Nuxt UI / Tailwind components:** ideally we reuse UI code from the ITS app (e.g. the shared ticket form, #36) instead of building it twice.
- **Cookie and cross-origin behavior:** the widget needs to reliably reach the ITS API from any partner site. Widget users are anonymous, so we don't need ITS login cookies.
- **Bundle size:** partners should download as little as possible.
- **Partner customization:** partners should be able to style the widget with their own CSS (colors, fonts, etc.) and react to its state (opened, submitted, error).

## 3. Options Considered

### Option 1: Vue custom element + Shadow DOM

A separate Vite build bundles Vue and the widget into one script (`/widget/v1/its-widget.js`), served from ITS's `public/` folder. The script registers `<its-widget>` with `defineCustomElement`, and Vue renders the widget inside a Shadow DOM on the partner's page. The widget calls the ITS API directly.

**Pros:**

- Good CSS isolation in both directions. Tested on the sample site with `button { background: hotpink !important }` and the widget wasn't affected.
- Small: one file, including Vue.
- Partners can customize it with their own CSS through CSS variables (e.g. `its-widget { --its-primary: red }`) and `::part()`, but only the parts we expose, so they can't accidentally break it.
- Widget state can be exposed with attributes and DOM events (e.g. `<its-widget open>`, an `open` event), so partners can style or react to it.
- Plain Vue components can be shared with the ITS app. Tested with `app/components/shared/StatusPill.vue`, which renders in both.

**Cons:**

- Nuxt UI doesn't work in the widget. When I imported `UButton`, the build failed with `Missing "#build/ui/button"`. Shared components need to be plain Vue + plain CSS.
- Requests are cross-origin, so ITS needs CORS headers on widget routes. Already done in #31.

### Option 2: Loader script + `<iframe>`

A small loader script adds an `<iframe>` to the partner's page that loads a widget page hosted by ITS.

**Pros:**

- Complete isolation (separate page).
- Nuxt UI and Tailwind work as-is since the iframe page is a normal Nuxt page.
- API calls are same-origin from inside the iframe, so no CORS needed.

**Cons:**

- Heavier: the iframe loads a full Nuxt page.
- Partner CSS can't reach inside the iframe, so every customization option has to be built by us and passed in through the URL or `postMessage`.
- Opening/closing the popup means resizing the iframe, and telling the partner page about state changes, both of which need `postMessage` back and forth.
- ITS would need to allow being framed by partner sites (`frame-ancestors`). Cookies inside the iframe are third-party cookies, which most browsers block, so it doesn't make auth any easier.

## 4. Decision & Justification

**Chosen Option:** Option 1 — Vue custom element + Shadow DOM

The iframe gives better isolation and lets us use Nuxt UI, but Option 1's isolation was already good enough when we tested it with styles on the sample site. The CORS cost is already handled in #31, and since widget users are anonymous, cookies don't matter either way.

Option 1 is a lot better on bundle size and on partner customization. Partners can theme it with their own CSS and react to its state with normal attributes/events, while with an iframe we'd have to build every option ourselves and set up a `postMessage` protocol for everything. The widget UI is small (a launcher, a popup, and a form), so not using Nuxt UI is an acceptable trade-off.

## 5. Consequences & Next Steps

### Positive Consequences

- Partners embed it with one line: `<script src="https://<its-host>/widget/v1/its-widget.js" data-site-tag="<site-tag>" defer></script>`
- `pnpm build` builds the widget before Nuxt, so it ships in the Docker image.
- The widget reads the ITS API URL from its own script src, so the same bundle works on dev, stage, and prod without rebuilding.

### Negative Consequences / Trade-offs

- Components shared with the widget (`app/components/shared/`) can't use Nuxt UI, Tailwind, or Nuxt auto-imports/composables. They need to be plain Vue with plain CSS.
- The CSS variables, parts and events we expose become something we need to keep stable in `v1`.

### Action Items

- Share the shared component rule with Aryan so the ticket form (#36) can be used in the widget.
- Mount the ticket form in the widget popup once it's ready (#20).
