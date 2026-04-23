FROM node:25-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN HUSKY=0 SHARP_IGNORE_GLOBAL_LIBVIPS=true npm ci

FROM deps AS build
COPY . .
RUN NODE_ENV=production ./node_modules/.bin/react-router build

FROM node:25-alpine AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN HUSKY=0 SHARP_IGNORE_GLOBAL_LIBVIPS=true npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD ["npm", "run", "start"]
