FROM node:lts-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

FROM base AS build
COPY . .

ENV ASTRO_TELEMETRY_DISABLED=1
RUN NODE_ENV=development npm install
RUN npm run build

FROM base AS runtime
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD node ./dist/server/entry.mjs