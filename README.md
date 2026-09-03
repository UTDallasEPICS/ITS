# Nuxt Template (Better Auth + Drizzle + SQLite)

A modern, production-ready Nuxt 4 template featuring a robust authentication system, ORM integration, and a clean UI foundation.

## Features

- **Nuxt 4**: The latest and greatest from the Nuxt team.
- **Better Auth**: Comprehensive authentication with **Email OTP** support.
- **Drizzle**: Type-safe ORM for interacting with the database.
- **SQLite**: Lightweight, zero-configuration database, ideal for development and small-to-medium projects.
- **Nuxt UI v4**: Beautiful, accessible, and customizable UI components built with Tailwind CSS.
- **Nodemailer**: Pre-configured for sending verification emails via Gmail.
- **Vitest**: A ready-to-run testing baseline with an example component test. See [Testing](#testing).

## Stack

- **Framework**: [Nuxt](https://nuxt.com/)
- **Auth**: [Better Auth](https://www.better-auth.com/)
- **ORM**: [Drizzle](https://orm.drizzle.team/)
- **Database**: [SQLite](https://sqlite.org/)
- **UI Framework**: [Nuxt UI](https://ui.nuxt.com/)
- **Email**: [Nodemailer](https://nodemailer.com/)

## Getting Started

See the [Documentation](#documentation) section for topic guides. Otherwise, follow the setup steps below.

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd nuxt-template
```

### 2. Install dependencies

This project uses `pnpm`, but you can use `npm` as well.

```bash
pnpm install
```

### 3. Setup Environment Variables

Copy the example environment file and fill in your details.

```bash
cp .env.example .env
```

Open `.env` and configure the following:

- `DATABASE_URL`: The SQLite connection string (default: `file:./dev.db`).
- `BETTER_AUTH_SECRET`: A secure random string for encryption. You can generate one using `openssl rand -hex 32`.
- `BETTER_AUTH_URL`: The base URL of your application (default: `http://localhost:3000`).
- `EMAIL_USER`: Your Gmail address (for OTP delivery).
- `EMAIL_PASS`: Your Gmail App Password. [How to generate an App Password](https://support.google.com/accounts/answer/185833).

### 4. Database Setup

Initialize your SQLite database and run migrations. You will need to run this command anytime you need to change or create a database.

```bash
pnpm db:migrate
```

During development, if there are any database changes since the last migration, you will need to generate a new migration.

```bash
pnpm db:generate
```

### 5. Start the development server

```bash
pnpm dev
```

Your application will be available at `http://localhost:3000`.

### 6. How to Login

Login requires an email address that already exists in the database.

- **Option A: Use the seeded user**
  Go to `/auth` and log in with `email@example.com`.
- **Option B: Use your own email**
  Update `server/db/seed.ts` with your email, then run `pnpm db:seed` to re-seed.

**To get your OTP:**

- Check your configured email inbox.
- **Or**, run `pnpm db:studio` to open **Drizzle Studio** and look in the `verification` table.

## Project Structure

- `app/`: Frontend code (pages, components, assets, composables).
- `server/`: Backend code (API routes, authentication logic, database utilities).
- `server/db/`: Database schema and seed scripts.
- `drizzle/`: Generated migrations.
- `public/`: Static assets.
- `tests/`: Automated tests (Vitest).
- `docs/`: Topic guides (see [Documentation](#documentation)).

## Documentation

Topic guides live in the [`docs/`](docs/) directory:

- [`docs/testing.md`](docs/testing.md) — Vitest testing guide (from-zero, for beginners).
- [`docs/better_auth.md`](docs/better_auth.md) — Better Auth setup and usage.
- [`docs/file_upload_and_serve.md`](docs/file_upload_and_serve.md) — Uploading and serving files.
- [`docs/mcp.md`](docs/mcp.md) — Recommended MCP servers for AI coding assistants.

## Testing

This template ships with a small **Vitest** testing baseline and an example component test,
so every project starts with a working `pnpm test` command and a reference to copy from.

```bash
pnpm test        # run all tests once
pnpm test:watch  # re-run tests as you edit (Ctrl+C to stop)
```

The baseline is intentionally self-contained: it needs **no `.env` file, no database, no real
email, no browser installation, no dev server, and no customer data**. Clone, `pnpm install`,
and `pnpm test` works immediately.

New to testing? The [**Testing guide**](docs/testing.md) walks a complete beginner through
running, reading, writing, reviewing, and troubleshooting tests — and explains the expectation
that merge requests include a meaningful test for changed behavior.

CI runs `pnpm test` automatically on every pull request and on pushes to `dev`/`stage`/`prod`
(see `.github/workflows/test.yml`), so a broken or missing test is visible before it merges.

> Browser/end-to-end testing (Playwright) is intentionally kept separate from this template.

## GitHub Actions Configuration

**Important**: You must update the GitHub Actions workflow to point to your own repository and AWS configuration.

### Update GitHub Actions

Add the following Secrets and Variables to your repository:

1. **ACTIONS_ROLE_ARN (Secret)**:

   ```yaml
   arn:aws:iam::YOUR-AWS-ACCOUNT-ID:role/YOUR-ROLE-NAME
   ```

2. **REPOSITORY (Variable)**:

   ```yaml
   your-repository-name
   ```

Optionally, you may update the AWS region.

3. **AWS Region** (the `aws-region` in `.github/workflows/deploy.yml`):
   ```yaml
   aws-region: your-aws-region
   ```

### Required AWS Setup

Before the GitHub Actions will work, you need:

1. **AWS ECR Repository**: Create a repository in Amazon ECR
2. **IAM Role**: Create a role with GitHub Actions OIDC provider and ECR permissions
3. **GitHub Secrets**: Ensure your repository has the necessary AWS permissions

## License

MIT
