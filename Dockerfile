# Build container
FROM node:lts-alpine AS builder

# Use Workdir because things like tailwind will scan the entire current dir and can cause issues if it scans root
WORKDIR /app

# Toolchain for compiling native modules (e.g. better-sqlite3) from source.
# Alpine (musl) has no prebuilt binaries for them, so node-gyp needs Python + a
# C/C++ compiler. Only the builder needs these; the deployment image just runs
# the bundled .output.
RUN apk add --no-cache python3 make g++

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

ENV PNPM_HOME="~/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm i -g pnpm

RUN pnpm i --frozen-lockfile

COPY . ./
RUN pnpm run build


# Deployment container
FROM node:lts-alpine AS deployment
WORKDIR /app
COPY --from=builder /app/.output ./
EXPOSE 3000
CMD ["node", "./server/index.mjs"]
