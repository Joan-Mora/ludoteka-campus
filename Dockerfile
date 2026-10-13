# syntax=docker/dockerfile:1.7
# Ludoteka Campus: una sola imagen con la API NestJS, la web compilada, las migraciones y la siembra.
# La configuración llega por variables de entorno en tiempo de ejecución; la imagen no lleva secretos.

ARG NODE_VERSION=22.14.0

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run build \
 && npm prune --omit=dev --no-audit --no-fund \
 && mkdir -p /out/apps/api /out/apps/web/public /out/packages/contracts \
 && cp -r package.json node_modules db /out/ \
 && cp -r apps/api/package.json apps/api/dist /out/apps/api/ \
 && cp -r apps/web/package.json apps/web/dist /out/apps/web/ \
 && cp -r apps/web/public/email /out/apps/web/public/ \
 && cp -r packages/contracts/package.json packages/contracts/dist /out/packages/contracts/ \
 && for ws in apps/api apps/web packages/contracts; do \
      if [ -d "$ws/node_modules" ]; then cp -r "$ws/node_modules" "/out/$ws/"; fi; \
    done

FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
