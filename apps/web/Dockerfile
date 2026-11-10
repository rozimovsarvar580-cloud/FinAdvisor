FROM node:20-alpine AS build-dependencies

WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build

WORKDIR /app
COPY --from=build-dependencies /app/node_modules ./node_modules
COPY apps/web ./
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN npm run build

FROM node:20-alpine AS production-dependencies

WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup --system --gid 1001 nextjs && \
    adduser --system --uid 1001 --ingroup nextjs nextjs

COPY --from=production-dependencies --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nextjs /app/.next ./.next
COPY --from=build --chown=nextjs:nextjs /app/src ./src
COPY --from=build --chown=nextjs:nextjs /app/next.config.mjs ./next.config.mjs
COPY --from=build --chown=nextjs:nextjs /app/package.json ./package.json
USER nextjs

EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
