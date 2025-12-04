FROM node:25 AS base
WORKDIR /app
COPY package.json package-lock.json ./

FROM base AS build
COPY . .

ENV ASTRO_TELEMETRY_DISABLED=1
RUN SHARP_IGNORE_GLOBAL_LIBVIPS=true NODE_ENV=development npm ci
RUN NODE_ENV=production npm run build

FROM base AS runtime
RUN SHARP_IGNORE_GLOBAL_LIBVIPS=true npm ci --omit=dev
COPY --from=build /app/dist ./dist
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD NODE_ENV=production node ./dist/server/entry.mjs
