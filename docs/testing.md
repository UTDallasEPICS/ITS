# Testing guide (Vitest baseline)

This guide teaches you how to run, read, write, review, and troubleshoot the automated
tests in this template. **It assumes no prior testing experience.** If a word looks
unfamiliar, check [Words you'll see](#words-youll-see) first.

The template ships with a small **Vitest** baseline: one real component test for the
application shell. Vitest is the test runner (the program that finds and runs your tests).

> **What this baseline needs:** nothing external. It runs with **no `.env` file, no
> database, no real email, no browser installation, no dev server, and no customer data.**
> You can clone the repo, install dependencies, and run the tests immediately.

> **Playwright note:** browser/end-to-end testing with Playwright is intentionally **not**
> part of this template. That work lives separately (NPTS). This guide is Vitest-only.

---

## Words you'll see

Read these once; refer back as needed.

- **Repository (repo):** the project's folder of code, tracked by Git.
- **Repository root:** the top folder of the repo — the one containing `package.json` and
  `README.md`. All commands in this guide are run from here.
- **Terminal:** the text window where you type commands (Terminal on macOS/Linux, or the
  integrated terminal in VS Code on any OS).
- **Command:** a line you type into the terminal and run by pressing Enter.
- **Package / dependency:** a reusable piece of code the project installs. Test tools like
  `vitest` are **dev dependencies** (needed to develop/test, not to run in production).
- **Automated test:** code that checks other code behaves as expected, so a human doesn't
  have to re-check by hand every time.
- **Test file:** a file containing tests. Here they live in `tests/nuxt/` and end in
  `.test.ts`.
- **Test case:** one individual check, written with `it(...)` or `test(...)`.
- **Suite:** a group of related test cases, written with `describe(...)`.
- **Assertion:** the line that states what must be true, e.g. `expect(x).toBe(3)`. If it's
  not true, the test fails.
- **Expected value vs actual value:** _expected_ is what you told the test to require;
  _actual_ is what the code really produced. A failure prints both so you can compare.
- **Component test:** a test that renders a UI component (here, a Vue component) and checks
  what it produces — without running the whole app.
- **Mock / stub:** a stand-in for a real thing so a test stays isolated and fast. A **stub**
  is a placeholder (e.g. we stub `<NuxtPage />` so no real page loads). A **mock** is a
  fake whose calls you can inspect.
- **Headless mode:** running without a visible window/browser. These tests run headless — no
  UI pops up.
- **Watch mode:** the runner stays open and re-runs tests automatically when you save a
  file. Good while writing code.
- **Exit code:** the number a command returns when it finishes. **0 means success**; any
  other number means failure. Tools like CI read this to decide pass/fail.
- **Merge request (MR) / pull request (PR):** a proposed set of changes submitted for review
  before it's merged into the shared branch.

---

## Prerequisites

You need **Node.js** and **pnpm** installed. Check your versions:

```bash
node --version
pnpm --version
```

- Node.js 20 or newer is recommended (Nuxt 4 requires a modern Node).
- This project uses `pnpm`. If `pnpm --version` errors, install it: `npm install -g pnpm`.

If a command "isn't found," the tool isn't installed or isn't on your PATH — install it and
open a new terminal.

## Open a terminal at the repository root

1. Get the code and enter the folder:
   ```bash
   git clone <your-repo-url>
   cd nuxt-template
   ```
2. Confirm you're at the root — you should see `package.json`:
   ```bash
   ls package.json
   ```
   (In VS Code: **Terminal → New Terminal** opens at the folder you have open.)

## Install dependencies

Run this once (and again whenever dependencies change):

```bash
pnpm install
```

This downloads Vitest and the other tools into `node_modules/`. No `.env`, database, or
other setup is needed to run the tests.

## Your first green run

```bash
pnpm test
```

`pnpm test` runs every test **once** and then exits (this is one-shot mode). A successful run
ends with a summary like:

```
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

Exact counts, timings, and version numbers will differ over time — that's fine. **What
matters:** it says _passed_, the number of tests is greater than zero, and the command
returns to your prompt with **exit code 0**.

### How do I know a command finished?

The command stops printing and your prompt (e.g. `$` or your folder name) comes back. To see
the exit code of the last command:

```bash
echo $?
```

`0` = success. Anything else = failure.

## Everyday commands

| Command                                                       | What it does                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm test`                                                   | Run all tests once and exit (use this before opening an MR).                 |
| `pnpm test:watch`                                             | Run tests and **keep watching** — re-runs on save. Press **Ctrl+C** to stop. |
| `pnpm exec vitest run tests/nuxt/app-shell.test.ts`           | Run just **one file**.                                                       |
| `pnpm exec vitest run -t "links the brand to the home route"` | Run just **one named test** (matches the text in `it(...)`).                 |

> Tip: to filter by name, use `pnpm exec vitest run -t "..."` (not `pnpm test -- -t`). The
> `pnpm exec` form passes the flag straight to Vitest.

---

## Reading the included test

The baseline test is [`tests/nuxt/app-shell.test.ts`](../tests/nuxt/app-shell.test.ts). It
renders the real application shell (`app/app.vue`) and checks two things that are always
present: the brand links home, and the theme toggle is reachable by screen readers.

Every test follows **Arrange → Act → Assert**:

- **Arrange:** set up the world the test needs.
- **Act:** do the thing you're testing.
- **Assert:** state what must be true.

```ts
// @vitest-environment nuxt          // run this file in the Nuxt environment
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest' // the toolkit
import { mountSuspended } from '@nuxt/test-utils/runtime' // renders Nuxt components
import App from '../../app/app.vue' // the component under test

describe('application shell (app.vue)', () => {
  // a SUITE: a group of related cases
  let fetchSpy

  beforeEach(() => {
    // ARRANGE: watch the network so we can prove the shell renders offline.
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })
  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('links the brand to the home route', async () => {
    // a TEST CASE
    // ACT: render the shell; stub <NuxtPage/> so no page/route loads.
    const wrapper = await mountSuspended(App, { global: { stubs: { NuxtPage: true } } })

    // ASSERT: the brand link says "Nuxt Template" and points to "/".
    const brandLink = wrapper.get('a')
    expect(brandLink.text()).toContain('Nuxt Template') // matcher: text contains
    expect(brandLink.attributes('href')).toBe('/') // matcher: exact equality
    expect(fetchSpy).not.toHaveBeenCalled() // matcher: never called
  })
})
```

The pieces:

- **`import`** brings in the tools and the component you're testing.
- **`describe(name, fn)`** groups related cases into a suite.
- **`it(name, fn)`** (same as **`test`**) defines one test case; its `name` is what `-t`
  matches.
- **`expect(actual)`** starts an assertion about a value.
- **Matchers** finish it: `.toBe(x)` (exact equality), `.toContain(x)` (includes),
  `.not.toHaveBeenCalled()` (a spy/mock was never used). There are many more.
- **`mountSuspended`** renders a Nuxt component with auto-imports and Nuxt UI available;
  **stubbing** `NuxtPage` keeps the test to just the shell.

---

## Learn by doing: a reversible red → green → green exercise

This teaches you what a failure looks like. **You will undo every change — nothing here is
permanent.**

1. **Green.** Run `pnpm test`. Everything passes.
2. **Make it red.** In `tests/nuxt/app-shell.test.ts`, change the expected href from `'/'` to
   `'/wrong'`:
   ```ts
   expect(brandLink.attributes('href')).toBe('/wrong')
   ```
   Run `pnpm test`. It **fails** with something like:
   ```
   AssertionError: expected '/' to be '/wrong' // Object.is equality
   - Expected: "/wrong"
   + Received: "/"
   ```
   Read it as: _expected_ `/wrong`, but the code actually produced (_received_) `/`. The exact
   wording varies by Vitest version — focus on the expected-vs-received pair.
3. **Green again.** Change it back to `'/'` and run `pnpm test`. It passes.

You just experienced the whole loop: a passing test, a failing test that explains itself, and
a fix. Real test-driven work is the same loop.

---

## What passing and failing look like

**Passing** (numbers/timings vary):

```
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

**Failing** (numbers/wording vary):

```
 FAIL  tests/nuxt/app-shell.test.ts > application shell (app.vue) > links the brand to the home route
AssertionError: expected '/' to be '/wrong'
 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```

Don't match this output character-for-character across versions. The signal is the word
**FAIL**, the failing test's name, and the expected-vs-received values.

---

## Common failure categories

- **Assertion failure:** the code produced something other than what you expected. The most
  common and most useful — it prints expected vs received.
- **Setup/environment error:** the test crashes before assertions run (e.g. wrong import
  path, missing dependency). Usually a stack trace, not an expected-vs-received message.
- **No tests found:** the run fails on purpose (this project sets `passWithNoTests: false`).
  It means your file isn't under `tests/nuxt/` or doesn't end in `.test.ts`.
- **Flaky/timeout:** a test hangs or intermittently fails. The baseline is designed to be
  deterministic; if you see this, suspect something reaching outside the test (a real timer,
  network, or shared state).

## Troubleshooting

- **`pnpm: command not found`** → install pnpm (`npm install -g pnpm`) and open a new terminal.
- **`Cannot find module` / import error** → check the import path in your test; run from the
  repository root; try `pnpm install` again.
- **"No test files found"** → your file must live in `tests/nuxt/` and end with `.test.ts`.
- **Watch mode won't stop** → press **Ctrl+C** in that terminal.
- **A test suddenly fails after `git pull`** → run `pnpm install` (dependencies may have
  changed), then re-run `pnpm test`.
- **Still stuck?** Use the help-request template below.

## Asking for help (copy this)

```
What I ran:
  <the exact command>

What I expected:
  <e.g. all tests to pass>

What happened:
  <paste the FULL terminal output, including the summary line>

Environment:
  node --version -> <paste>
  pnpm --version -> <paste>
  OS -> <macOS / Windows / Linux>

What I already tried:
  <e.g. pnpm install, ran from repo root>
```

Pasting the full output (not a screenshot of one line) gets you a faster answer.

---

## The testing expectation for merge requests

**Every merge request should include at least one meaningful test for the behavior it
changes**, unless a mentor explicitly records a waiver on the MR.

- **What a student provides:** for the behavior you added or changed, a test that would fail
  _before_ your change and passes _after_ it — plus a green `pnpm test` locally.
- **What a mentor verifies:** that the test actually exercises the changed behavior (not a
  trivial always-true check), that `pnpm test` passes, and that isolation is preserved (no
  real network/database/email). If tests are genuinely not applicable, the mentor records a
  short waiver noting why.

"Meaningful" means the test would catch a real regression — weakening assertions or isolation
just to get green does not count.

## Checklists

**Student — before opening an MR:**

- [ ] `pnpm install` runs cleanly.
- [ ] `pnpm test` passes locally (exit code 0, more than zero tests).
- [ ] I added/updated at least one meaningful test for my change (or have a mentor waiver).
- [ ] My test is isolated: no real network, database, email, or customer data.
- [ ] I pasted my local `pnpm test` summary into the MR description.

**Mentor — during review:**

- [ ] `pnpm test` passes on the branch.
- [ ] There is a meaningful test for the changed behavior (or a recorded waiver).
- [ ] Assertions are real (would fail if the behavior broke); isolation isn't weakened.
- [ ] Test files are in `tests/nuxt/` and named `*.test.ts`.

---

## Limitations of this baseline

This baseline **does not** cover:

- Authentication flows, OTP, or email delivery
- Database-backed sessions or protected routes
- File uploads
- Playwright / browser end-to-end journeys (intentionally separate — NPTS)
- Deployment or production behavior

Those need a separately provisioned, disposable test environment with explicit database and
provider isolation. Start here, and grow coverage deliberately from this foundation.
