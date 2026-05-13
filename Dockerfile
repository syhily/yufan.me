# Build stages run on Debian slim (glibc + bash) because
# `vite-plugin-font` → `cn-font-split` downloads a `libffi-<rust-target>`
# native binary in `postinstall` via `bash init.sh`. The script has no
# musl branch (it resolves `rust_target='null'` on Alpine and silently
# skips the download), and Alpine ships no bash by default — so on
# Alpine the binary never lands and `vp build` fails with
# `libffi-wasm32-wasip1.wasm.so: No such file or directory`. The runtime
# stage stays on Alpine because `cn-font-split` is a devDependency and
# `npm ci --omit=dev` never installs it there.
#
# `init.sh` shells out to `curl` to fetch the `.so` from GitHub, and the
# package wraps its postinstall as `node cli.js i default || node -v` so
# a missing `curl` (or any other failure) is swallowed and only surfaces
# later as an `ERR_FFI` when `vp build` tries to dlopen the missing
# binary. Install curl + CA certs in the deps stage so the download
# actually runs.
FROM node:25-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY . .
RUN --mount=type=cache,target=/root/.npm \
    npm ci
RUN NODE_ENV=production npm run build

FROM node:25-alpine AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD ["npm", "run", "start"]
