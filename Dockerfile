# ───────────────────────────────────────────────────────────
# Stage 1 — build
# ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copia apenas manifests primeiro (cache de camadas)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --ignore-scripts

# Gera Prisma Client
RUN npx prisma generate

# Copia código e compila
COPY . .
RUN npm run build

# ───────────────────────────────────────────────────────────
# Stage 2 — runner (imagem final mínima)
# ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Usuário não-root por segurança
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Só dependências de produção
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev --ignore-scripts && npx prisma generate

# Artefatos compilados do stage anterior
COPY --from=builder /app/dist ./dist

# Permissões
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# Roda migrations e inicia (migrations idempotentes com prisma migrate deploy)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
