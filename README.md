# 🪒 BeautyFlow

> Sistema de Agendamento Inteligente via WhatsApp com IA, cobrança recorrente e split automático de pagamentos para o mercado de beleza.

[![Status](https://img.shields.io/badge/status-spec%20%2B%20QA-yellow)]
[![Stack](https://img.shields.io/badge/stack-NestJS%20%7C%20Prisma%20%7C%20OpenAI%20%7C%20WhatsApp-blue)]
[![License](https://img.shields.io/badge/license-MIT-green)]

---

## ✨ Visão do Produto

SaaS B2B para barbearias, salões e manicures com:

- **IA conversacional 24h** — cliente agenda por texto livre no WhatsApp
- **Cobrança recorrente nativa** — Clube da Barba, Plano de Cabelo, Plano de Manicure
- **Split automático de comissões** — repasse direto no gateway, aderente à Lei do Salão Parceiro
- **Dashboard de gestão** — agenda multi-profissional, KPIs, relatórios de split

---

## 🗂️ Estrutura do Repositório

```
beautyflow/
├── docs/
│   ├── MARKET_RESEARCH.md       # Fase 1 — pesquisa e análise de concorrentes
│   ├── ARCHITECTURE.md          # Fase 2 — arquitetura geral e fluxo da IA
│   ├── ROADMAP.md               # Sprints e marcos de desenvolvimento
│   └── QA_REPORT.md             # Relatório de QA completo (bugs, Gherkin, severidades)
├── prisma/
│   └── schema.prisma            # Schema completo (16 models)
├── src/
│   ├── modules/
│   │   ├── booking/             # Engine de agendamento
│   │   ├── ai-orchestrator/     # Agentic loop OpenAI + tools
│   │   ├── billing/             # Recorrência, split, webhooks
│   │   ├── whatsapp/            # Canal WhatsApp Business API
│   │   └── dashboard/           # API do painel de controle
│   ├── common/
│   │   ├── tenant/              # TenantMiddleware + withTenant()
│   │   └── guards/              # JwtAuthGuard, RolesGuard
│   └── main.ts
├── test/
│   └── gherkin/                 # Casos de teste formais por módulo
└── package.json
```

---

## 🚀 Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS + TypeScript |
| ORM | Prisma + PostgreSQL |
| IA | OpenAI GPT-4o + Whisper |
| Canal | WhatsApp Business Cloud API (Meta) |
| Gateway MVP | Asaas |
| Gateway Enterprise | Zoop |
| Cache / Idempotência | Redis (Upstash) |
| Deploy | Railway / Vercel |
| Monitoramento | Sentry + Grafana |

---

## 📋 Documentação

- [Pesquisa de Mercado](./docs/MARKET_RESEARCH.md)
- [Arquitetura Técnica](./docs/ARCHITECTURE.md)
- [Roadmap de Sprints](./docs/ROADMAP.md)
- [Relatório de QA](./docs/QA_REPORT.md)
- [Schema Prisma](./prisma/schema.prisma)

---

## ⚡ Quick Start (futuro)

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Rodar migrations
npx prisma migrate dev

# Iniciar em desenvolvimento
npm run start:dev
```

---

## 📄 Licença

MIT © BeautyFlow
