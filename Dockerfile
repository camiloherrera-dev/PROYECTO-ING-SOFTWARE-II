# ---- base: dependencias comunes ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- dev: nodemon y todo el código (docker-compose.override.yml monta el código encima) ----
FROM base AS dev
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- prod: solo dependencias de producción y usuario sin privilegios ----
# Es la última etapa: "docker build ." (el job docker-build del CI) construye esta.
FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY db ./db
COPY scripts/migrate.js ./scripts/migrate.js
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "src/server.js"]
