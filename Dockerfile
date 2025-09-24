FROM node:24 AS base
WORKDIR /app
COPY package.json package-lock.json ./

FROM base AS build
COPY . .

ENV ASTRO_TELEMETRY_DISABLED=1
RUN rm -rf src/content/metas/images.json && curl -fssL https://cat.yufan.me/images/metadata.json > src/content/metas/images.json
RUN NODE_ENV=development npm install
RUN NODE_ENV=production npm run build

FROM base AS runtime
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD NODE_ENV=production node ./dist/server/entry.mjs
