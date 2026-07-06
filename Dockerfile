# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Dependências
COPY package*.json ./
RUN npm ci --ignore-scripts

# Prisma
COPY prisma ./prisma/
RUN npx prisma generate

# Código fonte
COPY . .
RUN npm run build

# ─── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Apenas produção
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# Prisma gerado
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Build artefatos
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Não rodar como root
RUN addgroup -S beautyflow && adduser -S beautyflow -G beautyflow
USER beautyflow

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main"]
